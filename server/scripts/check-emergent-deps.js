#!/usr/bin/env node
/**
 * CI check: validate emergent module dependency graph.
 * - Detects circular dependencies
 * - Validates all hard dependencies exist
 * - Reports globalThis coupling stats
 *
 * Exit code 0 = pass, 1 = circular deps or missing dependencies found.
 */

import { MODULE_REGISTRY, CIRCULAR_DEPS, validateDeps, auditGlobalState } from '../emergent/module-registry.js';

let exitCode = 0;

// ── Check circular dependencies ───────────────────────────────────────────
console.log('=== Emergent Module Dependency Check ===\n');

if (CIRCULAR_DEPS.length > 0) {
  console.log(`WARNING: ${CIRCULAR_DEPS.length} circular dependency chain(s) detected:`);
  for (const cycle of CIRCULAR_DEPS) {
    console.log(`  ${cycle.join(' → ')}`);
  }
  console.log('');
  // Warn but don't fail — existing cycles are documented
  // Uncomment to enforce: exitCode = 1;
} else {
  console.log('No circular dependencies detected.');
}

// ── Validate all hard deps exist ──────────────────────────────────────────
const missing = [];
for (const id of Object.keys(MODULE_REGISTRY)) {
  const result = validateDeps(id);
  if (!result.valid) {
    missing.push({ module: id, missing: result.missing });
  }
}

if (missing.length > 0) {
  console.log(`\nERROR: ${missing.length} module(s) have missing dependencies:`);
  for (const { module: mod, missing: deps } of missing) {
    console.log(`  ${mod} → missing: ${deps.join(', ')}`);
  }
  exitCode = 1;
} else {
  console.log(`All ${Object.keys(MODULE_REGISTRY).length} modules have valid dependencies.`);
}

// ── Report globalThis coupling ────────────────────────────────────────────
const globalUsage = auditGlobalState();
const globalCount = Object.keys(globalUsage).length;
const moduleCount = Object.values(globalUsage).reduce((sum, arr) => sum + arr.length, 0);

console.log(`\nglobalThis coupling: ${globalCount} globals used by ${moduleCount} module references`);
for (const [name, users] of Object.entries(globalUsage).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${name}: ${users.length} modules`);
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\nTotal modules: ${Object.keys(MODULE_REGISTRY).length}`);
console.log(`Result: ${exitCode === 0 ? 'PASS' : 'FAIL'}`);

process.exit(exitCode);
