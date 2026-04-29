/**
 * com-balance.ts
 *
 * Center-of-Mass (CoM) balance system for procedural character animation.
 *
 * Euphoria-style insight: a character whose CoM projects outside their
 * support polygon (the convex hull of their foot contacts) will fall over.
 * By continuously computing where the whole-body CoM sits and applying
 * small corrective hip/spine rotations, we get characters that:
 *   - Auto-adjust stance when carrying heavy loads
 *   - Lean naturally when running
 *   - Look like they'd stagger when exhausted
 *   - Never appear to float or defy gravity
 *
 * Segment mass data: Dempster (1955) / Winter (2009) biomechanics tables.
 */

import * as THREE from 'three';

// ── Segment mass ratios (% of total body mass) ────────────────────────────────
// From Dempster's cadaver study, widely used in biomechanics simulation.

const SEGMENT_MASS_RATIOS: Record<string, number> = {
  head:        0.081,
  chest:       0.216,
  spine:       0.143,
  hips:        0.142,
  leftUpperArm:  0.028, rightUpperArm:  0.028,
  leftForearm:   0.016, rightForearm:   0.016,
  leftHand:      0.006, rightHand:      0.006,
  leftUpperLeg:  0.100, rightUpperLeg:  0.100,
  leftLowerLeg:  0.047, rightLowerLeg:  0.047,
  leftFoot:      0.014, rightFoot:      0.014,
};

// ── CoM computation ───────────────────────────────────────────────────────────

/**
 * Compute the whole-body center of mass from the current Three.js bone world positions.
 * Uses the Dempster segment mass weightings.
 */
export function computeCenterOfMass(
  boneMap: Map<string, THREE.Bone>,
): THREE.Vector3 {
  const com       = new THREE.Vector3();
  let   totalMass = 0;
  const worldPos  = new THREE.Vector3();

  for (const [segmentName, ratio] of Object.entries(SEGMENT_MASS_RATIOS)) {
    const bone = boneMap.get(segmentName);
    if (!bone) continue;

    bone.getWorldPosition(worldPos);
    com.addScaledVector(worldPos, ratio);
    totalMass += ratio;
  }

  if (totalMass > 0) com.divideScalar(totalMass);
  return com;
}

// ── Balance adjustment ────────────────────────────────────────────────────────

export interface BalanceAdjustment {
  /** Additive hip lateral rotation (radians, Z-axis). Positive = lean right. */
  hipsLateral:  number;
  /** Additive spine forward/back rotation (radians, X-axis). Positive = lean forward. */
  spineForward: number;
}

/**
 * Compute small corrective rotations to keep CoM within the support polygon.
 *
 * When standing still, the CoM should project onto the midpoint between feet.
 * When moving, the CoM is allowed to lead the feet slightly (forward lean).
 * Excessive drift triggers corrective rotation, preventing the character from
 * looking like they'd topple.
 */
export function computeBalanceAdjustment(
  com:        THREE.Vector3,
  footL:      THREE.Vector3,
  footR:      THREE.Vector3,
  isMoving:   boolean,
  speedNorm:  number,  // 0–1, used to tune forward lean allowance
): BalanceAdjustment {
  const supportCenter = new THREE.Vector3()
    .addVectors(footL, footR)
    .multiplyScalar(0.5);

  const offset = new THREE.Vector3().subVectors(com, supportCenter);

  // Moving characters lean forward naturally — allow more forward CoM lead at speed
  const forwardAllowance = isMoving ? speedNorm * 0.08 : 0.02;
  const lateralAllowance = isMoving ? 0.06 : 0.03;

  // Compute how much the CoM drifts beyond the allowed envelope
  // Negative forward offset = CoM is behind feet = backward lean (corrective: lean forward)
  const lateralDrift = Math.max(-lateralAllowance, Math.min(lateralAllowance, offset.x));
  const forwardDrift = offset.z - forwardAllowance;
  const forwardClamped = Math.max(-0.12, Math.min(0.12, forwardDrift));

  return {
    hipsLateral:  -lateralDrift * 0.35,
    spineForward: -forwardClamped * 0.25,
  };
}

// ── Support polygon helpers ───────────────────────────────────────────────────

/**
 * Get world positions of both feet from the bone map.
 * Returns null if bones are not available.
 */
export function getFootPositions(
  boneMap: Map<string, THREE.Bone>,
): { footL: THREE.Vector3; footR: THREE.Vector3 } | null {
  const leftFoot  = boneMap.get('leftFoot');
  const rightFoot = boneMap.get('rightFoot');
  if (!leftFoot || !rightFoot) return null;

  const footL = new THREE.Vector3();
  const footR = new THREE.Vector3();
  leftFoot.getWorldPosition(footL);
  rightFoot.getWorldPosition(footR);

  return { footL, footR };
}

/**
 * Apply a BalanceAdjustment to the skeleton by patching hip and spine rotations.
 * Called after gait synthesis and IK have already set base bone orientations.
 */
export function applyBalanceAdjustment(
  adjustment: BalanceAdjustment,
  getMesh:    (name: string) => THREE.Object3D | undefined,
): void {
  const hips  = getMesh('hips');
  const spine = getMesh('spine');

  if (hips)  hips.rotation.z  += adjustment.hipsLateral;
  if (spine) spine.rotation.x += adjustment.spineForward;
}
