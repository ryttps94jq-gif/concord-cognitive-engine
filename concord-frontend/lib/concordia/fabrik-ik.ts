/**
 * fabrik-ik.ts
 *
 * FABRIK (Forward And Backward Reaching Inverse Kinematics) solver with
 * joint ROM (Range of Motion) constraints derived from published medical data.
 *
 * Why ROM constraints matter: without them, an IK solver produces mathematically
 * correct but anatomically impossible poses (elbows bending backward, knees
 * hyperextending). Encoding the actual joint limits forces every solved pose
 * to be one a real human body could achieve.
 */

import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

// ── Joint ROM Constraints ─────────────────────────────────────────────────────
// Published medical data (degrees). X = flexion/extension, Y = abduction/adduction,
// Z = axial rotation. Applied as Euler XYZ clamps after each FABRIK iteration.

export interface JointConstraint {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export const JOINT_CONSTRAINTS: Record<string, JointConstraint> = {
  spine:    { minX: -25, maxX:  70, minY: -25, maxY:  25, minZ: -30, maxZ:  30 },
  chest:    { minX: -15, maxX:  40, minY: -15, maxY:  15, minZ: -20, maxZ:  20 },
  neck:     { minX: -50, maxX:  60, minY: -70, maxY:  70, minZ: -45, maxZ:  45 },
  shoulder: { minX: -180, maxX: 180, minY: -90, maxY:  90, minZ: -90, maxZ:  90 },
  upperArm: { minX: -45, maxX: 135, minY: -45, maxY:  90, minZ: -90, maxZ:  90 },
  forearm:  { minX:   0, maxX: 145, minY:   0, maxY:   0, minZ: -80, maxZ:  80 },
  hand:     { minX: -60, maxX:  60, minY: -20, maxY:  35, minZ: -15, maxZ:  15 },
  upperLeg: { minX: -30, maxX: 120, minY: -45, maxY:  45, minZ: -45, maxZ:  45 },
  lowerLeg: { minX:   0, maxX: 145, minY:   0, maxY:   0, minZ:  -5, maxZ:   5 },
  foot:     { minX: -40, maxX:  20, minY: -20, maxY:  20, minZ:  -5, maxZ:   5 },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FABRIKBone {
  name:          string;
  position:      THREE.Vector3;   // current world position (mutable during solve)
  length:        number;          // distance to next bone in chain (metres)
  constraintKey: string;          // key into JOINT_CONSTRAINTS
}

export interface FABRIKChain {
  bones: FABRIKBone[];
  root:  THREE.Vector3;   // fixed root world position
}

export interface FABRIKResult {
  positions:  THREE.Vector3[];
  converged:  boolean;
  iterations: number;
}

// ── Core Solver ───────────────────────────────────────────────────────────────

/**
 * Solve a FABRIK IK chain toward `target`.
 * Returns the new world positions for each bone in the chain.
 */
export function solveFABRIK(
  chain:         FABRIKChain,
  target:        THREE.Vector3,
  maxIterations  = 10,
  tolerance      = 0.005,
): FABRIKResult {
  const n = chain.bones.length;
  if (n === 0) return { positions: [], converged: true, iterations: 0 };

  // Work on copies so the chain's positions aren't mutated until applyFABRIKToSkeleton
  const positions = chain.bones.map(b => b.position.clone());

  const totalLength = chain.bones.reduce((sum, b) => sum + b.length, 0);
  const distToTarget = chain.root.distanceTo(target);

  // Target unreachable — stretch straight toward it (natural reach limit behaviour)
  if (distToTarget >= totalLength) {
    for (let i = 0; i < n - 1; i++) {
      const r      = target.distanceTo(positions[i]);
      const lambda = chain.bones[i].length / r;
      positions[i + 1].lerpVectors(positions[i], target, lambda);
    }
    return { positions, converged: false, iterations: 1 };
  }

  let iterations = 0;
  let converged  = false;

  while (iterations < maxIterations && !converged) {
    // ── Forward pass: pull end-effector to target ──────────────────────────
    positions[n - 1].copy(target);
    for (let i = n - 2; i >= 0; i--) {
      const dir    = new THREE.Vector3().subVectors(positions[i], positions[i + 1]).normalize();
      positions[i].copy(positions[i + 1]).addScaledVector(dir, chain.bones[i].length);
    }

    // ── Backward pass: fix root, propagate outward ────────────────────────
    positions[0].copy(chain.root);
    for (let i = 0; i < n - 1; i++) {
      const dir = new THREE.Vector3().subVectors(positions[i + 1], positions[i]).normalize();
      positions[i + 1].copy(positions[i]).addScaledVector(dir, chain.bones[i].length);

      // Clamp the angle at this joint to ROM limits
      if (i > 0) {
        _clampPosition(positions, i, chain.bones[i].constraintKey);
      }
    }

    const endError = positions[n - 1].distanceTo(target);
    converged  = endError < tolerance;
    iterations++;
  }

  return { positions, converged, iterations };
}

/**
 * Clamp position[i+1] so the joint at position[i] doesn't exceed its ROM.
 * Works by decomposing the parent→child direction into Euler angles and clamping.
 */
function _clampPosition(
  positions:     THREE.Vector3[],
  i:             number,
  constraintKey: string,
): void {
  const constraint = JOINT_CONSTRAINTS[constraintKey];
  if (!constraint) return;

  const parentDir = new THREE.Vector3().subVectors(positions[i], positions[i - 1]).normalize();
  const childDir  = new THREE.Vector3().subVectors(positions[i + 1], positions[i]).normalize();

  const q = new THREE.Quaternion().setFromUnitVectors(parentDir, childDir);
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');

  e.x = Math.max(constraint.minX * DEG2RAD, Math.min(constraint.maxX * DEG2RAD, e.x));
  e.y = Math.max(constraint.minY * DEG2RAD, Math.min(constraint.maxY * DEG2RAD, e.y));
  e.z = Math.max(constraint.minZ * DEG2RAD, Math.min(constraint.maxZ * DEG2RAD, e.z));

  const qClamped = new THREE.Quaternion().setFromEuler(e);
  const clampedDir = parentDir.clone().applyQuaternion(qClamped);

  const chainLength = positions[i].distanceTo(positions[i + 1]);
  positions[i + 1].copy(positions[i]).addScaledVector(clampedDir, chainLength);
}

// ── Skeleton Application ──────────────────────────────────────────────────────

/**
 * Convert FABRIK world positions back into Three.js bone local quaternions.
 * Bones are assumed to point in the (0, -1, 0) local direction by default
 * (standard Three.js bone convention: child is "below" parent).
 */
export function applyFABRIKToSkeleton(
  chain:   FABRIKChain,
  result:  FABRIKResult,
  boneMap: Map<string, THREE.Bone>,
): void {
  const down = new THREE.Vector3(0, -1, 0);

  for (let i = 0; i < chain.bones.length - 1; i++) {
    const bone = boneMap.get(chain.bones[i].name);
    if (!bone) continue;

    const from = result.positions[i];
    const to   = result.positions[i + 1];
    const dir  = new THREE.Vector3().subVectors(to, from).normalize();

    // Clamp final rotation to ROM before writing to bone
    const q          = new THREE.Quaternion().setFromUnitVectors(down, dir);
    const constraint = JOINT_CONSTRAINTS[chain.bones[i].constraintKey];
    if (constraint) {
      const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
      e.x = Math.max(constraint.minX * DEG2RAD, Math.min(constraint.maxX * DEG2RAD, e.x));
      e.y = Math.max(constraint.minY * DEG2RAD, Math.min(constraint.maxY * DEG2RAD, e.y));
      e.z = Math.max(constraint.minZ * DEG2RAD, Math.min(constraint.maxZ * DEG2RAD, e.z));
      q.setFromEuler(e);
    }

    bone.quaternion.slerp(q, 0.6); // smooth blend to avoid jitter
  }
}

// ── Chain Builders ────────────────────────────────────────────────────────────
// Build FABRIKChain from the live Three.js bone map + body dimensions.
// Segment lengths are derived from the body dimension presets.

interface BodyDims {
  legLength:  number;
  armLength:  number;
}

export function buildLeftLegChain(
  boneMap: Map<string, THREE.Bone>,
  dims:    BodyDims,
): FABRIKChain {
  return _buildChain(boneMap, [
    { name: 'leftUpperLeg', length: dims.legLength * 0.5, constraintKey: 'upperLeg' },
    { name: 'leftLowerLeg', length: dims.legLength * 0.48, constraintKey: 'lowerLeg' },
    { name: 'leftFoot',     length: dims.legLength * 0.08, constraintKey: 'foot' },
  ], 'leftUpperLeg');
}

export function buildRightLegChain(
  boneMap: Map<string, THREE.Bone>,
  dims:    BodyDims,
): FABRIKChain {
  return _buildChain(boneMap, [
    { name: 'rightUpperLeg', length: dims.legLength * 0.5,  constraintKey: 'upperLeg' },
    { name: 'rightLowerLeg', length: dims.legLength * 0.48, constraintKey: 'lowerLeg' },
    { name: 'rightFoot',     length: dims.legLength * 0.08, constraintKey: 'foot' },
  ], 'rightUpperLeg');
}

export function buildLeftArmChain(
  boneMap: Map<string, THREE.Bone>,
  dims:    BodyDims,
): FABRIKChain {
  return _buildChain(boneMap, [
    { name: 'leftUpperArm', length: dims.armLength * 0.53, constraintKey: 'upperArm' },
    { name: 'leftForearm',  length: dims.armLength * 0.47, constraintKey: 'forearm' },
    { name: 'leftHand',     length: 0.08,                  constraintKey: 'hand' },
  ], 'leftUpperArm');
}

export function buildRightArmChain(
  boneMap: Map<string, THREE.Bone>,
  dims:    BodyDims,
): FABRIKChain {
  return _buildChain(boneMap, [
    { name: 'rightUpperArm', length: dims.armLength * 0.53, constraintKey: 'upperArm' },
    { name: 'rightForearm',  length: dims.armLength * 0.47, constraintKey: 'forearm' },
    { name: 'rightHand',     length: 0.08,                  constraintKey: 'hand' },
  ], 'rightUpperArm');
}

function _buildChain(
  boneMap:    Map<string, THREE.Bone>,
  boneSpecs:  { name: string; length: number; constraintKey: string }[],
  rootName:   string,
): FABRIKChain {
  const bones: FABRIKBone[] = boneSpecs.map(spec => {
    const bone = boneMap.get(spec.name);
    const worldPos = new THREE.Vector3();
    bone?.getWorldPosition(worldPos);
    return { name: spec.name, position: worldPos, length: spec.length, constraintKey: spec.constraintKey };
  });

  const rootBone = boneMap.get(rootName);
  const root     = new THREE.Vector3();
  rootBone?.getWorldPosition(root);

  return { bones, root };
}
