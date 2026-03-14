#!/usr/bin/env node
/**
 * Codemod: Replace silent catch blocks across the server with structured debug logging.
 * Transforms silent catch blocks into debug-logged catches.
 * Also adds logger import if not present.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename, relative } from 'path';

const SERVER_DIR = join(import.meta.dirname, '..');

// Match silent catch patterns:
//   catch { }
//   catch { /* comment */ }
//   catch (e) { }
//   catch (_) { }
const SILENT_CATCH_RE = /\}\s*catch\s*(?:\(([^)]*)\))?\s*\{\s*(?:\/\*[^*]*\*\/\s*)?\}/g;

function walkJs(dir, skipDirs = ['node_modules', 'data', 'scripts']) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkJs(full, skipDirs));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

let totalFixed = 0;
let filesFixed = 0;

const files = walkJs(SERVER_DIR).sort();

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf-8');

  const matches = content.match(SILENT_CATCH_RE);
  if (!matches || matches.length === 0) continue;

  const relPath = relative(SERVER_DIR, filePath);
  const moduleName = basename(filePath, '.js');
  const source = relPath.startsWith('emergent/') ? `emergent:${moduleName}` : moduleName;
  let count = 0;

  content = content.replace(SILENT_CATCH_RE, (match) => {
    count++;
    const commentMatch = match.match(/\/\*\s*(.*?)\s*\*\//);
    const context = commentMatch ? commentMatch[1] : 'silent catch';
    return `} catch (_e) { logger.debug('${source}', '${context.replace(/'/g, "\\'")}', { error: _e?.message }); }`;
  });

  // Add logger import if not already present
  if (!content.includes("from '../logger.js'") && !content.includes("from \"../logger.js\"")
      && !content.includes("from './logger.js'") && !content.includes("from \"./logger.js\"")) {
    // Determine relative path to logger.js
    const depth = relPath.split('/').length - 1;
    const loggerPath = depth === 0 ? './logger.js' : '../'.repeat(depth) + 'logger.js';
    // Normalize: emergent/ -> ../logger.js, routes/ -> ../logger.js, lib/ -> ../logger.js, server.js -> ./logger.js

    const lines = content.split('\n');
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImportLine = i;
    }
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, `import logger from '${loggerPath}';`);
      content = lines.join('\n');
    } else {
      // No imports - add after header comment or at top
      const headerEnd = content.indexOf('*/');
      if (headerEnd > 0) {
        const insertAt = content.indexOf('\n', headerEnd) + 1;
        content = content.slice(0, insertAt) + `\nimport logger from '${loggerPath}';\n` + content.slice(insertAt);
      } else {
        content = `import logger from '${loggerPath}';\n` + content;
      }
    }
  }

  writeFileSync(filePath, content);
  totalFixed += count;
  filesFixed++;
  console.log(`  ${relPath}: ${count} silent catches → debug logging`);
}

console.log(`\nDone: ${totalFixed} silent catches fixed across ${filesFixed} files.`);
