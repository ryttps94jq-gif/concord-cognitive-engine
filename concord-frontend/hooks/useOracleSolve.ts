/**
 * useOracleSolve — mutation hook that calls the Oracle Engine.
 *
 * POST /api/oracle/solve with { query, context } returns the full
 * rich Oracle response (answer, confidence, sources, computations,
 * connections, epistemic breakdown, phases, royalties, warnings).
 *
 * Consumers pass the result into the <OracleResponse> component.
 */

import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ──────────────────────────────────────────────
// Types — mirror the Oracle Engine contract
// ──────────────────────────────────────────────

export interface OracleComputation {
  module: string;
  result: string;
  proof?: string;
}

export interface OracleConnection {
  domain: string;
  insight: string;
}

export interface OracleEpistemicBreakdown {
  known: string[];
  probable: string[];
  uncertain: string[];
  unknown: string[];
}

export interface OraclePhaseStats {
  durationMs?: number;
  itemsProcessed?: number;
  confidence?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface OraclePhases {
  analysis?: OraclePhaseStats;
  knowledge?: OraclePhaseStats;
  computations?: OraclePhaseStats;
  connections?: OraclePhaseStats;
  synthesis?: OraclePhaseStats;
  validation?: OraclePhaseStats;
  [key: string]: OraclePhaseStats | undefined;
}

export interface OracleRoyalties {
  total: number;
  recipients: number;
}

export interface OracleResponseData {
  answer: string;
  confidence: number; // 0..1
  sources: string[]; // DTU IDs
  computations: OracleComputation[];
  connections: OracleConnection[];
  dtuId?: string;
  royalties?: OracleRoyalties;
  epistemicBreakdown?: OracleEpistemicBreakdown;
  warnings?: string[];
  phases?: OraclePhases;
}

export interface OracleSolveInput {
  query: string;
  context?: Record<string, unknown> | null;
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useOracleSolve(): UseMutationResult<
  OracleResponseData,
  Error,
  OracleSolveInput
> {
  return useMutation({
    mutationFn: async ({ query, context }: OracleSolveInput) => {
      const response = await api.post<OracleResponseData>('/api/oracle/solve', {
        query,
        context: context ?? {},
      });
      // Normalise defensively — backend may occasionally omit optional fields.
      const data = response.data || ({} as OracleResponseData);
      return {
        answer: data.answer ?? '',
        confidence: typeof data.confidence === 'number' ? data.confidence : 0,
        sources: Array.isArray(data.sources) ? data.sources : [],
        computations: Array.isArray(data.computations) ? data.computations : [],
        connections: Array.isArray(data.connections) ? data.connections : [],
        dtuId: data.dtuId,
        royalties: data.royalties,
        epistemicBreakdown: data.epistemicBreakdown,
        warnings: data.warnings,
        phases: data.phases,
      } as OracleResponseData;
    },
  });
}

export default useOracleSolve;
