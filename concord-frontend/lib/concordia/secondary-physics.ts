/**
 * secondary-physics.ts
 *
 * Secondary motion physics: hair, cloth, and weapon follow-through.
 *
 * Problem: Characters move but attached objects (capes, hair, weapon tips)
 * don't respond to that movement. A warrior running looks stiff because
 * her cape hangs perfectly still regardless of direction or speed changes.
 * Weapons feel weightless — no swing follow-through when the attack ends.
 *
 * Technique: Verlet integration particle chains.
 * Each strand (hair, cape, weapon chain) is a series of particles
 * connected by distance constraints. Each frame:
 *   1. Integrate particle positions (velocity = pos - prevPos, explicit Euler).
 *   2. Apply gravity + wind + inertia from parent bone velocity.
 *   3. Relax distance constraints (N iterations, typically 3–5).
 *   4. Apply the result to bone positions/rotations.
 *
 * This is identical in structure to how Nvidia PhysX cloth, Unity's cloth
 * component, and Unreal's hair physics work — all verlet chains.
 */

import * as THREE from 'three';

// ── Particle ──────────────────────────────────────────────────────────────────

export interface SecondaryParticle {
  position:    THREE.Vector3;
  prevPosition: THREE.Vector3;
  /** Mass inverse (0 = pinned / infinite mass). */
  invMass:     number;
  /** Drag coefficient: 0 = no drag, 1 = fully damped. */
  drag:        number;
}

// ── Chain ─────────────────────────────────────────────────────────────────────

export interface SecondaryChain {
  particles:     SecondaryParticle[];
  /** Rest length between each adjacent pair of particles. */
  restLengths:   number[];
  /** Constraint solve iterations per frame. */
  iterations:    number;
  /** Stiffness multiplier for distance constraints. 1 = rigid, 0 = noodle. */
  stiffness:     number;
  /** Gravity scale (1 = full gravity, 0 = zero-g for space effects). */
  gravityScale:  number;
  /** Optional wind influence scale. */
  windScale:     number;
  /** Bone names to write results back to (length = particles.length - 1). */
  boneNames:     string[];
}

// ── Global secondary physics settings ─────────────────────────────────────────

export interface SecondaryPhysicsSettings {
  gravity:     THREE.Vector3;
  wind:        THREE.Vector3;
  /** Simulation sub-steps per frame for stability at low frame rates. */
  subSteps:    number;
}

const DEFAULT_SETTINGS: SecondaryPhysicsSettings = {
  gravity:  new THREE.Vector3(0, -9.81, 0),
  wind:     new THREE.Vector3(0, 0, 0),
  subSteps: 2,
};

// ── Verlet integrator ─────────────────────────────────────────────────────────

const _tmpVel = new THREE.Vector3();
const _tmpAcc = new THREE.Vector3();

/**
 * Integrate one particle for one sub-step.
 * Explicit Euler on velocity-Verlet; velocity derived from position delta.
 */
function integrateParticle(
  p:        SecondaryParticle,
  dt:       number,
  settings: SecondaryPhysicsSettings,
  parentAccel: THREE.Vector3, // inertia force from parent bone's acceleration
): void {
  if (p.invMass === 0) return; // pinned

  _tmpVel.subVectors(p.position, p.prevPosition);
  _tmpVel.multiplyScalar(1 - p.drag);             // damping

  _tmpAcc.copy(settings.gravity).multiplyScalar(p.gravityScale ?? 1);
  _tmpAcc.addScaledVector(settings.wind, p.windScale ?? 1);
  _tmpAcc.addScaledVector(parentAccel, -1);        // inertia: oppose parent acceleration

  p.prevPosition.copy(p.position);
  p.position.add(_tmpVel).addScaledVector(_tmpAcc, dt * dt);
}

/**
 * Relax distance constraints between adjacent particles.
 * Moves both endpoints (proportional to invMass) to satisfy rest length.
 */
