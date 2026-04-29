// server/lib/agentic/hooks.js
// Lifecycle hook registry for the inference + tool execution pipeline.
// Hooks can abort operations by returning { abort: true, reason: string }.
// Priority: lower number = runs first. Range 0–100.

const HOOK_TYPES = [
  "before_inference",
  "after_inference",
  "before_tool",
  "after_tool",
  "on_error",
  "on_governance_violation",
  "on_dtu_creation",
  "on_royalty_event",
];

// Registry: hookType → sorted array of { handler, priority, name }
const _registry = Object.fromEntries(HOOK_TYPES.map(t => [t, []]));

/**
 * Register a hook handler.
 *
 * @param {string} hookType - one of HOOK_TYPES
 * @param {Function} handler - async (context) => void | { abort: true, reason: string }
 * @param {{ priority?: number, name?: string }} [opts]
 * @returns {Function} unregister function
 */
export function register(hookType, handler, opts = {}) {
  if (!HOOK_TYPES.includes(hookType)) {
    throw new Error(`Unknown hook type: "${hookType}". Valid: ${HOOK_TYPES.join(", ")}`);
  }

  const entry = {
    handler,
    priority: opts.priority ?? 50,
    name: opts.name || `hook_${Math.random().toString(36).slice(2)}`,
  };

  _registry[hookType].push(entry);
  _registry[hookType].sort((a, b) => a.priority - b.priority);

  // Return unregister function
  return () => {
    const idx = _registry[hookType].indexOf(entry);
    if (idx !== -1) _registry[hookType].splice(idx, 1);
  };
}

/**
 * Execute all handlers for a hook type in priority order.
 * Stops execution if any handler returns { abort: true }.
 *
 * @param {string} hookType
 * @param {object} context - passed to each handler
 * @returns {Promise<{aborted: boolean, by?: string, reason?: string}>}
 */
export async function execute(hookType, context) {
  const handlers = _registry[hookType] || [];

  for (const { handler, name } of handlers) {
    try {
      const result = await handler(context);
      if (result?.abort) {
        return { aborted: true, by: name, reason: result.reason || "no reason given" };
      }
    } catch (err) {
      // Hook errors are non-fatal but logged
      console.error(`[hooks] ${hookType}/${name} threw:`, err?.message);
    }
  }

  return { aborted: false };
}

/**
 * List all registered hooks for inspection.
 * @returns {Record<string, Array<{name: string, priority: number}>>}
 */
export function listHooks() {
  return Object.fromEntries(
    HOOK_TYPES.map(t => [t, _registry[t].map(h => ({ name: h.name, priority: h.priority }))])
  );
}

export { HOOK_TYPES };
