'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Text, Sky, Html } from '@react-three/drei';
import * as THREE from 'three';
import { subscribe, emit } from '@/lib/realtime/socket';

// ── Domain color mapping ──────────────────────────────────
const DOMAIN_COLORS: Record<string, string> = {
  finance: '#4ade80', music: '#a855f7', trades: '#f59e0b',
  science: '#06b6d4', art: '#ec4899', healthcare: '#f0f0f0',
  code: '#22d3ee', news: '#ef4444', sports: '#10b981',
  legal: '#6366f1', education: '#8b5cf6', space: '#1e1b4b',
  food: '#fb923c', history: '#a3a3a3', mathematics: '#3b82f6',
  physics: '#0ea5e9', bio: '#22c55e', chem: '#eab308',
  astronomy: '#6366f1', consulting: '#64748b', hr: '#f43f5e',
  marketing: '#f97316', marketplace: '#14b8a6', accounting: '#84cc16',
  'mental-health': '#c084fc', global: '#94a3b8',
};

const DEFAULT_COLOR = '#64748b';
const CHUNK_SIZE = 100; // 100m chunks
const DISTRICT_SIZE = 60; // 60m per district zone
const DISTRICT_GAP = 20; // gap between districts

// ── Types ─────────────────────────────────────────────────
interface DTU {
  id: string;
  title: string;
  tier?: 'regular' | 'mega' | 'hyper' | 'shadow';
  scope?: string;
  tags?: string[];
  domain?: string;
  meta?: Record<string, unknown>;
}

interface District {
  domain: string;
  color: string;
  dtus: DTU[];
  position: [number, number, number];
}

interface PlayerPosition {
  userId: string;
  username: string;
  x: number;
  y: number;
  z: number;
  ry: number;
}

// ── Hash DTU id to local position within district ─────────
function hashPosition(id: string, size: number): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  const x = ((h & 0xffff) / 0xffff) * size - size / 2;
  const z = (((h >> 16) & 0xffff) / 0xffff) * size - size / 2;
  return [x, z];
}

// ── DTU 3D Object ─────────────────────────────────────────
function DTUObject({ dtu, districtPos }: { dtu: DTU; districtPos: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tier = dtu.tier || 'regular';
  const [lx, lz] = hashPosition(dtu.id, DISTRICT_SIZE * 0.8);

  const { geometry, color, emissive, y } = useMemo(() => {
    switch (tier) {
      case 'hyper':
        return {
          geometry: new THREE.CylinderGeometry(2, 3, 20, 8),
          color: '#fbbf24',
          emissive: '#f59e0b',
          y: 10,
        };
      case 'mega':
        return {
          geometry: new THREE.BoxGeometry(3, 12, 3),
          color: '#60a5fa',
          emissive: '#3b82f6',
          y: 6,
        };
      case 'shadow':
        return {
          geometry: new THREE.SphereGeometry(1, 8, 8),
          color: '#1e1b4b',
          emissive: '#4338ca',
          y: 2,
        };
      default:
        return {
          geometry: new THREE.BoxGeometry(2, 4, 2),
          color: '#94a3b8',
          emissive: '#000000',
          y: 2,
        };
    }
  }, [tier]);

  // Gentle float for hyper DTUs
  useFrame(({ clock }) => {
    if (meshRef.current && tier === 'hyper') {
      meshRef.current.position.y = y + Math.sin(clock.elapsedTime * 0.8) * 0.5;
    }
  });

  const [hovered, setHovered] = useState(false);

  return (
    <group position={[districtPos[0] + lx, 0, districtPos[2] + lz]}>
      <mesh
        ref={meshRef}
        position={[0, y, 0]}
        geometry={geometry}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={hovered ? '#ffffff' : color}
          emissive={emissive}
          emissiveIntensity={tier === 'shadow' ? 0.8 : tier === 'hyper' ? 0.5 : 0.1}
          transparent={tier === 'shadow'}
          opacity={tier === 'shadow' ? 0.6 : 1}
        />
      </mesh>
      {hovered && (
        <Html position={[0, y + (tier === 'hyper' ? 12 : tier === 'mega' ? 8 : 4), 0]} center>
          <div className="bg-black/80 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap pointer-events-none">
            <div className="font-bold">{dtu.title}</div>
            <div className="text-xs text-gray-400">{tier.toUpperCase()} · {dtu.domain || dtu.tags?.[0] || 'unknown'}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── District ground zone ──────────────────────────────────
function DistrictZone({ district }: { district: District }) {
  return (
    <group position={district.position}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[DISTRICT_SIZE, DISTRICT_SIZE]} />
        <meshStandardMaterial
          color={district.color}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Border */}
      <lineSegments position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(DISTRICT_SIZE, DISTRICT_SIZE)]} />
        <lineBasicMaterial color={district.color} transparent opacity={0.5} />
      </lineSegments>
      {/* District label */}
      <Text
        position={[0, 0.5, -DISTRICT_SIZE / 2 + 3]}
        fontSize={3}
        color={district.color}
        anchorX="center"
        anchorY="middle"
      >
        {district.domain.toUpperCase()}
      </Text>
      {/* DTU objects */}
      {district.dtus.map((dtu) => (
        <DTUObject key={dtu.id} dtu={dtu} districtPos={district.position} />
      ))}
    </group>
  );
}

// ── Other players ─────────────────────────────────────────
function OtherPlayer({ player }: { player: PlayerPosition }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPos = useRef(new THREE.Vector3(player.x, player.y, player.z));

  useEffect(() => {
    targetPos.current.set(player.x, player.y, player.z);
  }, [player.x, player.y, player.z]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.lerp(targetPos.current, 0.1);
      meshRef.current.rotation.y = player.ry;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[player.x, player.y, player.z]}>
        <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
        <meshStandardMaterial color="#60a5fa" />
      </mesh>
      <Text
        position={[player.x, player.y + 2.2, player.z]}
        fontSize={0.5}
        color="white"
        anchorX="center"
      >
        {player.username}
      </Text>
    </group>
  );
}

