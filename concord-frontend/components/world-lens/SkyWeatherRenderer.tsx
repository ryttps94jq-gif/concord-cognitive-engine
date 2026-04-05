'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────

type WeatherType = 'clear' | 'rain' | 'snow' | 'fog' | 'overcast' | 'storm';
type SkyPeriod = 'dawn' | 'day' | 'dusk' | 'night';
type Season = 'spring' | 'summer' | 'fall' | 'winter';
type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

interface SkyColors {
  sky: string;
  horizon: string;
  sun: string | null;
  ambientIntensity: number;
  directionalIntensity: number;
}

interface WeatherConfig {
  type: WeatherType;
  intensity: number; // 0-1
  windDirection: number; // degrees
  windSpeed: number; // m/s
}

interface SkyWeatherRendererProps {
  timeOfDay?: number; // 0-24
  weather?: WeatherConfig;
  season?: Season;
  quality?: QualityLevel;
  onTimeChange?: (time: number) => void;
}

// ── Constants ──────────────────────────────────────────────────────

const SKY_COLORS: Record<SkyPeriod, SkyColors> = {
  dawn:  { sky: '#ffa07a', horizon: '#ff6347', sun: '#ff4500', ambientIntensity: 0.3, directionalIntensity: 0.5 },
  day:   { sky: '#87ceeb', horizon: '#b0e0e6', sun: '#ffffff', ambientIntensity: 0.6, directionalIntensity: 1.0 },
  dusk:  { sky: '#ff6b6b', horizon: '#ff4500', sun: '#ff0000', ambientIntensity: 0.3, directionalIntensity: 0.4 },
  night: { sky: '#0a0a2e', horizon: '#1a1a3e', sun: null, ambientIntensity: 0.08, directionalIntensity: 0.05 },
};

const SHADOW_CONFIG = {
  mapSize: 2048,
  cascadeCount: 3,
  maxDistance: 100,
  bias: -0.0005,
};

const RAIN_CONFIG = {
  lightCount: 2000,
  heavyCount: 10000,
  streakLength: 0.5,
  splashEnabled: true,
  wetSurfaceReflectivity: 0.8,
};

const SNOW_CONFIG = {
  lightCount: 1000,
  heavyCount: 5000,
  driftSpeed: 0.3,
  accumulationRate: 0.01,
};

const FOG_CONFIG = {
  morningDensity: 0.015,
  eveningDensity: 0.01,
  normalDensity: 0.002,
  riverProximityBonus: 0.005,
};

const PARTICLE_BUDGETS: Record<QualityLevel, number> = {
  low: 2000,
  medium: 5000,
  high: 10000,
  ultra: 15000,
};

// ── Helpers ────────────────────────────────────────────────────────

