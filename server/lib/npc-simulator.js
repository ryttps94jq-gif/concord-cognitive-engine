// server/lib/npc-simulator.js
// Per-world NPC simulation. One NPCSimulator instance per active world.

import crypto from "crypto";
import { adjustSimulationDensity } from "./population-scaling.js";
import {
  buildStructure,
  practiceSkill,
  npcEvaluateNearbyCreation,
  npcObserveSkillUse,
} from "./npc-behaviors.js";

// Map of worldId → NPCSimulator instance
export const simulators = new Map();

// ──────────────────────────────────────────────────────────────────────────────
// NPCAgent
// ──────────────────────────────────────────────────────────────────────────────

export class NPCAgent {
  constructor(row, worldId, db, selectBrain) {
    this.id          = row.id;
    this.worldId     = worldId;
    this.npcType     = row.npc_type;
    this.location    = _parseJSON(row.current_location, { x: 0, y: 0, z: 0 });
    this.spawnLoc    = _parseJSON(row.spawn_location,   { x: 0, y: 0, z: 0 });
    this.state       = _parseJSON(row.state, {});
    this.needs       = this.state.needs || _defaultNeeds();
    this.goals       = this.state.goals || [];
    this.currentActivity = this.state.currentActivity || null;
    this._db         = db;
    this._selectBrain = selectBrain;
  }

  async tick() {
    this._updateNeeds();
    const action = await this._chooseAction();
    await this._executeAction(action);
    await this._maybeEvaluateCreations();
    this._persistState();
  }

  _updateNeeds() {
    const decay = { hunger: 0.05, rest: 0.03, social: 0.02, purpose: 0.01, safety: 0.01 };
    for (const [k, d] of Object.entries(decay)) {
      this.needs[k] = Math.max(0, (this.needs[k] ?? 1) - d);
    }
  }

  async _chooseAction() {
    // Most urgent need drives action
    const urgentNeed = Object.entries(this.needs)
      .filter(([, v]) => v < 0.3)
      .sort(([, a], [, b]) => a - b)[0];

    if (urgentNeed) {
      return _needToAction(urgentNeed[0]);
    }

    // Otherwise use subconscious brain for richer decision
    try {
      const { handle } = await this._selectBrain("subconscious", {
        brainOverride: "subconscious",
        callerId: "world:npc:decision",
      });

      const prompt = `NPC type: ${this.npcType}
World: ${this.worldId}
Needs: ${JSON.stringify(this.needs)}
Goals: ${JSON.stringify(this.goals)}
Location: ${JSON.stringify(this.location)}

Choose one action for this NPC. Return JSON only:
{ "action": "<gather_resource|build_structure|practice_skill|socialize|travel|trade|rest|create>", "target": "<optional string>" }`;

      const raw   = await handle.generate(prompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (_e) {
      // fallback
    }

    return { action: "rest" };
  }

  async _executeAction({ action, target }) {
    this.currentActivity = action;

    switch (action) {
      case "rest":
        this.needs.rest = Math.min(1, this.needs.rest + 0.3);
        break;
      case "gather_resource":
        this.needs.purpose = Math.min(1, this.needs.purpose + 0.15);
        break;
      case "socialize":
        this.needs.social = Math.min(1, this.needs.social + 0.25);
        break;
      case "build_structure":
        await buildStructure(this, target || "shelter", this.location, this._db);
        this.needs.purpose = Math.min(1, this.needs.purpose + 0.2);
        break;
      case "practice_skill": {
        const skills = this._db.prepare(
          "SELECT id FROM dtus WHERE creator_id = ? AND type = 'skill' LIMIT 1"
        ).get(this.id);
        if (skills) await practiceSkill(this, skills.id, this._db);
        this.needs.purpose = Math.min(1, this.needs.purpose + 0.1);
        break;
      }
      case "travel":
        this.location = {
          x: this.location.x + (Math.random() - 0.5) * 20,
          y: this.location.y + (Math.random() - 0.5) * 20,
          z: 0,
        };
        break;
      case "trade":
        this.needs.social   = Math.min(1, this.needs.social   + 0.1);
        this.needs.purpose  = Math.min(1, this.needs.purpose  + 0.1);
        break;
      case "create":
        this.needs.purpose = Math.min(1, this.needs.purpose + 0.2);
        break;
      default:
        break;
    }
  }

  async _maybeEvaluateCreations() {
    if (Math.random() > 0.1) return; // 10% chance per tick
    const nearby = this._db.prepare(`
      SELECT * FROM dtus
      WHERE type = 'concordia_creation' AND world_id = ?
      LIMIT 5
    `).all(this.worldId);

    for (const creation of nearby) {
      await npcEvaluateNearbyCreation(this, creation, this._db, this._selectBrain);
    }
  }

  async _maybeGenerateQuests() {
    if (Math.random() > 0.05) return; // 5% chance per tick
    try {
      const { detectQuestOpportunities } = await import("./quest-emergence.js");
      await detectQuestOpportunities(this, this._db, this._selectBrain);
    } catch (_e) { /* non-fatal */ }
  }

  _persistState() {
    this.state.needs           = this.needs;
    this.state.goals           = this.goals;
    this.state.currentActivity = this.currentActivity;

    this._db.prepare(
      "UPDATE world_npcs SET state = ?, current_location = ?, last_tick_at = unixepoch() WHERE id = ?"
    ).run(JSON.stringify(this.state), JSON.stringify(this.location), this.id);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// NPCSimulator
// ──────────────────────────────────────────────────────────────────────────────

export class NPCSimulator {
  constructor(worldId, db, selectBrain) {
    this.worldId      = worldId;
    this._db          = db;
    this._selectBrain = selectBrain;
    this._agents      = [];
    this._timer       = null;
    this._tickRate    = 60000; // will be updated on first player count
  }

  async initialize() {
    const rows = this._db.prepare(
      "SELECT * FROM world_npcs WHERE world_id = ?"
    ).all(this.worldId);

    this._agents = rows.map(r => new NPCAgent(r, this.worldId, this._db, this._selectBrain));

    // Ensure at least one seed NPC per world
    if (this._agents.length === 0) {
      this._spawnSeedNpc();
    }
  }

  _spawnSeedNpc() {
    const id = crypto.randomUUID();
    this._db.prepare(`
      INSERT INTO world_npcs (id, world_id, npc_type, spawn_location, current_location, state)
      VALUES (?, ?, 'generic', '{}', '{}', '{}')
    `).run(id, this.worldId);

    const row = this._db.prepare("SELECT * FROM world_npcs WHERE id = ?").get(id);
    this._agents.push(new NPCAgent(row, this.worldId, this._db, this._selectBrain));
  }

  async tick() {
    await Promise.allSettled(this._agents.map(a => a.tick()));
    await Promise.allSettled(this._agents.map(a => a._maybeGenerateQuests()));
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      this.tick().catch(() => {});
    }, this._tickRate);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  updatePopulation(playerCount) {
    const { tickRate } = adjustSimulationDensity({ id: this.worldId }, playerCount);
    if (tickRate !== this._tickRate) {
      this._tickRate = tickRate;
      if (this._timer) {
        this.stop();
        this.start();
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function _defaultNeeds() {
  return { hunger: 1, rest: 1, social: 1, purpose: 1, safety: 1 };
}

function _needToAction(need) {
  const map = { hunger: "gather_resource", rest: "rest", social: "socialize", purpose: "create", safety: "travel" };
  return { action: map[need] || "rest" };
}

function _parseJSON(val, fallback) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
