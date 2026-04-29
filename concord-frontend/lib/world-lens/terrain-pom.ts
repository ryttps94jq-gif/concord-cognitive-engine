/**
 * terrain-pom.ts
 *
 * Parallax Occlusion Mapping (POM) for terrain surfaces.
 *
 * Problem: Terrain tiles are flat geometry with texture — cobblestones look
 * painted on rather than physically raised. Normal maps improve lighting but
 * don't create self-shadowing or the parallax offset when you look at a
 * surface from an angle. POM fixes both by ray-marching into a height map
 * inside the shader, offsetting UVs to simulate geometry depth without
 * adding a single extra triangle.
 *
 * Result: cobblestones look like they're actually raised from the ground,
 * bricks cast shadows on each other, gravel looks deep, all at near-zero
 * geometry cost.
 *
 * Technique: Policarpo et al. (2005) Parallax Occlusion Mapping.
 * Steps:
 *   1. Ray-march along the view vector through the height field.
 *   2. Find the first height field intersection (where the ray goes "below" the surface).
 *   3. Binary search refine the intersection for precision.
 *   4. Offset UVs to that intersection point for diffuse/normal sampling.
 *   5. Self-shadow: cast a second ray toward the light to see if it's occluded.
 */

import * as THREE from 'three';

// ── POM Vertex Shader ─────────────────────────────────────────────────────────

