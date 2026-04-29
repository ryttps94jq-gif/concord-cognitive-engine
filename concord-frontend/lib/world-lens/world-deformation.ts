/**
 * world-deformation.ts
 *
 * Persistent world deformation + gameplay-affecting weather.
 *
 * Problem 1 — Persistent deformation:
 *   Destroyed buildings, craters, and terrain edits don't survive a server
 *   restart. Players lose all their impact on the world. Solution: every
 *   structural change emits a lightweight DeformationRecord that is persisted
 *   server-side and replayed on scene load to reconstruct the world state.
 *
 * Problem 2 — Weather affecting gameplay:
 *   Weather is purely cosmetic (particle systems, fog). Rain should make
 *   surfaces slippery (reduced friction → harder to turn, longer stops).
 *   Heavy fog should reduce NPC sight range. Ice should cause sliding.
 *   Implementation: a WeatherPhysicsModifier that the physics system queries
 *   each frame to adjust friction coefficients and AI perception radii.
 */

// ── Deformation records ───────────────────────────────────────────────────────

export type DeformationType =
  | 'building_destroyed'
  | 'building_damaged'   // partial damage (50–99% HP)
  | 'crater'             // explosion / AOE
  | 'terrain_excavated'  // player digs or magic removes ground
  | 'debris_placed'      // rubble left after destruction
  | 'door_broken'        // door removed from its frame
  | 'wall_breached';     // hole punched in wall

export interface DeformationRecord {
  id:        string;        // UUID
  type:      DeformationType;
  entityId:  string;        // target building / tile ID
  /** World position of the deformation centre. */
  x:         number;
  y:         number;
  z:         number;
  /** For craters / excavation: radius in world units. */
  radius?:   number;
  /** Unix timestamp (ms) when deformation occurred. */
  timestamp: number;
  /** Serialisable extra data (e.g., damage percent, wall normal). */
  data?:     Record<string, unknown>;
}

// ── Deformation store ─────────────────────────────────────────────────────────

/**
 * Client-side deformation store.
 * Keeps the full deformation log in memory and provides helpers to
 * apply / replay deformations onto scene objects.
 *
 * Server sends the full log on connection; client appends new records
 * as events arrive over WebSocket.
 */
export class DeformationStore {
  private records: Map<string, DeformationRecord> = new Map();
  private listeners: Array<(rec: DeformationRecord) => void> = [];

  /** Hydrate from server payload on initial load. */
  hydrate(records: DeformationRecord[]): void {
    for (const rec of records) {
      this.records.set(rec.id, rec);
    }
  }

  /** Apply a new deformation record (called when server event arrives). */
  apply(rec: DeformationRecord): void {
    this.records.set(rec.id, rec);
    for (const cb of this.listeners) cb(rec);
  }

