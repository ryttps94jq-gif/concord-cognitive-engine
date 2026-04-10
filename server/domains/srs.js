// server/domains/srs.js
export default function registerSrsActions(registerLensAction) {
  registerLensAction("srs", "spacedRepetitionSchedule", (ctx, artifact, _params) => {
    const cards = artifact.data?.cards || [];
    if (cards.length === 0) return { ok: true, result: { message: "Add flashcards with review history to schedule." } };
    const now = new Date();
    const scheduled = cards.map((card, i) => {
      let ease = parseFloat(card.ease || card.easeFactor) || 2.5;
      let interval = parseInt(card.interval) || 1;
      const quality = parseInt(card.lastQuality || card.quality) || 3;
      const lastReview = card.lastReview ? new Date(card.lastReview) : null;
      // SM-2 algorithm
      if (quality >= 3) {
        if (interval === 1) interval = 1;
        else if (interval === 2) interval = 6;
        else interval = Math.round(interval * ease);
        ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
      } else {
        interval = 1;
        ease = Math.max(1.3, ease - 0.2);
      }
      const nextReview = lastReview
        ? new Date(lastReview.getTime() + interval * 86400000)
        : now;
      const daysUntil = Math.ceil((nextReview.getTime() - now.getTime()) / 86400000);
      return {
        id: card.id || `card-${i}`,
        front: (card.front || card.question || "").slice(0, 50),
        ease: Math.round(ease * 100) / 100,
        interval,
        nextReview: nextReview.toISOString().split("T")[0],
        daysUntil,
        status: daysUntil <= 0 ? "due" : daysUntil <= 1 ? "soon" : "scheduled",
      };
    });
    const due = scheduled.filter(c => c.status === "due");
    const soon = scheduled.filter(c => c.status === "soon");
    return { ok: true, result: { totalCards: cards.length, dueNow: due.length, dueSoon: soon.length, dueCards: due.map(c => c.id), schedule: scheduled.sort((a, b) => a.daysUntil - b.daysUntil), avgEase: Math.round((scheduled.reduce((s, c) => s + c.ease, 0) / scheduled.length) * 100) / 100, avgInterval: Math.round(scheduled.reduce((s, c) => s + c.interval, 0) / scheduled.length) } };
  });

  registerLensAction("srs", "retentionCurve", (ctx, artifact, _params) => {
    const reviews = artifact.data?.reviews || [];
    const halfLife = parseFloat(artifact.data?.halfLife) || 7;
    if (reviews.length === 0) return { ok: true, result: { message: "Provide review data to model retention curve." } };
    const now = new Date();
    const lastReview = reviews.length > 0 ? new Date(reviews[reviews.length - 1].date || reviews[reviews.length - 1].timestamp || now) : now;
    const correctRate = reviews.filter(r => r.correct || r.quality >= 3).length / reviews.length;
    const adjustedHalfLife = halfLife * (1 + (correctRate - 0.5) * 2);
    const curve = [];
    for (let day = 0; day <= 30; day++) {
      const retention = Math.round(Math.exp(-0.693 * day / adjustedHalfLife) * 1000) / 10;
      curve.push({ day, retention });
    }
    const daysSinceReview = Math.ceil((now.getTime() - lastReview.getTime()) / 86400000);
    const currentRetention = Math.round(Math.exp(-0.693 * daysSinceReview / adjustedHalfLife) * 1000) / 10;
    const optimalReviewDay = Math.ceil(adjustedHalfLife * Math.log(100 / 85) / 0.693);
    return { ok: true, result: { reviewCount: reviews.length, correctRate: Math.round(correctRate * 100), halfLifeDays: Math.round(adjustedHalfLife * 10) / 10, daysSinceLastReview: daysSinceReview, currentRetention, optimalReviewDay, retentionCurve: curve, recommendation: currentRetention < 80 ? "Review immediately — retention below 80%" : currentRetention < 90 ? "Review soon to maintain retention" : "Retention is good — review scheduled optimally" } };
  });

  registerLensAction("srs", "cardDifficulty", (ctx, artifact, _params) => {
    const cards = artifact.data?.cards || [];
    if (cards.length === 0) return { ok: true, result: { message: "Provide cards with review history to classify difficulty." } };
    const analyzed = cards.map((card, i) => {
      const history = card.history || card.reviews || [];
      const attempts = history.length || parseInt(card.attempts) || 1;
      const correct = history.filter(h => h.correct || h.quality >= 3).length || parseInt(card.correct) || 0;
      const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 50;
      const avgTime = history.length > 0 ? Math.round(history.reduce((s, h) => s + (parseFloat(h.time || h.responseTime) || 5), 0) / history.length) : null;
      let difficulty;
      if (accuracy >= 90 && attempts >= 3) difficulty = "easy";
      else if (accuracy >= 70) difficulty = "medium";
      else if (accuracy >= 40) difficulty = "hard";
      else difficulty = "very-hard";
      return { id: card.id || `card-${i}`, front: (card.front || card.question || "").slice(0, 50), attempts, correct, accuracy, avgResponseTime: avgTime, difficulty, suggestion: difficulty === "very-hard" ? "Consider rephrasing or adding context" : difficulty === "hard" ? "Break into smaller concepts" : difficulty === "easy" && attempts > 5 ? "Move to long-term review interval" : "On track" };
    });
    const distribution = { easy: analyzed.filter(c => c.difficulty === "easy").length, medium: analyzed.filter(c => c.difficulty === "medium").length, hard: analyzed.filter(c => c.difficulty === "hard").length, "very-hard": analyzed.filter(c => c.difficulty === "very-hard").length };
    return { ok: true, result: { totalCards: cards.length, distribution, avgAccuracy: Math.round(analyzed.reduce((s, c) => s + c.accuracy, 0) / analyzed.length), hardestCards: analyzed.filter(c => c.difficulty === "very-hard" || c.difficulty === "hard").sort((a, b) => a.accuracy - b.accuracy).slice(0, 10), cards: analyzed } };
  });

  registerLensAction("srs", "deckStats", (ctx, artifact, _params) => {
    const cards = artifact.data?.cards || [];
    const deckName = artifact.data?.name || "Untitled Deck";
    if (cards.length === 0) return { ok: true, result: { message: "Provide deck cards to compute statistics." } };
    const now = new Date();
    let mastered = 0, learning = 0, newCards = 0, lapsed = 0;
    let totalEase = 0, totalInterval = 0;
    cards.forEach(card => {
      const interval = parseInt(card.interval) || 0;
      const reviews = parseInt(card.reviewCount || card.attempts) || 0;
      const ease = parseFloat(card.ease) || 2.5;
      totalEase += ease;
      totalInterval += interval;
      if (reviews === 0) newCards++;
      else if (interval >= 21) mastered++;
      else if (ease < 1.5) lapsed++;
      else learning++;
    });
    const avgEase = Math.round((totalEase / cards.length) * 100) / 100;
    const avgInterval = Math.round(totalInterval / cards.length);
    const masteryRate = Math.round((mastered / cards.length) * 100);
    const dueToday = cards.filter(c => {
      if (!c.nextReview) return true;
      return new Date(c.nextReview) <= now;
    }).length;
    const estimatedDays = learning > 0 ? Math.ceil(learning * avgInterval * 0.5) : mastered > 0 ? 0 : cards.length * 7;
    return { ok: true, result: { deckName, totalCards: cards.length, new: newCards, learning, mastered, lapsed, masteryRate, avgEase, avgInterval, dueToday, projectedMasteryDays: estimatedDays, healthScore: masteryRate >= 80 ? "Excellent" : masteryRate >= 50 ? "Good" : masteryRate >= 20 ? "In Progress" : "Just Started" } };
  });
}
