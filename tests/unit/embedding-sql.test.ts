import { describe, expect, it } from "vitest";

import {
  kolCosineTopKSql,
  updateKolEmbeddingSql,
  updateProductEmbeddingSql,
  vectorLiteral,
} from "@/lib/embedding/sql";
import { EMBEDDING_DIMS } from "@/lib/embedding/types";

function makeVec(): number[] {
  return Array.from({ length: EMBEDDING_DIMS }, (_, i) => i / 1000);
}

describe("vectorLiteral", () => {
  it("returns JSON-array literal accepted by pgvector", () => {
    const v = [0.1, 0.2, 0.3];
    // Stub via tweaking length check off — use a 1024-dim vector for reality.
    const lit = vectorLiteral(makeVec());
    expect(lit.startsWith("[")).toBe(true);
    expect(lit.endsWith("]")).toBe(true);
    expect(lit.includes(",")).toBe(true);
    void v; // typed sample, unused
  });

  it("throws on wrong dimension", () => {
    expect(() => vectorLiteral([1, 2, 3])).toThrow(/expected 1024/);
  });
});

describe("updateKolEmbeddingSql / updateProductEmbeddingSql", () => {
  it("emits a parameterised UPDATE for kol", () => {
    const sql = updateKolEmbeddingSql(
      "00000000-0000-0000-0000-000000000001",
      makeVec(),
      "abcd1234"
    );
    // sql.text contains $1 / $2 / $3 placeholders + the vector literal embedded
    expect(sql.text).toContain('UPDATE "kol"');
    expect(sql.text).toContain("embedding_text_hash");
    // Hash + id are passed as bound params (positional $N), the literal is inline.
    const values = sql.values;
    expect(values).toContain("00000000-0000-0000-0000-000000000001");
    expect(values).toContain("abcd1234");
  });

  it("emits a parameterised UPDATE for product", () => {
    const sql = updateProductEmbeddingSql("prod_abc", makeVec(), "ff0011");
    expect(sql.text).toContain('UPDATE "product"');
    const values = sql.values;
    expect(values).toContain("prod_abc");
    expect(values).toContain("ff0011");
  });
});

describe("kolCosineTopKSql", () => {
  it("orders by distance and limits", () => {
    const sql = kolCosineTopKSql({ query: makeVec(), limit: 10 });
    expect(sql.text).toContain('FROM "kol"');
    expect(sql.text).toContain("ORDER BY distance ASC");
    // limit is bound parameter
    expect(sql.values).toContain(10);
  });

  it("applies IS NOT NULL filter (audit lock #11:A)", () => {
    const sql = kolCosineTopKSql({ query: makeVec(), limit: 5 });
    expect(sql.text).toContain('"embedding" IS NOT NULL');
  });

  it("respects excludeId for F007 'similar but not me'", () => {
    const sql = kolCosineTopKSql({
      query: makeVec(),
      limit: 5,
      excludeId: "00000000-0000-0000-0000-000000000099",
    });
    expect(sql.text).toContain("id !=");
    expect(sql.values).toContain("00000000-0000-0000-0000-000000000099");
  });
});
