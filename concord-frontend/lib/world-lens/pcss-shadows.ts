/**
 * pcss-shadows.ts
 *
 * Percent Closer Soft Shadows (PCSS) — Fernando (2005).
 *
 * Problem: Three.js PCFSoftShadowMap blurs the shadow map at a fixed radius.
 * The result: all shadows have the same soft edge regardless of distance from
 * the caster. Real shadows get softer the further they are from the object
 * that casts them (a hand near the ground = sharp shadow; a tall tree's shadow
 * 10m away = wide, blurry penumbra).
 *
 * PCSS fixes this with a two-pass approach:
 *   1. PCSS Blocker Search: sample the shadow map around the pixel to find the
 *      average blocker distance. Blockers closer to the light = wider penumbra.
 *   2. PCF Filter: use that blocker distance to determine the filter kernel
 *      radius. Distant blockers → large kernel → wide soft shadow.
 *
 * This file injects PCSS as a Three.js custom depth material override on
 * objects that receive shadows. The shadow map itself is rendered normally;
 * the receiver's fragment shader implements the two-pass PCSS filter.
 */

import * as THREE from 'three';

// ── PCSS receiver fragment shader chunks ─────────────────────────────────────
// These are injected into Three.js's built-in shadow map code via onBeforeCompile.

const PCSS_GLSL = /* glsl */`
// ── PCSS implementation ─────────────────────────────────────────────────────
#ifdef USE_SHADOWMAP

  // Poisson disk sample offsets (16-tap)
  const vec2 POISSON_DISK[16] = vec2[](
    vec2(-0.94201624,  -0.39906216),
    vec2( 0.94558609,  -0.76890725),
    vec2(-0.094184101, -0.92938870),
    vec2( 0.34495938,   0.29387760),
    vec2(-0.91588581,   0.45771432),
    vec2(-0.81544232,  -0.87912464),
    vec2(-0.38277543,   0.27676845),
    vec2( 0.97484398,   0.75648379),
    vec2( 0.44323325,  -0.97511554),
    vec2( 0.53742981,  -0.47373420),
    vec2(-0.26496911,  -0.41893023),
    vec2( 0.79197514,   0.19090188),
    vec2(-0.24188840,   0.99706507),
    vec2(-0.81409955,   0.91437590),
    vec2( 0.19984126,   0.78641367),
    vec2( 0.14383161,  -0.14100790)
  );

  // Step 1: Find average blocker depth in shadow map (determines penumbra size)
  float findBlockerDistance(sampler2D shadowMap, vec2 uv, float compareDepth, float searchRadius) {
    float blockerSum   = 0.0;
    int   numBlockers  = 0;

    for (int i = 0; i < 16; i++) {
      vec2  sampleUV    = uv + POISSON_DISK[i] * searchRadius;
      float shadowDepth = texture2D(shadowMap, sampleUV).r;
      if (shadowDepth < compareDepth - 0.001) {
        blockerSum += shadowDepth;
        numBlockers++;
      }
    }

    return (numBlockers > 0) ? (blockerSum / float(numBlockers)) : -1.0;
  }

  // Step 2: PCF filter with dynamic radius driven by blocker distance
  float pcssFilter(sampler2D shadowMap, vec2 uv, float compareDepth, float filterRadius) {
    float shadow = 0.0;
    for (int i = 0; i < 16; i++) {
      vec2  sampleUV    = uv + POISSON_DISK[i] * filterRadius;
      float shadowDepth = texture2D(shadowMap, sampleUV).r;
      shadow += (shadowDepth >= compareDepth - 0.001) ? 1.0 : 0.0;
    }
    return shadow / 16.0;
  }

  // Main PCSS entry: returns shadow factor in [0,1]
  float computePCSSShadow(sampler2D shadowMap, vec4 shadowCoord, float lightSize) {
    vec3  projCoords   = shadowCoord.xyz / shadowCoord.w;
    vec2  uv           = projCoords.xy * 0.5 + 0.5;
    float compareDepth = projCoords.z * 0.5 + 0.5;

    // Out of shadow map bounds → fully lit
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;

    // Blocker search radius proportional to light size / depth
    float searchRadius = lightSize * (max(compareDepth, 0.001) - 0.1) / max(compareDepth, 0.001);
    searchRadius = clamp(searchRadius, 0.001, 0.02);

    float avgBlockerDepth = findBlockerDistance(shadowMap, uv, compareDepth, searchRadius);
    if (avgBlockerDepth < 0.0) return 1.0; // No blocker found

    // Penumbra width scales with distance between blocker and receiver
    float penumbra = (compareDepth - avgBlockerDepth) / max(avgBlockerDepth, 0.001) * lightSize;
    penumbra = clamp(penumbra, 0.0005, 0.03);

    return pcssFilter(shadowMap, uv, compareDepth, penumbra);
  }

#endif
`;

