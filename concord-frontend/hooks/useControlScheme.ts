'use client';

import { useMemo } from 'react';
import { inferControlScheme, getControlScheme, type ControlScheme } from '@/lib/concordia/combat/control-schemes';
import type { HotbarState } from '@/lib/concordia/combat/hotbar';

/**
 * Returns the active ControlScheme based on the currently equipped skill slot.
 * When the player equips a different weapon or skill type, the scheme — and thus
 * all keyboard bindings — switches automatically.
 *
 * Pass `schemeOverride` to force a specific scheme (e.g. from a game mode).
 */
export function useControlScheme(
  hotbar: HotbarState,
  schemeOverride?: string,
): ControlScheme {
  return useMemo(() => {
    if (schemeOverride) return getControlScheme(schemeOverride);
    const activeSkill = hotbar.slots[hotbar.activeSlot] ?? null;
    return inferControlScheme(activeSkill);
  }, [hotbar, schemeOverride]);
}
