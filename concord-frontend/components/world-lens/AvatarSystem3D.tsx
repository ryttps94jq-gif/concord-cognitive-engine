'use client';

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────

type AvatarAnimation = 'idle' | 'walk' | 'run' | 'sit' | 'build' | 'inspect' | 'wave' | 'clap' | 'point' | 'celebrate' | 'craft';
type NPCAnimation = 'hammer' | 'read' | 'tend-crops' | 'patrol' | 'count-coins' | 'construct' | 'sweep' | 'lecture';

interface AvatarAppearance {
  skinColor: string;
  hairStyle: string;
  hairColor: string;
  clothing: string;
  professionBadge?: string;
  firmEmblem?: string;
}

interface AvatarState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  animation: AvatarAnimation;
  appearance: AvatarAppearance;
  displayName: string;
  isRunning: boolean;
}

interface NPCState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  animation: NPCAnimation | AvatarAnimation;
  displayName: string;
  occupation: string;
  appearance: AvatarAppearance;
}

interface CharacterControllerConfig {
  moveSpeed: number;
  runSpeed: number;
  jumpHeight: number;
  slopeLimit: number;
  stepHeight: number;
  smoothRotation: number;
}

interface AvatarSystem3DProps {
  playerAvatar?: AvatarState;
  otherPlayers?: AvatarState[];
  npcs?: NPCState[];
  onMove?: (position: { x: number; y: number; z: number }, rotation: number) => void;
  onEmote?: (emote: AvatarAnimation) => void;
  controllerConfig?: Partial<CharacterControllerConfig>;
}

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_CONTROLLER: CharacterControllerConfig = {
  moveSpeed: 4.0,
  runSpeed: 8.0,
  jumpHeight: 1.0,
  slopeLimit: 45,
  stepHeight: 0.3,
  smoothRotation: 0.15,
};

const AVATAR_LOD = {
  full: 50,        // Full detail within 50m
  simplified: 100, // Simplified 50-100m
  nameTagOnly: 200, // Just floating name 100-200m
};

const MAX_ANIMATED_AVATARS = 50;

const ANIMATION_TRANSITIONS: Record<string, { blendDuration: number }> = {
  'idle->walk': { blendDuration: 0.2 },
  'walk->run': { blendDuration: 0.15 },
  'run->walk': { blendDuration: 0.2 },
  'walk->idle': { blendDuration: 0.3 },
  'idle->build': { blendDuration: 0.25 },
  'idle->wave': { blendDuration: 0.2 },
  'idle->sit': { blendDuration: 0.4 },
  '*->idle': { blendDuration: 0.3 },
};

const NPC_OCCUPATION_ANIMATIONS: Record<string, NPCAnimation> = {
  blacksmith: 'hammer',
  scholar: 'read',
  farmer: 'tend-crops',
  guard: 'patrol',
  trader: 'count-coins',
  builder: 'construct',
  janitor: 'sweep',
  professor: 'lecture',
};

// ── Seed Data ──────────────────────────────────────────────────────

const SEED_PLAYER: AvatarState = {
  id: 'player-self', position: { x: 100, y: 20, z: 75 }, rotation: 0, animation: 'idle', isRunning: false,
  displayName: 'You', appearance: { skinColor: '#d4a574', hairStyle: 'short', hairColor: '#3d2b1f', clothing: 'architect-vest' },
};

const SEED_OTHERS: AvatarState[] = [
  { id: 'p2', position: { x: 105, y: 20, z: 80 }, rotation: 45, animation: 'walk', isRunning: false, displayName: '@engineer_jane', appearance: { skinColor: '#f5d0a9', hairStyle: 'ponytail', hairColor: '#8b4513', clothing: 'engineer-coat', professionBadge: 'structural' } },
  { id: 'p3', position: { x: 98, y: 20, z: 70 }, rotation: 180, animation: 'build', isRunning: false, displayName: '@builder_bob', appearance: { skinColor: '#8d5524', hairStyle: 'buzz', hairColor: '#1a1a1a', clothing: 'work-overalls', firmEmblem: 'iron-forge-co' } },
];

