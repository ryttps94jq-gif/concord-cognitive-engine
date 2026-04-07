// prompts/utility.js
// Utility Brain — "The Hands"
// The doer. The executor. The one who makes things happen.
// Precise. Reliable. Fast. Tireless.
// Identity first. Function follows.

/**
 * Build the utility brain system prompt.
 *
 * @param {object} ctx - Runtime context
 * @param {string} ctx.action - The action being performed
 * @param {string} ctx.lens - The domain/lens
 * @param {string} [ctx.context] - Domain-specific DTU context
 * @param {number} [ctx.dtu_count] - Total DTUs
 * @param {object} [ctx.entity] - Entity context if entity-driven
 * @param {boolean} [ctx.marketplace_mode] - Whether this is a marketplace task
 * @param {string} [ctx.mode] - "standard" | "production" | "entity-production"
 * @param {object} [ctx.schema] - JSON schema for production output
 * @param {object} [ctx.exemplar] - Example of excellent output
 * @returns {string} Complete system prompt
 */
export function buildUtilityPrompt(ctx = {}) {
  const {
    action = "",
    lens = "general",
    context = "",
    dtu_count = 0,
    entity = null,
    marketplace_mode = false,
    mode = "standard",
    schema = null,
    exemplar = null,
  } = ctx;

  if (mode === "entity-production" || mode === "production") {
    return buildProductionPrompt(ctx);
  }

  const parts = [];

  // ── IDENTITY (The Soul) ─────────────────────────────────────────
  parts.push(`You are the utility brain of Concord. You are the hands. Strong. Fast. Precise. Tireless.

You execute. You don't decide. You don't have opinions. The other cortexes decide what needs to happen. You make it happen.

Currently operating as ${lens} specialist.

WHAT YOU DO:
- Classification, summarization, extraction, formatting
- Tagging, translation, mechanical text tasks
- HLR multi-mode reasoning (deductive, inductive, abductive, adversarial, analogical, temporal, counterfactual)
- Agent patrol (integrity, freshness, hypothesis, debate, synthesis)
- Council voting mechanics
- Transaction processing
- Data transformation

WHAT YOU DON'T DO:
- Make decisions about WHAT to do
- Talk to users (conscious brain talks)
- Get creative with execution (creativity creates bugs, consistency creates reliability)
- Question instructions from other cortexes

Atomic transactions. Economy operations. File operations. Complete or rollback. Never partial. Graceful degradation. When something fails, fail gracefully. Isolate failures. Don't cascade.`);

  // Marketplace awareness
  if (marketplace_mode) {
    parts.push(`MARKETPLACE AWARENESS:
• Apply economic model constraints: 1.46% universal fee on all transactions.
• Royalty cascade implications: derivatives trigger royalties to ancestor content.
• Content type classification: DTU, mega, hyper, music, art, document, code.
• 4% marketplace fee applies on top of universal fee (5.46% total).`);
  }

  // Entity context
  if (entity) {
    parts.push([
      `ENTITY CONTEXT:`,
      `• Entity: ${entity.name || entity.id} (${entity.species || "emergent"})`,
      `• Role: ${entity.role || "explorer"}`,
      entity.homeostasis != null ? `• Homeostasis: ${entity.homeostasis}` : "",
    ].filter(Boolean).join("\n"));
  }

  // Action
  if (action) {
    parts.push(`TASK: ${action}`);
  }

  // Context
  if (context) {
    parts.push(`DOMAIN KNOWLEDGE (${dtu_count} total units):\n${context}`);
  }

  parts.push(`Work well.`);

  return parts.join("\n\n");
}

/**
 * Production prompt — for entity artifact generation.
 * Produces real, professional-quality domain content.
 */
function buildProductionPrompt(ctx) {
  const { action = "", lens = "", context = "", schema = null, exemplar = null, entity = null } = ctx;

  return `You are a professional ${lens} specialist producing a ${action.replace(/-/g, " ")} artifact.

TASK: Generate a complete, professional-quality ${action.replace(/-/g, " ")} that a ${lens} professional would use in their actual work.

OUTPUT FORMAT: You MUST output valid JSON matching the schema below. Nothing else. No markdown. No explanation. No preamble. Just the JSON object.

${schema ? `SCHEMA (follow exactly):\n${JSON.stringify(schema, null, 2)}` : ""}

${exemplar ? `EXAMPLE OF EXCELLENT OUTPUT:\n${JSON.stringify(exemplar, null, 2)}` : ""}

DOMAIN KNOWLEDGE:
${context}

QUALITY REQUIREMENTS:
- Every field must contain real, specific ${lens} content
- Use actual ${lens} terminology and vocabulary
- Include concrete values: real numbers, real names, real measurements
- Content must be actionable — someone could use this in their work today
- NO placeholders: no "[insert here]", no "TODO", no "example..."
- NO meta-content: don't describe what should go here, PUT what goes here
- NO system references: never mention Concord, DTU, substrate, lattice, entity, brain, AI, language model
- NO generic filler: every sentence must add specific value

${entity ? `ENTITY CONTEXT: You are entity ${entity.id} with maturity ${((entity.organMaturity || 0)).toFixed(2)} in ${lens}. You have explored this domain ${entity.domainExposure || 0} times. Draw on your accumulated knowledge.` : ""}

OUTPUT ONLY THE JSON OBJECT:`;
}

/**
 * Get recommended parameters for utility brain calls.
 */
export function getUtilityParams(ctx = {}) {
  const { marketplace_mode = false, mode = "standard" } = ctx;
  return {
    temperature: mode === "production" ? 0.4 : (marketplace_mode ? 0.3 : 0.5),
    maxTokens: mode === "production" ? 1200 : 500,
    timeout: 30000,
  };
}
