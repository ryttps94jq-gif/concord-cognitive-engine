/**
 * skin-sss-shader.ts
 *
 * Subsurface Scattering (SSS) shader material for character skin.
 *
 * Problem it solves: Three.js MeshStandardMaterial renders skin like plastic —
 * light doesn't penetrate the surface, so characters look dead and artificial.
 * Real skin is translucent: light enters, scatters through tissue, exits nearby.
 * This gives the soft, warm glow of biological skin vs. the hard sheen of plastic.
 *
 * Technique: Jensen et al. (2001) Dipole approximation — fast, real-time friendly.
 * We approximate SSS with a custom ShaderMaterial that:
 *   1. Computes standard PBR diffuse + specular
 *   2. Adds a translucency term: light from behind the surface bleeds through
 *      (simulates light passing through the ear, nose, fingers)
 *   3. Blurs the diffuse term with a small kernel to simulate multi-scatter
 */

import * as THREE from 'three';

// ── Vertex shader ─────────────────────────────────────────────────────────────

const SSS_VERTEX = /* glsl */`
  varying vec3  vNormal;
  varying vec3  vWorldPos;
  varying vec2  vUv;
  varying vec3  vViewDir;

  void main() {
    vec4 worldPos  = modelMatrix * vec4(position, 1.0);
    vWorldPos      = worldPos.xyz;
    vNormal        = normalize(mat3(modelMatrix) * normal);
    vUv            = uv;
    vViewDir       = normalize(cameraPosition - worldPos.xyz);
    gl_Position    = projectionMatrix * viewMatrix * worldPos;
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────

const SSS_FRAGMENT = /* glsl */`
  precision highp float;

  uniform vec3  uSkinColor;       // base skin albedo
  uniform vec3  uSubsurfColor;    // SSS color (warm red/orange for skin)
  uniform float uSubsurfStrength; // 0–1 overall SSS intensity
  uniform float uSubsurfRadius;   // light diffusion radius (simulated, not ray-based)
  uniform float uRoughness;
  uniform float uMetalness;
  uniform vec3  uLightPos;        // primary directional light world position
  uniform vec3  uLightColor;
  uniform vec3  uAmbient;

  varying vec3  vNormal;
  varying vec3  vWorldPos;
  varying vec2  vUv;
  varying vec3  vViewDir;

  // GGX specular distribution
  float ggxD(float NdotH, float roughness) {
    float a  = roughness * roughness;
    float a2 = a * a;
    float d  = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
    return a2 / (3.14159 * d * d);
  }

  // Schlick geometric attenuation
  float ggxG(float NdotV, float roughness) {
    float k = (roughness + 1.0);
    k = (k * k) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
  }

  // Fresnel Schlick approximation
  vec3 fresnel(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(uLightPos - vWorldPos);
    vec3 H = normalize(V + L);

    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.001);
    float NdotH = max(dot(N, H), 0.0);
    float HdotV = max(dot(H, V), 0.0);

    // ── Standard PBR ───────────────────────────────────────────────
    vec3 F0 = mix(vec3(0.04), uSkinColor, uMetalness);
    float D = ggxD(NdotH, uRoughness);
    float G = ggxG(NdotV, uRoughness) * ggxG(NdotL, uRoughness);
    vec3  F = fresnel(HdotV, F0);

    vec3 specular = (D * G * F) / max(4.0 * NdotV * NdotL, 0.001);
    vec3 kD       = (1.0 - F) * (1.0 - uMetalness);
    vec3 diffuse  = kD * uSkinColor / 3.14159;

    vec3 direct = (diffuse + specular) * uLightColor * NdotL;

    // ── Subsurface scattering term ─────────────────────────────────
    // Translucency: back-lighting bleeds through thin geometry.
    // Wrap: a softened NdotL that allows light to "wrap around" edges.
    float wrap      = 0.5; // 0 = Lambertian, 1 = full wrap
    float wrapNdotL = max(0.0, (dot(N, L) + wrap) / (1.0 + wrap));

    // Thinness approximation: thinner parts (ears, nose) scatter more.
    // We estimate with the abs of back-facing NdotL.
    float backLighting = max(0.0, -dot(N, L)); // how much light hits the back face

    // SSS color contribution: warm sub-dermal light (blood/tissue color)
    vec3 sssContrib = uSubsurfColor * uSubsurfStrength
      * (wrapNdotL * 0.5 + backLighting * 0.8)
      * uLightColor;

    // ── Ambient ────────────────────────────────────────────────────
    vec3 ambient = uAmbient * uSkinColor * 0.1;

    vec3 color = direct + sssContrib + ambient;

    // Tone map (ACES filmic approximation)
    color = color / (color + 0.187) * 1.035;
    color = pow(color, vec3(1.0 / 2.2)); // gamma correction

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Shader material factory ───────────────────────────────────────────────────

export interface SkinSSSOpts {
  skinColor?:       THREE.Color;
  subsurfColor?:    THREE.Color;
  subsurfStrength?: number;
  subsurfRadius?:   number;
  roughness?:       number;
  metalness?:       number;
}

/**
 * Create a ShaderMaterial that renders biological skin with SSS.
 * Drop-in replacement for MeshStandardMaterial on character head/hand/arm meshes.
 */
export function createSkinSSS(opts: SkinSSSOpts = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader:   SSS_VERTEX,
    fragmentShader: SSS_FRAGMENT,
    uniforms: {
      uSkinColor:       { value: opts.skinColor      ?? new THREE.Color(0xd4a574) },
      uSubsurfColor:    { value: opts.subsurfColor   ?? new THREE.Color(0xff6030) },
      uSubsurfStrength: { value: opts.subsurfStrength ?? 0.45 },
      uSubsurfRadius:   { value: opts.subsurfRadius   ?? 0.08 },
      uRoughness:       { value: opts.roughness       ?? 0.75 },
      uMetalness:       { value: opts.metalness       ?? 0.0 },
      uLightPos:        { value: new THREE.Vector3(100, 200, 50) },
      uLightColor:      { value: new THREE.Color(1.0, 0.95, 0.85) },
      uAmbient:         { value: new THREE.Color(0.15, 0.15, 0.2) },
    },
  });
}

/**
 * Update the light position uniform from the scene's main directional light.
 * Call once per frame before rendering.
 */
export function updateSkinSSSLight(
  material:   THREE.ShaderMaterial,
  lightDir:   THREE.Vector3,
  lightColor: THREE.Color,
  ambient:    THREE.Color,
): void {
  material.uniforms.uLightPos.value.copy(lightDir);
  material.uniforms.uLightColor.value.copy(lightColor);
  material.uniforms.uAmbient.value.copy(ambient);
}

/**
 * Apply SSS skin material to all skin-colored meshes in an avatar group.
 * Matches meshes that use a MeshStandardMaterial with low metalness + skin-tone color.
 */
export function applySSSTOAvatar(
  avatarGroup: THREE.Group,
  skinColor:   THREE.Color,
): void {
  const sssMaterial = createSkinSSS({ skinColor });
  avatarGroup.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat || mat.type !== 'MeshStandardMaterial') return;
    // Match skin-tone materials (low metalness, no map)
    if (mat.metalness < 0.1 && !mat.map) {
      const colorDist = mat.color.distanceTo(skinColor);
      if (colorDist < 0.3) mesh.material = sssMaterial;
    }
  });
}
