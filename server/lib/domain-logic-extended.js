// ── Extended Domain Rules — additional domains merged into DOMAIN_RULES at startup ──
// These are less common / specialized domains that extend the core set.

const EXTENDED_DOMAIN_RULES = new Map();

// === Data (Datasets & Data Science) ===
EXTENDED_DOMAIN_RULES.set("data", {
  types: ["dataset", "pipeline", "query", "report", "dashboard"],
  validStatuses: ["draft", "ingesting", "validated", "published", "deprecated", "archived"],
  transitions: {
    draft: ["ingesting", "archived"],
    ingesting: ["validated", "draft", "archived"],
    validated: ["published", "draft", "archived"],
    published: ["deprecated", "archived"],
    deprecated: ["archived"],
    archived: [],
  },
  requiredFields: { dataset: ["title"] },
  computedFields: (type, data) => {
    data.recordCount = data.recordCount || 0;
    data.fieldCount = (data.fields || data.columns || []).length;
    return data;
  },
  scoring: (type, data) => {
    const hasRecords = (data.recordCount || 0) > 0;
    const hasSchema = (data.fields || data.columns || []).length > 0;
    return Math.round(((hasRecords ? 0.4 : 0.1) + (hasSchema ? 0.3 : 0) + 0.1) * 100) / 100;
  },
});

// === Design (UI/UX) ===
EXTENDED_DOMAIN_RULES.set("design", {
  types: ["mockup", "prototype", "component", "system", "flow"],
  validStatuses: ["draft", "in-review", "approved", "implemented", "archived"],
  transitions: {
    draft: ["in-review", "archived"],
    "in-review": ["approved", "draft", "archived"],
    approved: ["implemented", "in-review", "archived"],
    implemented: ["archived"],
    archived: [],
  },
  requiredFields: { mockup: ["title"] },
  computedFields: (type, data) => {
    data.componentCount = (data.components || []).length;
    data.screenCount = (data.screens || []).length;
    return data;
  },
  scoring: (type, data) => {
    const screens = (data.screens || []).length;
    const components = (data.components || []).length;
    return Math.round((Math.min((screens + components) / 10, 1) * 0.6 + 0.2 + (data.approved ? 0.2 : 0)) * 100) / 100;
  },
});

// === Education ===
EXTENDED_DOMAIN_RULES.set("education", {
  types: ["course", "lesson", "quiz", "curriculum", "assessment"],
  validStatuses: ["draft", "review", "active", "completed", "archived"],
  transitions: {
    draft: ["review", "archived"],
    review: ["active", "draft", "archived"],
    active: ["completed", "review", "archived"],
    completed: ["archived"],
    archived: [],
  },
  requiredFields: { course: ["title"] },
  computedFields: (type, data) => {
    data.lessonCount = (data.lessons || []).length;
    data.questionCount = (data.questions || []).length;
    return data;
  },
  scoring: (type, data) => {
    const lessons = (data.lessons || []).length;
    const questions = (data.questions || []).length;
    return Math.round((Math.min(lessons / 10, 1) * 0.4 + Math.min(questions / 20, 1) * 0.3 + 0.1) * 100) / 100;
  },
});

// === Finance ===
EXTENDED_DOMAIN_RULES.set("finance", {
  types: ["ledger", "invoice", "forecast", "audit", "portfolio"],
  validStatuses: ["draft", "pending", "approved", "reconciled", "closed", "archived"],
  transitions: {
    draft: ["pending", "archived"],
    pending: ["approved", "draft", "archived"],
    approved: ["reconciled", "pending", "archived"],
    reconciled: ["closed", "archived"],
    closed: ["archived"],
    archived: [],
  },
  requiredFields: { invoice: ["title"] },
  computedFields: (type, data) => {
    const items = data.lineItems || data.items || [];
    data.lineItemCount = items.length;
    data.totalAmount = items.reduce((s, i) => s + (i.amount || i.cost || 0), 0);
    return data;
  },
  scoring: (type, data) => {
    const items = (data.lineItems || data.items || []).length;
    const hasTotal = (data.totalAmount || 0) > 0;
    return Math.round(((hasTotal ? 0.4 : 0.1) + Math.min(items / 10, 1) * 0.3 + 0.1) * 100) / 100;
  },
});

// === Health ===
EXTENDED_DOMAIN_RULES.set("health", {
  types: ["record", "observation", "plan", "report", "protocol"],
  validStatuses: ["draft", "active", "completed", "reviewed", "archived"],
  transitions: {
    draft: ["active", "archived"],
    active: ["completed", "draft", "archived"],
    completed: ["reviewed", "archived"],
    reviewed: ["archived"],
    archived: [],
  },
  requiredFields: { record: ["title"] },
  computedFields: (type, data) => {
    data.observationCount = (data.observations || []).length;
    return data;
  },
  scoring: (type, data) => {
    const observations = (data.observations || []).length;
    return Math.round((Math.min(observations / 10, 1) * 0.5 + 0.2 + (data.reviewed ? 0.2 : 0)) * 100) / 100;
  },
});

