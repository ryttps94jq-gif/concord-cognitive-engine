/**
 * Concord — Onboarding System
 *
 * Guided 5-minute onboarding flow:
 * 1. Ingest 3 articles
 * 2. See structured DTUs appear
 * 3. Generate a structured synthesis
 * 4. See citations + royalty logic
 *
 * Tracks user progress and provides step-by-step guidance.
 */

import crypto from "crypto";

// ── Onboarding Flow Definition ───────────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Concord",
    description: "Concord is a cognitive operating system that structures knowledge into DTUs (Discrete Thought Units) with epistemic rigor.",
    action: "acknowledge",
    estimatedTime: 30,
  },
  {
    id: "ingest_first",
    title: "Ingest Your First Content",
    description: "Paste a URL or text to create your first DTU. Concord will structure it automatically.",
    action: "ingest",
    target: 1,
    estimatedTime: 60,
  },
  {
    id: "ingest_more",
    title: "Add More Knowledge",
    description: "Ingest 2 more pieces of content to build a small knowledge base for synthesis.",
    action: "ingest",
    target: 3,
    estimatedTime: 60,
  },
  {
    id: "explore_dtus",
    title: "Explore Your DTUs",
    description: "Navigate to the Graph lens to see how your DTUs are connected. Notice tags, lineage, and tier levels.",
    action: "navigate",
    targetLens: "graph",
    estimatedTime: 30,
  },
  {
    id: "synthesis",
    title: "Generate a Synthesis",
    description: "Use the forge to synthesize your DTUs into a higher-order insight. Watch how claims get merged and cited.",
    action: "synthesize",
    estimatedTime: 60,
  },
  {
    id: "explore_citations",
    title: "See Citations & Lineage",
    description: "Click on your synthesized DTU to see its citation chain and the sources that support each claim.",
    action: "navigate",
    targetLens: "council",
    estimatedTime: 30,
  },
  {
    id: "marketplace_preview",
    title: "Preview the Marketplace",
    description: "See how DTUs can be listed in the marketplace. Every use generates royalty attribution to original authors.",
    action: "navigate",
    targetLens: "market",
    estimatedTime: 30,
  },
  {
    id: "complete",
    title: "You're Ready!",
    description: "You've completed the Concord onboarding. Explore lenses, create more DTUs, and build your knowledge graph.",
    action: "complete",
    estimatedTime: 0,
  },
];

// ── Onboarding State ─────────────────────────────────────────────────────

function getOnboardingState(STATE) {
  if (!STATE._onboarding) {
    STATE._onboarding = {
      userProgress: new Map(),  // userId → progress object
      metrics: {
        started: 0,
        completed: 0,
        stepCompletions: {},
        avgCompletionTime: 0,
        dropoffPoints: {},
      },
    };
  }
  return STATE._onboarding;
}

// ── Start Onboarding ─────────────────────────────────────────────────────

export function startOnboarding(STATE, userId) {
  const onboarding = getOnboardingState(STATE);

  const existing = onboarding.userProgress.get(userId);
  if (existing && !existing.completed) {
    return { ok: true, progress: existing, resumed: true };
  }

  const progress = {
    userId,
    currentStepIndex: 0,
    completedSteps: [],
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    completed: false,
    completedAt: null,
    ingestsCount: 0,
    synthesesCount: 0,
    lensesVisited: new Set(),
    totalSteps: ONBOARDING_STEPS.length,
  };

  onboarding.userProgress.set(userId, progress);
  onboarding.metrics.started++;

  return {
    ok: true,
    progress: serializeProgress(progress),
    currentStep: ONBOARDING_STEPS[0],
    steps: ONBOARDING_STEPS.map((s, i) => ({ ...s, completed: false, index: i })),
  };
}

// ── Get Progress ─────────────────────────────────────────────────────────

export function getOnboardingProgress(STATE, userId) {
  const onboarding = getOnboardingState(STATE);
  const progress = onboarding.userProgress.get(userId);

  if (!progress) {
    return { ok: true, started: false, steps: ONBOARDING_STEPS };
  }

  const currentStep = ONBOARDING_STEPS[progress.currentStepIndex];
  const steps = ONBOARDING_STEPS.map((s, i) => ({
    ...s,
    completed: progress.completedSteps.includes(s.id),
    current: i === progress.currentStepIndex,
    index: i,
  }));

  return {
    ok: true,
    started: true,
    progress: serializeProgress(progress),
    currentStep,
    steps,
  };
}

// ── Complete Step ────────────────────────────────────────────────────────

