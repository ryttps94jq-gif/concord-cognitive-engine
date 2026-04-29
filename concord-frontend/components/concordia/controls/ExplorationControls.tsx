'use client';

// Pure input handler for exploration mode — renders nothing, just wires
// keyboard/mouse to player and camera callbacks.

import { useCallback } from 'react';
import { useKeyboardInput } from '@/hooks/useKeyboardInput';
import { useMouseInput } from '@/hooks/useMouseInput';
import { modeManager } from '@/lib/concordia/mode-manager';

// ── Interaction target types ─────────────────────────────────────────

export type InteractionTarget =
  | { type: 'npc';               id: string; name: string }
  | { type: 'vehicle';           id: string }
  | { type: 'creation_terminal'; id: string }
  | { type: 'lens_portal';       id: string; lensId: string }
  | { type: 'item';              id: string; name: string }
  | { type: 'door' | 'switch';   id: string };

export interface ExplorationControlsProps {
  player: {
    moveForward: () => void;
    moveBack:    () => void;
    moveLeft:    () => void;
    moveRight:   () => void;
    jump:        () => void;
    startSprint: () => void;
    stopSprint:  () => void;
    crouch:      () => void;
    pickUp:      (targetId: string) => void;
  };
  camera: {
    rotate: (dx: number, dy: number) => void;
    zoom:   (delta: number) => void;
  };
  findInteractionTarget: () => InteractionTarget | null;
  onStartDialogue:  (npcId: string) => void;
  onEnterVehicle:   (vehicleId: string) => void;
  onOpenCreation:   (terminalId: string) => void;
  onOpenLens:       (lensId: string) => void;
  onMenuOpen:       () => void;
  enabled?:         boolean;
}

export function ExplorationControls({
  player,
  camera,
  findInteractionTarget,
  onStartDialogue,
  onEnterVehicle,
  onOpenCreation,
  onOpenLens,
  onMenuOpen,
  enabled = true,
}: ExplorationControlsProps) {

  const interact = useCallback(() => {
    const target = findInteractionTarget();
    if (!target) return;

    switch (target.type) {
      case 'npc':
        modeManager.switchTo('conversation', { push: true });
        onStartDialogue(target.id);
        break;
      case 'vehicle':
        modeManager.switchTo('driving', { push: true });
        onEnterVehicle(target.id);
        break;
      case 'creation_terminal':
        modeManager.switchTo('creation', { push: true });
        onOpenCreation(target.id);
        break;
      case 'lens_portal':
        modeManager.switchTo('lens_work', { push: true });
        onOpenLens(target.lensId);
        break;
      case 'item':
        player.pickUp(target.id);
        break;
      case 'door':
      case 'switch':
        // Activate handled by server-side event
        break;
    }
  }, [findInteractionTarget, onStartDialogue, onEnterVehicle, onOpenCreation, onOpenLens, player]);

  useKeyboardInput(
    {
      KeyW: player.moveForward,
      KeyS: player.moveBack,
      KeyA: player.moveLeft,
      KeyD: player.moveRight,
      Space: player.jump,
      ControlLeft: player.crouch,
      ShiftLeft: { onDown: player.startSprint, onUp: player.stopSprint },
      ShiftRight: { onDown: player.startSprint, onUp: player.stopSprint },
      KeyE: interact,
      Escape: onMenuOpen,
    },
    enabled,
  );

  useMouseInput(
    {
      onMove: (delta) => camera.rotate(delta.x, delta.y),
      onWheel: (delta) => camera.zoom(delta),
      enabled,
    },
  );

  return null;
}