function getSkyPeriod(timeOfDay: number): SkyPeriod {
  if (timeOfDay >= 5 && timeOfDay < 7) return 'dawn';
  if (timeOfDay >= 7 && timeOfDay < 17) return 'day';
  if (timeOfDay >= 17 && timeOfDay < 19) return 'dusk';
  return 'night';
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.replace('#', ''), 16);
  const bh = parseInt(b.replace('#', ''), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${((rr << 16) | (rg << 8) | rb).toString(16).padStart(6, '0')}`;
}

function getSunPosition(timeOfDay: number): { x: number; y: number; z: number } {
  const angle = ((timeOfDay - 6) / 12) * Math.PI; // rises at 6, peaks at 12, sets at 18
  return {
    x: Math.cos(angle) * 500,
    y: Math.max(Math.sin(angle) * 500, -100),
    z: -200,
  };
}

// ── Component ──────────────────────────────────────────────────────

export default function SkyWeatherRenderer({
  timeOfDay = 14.0,
  weather = { type: 'clear', intensity: 0, windDirection: 270, windSpeed: 8 },
  season = 'spring',
  quality = 'medium',
  onTimeChange,
}: SkyWeatherRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [initialized, setInitialized] = useState(false);

  const skyPeriod = useMemo(() => getSkyPeriod(timeOfDay), [timeOfDay]);
  const skyColors = useMemo(() => SKY_COLORS[skyPeriod], [skyPeriod]);
  const sunPos = useMemo(() => getSunPosition(timeOfDay), [timeOfDay]);
  const maxParticles = useMemo(() => PARTICLE_BUDGETS[quality], [quality]);

  // Particle count based on weather
  const particleCount = useMemo(() => {
    if (weather.type === 'rain') {
      const base = weather.intensity > 0.5 ? RAIN_CONFIG.heavyCount : RAIN_CONFIG.lightCount;
      return Math.min(base * weather.intensity, maxParticles);
    }
    if (weather.type === 'snow') {
      const base = weather.intensity > 0.5 ? SNOW_CONFIG.heavyCount : SNOW_CONFIG.lightCount;
      return Math.min(base * weather.intensity, maxParticles);
    }
    return 0;
  }, [weather, maxParticles]);

  // Fog density
  const fogDensity = useMemo(() => {
    let density = FOG_CONFIG.normalDensity;
    if (timeOfDay >= 5 && timeOfDay < 8) density = FOG_CONFIG.morningDensity;
    if (timeOfDay >= 18 && timeOfDay < 21) density = FOG_CONFIG.eveningDensity;
    if (weather.type === 'fog') density += 0.02 * weather.intensity;
    return density;
  }, [timeOfDay, weather]);

  // Snow accumulation tracking
  const [snowAccumulation, setSnowAccumulation] = useState(0);
  useEffect(() => {
    if (weather.type === 'snow' && weather.intensity > 0) {
      const interval = setInterval(() => {
        setSnowAccumulation(prev => Math.min(prev + SNOW_CONFIG.accumulationRate * weather.intensity, 1.0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [weather]);

  // Initialize Three.js sky system
  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;

    const init = async () => {
      try {
        const THREE = await import('three');
        if (disposed) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, canvasRef.current!.width / canvasRef.current!.height, 0.1, 2000);

        // Sky hemisphere
        const skyGeo = new THREE.SphereGeometry(1000, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
          uniforms: {
            topColor: { value: new THREE.Color(skyColors.sky) },
            bottomColor: { value: new THREE.Color(skyColors.horizon) },
            offset: { value: 20 },
            exponent: { value: 0.6 },
          },
          vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPosition = worldPosition.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
              float h = normalize(vWorldPosition + offset).y;
              gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
          `,
          side: THREE.BackSide,
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        scene.add(sky);

        // Sun directional light
        const sunLight = new THREE.DirectionalLight(skyColors.sun ? new THREE.Color(skyColors.sun) : new THREE.Color('#000000'), skyColors.directionalIntensity);
        sunLight.position.set(sunPos.x, sunPos.y, sunPos.z);
        if (quality !== 'low') {
          sunLight.castShadow = true;
          sunLight.shadow.mapSize.set(SHADOW_CONFIG.mapSize, SHADOW_CONFIG.mapSize);
          sunLight.shadow.camera.far = SHADOW_CONFIG.maxDistance;
          sunLight.shadow.bias = SHADOW_CONFIG.bias;
        }
        scene.add(sunLight);

        // Ambient light
        const ambientLight = new THREE.AmbientLight('#ffffff', skyColors.ambientIntensity);
        scene.add(ambientLight);

        // Stars (night only)
        if (skyPeriod === 'night' || skyPeriod === 'dusk') {
          const starCount = 2000;
          const starGeo = new THREE.BufferGeometry();
          const starPositions = new Float32Array(starCount * 3);
          for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.5;
            const r = 900;
            starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i * 3 + 1] = r * Math.cos(phi);
            starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
          }
          starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
          const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.5, sizeAttenuation: false, transparent: true, opacity: skyPeriod === 'night' ? 0.8 : 0.3 });
          scene.add(new THREE.Points(starGeo, starMat));
        }

        // Weather particles
        if (particleCount > 0) {
          const pGeo = new THREE.BufferGeometry();
          const pPositions = new Float32Array(particleCount * 3);
          const pVelocities = new Float32Array(particleCount * 3);
          for (let i = 0; i < particleCount; i++) {
            pPositions[i * 3] = (Math.random() - 0.5) * 200;
            pPositions[i * 3 + 1] = Math.random() * 100;
            pPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
            // Velocity: rain falls fast, snow falls slow
            const fallSpeed = weather.type === 'rain' ? -15 : -2;
            const windEffect = weather.windSpeed * 0.1;
            pVelocities[i * 3] = Math.sin(weather.windDirection * Math.PI / 180) * windEffect;
            pVelocities[i * 3 + 1] = fallSpeed;
            pVelocities[i * 3 + 2] = Math.cos(weather.windDirection * Math.PI / 180) * windEffect;
          }
          pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
          const pMat = new THREE.PointsMaterial({
            color: weather.type === 'rain' ? '#aaccff' : '#ffffff',
            size: weather.type === 'rain' ? 0.1 : 0.3,
            transparent: true,
            opacity: 0.6,
          });
          const particles = new THREE.Points(pGeo, pMat);
          scene.add(particles);
        }

        // Fog
        if (fogDensity > 0.003 || weather.type === 'fog') {
          scene.fog = new THREE.FogExp2(skyColors.horizon, fogDensity);
        }

        setInitialized(true);
      } catch {
        // Three.js not available
        setInitialized(false);
      }
    };

    init();
    return () => { disposed = true; cancelAnimationFrame(frameRef.current); };
  }, [timeOfDay, weather, quality, skyPeriod]);

  // Season-specific weather descriptions
  const seasonWeather: Record<Season, string> = {
    spring: 'Occasional rain showers test drainage. Mild temps.',
    summer: 'Heat waves test thermal expansion. Long daylight hours.',
    fall: 'Cooling temps, wind gusts test structural stability.',
    winter: 'Snow accumulation tests roof loads. Freeze-thaw cycles.',
  };

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: -1 }} />

      {/* Sky/Weather info overlay */}
      <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm border border-white/10 rounded px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-white/70">{skyPeriod === 'night' ? '🌙' : skyPeriod === 'dawn' ? '🌅' : skyPeriod === 'dusk' ? '🌇' : '☀️'}</span>
          <span className="text-white">{Math.floor(timeOfDay)}:{String(Math.floor((timeOfDay % 1) * 60)).padStart(2, '0')}</span>
          <span className="text-white/40 capitalize">{skyPeriod}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{weather.type === 'rain' ? '🌧' : weather.type === 'snow' ? '🌨' : weather.type === 'fog' ? '🌫' : weather.type === 'storm' ? '⛈' : '☀️'}</span>
          <span className="text-white/70 capitalize">{weather.type}</span>
          {weather.intensity > 0 && <span className="text-white/40">({Math.round(weather.intensity * 100)}%)</span>}
        </div>
        <div className="flex items-center gap-2 text-white/40">
          <span>💨 {weather.windSpeed}m/s</span>
          <span>{weather.windDirection}°</span>
        </div>
        {weather.type === 'snow' && snowAccumulation > 0 && (
          <div className="text-blue-300">❄ Snow depth: {(snowAccumulation * 30).toFixed(1)}cm</div>
        )}
        <div className="text-white/30 capitalize">{season} — {seasonWeather[season]}</div>
      </div>

      {/* Performance info */}
      <div className="absolute bottom-2 right-2 text-[10px] text-white/20">
        Particles: {Math.round(particleCount)} | Fog: {fogDensity.toFixed(4)} | Shadows: {quality !== 'low' ? 'on' : 'off'} | Quality: {quality}
      </div>

      {/* Expose state for ConcordiaScene consumption */}
      <div className="hidden"
        data-sky-weather="true"
        data-time={timeOfDay}
        data-period={skyPeriod}
        data-sky-colors={JSON.stringify(skyColors)}
        data-sun-position={JSON.stringify(sunPos)}
        data-weather={JSON.stringify(weather)}
        data-fog-density={fogDensity}
        data-shadow-config={JSON.stringify(SHADOW_CONFIG)}
        data-snow-accumulation={snowAccumulation}
        data-particle-count={particleCount}
        data-initialized={initialized}
      />
    </div>
  );
}
