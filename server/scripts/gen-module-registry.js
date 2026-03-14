#!/usr/bin/env node
/**
 * Auto-generate emergent module registry by scanning actual imports and globalThis usage.
 * Outputs module-registry.js with dependency graph, load order, and subsystem mapping.
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const EMERGENT_DIR = join(import.meta.dirname, '..', 'emergent');
const OUTPUT = join(EMERGENT_DIR, 'module-registry.js');

const files = readdirSync(EMERGENT_DIR)
  .filter(f => f.endsWith('.js') && f !== 'module-registry.js')
  .sort();

const modules = new Map();

// ── Phase 1: Scan all modules ─────────────────────────────────────────────

for (const file of files) {
  const id = basename(file, '.js');
  const content = readFileSync(join(EMERGENT_DIR, file), 'utf-8');
  const lines = content.split('\n');

  // Extract imports from within emergent/
  const hardDeps = new Set();
  const softDeps = new Set();
  const globalAccess = new Set();
  const exports_ = [];

  for (const line of lines) {
    // Hard imports: import { x } from './module.js'
    const importMatch = line.match(/^import\s+.*from\s+['"]\.\/([^'"]+)\.js['"]/);
    if (importMatch) {
      const dep = importMatch[1];
      if (dep !== 'module-registry') hardDeps.add(dep);
    }

    // Soft imports: import('./module.js')
    const dynMatch = line.match(/import\(['"]\.\/([^'"]+)\.js['"]\)/);
    if (dynMatch) {
      const dep = dynMatch[1];
      if (!hardDeps.has(dep)) softDeps.add(dep);
    }

    // globalThis usage
    const globalMatches = line.matchAll(/globalThis\.(_concordSTATE|_concordMACROS|_concordBRAIN|STATE|realtimeEmit|qualiaEngine|qualiaHooks|_runCouncilVoices|_repairCortexPainModule|_concordApps)/g);
    for (const m of globalMatches) globalAccess.add(m[1]);

    // Exports
    const exportMatch = line.match(/^export\s+(function|const|class|async\s+function)\s+(\w+)/);
    if (exportMatch) exports_.push(exportMatch[2]);
  }

  // Detect subsystem from filename
  let subsystem = null;
  if (id.startsWith('atlas-')) subsystem = 'atlas';
  else if (['dialogue', 'governance', 'gates', 'schema'].includes(id)) subsystem = 'dialogue';
  else if (['activation', 'context-engine', 'scope-separation', 'districts'].includes(id)) subsystem = 'activation';
  else if (['repair-cortex', 'avoidance-learning'].includes(id)) subsystem = 'repair';
  else if (['body-instantiation', 'death-protocol', 'reproduction', 'growth'].includes(id)) subsystem = 'entity-lifecycle';
  else if (['sleep-consolidation', 'dream-capture'].includes(id)) subsystem = 'sleep';
  else if (['culture-layer', 'entity-teaching'].includes(id)) subsystem = 'culture';
  else if (['cnet-federation', 'state-migration', 'federation-peering'].includes(id)) subsystem = 'federation';

  const neverDisable = id === 'repair-cortex' || id === 'store' || id === 'index';

  modules.set(id, {
    id,
    file,
    hardDeps: [...hardDeps],
    softDeps: [...softDeps],
    globalAccess: [...globalAccess],
    exports: exports_,
    subsystem,
    neverDisable,
  });
}

// ── Phase 2: Compute importedBy counts ────────────────────────────────────

for (const mod of modules.values()) {
  mod.importedBy = 0;
}
for (const mod of modules.values()) {
  for (const dep of [...mod.hardDeps, ...mod.softDeps]) {
    const target = modules.get(dep);
    if (target) target.importedBy = (target.importedBy || 0) + 1;
  }
}

// ── Phase 3: Topological sort for load order ──────────────────────────────

function topoSort(mods) {
  const visited = new Set();
  const order = [];
  const visiting = new Set();

  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) return; // circular — skip
    visiting.add(id);
    const mod = mods.get(id);
    if (mod) {
      for (const dep of mod.hardDeps) visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }

  for (const id of mods.keys()) visit(id);
  return order;
}

const loadOrder = topoSort(modules);

// ── Phase 4: Detect circular dependencies ─────────────────────────────────

function detectCycles(mods) {
  const cycles = [];
  const visited = new Set();
  const stack = new Set();

  function dfs(id, path) {
    if (stack.has(id)) {
      const cycleStart = path.indexOf(id);
      cycles.push(path.slice(cycleStart).concat(id));
      return;
    }
    if (visited.has(id)) return;
    stack.add(id);
    path.push(id);
    const mod = mods.get(id);
    if (mod) {
      for (const dep of mod.hardDeps) {
        if (mods.has(dep)) dfs(dep, [...path]);
      }
    }
    stack.delete(id);
    visited.add(id);
  }

  for (const id of mods.keys()) dfs(id, []);
  return cycles;
}

const cycles = detectCycles(modules);

// ── Phase 5: Generate output ──────────────────────────────────────────────

const registryEntries = [];
for (const id of loadOrder) {
  const mod = modules.get(id);
  registryEntries.push(`  "${id}": ${JSON.stringify({
    file: mod.file,
    hardDeps: mod.hardDeps,
    softDeps: mod.softDeps,
    globalAccess: mod.globalAccess,
    exports: mod.exports,
    subsystem: mod.subsystem,
    neverDisable: mod.neverDisable,
    importedBy: mod.importedBy,
  }, null, 4).replace(/\n/g, '\n  ')}`);
}

const output = `// Auto-generated emergent module registry
// Generated: ${new Date().toISOString()}
// Modules: ${modules.size}
// Circular dependencies: ${cycles.length > 0 ? cycles.map(c => c.join(' → ')).join('; ') : 'none'}
//
// This registry maps every emergent module's dependencies, globalThis usage,
// exports, and subsystem membership. Used for:
//   1. Validated load ordering (topological sort)
//   2. Circular dependency detection in CI
//   3. Auditing globalThis coupling
//   4. Subsystem boundary enforcement

export const MODULE_REGISTRY = {
${registryEntries.join(',\n')}
};

export const LOAD_ORDER = ${JSON.stringify(loadOrder, null, 2)};

export const SUBSYSTEMS = ${JSON.stringify(
  Object.fromEntries(
    [...new Set([...modules.values()].map(m => m.subsystem).filter(Boolean))].map(sub => [
      sub,
      {
        modules: [...modules.values()].filter(m => m.subsystem === sub).map(m => m.id),
        head: [...modules.values()].find(m => m.subsystem === sub && m.importedBy > 2)?.id || null,
      },
    ])
  ), null, 2)};

export const CIRCULAR_DEPS = ${JSON.stringify(cycles)};

/**
 * Validate that all hard dependencies for a module are present.
 * @param {string} moduleId
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateDeps(moduleId) {
  const mod = MODULE_REGISTRY[moduleId];
  if (!mod) return { valid: false, missing: [moduleId] };
  const missing = mod.hardDeps.filter(d => !MODULE_REGISTRY[d]);
  return { valid: missing.length === 0, missing };
}

/**
 * Get all modules that depend on the given module (reverse lookup).
 * @param {string} moduleId
 * @returns {string[]}
 */
