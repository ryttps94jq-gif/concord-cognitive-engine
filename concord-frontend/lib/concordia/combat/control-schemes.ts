// Dynamic control scheme system.
//
// Controls are NOT static 1-9 hotbar slots. They're semantic action bindings
// that change based on what skill/weapon the player has active. Bare hands get
// UFC mechanics. Equip a gun, you get FPS bindings. Learn karate, you get a
// stance + strike scheme. A player physically cannot use the same keys to throw
// a hook as to pull a trigger — the scheme enforces that.

// ── Types ────────────────────────────────────────────────────────────────────

export interface ControlBinding {
  keys: string[];    // KeyboardEvent.code values
  label: string;     // Human-readable (e.g. "Left Jab")
  action: string;    // Internal action id (e.g. "punch_left")
  modifiers?: ('Shift' | 'Ctrl' | 'Alt')[];
  holdable?: boolean;
}

export interface ControlScheme {
  id: string;
  name: string;
  description: string;
  category: 'unarmed' | 'firearm' | 'melee_weapon' | 'martial_art' | 'magic' | 'stealth' | 'vehicle' | 'tool';
  /** Colour accent shown in the ControlLegend HUD */
  accentColor: string;
  bindings: ControlBinding[];
}

// ── Scheme definitions ────────────────────────────────────────────────────────

export const BARE_HANDS: ControlScheme = {
  id: 'bare_hands',
  name: 'UFC — Bare Hands',
  description: 'Classical street-fight & grapple mechanics. All you\'ve got is your body.',
  category: 'unarmed',
  accentColor: '#f97316',
  bindings: [
    { keys: ['KeyQ'],          label: 'Left Jab',       action: 'punch_left' },
    { keys: ['KeyE'],          label: 'Right Cross',    action: 'punch_right' },
    { keys: ['KeyQ', 'KeyE'],  label: 'Combo (Q→E)',    action: 'combo_1_2' },
    { keys: ['ShiftLeft', 'KeyQ'], label: 'Left Hook',  action: 'hook_left',  modifiers: ['Shift'] },
    { keys: ['ShiftLeft', 'KeyE'], label: 'Right Hook', action: 'hook_right', modifiers: ['Shift'] },
    { keys: ['KeyF'],          label: 'Uppercut',       action: 'uppercut' },
    { keys: ['KeyG'],          label: 'Clinch / Grab',  action: 'clinch' },
    { keys: ['KeyX'],          label: 'Takedown',       action: 'takedown' },
    { keys: ['Space'],         label: 'Dodge Roll',     action: 'dodge',      holdable: false },
    { keys: ['ShiftLeft'],     label: 'Block (hold)',   action: 'block',      holdable: true },
    { keys: ['KeyC'],          label: 'Duck / Weave',   action: 'duck' },
    { keys: ['KeyR'],          label: 'Recover stance', action: 'recover' },
  ],
};

export const BOXER: ControlScheme = {
  id: 'boxer',
  name: 'Boxing',
  description: 'Disciplined footwork, jab-cross-hook combinations, defensive head movement.',
  category: 'martial_art',
  accentColor: '#ef4444',
  bindings: [
    { keys: ['KeyQ'],          label: 'Jab',            action: 'jab' },
    { keys: ['KeyE'],          label: 'Cross',          action: 'cross' },
    { keys: ['KeyF'],          label: 'Left Hook',      action: 'hook_left' },
    { keys: ['KeyG'],          label: 'Right Hook',     action: 'hook_right' },
    { keys: ['KeyZ'],          label: 'Body Shot (L)',   action: 'body_left' },
    { keys: ['KeyX'],          label: 'Body Shot (R)',   action: 'body_right' },
    { keys: ['KeyC'],          label: 'Uppercut',       action: 'uppercut' },
    { keys: ['ShiftLeft'],     label: 'Guard (hold)',   action: 'guard',      holdable: true },
    { keys: ['Space'],         label: 'Slip / Bob',    action: 'slip' },
    { keys: ['KeyR'],          label: 'Footwork step',  action: 'step' },
  ],
};

export const KARATE: ControlScheme = {
  id: 'karate',
  name: 'Karate',
  description: 'Traditional stances, katas, and precision strikes. Form matters as much as power.',
  category: 'martial_art',
  accentColor: '#a855f7',
  bindings: [
    { keys: ['KeyQ'],          label: 'Gyaku-zuki (R punch)', action: 'gyaku_zuki' },
    { keys: ['KeyE'],          label: 'Oi-zuki (L punch)',    action: 'oi_zuki' },
    { keys: ['KeyF'],          label: 'Yoko-geri (side kick)',action: 'yoko_geri' },
    { keys: ['KeyG'],          label: 'Mae-geri (front kick)',action: 'mae_geri' },
    { keys: ['KeyZ'],          label: 'Ushiro-geri (back kick)',action:'ushiro_geri' },
    { keys: ['KeyX'],          label: 'Shuto-uchi (knife hand)',action:'shuto_uchi' },
    { keys: ['KeyT'],          label: 'Change stance',        action: 'stance_cycle' },
    { keys: ['ShiftLeft'],     label: 'Age-uke (block)',      action: 'uke',         holdable: true },
    { keys: ['Space'],         label: 'Tai-sabaki (pivot)',   action: 'tai_sabaki' },
    { keys: ['KeyV'],          label: 'Kata sequence',        action: 'kata_enter' },
  ],
};

