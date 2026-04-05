/**
 * World Lens — 3D Renderer Type Definitions
 *
 * All types for the Concordia Three.js 3D renderer system: scene
 * architecture, camera, terrain, water, buildings, avatars, lighting,
 * weather, infrastructure, bridges, validation visualisation, spatial
 * audio, particles/VFX, networking, mobile, and performance presets.
 */

// ── Scene Architecture ─────────────────────────────────────────────

export type RendererType = 'webgpu' | 'webgl2';

export type SceneLayer =
  | 'terrain'
  | 'buildings'
  | 'infrastructure'
  | 'avatars'
  | 'weather'
  | 'ui'
  | 'water'
  | 'particles';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface SceneConfig {
  rendererType: RendererType;
  /** Shadow map quality tier. */
  shadowQuality: QualityPreset;
  /** Maximum draw calls per frame. */
  maxDrawCalls: number; // default 500
  /** Maximum triangles per frame. */
  maxTriangles: number; // default 2_000_000
  /** Maximum texture memory budget in megabytes. */
  maxTextureMemory: number; // default 512
  /** Active scene layers. */
  layers: SceneLayer[];
  /** Quality preset governing all derived settings. */
  qualityPreset: QualityPreset;
}

export interface PerformanceBudget {
  drawCalls: number;
  triangles: number;
  textureMemoryMB: number;
  animatedAvatars: number;
  particleCount: number;
  shadowMapSize: number;
}

export interface RenderStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  /** Texture memory consumed in megabytes. */
  textureMemory: number;
  /** GPU frame time in milliseconds. */
  gpuTime: number;
}

// ── Camera System ──────────────────────────────────────────────────

export type CameraMode3D =
  | 'third-person'
  | 'top-down'
  | 'interior'
  | 'cinematic'
  | 'free';

export interface ThirdPersonConfig {
  distance: number;
  minDistance: number; // default 3
  maxDistance: number; // default 20
  /** Horizontal angle in degrees. */
  azimuth: number;
  /** Vertical angle in degrees. */
  elevation: number; // default 45
  minElevation: number; // default 10
  maxElevation: number; // default 80
  /** Interpolation smoothing factor (0–1). */
  smoothing: number; // default 0.08
  collisionEnabled: boolean;
}

export interface TopDownConfig {
  height: number;
  minHeight: number;
  maxHeight: number;
  panSpeed: number;
  edgeScrollEnabled: boolean;
}

export interface InteriorConfig {
  /** Field of view in degrees. */
  fov: number;
  nearClip: number;
  /** Height offset above floor in meters. */
  heightOffset: number;
  mouseSensitivity: number;
}

export interface CinematicKeyframe {
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  fov: number;
  /** Timestamp within the path in seconds. */
  timestamp: number;
}

export interface CinematicPath {
  keyframes: CinematicKeyframe[];
  /** Total duration in seconds. */
  duration: number;
  easing: string;
}

export interface CameraTransition3D {
  fromMode: CameraMode3D;
  toMode: CameraMode3D;
  /** Transition duration in seconds. */
  duration: number; // default 0.5
  easing: string;
}

// ── Terrain ────────────────────────────────────────────────────────

export interface TerrainConfig {
  /** Terrain width in meters. */
  width: number; // default 2000
  /** Terrain depth in meters. */
  depth: number; // default 1500
  /** Heightmap resolution (pixels per axis). */
  resolution: number; // default 2048
  /** Number of LOD levels. */
  lodLevels: number; // default 3
}

export interface TerrainLODLevel {
  /** Distance threshold for this LOD level. */
  distance: number;
  /** Vertex density per unit area. */
  vertexDensity: number;
}

export type TerrainMaterialZone =
  | 'cobblestone'
  | 'asphalt'
  | 'brick-sidewalk'
  | 'grass'
  | 'garden-path'
  | 'gravel'
  | 'packed-dirt'
  | 'concrete'
  | 'wild-grass'
  | 'mud'
  | 'moss'
  | 'stone-path';

export interface HeightmapData {
  width: number;
  height: number;
  data: Float32Array;
  minElevation: number;
  maxElevation: number;
}

