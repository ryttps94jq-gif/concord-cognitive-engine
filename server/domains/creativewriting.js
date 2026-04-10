// server/domains/creativewriting.js
export default function registerCreativeWritingActions(registerLensAction) {
  registerLensAction("creative-writing", "manuscriptAnalysis", (ctx, artifact, _params) => {
    const text = artifact.data?.content || artifact.data?.text || "";
    if (!text) return { ok: true, result: { message: "Add manuscript text to analyze." } };
    const words = text.split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter(Boolean);
    const paragraphs = text.split(/\n\n+/).filter(Boolean);
    const avgWordsPerSentence = sentences.length > 0 ? Math.round(words.length / sentences.length * 10) / 10 : 0;
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, ""))).size;
    const vocabularyRichness = words.length > 0 ? Math.round((uniqueWords / words.length) * 100) : 0;
    const dialogueLines = (text.match(/[""][^""]*[""]|["""][^""]*["""]/g) || []).length;
    const dialoguePercent = sentences.length > 0 ? Math.round((dialogueLines / sentences.length) * 100) : 0;
    return { ok: true, result: { wordCount: words.length, sentenceCount: sentences.length, paragraphCount: paragraphs.length, avgWordsPerSentence, vocabularyRichness, dialoguePercent, readingLevel: avgWordsPerSentence > 20 ? "advanced" : avgWordsPerSentence > 14 ? "intermediate" : "accessible", estimatedReadTime: `${Math.ceil(words.length / 250)} minutes`, pacing: avgWordsPerSentence < 12 ? "fast-paced" : avgWordsPerSentence < 18 ? "moderate" : "literary" } };
  });
  registerLensAction("creative-writing", "characterProfile", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const traits = data.traits || [];
    const motivations = data.motivations || [];
    const flaws = data.flaws || [];
    const complexity = Math.min(100, (traits.length * 10 + motivations.length * 15 + flaws.length * 20));
    return { ok: true, result: { name: data.characterName || data.name || artifact.title, role: data.role || "protagonist", traits, motivations, flaws, complexityScore: complexity, arcType: data.arcType || (flaws.length > 0 ? "transformation" : "flat"), dimensionality: complexity >= 60 ? "three-dimensional" : complexity >= 30 ? "two-dimensional" : "archetype", suggestions: flaws.length === 0 ? ["Add character flaws for depth"] : motivations.length === 0 ? ["Define core motivation"] : ["Character is well-developed"] } };
  });
  registerLensAction("creative-writing", "plotStructure", (ctx, artifact, _params) => {
    const beats = artifact.data?.beats || artifact.data?.plotPoints || [];
    const structure = artifact.data?.structure || "three-act";
    const structures = {
      "three-act": ["Setup", "Confrontation", "Resolution"],
      "heros-journey": ["Ordinary World", "Call to Adventure", "Refusal", "Meeting Mentor", "Crossing Threshold", "Tests", "Approach", "Ordeal", "Reward", "Road Back", "Resurrection", "Return"],
      "five-act": ["Exposition", "Rising Action", "Climax", "Falling Action", "Denouement"],
      "save-the-cat": ["Opening Image", "Theme Stated", "Setup", "Catalyst", "Debate", "Break into Two", "B Story", "Fun and Games", "Midpoint", "Bad Guys Close In", "All Is Lost", "Dark Night of the Soul", "Break into Three", "Finale", "Final Image"],
    };
    const template = structures[structure] || structures["three-act"];
    const coverage = template.map(beat => ({ beat, covered: beats.some(b => (b.name || b).toLowerCase().includes(beat.toLowerCase().slice(0, 5))), note: beats.find(b => (b.name || b).toLowerCase().includes(beat.toLowerCase().slice(0, 5)))?.name || null }));
    return { ok: true, result: { structure, beats: coverage, coveragePercent: Math.round((coverage.filter(c => c.covered).length / coverage.length) * 100), missingBeats: coverage.filter(c => !c.covered).map(c => c.beat), totalPlotPoints: beats.length } };
  });
  registerLensAction("creative-writing", "dialogueCheck", (ctx, artifact, _params) => {
    const dialogue = artifact.data?.dialogue || artifact.data?.content || "";
    const lines = dialogue.split("\n").filter(l => l.trim());
    const speakers = {};
    for (const line of lines) {
      const match = line.match(/^([^:""]+)[:]/);
      if (match) { const name = match[1].trim(); speakers[name] = (speakers[name] || 0) + 1; }
    }
    const totalLines = lines.length;
    const speakerCount = Object.keys(speakers).length;
    const avgLineLength = lines.length > 0 ? Math.round(lines.reduce((s, l) => s + l.length, 0) / lines.length) : 0;
    return { ok: true, result: { totalLines, speakers: Object.entries(speakers).map(([name, count]) => ({ name, lines: count, percent: Math.round((count / totalLines) * 100) })), speakerCount, avgLineLength, balance: speakerCount > 1 ? (Math.max(...Object.values(speakers)) / totalLines < 0.7 ? "balanced" : "one-character-dominant") : "monologue", pacing: avgLineLength < 50 ? "snappy" : avgLineLength < 100 ? "natural" : "long-winded" } };
  });
}
