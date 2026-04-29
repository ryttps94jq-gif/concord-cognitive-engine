// Game Mode Orchestrator — sits above modeManager, sequences stages + auto-cycles lenses.
// Stages define which inputMode to push, which lens (or lens sequence) to show, and
// what event/score/time condition advances to the next stage.

import type { InputMode } from './modes';
import { modeManager } from './mode-manager';
import { onEvent, emitEvent } from '@/lib/realtime/event-bus';

// ── Types ────────────────────────────────────────────────────────────────────

export type AdvanceTrigger =
  | { type: 'event';  event: string }
  | { type: 'score';  min: number; scoreKey: string }
  | { type: 'time';   ms: number }
  | { type: 'action'; action: string }
  | { type: 'any';    triggers: AdvanceTrigger[] };

export interface GameModeStage {
  id: string;
  name: string;
  description: string;
  inputMode: InputMode;
  lensId?: string;
  lensSequence?: string[];
  lensDwellMs?: number;
  advanceWhen: AdvanceTrigger;
  onEnter?: () => void;
  onExit?: () => void;
}

export interface GameMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  stages: GameModeStage[];
  onComplete?: () => void;
}

export interface OrchestratorState {
  active: GameMode | null;
  stageIndex: number;
  stage: GameModeStage | null;
  activeLensId: string | null;
  cyclingLensIndex: number;
  progress: number; // 0–1
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

class GameModeOrchestrator {
  private _active: GameMode | null = null;
  private _stageIndex = 0;
  private _cycleIndex = 0;
  private _cycleTimer: ReturnType<typeof setInterval> | null = null;
  private _advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private _eventUnsubs: Array<() => void> = [];
  private _listeners = new Set<(state: OrchestratorState) => void>();
  private _scores: Record<string, number> = {};

  // ── Public state ──────────────────────────────────────────────────────────

  get state(): OrchestratorState {
    const stage = this._active ? this._active.stages[this._stageIndex] ?? null : null;
    const lensSeq = stage?.lensSequence;
    const activeLensId = lensSeq
      ? lensSeq[this._cycleIndex % lensSeq.length]
      : (stage?.lensId ?? null);
    return {
      active: this._active,
      stageIndex: this._stageIndex,
      stage,
      activeLensId,
      cyclingLensIndex: this._cycleIndex,
      progress: this._active
        ? this._stageIndex / this._active.stages.length
        : 0,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(mode: GameMode): void {
    if (this._active) this._cleanup();
    this._active = mode;
    this._stageIndex = 0;
    this._cycleIndex = 0;
    this._enterStage();
    this._notify();
  }

  advance(): void {
    if (!this._active) return;
    const next = this._stageIndex + 1;
    if (next >= this._active.stages.length) {
      this._complete();
    } else {
      this._exitStage();
      this._stageIndex = next;
      this._cycleIndex = 0;
      this._enterStage();
      this._notify();
    }
  }

  abort(): void {
    this._cleanup();
    this._active = null;
    this._notify();
  }

  /** Called by game mode stages that use score-based advance triggers. */
  setScore(key: string, value: number): void {
    this._scores[key] = value;
    this._checkScoreTrigger();
  }

  subscribe(fn: (state: OrchestratorState) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _enterStage(): void {
    const stage = this._active!.stages[this._stageIndex];
    if (!stage) return;

    stage.onEnter?.();
    modeManager.switchTo(stage.inputMode, { push: true });

    // Start lens cycling if stage has a sequence
    if (stage.lensSequence && stage.lensSequence.length > 1) {
      const dwell = stage.lensDwellMs ?? 8000;
      this._cycleTimer = setInterval(() => {
        this._cycleIndex++;
        this._notify();
      }, dwell);
    }

    // Wire advance trigger
    this._wireAdvanceTrigger(stage.advanceWhen);
  }

  private _exitStage(): void {
    const stage = this._active?.stages[this._stageIndex];
    stage?.onExit?.();
    this._clearTimers();
    this._clearEventSubs();
    modeManager.pop();
  }

  private _complete(): void {
    this._exitStage();
    this._active?.onComplete?.();
    emitEvent('game-mode:completed', { modeId: this._active?.id });
    this._active = null;
    this._notify();
  }

  private _wireAdvanceTrigger(trigger: AdvanceTrigger): void {
    if (trigger.type === 'event') {
      const unsub = onEvent(trigger.event, () => this.advance());
      this._eventUnsubs.push(unsub);
    } else if (trigger.type === 'time') {
      this._advanceTimer = setTimeout(() => this.advance(), trigger.ms);
    } else if (trigger.type === 'any') {
      trigger.triggers.forEach(t => this._wireAdvanceTrigger(t));
    } else if (trigger.type === 'score') {
      // Score advances are checked in setScore()
    }
    // 'action' triggers are fired externally via advance()
  }

  private _checkScoreTrigger(): void {
    const stage = this._active?.stages[this._stageIndex];
    if (!stage) return;
    const trigger = stage.advanceWhen;
    const checkOne = (t: AdvanceTrigger) => {
      if (t.type === 'score') {
        return (this._scores[t.scoreKey] ?? 0) >= t.min;
      }
      if (t.type === 'any') return t.triggers.some(checkOne);
      return false;
    };
    if (checkOne(trigger)) this.advance();
  }

  private _cleanup(): void {
    this._exitStage();
    this._active = null;
  }

  private _clearTimers(): void {
    if (this._cycleTimer) { clearInterval(this._cycleTimer); this._cycleTimer = null; }
    if (this._advanceTimer) { clearTimeout(this._advanceTimer); this._advanceTimer = null; }
  }

  private _clearEventSubs(): void {
    this._eventUnsubs.forEach(u => u());
    this._eventUnsubs = [];
  }

  private _notify(): void {
    const state = this.state;
    for (const fn of this._listeners) fn(state);
  }
}

export const gameModeOrchestrator = new GameModeOrchestrator();

// ── Registry ─────────────────────────────────────────────────────────────────

const _registry = new Map<string, GameMode>();

export function registerGameMode(mode: GameMode): void {
  _registry.set(mode.id, mode);
}

export function getGameMode(id: string): GameMode | undefined {
  return _registry.get(id);
}

export function getAllGameModes(): GameMode[] {
  return Array.from(_registry.values());
}

export function startGameMode(id: string): boolean {
  const mode = _registry.get(id);
  if (!mode) return false;
  gameModeOrchestrator.start(mode);
  return true;
}
