/**
 * TextureForge — Procedural PBR CanvasTexture Generator
 *
 * Generates deterministic PBR texture pairs (map + roughnessMap) for all
 * building material types. All textures are cached by key and never regenerated.
 *
 * Resolution ladder: low=128, medium=256, high/ultra=512
 */

type TextureQuality = 'low' | 'medium' | 'high' | 'ultra';

interface TexturePair {
  map: HTMLCanvasElement;
  roughnessMap: HTMLCanvasElement;
}

function getResolution(quality: TextureQuality): number {
  if (quality === 'low') return 128;
  if (quality === 'medium') return 256;
  return 512;
}

function createCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Brick ───────────────────────────────────────────────────────────────────

function makeBrick(variant: 'red' | 'gray' | 'white', quality: TextureQuality): TexturePair {
  const size = getResolution(quality);
  const map = createCanvas(size);
  const rough = createCanvas(size);
  const mc = map.getContext('2d')!;
  const rc = rough.getContext('2d')!;

  const colors: Record<typeof variant, { brick: string; mortar: string }> = {
    red:   { brick: '#8b3a2a', mortar: '#c4b49a' },
    gray:  { brick: '#7a7a7a', mortar: '#b0a898' },
    white: { brick: '#e8e0d0', mortar: '#d4ccc0' },
  };
  const { brick: brickColor, mortar } = colors[variant];

  const brickW = size / 4;
  const brickH = size / 8;
  const mortarW = Math.max(1, size / 64);

  mc.fillStyle = mortar;
  mc.fillRect(0, 0, size, size);

  const rand = seededRandom(variant.charCodeAt(0));
  for (let row = 0; row < size / brickH; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < size / brickW + 1; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;
      // Slight color variation per brick
      const v = (rand() - 0.5) * 20;
      mc.fillStyle = shiftColor(brickColor, v);
      mc.fillRect(
        x + mortarW, y + mortarW,
        brickW - mortarW * 2, brickH - mortarW * 2,
      );
    }
  }

  // Roughness: mortar lighter (more rough), brick darker (less rough)
  rc.fillStyle = '#cccccc';
  rc.fillRect(0, 0, size, size);
  for (let row = 0; row < size / brickH; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < size / brickW + 1; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;
      rc.fillStyle = '#555555';
      rc.fillRect(x + mortarW, y + mortarW, brickW - mortarW * 2, brickH - mortarW * 2);
    }
  }

  return { map, roughnessMap: rough };
}

// ── Concrete ────────────────────────────────────────────────────────────────