export const FIREARM_PISTOL: ControlScheme = {
  id: 'firearm_pistol',
  name: 'Pistol',
  description: 'Aim down sights, fire, reload. Close-range; move between cover.',
  category: 'firearm',
  accentColor: '#64748b',
  bindings: [
    { keys: ['Mouse0'],        label: 'Fire',           action: 'fire' },
    { keys: ['Mouse1'],        label: 'Aim (hold)',     action: 'aim',         holdable: true },
    { keys: ['KeyR'],          label: 'Reload',         action: 'reload' },
    { keys: ['ControlLeft'],   label: 'Crouch (toggle)',action: 'crouch' },
    { keys: ['Space'],         label: 'Dodge / Cover',  action: 'dodge' },
    { keys: ['KeyF'],          label: 'Pistol whip',    action: 'melee_pistol' },
    { keys: ['KeyQ'],          label: 'Quick-peek L',   action: 'peek_left' },
    { keys: ['KeyE'],          label: 'Quick-peek R',   action: 'peek_right' },
    { keys: ['KeyG'],          label: 'Throw weapon',   action: 'throw' },
    { keys: ['KeyX'],          label: 'Drop / Swap',    action: 'drop_swap' },
  ],
};

export const FIREARM_RIFLE: ControlScheme = {
  id: 'firearm_rifle',
  name: 'Rifle',
  description: 'Long-range precision. Breath control, scope adjustment, burst fire.',
  category: 'firearm',
  accentColor: '#475569',
  bindings: [
    { keys: ['Mouse0'],        label: 'Fire',           action: 'fire' },
    { keys: ['Mouse1'],        label: 'Scope (hold)',   action: 'scope',       holdable: true },
    { keys: ['KeyR'],          label: 'Reload',         action: 'reload' },
    { keys: ['ControlLeft'],   label: 'Prone / Crouch', action: 'prone_toggle' },
    { keys: ['ShiftLeft'],     label: 'Hold breath',    action: 'hold_breath', holdable: true },
    { keys: ['KeyB'],          label: 'Fire mode (burst/semi)',action:'fire_mode' },
    { keys: ['KeyG'],          label: 'Grenade',        action: 'grenade' },
    { keys: ['Space'],         label: 'Vault / Jump',   action: 'vault' },
    { keys: ['KeyF'],          label: 'Bayonet stab',   action: 'bayonet' },
  ],
};

export const BLADE: ControlScheme = {
  id: 'blade',
  name: 'Blade',
  description: 'Sword, knife, or any edged weapon. Light attack, heavy attack, parry windows.',
  category: 'melee_weapon',
  accentColor: '#94a3b8',
  bindings: [
    { keys: ['Mouse0'],        label: 'Light Attack',   action: 'light_attack' },
    { keys: ['ShiftLeft', 'Mouse0'], label: 'Heavy Attack', action: 'heavy_attack', modifiers: ['Shift'] },
    { keys: ['Mouse1'],        label: 'Block / Parry (hold)',action:'parry',        holdable: true },
    { keys: ['Space'],         label: 'Dodge / Roll',   action: 'dodge' },
    { keys: ['KeyF'],          label: 'Stab (thrust)',  action: 'thrust' },
    { keys: ['KeyG'],          label: 'Riposte',        action: 'riposte' },
    { keys: ['KeyQ'],          label: 'Disarm attempt', action: 'disarm' },
    { keys: ['KeyR'],          label: 'Sheathe / Ready',action: 'sheathe' },
  ],
};

export const MAGIC_CHANNEL: ControlScheme = {
  id: 'magic_channel',
  name: 'Magic / Channel',
  description: 'Channel energy, release a cast, sustain a ward. Power scales with hold time.',
  category: 'magic',
  accentColor: '#06b6d4',
  bindings: [
    { keys: ['Mouse0'],        label: 'Channel + Release',action:'channel_fire',  holdable: true },
    { keys: ['Mouse1'],        label: 'Alt-cast',       action: 'alt_cast' },
    { keys: ['KeyQ'],          label: 'Ward (hold)',    action: 'ward',           holdable: true },
    { keys: ['KeyE'],          label: 'Teleport blink', action: 'blink' },
    { keys: ['KeyF'],          label: 'Area burst',     action: 'area_burst' },
    { keys: ['KeyG'],          label: 'Summon',         action: 'summon' },
    { keys: ['ShiftLeft'],     label: 'Focus (slow + power)',action:'focus',      holdable: true },
    { keys: ['Space'],         label: 'Phase step',     action: 'phase_step' },
    { keys: ['KeyR'],          label: 'Refresh mana',   action: 'meditate' },
  ],
};