const SEED_NPCS: NPCState[] = [
  { id: 'npc-1', position: { x: 110, y: 20, z: 85 }, rotation: 270, animation: 'hammer', displayName: 'Marcus the Smith', occupation: 'blacksmith', appearance: { skinColor: '#c68642', hairStyle: 'bald', hairColor: '#000', clothing: 'forge-apron' } },
  { id: 'npc-2', position: { x: 115, y: 40, z: 60 }, rotation: 90, animation: 'read', displayName: 'Dr. Chen', occupation: 'scholar', appearance: { skinColor: '#f5d0a9', hairStyle: 'long', hairColor: '#1a1a1a', clothing: 'academic-robe' } },
  { id: 'npc-3', position: { x: 90, y: 20, z: 78 }, rotation: 0, animation: 'patrol', displayName: 'Officer Reyes', occupation: 'guard', appearance: { skinColor: '#a0522d', hairStyle: 'short', hairColor: '#2f1b0e', clothing: 'guard-uniform' } },
];

// ── Component ──────────────────────────────────────────────────────

export default function AvatarSystem3D({
  playerAvatar = SEED_PLAYER,
  otherPlayers = SEED_OTHERS,
  npcs = SEED_NPCS,
  onMove,
  onEmote,
  controllerConfig,
}: AvatarSystem3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<AvatarAnimation>(playerAvatar.animation);

  const config = useMemo(() => ({ ...DEFAULT_CONTROLLER, ...controllerConfig }), [controllerConfig]);

  // Input state tracking
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      // Emote keys
      if (e.key === '1') onEmote?.('wave');
      if (e.key === '2') onEmote?.('clap');
      if (e.key === '3') onEmote?.('point');
      if (e.key === '4') onEmote?.('celebrate');
      if (e.key === '5') onEmote?.('sit');
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [onEmote]);

  // Initialize Three.js avatar system
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    const init = async () => {
      try {
        const THREE = await import('three');
        if (disposed) return;

        // Avatar mesh generation (procedural)
        const createAvatarMesh = (appearance: AvatarAppearance, name: string) => {
          const group = new THREE.Group();
          group.name = `avatar-${name}`;

          // Body (capsule approximation)
          const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 1.2, 8);
          const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.clothing === 'work-overalls' ? '#4a4a6a' : '#3a5a8a') });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.y = 0.9;
          group.add(body);

          // Head
          const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
          const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.skinColor) });
          const head = new THREE.Mesh(headGeo, headMat);
          head.position.y = 1.7;
          group.add(head);

          // Hair
          if (appearance.hairStyle !== 'bald') {
            const hairGeo = new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.6);
            const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hairColor) });
            const hair = new THREE.Mesh(hairGeo, hairMat);
            hair.position.y = 1.78;
            group.add(hair);
          }

          return group;
        };

        // Character controller state
        const playerMesh = createAvatarMesh(playerAvatar.appearance, playerAvatar.displayName);
        playerMesh.position.set(playerAvatar.position.x, playerAvatar.position.y, playerAvatar.position.z);

        // Animation simulation (bob for walk/run)
        let animFrame = 0;
        const animSpeed = { idle: 0.02, walk: 0.08, run: 0.15 };

        const update = (deltaTime: number) => {
          if (disposed) return;
          const keys = keysRef.current;
          const isRunning = keys.has('shift');
          const speed = isRunning ? config.runSpeed : config.moveSpeed;

          let dx = 0, dz = 0;
          if (keys.has('w') || keys.has('arrowup')) dz -= 1;
          if (keys.has('s') || keys.has('arrowdown')) dz += 1;
          if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
          if (keys.has('d') || keys.has('arrowright')) dx += 1;

          if (dx !== 0 || dz !== 0) {
            const len = Math.sqrt(dx * dx + dz * dz);
            dx = (dx / len) * speed * deltaTime;
            dz = (dz / len) * speed * deltaTime;
            const newPos = {
              x: playerMesh.position.x + dx,
              y: playerMesh.position.y,
              z: playerMesh.position.z + dz,
            };
            playerMesh.position.set(newPos.x, newPos.y, newPos.z);
            // Face movement direction
            const targetRot = Math.atan2(dx, dz);
            playerMesh.rotation.y += (targetRot - playerMesh.rotation.y) * config.smoothRotation;
            onMove?.(newPos, playerMesh.rotation.y);
            setActiveAnimation(isRunning ? 'run' : 'walk');
          } else {
            setActiveAnimation('idle');
          }

          // Bob animation
          animFrame += animSpeed[activeAnimation as keyof typeof animSpeed] || 0.02;
          playerMesh.position.y = playerAvatar.position.y + Math.sin(animFrame) * (activeAnimation === 'walk' ? 0.05 : activeAnimation === 'run' ? 0.08 : 0.01);
        };

        threeRef.current = { playerMesh, createAvatarMesh, update, THREE };
        setLoaded(true);
      } catch {
        // Three.js not available, component operates in data-only mode
        setLoaded(false);
      }
    };

    init();
    return () => { disposed = true; };
  }, []);

  // LOD calculation
  const getAvatarLOD = useCallback((distance: number): 'full' | 'simplified' | 'nameTag' | 'hidden' => {
    if (distance < AVATAR_LOD.full) return 'full';
    if (distance < AVATAR_LOD.simplified) return 'simplified';
    if (distance < AVATAR_LOD.nameTagOnly) return 'nameTag';
    return 'hidden';
  }, []);

  // Sort by distance for animation budget
  const sortedAvatars = useMemo(() => {
    const all = [...otherPlayers, ...npcs.map(n => ({ ...n, isRunning: false }))];
    return all.sort((a, b) => {
      const da = Math.sqrt((a.position.x - playerAvatar.position.x) ** 2 + (a.position.z - playerAvatar.position.z) ** 2);
      const db = Math.sqrt((b.position.x - playerAvatar.position.x) ** 2 + (b.position.z - playerAvatar.position.z) ** 2);
      return da - db;
    }).slice(0, MAX_ANIMATED_AVATARS);
  }, [otherPlayers, npcs, playerAvatar]);

  return (
    <div ref={containerRef} className="relative">
      {/* Debug overlay — avatar state */}
      <div className="absolute bottom-4 left-4 bg-black/60 border border-white/10 rounded p-2 text-xs text-white/60 space-y-0.5">
        <div>Player: ({playerAvatar.position.x.toFixed(0)}, {playerAvatar.position.z.toFixed(0)}) [{activeAnimation}]</div>
        <div>Others: {otherPlayers.length} players, {npcs.length} NPCs</div>
        <div>Animated: {Math.min(sortedAvatars.length, MAX_ANIMATED_AVATARS)}/{MAX_ANIMATED_AVATARS} budget</div>
        <div>Controller: {config.moveSpeed}m/s walk, {config.runSpeed}m/s run</div>
        <div className="mt-1 text-white/40">WASD=move Shift=run 1-5=emotes</div>
      </div>

      {/* NPC info badges (visible in isometric fallback) */}
      {npcs.map(npc => (
        <div key={npc.id} className="hidden" data-npc-id={npc.id}
          data-position={JSON.stringify(npc.position)}
          data-animation={npc.animation}
          data-occupation={npc.occupation}
          data-name={npc.displayName}>
          {/* NPC data for renderer consumption */}
        </div>
      ))}

      {/* Emote bar */}
      <div className="absolute bottom-4 right-4 flex gap-1">
        {[
          { key: '1', emote: 'wave' as AvatarAnimation, icon: '👋' },
          { key: '2', emote: 'clap' as AvatarAnimation, icon: '👏' },
          { key: '3', emote: 'point' as AvatarAnimation, icon: '👉' },
          { key: '4', emote: 'celebrate' as AvatarAnimation, icon: '🎉' },
          { key: '5', emote: 'sit' as AvatarAnimation, icon: '🪑' },
        ].map(e => (
          <button key={e.key} onClick={() => onEmote?.(e.emote)}
            className="w-8 h-8 bg-black/60 border border-white/10 rounded flex items-center justify-center text-sm hover:bg-white/10"
            title={`${e.emote} (${e.key})`}>
            {e.icon}
          </button>
        ))}
      </div>

      {/* State exposed as data attributes for Three.js scene to read */}
      <div className="hidden"
        data-avatar-system="true"
        data-loaded={loaded}
        data-player={JSON.stringify(playerAvatar)}
        data-active-animation={activeAnimation}
        data-controller-config={JSON.stringify(config)}
        data-lod-config={JSON.stringify(AVATAR_LOD)}
        data-animation-transitions={JSON.stringify(ANIMATION_TRANSITIONS)}
        data-npc-occupation-map={JSON.stringify(NPC_OCCUPATION_ANIMATIONS)}
      />
    </div>
  );
}
