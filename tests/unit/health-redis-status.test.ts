/**
 * BL-020-F005 · /api/health redis field shape (post-rate-limit infra).
 *
 * Pre-F005 the redis check was a stub returning {status:'not_used'};
 * isHealthy treated that as passing. F005 wired ioredis + login rate
 * limit, so /api/health now PINGs Redis on every probe and the overall
 * status only stays "healthy" when redis.status === "ok". These source-
 * level assertions guard against accidental regressions to the stub
 * shape (would silently re-hide Redis outages from healthcheck.sh).
 *
 * Source: docs/specs/BL-020-frontend-security-hardening-and-trivial-ui-spec.md §D3.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("/api/health redis field", () => {
  const route = readFileSync(
    resolve(__dirname, "../../src/app/api/health/route.ts"),
    "utf8"
  );

  it("redis check pings via @/lib/redis (no longer a 'not_used' stub)", () => {
    expect(route).toContain('from "@/lib/redis"');
    expect(route).toContain("pingRedis()");
    expect(route).not.toContain('status: "not_used"');
    expect(route).not.toContain("BullMQ enables when production scale demands");
  });

  it("isHealthy now requires every check to be 'ok' (no not_used escape hatch)", () => {
    // Post-F005 isHealthy is a strict every-ok predicate. Make sure the
    // legacy `c.status === "not_used"` branch is gone — leaving it would
    // turn Redis outages back into silent passes.
    expect(route).not.toContain('c.status === "not_used"');
    expect(route).toMatch(/\.every\(\(c\) =>\s*c\.status === "ok"\s*\)/);
  });

  it("does not contain legacy stub status", () => {
    expect(route).not.toContain('"stub"');
    expect(route).not.toContain("wired in B5");
  });
});