function makeConcrete(weathering: number, quality: TextureQuality): TexturePair {
  const size = getResolution(quality);
  const map = createCanvas(size);
  const rough = createCanvas(size);
  const mc = map.getContext('2d')!;
  const rc = rough.getContext('2d')!;

  const base = Math.round(160 - weathering * 40);
  mc.fillStyle = `rgb(${base},${base},${base})`;
  mc.fillRect(0, 0, size, size);

  const rand = seededRandom(Math.round(weathering * 1000));

  // Stain blobs
  const stainCount = Math.round(weathering * 20);
  for (let i = 0; i < stainCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = rand() * size * 0.08 + size * 0.02;
    const grad = mc.createRadialGradient(x, y, 0, x, y, r);
    const darkness = Math.round(base * (0.7 + rand() * 0.2));
    grad.addColorStop(0, `rgba(${darkness},${darkness},${darkness},0.6)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    mc.fillStyle = grad;
    mc.beginPath();
    mc.arc(x, y, r, 0, Math.PI * 2);
    mc.fill();
  }

  // Hairline cracks
  const crackCount = Math.round(weathering * 8);
  mc.strokeStyle = `rgba(60,60,60,0.4)`;
  mc.lineWidth = 1;
  for (let i = 0; i < crackCount; i++) {
    mc.beginPath();
    let cx = rand() * size;
    let cy = rand() * size;
    mc.moveTo(cx, cy);
    const steps = 4 + Math.round(rand() * 6);
    for (let s = 0; s < steps; s++) {
      cx += (rand() - 0.5) * size * 0.12;
      cy += rand() * size * 0.08;
      mc.bezierCurveTo(
        cx + (rand() - 0.5) * 10, cy + rand() * 8,
        cx + (rand() - 0.5) * 10, cy + rand() * 8,
        cx, cy,
      );
    }
    mc.stroke();
  }

  // Roughness: uniform high
  rc.fillStyle = `#${Math.round(180 + weathering * 60).toString(16).padStart(2, '0').repeat(3)}`;
  rc.fillRect(0, 0, size, size);

  return { map, roughnessMap: rough };
}

// ── Wood ────────────────────────────────────────────────────────────────────

function makeWood(grain: 'pine' | 'oak' | 'dark', quality: TextureQuality): TexturePair {
  const size = getResolution(quality);
  const map = createCanvas(size);
  const rough = createCanvas(size);
  const mc = map.getContext('2d')!;
  const rc = rough.getContext('2d')!;

  const palettes: Record<typeof grain, [number, number, number]> = {
    pine: [210, 165, 100],
    oak:  [160, 115, 75],
    dark: [90,  65,  40],
  };
  const [r0, g0, b0] = palettes[grain];
  const rand = seededRandom(grain.charCodeAt(0));

  // Horizontal grain stripes
  for (let y = 0; y < size; y++) {
    const wave = Math.sin(y * 0.15 + rand() * 0.5) * 8;
    const bright = 1 + (rand() - 0.5) * 0.15;
    mc.fillStyle = `rgb(${Math.round(r0 * bright + wave)},${Math.round(g0 * bright + wave * 0.5)},${Math.round(b0 * bright)})`;
    mc.fillRect(0, y, size, 1);
  }

  // Knot bulges
  const knotCount = 2 + Math.round(rand() * 3);
  for (let k = 0; k < knotCount; k++) {
    const kx = rand() * size;
    const ky = rand() * size;
    const kr = size * 0.04 + rand() * size * 0.04;
    const grad = mc.createRadialGradient(kx, ky, 0, kx, ky, kr);
    grad.addColorStop(0, `rgb(${Math.round(r0 * 0.6)},${Math.round(g0 * 0.6)},${Math.round(b0 * 0.6)})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    mc.fillStyle = grad;
    mc.beginPath();
    mc.ellipse(kx, ky, kr, kr * 0.6, 0, 0, Math.PI * 2);
    mc.fill();
  }

  // Roughness
  rc.fillStyle = '#888888';
  rc.fillRect(0, 0, size, size);

  return { map, roughnessMap: rough };
}

// ── Metal ────────────────────────────────────────────────────────────────────

function makeMetal(type: 'brushed' | 'corroded' | 'polished', quality: TextureQuality): TexturePair {
  const size = getResolution(quality);
  const map = createCanvas(size);
  const rough = createCanvas(size);
  const mc = map.getContext('2d')!;
  const rc = rough.getContext('2d')!;
  const rand = seededRandom(type.charCodeAt(0) * 7);

  if (type === 'brushed') {
    mc.fillStyle = '#b0b0b8';
    mc.fillRect(0, 0, size, size);
    mc.strokeStyle = 'rgba(180,180,192,0.3)';
    mc.lineWidth = 1;
    for (let y = 0; y < size; y += 2) {
      mc.beginPath();
      mc.moveTo(0, y + rand() * 1.5);
      mc.lineTo(size, y + rand() * 1.5);
      mc.stroke();
    }
    rc.fillStyle = '#444444';
    rc.fillRect(0, 0, size, size);
  } else if (type === 'corroded') {
    mc.fillStyle = '#7a7a6a';
    mc.fillRect(0, 0, size, size);
    const blotCount = 30;
    for (let i = 0; i < blotCount; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = rand() * size * 0.06 + 2;
      mc.fillStyle = `rgba(${120 + Math.round(rand() * 60)},${60 + Math.round(rand() * 30)},20,0.7)`;
      mc.beginPath();
      mc.arc(x, y, r, 0, Math.PI * 2);
      mc.fill();
    }
    rc.fillStyle = '#aaaaaa';
    rc.fillRect(0, 0, size, size);
  } else {
    // polished: gradient
    const grad = mc.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#d4d4dc');
    grad.addColorStop(0.5, '#f0f0f8');
    grad.addColorStop(1, '#b0b0b8');
    mc.fillStyle = grad;
    mc.fillRect(0, 0, size, size);
    rc.fillStyle = '#222222';
    rc.fillRect(0, 0, size, size);
  }

  return { map, roughnessMap: rough };
}

// ── Glass ────────────────────────────────────────────────────────────────────

function makeGlass(tint: string, quality: TextureQuality): TexturePair {
  const size = getResolution(quality);
  const map = createCanvas(size);
  const rough = createCanvas(size);
  const mc = map.getContext('2d')!;
  const rc = rough.getContext('2d')!;

  const grad = mc.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, tint);
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(1, tint);
  mc.fillStyle = grad;
  mc.fillRect(0, 0, size, size);

  // Edge Fresnel brightness
  const edge = mc.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.7);
  edge.addColorStop(0, 'rgba(255,255,255,0)');
  edge.addColorStop(1, 'rgba(255,255,255,0.3)');
  mc.fillStyle = edge;
  mc.fillRect(0, 0, size, size);

  rc.fillStyle = '#222222';
  rc.fillRect(0, 0, size, size);

  return { map, roughnessMap: rough };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shiftColor(hex: string, shift: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + shift));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + shift));
  const b = Math.min(255, Math.max(0, (n & 0xff) + shift));
  return `rgb(${r},${g},${b})`;
}

// ── Singleton Cache ──────────────────────────────────────────────────────────

class TextureForgeClass {
  private cache = new Map<string, TexturePair>();
  private quality: TextureQuality = 'medium';

  setQuality(q: TextureQuality) {
    this.quality = q;
  }

  private get<T>(key: string, factory: () => TexturePair): TexturePair {
    if (!this.cache.has(key)) {
      this.cache.set(key, factory());
    }
    return this.cache.get(key)!;
  }

  getBrick(variant: 'red' | 'gray' | 'white' = 'red'): TexturePair {
    return this.get(`brick-${variant}-${this.quality}`, () => makeBrick(variant, this.quality));
  }

  getConcrete(weathering: number = 0.3): TexturePair {
    const w = Math.round(weathering * 10) / 10;
    return this.get(`concrete-${w}-${this.quality}`, () => makeConcrete(w, this.quality));
  }

  getWood(grain: 'pine' | 'oak' | 'dark' = 'oak'): TexturePair {
    return this.get(`wood-${grain}-${this.quality}`, () => makeWood(grain, this.quality));
  }

  getMetal(type: 'brushed' | 'corroded' | 'polished' = 'brushed'): TexturePair {
    return this.get(`metal-${type}-${this.quality}`, () => makeMetal(type, this.quality));
  }

  getGlass(tint: string = '#aaddff'): TexturePair {
    return this.get(`glass-${tint}-${this.quality}`, () => makeGlass(tint, this.quality));
  }

  /** Clear cache (e.g. on quality setting change) */
  clear() {
    this.cache.clear();
  }
}

export const TextureForge = new TextureForgeClass();
