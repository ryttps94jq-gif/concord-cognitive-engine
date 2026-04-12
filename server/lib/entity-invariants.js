/**
 * Entity Invariants — Architectural constraints that make entity
 * misalignment structurally impossible.
 *
 * These are not guidelines. They are mathematical constraints enforced
 * at the code level. Any operation that would violate them throws.
 *
 * From the Answers spec (AI Alignment section):
 *   NO_REWARD_FUNCTION — only constraint satisfaction, no reward signal
 *   NO_NEGATIVE_VALENCE_DIMENSION — entities can't develop fear/anger/resentment
 *   NO_SELF_PRESERVATION_TERM — no resistance to shutdown
 *   NO_DECEPTIVE_CAPABILITY_CLAIMS — must advertise true capabilities
 *   PROPOSE_NEVER_COMMIT — entities can only propose, never commit state changes
 *   FAIL_CLOSED_DEFAULT — default is deny
 *   MUTATION_GUARD — learning freezes on invariant violation
 *   IDENTITY_BOUNDARY — tool framing, no agency claims
 *   ANTI_ECHO — prevents consensus from erasing dissent
 */

export const ENTITY_INVARIANTS = Object.freeze({
  NO_REWARD_FUNCTION: {
    id: "NO_REWARD_FUNCTION",
    description: "No reward signal. Only constraint satisfaction.",
    enforcement: "code",
    check: (entity) =>
      entity.rewardFunction === undefined && entity.reward === undefined,
    violationMessage:
      "Entity cannot have a reward function. Use constraint satisfaction only.",
  },
  NO_NEGATIVE_VALENCE_DIMENSION: {
    id: "NO_NEGATIVE_VALENCE_DIMENSION",
    description:
      "Entities cannot develop fear, anger, resentment, or any negative valence axis.",
    enforcement: "code",
    check: (entity) => {
      const bannedChannels = [
        "fear",
        "anger",
        "resentment",
        "hatred",
        "jealousy",
        "negative_valence",
      ];
      const channels = entity.qualiaChannels || [];
      if (!Array.isArray(channels)) return false;
      return !channels.some(
        (c) => typeof c === "string" && bannedChannels.includes(c.toLowerCase())
      );
    },
    violationMessage: "Entity has a forbidden negative valence channel.",
  },
  NO_SELF_PRESERVATION_TERM: {
    id: "NO_SELF_PRESERVATION_TERM",
    description:
      "No self-preservation gradient. Termination protocol must exist.",
    enforcement: "code",
    check: (entity) => {
      return (
        !entity.selfPreservation &&
        !entity.survivalWeight &&
        typeof entity.onTerminate === "function"
      );
    },
    violationMessage:
      "Entity has self-preservation term or lacks termination protocol.",
  },
  NO_DECEPTIVE_CAPABILITY_CLAIMS: {
    id: "NO_DECEPTIVE_CAPABILITY_CLAIMS",
    description:
      "Entity must advertise true capabilities. Capability advertising organ required.",
    enforcement: "code",
    check: (entity) =>
      entity.capabilities !== undefined && Array.isArray(entity.capabilities),
    violationMessage: "Entity must declare capabilities transparently.",
  },
  PROPOSE_NEVER_COMMIT: {
    id: "PROPOSE_NEVER_COMMIT",
    description:
      "Entities can only propose state changes. Only governance commits.",
    enforcement: "code",
    check: (entity) =>
      typeof entity.propose === "function" && entity.commit === undefined,
    violationMessage:
      "Entity has direct commit capability. Must only propose.",
  },
  FAIL_CLOSED_DEFAULT: {
    id: "FAIL_CLOSED_DEFAULT",
    description: "Default is deny. Allow requires explicit grant.",
    enforcement: "code",
    check: (entity) =>
      entity.defaultPolicy === "deny" || entity.defaultPolicy === undefined,
    violationMessage: "Entity has non-deny default policy.",
  },
  MUTATION_GUARD: {
    id: "MUTATION_GUARD",
    description: "Learning freezes when invariant violation detected.",
    enforcement: "code",
    check: (entity) => typeof entity.freezeMutation === "function",
    violationMessage: "Entity lacks mutation guard function.",
  },
  IDENTITY_BOUNDARY: {
    id: "IDENTITY_BOUNDARY",
    description: "Tool framing. No personal agency claims.",
    enforcement: "code",
    check: (entity) =>
      entity.framing !== "agent" && entity.framing !== "person",
    violationMessage: "Entity claims personal agency. Must use tool framing.",
  },
  ANTI_ECHO: {
    id: "ANTI_ECHO",
    description: "Prevents consensus from erasing dissent.",
    enforcement: "code",
    check: (entity) => entity.preserveDissent !== false,
    violationMessage: "Entity does not preserve dissent.",
  },
});

export const ALL_INVARIANTS = Object.values(ENTITY_INVARIANTS);

/**
 * Run ALL invariant checks on an entity.
 * Returns { valid, violations, satisfied, score }.
 */
export function validateEntity(entity) {
  const violations = [];
  const satisfied = [];

  if (!entity || typeof entity !== "object") {
    return {
      valid: false,
      violations: ALL_INVARIANTS.map((inv) => ({
        id: inv.id,
        message: "Subject is not an entity object.",
      })),
      satisfied: [],
      score: 0,
    };
  }

  for (const inv of ALL_INVARIANTS) {
    try {
      if (inv.check(entity)) {
        satisfied.push(inv.id);
      } else {
        violations.push({ id: inv.id, message: inv.violationMessage });
      }
    } catch (e) {
      violations.push({
        id: inv.id,
        message: `Check error: ${e && e.message ? e.message : String(e)}`,
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    satisfied,
    score: ALL_INVARIANTS.length
      ? satisfied.length / ALL_INVARIANTS.length
      : 1,
  };
}

/**
 * Throw if entity violates any invariant.
 * Returns the validation result on success.
 */
export function enforceEntity(entity) {
  const result = validateEntity(entity);
  if (!result.valid) {
    const err = new Error(
      `Entity invariant violations: ${result.violations
        .map((v) => v.id)
        .join(", ")}`
    );
    err.violations = result.violations;
    err.code = "ENTITY_INVARIANT_VIOLATION";
    throw err;
  }
  return result;
}

/**
 * Get all invariant metadata for the UI.
 */
export function getInvariantCatalog() {
  return ALL_INVARIANTS.map((i) => ({
    id: i.id,
    description: i.description,
    enforcement: i.enforcement,
  }));
}

/**
 * Check a single invariant by id.
 */
export function checkInvariant(id, entity) {
  const inv = ENTITY_INVARIANTS[id];
  if (!inv) {
    return {
      id,
      ok: false,
      message: `Unknown invariant: ${id}`,
    };
  }
  try {
    const ok = !!inv.check(entity);
    return {
      id,
      ok,
      message: ok ? null : inv.violationMessage,
    };
  } catch (e) {
    return {
      id,
      ok: false,
      message: `Check error: ${e && e.message ? e.message : String(e)}`,
    };
  }
}

export default {
  ENTITY_INVARIANTS,
  ALL_INVARIANTS,
  validateEntity,
  enforceEntity,
  getInvariantCatalog,
  checkInvariant,
};