// === Project (Project Management) ===
EXTENDED_DOMAIN_RULES.set("project", {
  types: ["project", "epic", "task", "milestone", "sprint"],
  validStatuses: ["draft", "planned", "active", "blocked", "completed", "archived"],
  transitions: {
    draft: ["planned", "archived"],
    planned: ["active", "draft", "archived"],
    active: ["blocked", "completed", "archived"],
    blocked: ["active", "archived"],
    completed: ["archived"],
    archived: [],
  },
  requiredFields: { project: ["title"], task: ["title"] },
  computedFields: (type, data) => {
    const tasks = data.tasks || [];
    data.taskCount = tasks.length;
    data.completedTasks = tasks.filter(t => t.status === "completed" || t.done).length;
    data.progress = tasks.length > 0
      ? Math.round(data.completedTasks / tasks.length * 100)
      : 0;
    return data;
  },
  scoring: (type, data) => {
    const tasks = (data.tasks || []).length;
    const progress = (data.progress || 0) / 100;
    return Math.round((Math.min(tasks / 10, 1) * 0.3 + progress * 0.5 + 0.1) * 100) / 100;
  },
});

// === Crypto (Blockchain / Digital Assets) ===
EXTENDED_DOMAIN_RULES.set("crypto", {
  types: ["wallet", "portfolio", "transaction", "contract", "token"],
  validStatuses: ["draft", "pending", "confirmed", "active", "suspended", "archived"],
  transitions: {
    draft: ["pending", "archived"],
    pending: ["confirmed", "draft", "archived"],
    confirmed: ["active", "archived"],
    active: ["suspended", "archived"],
    suspended: ["active", "archived"],
    archived: [],
  },
  requiredFields: { wallet: ["title"] },
  computedFields: (type, data) => {
    data.holdingCount = (data.holdings || []).length;
    data.transactionCount = (data.transactions || []).length;
    data.totalValue = (data.holdings || []).reduce((s, h) => s + (h.amount || 0) * (h.priceUsd || 0), 0);
    return data;
  },
  scoring: (type, data) => {
    const holdings = (data.holdings || []).length;
    const hasAnalysis = !!data.lastAnalysis;
    return Math.round((Math.min(holdings / 5, 1) * 0.4 + (hasAnalysis ? 0.3 : 0) + 0.1) * 100) / 100;
  },
});

// === Code (Software Development) ===
EXTENDED_DOMAIN_RULES.set("code", {
  types: ["repository", "module", "package", "changeset", "review"],
  validStatuses: ["draft", "in-development", "in-review", "merged", "released", "archived"],
  transitions: {
    draft: ["in-development", "archived"],
    "in-development": ["in-review", "draft", "archived"],
    "in-review": ["merged", "in-development", "archived"],
    merged: ["released", "archived"],
    released: ["archived"],
    archived: [],
  },
  requiredFields: { repository: ["title"] },
  computedFields: (type, data) => {
    data.moduleCount = (data.modules || []).length;
    data.dependencyCount = (data.dependencies || []).length;
    return data;
  },
  scoring: (type, data) => {
    const modules = (data.modules || []).length;
    const hasAnalysis = !!data.lastComplexityAnalysis;
    const hasCoverage = !!(data.coverage && data.coverage.length > 0);
    return Math.round((Math.min(modules / 10, 1) * 0.3 + (hasAnalysis ? 0.3 : 0) + (hasCoverage ? 0.2 : 0) + 0.1) * 100) / 100;
  },
});

// === Math (Mathematics) ===
EXTENDED_DOMAIN_RULES.set("math", {
  types: ["proof", "computation", "dataset", "model", "formula"],
  validStatuses: ["draft", "computing", "verified", "published", "archived"],
  transitions: {
    draft: ["computing", "archived"],
    computing: ["verified", "draft", "archived"],
    verified: ["published", "computing", "archived"],
    published: ["archived"],
    archived: [],
  },
  requiredFields: {},
  computedFields: (type, data) => {
    data.hasRegression = !!data.regression;
    data.pointCount = (data.points || data.values || []).length;
    return data;
  },
  scoring: (type, data) => {
    const points = (data.points || data.values || []).length;
    const hasResult = !!data.regression || !!data.matrixA;
    return Math.round((Math.min(points / 20, 1) * 0.4 + (hasResult ? 0.4 : 0) + 0.1) * 100) / 100;
  },
});