export interface TerrainChunk {
  x: number;
  z: number;
  lodLevel: number;
  /** Reference to the Three.js mesh (typed loosely to avoid hard dep). */
  mesh: unknown;
  loaded: boolean;
}

// ── Water ──────────────────────────────────────────────────────────

export type WaterBodyType = 'river' | 'creek' | 'lake';

export interface WaterConfig {
  type: WaterBodyType;
  flowSpeed: number;
  waveAmplitude: number;
  /** Deep water color (hex). */
  deepColor: string;
  /** Shallow water color (hex). */
  shallowColor: string;
  foamThreshold: number;
  reflectionEnabled: boolean;
  refractionEnabled: boolean;
}

export type RiverEdge = 'west' | 'east' | 'north' | 'south';
export type FlowDirection = 'north' | 'south' | 'east' | 'west';

export interface RiverConfig extends WaterConfig {
  type: 'river';
  edge: RiverEdge; // default 'west'
  /** River width in meters. */
  width: number; // default 200
  flowDirection: FlowDirection; // default 'south'
}

export interface SplinePoint {
  x: number;
  y: number;
  z: number;
}

export interface CreekConfig extends WaterConfig {
  type: 'creek';
  /** Spline points defining the creek path. */
  path: SplinePoint[];
  /** Creek width in meters. */
  width: number; // default 5
  /** Creek depth in meters. */
  depth: number; // default 2
}

// ── Buildings ──────────────────────────────────────────────────────

export type BuildingLODLevel = 'full' | 'simplified' | 'box-proxy' | 'billboard';

export interface BuildingLODConfig {
  /** Distance for full-detail geometry. */
  fullDistance: number; // default 50
  /** Distance for simplified geometry. */
  simplifiedDistance: number; // default 200
  /** Distance for box proxy. */
  boxDistance: number; // default 500
  /** Distance for billboard sprite. */
  billboardDistance: number;
}

export interface MaterialPBRMap {
  /** Base color (hex). */
  baseColor: string;
  /** Path or key for the diffuse texture. */
  diffuseMap?: string;
  /** Path or key for the normal map. */
  normalMap?: string;
  /** Path or key for the roughness map. */
  roughnessMap?: string;
  /** Metalness factor (0–1). */
  metalness: number;
  /** Roughness factor (0–1). */
  roughness: number;
  transparent: boolean;
  opacity: number;
}

export type MaterialCategory =
  | 'usb-smooth-matte'
  | 'brick'
  | 'stone'
  | 'wood'
  | 'steel'
  | 'concrete'
  | 'glass';

/**
 * Mapping of material categories to their PBR properties.
 *
 * - usb-smooth-matte: smooth matte surface
 * - brick: red with mortar lines, includes normal map
 * - stone: rough gray surface
 * - wood: warm grain texture
 * - steel: metallic, reflective
 * - concrete: gray, rough
 * - glass: transparent with Fresnel effect
 */
export type MaterialAppearance = Record<MaterialCategory, MaterialPBRMap>;

export interface BuildingInterior {
  loaded: boolean;
  /** Interior geometry reference. */
  geometry: unknown;
  /** Furniture placement data. */
  furniture: unknown[];
  /** Interior light sources. */
  lights: InteriorLightSource[];
  /** Slots for NPCs inside the building. */
  npcSlots: Array<{
    position: { x: number; y: number; z: number };
    facing: number;
    occupantId?: string;
  }>;
}

// ── Avatars ────────────────────────────────────────────────────────

export interface AvatarModel3D {
  /** Body mesh reference (Three.js SkinnedMesh). */
  bodyMesh: unknown;
  /** Skeleton reference. */
  skeleton: unknown;
  /** Animation mixer reference. */
  mixer: unknown;
  /** Map of animation name to clip reference. */
  animations: Map<AvatarAnimation3D, unknown>;
}

export type AvatarAnimation3D =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sit'
  | 'build'
  | 'inspect'
  | 'wave'
  | 'clap'
  | 'point'
  | 'celebrate'
  | 'craft';

