// Concordia input mode definitions — every activity has a mode-appropriate
// control surface and UI overlay. Mode auto-switches on context change;
// player can manually override at any time.

export const INPUT_MODES = {
  exploration: {
    name: 'exploration',
    description: 'Free movement through the world',
    inputs: ['movement', 'camera', 'interact', 'menu'],
    uiOverlay: 'minimal',
    pace: 'real-time',
  },
  combat: {
    name: 'combat',
    description: 'Real-time combat with hotbar and targeting',
    inputs: ['movement', 'camera', 'attack', 'dodge', 'block', 'hotbar', 'target_lock', 'vats'],
    uiOverlay: 'combat-hud',
    pace: 'fast',
  },
  driving: {
    name: 'driving',
    description: 'Vehicle operation with physics-validated controls',
    inputs: ['steering', 'throttle', 'brake', 'gear', 'horn', 'camera'],
    uiOverlay: 'vehicle-hud',
    pace: 'real-time',
  },
  conversation: {
    name: 'conversation',
    description: 'NPC dialogue with substrate-grounded responses',
    inputs: ['text', 'voice', 'dialogue_options', 'gesture', 'skill_check'],
    uiOverlay: 'dialogue-panel',
    pace: 'turn-based',
  },
  creation: {
    name: 'creation',
    description: 'Build and design with validation pipeline',
    inputs: ['tools', 'material_library', 'text_spec', 'voice_spec', 'preview', 'validate'],
    uiOverlay: 'creation-workshop',
    pace: 'deliberate',
  },
  lens_work: {
    name: 'lens_work',
    description: 'Deep substrate engagement within Concordia',
    inputs: ['text', 'voice', 'dtu_browse', 'cite', 'create_dtu'],
    uiOverlay: 'lens-panel',
    pace: 'deep',
  },
  social: {
    name: 'social',
    description: 'Multiplayer interaction with other players',
    inputs: ['quick_message', 'emote', 'gesture', 'voice_chat', 'trade'],
    uiOverlay: 'social-bar',
    pace: 'mixed',
  },
  spectator: {
    name: 'spectator',
    description: 'Free camera observation without character control',
    inputs: ['camera', 'follow_player', 'time_scrub'],
    uiOverlay: 'spectator-controls',
    pace: 'flexible',
  },
} as const;

export type InputMode = keyof typeof INPUT_MODES;

// Maps InputMode to the legacy HUDMode used by HUDOverlay.tsx.
// HUDOverlay will be extended to support all modes, but we keep this
// bridge so existing code keeps compiling during the migration.
export const MODE_TO_HUD: Record<InputMode, string> = {
  exploration: 'explore',
  combat: 'combat',
  driving: 'explore',
  conversation: 'social',
  creation: 'build',
  lens_work: 'inspect',
  social: 'social',
  spectator: 'explore',
};