// ── WASD movement controller ──────────────────────────────
function WASDController() {
  const { camera } = useThree();
  const keys = useRef<Set<string>>(new Set());
  const velocity = useRef(new THREE.Vector3());
  const SPEED = 30;
  const DAMPING = 0.85;

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useFrame((_, delta) => {
    const dir = new THREE.Vector3();
    const k = keys.current;

    if (k.has('KeyW') || k.has('ArrowUp')) dir.z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) dir.z += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) dir.x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) dir.x += 1;
    if (k.has('Space')) dir.y += 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) dir.y -= 1;

    if (dir.length() > 0) {
      dir.normalize();
      // Apply camera rotation to movement direction (xz only)
      const euler = new THREE.Euler(0, camera.rotation.y, 0, 'YXZ');
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);

      velocity.current.x += (right.x * dir.x + forward.x * -dir.z) * SPEED * delta;
      velocity.current.z += (right.z * dir.x + forward.z * -dir.z) * SPEED * delta;
      velocity.current.y += dir.y * SPEED * delta;
    }

    velocity.current.multiplyScalar(DAMPING);
    camera.position.add(velocity.current.clone().multiplyScalar(delta * 10));

    // Floor clamp
    if (camera.position.y < 2) camera.position.y = 2;
  });

  return null;
}

// ── Position broadcaster ──────────────────────────────────
function PositionBroadcaster({ cityId }: { cityId: string }) {
  const { camera } = useThree();
  const lastSent = useRef(0);

  useFrame(() => {
    const now = Date.now();
    if (now - lastSent.current > 100) { // 10Hz
      lastSent.current = now;
      emit('city:position', {
        cityId,
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        ry: camera.rotation.y,
      });
    }
  });

  return null;
}

// ── Ground grid ───────────────────────────────────────────
function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <gridHelper args={[2000, 200, '#1e293b', '#1e293b']} position={[0, 0.02, 0]} />
    </group>
  );
}

// ── HUD overlay ───────────────────────────────────────────
function HUD({
  districts,
  playerCount,
  fps,
  locked,
}: {
  districts: District[];
  playerCount: number;
  fps: number;
  locked: boolean;
}) {
  const totalDTUs = districts.reduce((sum, d) => sum + d.dtus.length, 0);

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      {/* Top-left: Stats */}
      <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-3 rounded-lg text-sm font-mono">
        <div className="text-cyan-400 font-bold text-lg mb-1">CONCORD CITY</div>
        <div>Districts: {districts.length}</div>
        <div>DTUs: {totalDTUs}</div>
        <div>Players: {playerCount}</div>
        <div className={fps < 30 ? 'text-red-400' : 'text-green-400'}>FPS: {fps}</div>
      </div>

      {/* Crosshair */}
      {locked && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-1 h-1 bg-white rounded-full opacity-50" />
        </div>
      )}

      {/* Bottom: Controls hint */}
      {!locked && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-lg text-center pointer-events-auto">
          <div className="text-lg font-bold mb-1">Click to Enter World</div>
          <div className="text-sm text-gray-400">WASD to move · Mouse to look · Space/Shift for up/down</div>
        </div>
      )}

      {/* Bottom-left: Minimap placeholder */}
      <div className="absolute bottom-4 left-4 w-40 h-40 bg-black/60 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-2 text-xs text-gray-400 font-mono">MINIMAP</div>
        <div className="flex flex-wrap gap-1 p-2">
          {districts.slice(0, 12).map((d) => (
            <div
              key={d.domain}
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: d.color }}
              title={d.domain}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Scene content ─────────────────────────────────────────
function SceneContent({
  districts,
  otherPlayers,
  cityId,
}: {
  districts: District[];
  otherPlayers: PlayerPosition[];
  cityId: string;
}) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[100, 80, 50]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[0, 50, 0]} intensity={0.3} color="#60a5fa" />

      {/* Sky */}
      <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={2} />

      {/* Fog */}
      <fog attach="fog" args={['#0f172a', 100, 800]} />

      {/* Ground */}
      <Ground />

      {/* Districts */}
      {districts.map((district) => (
        <DistrictZone key={district.domain} district={district} />
      ))}

      {/* Other players */}
      {otherPlayers.map((p) => (
        <OtherPlayer key={p.userId} player={p} />
      ))}

      {/* Controls */}
      <PointerLockControls />
      <WASDController />
      <PositionBroadcaster cityId={cityId} />
    </>
  );
}

