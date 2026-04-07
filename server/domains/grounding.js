// server/domains/grounding.js
// Domain actions for knowledge grounding and fact-checking: claim verification,
// source credibility scoring, and compound claim decomposition.

export default function registerGroundingActions(registerLensAction) {
  /**
   * factCheck
   * Check claims against evidence: compute support/contradict/neutral scores
   * for each evidence piece, aggregate confidence.
   * artifact.data.claim = { text, category? }
   * artifact.data.evidence = [{ text, source?, date?, reliability? }]
   */
  registerLensAction("grounding", "factCheck", (ctx, artifact, _params) => {
    const claim = artifact.data?.claim || {};
    const evidence = artifact.data?.evidence || [];
    const claimText = (claim.text || "").toLowerCase();

    if (!claimText) {
      return { ok: true, result: { message: "No claim text provided." } };
    }
    if (evidence.length === 0) {
      return { ok: true, result: { message: "No evidence provided.", verdict: "unverifiable" } };
    }

    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "have",
      "has", "had", "do", "does", "did", "will", "would", "to", "of", "in",
      "for", "on", "with", "at", "by", "from", "as", "and", "but", "or",
      "not", "so", "if", "that", "this", "it", "its", "i", "we", "you",
      "they", "he", "she", "what", "which", "who", "how", "where", "why",
    ]);

    function tokenize(text) {
      return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    }

    // Negation detection
    const negationWords = new Set(["not", "no", "never", "neither", "nobody", "nothing", "nowhere", "nor", "cannot", "can't", "won't", "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't"]);

    function hasNegation(text) {
      const words = text.toLowerCase().split(/\s+/);
      return words.some(w => negationWords.has(w) || w.endsWith("n't"));
    }

    // Cosine similarity between two texts
    function textSimilarity(textA, textB) {
      const tokensA = tokenize(textA);
      const tokensB = tokenize(textB);
      const freqA = {};
      const freqB = {};
      for (const t of tokensA) freqA[t] = (freqA[t] || 0) + 1;
      for (const t of tokensB) freqB[t] = (freqB[t] || 0) + 1;

      const allTokens = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
      let dot = 0, magA = 0, magB = 0;
      for (const t of allTokens) {
        const a = freqA[t] || 0;
        const b = freqB[t] || 0;
        dot += a * b;
        magA += a * a;
        magB += b * b;
      }
      const denom = Math.sqrt(magA) * Math.sqrt(magB);
      return denom > 0 ? dot / denom : 0;
    }

    // Evaluate each evidence piece
    const claimNegated = hasNegation(claimText);
    const evaluations = [];

    for (const ev of evidence) {
      const evText = (ev.text || "").toLowerCase();
      const similarity = textSimilarity(claimText, evText);
      const evNegated = hasNegation(evText);
      const reliability = ev.reliability || 0.7;

      // Determine stance
      let stance;
      let stanceScore;

      if (similarity < 0.1) {
        // Low relevance
        stance = "neutral";
        stanceScore = 0;
      } else {
        // Check for semantic agreement/disagreement
        const samePolarity = claimNegated === evNegated;

        // Contradiction indicators
        const contradictWords = ["however", "contrary", "false", "incorrect", "wrong", "disproven", "debunked", "myth", "inaccurate", "misleading"];
        const supportWords = ["confirmed", "verified", "proven", "true", "correct", "accurate", "supports", "evidence", "demonstrates", "shows"];

        const hasContradict = contradictWords.some(w => evText.includes(w));
        const hasSupport = supportWords.some(w => evText.includes(w));

        if (hasContradict && !hasSupport) {
          stance = "contradicts";
          stanceScore = -similarity * reliability;
        } else if (hasSupport && !hasContradict) {
          stance = "supports";
          stanceScore = similarity * reliability;
        } else if (samePolarity) {
          stance = similarity > 0.4 ? "supports" : "neutral";
          stanceScore = similarity > 0.4 ? similarity * reliability * 0.7 : 0;
        } else {
          stance = "contradicts";
          stanceScore = -similarity * reliability * 0.7;
        }
      }

      evaluations.push({
        source: ev.source || "unknown",
        date: ev.date,
        reliability,
        relevance: Math.round(similarity * 1000) / 1000,
        stance,
        stanceScore: Math.round(stanceScore * 1000) / 1000,
        evidencePreview: ev.text ? ev.text.slice(0, 150) : "",
      });
    }

    // Aggregate confidence
    const supporting = evaluations.filter(e => e.stance === "supports");
    const contradicting = evaluations.filter(e => e.stance === "contradicts");
    const neutral = evaluations.filter(e => e.stance === "neutral");

    const supportScore = supporting.reduce((s, e) => s + e.stanceScore, 0);
    const contradictScore = Math.abs(contradicting.reduce((s, e) => s + e.stanceScore, 0));
    const totalScore = supportScore + contradictScore;

    let aggregateConfidence;
    let verdict;
    if (totalScore === 0) {
      aggregateConfidence = 0;
      verdict = "insufficient evidence";
    } else {
      aggregateConfidence = (supportScore - contradictScore) / Math.max(totalScore, 1);
      if (aggregateConfidence > 0.3) verdict = "likely true";
      else if (aggregateConfidence > 0.1) verdict = "possibly true";
      else if (aggregateConfidence > -0.1) verdict = "uncertain";
      else if (aggregateConfidence > -0.3) verdict = "possibly false";
      else verdict = "likely false";
    }

    // Source agreement: do sources agree with each other?
    const agreementRate = evaluations.length > 1
      ? supporting.length / (supporting.length + contradicting.length || 1)
      : null;

    return {
      ok: true,
      result: {
        claim: claim.text,
        verdict,
        confidence: Math.round(Math.abs(aggregateConfidence) * 1000) / 1000,
        direction: aggregateConfidence >= 0 ? "supporting" : "contradicting",
        evidenceCount: evidence.length,
        breakdown: {
          supporting: { count: supporting.length, totalScore: Math.round(supportScore * 1000) / 1000 },
          contradicting: { count: contradicting.length, totalScore: Math.round(contradictScore * 1000) / 1000 },
          neutral: { count: neutral.length },
        },
        sourceAgreementRate: agreementRate !== null ? Math.round(agreementRate * 1000) / 1000 : null,
        evaluations,
      },
    };
  });

  /**
   * sourceCredibility
   * Score source credibility based on recency, authority indicators,
   * consistency with other sources, and bias detection heuristics.
   * artifact.data.sources = [{ name, url?, type?, date?, claims: [string], affiliations?: [], fundingSources?: [] }]
   */
  registerLensAction("grounding", "sourceCredibility", (ctx, artifact, _params) => {
    const sources = artifact.data?.sources || [];
    if (sources.length === 0) {
      return { ok: true, result: { message: "No sources provided." } };
    }

    // Authority type scores
    const typeScores = {
      "peer-reviewed": 95,
      "academic": 90,
      "government": 85,
      "institutional": 80,
      "news-major": 70,
      "news": 60,
      "encyclopedia": 75,
      "book": 70,
      "report": 65,
      "blog": 35,
      "social-media": 20,
      "forum": 15,
      "unknown": 30,
    };

    // Bias indicator words
    const biasIndicators = {
      emotional: ["shocking", "outrageous", "unbelievable", "incredible", "horrifying", "amazing", "devastating", "explosive", "bombshell"],
      absolutist: ["always", "never", "everyone", "nobody", "all", "none", "every", "completely", "absolutely", "totally", "definitely"],
      partisan: ["liberal", "conservative", "left-wing", "right-wing", "radical", "extremist", "socialist", "fascist", "elite", "mainstream media"],
      promotional: ["buy", "subscribe", "donate", "exclusive", "limited time", "act now", "free", "discount", "sponsored"],
    };

    const now = Date.now();

    const evaluated = sources.map((source, idx) => {
      // 1. Recency score (0-100)
      let recencyScore = 50; // default if no date
      if (source.date) {
        const sourceDate = new Date(source.date).getTime();
        if (!isNaN(sourceDate)) {
          const ageDays = (now - sourceDate) / 86400000;
          if (ageDays < 30) recencyScore = 100;
          else if (ageDays < 90) recencyScore = 90;
          else if (ageDays < 365) recencyScore = 75;
          else if (ageDays < 730) recencyScore = 60;
          else if (ageDays < 1825) recencyScore = 40;
          else recencyScore = 20;
        }
      }

      // 2. Authority score
      const authorityScore = typeScores[source.type || "unknown"] || 30;

      // 3. Bias detection
      const allClaimsText = (source.claims || []).join(" ").toLowerCase();
      const biasScores = {};
      let totalBiasCount = 0;

      for (const [category, words] of Object.entries(biasIndicators)) {
        const matches = words.filter(w => allClaimsText.includes(w));
        biasScores[category] = matches.length;
        totalBiasCount += matches.length;
      }

      const wordCount = allClaimsText.split(/\s+/).length;
      const biasDensity = wordCount > 0 ? totalBiasCount / wordCount : 0;
      const biasScore = Math.max(0, 100 - totalBiasCount * 10 - biasDensity * 500);

      // 4. Consistency with other sources (claim overlap)
      let consistencyScore = 50;
      if (sources.length > 1) {
        const sourceClaims = new Set((source.claims || []).map(c => c.toLowerCase()));
        let agreementCount = 0;
        let comparisonCount = 0;

        for (let j = 0; j < sources.length; j++) {
          if (j === idx) continue;
          const otherClaims = (sources[j].claims || []).map(c => c.toLowerCase());
          for (const claim of sourceClaims) {
            for (const other of otherClaims) {
              comparisonCount++;
              // Simple word overlap check
              const claimWords = new Set(claim.split(/\s+/).filter(w => w.length > 3));
              const otherWords = other.split(/\s+/).filter(w => w.length > 3);
              const overlap = otherWords.filter(w => claimWords.has(w)).length;
              if (overlap >= 3 || (claimWords.size > 0 && overlap / claimWords.size > 0.5)) {
                agreementCount++;
              }
            }
          }
        }

        consistencyScore = comparisonCount > 0
          ? Math.round((agreementCount / comparisonCount) * 100)
          : 50;
      }

      // 5. Funding/affiliation transparency
      const hasAffiliations = (source.affiliations || []).length > 0;
      const hasFunding = (source.fundingSources || []).length > 0;
      const transparencyScore = (hasAffiliations ? 20 : 0) + (hasFunding ? 20 : 0) + 60;

      // Composite credibility score
      const compositeScore = Math.round(
        authorityScore * 0.30 +
        recencyScore * 0.15 +
        biasScore * 0.25 +
        consistencyScore * 0.20 +
        transparencyScore * 0.10
      );

      return {
        name: source.name,
        url: source.url,
        type: source.type || "unknown",
        credibilityScore: compositeScore,
        credibilityLabel: compositeScore >= 80 ? "highly credible" : compositeScore >= 60 ? "credible" : compositeScore >= 40 ? "questionable" : "unreliable",
        components: {
          authority: authorityScore,
          recency: recencyScore,
          bias: Math.round(biasScore),
          consistency: consistencyScore,
          transparency: transparencyScore,
        },
        biasIndicators: biasScores,
        biasDensity: Math.round(biasDensity * 10000) / 10000,
        claimCount: (source.claims || []).length,
        affiliations: source.affiliations || [],
        fundingSources: source.fundingSources || [],
      };
    });

    evaluated.sort((a, b) => b.credibilityScore - a.credibilityScore);

    // Cross-source consistency matrix
    const avgCredibility = evaluated.reduce((s, e) => s + e.credibilityScore, 0) / evaluated.length;
    const credibilitySpread = Math.max(...evaluated.map(e => e.credibilityScore)) - Math.min(...evaluated.map(e => e.credibilityScore));

    return {
      ok: true,
      result: {
        sourceCount: sources.length,
        averageCredibility: Math.round(avgCredibility),
        credibilitySpread,
        overallAssessment: avgCredibility >= 70 ? "reliable source pool" : avgCredibility >= 50 ? "mixed reliability" : "low reliability pool",
        sources: evaluated,
        recommendations: [
          ...(evaluated.filter(e => e.credibilityScore < 40).length > 0
            ? [`${evaluated.filter(e => e.credibilityScore < 40).length} source(s) rated unreliable - consider replacing`]
            : []),
          ...(credibilitySpread > 50 ? ["Large credibility gap between sources - verify claims from highest-rated sources"] : []),
          ...(evaluated.every(e => e.type === evaluated[0].type) ? ["Consider diversifying source types for better triangulation"] : []),
        ],
      },
    };
  });

  /**
   * claimDecomposition
   * Break compound claims into atomic claims, identify logical connectives,
   * and score each component independently.
   * artifact.data.claim = { text }
   * artifact.data.evidence = [{ text, source? }] (optional, for scoring components)
   */
  registerLensAction("grounding", "claimDecomposition", (ctx, artifact, _params) => {
    const claim = artifact.data?.claim || {};
    const evidence = artifact.data?.evidence || [];
    const text = claim.text || "";

    if (!text) {
      return { ok: true, result: { message: "No claim text provided." } };
    }

    // Split on logical connectives
    const connectives = [
      { pattern: /\band\b/gi, type: "conjunction", symbol: "AND" },
      { pattern: /\bor\b/gi, type: "disjunction", symbol: "OR" },
      { pattern: /\bbut\b/gi, type: "contrast", symbol: "BUT" },
      { pattern: /\bhowever\b/gi, type: "contrast", symbol: "HOWEVER" },
      { pattern: /\btherefore\b/gi, type: "consequence", symbol: "THEREFORE" },
      { pattern: /\bbecause\b/gi, type: "causal", symbol: "BECAUSE" },
      { pattern: /\bsince\b/gi, type: "causal", symbol: "SINCE" },
      { pattern: /\bif\b/gi, type: "conditional", symbol: "IF" },
      { pattern: /\bthen\b/gi, type: "conditional", symbol: "THEN" },
      { pattern: /\bwhile\b/gi, type: "temporal", symbol: "WHILE" },
      { pattern: /\balthough\b/gi, type: "concessive", symbol: "ALTHOUGH" },
      { pattern: /\bmoreover\b/gi, type: "additive", symbol: "MOREOVER" },
      { pattern: /\bfurthermore\b/gi, type: "additive", symbol: "FURTHERMORE" },
      { pattern: /\bin addition\b/gi, type: "additive", symbol: "IN_ADDITION" },
      { pattern: /\bas well as\b/gi, type: "additive", symbol: "AS_WELL_AS" },
      { pattern: /\bnot only\b.*\bbut also\b/gi, type: "additive", symbol: "NOT_ONLY_BUT_ALSO" },
    ];

    // Find connectives in the text
    const foundConnectives = [];
    for (const conn of connectives) {
      const matches = text.matchAll(conn.pattern);
      for (const match of matches) {
        foundConnectives.push({
          type: conn.type,
          symbol: conn.symbol,
          position: match.index,
          text: match[0],
        });
      }
    }
    foundConnectives.sort((a, b) => a.position - b.position);

    // Split into atomic claims
    // Use sentence boundaries and connectives as split points
    const splitPattern = /(?:[.!?](?:\s|$))|(?:\b(?:and|but|however|therefore|moreover|furthermore|although|while)\b)/gi;
    const rawParts = text.split(splitPattern).map(s => s.trim()).filter(s => s.length > 5);

    // If no good splits, try comma-separated segments
    const atomicClaims = rawParts.length > 1
      ? rawParts
      : text.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 10 && s.split(/\s+/).length >= 3);

    // If still only one part, return the original as a single atomic claim
    const components = atomicClaims.length > 0
      ? atomicClaims
      : [text];

    // Score each component against evidence if available
    function scoreComponent(componentText) {
      if (evidence.length === 0) return null;

      const compWords = new Set(
        componentText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3)
      );

      let supportScore = 0;
      let contradictScore = 0;
      let relevantCount = 0;

      for (const ev of evidence) {
        const evWords = (ev.text || "").toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const overlap = evWords.filter(w => compWords.has(w)).length;
        const relevance = compWords.size > 0 ? overlap / compWords.size : 0;

        if (relevance < 0.15) continue;
        relevantCount++;

        const evText = (ev.text || "").toLowerCase();
        const negation = ["not", "false", "incorrect", "wrong", "disproven", "never"].some(w => evText.includes(w));

        if (negation) contradictScore += relevance;
        else supportScore += relevance;
      }

      const total = supportScore + contradictScore;
      if (total === 0) return { score: 0, verdict: "unverified", relevantEvidence: 0 };

      const confidence = (supportScore - contradictScore) / total;
      return {
        score: Math.round(confidence * 1000) / 1000,
        verdict: confidence > 0.3 ? "supported" : confidence > -0.3 ? "uncertain" : "challenged",
        relevantEvidence: relevantCount,
      };
    }

    const decomposed = components.map((comp, idx) => {
      const evaluation = scoreComponent(comp);
      // Classify the claim type
      const isQuantitative = /\d+/.test(comp);
      const isCausal = /\b(caused?|leads?\s+to|results?\s+in|because|due\s+to)\b/i.test(comp);
      const isComparative = /\b(more|less|greater|fewer|better|worse|higher|lower|larger|smaller)\b/i.test(comp);
      const isTemporal = /\b(before|after|during|when|while|since|until|first|last|then)\b/i.test(comp);

      let claimType = "declarative";
      if (isQuantitative) claimType = "quantitative";
      else if (isCausal) claimType = "causal";
      else if (isComparative) claimType = "comparative";
      else if (isTemporal) claimType = "temporal";

      return {
        index: idx,
        text: comp,
        claimType,
        wordCount: comp.split(/\s+/).length,
        evaluation,
      };
    });

    // Determine compound claim structure
    let logicalStructure;
    if (foundConnectives.length === 0) {
      logicalStructure = "simple";
    } else {
      const types = new Set(foundConnectives.map(c => c.type));
      if (types.has("conditional")) logicalStructure = "conditional";
      else if (types.has("causal")) logicalStructure = "causal-chain";
      else if (types.has("contrast")) logicalStructure = "contrastive";
      else if (types.size > 1) logicalStructure = "complex-compound";
      else logicalStructure = "compound";
    }

    // Overall assessment
    const scoredComponents = decomposed.filter(d => d.evaluation && d.evaluation.verdict !== "unverified");
    const allSupported = scoredComponents.length > 0 && scoredComponents.every(d => d.evaluation.verdict === "supported");
    const anyChallenged = scoredComponents.some(d => d.evaluation.verdict === "challenged");

    return {
      ok: true,
      result: {
        originalClaim: text,
        atomicClaimCount: decomposed.length,
        logicalStructure,
        connectives: foundConnectives,
        components: decomposed,
        overallAssessment: scoredComponents.length === 0
          ? "no evidence to evaluate"
          : allSupported ? "all components supported"
          : anyChallenged ? "some components challenged"
          : "mixed or uncertain",
        claimComplexity: decomposed.length === 1 ? "simple"
          : decomposed.length <= 3 ? "moderate"
          : "complex",
        claimTypeDistribution: decomposed.reduce((acc, d) => {
          acc[d.claimType] = (acc[d.claimType] || 0) + 1;
          return acc;
        }, {}),
      },
    };
  });
}
