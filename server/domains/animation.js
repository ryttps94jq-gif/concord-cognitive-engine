// server/domains/animation.js
// Domain actions for animation: keyframe interpolation, timing analysis,
// frame rate optimization, storyboard sequencing, easing calculation.

export default function registerAnimationActions(registerLensAction) {
  registerLensAction("animation", "interpolateKeyframes", (ctx, artifact, _params) => {
    const keyframes = artifact.data?.keyframes || [];
    if (keyframes.length < 2) return { ok: true, result: { message: "Add at least 2 keyframes with time and value." } };
    const sorted = [...keyframes].sort((a, b) => (parseFloat(a.time) || 0) - (parseFloat(b.time) || 0));
    const fps = parseInt(artifact.data?.fps) || 24;
    const totalDuration = parseFloat(sorted[sorted.length - 1].time) - parseFloat(sorted[0].time);
    const totalFrames = Math.ceil(totalDuration * fps);
    const interpolated = [];
    for (let f = 0; f <= totalFrames; f++) {
      const t = parseFloat(sorted[0].time) + (f / fps);
      let i = 0;
      while (i < sorted.length - 1 && parseFloat(sorted[i + 1].time) < t) i++;
      const k0 = sorted[i], k1 = sorted[Math.min(i + 1, sorted.length - 1)];
      const t0 = parseFloat(k0.time), t1 = parseFloat(k1.time);
      const progress = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      const v0 = parseFloat(k0.value) || 0, v1 = parseFloat(k1.value) || 0;
      interpolated.push({ frame: f, time: Math.round(t * 1000) / 1000, value: Math.round((v0 + (v1 - v0) * progress) * 1000) / 1000 });
    }
    return { ok: true, result: { keyframeCount: keyframes.length, fps, totalFrames, durationSeconds: totalDuration, sampleFrames: interpolated.filter((_, i) => i % Math.max(1, Math.floor(totalFrames / 10)) === 0) } };
  });

  registerLensAction("animation", "timingAnalysis", (ctx, artifact, _params) => {
    const sequences = artifact.data?.sequences || [];
    if (sequences.length === 0) return { ok: true, result: { message: "Add animation sequences to analyze timing." } };
    const analyzed = sequences.map(s => {
      const duration = parseFloat(s.duration) || 1;
      const delay = parseFloat(s.delay) || 0;
      const fps = parseInt(s.fps) || 24;
      return { name: s.name || "Unnamed", duration, delay, fps, frames: Math.ceil(duration * fps), endTime: delay + duration, easing: s.easing || "linear" };
    });
    const totalDuration = Math.max(...analyzed.map(a => a.endTime));
    const overlaps = [];
    for (let i = 0; i < analyzed.length; i++) {
      for (let j = i + 1; j < analyzed.length; j++) {
        const a = analyzed[i], b = analyzed[j];
        if (a.delay < b.endTime && b.delay < a.endTime) overlaps.push({ a: a.name, b: b.name });
      }
    }
    return { ok: true, result: { sequences: analyzed, totalDuration, totalFrames: analyzed.reduce((s, a) => s + a.frames, 0), overlappingPairs: overlaps.length, overlaps: overlaps.slice(0, 5) } };
  });

  registerLensAction("animation", "optimizeFPS", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const currentFPS = parseInt(data.fps) || 30;
    const complexity = parseInt(data.complexity) || 50; // 0-100
    const targetDevice = (data.targetDevice || "desktop").toLowerCase();
    const budgets = { mobile: { maxFPS: 30, maxComplexity: 60 }, tablet: { maxFPS: 30, maxComplexity: 75 }, desktop: { maxFPS: 60, maxComplexity: 100 }, highend: { maxFPS: 120, maxComplexity: 100 } };
    const budget = budgets[targetDevice] || budgets.desktop;
    const recommendedFPS = complexity > budget.maxComplexity ? Math.min(currentFPS, budget.maxFPS / 2) : Math.min(currentFPS, budget.maxFPS);
    const frameTime = Math.round((1000 / recommendedFPS) * 100) / 100;
    return { ok: true, result: { currentFPS, recommendedFPS, frameTimeMs: frameTime, targetDevice, complexity, withinBudget: complexity <= budget.maxComplexity, tips: complexity > budget.maxComplexity ? ["Reduce particle count", "Simplify easing curves", "Use sprite sheets instead of vector animations"] : ["Performance is within budget"] } };
  });

  registerLensAction("animation", "storyboardSequence", (ctx, artifact, _params) => {
    const scenes = artifact.data?.scenes || [];
    if (scenes.length === 0) return { ok: true, result: { message: "Add scenes to generate a storyboard sequence." } };
    let runningTime = 0;
    const sequence = scenes.map((s, i) => {
      const duration = parseFloat(s.duration) || 2;
      const transition = parseFloat(s.transitionDuration) || 0.5;
      const startTime = runningTime;
      runningTime += duration + transition;
      return { scene: i + 1, name: s.name || `Scene ${i + 1}`, startTime: Math.round(startTime * 100) / 100, duration, transitionDuration: transition, endTime: Math.round((startTime + duration) * 100) / 100, description: s.description || "" };
    });
    return { ok: true, result: { scenes: sequence, totalDuration: Math.round(runningTime * 100) / 100, sceneCount: scenes.length, avgSceneDuration: Math.round((runningTime / scenes.length) * 100) / 100 } };
  });
}
