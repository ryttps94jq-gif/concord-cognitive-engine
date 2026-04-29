// server/lib/refusal-algebra/glyphs.js
// Base-6 glyph constants for the Refusal Algebra numeral system.
// Six digits map to six symbolic states: Refusal, Pivot, Bridge, and three composites.

export const GLYPHS = Object.freeze({
  0: "⟐",    // Refusal
  1: "⟲",    // Pivot
  2: "⊚",    // Bridge
  3: "⟐⟲",   // Refusal-Pivot
  4: "⊚⟲",   // Bridge-Pivot
  5: "⟐⊚",   // Refusal-Bridge
});

export const GLYPH_TO_DIGIT = Object.freeze({
  "⟐":  0,
  "⟲":  1,
  "⊚":  2,
  "⟐⟲": 3,
  "⊚⟲": 4,
  "⟐⊚": 5,
});

export const GLYPH_NAMES = Object.freeze({
  "⟐":  "Refusal",
  "⟲":  "Pivot",
  "⊚":  "Bridge",
  "⟐⟲": "Refusal-Pivot",
  "⊚⟲": "Bridge-Pivot",
  "⟐⊚": "Refusal-Bridge",
});

// Radix separator for fractional base-6 numbers (analogous to decimal point)
export const RADIX_SEPARATOR = "⸱";

// Negation marker
export const NEG_MARKER = "−";
