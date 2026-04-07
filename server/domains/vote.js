// server/domains/vote.js
// Domain actions for voting and decision-making: multi-method tallying,
// fairness checking, and consensus measurement.

export default function registerVoteActions(registerLensAction) {
  /**
   * tallyVotes
   * Multi-method vote tallying: plurality, Borda count, approval voting,
   * and Condorcet winner detection.
   * artifact.data.ballots = [{ voter?, rankings: string[] }]
   *   — rankings[0] is most preferred, rankings[n-1] is least preferred
   * artifact.data.candidates = string[] (optional, auto-detected)
   * For approval voting: artifact.data.approvals = [{ voter?, approved: string[] }]
   */
  registerLensAction("vote", "tallyVotes", (ctx, artifact, _params) => {
    const ballots = artifact.data?.ballots || [];
    const approvals = artifact.data?.approvals || [];
    if (ballots.length === 0 && approvals.length === 0) {
      return { ok: false, error: "No ballots or approval data provided." };
    }

    const r = (v) => Math.round(v * 1000) / 1000;

    // Detect candidates from ballots
    const candidateSet = new Set(artifact.data?.candidates || []);
    for (const b of ballots) {
      for (const c of (b.rankings || [])) candidateSet.add(c);
    }
    for (const a of approvals) {
      for (const c of (a.approved || [])) candidateSet.add(c);
    }
    const candidates = [...candidateSet];
    const numCandidates = candidates.length;
    const numVoters = Math.max(ballots.length, approvals.length);

    // --- Plurality: first-choice votes ---
    const pluralityCount = {};
    for (const c of candidates) pluralityCount[c] = 0;
    for (const b of ballots) {
      if (b.rankings && b.rankings.length > 0) {
        const first = b.rankings[0];
        if (pluralityCount[first] !== undefined) pluralityCount[first]++;
      }
    }
    const pluralityRanked = Object.entries(pluralityCount)
      .map(([candidate, votes]) => ({ candidate, votes, share: r(numVoters > 0 ? votes / numVoters : 0) }))
      .sort((a, b) => b.votes - a.votes);
    const pluralityWinner = pluralityRanked[0]?.candidate || null;
    const hasMajority = pluralityRanked[0]?.share > 0.5;

    // --- Borda count ---
    const bordaCount = {};
    for (const c of candidates) bordaCount[c] = 0;
    for (const b of ballots) {
      const ranked = b.rankings || [];
      for (let i = 0; i < ranked.length; i++) {
        // Points: (n-1) for first place, (n-2) for second, etc.
        const points = numCandidates - 1 - i;
        if (bordaCount[ranked[i]] !== undefined) bordaCount[ranked[i]] += points;
      }
    }
    const bordaRanked = Object.entries(bordaCount)
      .map(([candidate, points]) => ({ candidate, points }))
      .sort((a, b) => b.points - a.points);
    const bordaWinner = bordaRanked[0]?.candidate || null;

    // --- Approval voting ---
    const approvalCount = {};
    for (const c of candidates) approvalCount[c] = 0;
    const approvalBallots = approvals.length > 0 ? approvals : ballots.map(b => ({
      approved: (b.rankings || []).slice(0, Math.ceil(numCandidates / 2)),
    }));
    for (const a of approvalBallots) {
      for (const c of (a.approved || [])) {
        if (approvalCount[c] !== undefined) approvalCount[c]++;
      }
    }
    const approvalRanked = Object.entries(approvalCount)
      .map(([candidate, votes]) => ({ candidate, votes, approvalRate: r(numVoters > 0 ? votes / numVoters : 0) }))
      .sort((a, b) => b.votes - a.votes);
    const approvalWinner = approvalRanked[0]?.candidate || null;

    // --- Condorcet winner detection ---
    // Build pairwise preference matrix
    const pairwise = {};
    for (const c1 of candidates) {
      pairwise[c1] = {};
      for (const c2 of candidates) pairwise[c1][c2] = 0;
    }
    for (const b of ballots) {
      const ranked = b.rankings || [];
      for (let i = 0; i < ranked.length; i++) {
        for (let j = i + 1; j < ranked.length; j++) {
          // ranked[i] is preferred over ranked[j]
          if (pairwise[ranked[i]] && pairwise[ranked[i]][ranked[j]] !== undefined) {
            pairwise[ranked[i]][ranked[j]]++;
          }
        }
      }
    }

    // Condorcet winner: beats all others in pairwise comparisons
    let condorcetWinner = null;
    for (const c1 of candidates) {
      let beatsAll = true;
      for (const c2 of candidates) {
        if (c1 === c2) continue;
        if (pairwise[c1][c2] <= pairwise[c2][c1]) {
          beatsAll = false;
          break;
        }
      }
      if (beatsAll) { condorcetWinner = c1; break; }
    }

    // Check for Condorcet cycle
    let hasCycle = false;
    if (!condorcetWinner && candidates.length >= 3) {
      // Simple cycle detection: check if A>B>C>A exists
      for (const a of candidates) {
        for (const b of candidates) {
          if (a === b) continue;
          if (pairwise[a][b] <= pairwise[b][a]) continue;
          for (const c of candidates) {
            if (c === a || c === b) continue;
            if (pairwise[b][c] > pairwise[c][b] && pairwise[c][a] > pairwise[a][c]) {
              hasCycle = true;
              break;
            }
          }
          if (hasCycle) break;
        }
        if (hasCycle) break;
      }
    }

    // Method agreement
    const winners = [pluralityWinner, bordaWinner, approvalWinner, condorcetWinner].filter(Boolean);
    const uniqueWinners = [...new Set(winners)];
    const methodAgreement = uniqueWinners.length === 1 ? "unanimous" : uniqueWinners.length <= 2 ? "partial" : "divergent";

    return {
      ok: true,
      result: {
        candidates,
        numVoters,
        numCandidates,
        plurality: { ranking: pluralityRanked, winner: pluralityWinner, hasMajority },
        bordaCount: { ranking: bordaRanked, winner: bordaWinner },
        approvalVoting: { ranking: approvalRanked, winner: approvalWinner },
        condorcet: { winner: condorcetWinner, hasCycle, pairwiseMatrix: pairwise },
        methodAgreement,
        overallWinner: condorcetWinner || (methodAgreement === "unanimous" ? uniqueWinners[0] : pluralityWinner),
      },
    };
  });

  /**
   * fairnessCheck
   * Check voting fairness — detect strategic voting patterns,
   * compute Gallagher index of disproportionality, and verify majority criterion.
   * artifact.data.ballots = [{ voter?, rankings: string[] }]
   * artifact.data.results = { [candidate]: seatShare } (for Gallagher index)
   */
  registerLensAction("vote", "fairnessCheck", (ctx, artifact, _params) => {
    const ballots = artifact.data?.ballots || [];
    const results = artifact.data?.results || {};
    if (ballots.length === 0) return { ok: false, error: "No ballot data provided." };

    const r = (v) => Math.round(v * 1000) / 1000;
    const numVoters = ballots.length;

    // Detect candidates
    const candidateSet = new Set();
    for (const b of ballots) {
      for (const c of (b.rankings || [])) candidateSet.add(c);
    }
    const candidates = [...candidateSet];

    // First-choice vote shares
    const firstChoice = {};
    for (const c of candidates) firstChoice[c] = 0;
    for (const b of ballots) {
      if (b.rankings?.[0]) firstChoice[b.rankings[0]]++;
    }
    const voteShares = {};
    for (const c of candidates) voteShares[c] = numVoters > 0 ? firstChoice[c] / numVoters : 0;

    // --- Gallagher Index of Disproportionality ---
    // LSq = sqrt(0.5 * sum((v_i - s_i)^2))
    let gallagherSum = 0;
    const seatShares = {};
    if (Object.keys(results).length > 0) {
      const totalSeats = Object.values(results).reduce((s, v) => s + v, 0);
      for (const c of candidates) {
        seatShares[c] = totalSeats > 0 ? (results[c] || 0) / totalSeats : 0;
        const diff = (voteShares[c] || 0) * 100 - seatShares[c] * 100;
        gallagherSum += diff * diff;
      }
    }
    const gallagherIndex = Math.sqrt(gallagherSum / 2);
    const gallagherLabel = gallagherIndex < 2 ? "highly proportional" : gallagherIndex < 5 ? "moderately proportional" : gallagherIndex < 10 ? "disproportional" : "highly disproportional";

    // --- Majority criterion check ---
    // If a candidate has > 50% first-choice votes, they should win
    const majorityCandidate = candidates.find(c => voteShares[c] > 0.5);
    const declaredWinner = Object.entries(results).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const majorityCriterionMet = !majorityCandidate || majorityCandidate === declaredWinner;

    // --- Strategic voting detection ---
    // Detect burying: voter ranks a strong competitor last despite that
    // candidate being popular (high first-choice count)
    const popularity = { ...firstChoice };
    const popularCandidates = candidates
      .filter(c => voteShares[c] > 1 / candidates.length)
      .sort((a, b) => popularity[b] - popularity[a]);

    let buryingCount = 0;
    let compromiseCount = 0;
    const strategicPatterns = [];

    for (const b of ballots) {
      const ranked = b.rankings || [];
      if (ranked.length < 3) continue;

      // Burying: a popular candidate placed last
      const lastChoice = ranked[ranked.length - 1];
      if (popularCandidates.includes(lastChoice) && popularity[lastChoice] > numVoters * 0.2) {
        buryingCount++;
      }

      // Compromise: voter's first choice is unpopular, but second choice is very popular
      // This might indicate strategic voting
      const first = ranked[0];
      const second = ranked[1];
      if (first && second && popularity[first] < numVoters * 0.1 && popularity[second] > numVoters * 0.25) {
        compromiseCount++;
      }
    }

    if (buryingCount > numVoters * 0.1) {
      strategicPatterns.push({ type: "burying", count: buryingCount, severity: buryingCount > numVoters * 0.2 ? "high" : "moderate" });
    }
    if (compromiseCount > numVoters * 0.15) {
      strategicPatterns.push({ type: "compromise", count: compromiseCount, severity: compromiseCount > numVoters * 0.3 ? "high" : "moderate" });
    }

    // --- Monotonicity check via preference reversal count ---
    // Count how often a candidate ranked higher by more voters still loses
    const pairwiseLosses = {};
    for (const c of candidates) pairwiseLosses[c] = 0;
    for (const c1 of candidates) {
      for (const c2 of candidates) {
        if (c1 === c2) continue;
        let prefC1 = 0;
        for (const b of ballots) {
          const idx1 = (b.rankings || []).indexOf(c1);
          const idx2 = (b.rankings || []).indexOf(c2);
          if (idx1 !== -1 && (idx2 === -1 || idx1 < idx2)) prefC1++;
        }
        if (prefC1 < numVoters / 2) pairwiseLosses[c1]++;
      }
    }

    // Effective number of parties/candidates (Laakso-Taagepera)
    const voteShareValues = Object.values(voteShares);
    const hhi = voteShareValues.reduce((s, v) => s + v * v, 0);
    const effectiveNCandidates = hhi > 0 ? 1 / hhi : candidates.length;

    return {
      ok: true,
      result: {
        numVoters,
        numCandidates: candidates.length,
        effectiveCandidates: r(effectiveNCandidates),
        voteShares,
        gallagherIndex: Object.keys(results).length > 0 ? r(gallagherIndex) : "N/A (no seat data)",
        gallagherLabel: Object.keys(results).length > 0 ? gallagherLabel : null,
        majorityCriterion: {
          majorityCandidate,
          met: majorityCriterionMet,
          detail: majorityCandidate
            ? (majorityCriterionMet ? `${majorityCandidate} has majority and wins — criterion met` : `${majorityCandidate} has majority but did not win — criterion VIOLATED`)
            : "No candidate has a majority of first-choice votes",
        },
        strategicVoting: {
          detected: strategicPatterns.length > 0,
          patterns: strategicPatterns,
          buryingSuspects: buryingCount,
          compromiseSuspects: compromiseCount,
        },
        pairwiseLosses,
      },
    };
  });

  /**
   * consensusMeasure
   * Measure group consensus from ratings or rankings.
   * artifact.data.ratings = [{ voter?, items: { [item]: number } }]
   *   — each voter rates each item on a numeric scale
   * OR artifact.data.ballots = [{ voter?, rankings: string[] }]
   */
  registerLensAction("vote", "consensusMeasure", (ctx, artifact, _params) => {
    const ratings = artifact.data?.ratings || [];
    const ballots = artifact.data?.ballots || [];

    if (ratings.length === 0 && ballots.length === 0) {
      return { ok: false, error: "No ratings or ballot data provided." };
    }

    const r = (v) => Math.round(v * 1000) / 1000;

    // Use ratings if available, otherwise convert rankings to ratings
    let ratingMatrix = ratings;
    if (ratingMatrix.length === 0 && ballots.length > 0) {
      const allItems = new Set();
      for (const b of ballots) for (const c of (b.rankings || [])) allItems.add(c);
      const items = [...allItems];
      ratingMatrix = ballots.map(b => {
        const itemRatings = {};
        const ranked = b.rankings || [];
        for (const item of items) {
          const idx = ranked.indexOf(item);
          itemRatings[item] = idx === -1 ? 0 : items.length - idx;
        }
        return { voter: b.voter, items: itemRatings };
      });
    }

    const numVoters = ratingMatrix.length;
    const allItems = new Set();
    for (const r of ratingMatrix) for (const item of Object.keys(r.items || {})) allItems.add(item);
    const items = [...allItems];
    const numItems = items.length;

    if (numVoters < 2 || numItems === 0) {
      return { ok: false, error: "Need at least 2 voters and 1 item." };
    }

    // --- Agreement percentage ---
    // For each pair of items, check if voters agree on relative ordering
    let agreementPairs = 0;
    let totalPairs = 0;
    for (let i = 0; i < numItems; i++) {
      for (let j = i + 1; j < numItems; j++) {
        let prefI = 0, prefJ = 0;
        for (const voter of ratingMatrix) {
          const ri = voter.items?.[items[i]] ?? 0;
          const rj = voter.items?.[items[j]] ?? 0;
          if (ri > rj) prefI++;
          else if (rj > ri) prefJ++;
        }
        const maxPref = Math.max(prefI, prefJ);
        agreementPairs += maxPref;
        totalPairs += prefI + prefJ;
      }
    }
    const agreementPercent = totalPairs > 0 ? (agreementPairs / totalPairs) * 100 : 100;

    // --- Fleiss' Kappa ---
    // Categorize ratings into bins for kappa computation
    const allValues = [];
    for (const voter of ratingMatrix) {
      for (const val of Object.values(voter.items || {})) allValues.push(val);
    }
    const uniqueValues = [...new Set(allValues)].sort((a, b) => a - b);
    const numCategories = uniqueValues.length;
    const valueMap = {};
    uniqueValues.forEach((v, i) => { valueMap[v] = i; });

    // n_ij: number of raters who assigned category j to item i
    const nij = [];
    for (const item of items) {
      const row = new Array(numCategories).fill(0);
      for (const voter of ratingMatrix) {
        const val = voter.items?.[item];
        if (val !== undefined && valueMap[val] !== undefined) {
          row[valueMap[val]]++;
        }
      }
      nij.push(row);
    }

    // P_i for each item
    const Pi = nij.map(row => {
      const sum = row.reduce((s, v) => s + v * (v - 1), 0);
      const total = row.reduce((s, v) => s + v, 0);
      return total > 1 ? sum / (total * (total - 1)) : 0;
    });

    // P_bar (mean agreement)
    const Pbar = Pi.reduce((s, p) => s + p, 0) / numItems;

    // P_e (expected agreement by chance)
    const totalRatings = numItems * numVoters;
    const pj = new Array(numCategories).fill(0);
    for (const row of nij) {
      for (let j = 0; j < numCategories; j++) pj[j] += row[j];
    }
    for (let j = 0; j < numCategories; j++) pj[j] /= totalRatings;
    const Pe = pj.reduce((s, p) => s + p * p, 0);

    const fleissKappa = Pe < 1 ? (Pbar - Pe) / (1 - Pe) : 1;
    const kappaLabel = fleissKappa > 0.8 ? "almost perfect" : fleissKappa > 0.6 ? "substantial" : fleissKappa > 0.4 ? "moderate" : fleissKappa > 0.2 ? "fair" : fleissKappa > 0 ? "slight" : "poor";

    // --- Entropy-based disagreement ---
    // Shannon entropy per item across voter ratings
    let totalEntropy = 0;
    const itemEntropies = {};
    for (const item of items) {
      const valueCounts = {};
      for (const voter of ratingMatrix) {
        const val = voter.items?.[item];
        if (val !== undefined) valueCounts[val] = (valueCounts[val] || 0) + 1;
      }
      const total = Object.values(valueCounts).reduce((s, v) => s + v, 0);
      let entropy = 0;
      for (const count of Object.values(valueCounts)) {
        const p = count / total;
        if (p > 0) entropy -= p * Math.log2(p);
      }
      itemEntropies[item] = r(entropy);
      totalEntropy += entropy;
    }
    const avgEntropy = numItems > 0 ? totalEntropy / numItems : 0;
    const maxPossibleEntropy = numVoters > 0 ? Math.log2(numVoters) : 1;
    const normalizedDisagreement = maxPossibleEntropy > 0 ? avgEntropy / maxPossibleEntropy : 0;

    // --- Polarization index ---
    // Measure bimodality of rating distributions per item
    let polarizationSum = 0;
    for (const item of items) {
      const vals = ratingMatrix.map(v => v.items?.[item] ?? 0);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      // Variance and bimodality coefficient
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      const m3 = vals.reduce((s, v) => s + (v - mean) ** 3, 0) / vals.length;
      const m4 = vals.reduce((s, v) => s + (v - mean) ** 4, 0) / vals.length;
      const skewness = variance > 0 ? m3 / Math.pow(Math.sqrt(variance), 3) : 0;
      const kurtosis = variance > 0 ? m4 / (variance * variance) : 0;
      // Bimodality coefficient: (skewness^2 + 1) / kurtosis
      // Values > 5/9 suggest bimodality (polarization)
      const bimodalityCoeff = kurtosis > 0 ? (skewness * skewness + 1) / kurtosis : 0;
      polarizationSum += bimodalityCoeff > 5 / 9 ? 1 : 0;
    }
    const polarizationIndex = numItems > 0 ? polarizationSum / numItems : 0;

    // Per-item consensus summary
    const itemConsensus = items.map(item => {
      const vals = ratingMatrix.map(v => v.items?.[item] ?? 0);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      return { item, mean: r(mean), stdDev: r(std), entropy: itemEntropies[item] };
    }).sort((a, b) => a.stdDev - b.stdDev);

    return {
      ok: true,
      result: {
        numVoters,
        numItems,
        agreementPercent: r(agreementPercent),
        fleissKappa: r(fleissKappa),
        kappaInterpretation: kappaLabel,
        entropy: {
          average: r(avgEntropy),
          normalizedDisagreement: r(normalizedDisagreement),
          perItem: itemEntropies,
        },
        polarizationIndex: r(polarizationIndex),
        polarizationLabel: polarizationIndex > 0.6 ? "highly polarized" : polarizationIndex > 0.3 ? "moderately polarized" : "low polarization",
        itemConsensus: {
          mostAgreed: itemConsensus.slice(0, 3),
          mostDisputed: itemConsensus.slice(-3).reverse(),
        },
        overallConsensus: fleissKappa > 0.6 && polarizationIndex < 0.3 ? "strong" : fleissKappa > 0.3 ? "moderate" : "weak",
      },
    };
  });
}