export function completeOnboardingStep(STATE, userId, stepId, metadata = {}) {
  const onboarding = getOnboardingState(STATE);
  const progress = onboarding.userProgress.get(userId);

  if (!progress) return { ok: false, error: "Onboarding not started" };
  if (progress.completed) return { ok: true, alreadyCompleted: true, progress: serializeProgress(progress) };

  const stepIndex = ONBOARDING_STEPS.findIndex(s => s.id === stepId);
  if (stepIndex < 0) return { ok: false, error: "Invalid step" };

  const step = ONBOARDING_STEPS[stepIndex];

  // Validate step completion based on action type
  if (step.action === "ingest") {
    progress.ingestsCount += (metadata.ingestCount || 1);
    if (progress.ingestsCount < (step.target || 1)) {
      return {
        ok: true,
        partial: true,
        current: progress.ingestsCount,
        target: step.target,
        step,
      };
    }
  }

  if (step.action === "synthesize") {
    progress.synthesesCount += (metadata.synthesisCount || 1);
  }

  if (step.action === "navigate" && step.targetLens) {
    progress.lensesVisited.add(step.targetLens);
  }

  // Mark step completed
  if (!progress.completedSteps.includes(stepId)) {
    progress.completedSteps.push(stepId);
    onboarding.metrics.stepCompletions[stepId] = (onboarding.metrics.stepCompletions[stepId] || 0) + 1;
  }

  progress.lastActivityAt = new Date().toISOString();

  // Advance to next step
  if (progress.currentStepIndex < ONBOARDING_STEPS.length - 1) {
    progress.currentStepIndex++;
  }

  // Check if all steps completed
  if (progress.completedSteps.length >= ONBOARDING_STEPS.length - 1) { // -1 because "complete" is auto
    progress.completed = true;
    progress.completedAt = new Date().toISOString();
    progress.completedSteps.push("complete");
    onboarding.metrics.completed++;

    // Compute completion time
    const startMs = new Date(progress.startedAt).getTime();
    const endMs = new Date(progress.completedAt).getTime();
    const completionTimeSec = (endMs - startMs) / 1000;

    // Update average
    const totalCompleted = onboarding.metrics.completed;
    onboarding.metrics.avgCompletionTime =
      ((onboarding.metrics.avgCompletionTime * (totalCompleted - 1)) + completionTimeSec) / totalCompleted;
  }

  const nextStep = ONBOARDING_STEPS[progress.currentStepIndex];

  return {
    ok: true,
    completedStep: stepId,
    progress: serializeProgress(progress),
    nextStep: progress.completed ? null : nextStep,
    allDone: progress.completed,
  };
}

// ── Skip Onboarding ──────────────────────────────────────────────────────

export function skipOnboarding(STATE, userId) {
  const onboarding = getOnboardingState(STATE);

  const progress = onboarding.userProgress.get(userId) || {
    userId,
    currentStepIndex: ONBOARDING_STEPS.length - 1,
    completedSteps: [],
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    ingestsCount: 0,
    synthesesCount: 0,
    lensesVisited: new Set(),
    totalSteps: ONBOARDING_STEPS.length,
  };

  progress.completed = true;
  progress.completedAt = new Date().toISOString();
  progress.skipped = true;

  onboarding.userProgress.set(userId, progress);

  // Record dropoff
  const currentStep = ONBOARDING_STEPS[progress.currentStepIndex];
  if (currentStep) {
    onboarding.metrics.dropoffPoints[currentStep.id] = (onboarding.metrics.dropoffPoints[currentStep.id] || 0) + 1;
  }

  return { ok: true, skipped: true };
}

// ── Onboarding Hints ─────────────────────────────────────────────────────

/**
 * Get contextual hints for a user based on their current state.
 */
export function getOnboardingHints(STATE, userId) {
  const onboarding = getOnboardingState(STATE);
  const progress = onboarding.userProgress.get(userId);

  if (!progress || progress.completed) {
    // Post-onboarding tips
    return {
      ok: true,
      hints: [
        { type: "tip", text: "Try using the Atlas lens to explore domain-weighted knowledge" },
        { type: "tip", text: "Connect with other users through the social feed" },
        { type: "tip", text: "List your best DTUs on the marketplace" },
      ],
    };
  }

  const currentStep = ONBOARDING_STEPS[progress.currentStepIndex];
  const hints = [];

  if (currentStep?.action === "ingest" && progress.ingestsCount === 0) {
    hints.push({ type: "nudge", text: "Paste a URL or text in the chat to get started" });
    hints.push({ type: "example", text: "Try: 'Ingest https://en.wikipedia.org/wiki/Knowledge_graph'" });
  }

  if (currentStep?.action === "synthesize") {
    hints.push({ type: "nudge", text: "Use /synthesize or the forge tool to combine your DTUs" });
  }

  if (currentStep?.action === "navigate" && currentStep.targetLens) {
    hints.push({ type: "nudge", text: `Switch to the ${currentStep.targetLens} lens to continue` });
  }

  return { ok: true, hints, currentStep };
}

// ── Metrics ──────────────────────────────────────────────────────────────

export function getOnboardingMetrics(STATE) {
  const onboarding = getOnboardingState(STATE);
  return { ok: true, ...onboarding.metrics };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function serializeProgress(progress) {
  return {
    ...progress,
    lensesVisited: Array.from(progress.lensesVisited || []),
  };
}
