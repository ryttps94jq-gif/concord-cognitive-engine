// ── Domain Logic — validation rules, computed fields, transitions & scoring ──
// Each domain entry defines: types, validStatuses, transitions, requiredFields,
// computedFields, and scoring weights used by the Lens artifact system.

const DOMAIN_RULES = new Map();

// === Paper (Research) ===
DOMAIN_RULES.set("paper", {
  types: ["research", "review", "survey", "meta-analysis", "preprint", "commentary"],
  validStatuses: ["draft", "in-review", "validated", "published", "retracted", "archived"],
  transitions: {
    draft: ["in-review", "archived"],
    "in-review": ["draft", "validated", "archived"],
    validated: ["published", "in-review", "archived"],
    published: ["retracted", "archived"],
    retracted: ["archived"],
    archived: [],
  },
  requiredFields: { research: ["title"], review: ["title"], survey: ["title"] },
  computedFields: (type, data) => {
    const claims = data.claims || [];
    data.claimCount = claims.length;
    data.validatedClaimCount = claims.filter(c => c.validated).length;
    data.evidenceCoverage = claims.length > 0
      ? Math.round(claims.filter(c => (c.evidence || c.sources || []).length > 0).length / claims.length * 100) / 100
      : 0;
    return data;
  },
  scoring: (type, data) => {
    const claims = data.claims || [];
    if (claims.length === 0) return 0.1;
    const validated = claims.filter(c => c.validated).length / claims.length;
    const evidenced = claims.filter(c => (c.evidence || c.sources || []).length > 0).length / claims.length;
    return Math.round((validated * 0.6 + evidenced * 0.3 + Math.min(claims.length / 10, 1) * 0.1) * 100) / 100;
  },
});

// === Reasoning ===
DOMAIN_RULES.set("reasoning", {
  types: ["deductive", "inductive", "abductive", "analogical", "chain"],
  validStatuses: ["draft", "in-progress", "concluded", "validated", "archived"],
  transitions: {
    draft: ["in-progress", "archived"],
    "in-progress": ["draft", "concluded", "archived"],
    concluded: ["validated", "in-progress", "archived"],
    validated: ["archived"],
    archived: [],
  },
  requiredFields: { deductive: ["premise"], inductive: [] },
  computedFields: (type, data) => {
    const steps = data.steps || [];
    data.stepCount = steps.length;
    data.hasConclusion = !!data.conclusion;
    return data;
  },
  scoring: (type, data) => {
    const steps = data.steps || [];
    if (steps.length === 0) return 0.1;
    const valid = steps.every(s => s.content && s.content.length > 0);
    const hasConclusion = !!data.conclusion;
    return Math.round((valid ? 0.5 : 0.2) + (hasConclusion ? 0.3 : 0) + Math.min(steps.length / 10, 1) * 0.2) * 100 / 100;
  },
});

// === Council (Governance) ===
DOMAIN_RULES.set("council", {
  types: ["proposal", "resolution", "amendment", "budget", "policy"],
  validStatuses: ["draft", "open", "debating", "voting", "passed", "rejected", "archived"],
  transitions: {
    draft: ["open", "archived"],
    open: ["debating", "voting", "archived"],
    debating: ["voting", "open", "archived"],
    voting: ["passed", "rejected", "debating", "archived"],
    passed: ["archived"],
    rejected: ["draft", "archived"],
    archived: [],
  },
  requiredFields: { proposal: ["title"] },
  computedFields: (type, data) => {
    const votes = data.votes || [];
    data.voteCount = votes.length;
    data.uniqueVoters = [...new Set(votes.map(v => v.voterId))].length;
    if (votes.length > 0) {
      const tally = {};
      votes.forEach(v => { tally[v.choice || "abstain"] = (tally[v.choice || "abstain"] || 0) + 1; });
      data.voteTally = tally;
    }
    return data;
  },
  scoring: (type, data) => {
    const votes = data.votes || [];
    const debate = data.debate || {};
    const hasDebate = !!(debate.turns && debate.turns.length > 0);
    const hasVotes = votes.length > 0;
    const hasBudget = !!data.budget;
    return Math.round(((hasDebate ? 0.3 : 0) + (hasVotes ? 0.4 : 0) + (hasBudget ? 0.2 : 0) + 0.1) * 100) / 100;
  },
});

