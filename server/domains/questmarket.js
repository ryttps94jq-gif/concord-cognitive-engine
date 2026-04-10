// server/domains/questmarket.js
// Domain actions for quest marketplace: quest difficulty balancing,
// reward economics, leaderboard ranking, achievement unlocking, guild scoring.

export default function registerQuestmarketActions(registerLensAction) {
  /**
   * balanceDifficulty
   * Analyze quest parameters and suggest difficulty/reward adjustments.
   * artifact.data: { difficulty, reward, completionCriteria, maxParticipants, deadline, completionRate }
   */
  registerLensAction("questmarket", "balanceDifficulty", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const difficulty = (data.difficulty || "medium").toLowerCase();
    const reward = parseFloat(data.reward) || 0;
    const maxParticipants = parseInt(data.maxParticipants) || 10;
    const completionRate = parseFloat(data.completionRate) || 0.5;

    // Target completion rates by difficulty
    const targets = {
      easy: { completionTarget: 0.8, rewardRange: [10, 50], timeMultiplier: 1 },
      medium: { completionTarget: 0.5, rewardRange: [50, 200], timeMultiplier: 1.5 },
      hard: { completionTarget: 0.25, rewardRange: [200, 500], timeMultiplier: 2 },
      legendary: { completionTarget: 0.1, rewardRange: [500, 2000], timeMultiplier: 3 },
    };

    const target = targets[difficulty] || targets.medium;
    const [minReward, maxReward] = target.rewardRange;

    // Balance analysis
    const rewardBalance = reward >= minReward && reward <= maxReward ? "balanced"
      : reward < minReward ? "under-rewarded" : "over-rewarded";

    const completionBalance = Math.abs(completionRate - target.completionTarget) < 0.15 ? "balanced"
      : completionRate > target.completionTarget + 0.15 ? "too-easy" : "too-hard";

    // Suggested adjustments
    const suggestedReward = Math.round((minReward + maxReward) / 2);
    const adjustments = [];
    if (rewardBalance === "under-rewarded") adjustments.push(`Increase reward to ${suggestedReward} DTU (current: ${reward})`);
    if (rewardBalance === "over-rewarded") adjustments.push(`Decrease reward to ${suggestedReward} DTU (current: ${reward})`);
    if (completionBalance === "too-easy") adjustments.push("Add harder completion criteria or reduce time limit");
    if (completionBalance === "too-hard") adjustments.push("Simplify criteria or increase participant limit");

    // XP calculation: base XP scaled by difficulty
    const xpMultipliers = { easy: 1, medium: 2, hard: 4, legendary: 10 };
    const suggestedXP = Math.round(reward * (xpMultipliers[difficulty] || 2) * 0.1);

    return {
      ok: true,
      result: {
        difficulty,
        currentReward: reward,
        suggestedReward,
        suggestedXP,
        rewardBalance,
        completionBalance,
        targetCompletionRate: target.completionTarget,
        actualCompletionRate: completionRate,
        adjustments,
        overallBalance: adjustments.length === 0 ? "Well balanced" : `${adjustments.length} adjustment(s) recommended`,
      },
    };
  });

  /**
   * leaderboardRank
   * Calculate rankings based on XP, quests completed, streak, and rarity bonuses.
   * artifact.data: { participants: [{ name, xp, questsCompleted, streak, achievements }] }
   */
  registerLensAction("questmarket", "leaderboardRank", (ctx, artifact, _params) => {
    const participants = artifact.data?.participants || [];
    if (participants.length === 0) {
      return { ok: true, result: { message: "No participants to rank. Add quest completions to generate leaderboard." } };
    }

    const rarityBonuses = { Common: 0, Uncommon: 5, Rare: 15, Epic: 30, Legendary: 50, Mythic: 100 };

    const ranked = participants.map(p => {
      const baseXP = parseInt(p.xp) || 0;
      const questsCompleted = parseInt(p.questsCompleted) || 0;
      const streak = parseInt(p.streak) || 0;

      // Achievement rarity bonus
      const achievementBonus = (p.achievements || []).reduce((s, a) => {
        return s + (rarityBonuses[a.rarity || a] || 0);
      }, 0);

      // Streak multiplier: 5% bonus per consecutive day, max 50%
      const streakMultiplier = 1 + Math.min(streak * 0.05, 0.5);

      // Composite score
      const score = Math.round((baseXP + achievementBonus) * streakMultiplier + questsCompleted * 10);

      // Tier classification
      let tier = "Bronze";
      if (score >= 10000) tier = "Diamond";
      else if (score >= 5000) tier = "Platinum";
      else if (score >= 2000) tier = "Gold";
      else if (score >= 500) tier = "Silver";

      return {
        name: p.name,
        score,
        tier,
        baseXP,
        questsCompleted,
        streak,
        achievementBonus,
        streakMultiplier: Math.round(streakMultiplier * 100) / 100,
      };
    }).sort((a, b) => b.score - a.score);

    // Assign ranks
    ranked.forEach((p, i) => { p.rank = i + 1; });

    return {
      ok: true,
      result: {
        leaderboard: ranked,
        totalParticipants: ranked.length,
        topPlayer: ranked[0]?.name || "N/A",
        tierDistribution: ranked.reduce((acc, p) => { acc[p.tier] = (acc[p.tier] || 0) + 1; return acc; }, {}),
      },
    };
  });

  /**
   * achievementUnlock
   * Check if an action qualifies for achievement unlocks.
   * artifact.data: { playerStats: { questsCompleted, totalXP, streakDays, uniqueCategories }, achievements: [existing] }
   */
  registerLensAction("questmarket", "achievementUnlock", (ctx, artifact, _params) => {
    const stats = artifact.data?.playerStats || {};
    const existing = (artifact.data?.achievements || []).map(a => a.id || a.name || a);

    const questsCompleted = parseInt(stats.questsCompleted) || 0;
    const totalXP = parseInt(stats.totalXP) || 0;
    const streakDays = parseInt(stats.streakDays) || 0;
    const uniqueCategories = parseInt(stats.uniqueCategories) || 0;

    // Achievement definitions
    const allAchievements = [
      { id: "first-quest", name: "First Steps", rarity: "Common", condition: questsCompleted >= 1, desc: "Complete your first quest" },
      { id: "five-quests", name: "Adventurer", rarity: "Common", condition: questsCompleted >= 5, desc: "Complete 5 quests" },
      { id: "twenty-quests", name: "Veteran", rarity: "Uncommon", condition: questsCompleted >= 20, desc: "Complete 20 quests" },
      { id: "fifty-quests", name: "Champion", rarity: "Rare", condition: questsCompleted >= 50, desc: "Complete 50 quests" },
      { id: "hundred-quests", name: "Legend", rarity: "Epic", condition: questsCompleted >= 100, desc: "Complete 100 quests" },
      { id: "xp-1k", name: "Scholar", rarity: "Uncommon", condition: totalXP >= 1000, desc: "Earn 1,000 XP" },
      { id: "xp-10k", name: "Sage", rarity: "Rare", condition: totalXP >= 10000, desc: "Earn 10,000 XP" },
      { id: "xp-100k", name: "Archmage", rarity: "Legendary", condition: totalXP >= 100000, desc: "Earn 100,000 XP" },
      { id: "streak-7", name: "Consistent", rarity: "Common", condition: streakDays >= 7, desc: "7-day quest streak" },
      { id: "streak-30", name: "Dedicated", rarity: "Uncommon", condition: streakDays >= 30, desc: "30-day quest streak" },
      { id: "streak-100", name: "Unstoppable", rarity: "Epic", condition: streakDays >= 100, desc: "100-day quest streak" },
      { id: "explorer-5", name: "Explorer", rarity: "Uncommon", condition: uniqueCategories >= 5, desc: "Complete quests in 5 categories" },
      { id: "polymath", name: "Polymath", rarity: "Rare", condition: uniqueCategories >= 8, desc: "Complete quests in 8 categories" },
    ];

    const newlyUnlocked = allAchievements.filter(a => a.condition && !existing.includes(a.id));
    const alreadyUnlocked = allAchievements.filter(a => existing.includes(a.id));
    const locked = allAchievements.filter(a => !a.condition && !existing.includes(a.id));

    return {
      ok: true,
      result: {
        newlyUnlocked: newlyUnlocked.map(a => ({ id: a.id, name: a.name, rarity: a.rarity, desc: a.desc })),
        alreadyUnlocked: alreadyUnlocked.length,
        totalAchievements: allAchievements.length,
        completionRate: Math.round(((alreadyUnlocked.length + newlyUnlocked.length) / allAchievements.length) * 100),
        nextUp: locked.slice(0, 3).map(a => ({ name: a.name, rarity: a.rarity, desc: a.desc })),
      },
    };
  });

  /**
   * guildScore
   * Calculate guild performance metrics and rank.
   * artifact.data: { guildName, members: [{ name, xp, questsCompleted }], guildQuests }
   */
  registerLensAction("questmarket", "guildScore", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const members = data.members || [];
    const guildQuests = parseInt(data.guildQuests) || 0;

    if (members.length === 0) {
      return { ok: true, result: { message: "No guild members. Add members to calculate guild score." } };
    }

    const totalXP = members.reduce((s, m) => s + (parseInt(m.xp) || 0), 0);
    const totalQuests = members.reduce((s, m) => s + (parseInt(m.questsCompleted) || 0), 0);
    const avgXP = Math.round(totalXP / members.length);
    const avgQuests = Math.round(totalQuests / members.length);

    // Guild score: weighted combination
    const guildScore = Math.round(totalXP * 0.4 + totalQuests * 50 * 0.3 + guildQuests * 100 * 0.2 + members.length * 25 * 0.1);

    let guildTier = "Bronze";
    if (guildScore >= 50000) guildTier = "Diamond";
    else if (guildScore >= 20000) guildTier = "Platinum";
    else if (guildScore >= 8000) guildTier = "Gold";
    else if (guildScore >= 2000) guildTier = "Silver";

    // Top contributors
    const topContributors = members
      .map(m => ({ name: m.name, xp: parseInt(m.xp) || 0, quests: parseInt(m.questsCompleted) || 0 }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5);

    return {
      ok: true,
      result: {
        guildName: data.guildName || "Unnamed Guild",
        guildScore,
        guildTier,
        memberCount: members.length,
        totalXP,
        totalQuests,
        guildQuests,
        avgXP,
        avgQuests,
        topContributors,
      },
    };
  });

  /**
   * rewardEconomics
   * Analyze reward distribution and inflation across the quest ecosystem.
   * artifact.data: { quests: [{ reward, difficulty, status, completedAt }] }
   */
  registerLensAction("questmarket", "rewardEconomics", (ctx, artifact, _params) => {
    const quests = artifact.data?.quests || [];
    if (quests.length === 0) {
      return { ok: true, result: { message: "No quest data. Create quests to analyze reward economics." } };
    }

    const completed = quests.filter(q => q.status === "completed");
    const totalDistributed = completed.reduce((s, q) => s + (parseFloat(q.reward) || 0), 0);
    const totalPending = quests.filter(q => q.status !== "completed").reduce((s, q) => s + (parseFloat(q.reward) || 0), 0);

    // Reward distribution by difficulty
    const byDifficulty = {};
    for (const q of quests) {
      const diff = q.difficulty || "medium";
      if (!byDifficulty[diff]) byDifficulty[diff] = { count: 0, totalReward: 0, completed: 0 };
      byDifficulty[diff].count++;
      byDifficulty[diff].totalReward += parseFloat(q.reward) || 0;
      if (q.status === "completed") byDifficulty[diff].completed++;
    }

    for (const [, data] of Object.entries(byDifficulty)) {
      data.avgReward = data.count > 0 ? Math.round(data.totalReward / data.count) : 0;
      data.completionRate = data.count > 0 ? Math.round((data.completed / data.count) * 100) : 0;
    }

    // Monthly burn rate (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentCompleted = completed.filter(q => q.completedAt && new Date(q.completedAt) >= thirtyDaysAgo);
    const monthlyBurn = recentCompleted.reduce((s, q) => s + (parseFloat(q.reward) || 0), 0);

    return {
      ok: true,
      result: {
        totalQuests: quests.length,
        completedQuests: completed.length,
        totalDistributed,
        totalPending,
        monthlyBurnRate: monthlyBurn,
        projectedAnnualBurn: monthlyBurn * 12,
        byDifficulty,
        healthCheck: monthlyBurn > totalPending * 2
          ? "High burn rate — consider adding more quests or reducing rewards"
          : "Reward economy is sustainable",
      },
    };
  });
}
