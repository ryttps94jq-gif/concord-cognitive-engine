// server/lib/conkay/verticals/aerodynamics.js
// Simple panel/CFD PROXY — coarse lift/drag + pressure map.
// Honesty: NOT ANSYS/Fluent class.

/** Build a coarse body mesh (NACA-ish airfoil extruded) if none provided. */
export function buildDefaultAirfoilMesh({ chord = 1, span = 2, thickness = 0.12, chordPts = 21, spanPts = 5 } = {}) {
  const positions = [];
  const indices = [];
  // 2D NACA 00xx approx → extrude in Z
  function nacaY(x) {
    const t = thickness;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    return yt;
  }
  for (let s = 0; s < spanPts; s++) {
    const z = (s / (spanPts - 1) - 0.5) * span;
    for (let i = 0; i < chordPts; i++) {
      const x = (i / (chordPts - 1)) * chord;
      const y = nacaY(Math.max(1e-6, x / chord)) * chord;
      positions.push(x, y, z); // upper
    }
    for (let i = chordPts - 1; i >= 0; i--) {
      const x = (i / (chordPts - 1)) * chord;
      const y = -nacaY(Math.max(1e-6, x / chord)) * chord;
      positions.push(x, y, z); // lower
    }
  }
  const ring = chordPts * 2;
  for (let s = 0; s < spanPts - 1; s++) {
    for (let i = 0; i < ring - 1; i++) {
      const a = s * ring + i;
      const b = a + 1;
      const c = (s + 1) * ring + i;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return {
    positions,
    indices,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    id: 'airfoil-proxy',
    params: { chord, span, thickness },
  };
}

/**
 * Coarse panel PROXY: freestream → Cp on vertices + Cl/Cd estimates.
 * Flat-panel potential-ish: Cp ≈ 1 - (V/U)^2 with V from simple thickness/camber rule.
 */
export function aeroPanelProxy(meshInput = {}, { alphaDeg = 5, U = 1, rho = 1.225 } = {}) {
  const t0 = Date.now();
  const mesh = meshInput?.positions ? meshInput : buildDefaultAirfoilMesh(meshInput);
  const pos = mesh.positions;
  const alpha = (Number(alphaDeg) || 0) * Math.PI / 180;
  const ca = Math.cos(alpha), sa = Math.sin(alpha);

  // Freestream in body frame
  const uInf = U * ca;
  const vInf = U * sa;

  const pressureMap = [];
  let ClSum = 0, CdSum = 0, area = 0;
  const nVerts = pos.length / 3;

  // Sample per-vertex pressure using thin-airfoil + thickness perturbation PROXY
  for (let i = 0; i < nVerts; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const chord = mesh.params?.chord || 1;
    const xc = Math.max(0, Math.min(1, x / chord));
    // local slope proxy from NACA thickness derivative-ish
    const thick = mesh.params?.thickness || 0.12;
    const dyc = thick * (0.14845 / Math.sqrt(Math.max(xc, 1e-4)) - 0.126 - 0.7032 * xc + 0.8529 * xc * xc - 0.406 * xc ** 3);
    const vLocal = uInf - vInf * dyc * 0.5 + (y >= 0 ? 0.15 : -0.15) * U * Math.sqrt(Math.max(0, xc * (1 - xc)));
    const speedRatio = vLocal / Math.max(U, 1e-6);
    const Cp = 1 - speedRatio * speedRatio;
    const p = 0.5 * rho * U * U * Cp;
    pressureMap.push({ i, x, y, z, Cp: Number(Cp.toFixed(4)), p: Number(p.toFixed(4)) });
  }

  // Integrate on triangles for force PROXY
  const idx = mesh.indices || [];
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
    const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
    const bx = pos[i1 * 3], by = pos[i1 * 3 + 1], bz = pos[i1 * 3 + 2];
    const cx = pos[i2 * 3], cy = pos[i2 * 3 + 1], cz = pos[i2 * 3 + 2];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const mag = Math.hypot(nx, ny, nz) || 1;
    const a = 0.5 * mag;
    area += a;
    const Cp = (pressureMap[i0].Cp + pressureMap[i1].Cp + pressureMap[i2].Cp) / 3;
    const q = 0.5 * rho * U * U;
    const fx = -Cp * q * (nx / mag) * a;
    const fy = -Cp * q * (ny / mag) * a;
    // rotate forces into wind axes
    const lift = fy * ca - fx * sa;
    const drag = fx * ca + fy * sa;
    ClSum += lift;
    CdSum += drag;
  }

  const S = Math.max(area * 0.5, 1e-6); // reference roughly half surface
  const q = 0.5 * rho * U * U;
  const Cl = ClSum / (q * S);
  const Cd = Math.max(0.005, CdSum / (q * S));
  const ms = Date.now() - t0;

  // Coarse grid pressure (downsample)
  const grid = pressureMap.filter((_, i) => i % Math.max(1, Math.floor(nVerts / 64)) === 0).slice(0, 64);

  return {
    ok: true,
    label: 'PROXY',
    coefficients: {
      Cl: Number(Cl.toFixed(4)),
      Cd: Number(Cd.toFixed(4)),
      L_D: Number((Cl / Math.max(Cd, 1e-6)).toFixed(3)),
      alphaDeg: Number(alphaDeg),
      U,
      rho,
      area: Number(area.toFixed(4)),
    },
    pressureMap: grid,
    mesh: {
      vertexCount: mesh.vertexCount,
      triangleCount: mesh.triangleCount,
      id: mesh.id,
      positions: mesh.positions,
      indices: mesh.indices,
    },
    ms,
    honesty: {
      note: 'Coarse panel/Cp PROXY — NOT ANSYS/Fluent/RANS/LES class CFD',
      ansys: false,
      fluent: false,
    },
  };
}

export function runAeroCert(opts = {}) {
  const mesh = buildDefaultAirfoilMesh(opts.mesh || {});
  return aeroPanelProxy(mesh, opts);
}

export default { buildDefaultAirfoilMesh, aeroPanelProxy, runAeroCert };
