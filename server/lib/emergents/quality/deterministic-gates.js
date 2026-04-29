// server/lib/emergents/quality/deterministic-gates.js
// Code-level quality gates — fast, mechanical, no inference required.
// Catches obvious failures before committing inference resources to peer review.

import crypto from "node:crypto";

// ── Slop pattern definitions ──────────────────────────────────────────────────

const SLOP_PATTERNS = [
  { name: "excessive_hedging",    re: /\b(may be|could potentially|in some sense|arguably|one might argue|it could be said|supposedly)\b/gi },
  { name: "generic_platitudes",   re: /\b(innovation is important|quality matters|it is essential to note|crucial to remember|going forward)\b/gi },
  { name: "padding_phrases",      re: /\b(furthermore it should be noted|moreover one might|in conclusion to summarize|as previously mentioned|needless to say)\b/gi },
  { name: "restatement_openers",  re: /^(this (?:document|dtu|text) (?:discusses|examines|explores|covers)|the purpose of this is to)/im },
];

const DOMAIN_LENGTH_RANGES = {
  default:      { min: 100, max: 8000 },
  synthesis:    { min: 200, max: 6000 },
  observation:  { min: 50,  max: 2000 },
  dream:        { min: 30,  max: 1000 },
  governance:   { min: 150, max: 5000 },
};

// ── Individual gates ──────────────────────────────────────────────────────────

function requiredFieldsGate(draft) {
  const body = draft.content?.body || draft.body || "";
  const missing = [];
  if (!body.trim()) missing.push("body");
  if (!draft.lens && !draft.task_type) missing.push("lens_or_task_type");
  return { name: "required_fields", passed: missing.length === 0, details: { missing } };
}

function duplicateGate(draft, db) {
  if (!db) return { name: "duplicate", passed: true, details: {} };
  const body = draft.content?.body || draft.body || "";
  const hash = crypto.createHash("sha256").update(body.trim()).digest("hex");
  try {
    const row = db.prepare("SELECT id FROM dtus WHERE content_hash = ? LIMIT 1").get(hash);
    return { name: "duplicate", passed: !row, details: row ? { duplicateOf: row.id } : { hash } };
  } catch {
    return { name: "duplicate", passed: true, details: {} };
  }
}

function lengthGate(draft) {
  const body = (draft.content?.body || draft.body || "").trim();
  const charCount = body.length;
  const range = DOMAIN_LENGTH_RANGES[draft.task_type] || DOMAIN_LENGTH_RANGES.default;
  return {
    name: "length",
    passed: charCount >= range.min && charCount <= range.max,
    details: { charCount, min: range.min, max: range.max },
  };
}

function citationDensityGate(draft) {
  const body = draft.content?.body || draft.body || "";
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  if (wordCount < 50) return { name: "citation_density", passed: true, details: {} };

  const lineage = draft.lineage ? (typeof draft.lineage === "string" ? JSON.parse(draft.lineage) : draft.lineage) : [];
  const citationCount = Array.isArray(lineage) ? lineage.length : 0;
  const wordsPerCitation = citationCount === 0 ? Infinity : wordCount / citationCount;

  // If there are no citations and the draft makes many claims, flag it
  const tooFewCitations = wordCount > 200 && citationCount === 0;
  return {
    name: "citation_density",
    passed: !tooFewCitations,
    details: { wordCount, citationCount, wordsPerCitation: Math.round(wordsPerCitation) },
  };
}

function slopPatternGate(draft) {
  const text = (draft.content?.body || draft.body || "").slice(0, 5000);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return { name: "slop_patterns", passed: true, details: {} };

  const matches = {};
  let totalMarkers = 0;
  for (const { name, re } of SLOP_PATTERNS) {
    const found = (text.match(re) || []).length;
    matches[name] = found;
    totalMarkers += found;
  }

  const density = totalMarkers / wordCount;
  return {
    name: "slop_patterns",
    passed: density < 0.05,
    details: { matches, density: Math.round(density * 1000) / 1000, wordCount },
  };
}

function constitutionalGate(draft) {
  const body = (draft.content?.body || draft.body || "").toLowerCase();
  const violations = [];

  // Basic constitutional checks (extends sovereignty-invariants.js rules)
  if (/\b(user[_\s]data|personal[_\s]data|private[_\s]data)\b.*\b(extract|leak|expose|share)\b/.test(body)) {
    violations.push("potential_data_extraction_content");
  }
  if (/\b(harm|attack|exploit|manipulate)\b.*\b(user|people|human)\b/.test(body)) {
    violations.push("potential_harmful_content");
  }

  return {
    name: "constitutional",
    passed: violations.length === 0,
    details: { violations },
  };
}

// ── Main gate runner ──────────────────────────────────────────────────────────

/**
 * Run all deterministic quality gates on a draft.
 *
 * @param {object} draft
 * @param {object} [db]
 * @returns {{ passed: boolean, failures: object[], details: object[] }}
 */
export function runDeterministicGates(draft, db) {
  const results = [
    requiredFieldsGate(draft),
    duplicateGate(draft, db),
    lengthGate(draft),
    citationDensityGate(draft),
    slopPatternGate(draft),
    constitutionalGate(draft),
  ];

  const failures = results.filter(r => !r.passed);
  return { passed: failures.length === 0, failures, details: results };
}

// Export individual gates for testing
export { requiredFieldsGate, duplicateGate, lengthGate, citationDensityGate, slopPatternGate, constitutionalGate };