// === Agents ===
DOMAIN_RULES.set("agents", {
  types: ["agent", "swarm", "pipeline", "orchestrator", "worker"],
  validStatuses: ["draft", "configured", "active", "paused", "stopped", "error", "archived"],
  transitions: {
    draft: ["configured", "archived"],
    configured: ["active", "draft", "archived"],
    active: ["paused", "stopped", "error"],
    paused: ["active", "stopped", "archived"],
    stopped: ["configured", "archived"],
    error: ["stopped", "configured", "archived"],
    archived: [],
  },
  requiredFields: { agent: ["title"] },
  computedFields: (type, data) => {
    data.isRunning = data.status === "active";
    return data;
  },
  scoring: (type, data) => {
    const hasConfig = !!data.config || !!data.parameters;
    const isActive = data.status === "active";
    return Math.round(((hasConfig ? 0.4 : 0.1) + (isActive ? 0.4 : 0.1) + 0.1) * 100) / 100;
  },
});

// === Sim (Simulation) ===
DOMAIN_RULES.set("sim", {
  types: ["scenario", "monte-carlo", "agent-based", "system-dynamics", "discrete-event"],
  validStatuses: ["draft", "configured", "running", "completed", "archived"],
  transitions: {
    draft: ["configured", "archived"],
    configured: ["running", "draft", "archived"],
    running: ["completed", "configured"],
    completed: ["configured", "archived"],
    archived: [],
  },
  requiredFields: { scenario: ["title"] },
  computedFields: (type, data) => {
    data.runCount = data.runCount || 0;
    data.hasResults = !!data.lastRun;
    return data;
  },
  scoring: (type, data) => {
    const assumptions = data.assumptions || [];
    const hasRun = !!data.lastRun;
    const runs = data.runs || [];
    return Math.round((
      Math.min(assumptions.length / 5, 1) * 0.3 +
      (hasRun ? 0.4 : 0) +
      Math.min(runs.length / 5, 1) * 0.2 +
      0.1
    ) * 100) / 100;
  },
});

// === Studio (Creative / Audio) ===
DOMAIN_RULES.set("studio", {
  types: ["project", "track", "session", "stem", "mix", "master"],
  validStatuses: ["draft", "recording", "mixing", "mastering", "released", "archived"],
  transitions: {
    draft: ["recording", "mixing", "archived"],
    recording: ["mixing", "draft", "archived"],
    mixing: ["mastering", "recording", "archived"],
    mastering: ["released", "mixing", "archived"],
    released: ["archived"],
    archived: [],
  },
  requiredFields: { project: ["title"] },
  computedFields: (type, data) => {
    const tracks = data.tracks || [];
    data.trackCount = tracks.length;
    data.activeTracks = tracks.filter(t => !t.muted).length;
    data.isMixed = data.mixStatus === "mixed";
    data.isMastered = data.masterStatus === "mastered";
    return data;
  },
  scoring: (type, data) => {
    const tracks = data.tracks || [];
    const isMixed = data.mixStatus === "mixed";
    const isMastered = data.masterStatus === "mastered";
    return Math.round((
      Math.min(tracks.length / 8, 1) * 0.3 +
      (isMixed ? 0.3 : 0) +
      (isMastered ? 0.3 : 0) +
      0.1
    ) * 100) / 100;
  },
});

// === Law (Legal) ===
DOMAIN_RULES.set("law", {
  types: ["case", "contract", "opinion", "brief", "regulation", "compliance-report"],
  validStatuses: ["draft", "review", "filed", "active", "closed", "archived"],
  transitions: {
    draft: ["review", "archived"],
    review: ["filed", "draft", "archived"],
    filed: ["active", "archived"],
    active: ["closed", "archived"],
    closed: ["archived"],
    archived: [],
  },
  requiredFields: { case: ["title"] },
  computedFields: (type, data) => {
    data.citationCount = (data.citations || []).length;
    data.draftCount = (data.drafts || []).length;
    return data;
  },
  scoring: (type, data) => {
    const citations = (data.citations || []).length;
    const drafts = (data.drafts || []).length;
    const hasBody = !!(data.body && data.body.length > 50);
    return Math.round((
      (hasBody ? 0.3 : 0.1) +
      Math.min(citations / 5, 1) * 0.3 +
      Math.min(drafts / 3, 1) * 0.2 +
      0.1
    ) * 100) / 100;
  },
});