export const STEALTH: ControlScheme = {
  id: 'stealth',
  name: 'Stealth',
  description: 'Silent movement, backstab, environmental awareness. Noise matters.',
  category: 'stealth',
  accentColor: '#1e293b',
  bindings: [
    { keys: ['ControlLeft'],   label: 'Crouch / Sneak (toggle)',action:'sneak' },
    { keys: ['ShiftLeft'],     label: 'Sprint (noise!)',  action: 'sprint',       holdable: true },
    { keys: ['Mouse0'],        label: 'Backstab',        action: 'backstab' },
    { keys: ['KeyF'],          label: 'Takedown (silent)',action:'takedown_silent' },
    { keys: ['KeyQ'],          label: 'Distraction throw',action:'distract' },
    { keys: ['KeyE'],          label: 'Peek corner',     action: 'peek' },
    { keys: ['KeyG'],          label: 'Plant device',    action: 'plant' },
    { keys: ['Space'],         label: 'Roll (silent)',   action: 'silent_roll' },
    { keys: ['KeyT'],          label: 'Tag enemy',       action: 'tag' },
  ],
};

// ── Registry ─────────────────────────────────────────────────────────────────

const _schemes = new Map<string, ControlScheme>([
  ['bare_hands',       BARE_HANDS],
  ['boxer',            BOXER],
  ['karate',           KARATE],
  ['firearm_pistol',   FIREARM_PISTOL],
  ['firearm_rifle',    FIREARM_RIFLE],
  ['blade',            BLADE],
  ['magic_channel',    MAGIC_CHANNEL],
  ['stealth',          STEALTH],
]);

export function registerControlScheme(scheme: ControlScheme): void {
  _schemes.set(scheme.id, scheme);
}

export function getControlScheme(id: string): ControlScheme {
  return _schemes.get(id) ?? BARE_HANDS;
}

export function getAllControlSchemes(): ControlScheme[] {
  return Array.from(_schemes.values());
}

// ── Inference ─────────────────────────────────────────────────────────────────
// Given a skill (or null = bare hands), pick the best control scheme.

import type { CombatSkill } from './hotbar';

export function inferControlScheme(skill: CombatSkill | null): ControlScheme {
  if (!skill) return BARE_HANDS;

  // Explicit override set during skill creation
  const explicit = (skill as CombatSkill & { controlScheme?: string }).controlScheme;
  if (explicit && _schemes.has(explicit)) return _schemes.get(explicit)!;

  // Infer from range
  if (skill.range === 'long' || skill.range === 'mid') return FIREARM_RIFLE;
  if (skill.range === 'close') return FIREARM_PISTOL;

  // Infer from animation clip name
  const clip = skill.animationClip.toLowerCase();
  if (clip.includes('shoot') || clip.includes('gun') || clip.includes('fire')) return FIREARM_PISTOL;
  if (clip.includes('snipe') || clip.includes('rifle')) return FIREARM_RIFLE;
  if (clip.includes('blade') || clip.includes('sword') || clip.includes('knife')) return BLADE;
  if (clip.includes('magic') || clip.includes('spell') || clip.includes('cast')) return MAGIC_CHANNEL;
  if (clip.includes('stealth') || clip.includes('sneak') || clip.includes('backstab')) return STEALTH;
  if (clip.includes('karate') || clip.includes('kata') || clip.includes('geri') || clip.includes('zuki')) return KARATE;
  if (clip.includes('box') || clip.includes('jab') || clip.includes('hook')) return BOXER;

  // Infer from skill name
  const name = skill.name.toLowerCase();
  if (name.includes('karate') || name.includes('judo') || name.includes('taekwondo')) return KARATE;
  if (name.includes('box') || name.includes('boxing')) return BOXER;
  if (name.includes('gun') || name.includes('shoot') || name.includes('pistol')) return FIREARM_PISTOL;
  if (name.includes('rifle') || name.includes('snipe')) return FIREARM_RIFLE;
  if (name.includes('sword') || name.includes('blade') || name.includes('knife')) return BLADE;
  if (name.includes('magic') || name.includes('spell') || name.includes('mana')) return MAGIC_CHANNEL;
  if (name.includes('stealth') || name.includes('shadow')) return STEALTH;

  return BARE_HANDS;
}