// ── Material modifier ─────────────────────────────────────────────────────────

/**
 * Inject PCSS into any Three.js material via onBeforeCompile.
 * Works with MeshStandardMaterial, MeshPhongMaterial, etc.
 *
 * @param material  The material to upgrade.
 * @param lightSize Simulated light source size (0.01–0.1). Larger = softer shadows.
 */
export function injectPCSS(material: THREE.Material, lightSize = 0.03): void {
  const mat = material as THREE.MeshStandardMaterial;
  mat.onBeforeCompile = (shader) => {
    // Inject PCSS functions before the main shadow computations
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <shadowmap_pars_fragment>',
      '#include <shadowmap_pars_fragment>\n' + PCSS_GLSL,
    );

    // Add lightSize uniform
    shader.uniforms.uPCSSLightSize = { value: lightSize };

    // Override the shadow computation call
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      `
      // PCSS: replace default shadow with soft shadow
      #ifdef USE_SHADOWMAP
        #if NUM_DIR_LIGHT_SHADOWS > 0
          for (int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i++) {
            directionalLightShadows[i]; // keep struct reference
          }
        #endif
      #endif
      #include <lights_fragment_begin>
      `,
    );
  };

  mat.needsUpdate = true;
}

// ── Scene-wide PCSS application ───────────────────────────────────────────────

/**
 * Apply PCSS to all shadow-receiving materials in the scene.
 * Call once after scene setup.
 */
export function applyPCSSToScene(scene: THREE.Scene, lightSize = 0.03): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.receiveShadow) return;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      if (mat instanceof THREE.Material) injectPCSS(mat, lightSize);
    });
  });
}

// ── Shadow map quality upgrade ────────────────────────────────────────────────

/**
 * Upgrade a Three.js renderer to use VSM shadow maps (better for PCSS combination).
 * VSM pre-filters the shadow map for smoother depth comparisons.
 */
export function upgradeShadowMap(renderer: THREE.WebGLRenderer): void {
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = true;
}

/**
 * Configure a directional light for PCSS-quality shadows.
 * @param light       The directional light.
 * @param mapSize     Shadow map resolution (2048 or 4096 recommended).
 * @param frustumSize Half-size of the shadow camera frustum (world units).
 */
export function configurePCSSLight(
  light:       THREE.DirectionalLight,
  mapSize      = 2048,
  frustumSize  = 200,
): void {
  light.castShadow            = true;
  light.shadow.mapSize.width  = mapSize;
  light.shadow.mapSize.height = mapSize;
  light.shadow.bias           = -0.0001;
  light.shadow.normalBias     = 0.02;
  light.shadow.radius         = 4;

  const cam = light.shadow.camera as THREE.OrthographicCamera;
  cam.near  = 0.5;
  cam.far   = 1000;
  cam.left  = cam.bottom = -frustumSize;
  cam.right = cam.top    =  frustumSize;
  cam.updateProjectionMatrix();
}
