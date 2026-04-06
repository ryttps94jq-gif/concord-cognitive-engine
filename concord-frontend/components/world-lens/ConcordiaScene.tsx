'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  createContext,
} from 'react';
import { Activity, Monitor, Settings } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface SceneLayer {
  terrain: unknown;    // THREE.Group at runtime
  buildings: unknown;
  infrastructure: unknown;
  avatars: unknown;
  weather: unknown;
  ui: unknown;
  water: unknown;
  particles: unknown;
}

export interface PerformanceBudget {
  drawCalls: number;
  maxDrawCalls: number;
  triangles: number;
  maxTriangles: number;
  textureMemory: number; // MB
  maxTextureMemory: number;
  fps: number;
  frameTime: number;
}

export interface ConcordiaSceneAPI {
  scene: unknown;       // THREE.Scene
  camera: unknown;      // THREE.PerspectiveCamera
  addBuilding: (buildingGroup: unknown, position: { x: number; y: number; z: number }) => void;
  removeBuilding: (id: string) => void;
  setWeather: (type: string, intensity: number) => void;
  setTimeOfDay: (hour: number) => void;
  getIntersectedObject: (screenX: number, screenY: number) => unknown | null;
}

interface ConcordiaSceneProps {
  districtId: string;
  quality?: QualityPreset;
  onBuildingClick?: (buildingId: string, intersection: unknown) => void;
  onTerrainClick?: (position: { x: number; y: number; z: number }) => void;
  width?: number | string;
  height?: number | string;
}

// ── Quality Presets ──────────────────────────────────────────────

const QUALITY_SETTINGS: Record<QualityPreset, {
  shadowMapSize: number;
  maxDrawCalls: number;
  maxTriangles: number;
  maxTextureMemory: number;
  antialias: boolean;
  pixelRatio: number;
  particleDensity: number;
}> = {
  low: {
    shadowMapSize: 512,
    maxDrawCalls: 200,
    maxTriangles: 500_000,
    maxTextureMemory: 128,
    antialias: false,
    pixelRatio: 0.75,
    particleDensity: 0.25,
  },
  medium: {
    shadowMapSize: 1024,
    maxDrawCalls: 500,
    maxTriangles: 1_500_000,
    maxTextureMemory: 256,
    antialias: true,
    pixelRatio: 1.0,
    particleDensity: 0.5,
  },
  high: {
    shadowMapSize: 2048,
    maxDrawCalls: 1000,
    maxTriangles: 3_000_000,
    maxTextureMemory: 512,
    antialias: true,
    pixelRatio: 1.5,
    particleDensity: 0.75,
  },
  ultra: {
    shadowMapSize: 4096,
    maxDrawCalls: 2000,
    maxTriangles: 6_000_000,
    maxTextureMemory: 1024,
    antialias: true,
    pixelRatio: 2.0,
    particleDensity: 1.0,
  },
};

const LAYER_NAMES = [
  'terrain', 'buildings', 'infrastructure', 'avatars',
  'weather', 'ui', 'water', 'particles',
] as const;

// ── Context ──────────────────────────────────────────────────────

const ConcordiaSceneContext = createContext<ConcordiaSceneAPI | null>(null);

export function useConcordiaScene(): ConcordiaSceneAPI {
  const ctx = useContext(ConcordiaSceneContext);
  if (!ctx) throw new Error('useConcordiaScene must be used within ConcordiaScene');
  return ctx;
}

// ── Styling ──────────────────────────────────────────────────────

const panel = 'bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg';

// ── Component ────────────────────────────────────────────────────

