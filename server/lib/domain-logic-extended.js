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

export { EXTENDED_DOMAIN_RULES };