function relaxConstraints(chain: SecondaryChain): void {
  const { particles, restLengths, stiffness } = chain;
  for (let i = 0; i < particles.length - 1; i++) {
    const a = particles[i];
    const b = particles[i + 1];
    const rest = restLengths[i];
    if (!rest) continue;

    const delta  = _tmpVel.subVectors(b.position, a.position);
    const dist   = delta.length();
    if (dist < 0.0001) continue;

    const correction = (dist - rest) / dist * stiffness;
    const totalMass  = a.invMass + b.invMass;
    if (totalMass < 0.0001) continue;

    const weightA = a.invMass / totalMass;
    const weightB = b.invMass / totalMass;

    a.position.addScaledVector(delta,  correction * weightA);
    b.position.addScaledVector(delta, -correction * weightB);
  }
}

// ── Chain builders ────────────────────────────────────────────────────────────

/**
 * Build a hair/ponytail chain from a root bone position.
 *
 * @param rootPos     World position of the hair root bone.
 * @param segments    Number of hair segments (3–8 typical).
 * @param segLength   Length of each hair segment in world units.
 * @param boneNames   Names of bones to drive (rootBone, seg1, seg2, ...).
 */
export function buildHairChain(
  rootPos:   THREE.Vector3,
  segments:  number,
  segLength: number,
  boneNames: string[],
): SecondaryChain {
  const particles: SecondaryParticle[] = [];
  const restLengths: number[] = [];

  for (let i = 0; i <= segments; i++) {
    particles.push({
      position:     new THREE.Vector3(rootPos.x, rootPos.y - i * segLength, rootPos.z),
      prevPosition: new THREE.Vector3(rootPos.x, rootPos.y - i * segLength, rootPos.z),
      invMass:      i === 0 ? 0 : 1,  // root is pinned
      drag:         0.08 + i * 0.02,  // tips drag more
    });
    if (i > 0) restLengths.push(segLength);
  }

  return {
    particles, restLengths,
    iterations:   4,
    stiffness:    0.9,
    gravityScale: 1.0,
    windScale:    0.5,
    boneNames,
  };
}

/**
 * Build a cape/cloth chain (single column of particles).
 * For a full 2D cloth grid, build multiple parallel chains and add
 * cross constraints.
 *
 * @param shoulderPos  World position of shoulder attachment point.
 * @param rows         Number of cape rows.
 * @param rowHeight    Vertical distance between rows in world units.
 * @param boneNames    Bone names for each row.
 */
export function buildCapeChain(
  shoulderPos: THREE.Vector3,
  rows:        number,
  rowHeight:   number,
  boneNames:   string[],
): SecondaryChain {
  const particles: SecondaryParticle[] = [];
  const restLengths: number[] = [];

  for (let i = 0; i <= rows; i++) {
    particles.push({
      position:     new THREE.Vector3(shoulderPos.x, shoulderPos.y - i * rowHeight, shoulderPos.z),
      prevPosition: new THREE.Vector3(shoulderPos.x, shoulderPos.y - i * rowHeight, shoulderPos.z),
      invMass:      i === 0 ? 0 : 1,
      drag:         0.12,
    });
    if (i > 0) restLengths.push(rowHeight);
  }

  return {
    particles, restLengths,
    iterations:   5,
    stiffness:    0.95,
    gravityScale: 1.0,
    windScale:    1.0,
    boneNames,
  };
}

/**
 * Build a weapon follow-through chain (sword/staff tip lag).
 * The weapon root is pinned to the hand bone; the tip follows with delay.
 *
 * @param handPos    World position of hand/grip.
 * @param tipOffset  Offset from hand to tip along weapon axis.
 * @param boneNames  [gripBone, midBone?, tipBone].
 */
export function buildWeaponChain(
  handPos:   THREE.Vector3,
  tipOffset: THREE.Vector3,
  boneNames: string[],
): SecondaryChain {
  const segments = boneNames.length;
  const particles: SecondaryParticle[] = [];
  const restLengths: number[] = [];
  const restLen = tipOffset.length() / Math.max(1, segments - 1);

  for (let i = 0; i < segments; i++) {
    const t = i / Math.max(1, segments - 1);
    particles.push({
      position:     new THREE.Vector3(
        handPos.x + tipOffset.x * t,
        handPos.y + tipOffset.y * t,
        handPos.z + tipOffset.z * t,
      ),
      prevPosition: new THREE.Vector3(
        handPos.x + tipOffset.x * t,
        handPos.y + tipOffset.y * t,
        handPos.z + tipOffset.z * t,
      ),
      invMass:  i === 0 ? 0 : 1.5,  // grip pinned, tip has more inertia
      drag:     0.15,
    });
    if (i > 0) restLengths.push(restLen);
  }

  return {
    particles, restLengths,
    iterations:   6,
    stiffness:    0.85,     // slightly springy for follow-through feel
    gravityScale: 0.3,      // weapons don't droop much
    windScale:    0.1,
    boneNames,
  };
}

