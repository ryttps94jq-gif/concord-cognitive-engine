/**
 * reflection-probes.ts
 *
 * Dynamic reflection probes for buildings and environment surfaces.
 *
 * Problem: Three.js MeshStandardMaterial supports envMap, but uses a static
 * pre-baked environment texture. Buildings, wet streets, and metal surfaces
 * all reflect a frozen sky with no other objects visible. Dynamic probes
 * re-render the scene from each probe position each frame (or on-demand),
 * capturing moving clouds, other buildings, player characters, and lighting
 * changes in the reflections.
 *
 * Technique:
 *   1. PMREMGenerator converts each CubeRenderTarget into a mipmap-filtered
 *      environment map usable by PBR materials (roughness-correct reflections).
 *   2. Probes are placed per-building; each building's materials use the
 *      nearest probe's env map.
 *   3. Update strategy: probes refresh on a round-robin schedule (one probe
 *      per frame) to spread the cube-map render cost across frames.
 *   4. Level of detail: probe render resolution scales with distance to camera.
 */

import * as THREE from 'three';

// ── Probe configuration ───────────────────────────────────────────────────────

export interface ReflectionProbeOpts {
  /** World position of the probe. Should be near the center of the building. */
  position:       THREE.Vector3;
  /** Cube map resolution (64–512). Higher = sharper reflections, more GPU cost. */
  resolution?:    number;
  /** Near/far clip for the cube camera. */
  near?:          number;
  far?:           number;
  /** How often this probe refreshes (every N frames). 1 = every frame, 4 = every 4 frames. */
  updateInterval?: number;
}

export interface ReflectionProbe {
  position:       THREE.Vector3;
  cubeCamera:     THREE.CubeCamera;
  renderTarget:   THREE.WebGLCubeRenderTarget;
  envMap:         THREE.Texture;
  updateInterval: number;
  frameOffset:    number;
  /** Meshes using this probe's envMap. */
  linkedMeshes:   THREE.Mesh[];
}

// ── Probe manager ─────────────────────────────────────────────────────────────

/**
 * Manages a pool of dynamic reflection probes for a scene.
 * One probe covers one building or a cluster of closely-spaced buildings.
 */
