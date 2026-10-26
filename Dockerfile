# Production image for AWS (ECS / App Runner / EKS).
#
# Three stages so the thing that ships carries neither the toolchain nor the
# full dependency tree: deps installs, builder compiles, runner holds the
# standalone output and nothing else.
#
# Build it:
#   docker build -t kruti:latest \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://kruti.io \
#     --build-arg NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx .
#
# Run it:
#   docker run -p 3000:3000 --env-file .env.production kruti:latest
#
# The CI image is separate - docker/Dockerfile.ci. That one runs checks; this
# one is what serves traffic.

# ─── base ────────────────────────────────────────────────────────────────────
# bookworm-slim, not alpine: Prisma's engines and sharp both want glibc, and
# the musl builds are the usual source of "works locally, segfaults in prod".
FROM node:22-bookworm-slim AS base
# openssl is what Prisma's query engine links against; the slim image drops it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ─── deps ────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Full install including devDependencies - the build needs next, prisma and tsc.
RUN npm ci

# ─── builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they have
# to be present HERE - passing them at `docker run` does nothing. Getting this
# wrong is quiet: the site builds and serves, and Razorpay checkout fails only
# when a real user reaches the payment step.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=${NEXT_PUBLIC_RAZORPAY_KEY_ID}

# Turns on `output: "standalone"` in next.config.mjs. Gated so Vercel's build,
# which reads the same config, is unaffected.
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx prisma generate

# Server-side secrets are deliberately NOT build args. These placeholders only
# stop module-scope reads throwing during static generation, and they are set
# inline on this one command so they never become layer metadata - the real
# values arrive as runtime env.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build"     NEXTAUTH_SECRET="build-time-placeholder-not-used-at-runtime"     npx next build

# ─── runner ──────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Containers must bind all interfaces; the default 127.0.0.1 is unreachable
# from outside the task and shows up as failing ALB health checks.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# The traced server and its node_modules subset.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets and public/ are not part of the trace and must come separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The post-image renderer reads its .woff files at REQUEST time with
# fs.readFileSync(path.join(process.cwd(), "lib", "fonts", ...)). Next's tracer
# cannot see a runtime path join, so without this copy every designed image
# fails in production while working on a developer's machine. Keep in step with
# lib/og-fonts.ts and next.config.mjs's outputFileTracingIncludes.
COPY --from=builder --chown=nextjs:nodejs /app/lib/fonts ./lib/fonts

# Schema only, so `prisma db push` can be run against a new environment from a
# one-off task. The generated client is already inside the traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# Hits a real route rather than just the port, so a process that is up but
# failing to render is still reported unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
