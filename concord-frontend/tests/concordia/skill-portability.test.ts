import { describe, it, expect } from 'vitest';
import {
  computeEffectivenessPreview,
  getResistanceForWorld,
} from '@/lib/concordia/skill-portability';

describe('Skill portability — effectiveness preview', () => {
  it('hacking is blocked in war-zone', () => {
    const r = computeEffectivenessPreview(1000, getResistanceForWorld('war-zone', 'magic'));
    expect(r.effectiveness).toBe(0);
  });

  it('combat skill is functional from level 5 in war-zone', () => {
    const resistance = getResistanceForWorld('war-zone', 'combat');
    const r = computeEffectivenessPreview(5, resistance);
    expect(r.effectiveness).toBeGreaterThan(0);
    expect(r.status).not.toBe('below_threshold');
  });

  it('effectiveness increases with skill level', () => {
    const resistance = getResistanceForWorld('fable-world', 'magic');
    const low  = computeEffectivenessPreview(5,  resistance);
    const mid  = computeEffectivenessPreview(50, resistance);
    const high = computeEffectivenessPreview(200, resistance);
    expect(mid.effectiveness).toBeGreaterThan(low.effectiveness);
    expect(high.effectiveness).toBeGreaterThan(mid.effectiveness);
  });

  it('permissive default for unknown world/type', () => {
    const r = computeEffectivenessPreview(5, getResistanceForWorld('unknown-world', 'mystery'));
    expect(r.effectiveness).toBeGreaterThan(0);
  });

  it('effectiveness is always between 0 and 1', () => {
    for (const level of [1, 10, 100, 1000, 10000]) {
      const r = computeEffectivenessPreview(level, { threshold: 10, scaling: 1.0 });
      expect(r.effectiveness).toBeGreaterThanOrEqual(0);
      expect(r.effectiveness).toBeLessThanOrEqual(1);
    }
  });
});
