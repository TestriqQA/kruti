import { buildRedirects, buildCanonicalHostRedirect } from "./lib/redirects.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Standalone output: a self-contained server.js plus only the node_modules
   * it actually traced, which is what the Docker image copies instead of the
   * whole dependency tree.
   *
   * Gated on an env var rather than switched on permanently, because Vercel
   * builds this same config and uses its own Build Output API. Leaving it off
   * there keeps the live deploy on exactly the path it ships on today; the
   * Dockerfile sets DOCKER_BUILD=1 for itself.
   */
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  experimental: {
    instrumentationHook: true,
    /**
     * The code-rendered post images (lib/render-card.tsx) read their font files
     * from disk at request time. Next's tracer cannot see a runtime
     * `fs.readFileSync(path.join(process.cwd(), ...))`, so without this the
     * .woff files are left out of the serverless bundle and every designed image
     * fails in production while working fine locally. Keep in step with
     * lib/og-fonts.ts if the fonts ever move.
     */
    outputFileTracingIncludes: {
      "/api/generate/**": ["./lib/fonts/**"],
    },
  },
  /**
   * D-10 (one canonical hostname) and D-19 (redirect map).
   *
   * Order matters: the host redirect runs first, so a request to
   * www.kruti.io/blog/old-slug lands on kruti.io/blog/old-slug and is then
   * redirected on to the new slug. Two hops only ever happen for a www request
   * to a renamed URL; everything else is a single 301.
   */
  async redirects() {
    return [...buildCanonicalHostRedirect(), ...buildRedirects()];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.licdn.com" },
      { protocol: "https", hostname: "**.linkedin.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://media.licdn.com https://*.linkedin.com https://*.public.blob.vercel-storage.com",
              "font-src 'self'",
              "connect-src 'self' https://api.razorpay.com https://lux.razorpay.com",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
