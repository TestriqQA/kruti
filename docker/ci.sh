#!/usr/bin/env bash
#
# The checks, in the order that fails cheapest first.
#
# There is no test suite in this repo - root test-*.js are manual scratch
# scripts. So "CI" here means: does the committed code still typecheck, build,
# apply its schema, and serve a page. That is exactly the set that would have
# caught the last two production breakages:
#
#   - a merge reintroduced COMPANY.name after the field was deleted. tsc
#     catches it; the local machine did not, because its .next predated the
#     merge.
#   - prisma generate failing on a locked query engine. Irrelevant in a
#     container, which is part of the point.

set -euo pipefail

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m    OK  %s\033[0m\n' "$1"; }

FAILED=0
START_ALL=$(date +%s)

run_step() {
  local name="$1"; shift
  step "$name"
  local t0 t1
  t0=$(date +%s)
  if "$@"; then
    t1=$(date +%s)
    ok "$name ($((t1 - t0))s)"
  else
    printf '\033[1;31m    FAIL  %s\033[0m\n' "$name"
    FAILED=1
    return 1
  fi
}

# ── 1. Prisma ──────────────────────────────────────────────────────────────
# validate reads schema.prisma on its own and needs no database; generate
# writes the client the typecheck and build both depend on.
run_step "prisma validate" npx prisma validate
run_step "prisma generate" npx prisma generate

# ── 2. Typecheck ───────────────────────────────────────────────────────────
# Seconds, and it is the check that catches the merge-reintroduction class of
# bug. Runs before the build so a type error does not cost 2.5 minutes first.
run_step "typecheck (tsc --noEmit)" npx tsc --noEmit

# ── 3. Schema applies ──────────────────────────────────────────────────────
# This repo uses `prisma db push` with no migrations folder, so nothing else
# ever proves the schema can be applied to an empty database. Pushed against
# the throwaway Postgres in docker-compose.ci.yml, never a real one.
if [ -n "${DATABASE_URL:-}" ] && [[ "${DATABASE_URL}" == *"@postgres:"* ]]; then
  run_step "schema applies to a clean database" npx prisma db push --skip-generate --accept-data-loss
else
  step "schema applies to a clean database"
  printf '    SKIPPED - DATABASE_URL does not point at the CI postgres service\n'
fi

# ── 4. Build ───────────────────────────────────────────────────────────────
# The expensive one, so it runs last among the static checks.
run_step "next build" npx next build

# ── 5. Smoke ───────────────────────────────────────────────────────────────
# A build that compiles can still fail to boot. This starts the real server and
# asks for the public pages - no login, no database rows needed.
step "smoke: server boots and serves public pages"
npx next start -p 3000 > /tmp/next-start.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for i in $(seq 1 45); do
  if curl -fsS -o /dev/null --max-time 3 http://localhost:3000/ 2>/dev/null; then break; fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    printf '\033[1;31m    FAIL  server exited during startup\033[0m\n'
    tail -30 /tmp/next-start.log
    exit 1
  fi
  sleep 1
done

SMOKE_FAILED=0
for path in / /login /privacy /terms /blog /llms.txt; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://localhost:3000${path}" || echo 000)
  if [ "$code" = "200" ]; then
    printf '    %-12s %s\n' "$path" "$code"
  else
    printf '\033[1;31m    %-12s %s  <-- expected 200\033[0m\n' "$path" "$code"
    SMOKE_FAILED=1
  fi
done

if [ "$SMOKE_FAILED" = "1" ]; then
  printf '\033[1;31m    FAIL  smoke\033[0m\n'
  tail -30 /tmp/next-start.log
  FAILED=1
else
  ok "smoke"
fi

# ── Result ─────────────────────────────────────────────────────────────────
END_ALL=$(date +%s)
printf '\n'
if [ "$FAILED" = "0" ]; then
  printf '\033[1;32m==> ALL CHECKS PASSED in %ss\033[0m\n' "$((END_ALL - START_ALL))"
else
  printf '\033[1;31m==> CHECKS FAILED after %ss\033[0m\n' "$((END_ALL - START_ALL))"
fi
exit "$FAILED"
