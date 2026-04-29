#!/usr/bin/env node
// server/scripts/audit-imports.js
// Phase 4: Hallucinated import / dependency check.
// Every import must resolve to an actually-existing module.
// AI sometimes invents packages or relative paths that don't exist.
// Usage: node server/scripts/audit-imports.js [--json]

import { readdir, readFile, access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");
const SERVER_DIR = path.join(ROOT, "server");
const JSON_MODE = process.argv.includes("--json");

const _require = createRequire(import.meta.url);

// ── File walker ────────────────────────────────────────────────────────────────

async function getFiles(dir, exts = [".js"]) {
  const results = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", ".next", "dist", "build"].includes(entry.name)) continue;
      results.push(...await getFiles(fullPath, exts));
    } else if (entry.isFile() && exts.some(e => entry.name.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Import extraction ──────────────────────────────────────────────────────────

const IMPORT_RE = /(?:import\s+(?:[\w{},\s*]+\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g;

function extractImports(content) {
  const all = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(content)) !== null) all.push(m[1]);
  return all;
}

// ── Resolution ─────────────────────────────────────────────────────────────────

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function resolveImport(spec, fromFile) {
  if (spec.startsWith(".") || spec.startsWith("/")) {
    // Relative — check common extensions
    const base = path.resolve(path.dirname(fromFile), spec);
    const candidates = [
      base,
      base + ".js", base + ".ts", base + ".tsx",
      path.join(base, "index.js"), path.join(base, "index.ts"),
    ];
    for (const c of candidates) {
      if (await fileExists(c)) return { resolved: true, path: c };
    }
    return { resolved: false, spec, fromFile };
  }

  // External package
  if (spec.startsWith("node:") || spec.startsWith("nodejs:")) return { resolved: true, builtin: true };

  const packageName = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  try {
    _require.resolve(packageName, { paths: [SERVER_DIR] });
    return { resolved: true, external: packageName };
  } catch {
    return { resolved: false, spec, packageName, external: true };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  const files = [
    ...await getFiles(path.join(SERVER_DIR, "lib"), [".js"]),
    ...await getFiles(path.join(SERVER_DIR, "routes"), [".js"]),
  ];

  log(`Checking imports across ${files.length} files...`);

  const unresolved = [];
  const summary = { checked: 0, resolved: 0, unresolved: 0 };

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8").catch(() => "");
    const imports = extractImports(content);

    for (const spec of imports) {
      summary.checked++;
      const result = await resolveImport(spec, filePath);
      if (result.resolved) {
        summary.resolved++;
      } else {
        summary.unresolved++;
        unresolved.push({
          file: path.relative(ROOT, filePath),
          spec,
          isExternal: result.external ?? false,
          packageName: result.packageName,
        });
      }
    }
  }

  // Deduplicate external package failures
  const externalMissing = [...new Set(
    unresolved.filter(u => u.isExternal).map(u => u.packageName)
  )];

  const relativeMissing = unresolved.filter(u => !u.isExternal);

  const result = {
    ...summary,
    unresolvedCount: unresolved.length,
    externalMissingPackages: externalMissing,
    relativeMissingFiles: relativeMissing,
    generatedAt: new Date().toISOString(),
  };

  if (JSON_MODE) {
    process.stdout.write(JSON.stringify(result, null, 2));
  } else {
    log(`\n══ IMPORT AUDIT ══`);
    log(`Checked: ${summary.checked} imports across ${files.length} files`);
    log(`Resolved: ${summary.resolved} | Unresolved: ${summary.unresolved}`);

    if (externalMissing.length > 0) {
      log(`\n🔴 Missing external packages (${externalMissing.length}):`);
      externalMissing.forEach(p => log(`  ✗ ${p}`));
    }

    if (relativeMissing.length > 0) {
      log(`\n🔴 Missing relative imports (${relativeMissing.length}):`);
      relativeMissing.slice(0, 20).forEach(f => log(`  ✗ ${f.file} → "${f.spec}"`));
    }

    if (unresolved.length === 0) {
      log("\n  ✓ All imports resolve correctly");
    }
  }

  return result;
}

function log(...args) {
  if (!JSON_MODE) console.log(...args);
}

main().catch(e => { console.error(e.message); process.exit(1); });
