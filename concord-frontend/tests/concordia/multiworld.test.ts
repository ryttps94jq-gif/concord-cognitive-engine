import { describe, it, expect } from 'vitest';
import { computeEffectivenessPreview, getResistanceForWorld, WORLD_RESISTANCE_MAP } from '@/lib/concordia/skill-portability';

describe('World substrate', () => {
  it('has 6 canonical worlds configured', () => {
    const ids = Object.keys(WORLD_RESISTANCE_MAP);
    expect(ids).toContain('concordia-hub');
    expect(ids).toContain('fable-world');
    expect(ids).toContain('superhero-world');
    expect(ids).toContain('wasteland-world');
    expect(ids).toContain('crime-city');
    expect(ids).toContain('war-zone');
  });

  it('concordia-hub has no skill restrictions', () => {
    const resistance = getResistanceForWorld('concordia-hub', 'hacking');
    expect(resistance.threshold).toBe(1);
    expect(resistance.scaling).toBe(1.0);
  });

  it('fable-world blocks technology skills entirely', () => {
    const resistance = getResistanceForWorld('fable-world', 'technology');
    expect(resistance.threshold).toBeGreaterThan(9000);
  });

  it('fable-world amplifies magic skills', () => {
    const magic  = getResistanceForWorld('fable-world', 'magic');
    expect(magic.threshold).toBeLessThan(10);
    expect(magic.scaling).toBeGreaterThan(1);
  });
});

describe('Skill effectiveness curves', () => {
  it('returns 0 effectiveness below world threshold', () => {
    const result = computeEffectivenessPreview(10, { threshold: 20, scaling: 1.0 });
    expect(result.effectiveness).toBe(0);
    expect(result.status).toBe('below_threshold');
  });

  it('returns ~50% at exactly the threshold', () => {
    const result = computeEffectivenessPreview(20, { threshold: 20, scaling: 1.0 });
    expect(result.effectiveness).toBeCloseTo(0.5, 1);
    expect(result.status).toBe('functional');
  });

  it('returns >90% at high level relative to threshold', () => {
    const result = computeEffectivenessPreview(200, { threshold: 20, scaling: 1.0 });
    expect(result.effectiveness).toBeGreaterThan(0.9);
    expect(result.status).toBe('mastered');
  });

  it('returns 0 for a skill that can never function (scaling=0)', () => {
    // threshold = 999999, scaling = 0
    const result = computeEffectivenessPreview(1000, { threshold: 999999, scaling: 0 });
    expect(result.effectiveness).toBe(0);
    expect(result.status).toBe('below_threshold');
  });

  it('physics modulators do not affect level 1 in concordia-hub', () => {
    const result = computeEffectivenessPreview(1, { threshold: 1, scaling: 1.0 });
    expect(result.effectiveness).toBeCloseTo(0.5, 1);
  });
});