// === Graph (Knowledge Graph) ===
DOMAIN_RULES.set("graph", {
  types: ["knowledge-graph", "concept-map", "ontology", "network", "taxonomy"],
  validStatuses: ["draft", "building", "stable", "published", "archived"],
  transitions: {
    draft: ["building", "archived"],
    building: ["stable", "draft", "archived"],
    stable: ["published", "building", "archived"],
    published: ["building", "archived"],
    archived: [],
  },
  requiredFields: { "knowledge-graph": [] },
  computedFields: (type, data) => {
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    data.nodeCount = nodes.length;
    data.edgeCount = edges.length;
    data.density = nodes.length > 1
      ? Math.round(edges.length / (nodes.length * (nodes.length - 1) / 2) * 10000) / 10000
      : 0;
    return data;
  },
  scoring: (type, data) => {
    const nodes = (data.nodes || []).length;
    const edges = (data.edges || []).length;
    const hasStructure = nodes > 0 && edges > 0;
    return Math.round((
      Math.min(nodes / 20, 1) * 0.3 +
      Math.min(edges / 30, 1) * 0.3 +
      (hasStructure ? 0.3 : 0) +
      0.1
    ) * 100) / 100;
  },
});

// === Whiteboard (Collaboration) ===
DOMAIN_RULES.set("whiteboard", {
  types: ["board", "canvas", "diagram", "sketch", "wireframe"],
  validStatuses: ["draft", "active", "shared", "locked", "archived"],
  transitions: {
    draft: ["active", "archived"],
    active: ["shared", "locked", "archived"],
    shared: ["active", "locked", "archived"],
    locked: ["active", "archived"],
    archived: [],
  },
  requiredFields: { board: [] },
  computedFields: (type, data) => {
    const elements = data.elements || [];
    data.elementCount = elements.length;
    return data;
  },
  scoring: (type, data) => {
    const elements = (data.elements || []).length;
    return Math.round((Math.min(elements / 10, 1) * 0.7 + 0.1 + (elements > 0 ? 0.2 : 0)) * 100) / 100;
  },
});

// === Chat (Conversational AI) ===
DOMAIN_RULES.set("chat", {
  types: ["conversation", "thread", "summary", "forged", "analysis"],
  validStatuses: ["active", "archived", "pinned", "exported"],
  transitions: {
    active: ["archived", "pinned", "exported"],
    pinned: ["active", "archived", "exported"],
    archived: ["active"],
    exported: ["archived"],
  },
  requiredFields: { conversation: ["title"] },
  computedFields: (type, data) => {
    const messages = data.messages || [];
    data.messageCount = messages.length;
    data.userMessageCount = messages.filter(m => m.role === "user").length;
    data.assistantMessageCount = messages.filter(m => m.role === "assistant").length;
    data.avgResponseLength = data.assistantMessageCount > 0
      ? Math.round(messages.filter(m => m.role === "assistant").reduce((s, m) => s + (m.content || "").length, 0) / data.assistantMessageCount)
      : 0;
    data.hasFeedback = messages.some(m => m.feedbackGiven);
    data.pinnedCount = messages.filter(m => m.pinned).length;
    return data;
  },
  scoring: (type, data) => {
    const msgs = (data.messages || []).length;
    if (msgs === 0) return 0.1;
    const depth = Math.min(msgs / 20, 1) * 0.4;
    const feedback = data.hasFeedback ? 0.2 : 0;
    const pinned = data.pinnedCount > 0 ? 0.1 : 0;
    return Math.round((depth + feedback + pinned + 0.2) * 100) / 100;
  },
});

// === Feed (Social) ===
DOMAIN_RULES.set("feed", {
  types: ["post", "article", "link", "media", "poll"],
  validStatuses: ["draft", "published", "archived", "flagged"],
  transitions: {
    draft: ["published", "archived"],
    published: ["archived", "flagged"],
    flagged: ["published", "archived"],
    archived: [],
  },
  requiredFields: { post: ["content"] },
  computedFields: (type, data) => {
    data.likeCount = data.likes?.length || 0;
    data.commentCount = data.comments?.length || 0;
    data.repostCount = data.reposts?.length || 0;
    data.engagementScore = data.likeCount + data.commentCount * 2 + data.repostCount * 3;
    return data;
  },
  scoring: (type, data) => {
    const engagement = data.engagementScore || 0;
    return Math.round(Math.min(engagement / 50, 1) * 100) / 100;
  },
});

// === Forum ===
DOMAIN_RULES.set("forum", {
  types: ["thread", "reply", "announcement", "poll"],
  validStatuses: ["open", "closed", "pinned", "locked", "archived"],
  transitions: {
    open: ["closed", "pinned", "locked", "archived"],
    pinned: ["open", "closed", "locked"],
    closed: ["open", "archived"],
    locked: ["open", "archived"],
    archived: [],
  },
  requiredFields: { thread: ["title", "content"] },
  computedFields: (type, data) => {
    data.replyCount = data.replies?.length || 0;
    data.voteScore = (data.upvotes || 0) - (data.downvotes || 0);
    return data;
  },
  scoring: (type, data) => {
    const replies = data.replyCount || 0;
    const votes = Math.max(data.voteScore || 0, 0);
    return Math.round((Math.min(replies / 20, 1) * 0.5 + Math.min(votes / 10, 1) * 0.3 + 0.1) * 100) / 100;
  },
});