export default function ConcordiaScene({
  districtId,
  quality: initialQuality = 'medium',
  onBuildingClick,
  onTerrainClick,
  width = '100%',
  height = '100%',
}: ConcordiaSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<unknown>(null);
  const sceneRef = useRef<unknown>(null);
  const cameraRef = useRef<unknown>(null);
  const layersRef = useRef<Record<string, unknown>>({});
  const frameIdRef = useRef<number>(0);
  const clockRef = useRef<unknown>(null);
  const raycasterRef = useRef<unknown>(null);
  const buildingMapRef = useRef<Map<string, unknown>>(new Map());

  const [quality, setQuality] = useState<QualityPreset>(initialQuality);
  const [showFps, setShowFps] = useState(false);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [performance, setPerformance] = useState<PerformanceBudget>({
    drawCalls: 0,
    maxDrawCalls: QUALITY_SETTINGS[initialQuality].maxDrawCalls,
    triangles: 0,
    maxTriangles: QUALITY_SETTINGS[initialQuality].maxTriangles,
    textureMemory: 0,
    maxTextureMemory: QUALITY_SETTINGS[initialQuality].maxTextureMemory,
    fps: 0,
    frameTime: 0,
  });
  const [isReady, setIsReady] = useState(false);

  // ── Initialize Three.js scene ──────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const buildingMap = buildingMapRef.current;
    let THREE: typeof import('three');
    let renderer: InstanceType<typeof import('three').WebGLRenderer>;
    let scene: InstanceType<typeof import('three').Scene>;
    let camera: InstanceType<typeof import('three').PerspectiveCamera>;
    let clock: InstanceType<typeof import('three').Clock>;
    let raycaster: InstanceType<typeof import('three').Raycaster>;

    const fpsBuffer: number[] = [];
    let lastTime = globalThis.performance.now();

    async function init() {
      THREE = await import('three');
      if (disposed) return;

      const settings = QUALITY_SETTINGS[quality];

      // ── Renderer ─────────────────────────────────────────────────
      // Attempt WebGPU first if available, fall back to WebGL2
      let useWebGPU = false;
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        try {
          const adapter = await (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown | null> } }).gpu.requestAdapter();
          if (adapter) useWebGPU = true;
        } catch {
          // WebGPU not available, fall back
        }
      }

      if (useWebGPU) {
        // WebGPU renderer can be loaded dynamically from three/addons when stable
        // For now we use WebGL2 as primary renderer with WebGPU readiness flag
        console.info('[ConcordiaScene] WebGPU adapter found, but using WebGL2 renderer for stability');
      }

      renderer = new THREE.WebGLRenderer({
        canvas: canvas!,
        antialias: settings.antialias,
        powerPreference: 'high-performance',
        alpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));
      renderer.setSize(canvas!.clientWidth, canvas!.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;

      // ── Scene ───────────────────────────────────────────────────
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x8899bb, 0.0008);
      sceneRef.current = scene;

      // ── Camera ──────────────────────────────────────────────────
      const aspect = canvas!.clientWidth / canvas!.clientHeight;
      camera = new THREE.PerspectiveCamera(55, aspect, 0.5, 5000);
      camera.position.set(200, 150, 200);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // ── Scene Layers as THREE.Group ─────────────────────────────
      const layers: Record<string, InstanceType<typeof import('three').Group>> = {};
      for (const name of LAYER_NAMES) {
        const group = new THREE.Group();
        group.name = name;
        scene.add(group);
        layers[name] = group;
      }
      layersRef.current = layers;

      // ── Clock & Raycaster ───────────────────────────────────────
      clock = new THREE.Clock();
      clockRef.current = clock;
      raycaster = new THREE.Raycaster();
      raycasterRef.current = raycaster;

      // ── Ambient + default directional light ─────────────────────
      const ambient = new THREE.AmbientLight(0x405070, 0.5);
      scene.add(ambient);

      const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
      sun.position.set(100, 200, 80);
      sun.castShadow = true;
      sun.shadow.mapSize.width = settings.shadowMapSize;
      sun.shadow.mapSize.height = settings.shadowMapSize;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 600;
      sun.shadow.camera.left = -300;
      sun.shadow.camera.right = 300;
      sun.shadow.camera.top = 300;
      sun.shadow.camera.bottom = -300;
      scene.add(sun);

      setIsReady(true);

      // ── Game loop ───────────────────────────────────────────────
      function gameLoop() {
        if (disposed) return;

        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        // Update physics / avatars / NPCs / weather / particles
        // Each layer group can have a userData.update callback
        for (const name of LAYER_NAMES) {
          const group = layers[name];
          if (group && (group.userData as { update?: (d: number, e: number) => void }).update) {
            (group.userData as { update: (d: number, e: number) => void }).update(delta, elapsed);
          }
        }

        // Render
        renderer.render(scene, camera);

        // Performance budget monitoring
        const info = renderer.info;
        const now = globalThis.performance.now();
        const frameTime = now - lastTime;
        lastTime = now;
        fpsBuffer.push(1000 / frameTime);
        if (fpsBuffer.length > 60) fpsBuffer.shift();

        const avgFps = fpsBuffer.reduce((a, b) => a + b, 0) / fpsBuffer.length;
        setPerformance({
          drawCalls: info.render.calls,
          maxDrawCalls: settings.maxDrawCalls,
          triangles: info.render.triangles,
          maxTriangles: settings.maxTriangles,
          textureMemory: (info.memory?.textures ?? 0) * 4,
          maxTextureMemory: settings.maxTextureMemory,
          fps: Math.round(avgFps),
          frameTime: Math.round(frameTime * 10) / 10,
        });

        frameIdRef.current = requestAnimationFrame(gameLoop);
      }

      frameIdRef.current = requestAnimationFrame(gameLoop);
    }

    init();

    // ── Resize handler ────────────────────────────────────────────
    function handleResize() {
      if (!canvas || disposed) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (rendererRef.current && cameraRef.current) {
        const r = rendererRef.current as InstanceType<typeof import('three').WebGLRenderer>;
        const c = cameraRef.current as InstanceType<typeof import('three').PerspectiveCamera>;
        c.aspect = w / h;
        c.updateProjectionMatrix();
        r.setSize(w, h);
      }
    }
    window.addEventListener('resize', handleResize);

    // ── Click handler ─────────────────────────────────────────────
    function handleCanvasClick(e: MouseEvent) {
      if (disposed || !THREE) return;
      const rect = canvas!.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const rc = raycasterRef.current as InstanceType<typeof import('three').Raycaster>;
      const cam = cameraRef.current as InstanceType<typeof import('three').PerspectiveCamera>;
      rc.setFromCamera(mouse, cam);

      // Check buildings layer first
      const buildingsGroup = layersRef.current['buildings'] as InstanceType<typeof import('three').Group>;
      if (buildingsGroup) {
        const hits = rc.intersectObjects(buildingsGroup.children, true);
        if (hits.length > 0) {
          const hit = hits[0];
          let obj = hit.object;
          while (obj.parent && obj.parent !== buildingsGroup) obj = obj.parent as typeof obj;
          const buildingId = obj.userData?.buildingId as string | undefined;
          if (buildingId && onBuildingClick) {
            onBuildingClick(buildingId, hit);
            return;
          }
        }
      }

      // Check terrain layer
      const terrainGroup = layersRef.current['terrain'] as InstanceType<typeof import('three').Group>;
      if (terrainGroup) {
        const hits = rc.intersectObjects(terrainGroup.children, true);
        if (hits.length > 0 && onTerrainClick) {
          const p = hits[0].point;
          onTerrainClick({ x: p.x, y: p.y, z: p.z });
        }
      }
    }
    canvas.addEventListener('click', handleCanvasClick);

    // ── Cleanup ───────────────────────────────────────────────────
    return () => {
      disposed = true;
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('click', handleCanvasClick);

      // Dispose all geometries, materials, and textures in scene
      if (sceneRef.current) {
        const sc = sceneRef.current as InstanceType<typeof import('three').Scene>;
        sc.traverse((obj) => {
          const mesh = obj as unknown as {
            geometry?: { dispose: () => void };
            material?: { dispose: () => void; map?: { dispose: () => void } } |
                        { dispose: () => void; map?: { dispose: () => void } }[];
          };
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of materials) {
              if (mat.map) mat.map.dispose();
              mat.dispose();
            }
          }
        });
      }

      if (rendererRef.current) {
        (rendererRef.current as { dispose: () => void }).dispose();
      }

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      layersRef.current = {};
      buildingMap.clear();
      setIsReady(false);
    };
  }, [districtId, quality, onBuildingClick, onTerrainClick]);

  // ── Scene API ──────────────────────────────────────────────────

  const addBuilding = useCallback((buildingGroup: unknown, position: { x: number; y: number; z: number }) => {
    const group = buildingGroup as { position: { set: (x: number, y: number, z: number) => void }; userData?: Record<string, unknown> };
    group.position.set(position.x, position.y, position.z);
    const id = (group.userData?.buildingId as string) ?? `building_${Date.now()}`;
    buildingMapRef.current.set(id, buildingGroup);
    const layer = layersRef.current['buildings'] as { add: (child: unknown) => void } | undefined;
    layer?.add(buildingGroup);
  }, []);

  const removeBuilding = useCallback((id: string) => {
    const group = buildingMapRef.current.get(id) as {
      parent?: { remove: (child: unknown) => void };
    } | undefined;
    if (group?.parent) {
      group.parent.remove(group);
    }
    buildingMapRef.current.delete(id);
  }, []);

  const setWeather = useCallback((type: string, intensity: number) => {
    const weatherGroup = layersRef.current['weather'] as { userData: Record<string, unknown> } | undefined;
    if (weatherGroup) {
      weatherGroup.userData.weatherType = type;
      weatherGroup.userData.weatherIntensity = intensity;
    }
  }, []);

  const setTimeOfDay = useCallback((hour: number) => {
    const weatherGroup = layersRef.current['weather'] as { userData: Record<string, unknown> } | undefined;
    if (weatherGroup) {
      weatherGroup.userData.timeOfDay = hour;
    }
  }, []);

  const getIntersectedObject = useCallback((screenX: number, screenY: number): unknown | null => {
    if (!raycasterRef.current || !cameraRef.current || !sceneRef.current) return null;
    const rc = raycasterRef.current as { setFromCamera: (v: unknown, c: unknown) => void; intersectObjects: (o: unknown[], r: boolean) => { object: unknown }[] };
    const cam = cameraRef.current;
    const sc = sceneRef.current as { children: unknown[] };
    rc.setFromCamera({ x: screenX, y: screenY }, cam);
    const hits = rc.intersectObjects(sc.children, true);
    return hits.length > 0 ? hits[0].object : null;
  }, []);

  const sceneAPI: ConcordiaSceneAPI = {
    scene: sceneRef.current,
    camera: cameraRef.current,
    addBuilding,
    removeBuilding,
    setWeather,
    setTimeOfDay,
    getIntersectedObject,
  };

  // ── Budget bar helper ──────────────────────────────────────────

  const budgetBar = (label: string, value: number, max: number) => {
    const pct = Math.min(100, (value / max) * 100);
    const color = pct < 60 ? 'bg-green-500' : pct < 85 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div key={label} className="flex items-center gap-2 text-[10px]">
        <span className="w-16 text-white/50">{label}</span>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-20 text-right text-white/40">
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <ConcordiaSceneContext.Provider value={sceneAPI}>
      <div className="relative" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ touchAction: 'none' }}
        />

        {/* Loading overlay */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center space-y-3">
              <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto" />
              <p className="text-white/60 text-sm">Initializing Concordia 3D...</p>
              <p className="text-white/30 text-xs">District: {districtId}</p>
            </div>
          </div>
        )}

        {/* FPS counter */}
        {showFps && (
          <div className={`absolute top-2 left-2 p-2 ${panel} text-[10px] font-mono space-y-1 min-w-[200px]`}>
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-bold">
              <Activity className="w-3 h-3" />
              {performance.fps} FPS
              <span className="text-white/30 font-normal ml-1">{performance.frameTime}ms</span>
            </div>
            <div className="space-y-0.5 pt-1 border-t border-white/5">
              {budgetBar('Draw calls', performance.drawCalls, performance.maxDrawCalls)}
              {budgetBar('Triangles', performance.triangles, performance.maxTriangles)}
              {budgetBar('Tex Memory', performance.textureMemory, performance.maxTextureMemory)}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={() => setShowFps(!showFps)}
            className={`p-1.5 rounded ${panel} text-white/60 hover:text-white transition-colors`}
            title="Toggle FPS counter"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowQualitySelector(!showQualitySelector)}
              className={`p-1.5 rounded ${panel} text-white/60 hover:text-white transition-colors`}
              title="Quality settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            {showQualitySelector && (
              <div className={`absolute right-0 top-full mt-1 ${panel} p-1.5 min-w-[120px] z-50`}>
                <p className="text-[10px] text-white/40 px-2 py-0.5 mb-0.5">Quality Preset</p>
                {(['low', 'medium', 'high', 'ultra'] as QualityPreset[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => { setQuality(q); setShowQualitySelector(false); }}
                    className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                      q === quality
                        ? 'bg-blue-600/40 text-blue-300'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3 h-3 inline mr-1.5" />
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ConcordiaSceneContext.Provider>
  );
}
