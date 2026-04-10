#!/usr/bin/env node
/**
 * migrate-dtu-ownership.js
 *
 * Backfills `ownerId` and `visibility` fields on all existing DTUs.
 * Idempotent — safe to run multiple times; already-migrated DTUs are skipped.
 *
 * Usage (standalone):
 *   node server/scripts/migrate-dtu-ownership.js
 *
 * Usage (imported from server.js):
 *   import { migrateDtuOwnership } from "./scripts/migrate-dtu-ownership.js";
 *   const result = migrateDtuOwnership(STATE);
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Migrate DTU ownership fields on an in-memory STATE object.
 *
 * @param {object} STATE - The application state containing a `dtus` Map.
 * @returns {{ migrated: number, system: number, user: number, alreadyHadOwner: number, total: number }}
 */
export function migrateDtuOwnership(STATE) {
  if (!STATE || !STATE.dtus || typeof STATE.dtus.entries !== "function") {
    return { migrated: 0, system: 0, user: 0, alreadyHadOwner: 0, total: 0, error: "No dtus map found in STATE" };
  }

  let migrated = 0;
  let systemCount = 0;
  let userCount = 0;
  let alreadyHadOwner = 0;
  let total = 0;

  for (const [id, dtu] of STATE.dtus) {
    total++;

    // Step 3: Assign ownerId if missing
    if (dtu.ownerId) {
      alreadyHadOwner++;
    } else {
      // Determine ownership based on creatorType and source
      if (dtu.creatorType === "user" || dtu.creatorType === "user_uploaded_text") {
        dtu.ownerId = "founder";
      } else if (typeof dtu.source === "string" && (dtu.source.startsWith("utility.") || dtu.source.startsWith("subconscious."))) {
        dtu.ownerId = "system";
        dtu.visibility = "internal";
      } else if (dtu.creatorType === "repair_cortex" || dtu.creatorType === "concord_brain_index" || dtu.creatorType === "system") {
        dtu.ownerId = "system";
        dtu.visibility = "internal";
      } else {
        // Default fallback
        dtu.ownerId = "system";
        dtu.visibility = "internal";
      }
      migrated++;
    }

    // Step 4: Assign visibility if missing
    if (!dtu.visibility) {
      if (dtu.ownerId === "system") {
        dtu.visibility = "internal";
      } else if (dtu.ownerId === "founder") {
        dtu.visibility = "private";
      } else {
        dtu.visibility = "private";
      }
    }

    // Track counts
    if (dtu.ownerId === "system") {
      systemCount++;
    } else {
      userCount++;
    }
  }

  // Re-count system/user for accuracy (includes already-migrated DTUs)
  // The counts above already include all DTUs, so subtract to get only-migrated counts
  // Actually, the loop counts all DTUs for system/user, which is fine for the summary.

  return {
    migrated,
    system: systemCount,
    user: userCount,
    alreadyHadOwner,
    total,
  };
}

// ---- Standalone CLI execution ----
async function main() {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const STATE_PATH = process.env.STATE_PATH || path.join(DATA_DIR, "concord_state.json");

  console.log(`[migrate-dtu-ownership] Loading state from: ${STATE_PATH}`);

  if (!fs.existsSync(STATE_PATH)) {
    console.error(`[migrate-dtu-ownership] State file not found: ${STATE_PATH}`);
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(STATE_PATH, "utf-8");
  } catch (e) {
    console.error(`[migrate-dtu-ownership] Failed to read state file: ${e.message}`);
    process.exit(1);
  }

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    console.error(`[migrate-dtu-ownership] Failed to parse state JSON: ${e.message}`);
    process.exit(1);
  }

  // Build a minimal STATE with a Map of DTUs
  const dtusArray = Array.isArray(obj.dtus) ? obj.dtus : [];
  const STATE = {
    dtus: new Map(dtusArray.map(d => [d.id, d])),
  };

  console.log(`[migrate-dtu-ownership] Found ${STATE.dtus.size} DTUs`);

  const result = migrateDtuOwnership(STATE);

  console.log(`[migrate-dtu-ownership] Migration complete:`);
  console.log(`  Total DTUs:          ${result.total}`);
  console.log(`  Already had ownerId: ${result.alreadyHadOwner}`);
  console.log(`  Migrated:            ${result.migrated}`);
  console.log(`  System-owned:        ${result.system}`);
  console.log(`  User-owned:          ${result.user}`);

  if (result.migrated === 0) {
    console.log(`[migrate-dtu-ownership] No changes needed.`);
    return;
  }

  // Write back: update dtus in the original object
  obj.dtus = Array.from(STATE.dtus.values());
  obj.savedAt = new Date().toISOString();

  const tmpPath = STATE_PATH + ".tmp";
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(obj), "utf-8");
    fs.renameSync(tmpPath, STATE_PATH);
    console.log(`[migrate-dtu-ownership] State saved successfully.`);
  } catch (e) {
    console.error(`[migrate-dtu-ownership] Failed to save state: ${e.message}`);
    try { fs.unlinkSync(tmpPath); } catch {}
    process.exit(1);
  }
}

// Run standalone if executed directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch(e => {
    console.error(`[migrate-dtu-ownership] Fatal error: ${e.message}`);
    process.exit(1);
  });
}