// === Marketplace ===
DOMAIN_RULES.set("marketplace", {
  types: ["template", "component", "dataset", "artwork", "plugin", "preset"],
  validStatuses: ["draft", "listed", "sold", "suspended", "archived"],
  transitions: {
    draft: ["listed", "archived"],
    listed: ["sold", "suspended", "archived"],
    sold: ["listed", "archived"],
    suspended: ["listed", "archived"],
    archived: [],
  },
  requiredFields: { template: ["title", "price"], component: ["title", "price"] },
  computedFields: (type, data) => {
    data.salesCount = data.purchases?.length || 0;
    data.totalRevenue = (data.purchases || []).reduce((s, p) => s + (p.price || 0), 0);
    data.avgRating = data.ratings?.length > 0
      ? Math.round(data.ratings.reduce((s, r) => s + r.score, 0) / data.ratings.length * 10) / 10
      : 0;
    return data;
  },
  scoring: (type, data) => {
    const sales = data.salesCount || 0;
    const rating = data.avgRating || 0;
    return Math.round((Math.min(sales / 10, 1) * 0.4 + (rating / 5) * 0.4 + 0.1) * 100) / 100;
  },
});

// === Wallet ===
DOMAIN_RULES.set("wallet", {
  types: ["transaction", "transfer", "purchase", "withdrawal", "earning", "tip"],
  validStatuses: ["pending", "processing", "completed", "failed", "reversed"],
  transitions: {
    pending: ["processing", "completed", "failed"],
    processing: ["completed", "failed"],
    completed: ["reversed"],
    failed: [],
    reversed: [],
  },
  requiredFields: { transaction: ["amount"], transfer: ["amount", "to"] },
  computedFields: (type, data) => {
    data.fee = data.fee || 0;
    data.net = (data.amount || 0) - (data.fee || 0);
    data.isCredit = data.amount > 0;
    return data;
  },
  scoring: (type, data) => {
    const amount = Math.abs(data.amount || 0);
    return Math.round(Math.min(amount / 1000, 1) * 100) / 100;
  },
});

// ── Exported helpers ─────────────────────────────────────────────────────────

function validateArtifact(domain, type, data, meta) {
  const rule = DOMAIN_RULES.get(domain);
  const errors = [];
  const warnings = [];

  if (!rule) {
    // Unknown domains pass validation with a warning
    warnings.push(`Unknown domain "${domain}" — no validation rules applied`);
    return { ok: true, errors, warnings };
  }

  // Type check
  if (rule.types.length > 0 && !rule.types.includes(type)) {
    errors.push(`Invalid type "${type}" for domain "${domain}". Valid types: ${rule.types.join(", ")}`);
  }

  // Status check
  if (meta?.status && rule.validStatuses.length > 0 && !rule.validStatuses.includes(meta.status)) {
    errors.push(`Invalid status "${meta.status}" for domain "${domain}". Valid statuses: ${rule.validStatuses.join(", ")}`);
  }

  // Required fields
  const required = rule.requiredFields?.[type] || [];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      warnings.push(`Recommended field "${field}" is missing for ${domain}/${type}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function computeFields(domain, type, data) {
  const rule = DOMAIN_RULES.get(domain);
  if (rule?.computedFields) {
    return rule.computedFields(type, data);
  }
  return data;
}

function getValidTransitions(domain, currentStatus) {
  const rule = DOMAIN_RULES.get(domain);
  if (!rule?.transitions) return [];
  return rule.transitions[currentStatus] || [];
}

function scoreArtifact(domain, type, data) {
  const rule = DOMAIN_RULES.get(domain);
  if (rule?.scoring) {
    return rule.scoring(type, data);
  }
  return 0.1; // minimal score for unknown domains
}

function getDomainSchema(domain) {
  const rule = DOMAIN_RULES.get(domain);
  if (!rule) {
    return { domain, known: false, types: [], validStatuses: [], transitions: {} };
  }
  return {
    domain,
    known: true,
    types: rule.types,
    validStatuses: rule.validStatuses,
    transitions: rule.transitions,
    requiredFields: rule.requiredFields || {},
  };
}

export { DOMAIN_RULES, validateArtifact, computeFields, getValidTransitions, scoreArtifact, getDomainSchema };