export function getDependents(moduleId) {
  return Object.entries(MODULE_REGISTRY)
    .filter(([, mod]) => mod.hardDeps.includes(moduleId) || mod.softDeps.includes(moduleId))
    .map(([id]) => id);
}

/**
 * Audit globalThis usage across all modules.
 * @returns {Record<string, string[]>}
 */
export function auditGlobalState() {
  const usage = {};
  for (const [id, mod] of Object.entries(MODULE_REGISTRY)) {
    for (const g of mod.globalAccess) {
      if (!usage[g]) usage[g] = [];
      usage[g].push(id);
    }
  }
  return usage;
}
`;

writeFileSync(OUTPUT, output);

// Stats
console.log(`Module registry generated: ${OUTPUT}`);
console.log(`  Modules: ${modules.size}`);
console.log(`  Load order: ${loadOrder.length} entries`);
console.log(`  Circular deps: ${cycles.length > 0 ? cycles.map(c => c.join(' → ')).join('; ') : 'none'}`);

const subsystems = [...new Set([...modules.values()].map(m => m.subsystem).filter(Boolean))];
console.log(`  Subsystems: ${subsystems.join(', ')}`);

const globalUsers = [...modules.values()].filter(m => m.globalAccess.length > 0);
console.log(`  Modules using globalThis: ${globalUsers.length}`);

const hubs = [...modules.values()].filter(m => m.importedBy >= 5).sort((a, b) => b.importedBy - a.importedBy);
if (hubs.length) {
  console.log(`  Dependency hubs: ${hubs.map(h => `${h.id} (${h.importedBy})`).join(', ')}`);
}