const POM_VERTEX = /* glsl */`
  varying vec2 vUv;
  varying vec3 vTangentViewDir;
  varying vec3 vTangentLightDir;
  varying vec3 vWorldPos;

  uniform vec3 uLightDir;

  void main() {
    vUv          = uv;
    vWorldPos    = (modelMatrix * vec4(position, 1.0)).xyz;

    // Compute TBN matrix for tangent-space conversions
    vec3 N = normalize(normalMatrix * normal);
    vec3 T = normalize(normalMatrix * tangent.xyz);
    vec3 B = cross(N, T) * tangent.w;

    mat3 TBN    = transpose(mat3(T, B, N));
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    vTangentViewDir  = TBN * viewDir;
    vTangentLightDir = TBN * normalize(-uLightDir);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── POM Fragment Shader ───────────────────────────────────────────────────────

const POM_FRAGMENT = /* glsl */`
  precision highp float;

  uniform sampler2D uHeightMap;
  uniform sampler2D uDiffuseMap;
  uniform sampler2D uNormalMap;
  uniform float     uHeightScale;    // depth amplitude (0.02–0.1)
  uniform float     uMinLayers;      // min ray-march steps
  uniform float     uMaxLayers;      // max ray-march steps (quality)
  uniform vec3      uAmbient;
  uniform vec3      uLightColor;

  varying vec2 vUv;
  varying vec3 vTangentViewDir;
  varying vec3 vTangentLightDir;
  varying vec3 vWorldPos;

  // POM: ray-march into height field, return parallax-corrected UV
  vec2 pomUV(vec2 uv, vec3 viewDir) {
    // Adaptive layer count: more layers when viewed at grazing angles
    float numLayers = mix(uMaxLayers, uMinLayers, abs(viewDir.z));
    float layerDepth = 1.0 / numLayers;

    vec2  deltaUV      = (viewDir.xy / viewDir.z) * uHeightScale / numLayers;
    vec2  currentUV    = uv;
    float currentDepth = 0.0;
    float mapDepth     = 1.0 - texture2D(uHeightMap, currentUV).r;

    // Step-by-step ray march
    for (int i = 0; i < 64; i++) {
      if (i >= int(numLayers)) break;
      if (currentDepth >= mapDepth) break;
      currentUV    -= deltaUV;
      mapDepth      = 1.0 - texture2D(uHeightMap, currentUV).r;
      currentDepth += layerDepth;
    }

    // Binary-search refinement between last two steps
    vec2  prevUV    = currentUV + deltaUV;
    float afterDepth  = mapDepth - currentDepth;
    float beforeDepth = (1.0 - texture2D(uHeightMap, prevUV).r) - (currentDepth - layerDepth);
    float weight = afterDepth / (afterDepth - beforeDepth);
    return mix(currentUV, prevUV, weight);
  }

  // Self-shadowing: cast a ray toward the light from the POM surface point
  float pomSelfShadow(vec2 pommedUV, float initDepth, vec3 lightDir) {
    if (lightDir.z <= 0.0) return 0.5; // light from below — skip

    vec2  deltaUV  = (lightDir.xy / lightDir.z) * uHeightScale / 8.0;
    float shadow   = 0.0;
    float depth    = initDepth;

    for (int i = 0; i < 8; i++) {
      pommedUV += deltaUV;
      depth    -= 0.125;
      float mapH = 1.0 - texture2D(uHeightMap, pommedUV).r;
      if (mapH > depth) shadow = max(shadow, (mapH - depth) * 2.0);
    }
    return clamp(1.0 - shadow, 0.3, 1.0);
  }

  void main() {
    vec3 V = normalize(vTangentViewDir);
    vec3 L = normalize(vTangentLightDir);

    // Compute parallax-corrected UV
    vec2 pommedUV  = pomUV(vUv, V);
    float height   = texture2D(uHeightMap, pommedUV).r;

    // Sample diffuse and normal map at corrected UV
    vec3 albedo    = texture2D(uDiffuseMap, pommedUV).rgb;
    vec3 normalMap = texture2D(uNormalMap,  pommedUV).rgb * 2.0 - 1.0;
    normalMap      = normalize(normalMap);

    // Diffuse lighting with POM normal
    float NdotL    = max(dot(normalMap, L), 0.0);

    // Self-shadow factor
    float selfShadow = pomSelfShadow(pommedUV, height, L);

    vec3 diffuse  = albedo * uLightColor * NdotL * selfShadow;
    vec3 ambient  = albedo * uAmbient;
    vec3 color    = diffuse + ambient;

    // Gamma
    color = pow(color, vec3(1.0 / 2.2));
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Material factory ──────────────────────────────────────────────────────────

export interface POMTerrainOpts {
  heightMap:   THREE.Texture;
  diffuseMap:  THREE.Texture;
  normalMap:   THREE.Texture;
  heightScale?: number;
  quality?:    'low' | 'medium' | 'high' | 'ultra';
}

const QUALITY_LAYERS: Record<string, [number, number]> = {
  low:    [4,  16],
  medium: [8,  32],
  high:   [16, 64],
  ultra:  [32, 128],
};

/**
 * Create a POM ShaderMaterial for a terrain tile.
 * Drop-in replacement for MeshStandardMaterial on terrain meshes.
 */
export function createPOMTerrainMaterial(opts: POMTerrainOpts): THREE.ShaderMaterial {
  const [minL, maxL] = QUALITY_LAYERS[opts.quality ?? 'medium'];
  return new THREE.ShaderMaterial({
    vertexShader:   POM_VERTEX,
    fragmentShader: POM_FRAGMENT,
    uniforms: {
      uHeightMap:   { value: opts.heightMap },
      uDiffuseMap:  { value: opts.diffuseMap },
      uNormalMap:   { value: opts.normalMap },
      uHeightScale: { value: opts.heightScale ?? 0.05 },
      uMinLayers:   { value: minL },
      uMaxLayers:   { value: maxL },
      uLightDir:    { value: new THREE.Vector3(-1, -2, -1).normalize() },
      uLightColor:  { value: new THREE.Color(1.0, 0.95, 0.85) },
      uAmbient:     { value: new THREE.Color(0.2, 0.2, 0.25) },
    },
  });
}

/**
 * Update light direction uniform from scene's main directional light.
 */
export function updatePOMLight(
  material: THREE.ShaderMaterial,
  lightDir: THREE.Vector3,
  lightColor: THREE.Color,
): void {
  material.uniforms.uLightDir.value.copy(lightDir);
  material.uniforms.uLightColor.value.copy(lightColor);
}

/**
 * Generate a simple height map texture from a canvas height function.
 * Used when no pre-baked height map asset is available.
 *
 * @param fn      Height function (u, v) → [0,1]. Called for each texel.
 * @param size    Texture resolution (power of 2 recommended).
 */
export function generateHeightMapTexture(
  fn:   (u: number, v: number) => number,
  size  = 256,
): THREE.DataTexture {
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = Math.round(fn(x / size, y / size) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  tex.needsUpdate = true;
  return tex;
}
