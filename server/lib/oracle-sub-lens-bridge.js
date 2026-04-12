/**
 * Oracle ↔ Sub-Lens Bridge
 *
 * Helper: when Oracle receives a query, find the most specific
 * sub-lens and include its parent chain in the retrieve phase
 * so DTUs from both the specific and general cases are considered.
 */

import { findMostSpecific, getAncestors, getChildren } from './sub-lens-registry.js';

export function expandLensContext(query, primaryDomains) {
  const context = new Set(primaryDomains || []);

  // Find most specific sub-lens for the query
  for (const root of primaryDomains || []) {
    const specific = findMostSpecific(query, root);
    if (specific && specific !== root) {
      // Add the specific lens
      context.add(specific);
      // Add all ancestors (so parent DTUs are also searched)
      for (const ancestor of getAncestors(specific)) {
        context.add(ancestor);
      }
    }
    // Also add direct children so broad queries find specific DTUs
    for (const child of getChildren(root)) {
      context.add(child);
    }
  }

  return [...context];
}
