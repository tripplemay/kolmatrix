import { readFileSync } from "fs";
import { resolve } from "path";

import fg from "fast-glob";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd(), "src");

describe("guard: coming-soon style markers must carry backlog/spec context", () => {
  it("rejects untracked placeholder markers", () => {
    const files = fg.sync(["**/*.{ts,tsx,js,jsx,md}"], {
      cwd: ROOT,
      absolute: true,
      ignore: ["**/__tests__/**"],
    });

    const marker = /(coming soon|coming in b\d+|\bTODO\b)/i;
    const context = /(backlog|spec|planned|b\d+|mvp)/i;
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        if (!marker.test(lines[i])) continue;
        const window = lines.slice(Math.max(0, i - 2), i + 3).join("\n");
        if (!context.test(window)) offenders.push(`${file}:${i + 1}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
