// server/lib/pvp-loot.js
// PvP loot: death drops and crime-world robbery.
// Hard rules enforced here:
//   - DTUs / personal locker: never touched
//   - CC: never transferred non-consensually
//   - Sparks: up to 30% on death, up to 20% on robbery
//   - Items: 1–3 random on death, 1 on robbery
//   - Only triggers in crime_world or combat game modes

import crypto from "crypto";

const DEATH_SPARKS_PCT = 0.30;
const ROBBERY_SPARKS_PCT = 0.20;
const LOOT_BAG_TTL_MS = 5 * 60 * 1000;        // 5 minutes
const KILLER_PRIORITY_MS = 2 * 60 * 1000;      // 2 minutes

const ALLOWED_MODES = new Set(["crime_world", "combat"]);

function assertAllowedMode(gameMode) {
  if (!ALLOWED_MODES.has(gameMode)) {
    throw new Error(`pvp_loot_not_allowed_in_mode:${gameMode}`);
  }
}

/**
 * Handle player death — drop a loot bag at their location.
 * Called by the combat resolver when a player's HP reaches 0.
 */
export function handlePlayerDeath(db, { killedId, killerId, gameMode, worldId, x = 0, y = 0, z = 0 }) {
  assertAllowedMode(gameMode);

  // Read victim's Sparks
  const victim = db.prepare(`SELECT sparks FROM users WHERE id = ?`).get(killedId);
  if (!victim) return null;

  const sparksDropped = Math.floor(victim.sparks * DEATH_SPARKS_PCT);

  // Pick 1–3 random items from victim's inventory
  const invItems = db.prepare(`
    SELECT id, item_id, item_name, quantity, quality, item_type FROM player_inventory
    WHERE user_id = ? ORDER BY RANDOM() LIMIT 3
  `).all(killedId);

  const itemsToDrop = invItems.slice(0, Math.max(1, Math.min(3, invItems.length)));

  // Deduct Sparks from victim
  if (sparksDropped > 0) {
    db.prepare(`UPDATE users SET sparks = sparks - ? WHERE id = ?`).run(sparksDropped, killedId);
    db.prepare(`INSERT INTO sparks_ledger (id, user_id, delta, reason, world_id) VALUES (?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), killedId, -sparksDropped, `death_drop:${worldId}`, worldId);
  }

  // Remove items from victim's inventory
  for (const item of itemsToDrop) {
    db.prepare(`DELETE FROM player_inventory WHERE id = ?`).run(item.id);
  }

  // Create loot bag
  const bagId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO death_loot_bags (id, world_id, x, y, z, owner_id, killer_id, sparks, items_json, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(bagId, worldId, x, y, z, killedId, killerId || null, sparksDropped, JSON.stringify(itemsToDrop), now + LOOT_BAG_TTL_MS / 1000);

  return { bagId, sparksDropped, itemCount: itemsToDrop.length, killerPriorityMs: KILLER_PRIORITY_MS };
}

/**
 * Claim a death loot bag.
 * Killer has first claim for KILLER_PRIORITY_MS, then it's open.
 */
export function claimLootBag(db, { bagId, claimerId }) {
  const bag = db.prepare(`SELECT * FROM death_loot_bags WHERE id = ?`).get(bagId);
  if (!bag) return { ok: false, error: "bag_not_found" };
  if (bag.claimed_by) return { ok: false, error: "already_claimed" };

  const now = Math.floor(Date.now() / 1000);
  if (now > bag.expires_at) return { ok: false, error: "bag_expired" };

  // Enforce killer priority window
  const createdAt = bag.created_at; // unixepoch
  const priorityEndsAt = createdAt + KILLER_PRIORITY_MS / 1000;
  if (now < priorityEndsAt && bag.killer_id && claimerId !== bag.killer_id) {
    return { ok: false, error: "killer_priority_window", priorityEndsAt };
  }

  // Transfer Sparks
  if (bag.sparks > 0) {
    db.prepare(`UPDATE users SET sparks = sparks + ? WHERE id = ?`).run(bag.sparks, claimerId);
    db.prepare(`INSERT INTO sparks_ledger (id, user_id, delta, reason, world_id) VALUES (?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), claimerId, bag.sparks, `loot_claim:${bagId}`, bag.world_id);
  }

  // Transfer items
  const items = JSON.parse(bag.items_json);
  for (const item of items) {
    const existing = db.prepare(`SELECT id FROM player_inventory WHERE user_id = ? AND item_id = ?`).get(claimerId, item.item_id);
    if (existing) {
      db.prepare(`UPDATE player_inventory SET quantity = quantity + ? WHERE id = ?`).run(item.quantity, existing.id);
    } else {
      db.prepare(`
        INSERT INTO player_inventory (id, user_id, item_type, item_id, item_name, quantity, quality)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), claimerId, item.item_type, item.item_id, item.item_name, item.quantity, item.quality);
    }
  }

  db.prepare(`UPDATE death_loot_bags SET claimed_by = ?, claimed_at = ? WHERE id = ?`).run(claimerId, now, bagId);
  return { ok: true, sparks: bag.sparks, items };
}

/**
 * Crime-world robbery. Steals up to 20% of target Sparks + 1 random item.
 * Only allowed in crime_world mode.
 */
export function handleRobbery(db, { robberId, victimId, gameMode, worldId }) {
  assertAllowedMode(gameMode);
  if (gameMode !== "crime_world") throw new Error("robbery_only_in_crime_world");

  const victim = db.prepare(`SELECT sparks FROM users WHERE id = ?`).get(victimId);
  if (!victim) return { ok: false, error: "victim_not_found" };

  const sparksStolen = Math.floor(victim.sparks * ROBBERY_SPARKS_PCT);

  // Steal one random item
  const item = db.prepare(`
    SELECT id, item_id, item_name, quantity, quality, item_type FROM player_inventory
    WHERE user_id = ? ORDER BY RANDOM() LIMIT 1
  `).get(victimId);

  // Transfer Sparks
  if (sparksStolen > 0) {
    db.prepare(`UPDATE users SET sparks = sparks - ? WHERE id = ?`).run(sparksStolen, victimId);
    db.prepare(`UPDATE users SET sparks = sparks + ? WHERE id = ?`).run(sparksStolen, robberId);
    db.prepare(`INSERT INTO sparks_ledger (id, user_id, delta, reason, world_id) VALUES (?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), victimId, -sparksStolen, `robbed_by:${robberId}`, worldId);
    db.prepare(`INSERT INTO sparks_ledger (id, user_id, delta, reason, world_id) VALUES (?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), robberId, sparksStolen, `robbed_from:${victimId}`, worldId);
  }

  // Transfer item
  let stolenItem = null;
  if (item) {
    db.prepare(`DELETE FROM player_inventory WHERE id = ?`).run(item.id);
    const existing = db.prepare(`SELECT id FROM player_inventory WHERE user_id = ? AND item_id = ?`).get(robberId, item.item_id);
    if (existing) {
      db.prepare(`UPDATE player_inventory SET quantity = quantity + ? WHERE id = ?`).run(item.quantity, existing.id);
    } else {
      db.prepare(`
        INSERT INTO player_inventory (id, user_id, item_type, item_id, item_name, quantity, quality)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), robberId, item.item_type, item.item_id, item.item_name, item.quantity, item.quality);
    }
    stolenItem = item;
  }

  return { ok: true, sparksStolen, stolenItem };
}

