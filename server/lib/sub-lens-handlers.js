/**
 * Sub-Lens Handler Auto-Registration
 *
 * Every sub-lens (e.g. `math.topology`, `code.rust`) gets a delegating
 * domain handler for each action its parent lens supports. The delegate
 * tags the artifact with the sub-lens and parent ids, then forwards the
 * call to the parent lens's registered handler.
 *
 * This lets sub-lenses participate in the existing lens infrastructure
 * (DTU tagging, action routing, manifest queries) without duplicating
 * per-domain engines.
 *
 * Wire-up: called from server.js once LENS_ACTIONS is fully populated.
 * See `registerSubLensHandlers` below for the expected dependencies.
 */

import { SUB_LENS_TREE, getParent } from './sub-lens-registry.js';

/**
 * Register delegating sub-lens handlers for every (sub, action) pair.
 *
 * @param {(domain: string, action: string, handler: Function) => void} registerLensAction
 *   Function that binds a handler to `${domain}.${action}` in LENS_ACTIONS.
 * @param {(parent: string) => string[]} getParentActions
 *   Function that returns the list of action names registered for a
 *   given parent domain (derived from LENS_ACTIONS keys of the form
 *   `${parent}.${action}`).
 * @param {Map<string, Function>} lensActionsMap
 *   Direct reference to LENS_ACTIONS so the delegate can look up the
 *   parent handler at call time (handlers may be registered after this
 *   function runs).
 * @returns {{ registered: string[], count: number, skipped: number }}
 */
export function registerSubLensHandlers(
  registerLensAction,
  getParentActions,
  lensActionsMap,
) {
  const registered = [];
  let skipped = 0;

  for (const [parent, node] of Object.entries(SUB_LENS_TREE)) {
    const parentActions = (typeof getParentActions === 'function'
      ? getParentActions(parent)
      : []) || [];
    if (parentActions.length === 0) continue;

    for (const child of node.children) {
      // `child` is already dotted, e.g. 'math.topology'
      for (const actionName of parentActions) {
        const key = `${child}.${actionName}`;
        // Respect any pre-existing custom handler for the sub-lens.
        if (lensActionsMap && typeof lensActionsMap.has === 'function' && lensActionsMap.has(key)) {
          skipped++;
          continue;
        }

        const delegatingHandler = async (ctx, artifact, params) => {
          // Tag the artifact with the sub-lens context so downstream
          // indexers / DTU writers can distinguish child from parent.
          if (artifact && typeof artifact === 'object') {
            const existingTags = Array.isArray(artifact.tags) ? artifact.tags : [];
            if (!existingTags.includes(child)) existingTags.push(child);
            if (!existingTags.includes(parent)) existingTags.push(parent);
            artifact.tags = existingTags;
            artifact.subLens = child;
            artifact.parentLens = parent;
          }

          // Resolve the parent handler at call time so late
          // registrations are still honoured.
          const parentHandler = lensActionsMap && typeof lensActionsMap.get === 'function'
            ? lensActionsMap.get(`${parent}.${actionName}`)
            : null;
          if (typeof parentHandler !== 'function') {
            return {
              ok: false,
              error: `parent handler ${parent}.${actionName} not found`,
              subLens: child,
              parentLens: parent,
            };
          }

          const result = await parentHandler(ctx, artifact, params);
          // Preserve sub-lens attribution in the response envelope.
          if (result && typeof result === 'object') {
            if (result.subLens === undefined) result.subLens = child;
            if (result.parentLens === undefined) result.parentLens = parent;
          }
          return result;
        };

        registerLensAction(child, actionName, delegatingHandler);
        registered.push(key);
      }
    }
  }

  return { registered, count: registered.length, skipped };
}

/**
 * Static summary of the sub-lens tree.
 *
 * @returns {{ parentCount: number, subLensCount: number }}
 */
export function getSubLensStats() {
  let total = 0;
  for (const node of Object.values(SUB_LENS_TREE)) {
    total += node.children.length;
  }
  return { parentCount: Object.keys(SUB_LENS_TREE).length, subLensCount: total };
}

// Re-export for convenience at call sites that already import this module.
export { getParent };
