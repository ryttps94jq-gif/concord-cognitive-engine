// server/tests/refusal-algebra/conversion.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decimalToRefusalGlyphs, refusalGlyphsToDecimal } from "../../lib/refusal-algebra/conversion.js";
import { GLYPHS } from "../../lib/refusal-algebra/glyphs.js";

describe("Refusal Algebra — Conversion", () => {
  it("decimal 0 → ⟐ (Refusal)", () => {
    assert.equal(decimalToRefusalGlyphs(0), GLYPHS[0]);
  });

  it("decimal 1 → ⟲ (Pivot)", () => {
    assert.equal(decimalToRefusalGlyphs(1), GLYPHS[1]);
  });

  it("decimal 5 → ⟐⊚ (Refusal-Bridge)", () => {
    assert.equal(decimalToRefusalGlyphs(5), GLYPHS[5]);
  });

  it("decimal 6 → ⟲⟐ (base-6: 10)", () => {
    // 6 in base-6 = [1,0] → ⟲⟐
    assert.equal(decimalToRefusalGlyphs(6), GLYPHS[1] + GLYPHS[0]);
  });

  it("decimal 7 → ⟲⟲ (base-6: 11)", () => {
    assert.equal(decimalToRefusalGlyphs(7), GLYPHS[1] + GLYPHS[1]);
  });

  it("decimal 47 encodes correctly (base-6: 115 → ⟲⟲⟐⊚)", () => {
    // 47 = 1*36 + 1*6 + 5 = [1,1,5]
    const result = decimalToRefusalGlyphs(47);
    assert.equal(result, GLYPHS[1] + GLYPHS[1] + GLYPHS[5]);
  });

  it("decimal 36 → ⟲⟐⟐ (base-6: 100)", () => {
    assert.equal(decimalToRefusalGlyphs(36), GLYPHS[1] + GLYPHS[0] + GLYPHS[0]);
  });

  it("negative numbers use − marker", () => {
    const result = decimalToRefusalGlyphs(-5);
    assert.ok(result.startsWith("−"), "Should start with NEG_MARKER");
    assert.equal(result, "−" + GLYPHS[5]);
  });

  it("fractional conversion includes radix separator", () => {
    const result = decimalToRefusalGlyphs(1.5);
    assert.ok(result.includes("⸱"), "Should include radix separator");
  });

  it("roundtrip preserves integer values", () => {
    for (const n of [0, 1, 5, 6, 35, 36, 100, 216, 1000]) {
      const glyphs = decimalToRefusalGlyphs(n);
      const back = refusalGlyphsToDecimal(glyphs);
      assert.ok(Math.abs(back - n) < 1e-8, `Roundtrip failed for ${n}: got ${back}`);
    }
  });

  it("roundtrip preserves fractional values", () => {
    for (const n of [0.5, 1.25, 2.75]) {
      const glyphs = decimalToRefusalGlyphs(n);
      const back = refusalGlyphsToDecimal(glyphs);
      assert.ok(Math.abs(back - n) < 1e-6, `Roundtrip failed for ${n}: got ${back}`);
    }
  });

  it("roundtrip preserves negative values", () => {
    const glyphs = decimalToRefusalGlyphs(-42);
    const back = refusalGlyphsToDecimal(glyphs);
    assert.ok(Math.abs(back + 42) < 1e-8);
  });

  it("glyphs→decimal: ⟐ = 0", () => {
    assert.equal(refusalGlyphsToDecimal(GLYPHS[0]), 0);
  });

  it("glyphs→decimal: ⟲⟐ = 6", () => {
    assert.equal(refusalGlyphsToDecimal(GLYPHS[1] + GLYPHS[0]), 6);
  });

  it("compound glyph ⟐⟲ (Refusal-Pivot) parses as digit 3", () => {
    assert.equal(refusalGlyphsToDecimal(GLYPHS[3]), 3);
  });

  it("throws on invalid input", () => {
    assert.throws(() => decimalToRefusalGlyphs(NaN), TypeError);
    assert.throws(() => decimalToRefusalGlyphs(Infinity), RangeError);
    assert.throws(() => refusalGlyphsToDecimal(""), TypeError);
    assert.throws(() => refusalGlyphsToDecimal("ABC"), Error);
  });
});
