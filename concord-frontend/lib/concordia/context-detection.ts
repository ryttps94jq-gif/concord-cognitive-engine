// Context detection — runs at 10 Hz in the game loop to suggest mode switches.
// Reads from lightweight world state refs, never triggers re-renders directly.

import { InputMode } from './modes';
import { modeManager } from './mode-manager';

// ── Types ────────────────────────────────────────────────────────────

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface NearbyEntity {
  id: string;
  type: 'npc' | 'player' | 'vehicle' | 'terminal' | 'portal';
  position: Vector3;
  engaged?: boolean;
}

export interface GameContext {
  position: Vector3;
  inCombat: boolean;
  inVehicle: boolean;
  nearNPC: boolean;
  npcEngaged: boolean;
  inCreationZone: boolean;
  inLensWorkspace: boolean;
  nearbyEntities: NearbyEntity[];
  currentZoneType: ZoneType;
}

export type ZoneType =
  | 'open'
  | 'combat'
  | 'residential'
  | 'commercial'
  | 'creation'
  | 'lens'
  | 'social'
  | 'vehicle_path';

// ── Detection helpers ────────────────────────────────────────────────

function distance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function buildContext(
  position: Vector3,
  nearbyEntities: NearbyEntity[],
  inVehicle: boolean,
  zoneType: ZoneType,
  activeHostiles: number,
  dialoguePartnerId: string | null,
): GameContext {
  const nearNPCs = nearbyEntities.filter(e => e.type === 'npc' && distance(position, e.position) < 5);
  const nearTerminals = nearbyEntities.filter(e => e.type === 'terminal' && distance(position, e.position) < 3);
  const nearPortals = nearbyEntities.filter(e => e.type === 'portal' && distance(position, e.position) < 3);

  return {
    position,
    inCombat: activeHostiles > 0 || zoneType === 'combat',
    inVehicle,
    nearNPC: nearNPCs.length > 0,
    npcEngaged: dialoguePartnerId !== null,
    inCreationZone: zoneType === 'creation' || nearTerminals.length > 0,
    inLensWorkspace: zoneType === 'lens' || nearPortals.length > 0,
    nearbyEntities,
    currentZoneType: zoneType,
  };
}

// ── Mode inference ───────────────────────────────────────────────────

export function inferMode(ctx: GameContext): InputMode {
  if (ctx.npcEngaged)       return 'conversation';
  if (ctx.inCombat)         return 'combat';
  if (ctx.inVehicle)        return 'driving';
  if (ctx.inCreationZone)   return 'creation';
  if (ctx.inLensWorkspace)  return 'lens_work';
  return 'exploration';
}

// ── 10 Hz throttled updater (call every frame from game loop) ────────

let _lastCheck = 0;

export function maybeUpdateMode(ctx: GameContext): void {
  const now = Date.now();
  if (now - _lastCheck < 100) return;
  _lastCheck = now;
  modeManager.suggestMode(ctx);
}

// Reset for testing
export function _resetThrottle(): void {
  _lastCheck = 0;
}