// ── Main page component ───────────────────────────────────
export default function WorldLensPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [otherPlayers, setOtherPlayers] = useState<PlayerPosition[]>([]);
  const [locked, setLocked] = useState(false);
  const [fps, setFps] = useState(60);
  const [cityId] = useState('concord-main');
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(Date.now());

  // Fetch DTUs and build districts
  useEffect(() => {
    async function loadDTUs() {
      try {
        const res = await fetch('/api/dtus?limit=500');
        if (!res.ok) throw new Error('Failed to fetch DTUs');
        const data = await res.json();
        const dtus: DTU[] = Array.isArray(data) ? data : data.dtus || data.data || [];

        // Group by domain
        const byDomain = new Map<string, DTU[]>();
        for (const dtu of dtus) {
          const domain = dtu.domain || dtu.tags?.[0] || 'global';
          if (!byDomain.has(domain)) byDomain.set(domain, []);
          byDomain.get(domain)!.push(dtu);
        }

        // Layout districts in a grid
        const cols = Math.ceil(Math.sqrt(byDomain.size));
        const built: District[] = [];
        let i = 0;
        for (const [domain, domainDtus] of byDomain) {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const x = (col - cols / 2) * (DISTRICT_SIZE + DISTRICT_GAP);
          const z = (row - Math.floor(byDomain.size / cols) / 2) * (DISTRICT_SIZE + DISTRICT_GAP);
          built.push({
            domain,
            color: DOMAIN_COLORS[domain] || DEFAULT_COLOR,
            dtus: domainDtus,
            position: [x, 0, z],
          });
          i++;
        }

        setDistricts(built);
      } catch (err) {
        console.error('[World] Failed to load DTUs:', err);
        // Generate demo districts
        const demoDomains = ['finance', 'science', 'music', 'art', 'code', 'news', 'space', 'education', 'healthcare'];
        const demo: District[] = demoDomains.map((domain, idx) => {
          const cols = 3;
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          return {
            domain,
            color: DOMAIN_COLORS[domain] || DEFAULT_COLOR,
            dtus: Array.from({ length: 5 + Math.floor(Math.random() * 10) }, (_, j) => ({
              id: `demo-${domain}-${j}`,
              title: `${domain} DTU #${j + 1}`,
              tier: j === 0 ? 'hyper' as const : j < 3 ? 'mega' as const : 'regular' as const,
              domain,
              tags: [domain],
            })),
            position: [
              (col - 1) * (DISTRICT_SIZE + DISTRICT_GAP),
              0,
              (row - 1) * (DISTRICT_SIZE + DISTRICT_GAP),
            ],
          };
        });
        setDistricts(demo);
      }
    }
    loadDTUs();
  }, []);

  // Subscribe to player positions
  useEffect(() => {
    const unsub = subscribe<{ players: PlayerPosition[] }>('city:positions', (data) => {
      setOtherPlayers(data.players || []);
    });
    return unsub;
  }, []);

  // Subscribe to new DTUs from feed
  useEffect(() => {
    const unsub = subscribe<DTU>('feed:new-dtu', (dtu) => {
      setDistricts((prev) => {
        const domain = dtu.domain || dtu.tags?.[0] || 'global';
        const existing = prev.find((d) => d.domain === domain);
        if (existing) {
          return prev.map((d) =>
            d.domain === domain ? { ...d, dtus: [...d.dtus, dtu] } : d
          );
        }
        // New domain — add a district
        const cols = Math.ceil(Math.sqrt(prev.length + 1));
        return [
          ...prev,
          {
            domain,
            color: DOMAIN_COLORS[domain] || DEFAULT_COLOR,
            dtus: [dtu],
            position: [
              (prev.length % cols - cols / 2) * (DISTRICT_SIZE + DISTRICT_GAP),
              0,
              (Math.floor(prev.length / cols)) * (DISTRICT_SIZE + DISTRICT_GAP),
            ],
          },
        ];
      });
    });
    return unsub;
  }, []);

  // FPS counter
  const onCreated = useCallback(() => {
    const tick = () => {
      frameCount.current++;
      const now = Date.now();
      if (now - lastFpsUpdate.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFpsUpdate.current = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  // Pointer lock state tracking
  useEffect(() => {
    const onLock = () => setLocked(true);
    const onUnlock = () => setLocked(false);
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) onLock();
      else onUnlock();
    });
    return () => {
      document.removeEventListener('pointerlockchange', onLock);
    };
  }, []);

  return (
    <div className="w-full h-screen bg-[#0f172a] relative overflow-hidden">
      <HUD
        districts={districts}
        playerCount={otherPlayers.length}
        fps={fps}
        locked={locked}
      />

      <Canvas
        camera={{ position: [0, 80, 120], fov: 60, near: 0.1, far: 2000 }}
        shadows
        onCreated={onCreated}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <SceneContent
            districts={districts}
            otherPlayers={otherPlayers}
            cityId={cityId}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
