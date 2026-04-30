// server/lib/npc-simulator.js
// Per-world NPC simulation. One NPCSimulator instance per active world.

import crypto from "crypto";
import logger from "../logger.js";
import { adjustSimulationDensity } from "./population-scaling.js";
import {
  buildStructure,
  practiceSkill,
  npcEvaluateNearbyCreation,
  npcObserveSkillUse,
} from "./npc-behaviors.js";
import { NavGrid } from "./nav-grid.js";

// ── Heightmap generation (mirrors TerrainRenderer.tsx deterministic algo) ──
// Resolution kept low (128) for server — A* is the bottleneck, not sample count.
const HM_RES = 128;

function _generateHeightmap(res) {
  const data = new Float32Array(res * res);
  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) {
      const nx = x / res; const nz = z / res;
      let elev = 0;
      if (nx < 0.1)      elev = 2 + nx * 30;
      else if (nx < 0.2) elev = 5 + Math.pow((nx - 0.1) / 0.1, 2) * 35;
      else if (nx < 0.6) elev = 40 + Math.sin(nx * Math.PI * 3) * 5;
      else               {
        elev = 45 + (nx - 0.6) * 80;
        elev += Math.sin(nx * 12 + nz * 8) * 6 + Math.sin(nx * 7 - nz * 5) * 4;
      }
      const creekCenterX = 0.35 + nz * 0.15;
      const distFromCreek = Math.abs(nx - creekCenterX);
      if (distFromCreek < 0.04) elev -= 12 * (1 - distFromCreek / 0.04);
      elev += Math.sin(nx * 47.3 + nz * 31.7) * 0.5 + Math.sin(nx * 97.1 + nz * 73.3) * 0.3;
      data[z * res + x] = Math.max(0, Math.min(80, elev)) / 80;
    }
  }
  return data;
}

// Shared NavGrid — built once, reused across all NPC agents
let _navGrid = null;
function getNavGrid() {
  if (!_navGrid) {
    const hm = _generateHeightmap(HM_RES);
    _navGrid  = new NavGrid(hm, HM_RES, HM_RES, 2000 / HM_RES); // cellSize ≈ 15.6m
    _navGrid.buildGrid();
  }
  return _navGrid;
}

const NPC_WALK_SPEED   = 1.4;  // m/s
const WAYPOINT_REACH_M = 2.0;  // metres — consider waypoint reached

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

  async tick(dtMs = 3000) {
    this._updateNeeds();
    // Advance along active path first (position update each tick)
    this._tickPath(dtMs / 1000);
    // Only choose a new action if not currently walking
    if (!this.state.currentPath || this.state.pathIndex >= (this.state.currentPath?.length ?? 0)) {
      const action = await this._chooseAction();
      await this._executeAction(action);
    }
    await this._maybeEvaluateCreations();
    this._persistState();
  }

  _tickPath(dtSec) {
    const path  = this.state.currentPath;
    if (!path || !path.length) return;
    let   idx   = this.state.pathIndex ?? 0;
    if (idx >= path.length) { this.state.currentPath = null; return; }

    // Walk toward current waypoint at NPC_WALK_SPEED
    let remaining = NPC_WALK_SPEED * dtSec; // metres this tick
    while (remaining > 0 && idx < path.length) {
      const wp  = path[idx];
      const dx  = wp.x - this.location.x;
      const dz  = wp.z - this.location.z;
      const d   = Math.sqrt(dx * dx + dz * dz);
      if (d <= WAYPOINT_REACH_M || d < remaining) {
        this.location.x = wp.x;
        this.location.z = wp.z;
        remaining      -= d;
        idx++;
      } else {
        this.location.x += (dx / d) * remaining;
        this.location.z += (dz / d) * remaining;
        remaining = 0;
      }
    }
    this.state.pathIndex = idx;
    if (idx >= path.length) this.state.currentPath = null;
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
      case "travel": {
        // NavGrid A* pathfinding — pick a destination 30-80m away, walk there
        const angle   = Math.random() * Math.PI * 2;
        const dist    = 30 + Math.random() * 50;
        const goalX   = this.location.x + Math.cos(angle) * dist;
        const goalZ   = this.location.z + Math.sin(angle) * dist;
        const navGrid = getNavGrid();
        const path    = navGrid.findPath(this.location.x, this.location.z, goalX, goalZ);
        if (path.length > 0) {
          this.state.currentPath  = path;
          this.state.pathIndex    = 0;
          this.state.pathGoal     = { x: goalX, z: goalZ };
        }
        break;
      }
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
      this.tick().catch(err => logger?.debug?.('[npc-simulator] background op failed', { err: err?.message }));
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
