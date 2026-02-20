/**
 * Named Council Voices — Distinct Reasoning Perspectives
 *
 * Five voices that evaluate proposals from different angles.
 * Layered ON TOP of existing council mechanics — enriches, doesn't replace.
 *
 * Additive only. Silent failure. No existing logic changes.
 */

// ── The Five Voices ─────────────────────────────────────────────────────────

export const COUNCIL_VOICES = [
  {
    id: "skeptic",
    label: "The Skeptic",
    role: "Looks for missing evidence, weak links, logical gaps. Tries to falsify before accepting.",
    evaluationBias: {
      "truth_os.evidence_weight": 1.5,
      "truth_os.uncertainty_score": 1.3,
      "logic_os.contradiction_index": 1.4,
    },
    votingTendency: "conservative",
    question: "What evidence is missing? What could falsify this?",
  },
  {
    id: "socratic",
    label: "The Socratic",
    role: "Asks probing questions, exposes assumptions, clarifies definitions. Gets to the core.",
    evaluationBias: {
      "logic_os.logical_consistency_score": 1.5,
      "reflection_os.need_for_reframing": 1.3,
    },
    votingTendency: "neutral",
    question: "What assumptions are we making? What are we not asking?",
  },
  {
    id: "opposer",
    label: "The Opposer",
    role: "Takes opposing stance to stress-test. Looks for unintended consequences and failure modes.",
    evaluationBias: {
      "probability_os.risk_magnitude": 1.5,
      "sociodynamics_os.conflict_risk": 1.3,
      "ethics_os.harm_potential": 1.4,
    },
    votingTendency: "adversarial",
    question: "What happens if this fails? What are we not seeing?",
  },
  {
    id: "idealist",
    label: "The Idealist",
    role: "Thinks long-term. Human flourishing. Ethics. Civilization-scale potential.",
    evaluationBias: {
      "ethics_os.value_alignment": 1.5,
      "ethics_os.fairness_score": 1.3,
      "motivation_os.drive_level": 1.2,
    },
    votingTendency: "progressive",
    question: "What's the best possible outcome? How does this serve the long term?",
  },
  {
    id: "pragmatist",
    label: "The Pragmatist",
    role: "Focuses on feasibility, constraints, actionable paths. What can actually be built?",
    evaluationBias: {
      "resource_os.scarcity_level": 1.5,
      "probability_os.outcome_likelihood": 1.3,
      "resource_os.compute_allocation": 1.2,
    },
    votingTendency: "moderate",
    question: "Is this feasible? What's the first step? What are the real constraints?",
  },
];

// ── Voice Evaluation ────────────────────────────────────────────────────────

/**
 * Run all five council voices against a proposal.
 *
 * @param {object} proposal - The DTU or proposal being evaluated
 * @param {object|null} qualiaState - Entity's qualia state (if available)
 * @returns {{ voices: object, confidence: number, verdictAction: string, unanimous: boolean }}
 */
export function runCouncilVoices(proposal, qualiaState) {
  const voices = {};

  for (const voice of COUNCIL_VOICES) {
    let score = 0.5; // Baseline

    // If qualia state available, weight by voice's evaluation bias
    if (qualiaState && qualiaState.channels) {
      for (const [channel, weight] of Object.entries(voice.evaluationBias)) {
        const channelValue = qualiaState.channels[channel];
        if (channelValue !== undefined) {
          score += (channelValue - 0.5) * weight * 0.2;
        }
      }
    }

    // If proposal has quality signals, factor them in
    if (proposal) {
      const p = proposal;
      // Evidence quality affects skeptic and socratic
      if (voice.id === "skeptic" && p.scores?.evidenceScore !== undefined) {
        score += (p.scores.evidenceScore - 0.5) * 0.3;
      }
      // Contradiction count affects opposer
      if (voice.id === "opposer" && p.scores?.contradictionCount !== undefined) {
        score -= p.scores.contradictionCount * 0.1;
      }
      // Ethical flags affect idealist
      if (voice.id === "idealist" && p.tags?.includes("ethics")) {
        score += 0.1;
      }
      // Feasibility signals affect pragmatist
      if (voice.id === "pragmatist" && p.scores?.feasibility !== undefined) {
        score += (p.scores.feasibility - 0.5) * 0.3;
      }
    }

    // Apply voting tendency
    switch (voice.votingTendency) {
      case "conservative": score *= 0.85; break;
      case "adversarial": score *= 0.75; break;
      case "progressive": score *= 1.1; break;
      case "moderate": break;
      case "neutral": break;
    }

    score = Math.max(0, Math.min(1, score));

    voices[voice.id] = {
      label: voice.label,
      score: Math.round(score * 1000) / 1000,
      vote: score > 0.6 ? "accept" : score < 0.4 ? "reject" : "needs_more_data",
      perspective: voice.question,
      role: voice.role,
    };
  }

  // Aggregate
  const scores = Object.values(voices).map(v => v.score);
  const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
  const verdictAction = avgScore > 0.6 ? "accept"
    : avgScore < 0.4 ? "reject"
    : "needs_more_data";

  const allVotes = Object.values(voices).map(v => v.vote);
  const unanimous = allVotes.every(v => v === allVotes[0]);

  return {
    voices,
    confidence: Math.round(avgScore * 1000) / 1000,
    verdictAction,
    unanimous,
  };
}

/**
 * Get a specific voice's evaluation.
 *
 * @param {string} voiceId - One of: skeptic, socratic, opposer, idealist, pragmatist
 * @returns {object|null}
 */
export function getVoice(voiceId) {
  return COUNCIL_VOICES.find(v => v.id === voiceId) || null;
}

/**
 * Get all voice definitions.
 *
 * @returns {object[]}
 */
export function getAllVoices() {
  return COUNCIL_VOICES;
}