export class ReflectionProbeManager {
  private probes:    ReflectionProbe[] = [];
  private pmrem:     THREE.PMREMGenerator;
  private frameCount = 0;
  private scene:     THREE.Scene;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.scene  = scene;
    this.pmrem  = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
  }

  /**
   * Create a new reflection probe and return it.
   * Call once per building during scene setup.
   */
  addProbe(opts: ReflectionProbeOpts): ReflectionProbe {
    const res  = opts.resolution    ?? 128;
    const near = opts.near          ?? 0.1;
    const far  = opts.far           ?? 2000;

    const renderTarget = new THREE.WebGLCubeRenderTarget(res, {
      format:           THREE.RGBAFormat,
      generateMipmaps:  true,
      minFilter:        THREE.LinearMipmapLinearFilter,
    });

    const cubeCamera = new THREE.CubeCamera(near, far, renderTarget);
    cubeCamera.position.copy(opts.position);
    this.scene.add(cubeCamera);

    const probe: ReflectionProbe = {
      position:       opts.position.clone(),
      cubeCamera,
      renderTarget,
      envMap:         renderTarget.texture,
      updateInterval: opts.updateInterval ?? 4,
      frameOffset:    this.probes.length, // stagger refreshes
      linkedMeshes:   [],
    };

    this.probes.push(probe);
    return probe;
  }

  /**
   * Link a mesh to use this probe's environment map.
   * Sets envMap and envMapIntensity on all materials of the mesh.
   */
  linkMesh(probe: ReflectionProbe, mesh: THREE.Mesh, intensity = 1.0): void {
    probe.linkedMeshes.push(mesh);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (m.isMeshStandardMaterial) {
        m.envMap          = probe.envMap;
        m.envMapIntensity = intensity;
        m.needsUpdate     = true;
      }
    });
  }

  /**
   * Auto-assign each mesh to its nearest probe.
   * Convenience function — call after adding all probes and building meshes.
   *
   * @param meshes   All building meshes in the scene.
   * @param intensity  envMapIntensity for PBR materials.
   */
  autoAssign(meshes: THREE.Mesh[], intensity = 1.0): void {
    for (const mesh of meshes) {
      const probe = this._nearestProbe(mesh.getWorldPosition(new THREE.Vector3()));
      if (probe) this.linkMesh(probe, mesh, intensity);
    }
  }

  /**
   * Call once per frame (or as often as you can afford).
   * Updates one probe per frame in round-robin order; each probe only
   * re-renders when its updateInterval has elapsed.
   *
   * @param renderer  Three.js renderer.
   * @param hideList  Objects to hide during cube-camera render (e.g., the player avatar).
   */
  update(renderer: THREE.WebGLRenderer, hideList: THREE.Object3D[] = []): void {
    this.frameCount++;

    for (const probe of this.probes) {
      if ((this.frameCount + probe.frameOffset) % probe.updateInterval !== 0) continue;

      // Hide self-referencing objects during cube render
      for (const obj of hideList) obj.visible = false;

      probe.cubeCamera.update(renderer, this.scene);

      // Re-apply PMREM for roughness-correct mip chain
      const pmremTexture = this.pmrem.fromCubemap(probe.renderTarget.texture);
      for (const mesh of probe.linkedMeshes) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          const m = mat as THREE.MeshStandardMaterial;
          if (m.isMeshStandardMaterial) {
            m.envMap      = pmremTexture.texture;
            m.needsUpdate = true;
          }
        });
      }

      for (const obj of hideList) obj.visible = true;
      break; // one probe per frame
    }
  }

  /**
   * Distance-based probe LOD: reduce resolution for probes far from camera.
   * Call when the camera moves significantly.
   */
  updateLOD(cameraPosition: THREE.Vector3): void {
    for (const probe of this.probes) {
      const dist = probe.position.distanceTo(cameraPosition);
      // Beyond 200 units — freeze probe (don't update, save GPU)
      if (dist > 200) {
        probe.updateInterval = 999999;
      } else if (dist > 100) {
        probe.updateInterval = 8;
      } else {
        probe.updateInterval = 4;
      }
    }
  }

  dispose(): void {
    for (const probe of this.probes) {
      probe.renderTarget.dispose();
      this.scene.remove(probe.cubeCamera);
    }
    this.pmrem.dispose();
    this.probes = [];
  }

  private _nearestProbe(pos: THREE.Vector3): ReflectionProbe | null {
    let best: ReflectionProbe | null = null;
    let bestDist = Infinity;
    for (const probe of this.probes) {
      const d = probe.position.distanceTo(pos);
      if (d < bestDist) { bestDist = d; best = probe; }
    }
    return best;
  }
}

// ── District probe placement ──────────────────────────────────────────────────

/**
 * Automatically place reflection probes across a city grid.
 * One probe per N×N block of buildings.
 *
 * @param manager       The ReflectionProbeManager.
 * @param gridCenter    World center of the city grid.
 * @param gridSize      Total width/depth of the city area in world units.
 * @param blocksPerSide How many probe blocks per axis (3 = 9 total probes for 3×3 grid).
 * @param probeHeight   Y-world position of probes (mid-building height, e.g. 8m).
 */
export function placeCityProbes(
  manager:      ReflectionProbeManager,
  gridCenter:   THREE.Vector3,
  gridSize:     number,
  blocksPerSide = 3,
  probeHeight   = 8,
): void {
  const step   = gridSize / blocksPerSide;
  const offset = (gridSize - step) / 2;

  for (let row = 0; row < blocksPerSide; row++) {
    for (let col = 0; col < blocksPerSide; col++) {
      const x = gridCenter.x - offset + col * step;
      const z = gridCenter.z - offset + row * step;
      manager.addProbe({
        position:       new THREE.Vector3(x, gridCenter.y + probeHeight, z),
        resolution:     128,
        updateInterval: 4 + (row * blocksPerSide + col), // spread updates further apart
      });
    }
  }
}

/**
 * Apply a static skybox/HDRI as the fallback env map for all materials
 * in the scene that are not linked to a probe.
 * Call during scene setup before probes activate.
 */
export function applyStaticEnvFallback(
  scene:     THREE.Scene,
  envTexture: THREE.Texture,
  intensity   = 0.5,
): void {
  scene.environment = envTexture;
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      if (m.isMeshStandardMaterial && !m.envMap) {
        m.envMap          = envTexture;
        m.envMapIntensity = intensity;
        m.needsUpdate     = true;
      }
    });
  });
}
