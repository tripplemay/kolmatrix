import { readFileSync } from "fs";
import { resolve } from "path";

import fg from "fast-glob";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd(), "src");

describe("guard: hard-disabled controls require tooltip or aria-label", () => {
  it("enforces title/aria-label for literal disabled placeholders", () => {
    const files = fg.sync(["**/*.{tsx,jsx}"], {
      cwd: ROOT,
      absolute: true,
      ignore: ["**/__tests__/**"],
    });

    const offenders: string[] = [];
    const hardDisabledTag =
      /<(Button|button)\b[\s\S]*?\bdisabled\b[\s\S]*?\bdata-testid="[^"]+"[\s\S]*?>/g;

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const matches = src.match(hardDisabledTag) ?? [];
      for (const tag of matches) {
        const hasLiteralDisabled = /\sdisabled(?=[\s>])/.test(tag);
        if (!hasLiteralDisabled) continue;
        const hasTooltip = /\btitle=/.test(tag) || /\baria-label=/.test(tag);
        if (!hasTooltip) offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
