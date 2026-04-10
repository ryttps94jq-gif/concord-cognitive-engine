// server/domains/debate.js
export default function registerDebateActions(registerLensAction) {
  registerLensAction("debate", "evaluateArgument", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const claim = data.claim || data.thesis || "";
    const evidence = data.evidence || [];
    const reasoning = data.reasoning || "";
    if (!claim) return { ok: true, result: { message: "State a claim to evaluate the argument." } };
    const evidenceScore = Math.min(100, evidence.length * 20);
    const reasoningScore = reasoning.length > 200 ? 80 : reasoning.length > 50 ? 50 : reasoning.length > 0 ? 25 : 0;
    const hasCounterpoint = !!(data.counterpoint || data.rebuttal);
    const overallScore = Math.round(evidenceScore * 0.4 + reasoningScore * 0.4 + (hasCounterpoint ? 20 : 0));
    const fallacies = [];
    const lowerClaim = (claim + " " + reasoning).toLowerCase();
    if (lowerClaim.includes("everyone knows") || lowerClaim.includes("obviously")) fallacies.push("Appeal to common knowledge");
    if (lowerClaim.includes("always") || lowerClaim.includes("never")) fallacies.push("Overgeneralization");
    if (lowerClaim.match(/if .* then .* therefore/)) fallacies.push("Possible slippery slope");
    return { ok: true, result: { claim: claim.slice(0, 200), evidenceCount: evidence.length, evidenceScore, reasoningScore, addressesCounterpoints: hasCounterpoint, overallScore, fallaciesDetected: fallacies, strength: overallScore >= 70 ? "strong" : overallScore >= 40 ? "moderate" : "weak" } };
  });
  registerLensAction("debate", "steelmanPosition", (ctx, artifact, _params) => {
    const position = artifact.data?.position || artifact.data?.argument || "";
    if (!position) return { ok: true, result: { message: "State a position to steelman." } };
    const words = position.split(/\s+/);
    const strengthened = {
      originalLength: words.length,
      improvements: [
        "Identify the strongest version of this argument",
        "Add the most compelling evidence that supports it",
        "Address the strongest objection and show why it fails",
        "Connect to universally-held values (fairness, liberty, safety)",
        "Provide concrete examples and data",
      ],
      framework: { premise: "If we grant the strongest interpretation...", evidence: "The best evidence shows...", conclusion: "Therefore, the most defensible version is..." },
    };
    return { ok: true, result: { originalPosition: position.slice(0, 300), steelmanSteps: strengthened.improvements, framework: strengthened.framework, note: "Steelmanning means presenting the strongest possible version of an opponent's argument" } };
  });
  registerLensAction("debate", "scoreDebate", (ctx, artifact, _params) => {
    const sides = artifact.data?.sides || [];
    if (sides.length < 2) return { ok: true, result: { message: "Add at least 2 debate sides with arguments." } };
    const scored = sides.map(s => {
      const args = s.arguments || [];
      const evidenceCount = args.reduce((sum, a) => sum + ((a.evidence || []).length), 0);
      const rebuttals = args.filter(a => a.rebuttal || a.counters).length;
      const score = Math.round(args.length * 15 + evidenceCount * 10 + rebuttals * 20);
      return { side: s.name || s.position, arguments: args.length, evidencePoints: evidenceCount, rebuttals, score, highlights: args.slice(0, 2).map(a => a.claim || a.point || "").filter(Boolean) };
    }).sort((a, b) => b.score - a.score);
    return { ok: true, result: { sides: scored, winner: scored[0]?.side, margin: scored.length >= 2 ? scored[0].score - scored[1].score : 0, close: scored.length >= 2 && Math.abs(scored[0].score - scored[1].score) < 20 } };
  });
  registerLensAction("debate", "fallacyCheck", (ctx, artifact, _params) => {
    const text = artifact.data?.text || artifact.data?.argument || "";
    if (!text) return { ok: true, result: { message: "Provide text to check for logical fallacies." } };
    const lower = text.toLowerCase();
    const checks = [
      { name: "Ad Hominem", pattern: /attack.*person|character|insult/i, desc: "Attacking the person instead of the argument" },
      { name: "Straw Man", pattern: /misrepresent|distort|not what.*said/i, desc: "Misrepresenting an argument to make it easier to attack" },
      { name: "Appeal to Authority", pattern: /expert.*says|according to.*famous/i, desc: "Using authority as proof without evidence" },
      { name: "False Dilemma", pattern: /either.*or|only two|no other/i, desc: "Presenting only two options when more exist" },
      { name: "Slippery Slope", pattern: /will lead to|inevitably|domino/i, desc: "Assuming one event will cause a chain of negative events" },
      { name: "Red Herring", pattern: /but what about|changing.*subject/i, desc: "Introducing irrelevant information to divert attention" },
      { name: "Circular Reasoning", pattern: /because.*because|true because.*true/i, desc: "Using the conclusion as a premise" },
      { name: "Bandwagon", pattern: /everyone|most people|popular/i, desc: "Arguing something is true because many believe it" },
    ];
    const detected = checks.filter(c => c.pattern.test(text)).map(c => ({ fallacy: c.name, description: c.desc }));
    return { ok: true, result: { textLength: text.length, fallaciesDetected: detected, count: detected.length, logicalSoundness: detected.length === 0 ? "appears-sound" : detected.length <= 2 ? "minor-issues" : "significant-issues" } };
  });
}
