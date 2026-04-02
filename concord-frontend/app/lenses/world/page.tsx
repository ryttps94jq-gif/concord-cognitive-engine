'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { PointerLockControls, Text, Sky, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DTU {
  id: string;
  title: string;
  tier?: string;
  scope?: string;
  tags?: string[];
  source?: Record<string, unknown> | string[];
  core?: { summary?: string; [key: string]: unknown };
  meta?: Record<string, unknown>;
  createdAt?: string;
}

interface District {
  domain: string;
  color: string;
  dtus: DTU[];
  center: [number, number, number];
}

interface SelectedDTU extends DTU {
  full?: DTU;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOMAIN_COLORS: Record<string, string> = {
  finance: '#4ade80',
  music: '#a855f7',
  trades: '#f59e0b',
  science: '#06b6d4',
  art: '#ec4899',
  healthcare: '#f0f0f0',
  code: '#22d3ee',
  news: '#ef4444',
  sports: '#10b981',
  legal: '#6366f1',
  education: '#8b5cf6',
  space: '#1e1b4b',
};

const DEFAULT_COLOR = '#64748b';

function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain.toLowerCase()] || DEFAULT_COLOR;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDomain(dtu: DTU): string {
  if (dtu.scope) return dtu.scope;
  if (dtu.tags && dtu.tags.length > 0) return dtu.tags[0];
  return 'general';
}

function getTier(dtu: DTU): string {
  return (dtu.tier || 'base').toLowerCase();
}

function getSourceCount(dtu: DTU): number {
  if (Array.isArray(dtu.source)) return dtu.source.length;
  if (dtu.source && typeof dtu.source === 'object') return Object.keys(dtu.source).length;
  return 1;
}

// ---------------------------------------------------------------------------
// Build districts from DTU data
// ---------------------------------------------------------------------------

function buildDistricts(dtus: DTU[]): District[] {
  const grouped: Record<string, DTU[]> = {};
  for (const dtu of dtus) {
    const domain = getDomain(dtu);
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(dtu);
  }

  const domains = Object.keys(grouped).sort();
  const cols = Math.ceil(Math.sqrt(domains.length));
  const districtSize = 60;
  const gap = 10;

  return domains.map((domain, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cx = (col - cols / 2) * (districtSize + gap);
    const cz = (row - Math.floor(domains.length / cols) / 2) * (districtSize + gap);
    return {
      domain,
      color: getDomainColor(domain),
      dtus: grouped[domain],
      center: [cx, 0, cz],
    };
  });
}

// ---------------------------------------------------------------------------
// Day/Night cycle — uses real time
// ---------------------------------------------------------------------------

function useDayNight() {
  const [sunPosition, setSunPosition] = useState<[number, number, number]>([100, 50, 0]);
  const [isNight, setIsNight] = useState(false);

  useEffect(() => {
    function update() {
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60;
      // Sun arc: rise at 6, peak at 12, set at 18
      const angle = ((hours - 6) / 12) * Math.PI;
      const y = Math.sin(angle) * 100;
      const x = Math.cos(angle) * 100;
      setSunPosition([x, Math.max(y, -30), 0]);
      setIsNight(hours < 6 || hours > 19);
    }
    update();
    const iv = setInterval(update, 60_000);
    return () => clearInterval(iv);
  }, []);

  return { sunPosition, isNight };
}

// ---------------------------------------------------------------------------
// Ground Plane for a district
// ---------------------------------------------------------------------------