/**
 * Clean up expired unclaimed loot bags — return contents to original owner.
 */
export function reclaimExpiredBags(db) {
  const now = Math.floor(Date.now() / 1000);
  const expired = db.prepare(`
    SELECT * FROM death_loot_bags WHERE claimed_by IS NULL AND expires_at < ?
  `).all(now);

  for (const bag of expired) {
    // Return Sparks
    if (bag.sparks > 0) {
      db.prepare(`UPDATE users SET sparks = sparks + ? WHERE id = ?`).run(bag.sparks, bag.owner_id);
    }
    // Return items
    const items = JSON.parse(bag.items_json);
    for (const item of items) {
      const existing = db.prepare(`SELECT id FROM player_inventory WHERE user_id = ? AND item_id = ?`).get(bag.owner_id, item.item_id);
      if (existing) {
        db.prepare(`UPDATE player_inventory SET quantity = quantity + ? WHERE id = ?`).run(item.quantity, existing.id);
      } else {
        db.prepare(`
          INSERT INTO player_inventory (id, user_id, item_type, item_id, item_name, quantity, quality)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), bag.owner_id, item.item_type, item.item_id, item.item_name, item.quantity, item.quality);
      }
    }
    db.prepare(`UPDATE death_loot_bags SET claimed_by = 'returned', claimed_at = ? WHERE id = ?`).run(now, bag.id);
  }

  return expired.length;
}