export interface CharacterControllerConfig {
  /** Movement speed in m/s. */
  moveSpeed: number; // default 4.0
  /** Run speed in m/s. */
  runSpeed: number; // default 8.0
  /** Jump height in meters. */
  jumpHeight: number; // default 1.0
  /** Maximum slope angle in degrees. */
  slopeLimit: number; // default 45
  /** Maximum step height in meters. */
  stepHeight: number; // default 0.3
}

export type NPCAnimation3D =
  | 'hammer'
  | 'read'
  | 'tend-crops'
  | 'patrol'
  | 'count-coins'
  | 'construct'
  | 'sweep'
  | 'lecture';

export interface AvatarAppearance3D {
  /** Skin color (hex). */
  skinColor: string;
  hairStyle: string;
  clothing: string;
  professionBadge?: string;
  firmEmblem?: string;
  nameTag: string;
}

export interface AvatarLODConfig {
  /** Distance for full avatar mesh. */
  fullDistance: number; // default 50
  /** Distance for simplified mesh. */
  simplifiedDistance: number; // default 100
  /** Distance where only the nametag is shown. */
  nameTagOnly: number; // default 200
}

// ── Lighting & Sky ─────────────────────────────────────────────────

export interface SkyConfig {
  /** Current time of day (0–24, fractional hours). */
  timeOfDay: number;
  /** Speed multiplier for the day/night cycle. */
  dayNightCycleSpeed: number;
  /** Sun position in world space. */
  sunPosition: { x: number; y: number; z: number };
  /** Moon position in world space. */
  moonPosition: { x: number; y: number; z: number };
  starFieldEnabled: boolean;
}

export interface TimeOfDayColors {
  /** Sky colour (hex). */
  sky: string;
  /** Horizon colour (hex). */
  horizon: string;
  /** Sun disc colour (hex). */
  sun: string;
  /** Ambient light intensity (0–1). */
  ambientIntensity: number;
  /** Directional light intensity (0–1). */
  directionalIntensity: number;
}

export type SkyPeriod = 'dawn' | 'day' | 'dusk' | 'night';

export type SkyPeriodColors = Record<SkyPeriod, TimeOfDayColors>;

export interface ShadowConfig {
  /** Shadow map resolution (pixels). */
  mapSize: number; // default 2048
  /** Number of cascaded shadow map splits. */
  cascadeCount: number; // default 3
  /** Maximum shadow render distance. */
  maxDistance: number; // default 100
  /** Depth bias to reduce shadow acne. */
  bias: number;
}

export type InteriorLightType = 'overhead' | 'window' | 'lamp' | 'fixture';

export interface InteriorLightSource {
  type: InteriorLightType;
  position: { x: number; y: number; z: number };
  /** Light colour (hex). */
  color: string;
  intensity: number;
  /** Light range in meters. */
  range: number;
}

// ── Weather Rendering ──────────────────────────────────────────────

export type WeatherType = 'rain' | 'snow' | 'fog' | 'wind' | 'clouds';

export interface WeatherRenderConfig {
  type: WeatherType;
  /** Weather intensity (0–1). */
  intensity: number;
}

export interface RainConfig {
  /** Number of rain particles (2000–10000). */
  particleCount: number;
  /** Visual length of each rain streak. */
  streakLength: number;
  splashEnabled: boolean;
  /** Enable wet surface shader on terrain and buildings. */
  wetSurfaceShader: boolean;
  /** Render puddle decals on flat surfaces. */
  puddleDecals: boolean;
}

export interface SnowConfig {
  particleCount: number;
  /** Horizontal drift speed. */
  driftSpeed: number;
  /** Snow accumulation rate (units per hour). */
  accumulationRate: number;
  /** Show warning when snow load exceeds structural limits. */
  snowLoadWarningEnabled: boolean;
}

export type FogType = 'exponential';

export interface FogConfig {
  type: FogType;
  density: number;
  /** Fog colour (hex). */
  color: string;
  /** Whether fog burns off in the morning. */
  morningBurnoff: boolean;
  /** Whether fog rolls in during the evening. */
  eveningRollin: boolean;
}

export interface CloudShadowConfig {
  enabled: boolean;
  speed: number;
  density: number;
  shadowMapSize: number;
}

