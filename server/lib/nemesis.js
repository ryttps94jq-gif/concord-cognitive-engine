// server/lib/nemesis.js
// When an NPC kills a player, the NPC becomes their named nemesis — gaining a title
// and growing stronger. When the player kills their nemesis, the record is cleared and
// the player earns CC + a chronicle entry.

import crypto from "crypto";

const NEMESIS_KILL_CC = 50;
const NPC_LEVEL_BOOST = 0.5; // added to nemesis NPC's combat skill levels

export function getNemesisForPlayer(db, playerId) {
  return db.prepare("SELECT * FROM nemesis_records WHERE player_id = ?").get(playerId) || null;
}

export async function onNPCKilledPlayer(db, npcId, playerId, worldId, selectBrain) {
  const existing = db.prepare("SELECT * FROM nemesis_records WHERE player_id = ?").get(playerId);
  const npc = db.prepare("SELECT * FROM world_npcs WHERE id = ?").get(npcId);
  if (!npc) return null;

  const npcName = npc.state ? (JSON.parse(npc.state)?.name || `NPC-${npcId.slice(0, 6)}`) : `NPC-${npcId.slice(0, 6)}`;
  const playerName = db.prepare("SELECT username FROM users WHERE id = ?").get(playerId)?.username || "Unknown";

  let title = `The Slayer of ${playerName}`;
  try {
    const brain = selectBrain("subconscious", { callerId: "concordia:nemesis-title" });
    const res = await brain.complete([{
      role: "user",
      content: `Generate a short, dramatic villain title (4–8 words) for an NPC named "${npcName}" who just killed a player named "${playerName}" in a world called "${worldId}". Return ONLY the title, no quotes or explanation.`,
    }]);
    const candidate = res?.content?.[0]?.text?.trim();
    if (candidate && candidate.length < 60) title = candidate;
  } catch (_) {}

  if (existing) {
    db.prepare(`UPDATE nemesis_records SET kill_count = kill_count + 1, npc_title = ?, last_encounter = ? WHERE player_id = ?`)
      .run(title, Date.now(), playerId);
  } else {
    db.prepare(`INSERT INTO nemesis_records (player_id, npc_id, npc_name, npc_title, kill_count, last_encounter, world_id) VALUES (?,?,?,?,1,?,?)`)
      .run(playerId, npcId, npcName, title, Date.now(), worldId);
  }

  // Strengthen the nemesis NPC's combat skills
  db.prepare(`UPDATE dtus SET skill_level = MIN(skill_level + ?, 9999) WHERE creator_id = ? AND type = 'skill'`)
    .run(NPC_LEVEL_BOOST, npcId);

  return { npcName, title };
}

export async function onPlayerKilledNemesis(db, playerId, npcId, realtimeEmit) {
  const nemesis = db.prepare("SELECT * FROM nemesis_records WHERE player_id = ? AND npc_id = ?").get(playerId, npcId);
  if (!nemesis) return false;

  db.prepare("DELETE FROM nemesis_records WHERE player_id = ?").run(playerId);

  // Award CC
  db.prepare("UPDATE users SET concordia_credits = concordia_credits + ? WHERE id = ?").run(NEMESIS_KILL_CC, playerId);

  // Unlock achievement via world-progression if available
  try {
    const { trackAction } = await import("./world-progression.js");
    trackAction(db, playerId, "nemesis_slain");
  } catch (_) {}

  // Chronicle entry
  try {
    const { recordEvent } = await import("../emergent/history-engine.js");
    recordEvent("breakthrough", {
      actorId: playerId,
      description: `${nemesis.npc_title} was defeated after ${nemesis.kill_count} encounter(s).`,
      significance: "nemesis_defeated",
    });
  } catch (_) {}

  realtimeEmit("world:notification", {
    userId: playerId,
    message: `Nemesis defeated! ${nemesis.npc_title} has fallen. +${NEMESIS_KILL_CC} CC`,
    type: "milestone",
  });

  return true;
}
