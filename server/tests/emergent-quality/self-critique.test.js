// server/tests/emergent-quality/self-critique.test.js
// Tests parseCritique via the exported runSelfCritique function's internal logic.
// We test the structural/parsing behavior without live inference.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// parseCritique is not exported — test it indirectly by probing runSelfCritique
// with a mock spawnSubCognition. Instead, replicate the parser logic here for unit tests.

function parseCritique(raw) {
  try {
    const jsonMatch = (raw || "").match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        novelty_score: Math.max(0, Math.min(1, parseFloat(parsed.novelty_score) || 0)),
        supported: Boolean(parsed.supported),
        coherence_score: Math.max(0, Math.min(1, parseFloat(parsed.coherence_score) || 0)),
        citations_accurate: Boolean(parsed.citations_accurate),
        substrate_fit_score: Math.max(0, Math.min(1, parseFloat(parsed.substrate_fit_score) || 0)),
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 10) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 10) : [],
        verdict: ["approve", "revise", "abandon"].includes(parsed.verdict) ? parsed.verdict : "revise",
      };
    }
  } catch { /* fall through */ }
  return {
    novelty_score: 0,
    supported: false,
    coherence_score: 0,
    citations_accurate: false,
    substrate_fit_score: 0,
    weaknesses: ["Could not parse critique — structural quality unknown"],
    improvements: ["Ensure draft makes clear, supported, novel claims"],
    verdict: "revise",
  };
}

describe("parseCritique", () => {
  it("returns conservative fallback on malformed input", () => {
    const r = parseCritique("not json at all");
    assert.equal(r.verdict, "revise");
    assert.equal(r.novelty_score, 0);
    assert.ok(r.weaknesses.length > 0);
  });

  it("extracts structured critique from valid JSON", () => {
    const raw = JSON.stringify({
      novelty_score: 0.7,
      supported: true,
      coherence_score: 0.8,
      citations_accurate: true,
      substrate_fit_score: 0.6,
      weaknesses: ["Too broad"],
      improvements: ["Add specifics"],
      verdict: "approve",
    });
    const r = parseCritique(raw);
    assert.equal(r.verdict, "approve");
    assert.equal(r.novelty_score, 0.7);
    assert.equal(r.supported, true);
    assert.deepEqual(r.weaknesses, ["Too broad"]);
  });

  it("clamps novelty_score to [0, 1]", () => {
    const r = parseCritique(JSON.stringify({ novelty_score: 5, verdict: "approve" }));
    assert.equal(r.novelty_score, 1);
    const r2 = parseCritique(JSON.stringify({ novelty_score: -2, verdict: "revise" }));
    assert.equal(r2.novelty_score, 0);
  });

  it("defaults verdict to 'revise' for unknown verdict strings", () => {
    const r = parseCritique(JSON.stringify({ verdict: "maybe", novelty_score: 0.5 }));
    assert.equal(r.verdict, "revise");
  });

  it("handles JSON embedded in prose text", () => {
    const raw = `Here is my evaluation:\n${JSON.stringify({ verdict: "abandon", novelty_score: 0.1 })}\nDone.`;
    const r = parseCritique(raw);
    assert.equal(r.verdict, "abandon");
  });
});
