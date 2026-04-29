// Central mode state machine for Concordia. Exported as a singleton so
// the game loop, components, and hooks all share the same instance.

import { InputMode } from './modes';
import { GameContext, inferMode } from './context-detection';

export interface ModeTransitionOptions {
  /** Push current mode onto the stack so pop() restores it. */
  push?: boolean;
  /** Record this as a player-initiated override (suppresses auto-switch). */
  manual?: boolean;
}

type ModeListener = (mode: InputMode, previous: InputMode) => void;

class ModeManager {
  private _current: InputMode = 'exploration';
  private _stack: InputMode[] = [];
  private _autoSwitchEnabled = true;
  private _manualOverrideUntil = 0;  // timestamp — auto-switch resumes after 3s
  private _listeners = new Set<ModeListener>();

  get mode(): InputMode {
    return this._current;
  }

  switchTo(next: InputMode, opts: ModeTransitionOptions = {}): void {
    if (next === this._current) return;

    if (opts.push) {
      this._stack.push(this._current);
    }

    const prev = this._current;
    this._current = next;

    if (opts.manual) {
      // Suppress auto-switch for 3 seconds after a manual override
      this._manualOverrideUntil = Date.now() + 3000;
    }

    this._notify(next, prev);
  }

  pop(): void {
    const prev = this._stack.pop();
    if (prev !== undefined) {
      this.switchTo(prev);
    }
  }

  setAutoSwitch(enabled: boolean): void {
    this._autoSwitchEnabled = enabled;
  }

  /** Called by context-detection at 10 Hz. Ignored if player recently
   *  manually overrode the mode. */
  suggestMode(ctx: GameContext): void {
    if (!this._autoSwitchEnabled) return;
    if (Date.now() < this._manualOverrideUntil) return;

    const suggested = inferMode(ctx);
    if (suggested !== this._current) {
      this.switchTo(suggested);
    }
  }

  subscribe(fn: ModeListener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(next: InputMode, prev: InputMode): void {
    for (const fn of this._listeners) fn(next, prev);
  }
}

export const modeManager = new ModeManager();