function DistrictGround({ district }: { district: District }) {
  const [cx, , cz] = district.center;
  const color = new THREE.Color(district.color);

  return (
    <group position={[cx, -0.01, cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[56, 56]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.15}
          roughness={0.9}
        />
      </mesh>
      {/* Border glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[27, 28.5, 4]} />
        <meshBasicMaterial color={district.color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* District label */}
      <Text
        position={[0, 0.1, -26]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={3}
        color={district.color}
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {district.domain.toUpperCase()}
      </Text>
    </group>
  );
}

// ---------------------------------------------------------------------------
// DTU Building Object
// ---------------------------------------------------------------------------

interface DTUObjectProps {
  dtu: DTU;
  position: [number, number, number];
  color: string;
  onSelect: (dtu: DTU) => void;
}

function DTUObject({ dtu, position, color, onSelect }: DTUObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const tier = getTier(dtu);
  const sourceCount = getSourceCount(dtu);

  // Dimensions based on tier
  const dims = useMemo(() => {
    switch (tier) {
      case 'hyper':
        return { w: 3, h: 14 + sourceCount * 0.5, d: 3, emissiveIntensity: 1.5 };
      case 'mega':
        return { w: 2.5, h: 6 + sourceCount * 0.8, d: 2.5, emissiveIntensity: 0.6 };
      case 'shadow':
        return { w: 1, h: 2, d: 1, emissiveIntensity: 0.1 };
      default: // base / regular
        return { w: 1.5, h: 3, d: 1.5, emissiveIntensity: 0.3 };
    }
  }, [tier, sourceCount]);

  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  // Animate hyper DTUs with a glow pulse
  useFrame((state) => {
    if (!meshRef.current) return;
    if (tier === 'hyper') {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.7;
    }
    if (hovered && meshRef.current) {
      meshRef.current.scale.setScalar(1.05 + Math.sin(state.clock.elapsedTime * 4) * 0.02);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(dtu);
  }, [dtu, onSelect]);

  // Shadow DTUs are particles
  if (tier === 'shadow') {
    return (
      <group position={[position[0], position[1] + 1, position[2]]}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial
            color={threeColor}
            transparent
            opacity={0.4}
            emissive={threeColor}
            emissiveIntensity={0.3}
            wireframe
          />
        </mesh>
        {/* Shimmer particles */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={20}
              array={new Float32Array(60).map(() => (Math.random() - 0.5) * 3)}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.15} color={color} transparent opacity={0.6} sizeAttenuation />
        </points>
      </group>
    );
  }

  return (
    <group position={[position[0], position[1] + dims.h / 2, position[2]]}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[dims.w, dims.h, dims.d]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={hovered ? dims.emissiveIntensity + 0.5 : dims.emissiveIntensity}
          metalness={0.7}
          roughness={0.3}
          transparent={tier === 'hyper'}
          opacity={tier === 'hyper' ? 0.85 : 1}
        />
      </mesh>
      {/* Top accent for mega/hyper */}
      {(tier === 'mega' || tier === 'hyper') && (
        <mesh position={[0, dims.h / 2 + 0.15, 0]}>
          <boxGeometry args={[dims.w + 0.3, 0.3, dims.d + 0.3]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} />
        </mesh>
      )}
      {/* Persistent landmark label for HYPER DTUs — visible from distance */}
      {tier === 'hyper' && (
        <Html
          position={[0, dims.h / 2 + 3, 0]}
          center
          distanceFactor={80}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div className="bg-purple-900/80 border border-purple-400/60 px-3 py-1 rounded-lg text-[11px] text-purple-200 font-bold backdrop-blur-sm shadow-[0_0_12px_rgba(168,85,247,0.4)]">
            {dtu.title || dtu.id}
          </div>
        </Html>
      )}
      {/* Persistent label for MEGA DTUs — visible at medium distance */}
      {tier === 'mega' && !hovered && (
        <Html
          position={[0, dims.h / 2 + 2, 0]}
          center
          distanceFactor={50}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div className="bg-cyan-900/60 border border-cyan-500/30 px-2 py-0.5 rounded text-[9px] text-cyan-300/80 backdrop-blur-sm">
            {dtu.title || dtu.id}
          </div>
        </Html>
      )}
      {/* Hover label */}
      {hovered && (
        <Html
          position={[0, dims.h / 2 + 1.5, 0]}
          center
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div className="bg-black/80 border border-cyan-500/50 px-3 py-1.5 rounded text-xs text-cyan-300 backdrop-blur-sm max-w-[200px] truncate">
            {dtu.title || dtu.id}
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// District group — positions DTUs within district bounds
// ---------------------------------------------------------------------------

function DistrictGroup({
  district,
  onSelect,
}: {
  district: District;
  onSelect: (dtu: DTU) => void;
}) {
  const [cx, , cz] = district.center;
  const bounds = 24; // half-width of the placeable area within district

  return (
    <group>
      <DistrictGround district={district} />
      {district.dtus.map((dtu) => {
        const h = hashString(dtu.id);
        const x = cx + ((h % 100) / 100) * bounds * 2 - bounds;
        const z = cz + (((h >> 8) % 100) / 100) * bounds * 2 - bounds;
        return (
          <DTUObject
            key={dtu.id}
            dtu={dtu}
            position={[x, 0, z]}
            color={district.color}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Infinite ground
// ---------------------------------------------------------------------------

function InfiniteGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial color="#0a0a0f" roughness={1} metalness={0} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Grid overlay
// ---------------------------------------------------------------------------

function GridOverlay() {
  return (
    <gridHelper
      args={[1000, 200, '#1a1a2e', '#1a1a2e']}
      position={[0, 0.01, 0]}
    />
  );
}

// ---------------------------------------------------------------------------
// Ambient particles
// ---------------------------------------------------------------------------

function AmbientParticles() {
  const count = 500;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 400;
      arr[i * 3 + 1] = Math.random() * 80 + 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    return arr;
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.005;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.3} color="#22d3ee" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

// ---------------------------------------------------------------------------
// WASD Movement Controller
// ---------------------------------------------------------------------------

function WASDControls({ onCameraMove, teleportTo, onTeleportDone }: {
  onCameraMove?: (pos: [number, number, number]) => void;
  teleportTo?: [number, number, number] | null;
  onTeleportDone?: () => void;
}) {
  const { camera } = useThree();
  const keys = useRef<Set<string>>(new Set());
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const speed = 60;
    const k = keys.current;
    direction.current.set(0, 0, 0);

    if (k.has('KeyW') || k.has('ArrowUp')) direction.current.z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) direction.current.z += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) direction.current.x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) direction.current.x += 1;
    if (k.has('Space')) direction.current.y += 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) direction.current.y -= 1;

    if (direction.current.length() > 0) {
      direction.current.normalize();
      // Get camera forward/right vectors projected onto XZ plane
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      velocity.current.set(0, 0, 0);
      velocity.current.addScaledVector(right, direction.current.x);
      velocity.current.addScaledVector(forward, -direction.current.z);
      velocity.current.y += direction.current.y;
      velocity.current.normalize().multiplyScalar(speed * delta);
      camera.position.add(velocity.current);
    }

    // Clamp minimum height
    if (camera.position.y < 2) camera.position.y = 2;

    // Report camera position for minimap (throttled)
    if (onCameraMove) {
      onCameraMove([camera.position.x, camera.position.y, camera.position.z]);
    }

    // Handle teleport
    if (teleportTo) {
      camera.position.set(teleportTo[0], 40, teleportTo[2]);
      if (onTeleportDone) onTeleportDone();
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Scene content
// ---------------------------------------------------------------------------

interface SceneProps {
  districts: District[];
  onSelect: (dtu: DTU) => void;
  isNight: boolean;
  sunPosition: [number, number, number];
  onCameraMove?: (pos: [number, number, number]) => void;
  teleportTo?: [number, number, number] | null;
  onTeleportDone?: () => void;
}

function Scene({ districts, onSelect, isNight, sunPosition, onCameraMove, teleportTo, onTeleportDone }: SceneProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={isNight ? 0.15 : 0.4} />
      <directionalLight
        position={sunPosition}
        intensity={isNight ? 0.2 : 1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={500}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />
      <pointLight position={[0, 50, 0]} intensity={0.3} color="#22d3ee" />

      {/* Sky */}
      {isNight ? (
        <Stars radius={300} depth={60} count={2000} factor={4} fade speed={1} />
      ) : (
        <Sky sunPosition={sunPosition} turbidity={8} rayleigh={2} />
      )}
      <fog attach="fog" args={[isNight ? '#05050f' : '#0d1117', 50, 400]} />

      {/* Ground */}
      <InfiniteGround />
      <GridOverlay />
      <AmbientParticles />

      {/* Districts */}
      {districts.map((d) => (
        <DistrictGroup key={d.domain} district={d} onSelect={onSelect} />
      ))}

      {/* Controls */}
      <WASDControls onCameraMove={onCameraMove} teleportTo={teleportTo} onTeleportDone={onTeleportDone} />
      <PointerLockControls />
    </>
  );
}

// ---------------------------------------------------------------------------
// Mobile Joystick overlay
// ---------------------------------------------------------------------------

function MobileJoystick({ onMove }: { onMove: (dx: number, dz: number) => void }) {
  const stickRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const origin = useRef({ x: 0, y: 0 });

  const handleStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    origin.current = { x: touch.clientX, y: touch.clientY };
    setActive(true);
  }, []);

  const handleMove = useCallback((e: React.TouchEvent) => {
    if (!active) return;
    const touch = e.touches[0];
    const dx = (touch.clientX - origin.current.x) / 50;
    const dz = (touch.clientY - origin.current.y) / 50;
    onMove(
      Math.max(-1, Math.min(1, dx)),
      Math.max(-1, Math.min(1, dz))
    );
    if (stickRef.current) {
      const clampedX = Math.max(-30, Math.min(30, touch.clientX - origin.current.x));
      const clampedY = Math.max(-30, Math.min(30, touch.clientY - origin.current.y));
      stickRef.current.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    }
  }, [active, onMove]);

  const handleEnd = useCallback(() => {
    setActive(false);
    onMove(0, 0);
    if (stickRef.current) {
      stickRef.current.style.transform = 'translate(0px, 0px)';
    }
  }, [onMove]);

  return (
    <div
      className="fixed bottom-8 left-8 w-24 h-24 rounded-full border-2 border-cyan-500/40 bg-black/30 backdrop-blur-sm flex items-center justify-center md:hidden z-50"
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      <div
        ref={stickRef}
        className={`w-10 h-10 rounded-full transition-colors ${
          active ? 'bg-cyan-400/70' : 'bg-cyan-500/30'
        }`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Screen
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#05050f] flex flex-col items-center justify-center z-[100]">
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
        <div className="absolute inset-4 rounded-full border-2 border-cyan-400/40 animate-spin" />
        <div className="absolute inset-8 rounded-full border-2 border-cyan-300/60 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>
      <h2 className="text-cyan-400 text-xl font-mono tracking-widest mb-2">INITIALIZING WORLD</h2>
      <p className="text-cyan-600 text-sm font-mono">Loading domain topology...</p>
      <div className="mt-6 w-48 h-1 bg-cyan-900/50 rounded-full overflow-hidden">
        <div className="h-full bg-cyan-400 rounded-full animate-[loading_2s_ease-in-out_infinite]"
          style={{ width: '60%', animation: 'loading 2s ease-in-out infinite' }}
        />
      </div>
      <style>{`
        @keyframes loading {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HUD Overlay
// ---------------------------------------------------------------------------

function HUD({
  districts,
  selectedDTU,
  onClose,
  locked,
  onLock,
}: {
  districts: District[];
  selectedDTU: SelectedDTU | null;
  onClose: () => void;
  locked: boolean;
  onLock: () => void;
}) {
  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
        <div className="pointer-events-auto">
          <h1 className="text-cyan-400 font-mono text-lg tracking-widest flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            CONCORD WORLD
          </h1>
          <p className="text-cyan-700 text-xs font-mono mt-0.5">
            {districts.length} districts | {districts.reduce((s, d) => s + d.dtus.length, 0)} objects
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          {!locked && (
            <button
              onClick={onLock}
              className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 px-3 py-1.5 rounded text-xs font-mono hover:bg-cyan-500/30 transition-colors"
            >
              Click to Explore (WASD + Mouse)
            </button>
          )}
          {locked && (
            <span className="text-cyan-600 text-xs font-mono">ESC to unlock cursor</span>
          )}
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 text-right">
        <div className="text-cyan-800 text-[10px] font-mono space-y-0.5 hidden md:block">
          <div>WASD — Move</div>
          <div>SPACE — Up | SHIFT — Down</div>
          <div>MOUSE — Look | CLICK — Select</div>
          <div>ESC — Release cursor</div>
        </div>
      </div>

      {/* Minimap — click to teleport */}
      <div className="absolute bottom-4 left-4 hidden md:block pointer-events-auto">
        <div className="w-48 h-48 border border-cyan-900/50 bg-black/70 backdrop-blur-sm rounded-lg overflow-hidden">
          <div className="p-2">
            <div className="text-cyan-700 text-[9px] font-mono mb-1">MINIMAP <span className="text-cyan-900">(click to teleport)</span></div>
            <div className="relative w-full h-36">
              {districts.map((d) => {
                const [cx, , cz] = d.center;
                const scale = 0.12;
                return (
                  <button
                    key={d.domain}
                    className="absolute w-4 h-4 rounded-sm border border-white/10 hover:border-white/40 hover:scale-150 transition-transform cursor-pointer"
                    style={{
                      backgroundColor: d.color,
                      opacity: 0.7,
                      left: `${50 + cx * scale}%`,
                      top: `${50 + cz * scale}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    title={`Teleport to ${d.domain}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTeleportTarget(d.center);
                    }}
                  />
                );
              })}
              {/* Camera position indicator (real-time) */}
              <div
                className="absolute w-2.5 h-2.5 bg-white rounded-full border border-cyan-400 shadow-[0_0_6px_rgba(0,255,247,0.8)] z-10 pointer-events-none"
                style={{
                  left: `${50 + cameraPos[0] * 0.12}%`,
                  top: `${50 + cameraPos[2] * 0.12}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
              {/* District labels on minimap */}
              {districts.map((d) => {
                const [cx, , cz] = d.center;
                return (
                  <span
                    key={`label-${d.domain}`}
                    className="absolute text-[7px] text-white/40 font-mono pointer-events-none whitespace-nowrap"
                    style={{
                      left: `${50 + cx * 0.12}%`,
                      top: `${50 + cz * 0.12 + 3}%`,
                      transform: 'translate(-50%, 0)',
                    }}
                  >
                    {d.domain}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* District labels (sidebar) */}
      <div className="absolute top-20 left-4 hidden lg:block">
        <div className="bg-black/50 backdrop-blur-sm border border-cyan-900/30 rounded-lg p-3 max-h-[60vh] overflow-y-auto pointer-events-auto scrollbar-thin scrollbar-thumb-cyan-900">
          <div className="text-cyan-700 text-[9px] font-mono mb-2 tracking-widest">DISTRICTS</div>
          {districts.map((d) => (
            <button
              key={d.domain}
              className="flex items-center gap-2 py-0.5 w-full text-left hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
              onClick={() => setTeleportTarget(d.center)}
              title={`Teleport to ${d.domain}`}
            >
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-cyan-500 text-[10px] font-mono truncate">{d.domain}</span>
              <span className="text-cyan-800 text-[9px] font-mono ml-auto">{d.dtus.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected DTU Info Panel */}
      {selectedDTU && (
        <div className="absolute top-20 right-4 w-80 max-w-[calc(100vw-2rem)] pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/30">
              <h3 className="text-cyan-400 font-mono text-sm truncate flex-1">
                {selectedDTU.title || selectedDTU.id}
              </h3>
              <button
                onClick={onClose}
                className="text-cyan-700 hover:text-cyan-400 ml-2 text-lg leading-none"
              >
                x
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedDTU.tier && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                    selectedDTU.tier === 'HYPER' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                    selectedDTU.tier === 'MEGA' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    selectedDTU.tier === 'SHADOW' ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30' :
                    'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {selectedDTU.tier}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-700/50 text-slate-300">
                  {getDomain(selectedDTU)}
                </span>
              </div>
              {selectedDTU.tags && selectedDTU.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDTU.tags.slice(0, 6).map((tag) => (
                    <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 bg-cyan-900/20 text-cyan-600 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {(selectedDTU.full?.core?.summary || selectedDTU.core?.summary) && (
                <p className="text-cyan-300/70 text-xs font-mono leading-relaxed line-clamp-4">
                  {selectedDTU.full?.core?.summary || selectedDTU.core?.summary}
                </p>
              )}
              <div className="text-cyan-800 text-[9px] font-mono">
                ID: {selectedDTU.id}
              </div>
              {selectedDTU.createdAt && (
                <div className="text-cyan-800 text-[9px] font-mono">
                  Created: {new Date(selectedDTU.createdAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function WorldLensPage() {
  const [dtus, setDtus] = useState<DTU[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDTU, setSelectedDTU] = useState<SelectedDTU | null>(null);
  const [locked, setLocked] = useState(false);
  const [cameraPos, setCameraPos] = useState<[number, number, number]>([0, 80, 0]);
  const [teleportTarget, setTeleportTarget] = useState<[number, number, number] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { sunPosition, isNight } = useDayNight();

  // Fetch DTUs
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dtus');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const items: DTU[] = json.dtus || json.results || [];
        if (!cancelled) {
          setDtus(items);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Build districts
  const districts = useMemo(() => buildDistricts(dtus), [dtus]);

  // Handle DTU selection — fetch full DTU data
  const handleSelect = useCallback(async (dtu: DTU) => {
    setSelectedDTU({ ...dtu });
    try {
      const res = await fetch(`/api/dtus/${dtu.id}`);
      if (res.ok) {
        const json = await res.json();
        const full = json.dtu || json;
        setSelectedDTU((prev) => prev && prev.id === dtu.id ? { ...prev, full } : prev);
      }
    } catch {
      // Keep partial data
    }
  }, []);

  const handleClose = useCallback(() => setSelectedDTU(null), []);

  // Pointer lock tracking
  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, []);

  const handleLock = useCallback(() => {
    canvasRef.current?.requestPointerLock();
  }, []);

  // Mobile joystick movement (dispatches synthetic key events)
  const handleMobileMove = useCallback((dx: number, dz: number) => {
    const dispatchKey = (code: string, down: boolean) => {
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    };
    dispatchKey('KeyA', dx < -0.3);
    dispatchKey('KeyD', dx > 0.3);
    dispatchKey('KeyW', dz < -0.3);
    dispatchKey('KeyS', dz > 0.3);
  }, []);

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#05050f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 font-mono text-lg mb-2">WORLD LOAD FAILED</div>
          <div className="text-red-600 font-mono text-sm mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-500/20 border border-red-500/40 text-red-400 px-4 py-2 rounded font-mono text-sm hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#05050f] relative overflow-hidden">
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 80, 120], fov: 60, near: 0.5, far: 1000 }}
        shadows
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        style={{ background: isNight ? '#05050f' : '#0d1117' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = isNight ? 0.6 : 1;
        }}
      >
        <Scene
          districts={districts}
          onSelect={handleSelect}
          isNight={isNight}
          sunPosition={sunPosition}
          onCameraMove={setCameraPos}
          teleportTo={teleportTarget}
          onTeleportDone={() => setTeleportTarget(null)}
        />
      </Canvas>

      <HUD
        districts={districts}
        selectedDTU={selectedDTU}
        onClose={handleClose}
        locked={locked}
        onLock={handleLock}
      />

      <MobileJoystick onMove={handleMobileMove} />
    </div>
  );
}
