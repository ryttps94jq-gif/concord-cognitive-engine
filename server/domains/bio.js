// server/domains/bio.js
// Domain actions for biology/bioinformatics: sequence alignment scoring,
// gene expression analysis, phylogenetic distance, and motif detection.

export default function registerBioActions(registerLensAction) {
  /**
   * sequenceAlign
   * Needleman-Wunsch global alignment of two DNA/protein sequences.
   * artifact.data.sequenceA, artifact.data.sequenceB
   * params.matchScore (default 2), params.mismatchPenalty (default -1),
   * params.gapPenalty (default -2)
   */
  registerLensAction("bio", "sequenceAlign", (ctx, artifact, params) => {
    const seqA = (artifact.data?.sequenceA || params.sequenceA || "").toUpperCase();
    const seqB = (artifact.data?.sequenceB || params.sequenceB || "").toUpperCase();
    if (!seqA || !seqB) return { ok: false, error: "Both sequenceA and sequenceB required." };
    if (seqA.length > 2000 || seqB.length > 2000) return { ok: false, error: "Sequences limited to 2000 characters each." };

    const match = params.matchScore ?? 2;
    const mismatch = params.mismatchPenalty ?? -1;
    const gap = params.gapPenalty ?? -2;
    const m = seqA.length, n = seqB.length;

    // Initialize scoring matrix
    const score = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) score[i][0] = i * gap;
    for (let j = 0; j <= n; j++) score[0][j] = j * gap;

    // Fill matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const s = seqA[i - 1] === seqB[j - 1] ? match : mismatch;
        score[i][j] = Math.max(
          score[i - 1][j - 1] + s,
          score[i - 1][j] + gap,
          score[i][j - 1] + gap
        );
      }
    }

    // Traceback
    let alignA = "", alignB = "", midline = "";
    let i = m, j = n;
    let matches = 0, mismatches = 0, gaps = 0;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0) {
        const s = seqA[i - 1] === seqB[j - 1] ? match : mismatch;
        if (score[i][j] === score[i - 1][j - 1] + s) {
          alignA = seqA[i - 1] + alignA;
          alignB = seqB[j - 1] + alignB;
          if (seqA[i - 1] === seqB[j - 1]) { midline = "|" + midline; matches++; }
          else { midline = "." + midline; mismatches++; }
          i--; j--;
          continue;
        }
      }
      if (i > 0 && score[i][j] === score[i - 1][j] + gap) {
        alignA = seqA[i - 1] + alignA;
        alignB = "-" + alignB;
        midline = " " + midline;
        gaps++; i--;
      } else {
        alignA = "-" + alignA;
        alignB = seqB[j - 1] + alignB;
        midline = " " + midline;
        gaps++; j--;
      }
    }

    const alignLen = alignA.length;
    const identity = alignLen > 0 ? Math.round((matches / alignLen) * 10000) / 100 : 0;
    const similarity = alignLen > 0 ? Math.round(((matches + mismatches * 0.5) / alignLen) * 10000) / 100 : 0;

    // Detect sequence type
    const dnaChars = new Set(["A", "T", "G", "C", "N"]);
    const isDNA = [...seqA].every(c => dnaChars.has(c));

    return {
      ok: true, result: {
        alignment: { sequenceA: alignA, midline, sequenceB: alignB },
        score: score[m][n],
        statistics: {
          length: alignLen, matches, mismatches, gaps,
          identity, similarity,
          sequenceType: isDNA ? "DNA" : "protein",
          lengthA: m, lengthB: n,
        },
        parameters: { match, mismatch, gap },
      },
    };
  });

  /**
   * geneExpression
   * Differential expression analysis between two conditions.
   * artifact.data.samples = [{ gene, condition, expression }]
   * Computes fold-change, log2FC, and basic significance ranking.
   */
  registerLensAction("bio", "geneExpression", (ctx, artifact, _params) => {
    const samples = artifact.data?.samples || [];
    if (samples.length === 0) return { ok: true, result: { message: "No expression data." } };

    // Group by gene and condition
    const geneData = {};
    for (const s of samples) {
      if (!geneData[s.gene]) geneData[s.gene] = {};
      if (!geneData[s.gene][s.condition]) geneData[s.gene][s.condition] = [];
      geneData[s.gene][s.condition].push(s.expression);
    }

    const conditions = [...new Set(samples.map(s => s.condition))];
    if (conditions.length < 2) {
      return { ok: true, result: { message: "Need at least 2 conditions for differential analysis." } };
    }

    const [condA, condB] = conditions;
    const results = [];

    for (const [gene, condMap] of Object.entries(geneData)) {
      const valuesA = condMap[condA] || [];
      const valuesB = condMap[condB] || [];
      if (valuesA.length === 0 || valuesB.length === 0) continue;

      const meanA = valuesA.reduce((s, v) => s + v, 0) / valuesA.length;
      const meanB = valuesB.reduce((s, v) => s + v, 0) / valuesB.length;

      // Fold change (B vs A)
      const foldChange = meanA > 0 ? meanB / meanA : Infinity;
      const log2FC = meanA > 0 && meanB > 0 ? Math.log2(meanB / meanA) : 0;

      // Welch's t-test approximation
      const varA = valuesA.length > 1
        ? valuesA.reduce((s, v) => s + Math.pow(v - meanA, 2), 0) / (valuesA.length - 1)
        : 0;
      const varB = valuesB.length > 1
        ? valuesB.reduce((s, v) => s + Math.pow(v - meanB, 2), 0) / (valuesB.length - 1)
        : 0;

      const seA = varA / valuesA.length;
      const seB = varB / valuesB.length;
      const se = Math.sqrt(seA + seB);
      const tStat = se > 0 ? Math.abs(meanB - meanA) / se : 0;

      // Rough p-value approximation from t-statistic (simplified)
      const df = Math.max(1, Math.round(Math.pow(seA + seB, 2) / (
        (seA > 0 ? Math.pow(seA, 2) / (valuesA.length - 1) : 0) +
        (seB > 0 ? Math.pow(seB, 2) / (valuesB.length - 1) : 0) || 1
      )));
      // Approximate p-value using t-distribution CDF (rough estimate)
      const pApprox = Math.exp(-0.717 * tStat - 0.416 * tStat * tStat);

      const regulation = Math.abs(log2FC) < 0.5 ? "unchanged"
        : log2FC > 0 ? "upregulated" : "downregulated";

      results.push({
        gene,
        meanCondA: Math.round(meanA * 100) / 100,
        meanCondB: Math.round(meanB * 100) / 100,
        foldChange: Math.round(foldChange * 1000) / 1000,
        log2FC: Math.round(log2FC * 1000) / 1000,
        tStatistic: Math.round(tStat * 1000) / 1000,
        pValueApprox: Math.round(pApprox * 10000) / 10000,
        degreesOfFreedom: df,
        regulation,
        significant: pApprox < 0.05 && Math.abs(log2FC) >= 1,
      });
    }

    results.sort((a, b) => a.pValueApprox - b.pValueApprox);

    const upregulated = results.filter(r => r.regulation === "upregulated" && r.significant);
    const downregulated = results.filter(r => r.regulation === "downregulated" && r.significant);

    artifact.data.lastExpressionAnalysis = {
      timestamp: new Date().toISOString(),
      conditions: [condA, condB],
      significantGenes: results.filter(r => r.significant).length,
    };

    return {
      ok: true, result: {
        conditions: { conditionA: condA, conditionB: condB },
        genes: results,
        summary: {
          totalGenes: results.length,
          significantGenes: results.filter(r => r.significant).length,
          upregulated: upregulated.length,
          downregulated: downregulated.length,
          unchanged: results.filter(r => r.regulation === "unchanged").length,
          topUpregulated: upregulated.slice(0, 5).map(r => ({ gene: r.gene, log2FC: r.log2FC })),
          topDownregulated: downregulated.slice(0, 5).map(r => ({ gene: r.gene, log2FC: r.log2FC })),
        },
      },
    };
  });

  /**
   * phylogeneticDistance
   * Compute pairwise distance matrix from aligned sequences using
   * Jukes-Cantor or Kimura correction models.
   * artifact.data.sequences = [{ id, sequence }]
   */
  registerLensAction("bio", "phylogeneticDistance", (ctx, artifact, params) => {
    const sequences = artifact.data?.sequences || [];
    if (sequences.length < 2) return { ok: false, error: "Need at least 2 sequences." };
    if (sequences.length > 50) return { ok: false, error: "Limited to 50 sequences." };

    const model = params.model || "jukes-cantor"; // jukes-cantor | kimura
    const r = (v) => Math.round(v * 100000) / 100000;

    // Pairwise distances
    const n = sequences.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    const labels = sequences.map(s => s.id || s.name);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sA = sequences[i].sequence.toUpperCase();
        const sB = sequences[j].sequence.toUpperCase();
        const len = Math.min(sA.length, sB.length);
        let mismatches = 0;
        let transitions = 0; // A↔G, C↔T
        let transversions = 0; // all other mismatches
        const purines = new Set(["A", "G"]);

        for (let k = 0; k < len; k++) {
          if (sA[k] === "-" || sB[k] === "-") continue;
          if (sA[k] !== sB[k]) {
            mismatches++;
            const bothPurine = purines.has(sA[k]) && purines.has(sB[k]);
            const bothPyrimidine = !purines.has(sA[k]) && !purines.has(sB[k]);
            if (bothPurine || bothPyrimidine) transitions++;
            else transversions++;
          }
        }

        const p = len > 0 ? mismatches / len : 0;

        let distance;
        if (model === "kimura") {
          // Kimura 2-parameter: d = -0.5 * ln((1-2P-Q) * sqrt(1-2Q))
          const P = len > 0 ? transitions / len : 0;
          const Q = len > 0 ? transversions / len : 0;
          const inner1 = 1 - 2 * P - Q;
          const inner2 = 1 - 2 * Q;
          if (inner1 > 0 && inner2 > 0) {
            distance = -0.5 * Math.log(inner1 * Math.sqrt(inner2));
          } else {
            distance = Infinity;
          }
        } else {
          // Jukes-Cantor: d = -3/4 * ln(1 - 4p/3)
          const jcInner = 1 - (4 * p) / 3;
          distance = jcInner > 0 ? -0.75 * Math.log(jcInner) : Infinity;
        }

        matrix[i][j] = r(distance);
        matrix[j][i] = r(distance);
      }
    }

    // Find most/least related pairs
    let minDist = Infinity, maxDist = 0;
    let closest = null, farthest = null;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (matrix[i][j] < minDist && matrix[i][j] !== Infinity) {
          minDist = matrix[i][j];
          closest = { a: labels[i], b: labels[j], distance: matrix[i][j] };
        }
        if (matrix[i][j] > maxDist && matrix[i][j] !== Infinity) {
          maxDist = matrix[i][j];
          farthest = { a: labels[i], b: labels[j], distance: matrix[i][j] };
        }
      }
    }

    // Simple UPGMA clustering hint (not full tree, but grouping)
    const avgDistance = [];
    for (let i = 0; i < n; i++) {
      let sum = 0, count = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j && matrix[i][j] !== Infinity) { sum += matrix[i][j]; count++; }
      }
      avgDistance.push({ id: labels[i], avgDistance: count > 0 ? r(sum / count) : Infinity });
    }
    avgDistance.sort((a, b) => a.avgDistance - b.avgDistance);

    return {
      ok: true, result: {
        model, sequenceCount: n, labels,
        distanceMatrix: matrix,
        closest, farthest,
        averageDistances: avgDistance,
      },
    };
  });

  /**
   * motifDetection
   * Find conserved sequence motifs across multiple sequences.
   * artifact.data.sequences = [{ id, sequence }]
   * params.motifLength (default 6), params.minOccurrences (default 2)
   */
  registerLensAction("bio", "motifDetection", (ctx, artifact, params) => {
    const sequences = artifact.data?.sequences || [];
    if (sequences.length === 0) return { ok: true, result: { message: "No sequences provided." } };

    const motifLen = params.motifLength || 6;
    const minOcc = params.minOccurrences || 2;

    // Extract all k-mers from all sequences
    const kmerCounts = {};
    const kmerLocations = {};

    for (const seq of sequences) {
      const s = (seq.sequence || "").toUpperCase();
      const seqId = seq.id || seq.name;
      const seen = new Set(); // track unique k-mers per sequence for presence counting

      for (let i = 0; i <= s.length - motifLen; i++) {
        const kmer = s.substring(i, i + motifLen);
        if (kmer.includes("-") || kmer.includes("N")) continue; // skip gaps/ambiguous
        kmerCounts[kmer] = (kmerCounts[kmer] || 0) + 1;
        if (!kmerLocations[kmer]) kmerLocations[kmer] = [];
        kmerLocations[kmer].push({ sequenceId: seqId, position: i });
        seen.add(kmer);
      }
    }

    // Filter by minimum occurrences and sort by frequency
    const motifs = Object.entries(kmerCounts)
      .filter(([, count]) => count >= minOcc)
      .map(([motif, count]) => {
        // Count how many distinct sequences contain this motif
        const seqIds = [...new Set(kmerLocations[motif].map(l => l.sequenceId))];
        // Compute GC content
        const gc = [...motif].filter(c => c === "G" || c === "C").length / motif.length;
        // Check for palindromic (reverse complement equals self)
        const complement = { A: "T", T: "A", G: "C", C: "G" };
        const revComp = [...motif].reverse().map(c => complement[c] || c).join("");
        const isPalindromic = motif === revComp;

        return {
          motif, occurrences: count, sequenceCount: seqIds.length,
          conservation: Math.round((seqIds.length / sequences.length) * 100),
          gcContent: Math.round(gc * 100),
          isPalindromic,
          locations: kmerLocations[motif].slice(0, 10),
        };
      })
      .sort((a, b) => b.conservation - a.conservation || b.occurrences - a.occurrences);

    // Consensus motifs: those found in >50% of sequences
    const consensus = motifs.filter(m => m.conservation > 50);

    return {
      ok: true, result: {
        motifLength: motifLen, minOccurrences: minOcc,
        totalMotifs: motifs.length,
        topMotifs: motifs.slice(0, 20),
        consensusMotifs: consensus.slice(0, 10),
        sequencesAnalyzed: sequences.length,
      },
    };
  });
}
