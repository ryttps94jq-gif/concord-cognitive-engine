// server/domains/music.js
export default function registerMusicActions(registerLensAction) {
  registerLensAction("music", "bpmAnalyze", (ctx, artifact, _params) => {
    const beats = artifact.data?.beats || artifact.data?.timestamps || [];
    if (beats.length < 4) return { ok: true, result: { message: "Provide 4+ beat timestamps (in seconds) to analyze BPM." } };
    const times = beats.map(Number).sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < times.length; i++) intervals.push(times[i] - times[i - 1]);
    const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length;
    const bpm = avgInterval > 0 ? Math.round(60 / avgInterval) : 0;
    const variance = intervals.reduce((s, i) => s + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const stability = Math.max(0, Math.round((1 - Math.sqrt(variance) / avgInterval) * 100));
    const minBpm = Math.round(60 / Math.max(...intervals));
    const maxBpm = Math.round(60 / Math.min(...intervals));
    return { ok: true, result: { bpm, minBpm, maxBpm, stability, tempoClass: bpm < 70 ? "Largo" : bpm < 90 ? "Andante" : bpm < 120 ? "Moderato" : bpm < 140 ? "Allegro" : bpm < 170 ? "Vivace" : "Presto", beatCount: beats.length, avgIntervalMs: Math.round(avgInterval * 1000), durationSec: Math.round((times[times.length - 1] - times[0]) * 100) / 100 } };
  });

  registerLensAction("music", "keyDetect", (ctx, artifact, _params) => {
    const notes = artifact.data?.notes || [];
    if (notes.length < 4) return { ok: true, result: { message: "Provide 4+ note names (e.g., C, D#, Eb) to detect key." } };
    const noteMap = { "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "Fb": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11, "Cb": 11 };
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    const pitchClasses = new Array(12).fill(0);
    notes.forEach(n => { const name = typeof n === "string" ? n.replace(/[0-9]/g, "") : ""; if (noteMap[name] !== undefined) pitchClasses[noteMap[name]]++; });
    let bestKey = "C", bestMode = "major", bestScore = -Infinity;
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    for (let root = 0; root < 12; root++) {
      const rotated = pitchClasses.slice(root).concat(pitchClasses.slice(0, root));
      let majCorr = 0, minCorr = 0;
      const rSum = rotated.reduce((s, v) => s + v, 0);
      const rMean = rSum / 12;
      for (let i = 0; i < 12; i++) {
        majCorr += (rotated[i] - rMean) * (majorProfile[i] - majorProfile.reduce((s, v) => s + v, 0) / 12);
        minCorr += (rotated[i] - rMean) * (minorProfile[i] - minorProfile.reduce((s, v) => s + v, 0) / 12);
      }
      if (majCorr > bestScore) { bestScore = majCorr; bestKey = noteNames[root]; bestMode = "major"; }
      if (minCorr > bestScore) { bestScore = minCorr; bestKey = noteNames[root]; bestMode = "minor"; }
    }
    return { ok: true, result: { key: bestKey, mode: bestMode, fullKey: `${bestKey} ${bestMode}`, confidence: Math.min(100, Math.round(Math.abs(bestScore) * 10)), noteDistribution: Object.fromEntries(noteNames.map((n, i) => [n, pitchClasses[i]])), notesAnalyzed: notes.length } };
  });

  registerLensAction("music", "chordProgress", (ctx, artifact, _params) => {
    const chords = artifact.data?.chords || [];
    if (chords.length < 2) return { ok: true, result: { message: "Provide 2+ chord names to analyze progression." } };
    const names = chords.map(c => typeof c === "string" ? c : c.name || c.chord || "");
    const commonProgressions = {
      "I-V-vi-IV": ["C-G-Am-F", "G-D-Em-C", "D-A-Bm-G", "A-E-F#m-D"],
      "I-IV-V-I": ["C-F-G-C", "G-C-D-G", "D-G-A-D"],
      "ii-V-I": ["Dm-G-C", "Am-D-G", "Em-A-D"],
      "I-vi-IV-V": ["C-Am-F-G", "G-Em-C-D"],
      "vi-IV-I-V": ["Am-F-C-G", "Em-C-G-D"],
      "12-bar-blues": ["A-A-A-A-D-D-A-A-E-D-A-E"],
    };
    const chordStr = names.join("-");
    let matchedProgression = null;
    for (const [name, patterns] of Object.entries(commonProgressions)) {
      if (patterns.some(p => chordStr.includes(p))) { matchedProgression = name; break; }
    }
    const transitions = {};
    for (let i = 0; i < names.length - 1; i++) {
      const key = `${names[i]}→${names[i + 1]}`;
      transitions[key] = (transitions[key] || 0) + 1;
    }
    const uniqueChords = [...new Set(names)];
    const majorCount = uniqueChords.filter(c => /^[A-G][#b]?$/.test(c) || c.includes("maj")).length;
    const minorCount = uniqueChords.filter(c => c.includes("m") && !c.includes("maj")).length;
    return { ok: true, result: { chordCount: names.length, uniqueChords: uniqueChords.length, progression: names, matchedPattern: matchedProgression, mood: minorCount > majorCount ? "minor/melancholic" : "major/bright", transitions: Object.entries(transitions).sort((a, b) => b[1] - a[1]).map(([t, c]) => ({ transition: t, count: c })), harmonicDensity: Math.round((uniqueChords.length / names.length) * 100) } };
  });

  registerLensAction("music", "setlistPlan", (ctx, artifact, _params) => {
    const tracks = artifact.data?.tracks || artifact.data?.songs || [];
    if (tracks.length < 2) return { ok: true, result: { message: "Provide 2+ tracks with bpm/energy/key to plan a setlist." } };
    const processed = tracks.map((t, i) => ({
      index: i, title: t.title || t.name || `Track ${i + 1}`, bpm: parseFloat(t.bpm) || 120, energy: parseFloat(t.energy) || 5, key: t.key || "C", duration: parseFloat(t.duration) || 240,
    }));
    // Sort by energy curve: start medium, build to peak, wind down
    const sorted = [...processed].sort((a, b) => a.energy - b.energy);
    const n = sorted.length;
    const opener = sorted[Math.floor(n * 0.6)] || sorted[0];
    const closer = sorted[Math.floor(n * 0.3)] || sorted[0];
    const peak = sorted[n - 1];
    // Build setlist: medium start, gradual build, peak at 2/3, cool down
    const setlist = [...processed].sort((a, b) => {
      const aPeakDist = Math.abs(processed.indexOf(a) / n - 0.66);
      const bPeakDist = Math.abs(processed.indexOf(b) / n - 0.66);
      return (a.energy * (1 - aPeakDist)) - (b.energy * (1 - bPeakDist));
    });
    const totalDuration = processed.reduce((s, t) => s + t.duration, 0);
    const avgBpm = Math.round(processed.reduce((s, t) => s + t.bpm, 0) / n);
    return { ok: true, result: { suggestedOrder: setlist.map(t => t.title), totalDuration: Math.round(totalDuration), totalMinutes: Math.round(totalDuration / 60), trackCount: n, avgBpm, energyCurve: setlist.map(t => ({ title: t.title, energy: t.energy, bpm: t.bpm })), peakMoment: peak.title, opener: opener.title, closer: closer.title } };
  });
}
