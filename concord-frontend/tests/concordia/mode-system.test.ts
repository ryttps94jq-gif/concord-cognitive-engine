import { describe, it, expect, beforeEach, vi } from 'vitest';
import { modeManager } from '@/lib/concordia/mode-manager';
import { buildContext, inferMode, _resetThrottle } from '@/lib/concordia/context-detection';
import { INPUT_MODES } from '@/lib/concordia/modes';

describe('Input mode system', () => {
  beforeEach(() => {
    // Reset modeManager to exploration between tests
    modeManager.setAutoSwitch(true);
    modeManager.switchTo('exploration');
    _resetThrottle();
  });

  it('defines all 8 modes', () => {
    const keys = Object.keys(INPUT_MODES);
    expect(keys).toEqual(expect.arrayContaining([
      'exploration', 'combat', 'driving', 'conversation',
      'creation', 'lens_work', 'social', 'spectator',
    ]));
  });

  it('switches mode on suggestMode call', () => {
    expect(modeManager.mode).toBe('exploration');
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], false, 'open', 1, null);
    modeManager.suggestMode(ctx);
    expect(modeManager.mode).toBe('combat');
  });

  it('manual override suppresses auto-switch for 3s', () => {
    vi.useFakeTimers();
    modeManager.switchTo('combat', { manual: true });
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], false, 'open', 0, null);
    modeManager.suggestMode(ctx);
    expect(modeManager.mode).toBe('combat');  // still combat — manual override active
    vi.advanceTimersByTime(3100);
    modeManager.suggestMode(ctx);
    expect(modeManager.mode).toBe('exploration');  // override expired
    vi.useRealTimers();
  });

  it('mode stack pops correctly', () => {
    modeManager.switchTo('combat', { push: true });
    expect(modeManager.mode).toBe('combat');
    modeManager.pop();
    expect(modeManager.mode).toBe('exploration');
  });

  it('nested push/pop preserves original mode', () => {
    modeManager.switchTo('combat', { push: true });
    modeManager.switchTo('conversation', { push: true });
    expect(modeManager.mode).toBe('conversation');
    modeManager.pop();
    expect(modeManager.mode).toBe('combat');
    modeManager.pop();
    expect(modeManager.mode).toBe('exploration');
  });

  it('setAutoSwitch(false) prevents mode suggestions', () => {
    modeManager.setAutoSwitch(false);
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], false, 'open', 5, null);
    modeManager.suggestMode(ctx);
    expect(modeManager.mode).toBe('exploration');
  });

  it('subscribe fires on mode change', () => {
    const spy = vi.fn();
    const unsub = modeManager.subscribe(spy);
    modeManager.switchTo('driving');
    expect(spy).toHaveBeenCalledWith('driving', 'exploration');
    unsub();
    modeManager.switchTo('combat');
    expect(spy).toHaveBeenCalledTimes(1);  // unsubscribed
  });
});

describe('inferMode', () => {
  it('returns combat when activeHostiles > 0', () => {
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], false, 'open', 2, null);
    expect(inferMode(ctx)).toBe('combat');
  });

  it('returns driving when inVehicle', () => {
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], true, 'open', 0, null);
    expect(inferMode(ctx)).toBe('driving');
  });

  it('returns conversation when npcEngaged', () => {
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], false, 'open', 0, 'npc-1');
    expect(inferMode(ctx)).toBe('conversation');
  });

  it('returns creation when inCreationZone', () => {
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], false, 'creation', 0, null);
    expect(inferMode(ctx)).toBe('creation');
  });

  it('returns lens_work when inLensWorkspace', () => {
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], false, 'lens', 0, null);
    expect(inferMode(ctx)).toBe('lens_work');
  });

  it('returns exploration by default', () => {
    const ctx = buildContext({ x: 0, y: 0, z: 0 }, [], false, 'open', 0, null);
    expect(inferMode(ctx)).toBe('exploration');
  });
});