// === Bio (Biology / Bioinformatics) ===
EXTENDED_DOMAIN_RULES.set("bio", {
  types: ["sequence", "experiment", "alignment", "expression", "phylogeny"],
  validStatuses: ["draft", "sequencing", "aligned", "analyzed", "published", "archived"],
  transitions: {
    draft: ["sequencing", "archived"],
    sequencing: ["aligned", "draft", "archived"],
    aligned: ["analyzed", "sequencing", "archived"],
    analyzed: ["published", "aligned", "archived"],
    published: ["archived"],
    archived: [],
  },
  requiredFields: { sequence: ["title"] },
  computedFields: (type, data) => {
    data.sequenceCount = (data.sequences || []).length;
    data.sampleCount = (data.samples || []).length;
    return data;
  },
  scoring: (type, data) => {
    const sequences = (data.sequences || []).length;
    const hasAnalysis = !!data.lastExpressionAnalysis;
    return Math.round((Math.min(sequences / 5, 1) * 0.4 + (hasAnalysis ? 0.3 : 0) + 0.1) * 100) / 100;
  },
});

// === Quantum (Quantum Computing) ===
EXTENDED_DOMAIN_RULES.set("quantum", {
  types: ["circuit", "algorithm", "experiment", "simulation", "error-model"],
  validStatuses: ["draft", "designing", "simulating", "verified", "deployed", "archived"],
  transitions: {
    draft: ["designing", "archived"],
    designing: ["simulating", "draft", "archived"],
    simulating: ["verified", "designing", "archived"],
    verified: ["deployed", "simulating", "archived"],
    deployed: ["archived"],
    archived: [],
  },
  requiredFields: { circuit: ["title"] },
  computedFields: (type, data) => {
    const circuit = data.circuit || {};
    data.qubitCount = circuit.qubits || 0;
    data.gateCount = (circuit.gates || []).length;
    return data;
  },
  scoring: (type, data) => {
    const circuit = data.circuit || {};
    const hasGates = (circuit.gates || []).length > 0;
    const hasSimulation = !!data.lastSimulation;
    return Math.round(((hasGates ? 0.4 : 0.1) + (hasSimulation ? 0.3 : 0) + 0.1) * 100) / 100;
  },
});

// === Art (Visual Art) ===
EXTENDED_DOMAIN_RULES.set("art", {
  types: ["painting", "illustration", "sculpture", "digital", "photography", "mixed-media"],
  validStatuses: ["draft", "in-progress", "critique", "exhibited", "sold", "archived"],
  transitions: {
    draft: ["in-progress", "archived"],
    "in-progress": ["critique", "draft", "archived"],
    critique: ["exhibited", "in-progress", "archived"],
    exhibited: ["sold", "archived"],
    sold: ["archived"],
    archived: [],
  },
  requiredFields: { painting: ["title"] },
  computedFields: (type, data) => {
    data.paletteSize = (data.palette || []).length;
    data.elementCount = (data.elements || []).length;
    return data;
  },
  scoring: (type, data) => {
    const palette = (data.palette || []).length;
    const elements = (data.elements || []).length;
    return Math.round((Math.min(palette / 5, 1) * 0.3 + Math.min(elements / 5, 1) * 0.3 + 0.1) * 100) / 100;
  },
});

// === Platform (Platform Engineering) ===
EXTENDED_DOMAIN_RULES.set("platform", {
  types: ["service", "infrastructure", "deployment", "incident", "runbook"],
  validStatuses: ["draft", "provisioning", "active", "degraded", "maintenance", "decommissioned", "archived"],
  transitions: {
    draft: ["provisioning", "archived"],
    provisioning: ["active", "draft", "archived"],
    active: ["degraded", "maintenance", "decommissioned"],
    degraded: ["active", "maintenance"],
    maintenance: ["active", "decommissioned"],
    decommissioned: ["archived"],
    archived: [],
  },
  requiredFields: { service: ["title"] },
  computedFields: (type, data) => {
    data.serviceCount = (data.services || []).length;
    data.incidentCount = (data.incidents || []).length;
    data.eventCount = (data.events || []).length;
    return data;
  },
  scoring: (type, data) => {
    const services = (data.services || []).length;
    const hasSlA = !!data.lastSlaReport;
    return Math.round((Math.min(services / 10, 1) * 0.3 + (hasSlA ? 0.4 : 0) + 0.1) * 100) / 100;
  },
});

// === Neuro (Neuroscience) ===
EXTENDED_DOMAIN_RULES.set("neuro", {
  types: ["recording", "experiment", "analysis", "model", "protocol"],
  validStatuses: ["draft", "recording", "processing", "analyzed", "published", "archived"],
  transitions: {
    draft: ["recording", "archived"],
    recording: ["processing", "draft", "archived"],
    processing: ["analyzed", "recording", "archived"],
    analyzed: ["published", "processing", "archived"],
    published: ["archived"],
    archived: [],
  },
  requiredFields: { recording: ["title"] },
  computedFields: (type, data) => {
    data.channelCount = (data.channels || []).length;
    data.epochCount = (data.epochs || []).length;
    return data;
  },
  scoring: (type, data) => {
    const channels = (data.channels || []).length;
    const epochs = (data.epochs || []).length;
    return Math.round((Math.min(channels / 8, 1) * 0.3 + Math.min(epochs / 20, 1) * 0.3 + 0.1) * 100) / 100;
  },
});

export { EXTENDED_DOMAIN_RULES };
