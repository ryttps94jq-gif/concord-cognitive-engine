#!/usr/bin/env npx tsx
/**
 * Lens Integration Audit Script
 *
 * Validates that all 175 lenses × 30 integration hooks = 5,250 integration
 * points are properly wired through the LensProvider and WiringProfiles.
 *
 * Usage:
 *   npx tsx scripts/audit-lens-integrations.ts
 *   npx tsx scripts/audit-lens-integrations.ts --verbose
 *   npx tsx scripts/audit-lens-integrations.ts --category healthcare
 */

import { LENS_MANIFESTS } from '../lib/lenses/manifest';
import {
  WIRING_PROFILES,
  ALL_HOOK_NAMES,
  getWiringProfile,
  getCategoryIntegrationScore,
} from '../lib/lenses/wiring-profiles';

// ── Constants ──────────────────────────────────────────────────────────────

const TARGET_LENSES = 175;
const TARGET_HOOKS = 30;
const TARGET_INTEGRATION_POINTS = TARGET_LENSES * TARGET_HOOKS; // 5,250

const VERBOSE = process.argv.includes('--verbose');
const CATEGORY_FILTER = (() => {
  const idx = process.argv.indexOf('--category');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

// ── Audit Types ────────────────────────────────────────────────────────────

interface AuditResult {
  totalLenses: number;
  totalHooks: number;
  totalIntegrationPoints: number;
  wiredPoints: number;
  unwiredPoints: number;
  coveragePercent: number;
  categoryBreakdown: CategoryAudit[];
  missingManifests: string[];
  orphanedProfiles: string[];
  hookCoverage: Map<string, number>;
  issues: AuditIssue[];
}

interface CategoryAudit {
  category: string;
  lensCount: number;
  enabledHooks: number;
  totalHooks: number;
  wiredPoints: number;
  coveragePercent: number;
  integrationScore: number;
}

interface AuditIssue {
  severity: 'error' | 'warning' | 'info';
  domain?: string;
  category?: string;
  message: string;
}

// ── Audit Logic ────────────────────────────────────────────────────────────

function runAudit(): AuditResult {
  const issues: AuditIssue[] = [];
  const hookCoverage = new Map<string, number>();
  ALL_HOOK_NAMES.forEach(h => hookCoverage.set(h, 0));

  // Check manifest count
  if (LENS_MANIFESTS.length < TARGET_LENSES) {
    issues.push({
      severity: 'error',
      message: `Only ${LENS_MANIFESTS.length}/${TARGET_LENSES} lenses in manifest`,
    });
  }

  // Check hook count
  if (ALL_HOOK_NAMES.length < TARGET_HOOKS) {
    issues.push({
      severity: 'error',
      message: `Only ${ALL_HOOK_NAMES.length}/${TARGET_HOOKS} hooks defined`,
    });
  }

  // Check all categories have wiring profiles
  const categories = [...new Set(LENS_MANIFESTS.map(m => m.category))];
  const missingProfiles = categories.filter(c => !WIRING_PROFILES[c]);
  missingProfiles.forEach(c => {
    issues.push({
      severity: 'error',
      category: c,
      message: `Category "${c}" has no wiring profile`,
    });
  });

  // Check for orphaned profiles (profiles without lenses)
  const orphanedProfiles = Object.keys(WIRING_PROFILES).filter(
    p => !categories.includes(p)
  );

  // Build category breakdown
  let totalWired = 0;
  const categoryBreakdown: CategoryAudit[] = [];

  for (const category of categories) {
    const lenses = LENS_MANIFESTS.filter(m => m.category === category);
    const profile = getWiringProfile(category);
    const enabledHooks = profile?.enabledHooks?.length ?? 0;
    const wired = lenses.length * enabledHooks;
    totalWired += wired;

    // Track hook coverage
    if (profile?.enabledHooks) {
      for (const hook of profile.enabledHooks) {
        hookCoverage.set(hook, (hookCoverage.get(hook) ?? 0) + lenses.length);
      }
    }

    // Check for underpowered categories
    if (enabledHooks < 10) {
      issues.push({
        severity: 'warning',
        category,
        message: `Category "${category}" only has ${enabledHooks} enabled hooks (recommend ≥10)`,
      });
    }

    const integrationScore = getCategoryIntegrationScore(category);

    categoryBreakdown.push({
      category,
      lensCount: lenses.length,
      enabledHooks,
      totalHooks: TARGET_HOOKS,
      wiredPoints: wired,
      coveragePercent: Math.round((enabledHooks / TARGET_HOOKS) * 100),
      integrationScore,
    });

    // Per-lens checks
    for (const lens of lenses) {
      if (!lens.macros.list || !lens.macros.get) {
        issues.push({
          severity: 'warning',
          domain: lens.domain,
          message: `Lens "${lens.domain}" missing required macros (list/get)`,
        });
      }
      if (lens.exports.length === 0) {
        issues.push({
          severity: 'info',
          domain: lens.domain,
          message: `Lens "${lens.domain}" has no export formats`,
        });
      }
    }
  }

  // Check for unused hooks
  for (const [hook, count] of hookCoverage) {
    if (count === 0) {
      issues.push({
        severity: 'warning',
        message: `Hook "${hook}" is not enabled in any category`,
      });
    }
  }

  const totalIntegrationPoints = LENS_MANIFESTS.length * TARGET_HOOKS;

  return {
    totalLenses: LENS_MANIFESTS.length,
    totalHooks: ALL_HOOK_NAMES.length,
    totalIntegrationPoints,
    wiredPoints: totalWired,
    unwiredPoints: totalIntegrationPoints - totalWired,
    coveragePercent: Math.round((totalWired / totalIntegrationPoints) * 100),
    categoryBreakdown: CATEGORY_FILTER
      ? categoryBreakdown.filter(c => c.category === CATEGORY_FILTER)
      : categoryBreakdown,
    missingManifests: missingProfiles,
    orphanedProfiles,
    hookCoverage,
    issues,
  };
}

// ── Output ─────────────────────────────────────────────────────────────────

function printReport(result: AuditResult) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         CONCORD LENS INTEGRATION AUDIT REPORT               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`  Lenses:              ${result.totalLenses} / ${TARGET_LENSES}`);
  console.log(`  Integration Hooks:   ${result.totalHooks} / ${TARGET_HOOKS}`);
  console.log(`  Total Points:        ${result.totalIntegrationPoints} / ${TARGET_INTEGRATION_POINTS}`);
  console.log(`  Wired Points:        ${result.wiredPoints}`);
  console.log(`  Coverage:            ${result.coveragePercent}%`);
  console.log('');

  // Category table
  console.log('  ┌─────────────────┬────────┬────────┬────────┬──────────┬───────┐');
  console.log('  │ Category        │ Lenses │ Hooks  │ Wired  │ Coverage │ Score │');
  console.log('  ├─────────────────┼────────┼────────┼────────┼──────────┼───────┤');

  for (const cat of result.categoryBreakdown.sort((a, b) => b.wiredPoints - a.wiredPoints)) {
    const name = cat.category.padEnd(15);
    const lenses = String(cat.lensCount).padStart(6);
    const hooks = `${cat.enabledHooks}/${cat.totalHooks}`.padStart(6);
    const wired = String(cat.wiredPoints).padStart(6);
    const coverage = `${cat.coveragePercent}%`.padStart(8);
    const score = (cat.integrationScore * 100).toFixed(0).padStart(4) + '%';
    console.log(`  │ ${name} │${lenses} │${hooks} │${wired} │${coverage} │${score} │`);
  }

  console.log('  └─────────────────┴────────┴────────┴────────┴──────────┴───────┘');
  console.log('');

  // Hook coverage
  if (VERBOSE) {
    console.log('  Hook Coverage (lenses using each hook):');
    for (const [hook, count] of [...result.hookCoverage].sort((a, b) => b[1] - a[1])) {
      const bar = '█'.repeat(Math.ceil(count / 5));
      console.log(`    ${hook.padEnd(30)} ${String(count).padStart(3)} ${bar}`);
    }
    console.log('');
  }

  // Issues
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const infos = result.issues.filter(i => i.severity === 'info');

  if (errors.length > 0) {
    console.log(`  ✗ ${errors.length} errors:`);
    errors.forEach(e => console.log(`    [ERROR] ${e.message}`));
  }
  if (warnings.length > 0 && VERBOSE) {
    console.log(`  ⚠ ${warnings.length} warnings:`);
    warnings.forEach(w => console.log(`    [WARN]  ${w.message}`));
  }
  if (infos.length > 0 && VERBOSE) {
    console.log(`  ℹ ${infos.length} info:`);
    infos.forEach(i => console.log(`    [INFO]  ${i.message}`));
  }

  console.log('');
  console.log(`  Issues: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`);

  // Final verdict
  const pass = result.totalLenses >= TARGET_LENSES
    && result.totalHooks >= TARGET_HOOKS
    && result.coveragePercent >= 50
    && errors.length === 0;

  console.log('');
  if (pass) {
    console.log('  ✓ AUDIT PASSED');
  } else {
    console.log('  ✗ AUDIT FAILED');
  }
  console.log('');

  process.exit(pass ? 0 : 1);
}

// ── Run ────────────────────────────────────────────────────────────────────

const result = runAudit();
printReport(result);
