/**
 * World Lens — Public API barrel export
 *
 * Core simulation pipeline, game systems, invisible layer,
 * social connectivity, Concordia city data, and 3D renderer types.
 */

// ── Core Simulation ────────────────────────────────────────────────
export * from './types';
export * from './validation-engine';
export * from './simulation-domains';
export * from './concordia-types';
export * from './npc-system';
export { SEED_MATERIALS } from './material-seed';
export { DEMO_DISTRICT } from './district-seed';

// ── Game Systems (21 systems) ──────────────────────────────────────
export * from './game-systems-types';

// ── Invisible Layer (15 systems) ───────────────────────────────────
export * from './invisible-layer-types';

// ── Social Connectivity ────────────────────────────────────────────
export * from './social-types';

// ── Concordia City (Poughkeepsie geography) ────────────────────────
export * from './concordia-city';

// ── Snap-Build Templates ───────────────────────────────────────────
export * from './snap-build-templates';

// ── 3D Renderer Types ──────────────────────────────────────────────
export * from './renderer-types';