  /** Subscribe to new deformation events. */
  onChange(cb: (rec: DeformationRecord) => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  /** Get all records for a specific entity. */
  forEntity(entityId: string): DeformationRecord[] {
    return Array.from(this.records.values()).filter((r) => r.entityId === entityId);
  }

  /** Get all records of a given type. */
  ofType(type: DeformationType): DeformationRecord[] {
    return Array.from(this.records.values()).filter((r) => r.type === type);
  }

  /** All craters / excavations that intersect a circle. */
  cratersNear(x: number, z: number, queryRadius: number): DeformationRecord[] {
    return Array.from(this.records.values()).filter((r) => {
      if (r.type !== 'crater' && r.type !== 'terrain_excavated') return false;
      const dx = r.x - x, dz = r.z - z;
      return Math.sqrt(dx * dx + dz * dz) < queryRadius + (r.radius ?? 0);
    });
  }

  getAll(): DeformationRecord[] {
    return Array.from(this.records.values());
  }

  size(): number { return this.records.size; }
}

// ── Scene deformation applicator ─────────────────────────────────────────────

export type SceneObjectLookup = (entityId: string) => { visible: boolean; userData: Record<string, unknown> } | undefined;

/**
 * Apply all stored deformation records to the Three.js scene.
 * Call once after scene init and after `hydrate()`.
 *
 * @param store     The deformation store.
 * @param getObject A function that returns a scene object by entity ID.
 */
export function replayDeformations(
  store:     DeformationStore,
  getObject: SceneObjectLookup,
): void {
  for (const rec of store.getAll()) {
    applyDeformationRecord(rec, getObject);
  }
}

/**
 * Apply a single deformation record to the scene.
 * Exported for incremental application as new records arrive.
 */
export function applyDeformationRecord(
  rec:       DeformationRecord,
  getObject: SceneObjectLookup,
): void {
  const obj = getObject(rec.entityId);
  if (!obj) return;

  switch (rec.type) {
    case 'building_destroyed':
      obj.visible = false;
      obj.userData.destroyed = true;
      obj.userData.destroyedAt = rec.timestamp;
      break;

    case 'building_damaged':
      obj.userData.damagePercent = rec.data?.damagePercent ?? 50;
      // Renderer checks userData.damagePercent to swap to damaged mesh variant
      break;

    case 'door_broken':
      obj.visible = false;
      obj.userData.doorBroken = true;
      break;

    case 'wall_breached':
      obj.userData.wallBreached = true;
      obj.userData.breachNormal = rec.data?.normal;
      break;

    case 'crater':
    case 'terrain_excavated':
      // Terrain system reads craters from the store to deform the heightfield
      obj.userData.hasCraters = true;
      break;

    default:
      break;
  }
}

/**
 * Create a new deformation record and emit it to the server.
 * Returns the record (which should also be applied locally optimistically).
 */
export function createDeformation(
  type:     DeformationType,
  entityId: string,
  x: number, y: number, z: number,
  extra?:   Omit<Partial<DeformationRecord>, 'id' | 'type' | 'entityId' | 'x' | 'y' | 'z' | 'timestamp'>,
): DeformationRecord {
  return {
    id:        `def_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    entityId,
    x, y, z,
    timestamp: Date.now(),
    ...extra,
  };
}

// ── Weather system ────────────────────────────────────────────────────────────

export type WeatherType = 'clear' | 'overcast' | 'rain' | 'heavy_rain' | 'storm' | 'snow' | 'blizzard' | 'fog' | 'sandstorm';

export interface WeatherState {
  type:        WeatherType;
  intensity:   number;  // 0–1 continuous interpolant (0 = none, 1 = maximum)
  windSpeed:   number;  // m/s
  windDir:     number;  // radians
  temperature: number;  // Celsius (affects snow vs rain threshold)
  visibility:  number;  // metres (max vision range this weather allows)
}

// ── Weather physics modifiers ─────────────────────────────────────────────────

export interface WeatherPhysicsModifiers {
  /** Ground friction multiplier. 1 = normal, 0.3 = icy. */
  groundFriction:       number;
  /** Max lateral speed change per second (momentum decay). Lower = more sliding. */
  lateralDamping:       number;
  /** Projectile drag factor (rain/storm reduces arrow range). */
  projectileDrag:       number;
  /** AI sight range multiplier (fog/rain reduces visibility). */
  aiSightRangeScale:    number;
  /** Player movement speed modifier. */
  moveSpeedScale:       number;
  /** Jump height multiplier (icy surfaces don't allow as much push). */
  jumpScale:            number;
}

const BASE_MODIFIERS: WeatherPhysicsModifiers = {
  groundFriction:    1.0,
  lateralDamping:    12.0,
  projectileDrag:    1.0,
  aiSightRangeScale: 1.0,
  moveSpeedScale:    1.0,
  jumpScale:         1.0,
};

/**
 * Compute physics modifiers from the current weather state.
 * These values are consumed by character-physics, NPC AI, and projectile systems.
 */
export function computeWeatherModifiers(weather: WeatherState): WeatherPhysicsModifiers {
  const i = weather.intensity;

  switch (weather.type) {
    case 'clear':
    case 'overcast':
      return { ...BASE_MODIFIERS };

    case 'rain':
      return {
        groundFriction:    1.0 - i * 0.25,       // up to 25% less grip
        lateralDamping:    12.0 - i * 3.0,        // slight sliding
        projectileDrag:    1.0 + i * 0.1,         // rain slows arrows slightly
        aiSightRangeScale: 1.0 - i * 0.2,         // rain reduces AI sight
        moveSpeedScale:    1.0 - i * 0.08,         // minor slow
        jumpScale:         1.0,
      };

    case 'heavy_rain':
    case 'storm':
      return {
        groundFriction:    0.6 - i * 0.15,
        lateralDamping:    8.0 - i * 2.0,
        projectileDrag:    1.0 + i * 0.3,
        aiSightRangeScale: 0.5 - i * 0.2,
        moveSpeedScale:    0.9 - i * 0.1,
        jumpScale:         1.0,
      };

    case 'snow':
      return {
        groundFriction:    0.75 - i * 0.2,
        lateralDamping:    10.0 - i * 4.0,
        projectileDrag:    1.0 + i * 0.05,
        aiSightRangeScale: 1.0 - i * 0.15,
        moveSpeedScale:    1.0 - i * 0.1,
        jumpScale:         0.95,
      };

    case 'blizzard':
      return {
        groundFriction:    0.4,
        lateralDamping:    5.0,
        projectileDrag:    1.5,
        aiSightRangeScale: 0.2,
        moveSpeedScale:    0.75,
        jumpScale:         0.85,
      };

    case 'fog':
      return {
        ...BASE_MODIFIERS,
        aiSightRangeScale: Math.max(0.1, 1.0 - i * 0.85),
        moveSpeedScale:    1.0 - i * 0.05,
      };

    case 'sandstorm':
      return {
        groundFriction:    1.0,
        lateralDamping:    12.0,
        projectileDrag:    2.0,
        aiSightRangeScale: Math.max(0.05, 1.0 - i * 0.95),
        moveSpeedScale:    0.8 - i * 0.15,
        jumpScale:         1.0,
      };

    default:
      return { ...BASE_MODIFIERS };
  }
}

// ── Weather transition system ─────────────────────────────────────────────────

/**
 * Smooth weather transitions over time.
 * The server sends target weather; the client interpolates over transitionSec.
 */
export class WeatherTransitionSystem {
  private current:    WeatherState;
  private target:     WeatherState;
  private elapsed:    number = 0;
  private duration:   number = 30; // default 30-second transition
  private modifiers:  WeatherPhysicsModifiers;

  constructor(initial: WeatherState) {
    this.current   = { ...initial };
    this.target    = { ...initial };
    this.modifiers = computeWeatherModifiers(initial);
  }

  /**
   * Request a weather transition to a new state.
   * @param target         Desired end weather.
   * @param transitionSec  How long the transition takes.
   */
  transitionTo(target: WeatherState, transitionSec = 30): void {
    this.current  = this.getInterpolated();
    this.target   = target;
    this.elapsed  = 0;
    this.duration = transitionSec;
  }

  update(delta: number): void {
    this.elapsed = Math.min(this.elapsed + delta, this.duration);
    this.modifiers = computeWeatherModifiers(this.getInterpolated());
  }

  getInterpolated(): WeatherState {
    const t = this.duration > 0 ? this.elapsed / this.duration : 1;
    return {
      type:        t < 0.5 ? this.current.type : this.target.type,
      intensity:   this.current.intensity   + (this.target.intensity   - this.current.intensity)   * t,
      windSpeed:   this.current.windSpeed   + (this.target.windSpeed   - this.current.windSpeed)   * t,
      windDir:     this.current.windDir     + (this.target.windDir     - this.current.windDir)     * t,
      temperature: this.current.temperature + (this.target.temperature - this.current.temperature) * t,
      visibility:  this.current.visibility  + (this.target.visibility  - this.current.visibility)  * t,
    };
  }

  /** Current physics modifiers (updated each frame). */
  getModifiers(): WeatherPhysicsModifiers { return this.modifiers; }

  /** True if a transition is in progress. */
  isTransitioning(): boolean { return this.elapsed < this.duration; }
}

// ── Surface material weather interaction ──────────────────────────────────────

export type SurfaceMaterial = 'stone' | 'dirt' | 'grass' | 'wood' | 'metal' | 'sand' | 'ice' | 'water';

/**
 * Compute the effective ground friction for a surface+weather combination.
 * Called by character-physics when determining how much the player slides.
 */
export function surfaceFriction(surface: SurfaceMaterial, modifiers: WeatherPhysicsModifiers): number {
  const BASE: Record<SurfaceMaterial, number> = {
    stone:  0.7,
    dirt:   0.6,
    grass:  0.65,
    wood:   0.75,
    metal:  0.55,
    sand:   0.5,
    ice:    0.08,   // inherently slippery
    water:  0.2,
  };

  return (BASE[surface] ?? 0.7) * modifiers.groundFriction;
}
