/**
 * TypeScript types for entity state, organ maturity, and species classification.
 */

export interface Entity {
  id: string;
  name: string;
  /** Proper citizen-style name (e.g. "Coltrane"). Deterministic from id+domain. */
  displayName?: string;
  /** Full title (e.g. "Coltrane the Seeker"). */
  fullTitle?: string;
  /** Normalized domain (music, code, physics, ...). */
  domain?: string;
  /** Behavioral role (critic, analyzer, explorer, ...). */
  role?: string;
  species: string;
  status: 'alive' | 'dead' | 'dormant' | 'spawning';
  health: number;
  age: number;
  createdAt: string;
  lastActiveAt: string;
  organs: EntityOrgan[];
  traits: Record<string, number>;
  dtusCreated?: number;
  masteryLevel?: number;
  metadata?: Record<string, unknown>;
}

export interface EntityOrgan {
  id: number;
  name: string;
  maturity: number;       // 0.0 – 1.0
  active: boolean;
  lastFired?: string;
  errorCount: number;
}

export interface Species {
  id: string;
  name: string;
  description: string;
  baseTraits: Record<string, number>;
  organSet: string[];
  population: number;
}

export interface EntityRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface Pain {
  id: string;
  entityId: string;
  source: string;
  intensity: number;
  domain: string;
  recordedAt: string;
  processed: boolean;
  woundId?: string;
}

export interface Wound {
  id: string;
  entityId: string;
  source: string;
  severity: number;
  healedAt?: string;
  avoidanceRule?: string;
}
