'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  gameModeOrchestrator,
  startGameMode,
  type OrchestratorState,
} from '@/lib/concordia/game-mode-orchestrator';

export function useGameMode() {
  const [state, setState] = useState<OrchestratorState>(() => gameModeOrchestrator.state);

  useEffect(() => {
    return gameModeOrchestrator.subscribe(setState);
  }, []);

  const start = useCallback((modeId: string) => startGameMode(modeId), []);
  const advance = useCallback(() => gameModeOrchestrator.advance(), []);
  const abort = useCallback(() => gameModeOrchestrator.abort(), []);
  const setScore = useCallback((key: string, value: number) => {
    gameModeOrchestrator.setScore(key, value);
  }, []);

  return {
    active: state.active,
    stage: state.stage,
    stageIndex: state.stageIndex,
    activeLensId: state.activeLensId,
    cyclingLensIndex: state.cyclingLensIndex,
    progress: state.progress,
    start,
    advance,
    abort,
    setScore,
  };
}