export interface WindConfig {
  /** Wind direction in degrees. */
  direction: number;
  /** Wind speed in m/s. */
  speed: number;
  affectsRain: boolean;
  affectsSnow: boolean;
  affectsTrees: boolean;
  affectsFlags: boolean;
}

// ── Infrastructure 3D ──────────────────────────────────────────────

export type InfrastructureStyle = 'underground' | 'surface' | 'overhead';

export interface InfrastructureRenderConfig {
  type: string;
  /** Render colour (hex). */
  color: string;
  style: InfrastructureStyle;
  glowEnabled: boolean;
  pulseAnimation: boolean;
}

export interface WaterMainRender {
  /** Pipe colour (hex blue). */
  color: string;
  translucent: boolean;
  belowGround: boolean;
}

export interface PowerLineRender {
  /** Cable colour (hex yellow). */
  color: string;
  /** Cable geometry reference. */
  cableGeometry: unknown;
  /** Distance between poles in meters. */
  poleSpacing: number;
  glowEffect: boolean;
}

export interface RoadRender {
  laneCount: number;
  laneMarkings: boolean;
  /** Curb height in meters. */
  curbHeight: number;
  /** Sidewalk width in meters. */
  sidewalkWidth: number;
  /** Surface wear level (0–1). */
  wearLevel: number;
}

// ── Bridges ────────────────────────────────────────────────────────

export interface WalkwayBridgeConfig {
  /** Bridge length in meters. */
  length: number;
  /** Bridge height above water in meters. */
  height: number;
  deckMaterial: string;
  trussStyle: string;
  railingStyle: string;
  /** Whether a portal platform exists at the midpoint. */
  portalPlatformAtMidpoint: boolean;
  lightingConfig: InteriorLightSource[];
}

export interface CrossingBridgeConfig {
  /** Bridge length in meters. */
  length: number;
  /** Bridge width in meters. */
  width: number;
  cableStayedTowers: boolean;
  laneCount: number;
  railTrack: boolean;
}

// ── Validation Visualization 3D ────────────────────────────────────

export type StressVisualizationMode = 'realtime-glow' | 'heatmap' | 'failure-anim';

export interface StressVisualization {
  mode: StressVisualizationMode;
}

export interface StressGlowLevel {
  /** Emissive colour (hex). */
  emissiveColor: string;
  /** Pulse rate in Hz. */
  pulseRate: number;
}

/**
 * Maps stress-ratio ranges to emissive colours and pulse rates.
 * Keys are range labels such as '0-0.3', '0.3-0.6', '0.6-0.85', '0.85-1.0'.
 */
export type StressGlowConfig = Record<string, StressGlowLevel>;

export interface HeatmapConfig {
  /** Ordered colour scale from low stress (blue) to high stress (red). */
  colorScale: string[];
  /** Overlay opacity (0–1). */
  opacity: number;
}

export type DeformationType = 'bend' | 'compress' | 'separate';

export interface FailureDeformation {
  memberId: string;
  deformationType: DeformationType;
  /** Deformation magnitude (0–1). */
  magnitude: number;
  dustParticles: boolean;
  /** Sound effect identifier. */
  sound: string;
}

// ── Spatial Audio ──────────────────────────────────────────────────

export type AudioFalloffModel = 'inverse' | 'linear' | 'exponential';

export interface SpatialAudioConfig {
  /** Entity the listener is attached to. */
  listenerAttachedTo: 'camera';
  maxSources: number;
  falloffModel: AudioFalloffModel;
  /** Reference distance at which volume is 1.0. */
  refDistance: number;
  maxDistance: number;
}

export interface AmbientBed {
  districtId: string;
  audioSrc: string;
  volume: number;
  /** Radius over which the bed fades out. */
  fadeRadius: number;
}

export interface PointAudioSource {
  id: string;
  position: { x: number; y: number; z: number };
  audioSrc: string;
  volume: number;
  refDistance: number;
  maxDistance: number;
  loop: boolean;
}

export interface AudioCrossfade {
  fromDistrict: string;
  toDistrict: string;
  /** Distance over which crossfade occurs. */
  transitionDistance: number; // default 50
  /** Percentage of overlap during crossfade (0–1). */
  overlapPercent: number;
}

// ── Particles & VFX 3D ────────────────────────────────────────────