// ── Chain updater ─────────────────────────────────────────────────────────────

const _parentAccel = new THREE.Vector3();
const _prevRoot    = new THREE.Vector3();

/**
 * Update a secondary physics chain for one frame.
 *
 * @param chain         The chain to simulate.
 * @param rootWorldPos  Current world position of the root anchor (e.g., head bone).
 * @param delta         Frame time in seconds.
 * @param settings      Global physics settings.
 */
export function updateChain(
  chain:        SecondaryChain,
  rootWorldPos: THREE.Vector3,
  delta:        number,
  settings:     SecondaryPhysicsSettings = DEFAULT_SETTINGS,
): void {
  const root = chain.particles[0];

  // Compute parent acceleration from root displacement (for inertia)
  _parentAccel.subVectors(rootWorldPos, root.position);
  _parentAccel.divideScalar(delta * delta);
  _parentAccel.clampLength(0, 50); // cap to prevent explosion on teleport

  // Pin root to anchor
  root.prevPosition.copy(root.position);
  root.position.copy(rootWorldPos);

  const subDt = delta / settings.subSteps;
  for (let step = 0; step < settings.subSteps; step++) {
    // Integrate free particles
    for (let i = 1; i < chain.particles.length; i++) {
      integrateParticle(chain.particles[i], subDt, settings, _parentAccel);
    }
    // Relax constraints
    for (let iter = 0; iter < chain.iterations; iter++) {
      relaxConstraints(chain);
    }
  }
}

// ── Apply chain to bones ──────────────────────────────────────────────────────

const _boneDir   = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _rot       = new THREE.Quaternion();
const _downVec   = new THREE.Vector3(0, -1, 0);

/**
 * Write the simulated particle positions back onto the skeleton bones.
 *
 * @param chain    Simulated chain.
 * @param getMesh  Function to retrieve a bone/mesh by name.
 */
export function applyChainToBones(
  chain:   SecondaryChain,
  getMesh: (name: string) => THREE.Object3D | undefined,
): void {
  for (let i = 0; i < chain.boneNames.length; i++) {
    const bone = getMesh(chain.boneNames[i]);
    if (!bone) continue;

    const from = chain.particles[i].position;
    const to   = chain.particles[i + 1]?.position;
    if (!to) continue;

    _targetDir.subVectors(to, from).normalize();
    _rot.setFromUnitVectors(_downVec, _targetDir);

    // Slerp for smooth follow — bones shouldn't snap
    bone.quaternion.slerp(_rot, 0.5);
  }
}

// ── Manager ───────────────────────────────────────────────────────────────────

/**
 * Manages all secondary physics chains for one avatar.
 */
export class SecondaryPhysicsManager {
  private chains:   Map<string, SecondaryChain> = new Map();
  private settings: SecondaryPhysicsSettings;

  constructor(settings?: Partial<SecondaryPhysicsSettings>) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  addChain(name: string, chain: SecondaryChain): void {
    this.chains.set(name, chain);
  }

  removeChain(name: string): void {
    this.chains.delete(name);
  }

  /**
   * Update all chains.
   * @param rootPositions  Map from chain name to current world root position.
   * @param delta          Frame delta in seconds.
   * @param getMesh        Bone lookup function.
   */
  update(
    rootPositions: Map<string, THREE.Vector3>,
    delta:         number,
    getMesh:       (name: string) => THREE.Object3D | undefined,
  ): void {
    for (const [name, chain] of this.chains) {
      const root = rootPositions.get(name);
      if (!root) continue;
      updateChain(chain, root, delta, this.settings);
      applyChainToBones(chain, getMesh);
    }
  }

  /** Update global wind (e.g., from weather system). */
  setWind(wind: THREE.Vector3): void {
    this.settings.wind.copy(wind);
  }
}
