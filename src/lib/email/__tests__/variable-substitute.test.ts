import { describe, expect, it } from "vitest";

import {
  substitute,
  substituteSubjectAndBody,
} from "../variable-substitute";

const base = {
  kol: { name: "Luna", handle: "luna_plays" },
  product: { name: "Nebula", category: "MOBA", usp: "Cross-platform" },
  marketer: { name: "Sarah" },
};

describe("substitute", () => {
  it("replaces known tokens", () => {
    const res = substitute("Hi {{kol.name}} from {{marketer.name}}", base);
    expect(res.text).toBe("Hi Luna from Sarah");
    expect(res.missing).toEqual([]);
  });

  it("reports missing tokens once each", () => {
    const res = substitute(
      "Hi {{kol.name}}, meet {{kol.fakeField}} and {{kol.fakeField}}",
      base
    );
    expect(res.text).toBe("Hi Luna, meet  and ");
    expect(res.missing).toEqual(["kol.fakeField"]);
  });

  it("handles whitespace inside token braces", () => {
    const res = substitute("{{   kol.name   }} says hi", base);
    expect(res.text).toBe("Luna says hi");
  });
});

describe("substituteSubjectAndBody", () => {
  it("merges missing tokens across subject and body", () => {
    const res = substituteSubjectAndBody(
      {
        subject: "Hey {{kol.name}} about {{product.name}}",
        body: "Loved your {{product.fakeField}} and {{kol.missing}}",
      },
      base
    );
    expect(res.subject).toBe("Hey Luna about Nebula");
    expect(res.body).toBe("Loved your  and ");
    expect(res.missing.sort()).toEqual([
      "kol.missing",
      "product.fakeField",
    ]);
  });
});
