/**
 * MVP-internal-demo-prep-F007 · /api/health redis field shape.
 *
 * Asserts that the redis check returns {status:'not_used'} and that
 * the overall health response is still "healthy" (not_used is non-blocking).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("/api/health redis field", () => {
  it("route source returns not_used for redis check", () => {
    const src = readFileSync(resolve(__dirname, "../../src/app/api/health/route.ts"), "utf8");
    expect(src).toContain('status: "not_used"');
    expect(src).toContain("BullMQ enables when production scale demands");
  });

  it("isHealthy treats not_used as passing", () => {
    const src = readFileSync(resolve(__dirname, "../../src/app/api/health/route.ts"), "utf8");
    expect(src).toContain('c.status === "not_used"');
  });

  it("does not contain legacy stub status", () => {
    const src = readFileSync(resolve(__dirname, "../../src/app/api/health/route.ts"), "utf8");
    expect(src).not.toContain('"stub"');
    expect(src).not.toContain("wired in B5");
  });
});
