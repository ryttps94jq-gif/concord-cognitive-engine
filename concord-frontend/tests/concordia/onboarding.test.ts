import { describe, it, expect, beforeEach } from 'vitest';
import { TutorialManager } from '@/lib/concordia/onboarding/tutorial';

describe('TutorialManager', () => {
  let mgr: TutorialManager;

  beforeEach(() => {
    // Fresh instance each test — bypasses localStorage
    mgr = new TutorialManager();
  });

  it('starts at movement-basic step', () => {
    expect(mgr.state.step).toBe('movement-basic');
  });

  it('advances on correct player action', () => {
    mgr.advance('moved-significant-distance');
    expect(mgr.state.step).toBe('camera-control');
  });

  it('does not advance on wrong action', () => {
    mgr.advance('rotated-camera');  // wrong action for current step
    expect(mgr.state.step).toBe('movement-basic');
  });

  it('records completed steps', () => {
    mgr.advance('moved-significant-distance');
    expect(mgr.state.stepsCompleted).toContain('movement-basic');
  });

  it('skip marks tutorial as done', () => {
    mgr.skip();
    expect(mgr.isDone).toBe(true);
  });

  it('advancing after skip is a no-op', () => {
    mgr.skip();
    mgr.advance('moved-significant-distance');
    expect(mgr.state.step).toBe('movement-basic');
  });

  it('fires hint callback on start', () => {
    const hints: unknown[] = [];
    mgr.onHint(h => hints.push(h));
    mgr.start();
    expect(hints).toHaveLength(1);
    expect(hints[0]).not.toBeNull();
  });

  it('fires null hint callback on skip', () => {
    const hints: unknown[] = [];
    mgr.onHint(h => hints.push(h));
    mgr.skip();
    expect(hints[hints.length - 1]).toBeNull();
  });

  it('progresses through all steps', () => {
    const actions = [
      'moved-significant-distance',
      'rotated-camera',
      'sprinted',
      'near-npc',
      'completed-dialogue',
      'placed-object',
      'entered-combat',
      'used-hotbar-skill',
      'entered-lens-portal',
      'sent-quick-message',
    ] as const;
    for (const action of actions) {
      mgr.advance(action);
    }
    expect(mgr.state.step).toBe('done');
    expect(mgr.isDone).toBe(true);
  });
});