export interface ParticleSystem3D {
  type: string;
  maxParticles: number;
  emitterPosition: { x: number; y: number; z: number };
  config: unknown;
}

export interface ConstructionVFX3D {
  /** Number of particles in the burst. */
  burstCount: number; // default 50
  /** Particle colour key. */
  color: string; // default 'blue-white'
  /** Particle lifetime in seconds. */
  lifetime: number; // default 0.3
}

export interface ValidationPassVFX3D {
  type: 'expanding-ring';
  /** Ring colour (hex or named). */
  color: string; // default green
  /** Effect duration in seconds. */
  duration: number; // default 1.0
}

export interface ForgeGlowVFX {
  /** Point light colour (hex or named). */
  pointLightColor: string; // default orange
  emberCount: number;
  /** Ember lifetime in seconds. */
  emberLifetime: number;
  /** Maximum distance at which the glow is visible. */
  visibleDistance: number;
}

export interface PortalVFX {
  vortexParticles: number;
  /** Theme colour (hex or named). */
  themeColor: string;
  /** Swirl rotation speed in radians per second. */
  swirlSpeed: number;
}

// ── Networking ─────────────────────────────────────────────────────

export interface WorldStatePayload {
  terrain: unknown;
  buildings: unknown[];
  infrastructure: unknown[];
  npcs: unknown[];
  players: unknown[];
}

export interface PlayerUpdatePacket {
  userId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  animationState: AvatarAnimation3D;
  timestamp: number;
}

export interface NPCUpdatePacket {
  npcId: string;
  position: { x: number; y: number; z: number };
  animationState: NPCAnimation3D;
  timestamp: number;
}

export type BuildingUpdateType = 'place' | 'modify' | 'remove';

export interface BuildingUpdatePacket {
  type: BuildingUpdateType;
  dtuId: string;
  data: unknown;
}

export interface StreamingConfig {
  /** Radius around the player within which chunks are loaded. */
  chunkRadius: number; // default 500
  /** Radius beyond which chunks are unloaded. */
  unloadRadius: number; // default 600
  /** Player position update rate in Hz. */
  playerUpdateHz: number; // default 10
  /** NPC position update rate in Hz. */
  npcUpdateHz: number; // default 2
}

// ── Mobile ─────────────────────────────────────────────────────────

export interface MobileRenderConfig {
  /** Force WebGL-only rendering on mobile. */
  webglOnly: boolean; // default true
  shadowsOff: boolean;
  reflectionsOff: boolean;
  /** Halve all LOD distances for tighter budget. */
  lodDistancesHalved: boolean;
  /** Maximum simultaneously-animated avatars. */
  maxAnimatedAvatars: number; // default 20
  /** Halve all particle counts. */
  particleCountHalved: boolean;
  touchControls: TouchControlConfig;
}

export interface TouchControlConfig {
  virtualJoystick: boolean;
  cameraDrag: boolean;
  tapToInteract: boolean;
  pinchToZoom: boolean;
}

// ── Performance / Quality Settings ─────────────────────────────────

export interface QualitySettings {
  preset: QualityPreset;
  rendererType: RendererType;
  shadows: boolean;
  /** Shadow type when shadows are enabled. */
  shadowType?: 'basic' | 'cascaded';
  reflections: boolean;
  /** Reflection technique when enabled. */
  reflectionType?: 'screen-space' | 'planar';
  /** Screen-space ambient occlusion. */
  ssao: boolean;
  /** Volumetric fog. */
  volumetricFog: boolean;
  /** Target FPS. */
  targetFps: number;
  /** Shadow map resolution (pixels) when shadows are enabled. */
  shadowMapSize?: number;
  /** Performance budget associated with this preset. */
  budget: PerformanceBudget;
}

/**
 * Canonical quality presets.
 *
 * - Low:   webgl2, no shadows, no reflections, 30 fps
 * - Medium: webgl2, basic shadows, screen-space reflections, 60 fps
 * - High:  webgpu, cascaded shadows, planar reflections, SSAO, 60 fps
 * - Ultra: webgpu, everything on, volumetric fog, high-res shadows
 */
export type QualitySettingsMap = Record<QualityPreset, QualitySettings>;
