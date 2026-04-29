# Part 2 — Refusal Algebra Base-6 Layer

## Status: Complete

## What was built

### Server library: `server/lib/refusal-algebra/`

| File | Purpose |
|---|---|
| `glyphs.js` | Constants: GLYPHS, GLYPH_TO_DIGIT, GLYPH_NAMES, RADIX_SEPARATOR, NEG_MARKER |
| `conversion.js` | `decimalToRefusalGlyphs(n)`, `refusalGlyphsToDecimal(s)`, `parseGlyphs(s)` |
| `operations.js` | `add`, `subtract`, `multiply`, `divide` with semantic layer; `computeBase6Layer`, `generateDTUSemantic` |
| `index.js` | Public re-exports |

### Base-6 numeral system

Six digits (0–5) map to symbolic states:

| Digit | Glyph | Name |
|---|---|---|
| 0 | ⟐ | Refusal |
| 1 | ⟲ | Pivot |
| 2 | ⊚ | Bridge |
| 3 | ⟐⟲ | Refusal-Pivot |
| 4 | ⊚⟲ | Bridge-Pivot |
| 5 | ⟐⊚ | Refusal-Bridge |

Radix separator: `⸱` | Negation: `−`

### Migration 037

`server/migrations/037_base6_dtu_layer.js` — idempotent ALTER TABLE adds `base6_representation TEXT` and `semantic_layer TEXT` to both `dtus` and `personal_dtus`.

### Backfill script

`server/scripts/backfill-base6-layer.js` — batched background script, rate-limited at 100ms between batches of 100 rows. Safe to re-run. Only processes rows with numeric `content` or `metadata_json.value`.

### Root Lens (frontend)

`concord-frontend/app/lenses/root/page.tsx` — full interactive lens with:
- Glyph reference table (all 6 symbols)
- Live decimal ↔ glyph converter with swap button
- Operation playground (add/subtract/multiply/divide) with live semantic layer
- Glyph insertion palette for building notation without copy-paste
- Registered in `concord-frontend/lib/lens-registry.ts`

### Tests

`server/tests/refusal-algebra/`:
- `conversion.test.js` — 16 tests (roundtrip, negatives, fractions, compound glyphs, error cases)
- `operations.test.js` — 15 tests (arithmetic, semantic patterns, divide-by-zero, DTU helpers)

All 31 refusal algebra tests pass.

## Governance integration

`server/lib/governance/voting.js` — constitutional voting with trinary Refusal Algebra weights:
- `creation` → weight +1 → glyph ⟲ (Pivot)
- `bridge` → weight 0 → glyph ⊚ (Bridge)  
- `refusal` → weight -1 → glyph ⟐ (Refusal)

`castVote()` and `tallyVotes()` return `base6Weight` field alongside numeric weight.
