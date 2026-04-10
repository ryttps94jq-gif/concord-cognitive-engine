// server/domains/reasoning.js
export default function registerReasoningActions(registerLensAction) {
  registerLensAction("reasoning", "logicValidate", (ctx, artifact, _params) => {
    const premises = artifact.data?.premises || [];
    const conclusion = artifact.data?.conclusion || "";
    if (premises.length === 0) return { ok: true, result: { message: "Provide premises and a conclusion to validate." } };
    const contradictions = [];
    const normalized = premises.map(p => p.toLowerCase().trim());
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        const a = normalized[i];
        const b = normalized[j];
        if ((a.includes("not") && b === a.replace(/\bnot\b\s*/g, "").trim()) ||
            (b.includes("not") && a === b.replace(/\bnot\b\s*/g, "").trim()) ||
            (a.includes("all") && b.includes("no") && a.replace("all", "").trim() === b.replace("no", "").trim()) ||
            (a.includes("always") && b.includes("never") && a.replace("always", "").trim() === b.replace("never", "").trim())) {
          contradictions.push({ premise1: premises[i], premise2: premises[j], type: "negation-contradiction" });
        }
      }
    }
    const conclusionTerms = conclusion.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const premiseTerms = normalized.join(" ").split(/\s+/).filter(w => w.length > 3);
    const supportedTerms = conclusionTerms.filter(t => premiseTerms.includes(t));
    const unsupportedTerms = conclusionTerms.filter(t => !premiseTerms.includes(t));
    const support = conclusionTerms.length > 0 ? Math.round((supportedTerms.length / conclusionTerms.length) * 100) : 0;
    return { ok: true, result: { premiseCount: premises.length, conclusion, contradictions, hasContradictions: contradictions.length > 0, termSupport: support, supportedTerms, unsupportedTerms, validity: contradictions.length > 0 ? "invalid-contradictions" : support > 70 ? "likely-valid" : support > 40 ? "partially-supported" : "weak-support", recommendation: contradictions.length > 0 ? "Resolve contradictions before proceeding" : support < 50 ? "Conclusion introduces terms not found in premises — may be an unsupported leap" : "Argument structure appears sound" } };
  });

  registerLensAction("reasoning", "argumentMap", (ctx, artifact, _params) => {
    const claims = artifact.data?.claims || [];
    if (claims.length === 0) return { ok: true, result: { message: "Provide claims with support/counter relationships." } };
    const nodes = claims.map((c, i) => ({
      id: c.id || `claim-${i}`, text: c.text || c.claim || "", type: c.type || "claim",
      supports: c.supports || [], counters: c.counters || [],
    }));
    const strengthMap = {};
    nodes.forEach(n => {
      const supportCount = nodes.filter(o => o.supports.includes(n.id)).length;
      const counterCount = nodes.filter(o => o.counters.includes(n.id)).length;
      strengthMap[n.id] = { support: supportCount, counter: counterCount, net: supportCount - counterCount, strength: Math.max(0, Math.min(100, 50 + (supportCount - counterCount) * 15)) };
    });
    const rootClaims = nodes.filter(n => !nodes.some(o => o.supports.includes(n.id) || o.counters.includes(n.id)) || n.type === "thesis");
    return { ok: true, result: { totalClaims: nodes.length, rootClaims: rootClaims.map(r => r.id), strengthMap, strongestClaim: Object.entries(strengthMap).sort((a, b) => b[1].strength - a[1].strength)[0]?.[0], weakestClaim: Object.entries(strengthMap).sort((a, b) => a[1].strength - b[1].strength)[0]?.[0], uncontested: nodes.filter(n => strengthMap[n.id].counter === 0).map(n => n.id), contested: nodes.filter(n => strengthMap[n.id].counter > 0).map(n => n.id) } };
  });

  registerLensAction("reasoning", "fallacyDetect", (ctx, artifact, _params) => {
    const text = artifact.data?.text || artifact.data?.argument || "";
    if (!text) return { ok: true, result: { message: "Provide argument text to check for fallacies." } };
    const lower = text.toLowerCase();
    const fallacyPatterns = [
      { name: "Ad Hominem", patterns: ["you're just", "you are just", "what do you know", "someone like you", "you always", "you never", "of course you would say"], description: "Attacking the person rather than their argument" },
      { name: "Straw Man", patterns: ["so you're saying", "what you really mean", "you think that", "basically you want"], description: "Misrepresenting someone's argument to attack it" },
      { name: "False Dichotomy", patterns: ["either you", "you're either", "it's either", "only two options", "there are only two", "you must choose between"], description: "Presenting only two options when more exist" },
      { name: "Appeal to Authority", patterns: ["experts say", "studies show", "everyone knows", "scientists agree", "it is well known"], description: "Citing authority without specific evidence" },
      { name: "Slippery Slope", patterns: ["next thing you know", "before you know it", "this will lead to", "eventually", "where does it end", "if we allow"], description: "Assuming one event inevitably leads to extreme consequences" },
      { name: "Appeal to Emotion", patterns: ["think of the children", "how would you feel", "imagine if", "doesn't it make you angry", "the right thing to do"], description: "Using emotion rather than logic" },
      { name: "Bandwagon", patterns: ["everyone is doing", "most people", "majority of people", "popular opinion", "everyone agrees", "nobody thinks"], description: "Arguing something is true because many believe it" },
      { name: "Circular Reasoning", patterns: ["because it is", "it's true because", "the reason is because", "obviously true"], description: "Using the conclusion as a premise" },
    ];
    const detected = [];
    fallacyPatterns.forEach(f => {
      const matches = f.patterns.filter(p => lower.includes(p));
      if (matches.length > 0) detected.push({ fallacy: f.name, description: f.description, matchedPatterns: matches, severity: matches.length > 1 ? "high" : "moderate" });
    });
    return { ok: true, result: { textLength: text.length, fallaciesDetected: detected.length, fallacies: detected, overallAssessment: detected.length === 0 ? "No obvious fallacies detected" : detected.length <= 2 ? "Minor logical issues found" : "Multiple fallacies detected — argument needs restructuring", logicalStrength: Math.max(0, 100 - detected.length * 20) } };
  });

  registerLensAction("reasoning", "premiseExtract", (ctx, artifact, _params) => {
    const text = artifact.data?.text || artifact.data?.argument || "";
    if (!text) return { ok: true, result: { message: "Provide argument text to extract premises." } };
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    const premiseIndicators = ["because", "since", "given that", "as", "for", "whereas", "considering", "due to", "based on", "the fact that"];
    const conclusionIndicators = ["therefore", "thus", "hence", "so", "consequently", "it follows", "we can conclude", "this means", "this shows", "proves that"];
    const normativeIndicators = ["should", "must", "ought", "need to", "have to", "right to", "wrong to", "obligated"];
    const factualIndicators = ["is", "are", "was", "were", "has been", "data shows", "research", "study", "evidence", "found that", "measured"];
    const classified = sentences.map(s => {
      const lower = s.toLowerCase();
      const isPremise = premiseIndicators.some(p => lower.includes(p));
      const isConclusion = conclusionIndicators.some(p => lower.includes(p));
      const isNormative = normativeIndicators.some(p => lower.includes(p));
      const isFactual = factualIndicators.some(p => lower.includes(p));
      return {
        text: s,
        role: isConclusion ? "conclusion" : isPremise ? "premise" : "statement",
        type: isNormative ? "normative" : isFactual ? "factual" : "definitional",
      };
    });
    const premises = classified.filter(c => c.role === "premise");
    const conclusions = classified.filter(c => c.role === "conclusion");
    return { ok: true, result: { totalSentences: sentences.length, premises: premises.length, conclusions: conclusions.length, statements: classified.filter(c => c.role === "statement").length, classified, premiseTypes: { factual: premises.filter(p => p.type === "factual").length, normative: premises.filter(p => p.type === "normative").length, definitional: premises.filter(p => p.type === "definitional").length } } };
  });
}
