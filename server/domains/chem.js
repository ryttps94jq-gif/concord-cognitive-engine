// server/domains/chem.js
// Domain actions for chemistry: molecular formula parsing, reaction balancing,
// solution chemistry, and thermochemistry.

export default function registerChemActions(registerLensAction) {
  // Periodic table subset (atomic masses)
  const ELEMENTS = {
    H: 1.008, He: 4.003, Li: 6.941, Be: 9.012, B: 10.81, C: 12.011,
    N: 14.007, O: 15.999, F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305,
    Al: 26.982, Si: 28.086, P: 30.974, S: 32.065, Cl: 35.453, Ar: 39.948,
    K: 39.098, Ca: 40.078, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938,
    Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Br: 79.904,
    Ag: 107.868, I: 126.904, Ba: 137.327, Au: 196.967, Pb: 207.2, U: 238.029,
  };

  // Parse molecular formula into element counts: "H2O" → {H:2, O:1}
  function parseFormula(formula) {
    const counts = {};
    const stack = [counts];
    let i = 0;
    while (i < formula.length) {
      if (formula[i] === '(') {
        const sub = {};
        stack.push(sub);
        i++;
      } else if (formula[i] === ')') {
        i++;
        let num = '';
        while (i < formula.length && /\d/.test(formula[i])) { num += formula[i]; i++; }
        const mult = num ? parseInt(num) : 1;
        const sub = stack.pop();
        const parent = stack[stack.length - 1];
        for (const [el, cnt] of Object.entries(sub)) {
          parent[el] = (parent[el] || 0) + cnt * mult;
        }
      } else if (/[A-Z]/.test(formula[i])) {
        let el = formula[i]; i++;
        while (i < formula.length && /[a-z]/.test(formula[i])) { el += formula[i]; i++; }
        let num = '';
        while (i < formula.length && /\d/.test(formula[i])) { num += formula[i]; i++; }
        const mult = num ? parseInt(num) : 1;
        const current = stack[stack.length - 1];
        current[el] = (current[el] || 0) + mult;
      } else {
        i++;
      }
    }
    return counts;
  }

  /**
   * molecularAnalysis
   * Parse a molecular formula and compute molecular weight, elemental composition,
   * empirical formula, and degree of unsaturation.
   * artifact.data.formula = "C6H12O6" or params.formula
   */
  registerLensAction("chem", "molecularAnalysis", (ctx, artifact, params) => {
    const formula = params.formula || artifact.data?.formula;
    if (!formula) return { ok: false, error: "No molecular formula provided." };

    const elements = parseFormula(formula);
    const r = v => Math.round(v * 10000) / 10000;

    // Molecular weight
    let mw = 0;
    const composition = [];
    for (const [el, count] of Object.entries(elements)) {
      const mass = ELEMENTS[el];
      if (!mass) return { ok: false, error: `Unknown element: ${el}` };
      const elMass = mass * count;
      mw += elMass;
      composition.push({ element: el, count, atomicMass: mass, totalMass: r(elMass) });
    }

    // Mass percentages
    for (const c of composition) {
      c.massPercent = r((c.totalMass / mw) * 100);
    }

    // Empirical formula: divide all counts by GCD
    const counts = Object.values(elements);
    function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
    let g = counts[0];
    for (let i = 1; i < counts.length; i++) g = gcd(g, counts[i]);
    const empirical = {};
    for (const [el, count] of Object.entries(elements)) {
      empirical[el] = count / g;
    }
    const empiricalFormula = Object.entries(empirical)
      .map(([el, n]) => n === 1 ? el : `${el}${n}`).join('');
    const empiricalMW = Object.entries(empirical)
      .reduce((s, [el, n]) => s + ELEMENTS[el] * n, 0);
    const formulaRatio = Math.round(mw / empiricalMW);

    // Degree of unsaturation (Index of Hydrogen Deficiency)
    // DoU = (2C + 2 + N - H - X) / 2  where X = halogens
    const C = elements.C || 0, H = elements.H || 0, N = elements.N || 0;
    const halogens = (elements.F || 0) + (elements.Cl || 0) + (elements.Br || 0) + (elements.I || 0);
    const dou = C > 0 ? (2 * C + 2 + N - H - halogens) / 2 : null;

    // Moles calculations
    const molesIn1g = 1 / mw;
    const moleculesIn1g = molesIn1g * 6.022e23;

    return {
      ok: true, result: {
        formula, molecularWeight: r(mw),
        elements: composition,
        empiricalFormula, empiricalWeight: r(empiricalMW),
        formulaToEmpiricalRatio: formulaRatio,
        degreeOfUnsaturation: dou,
        molarMass: r(mw) + " g/mol",
        molesPerGram: r(molesIn1g),
        moleculesPerGram: r(moleculesIn1g),
        totalAtoms: Object.values(elements).reduce((s, n) => s + n, 0),
      },
    };
  });

  /**
   * balanceReaction
   * Balance a chemical equation using Gaussian elimination on the composition matrix.
   * artifact.data.reactants = ["H2", "O2"], artifact.data.products = ["H2O"]
   * OR params.equation = "H2 + O2 -> H2O"
   */
  registerLensAction("chem", "balanceReaction", (ctx, artifact, params) => {
    let reactants, products;

    if (params.equation) {
      const sides = params.equation.split(/->|→|=/).map(s => s.trim());
      if (sides.length !== 2) return { ok: false, error: "Equation must have exactly one arrow (->)." };
      reactants = sides[0].split('+').map(s => s.trim()).filter(Boolean);
      products = sides[1].split('+').map(s => s.trim()).filter(Boolean);
    } else {
      reactants = artifact.data?.reactants || [];
      products = artifact.data?.products || [];
    }

    if (reactants.length === 0 || products.length === 0) {
      return { ok: false, error: "Need at least one reactant and one product." };
    }

    const compounds = [...reactants, ...products];
    const nCompounds = compounds.length;
    const nReactants = reactants.length;

    // Parse all compounds
    const parsed = compounds.map(parseFormula);

    // Collect all elements
    const allElements = new Set();
    for (const p of parsed) for (const el of Object.keys(p)) allElements.add(el);
    const elementList = [...allElements];
    const nElements = elementList.length;

    // Build composition matrix: rows = elements, cols = compounds
    // Reactants are positive, products are negative
    const matrix = Array.from({ length: nElements }, () => new Array(nCompounds + 1).fill(0));
    for (let j = 0; j < nCompounds; j++) {
      const sign = j < nReactants ? 1 : -1;
      for (let i = 0; i < nElements; i++) {
        matrix[i][j] = sign * (parsed[j][elementList[i]] || 0);
      }
    }

    // Gaussian elimination (reduced row echelon form)
    const rows = nElements, cols = nCompounds;
    let pivotRow = 0;
    for (let col = 0; col < cols && pivotRow < rows; col++) {
      let maxR = pivotRow;
      for (let row = pivotRow + 1; row < rows; row++) {
        if (Math.abs(matrix[row][col]) > Math.abs(matrix[maxR][col])) maxR = row;
      }
      if (Math.abs(matrix[maxR][col]) < 1e-10) continue;
      [matrix[pivotRow], matrix[maxR]] = [matrix[maxR], matrix[pivotRow]];
      const pivot = matrix[pivotRow][col];
      for (let j = col; j <= cols; j++) matrix[pivotRow][j] /= pivot;
      for (let row = 0; row < rows; row++) {
        if (row === pivotRow) continue;
        const factor = matrix[row][col];
        for (let j = col; j <= cols; j++) matrix[row][j] -= factor * matrix[pivotRow][j];
      }
      pivotRow++;
    }

    // Extract solution: free variables = 1, solve for others
    const coefficients = new Array(nCompounds).fill(1);
    // Back-substitution: for each pivot row, solve
    for (let i = Math.min(pivotRow, rows) - 1; i >= 0; i--) {
      let pivotCol = -1;
      for (let j = 0; j < cols; j++) {
        if (Math.abs(matrix[i][j]) > 1e-10) { pivotCol = j; break; }
      }
      if (pivotCol === -1) continue;
      let val = -matrix[i][cols]; // RHS
      for (let j = pivotCol + 1; j < cols; j++) {
        val -= matrix[i][j] * coefficients[j];
      }
      coefficients[pivotCol] = val / matrix[i][pivotCol];
    }

    // Make all coefficients positive and convert to integers
    const minCoeff = Math.min(...coefficients.filter(c => Math.abs(c) > 1e-10).map(Math.abs));
    const normalized = coefficients.map(c => Math.abs(c) / (minCoeff || 1));

    // Find smallest multiplier to make all integers
    let multiplier = 1;
    for (let m = 1; m <= 100; m++) {
      if (normalized.every(c => Math.abs(Math.round(c * m) - c * m) < 0.01)) {
        multiplier = m;
        break;
      }
    }
    const intCoeffs = normalized.map(c => Math.round(c * multiplier));

    // Build balanced equation string
    const reactantStr = reactants.map((r, i) => intCoeffs[i] === 1 ? r : `${intCoeffs[i]}${r}`).join(' + ');
    const productStr = products.map((p, i) => {
      const idx = nReactants + i;
      return intCoeffs[idx] === 1 ? p : `${intCoeffs[idx]}${p}`;
    }).join(' + ');

    // Verify balance
    const verification = {};
    for (const el of elementList) {
      let left = 0, right = 0;
      for (let j = 0; j < nReactants; j++) left += (parsed[j][el] || 0) * intCoeffs[j];
      for (let j = nReactants; j < nCompounds; j++) right += (parsed[j][el] || 0) * intCoeffs[j];
      verification[el] = { left, right, balanced: left === right };
    }
    const isBalanced = Object.values(verification).every(v => v.balanced);

    return {
      ok: true, result: {
        balanced: isBalanced,
        equation: `${reactantStr} → ${productStr}`,
        coefficients: compounds.map((c, i) => ({ compound: c, coefficient: intCoeffs[i] })),
        elementCheck: verification,
        reactants: reactants.map((r, i) => ({ formula: r, coefficient: intCoeffs[i] })),
        products: products.map((p, i) => ({ formula: p, coefficient: intCoeffs[nReactants + i] })),
      },
    };
  });

  /**
   * solutionChemistry
   * Compute pH, dilution, titration curves, and buffer capacity.
   * artifact.data.solution = { type, concentration, volume?, pKa?, pKb? }
   * params.operation: "pH" | "dilute" | "titrate" | "buffer"
   */
  registerLensAction("chem", "solutionChemistry", (ctx, artifact, params) => {
    const sol = artifact.data?.solution || {};
    const op = params.operation || "pH";
    const r = v => Math.round(v * 10000) / 10000;

    switch (op) {
      case "pH": {
        const type = sol.type || "strong-acid";
        const conc = sol.concentration || 0.1; // mol/L
        const pKa = sol.pKa;
        const pKb = sol.pKb;
        let pH, pOH;

        if (type === "strong-acid") {
          pH = -Math.log10(conc);
          pOH = 14 - pH;
        } else if (type === "strong-base") {
          pOH = -Math.log10(conc);
          pH = 14 - pOH;
        } else if (type === "weak-acid" && pKa != null) {
          const Ka = Math.pow(10, -pKa);
          // Quadratic: [H+]² + Ka[H+] - Ka*C = 0
          const disc = Ka * Ka + 4 * Ka * conc;
          const H = (-Ka + Math.sqrt(disc)) / 2;
          pH = -Math.log10(H);
          pOH = 14 - pH;
        } else if (type === "weak-base" && pKb != null) {
          const Kb = Math.pow(10, -pKb);
          const disc = Kb * Kb + 4 * Kb * conc;
          const OH = (-Kb + Math.sqrt(disc)) / 2;
          pOH = -Math.log10(OH);
          pH = 14 - pOH;
        } else {
          return { ok: false, error: "Unsupported solution type or missing pKa/pKb." };
        }

        const H = Math.pow(10, -pH);
        const OH = Math.pow(10, -pOH);
        const acidic = pH < 7;

        return {
          ok: true, result: {
            pH: r(pH), pOH: r(pOH),
            hydrogenIonConc: r(H), hydroxideIonConc: r(OH),
            nature: acidic ? "acidic" : pH > 7 ? "basic" : "neutral",
            type, concentration: conc,
          },
        };
      }

      case "dilute": {
        const C1 = sol.concentration || 0.1;
        const V1 = sol.volume || 1; // L
        const C2 = params.targetConcentration;
        const V2 = params.targetVolume;

        if (C2) {
          // C1V1 = C2V2 → V2 = C1V1/C2
          const finalVolume = C1 * V1 / C2;
          const solventToAdd = finalVolume - V1;
          return {
            ok: true, result: {
              initialConcentration: C1, initialVolume: V1,
              finalConcentration: r(C2), finalVolume: r(finalVolume),
              solventToAdd: r(solventToAdd),
              dilutionFactor: r(C1 / C2),
            },
          };
        } else if (V2) {
          const finalConc = C1 * V1 / V2;
          return {
            ok: true, result: {
              initialConcentration: C1, initialVolume: V1,
              finalConcentration: r(finalConc), finalVolume: V2,
              solventToAdd: r(V2 - V1),
              dilutionFactor: r(C1 / finalConc),
            },
          };
        }
        return { ok: false, error: "Provide targetConcentration or targetVolume." };
      }

      case "titrate": {
        // Generate titration curve
        const analyteConc = sol.concentration || 0.1;
        const analyteVol = sol.volume || 0.025; // 25 mL default
        const titrantConc = params.titrantConcentration || 0.1;
        const isAcid = sol.type?.includes("acid");
        const pKa = sol.pKa || 4.75; // acetic acid default for weak

        const equivalenceVol = analyteConc * analyteVol / titrantConc;
        const curve = [];

        for (let frac = 0; frac <= 2; frac += 0.02) {
          const vTitrant = frac * equivalenceVol;
          const totalVol = analyteVol + vTitrant;
          const molesAnalyte = analyteConc * analyteVol;
          const molesTitrant = titrantConc * vTitrant;
          let pH;

          if (sol.type === "strong-acid") {
            if (molesTitrant < molesAnalyte) {
              const excessH = (molesAnalyte - molesTitrant) / totalVol;
              pH = -Math.log10(excessH);
            } else if (Math.abs(molesTitrant - molesAnalyte) < 1e-10) {
              pH = 7;
            } else {
              const excessOH = (molesTitrant - molesAnalyte) / totalVol;
              pH = 14 + Math.log10(excessOH);
            }
          } else {
            // Weak acid-strong base (Henderson-Hasselbalch in buffer region)
            const Ka = Math.pow(10, -pKa);
            if (molesTitrant < molesAnalyte * 0.999) {
              const remaining = molesAnalyte - molesTitrant;
              const conjugate = molesTitrant;
              if (conjugate > 0) {
                pH = pKa + Math.log10(conjugate / remaining);
              } else {
                const C = remaining / totalVol;
                const disc = Ka * Ka + 4 * Ka * C;
                pH = -Math.log10((-Ka + Math.sqrt(disc)) / 2);
              }
            } else if (Math.abs(molesTitrant - molesAnalyte) < molesAnalyte * 0.002) {
              // Equivalence point: hydrolysis of conjugate base
              const Cb = molesAnalyte / totalVol;
              const Kb = 1e-14 / Ka;
              const OH = Math.sqrt(Kb * Cb);
              pH = 14 + Math.log10(OH);
            } else {
              const excessOH = (molesTitrant - molesAnalyte) / totalVol;
              pH = 14 + Math.log10(excessOH);
            }
          }

          curve.push({ volumeAdded: Math.round(vTitrant * 1e6) / 1e6, fractionEquivalence: r(frac), pH: r(pH) });
        }

        // Half-equivalence point
        const halfEq = curve.find(p => Math.abs(p.fractionEquivalence - 0.5) < 0.02);
        const eqPoint = curve.find(p => Math.abs(p.fractionEquivalence - 1.0) < 0.02);

        return {
          ok: true, result: {
            equivalenceVolume: r(equivalenceVol * 1000) + " mL",
            equivalencePoint: eqPoint,
            halfEquivalencePoint: halfEq,
            pKaEstimate: halfEq ? halfEq.pH : null,
            curve: curve.filter((_, i) => i % 2 === 0 || Math.abs(curve[i].fractionEquivalence - 1) < 0.1),
            analyteType: sol.type, titrantType: isAcid ? "strong-base" : "strong-acid",
          },
        };
      }

      case "buffer": {
        const pKa = sol.pKa || 4.75;
        const acidConc = sol.concentration || 0.1;
        const baseConc = params.conjugateBaseConcentration || acidConc;
        const Ka = Math.pow(10, -pKa);

        // Henderson-Hasselbalch
        const pH = pKa + Math.log10(baseConc / acidConc);

        // Buffer capacity (β = 2.303 * C * Ka * [H+] / (Ka + [H+])²)
        const H = Math.pow(10, -pH);
        const totalConc = acidConc + baseConc;
        const beta = 2.303 * totalConc * Ka * H / Math.pow(Ka + H, 2);

        // Effective buffer range
        const rangeMin = pKa - 1;
        const rangeMax = pKa + 1;

        // How much strong acid/base to shift pH by 1 unit
        const molesAcidToShift = beta * 1; // approximate
        const molesBaseToShift = beta * 1;

        return {
          ok: true, result: {
            pH: r(pH), pKa,
            acidConcentration: acidConc, conjugateBaseConcentration: baseConc,
            ratio: r(baseConc / acidConc),
            bufferCapacity: r(beta),
            effectiveRange: { min: r(rangeMin), max: r(rangeMax) },
            molesToShiftpH1: { acid: r(molesAcidToShift), base: r(molesBaseToShift) },
            quality: Math.abs(pH - pKa) < 0.5 ? "optimal" : Math.abs(pH - pKa) < 1 ? "good" : "poor",
          },
        };
      }

      default:
        return { ok: false, error: `Unknown operation "${op}". Use: pH, dilute, titrate, buffer.` };
    }
  });
}
