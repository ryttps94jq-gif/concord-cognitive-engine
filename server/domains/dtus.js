// server/domains/dtus.js
// Domain actions for DTU management: lineage analysis, quality scoring,
// citation network analysis, tier recommendation, and duplication detection.

export default function registerDtusActions(registerLensAction) {
  /**
   * lineageAnalysis
   * Trace the full lineage of a DTU — parent chain, child forks, depth,
   * and generation statistics.
   * artifact.data.parentId, artifact.data.children, artifact.data.lineage
   */
  registerLensAction("dtus", "lineageAnalysis", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const lineage = data.lineage || [];
    const children = data.children || [];
    const parentId = data.parentId || null;

    // Walk lineage chain
    const depth = lineage.length;
    const generations = new Map();
    for (const ancestor of lineage) {
      const gen = ancestor.generation || 0;
      generations.set(gen, (generations.get(gen) || 0) + 1);
    }

    // Child analysis
    const directChildren = children.filter(c => c.parentId === artifact.id || c.parent === artifact.id);
    const forkCount = directChildren.length;
    const childTiers = {};
    for (const child of directChildren) {
      const tier = child.tier || "regular";
      childTiers[tier] = (childTiers[tier] || 0) + 1;
    }

    // Lineage health: deeper lineage with active children = healthy
    const lineageHealth = depth === 0 && forkCount === 0
      ? "orphan"
      : forkCount >= 3 ? "prolific"
      : forkCount >= 1 ? "healthy"
      : depth > 0 ? "leaf"
      : "root";

    return {
      ok: true,
      result: {
        dtuId: artifact.id,
        title: artifact.title,
        depth,
        parentId,
        forkCount,
        childTiers,
        totalDescendants: children.length,
        generationBreakdown: Object.fromEntries(generations),
        lineageHealth,
        isRoot: !parentId,
        isLeaf: forkCount === 0 && depth > 0,
        oldestAncestor: lineage.length > 0 ? lineage[lineage.length - 1]?.title || lineage[lineage.length - 1]?.id : null,
      },
    };
  });

  /**
   * qualityScore
   * Compute a quality score for a DTU based on completeness, citation count,
   * content richness, metadata quality, and age.
   */
  registerLensAction("dtus", "qualityScore", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const meta = artifact.meta || {};

    // Content richness (0-25): based on data field count and content length
    const dataFields = Object.keys(data).length;
    const contentLength = JSON.stringify(data).length;
    const contentScore = Math.min(25, Math.round(
      (Math.min(dataFields / 10, 1) * 12.5) +
      (Math.min(contentLength / 2000, 1) * 12.5)
    ));

    // Metadata quality (0-25): tags, status, visibility set
    const hasTags = (meta.tags || []).length > 0;
    const hasStatus = !!meta.status && meta.status !== "draft";
    const hasVisibility = !!meta.visibility;
    const tagCount = (meta.tags || []).length;
    const metaScore = Math.min(25, Math.round(
      (hasTags ? 8 : 0) +
      (hasStatus ? 8 : 0) +
      (hasVisibility ? 4 : 0) +
      Math.min(tagCount / 5, 1) * 5
    ));

    // Citation impact (0-25)
    const citationCount = parseInt(data.citationCount) || parseInt(meta.citationCount) || 0;
    const citationScore = Math.min(25, Math.round(Math.min(citationCount / 10, 1) * 25));

    // Freshness (0-25): how recently updated
    const updatedAt = new Date(artifact.updatedAt || artifact.createdAt || Date.now());
    const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const freshnessScore = Math.min(25, Math.round(
      daysSinceUpdate < 1 ? 25 :
      daysSinceUpdate < 7 ? 20 :
      daysSinceUpdate < 30 ? 15 :
      daysSinceUpdate < 90 ? 10 :
      5
    ));

    const totalScore = contentScore + metaScore + citationScore + freshnessScore;
    const grade = totalScore >= 90 ? "A" : totalScore >= 75 ? "B" : totalScore >= 60 ? "C" : totalScore >= 40 ? "D" : "F";

    return {
      ok: true,
      result: {
        dtuId: artifact.id,
        title: artifact.title,
        totalScore,
        grade,
        breakdown: {
          content: contentScore,
          metadata: metaScore,
          citations: citationScore,
          freshness: freshnessScore,
        },
        details: {
          dataFields,
          contentLength,
          tagCount,
          citationCount,
          daysSinceUpdate: Math.round(daysSinceUpdate),
          status: meta.status || "unknown",
          tier: data.tier || meta.tier || "regular",
        },
        recommendations: [
          contentScore < 15 ? "Add more structured data fields to improve content richness" : null,
          metaScore < 15 ? "Add tags and update status to improve discoverability" : null,
          citationScore < 10 ? "Increase visibility to earn more citations" : null,
          freshnessScore < 15 ? "Update this DTU to improve freshness score" : null,
        ].filter(Boolean),
      },
    };
  });

  /**
   * citationNetwork
   * Analyze the citation network around a DTU — who cites it, what it cites,
   * and compute influence metrics.
   */
  registerLensAction("dtus", "citationNetwork", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const citedBy = data.citedBy || [];
    const cites = data.cites || data.references || [];

    const inDegree = citedBy.length;
    const outDegree = cites.length;

    // Compute h-index analog: max h where h DTUs cite this with >= h citations each
    const citationCounts = citedBy.map(c => parseInt(c.count) || 1).sort((a, b) => b - a);
    let hIndex = 0;
    for (let i = 0; i < citationCounts.length; i++) {
      if (citationCounts[i] >= i + 1) hIndex = i + 1;
      else break;
    }

    // Influence score: weighted combination of in-degree, h-index, and out-degree ratio
    const influenceScore = Math.min(100, Math.round(
      (Math.min(inDegree / 20, 1) * 40) +
      (Math.min(hIndex / 5, 1) * 35) +
      (outDegree > 0 ? Math.min(inDegree / outDegree, 3) / 3 * 25 : 0)
    ));

    // Top citers
    const topCiters = citedBy
      .sort((a, b) => (parseInt(b.count) || 1) - (parseInt(a.count) || 1))
      .slice(0, 5)
      .map(c => ({
        id: c.id || c.dtuId,
        title: c.title || c.id || "Unknown",
        count: parseInt(c.count) || 1,
      }));

    // Reciprocal citations (mutual references)
    const citedByIds = new Set(citedBy.map(c => c.id || c.dtuId));
    const reciprocal = cites.filter(c => citedByIds.has(c.id || c.dtuId));

    return {
      ok: true,
      result: {
        dtuId: artifact.id,
        title: artifact.title,
        inDegree,
        outDegree,
        hIndex,
        influenceScore,
        influenceLevel: influenceScore >= 75 ? "high" : influenceScore >= 40 ? "moderate" : "low",
        topCiters,
        reciprocalCount: reciprocal.length,
        networkDensity: inDegree + outDegree > 0
          ? Math.round((reciprocal.length / (inDegree + outDegree)) * 10000) / 100
          : 0,
      },
    };
  });

  /**
   * tierRecommendation
   * Recommend whether a DTU should be promoted, demoted, or maintained
   * at its current tier based on usage metrics.
   */
  registerLensAction("dtus", "tierRecommendation", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const meta = artifact.meta || {};
    const currentTier = data.tier || meta.tier || "regular";

    const citationCount = parseInt(data.citationCount) || parseInt(meta.citationCount) || 0;
    const viewCount = parseInt(data.viewCount) || parseInt(meta.viewCount) || 0;
    const forkCount = parseInt(data.forkCount) || parseInt(meta.forkCount) || 0;
    const qualityIndicator = parseInt(data.qualityScore) || 50;

    // Tier thresholds
    const tierScores = {
      hyper: { minCitations: 50, minViews: 500, minForks: 10, minQuality: 80 },
      mega: { minCitations: 20, minViews: 200, minForks: 5, minQuality: 65 },
      regular: { minCitations: 0, minViews: 0, minForks: 0, minQuality: 0 },
    };

    // Calculate what tier the metrics support
    let recommendedTier = "regular";
    if (citationCount >= tierScores.hyper.minCitations &&
        viewCount >= tierScores.hyper.minViews &&
        qualityIndicator >= tierScores.hyper.minQuality) {
      recommendedTier = "hyper";
    } else if (citationCount >= tierScores.mega.minCitations &&
               viewCount >= tierScores.mega.minViews &&
               qualityIndicator >= tierScores.mega.minQuality) {
      recommendedTier = "mega";
    }

    const tierOrder = ["regular", "mega", "hyper"];
    const currentIndex = tierOrder.indexOf(currentTier);
    const recommendedIndex = tierOrder.indexOf(recommendedTier);

    const action = recommendedIndex > currentIndex ? "promote"
      : recommendedIndex < currentIndex ? "demote"
      : "maintain";

    return {
      ok: true,
      result: {
        dtuId: artifact.id,
        title: artifact.title,
        currentTier,
        recommendedTier,
        action,
        metrics: {
          citationCount,
          viewCount,
          forkCount,
          qualityIndicator,
        },
        thresholds: tierScores[recommendedTier] || tierScores.regular,
        reasoning: action === "promote"
          ? `Metrics support ${recommendedTier} tier. Citations: ${citationCount}, Views: ${viewCount}, Quality: ${qualityIndicator}.`
          : action === "demote"
          ? `Current metrics no longer support ${currentTier} tier. Consider updating content to maintain tier.`
          : `DTU is correctly classified at ${currentTier} tier.`,
      },
    };
  });

  /**
   * duplicateDetection
   * Detect potential duplicates by comparing title similarity, tag overlap,
   * and content fingerprints against sibling DTUs.
   */
  registerLensAction("dtus", "duplicateDetection", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const siblings = data.siblings || data.relatedDTUs || [];
    const title = (artifact.title || "").toLowerCase().trim();
    const tags = new Set((artifact.meta?.tags || []).map(t => t.toLowerCase()));

    if (siblings.length === 0) {
      return { ok: true, result: { message: "No sibling DTUs provided for duplicate detection.", duplicates: [], totalChecked: 0 } };
    }

    // Jaccard similarity for sets
    function jaccard(setA, setB) {
      if (setA.size === 0 && setB.size === 0) return 1;
      let intersection = 0;
      for (const item of setA) {
        if (setB.has(item)) intersection++;
      }
      const union = setA.size + setB.size - intersection;
      return union > 0 ? intersection / union : 0;
    }

    // Simple trigram similarity for titles
    function trigrams(str) {
      const s = str.toLowerCase().trim();
      const set = new Set();
      for (let i = 0; i <= s.length - 3; i++) {
        set.add(s.substring(i, i + 3));
      }
      return set;
    }

    const titleTrigrams = trigrams(title);

    const candidates = siblings.map(sib => {
      const sibTitle = (sib.title || "").toLowerCase().trim();
      const sibTags = new Set((sib.tags || []).map(t => t.toLowerCase()));
      const sibTrigrams = trigrams(sibTitle);

      const titleSimilarity = jaccard(titleTrigrams, sibTrigrams);
      const tagOverlap = jaccard(tags, sibTags);
      const combinedScore = Math.round((titleSimilarity * 0.6 + tagOverlap * 0.4) * 100);

      return {
        id: sib.id,
        title: sib.title,
        titleSimilarity: Math.round(titleSimilarity * 100),
        tagOverlap: Math.round(tagOverlap * 100),
        combinedScore,
        isDuplicate: combinedScore >= 70,
        isPossibleDuplicate: combinedScore >= 45,
      };
    }).sort((a, b) => b.combinedScore - a.combinedScore);

    const duplicates = candidates.filter(c => c.isDuplicate);
    const possibleDuplicates = candidates.filter(c => c.isPossibleDuplicate && !c.isDuplicate);

    return {
      ok: true,
      result: {
        dtuId: artifact.id,
        title: artifact.title,
        totalChecked: siblings.length,
        duplicatesFound: duplicates.length,
        possibleDuplicatesFound: possibleDuplicates.length,
        duplicates: duplicates.slice(0, 5),
        possibleDuplicates: possibleDuplicates.slice(0, 5),
        isUnique: duplicates.length === 0 && possibleDuplicates.length === 0,
      },
    };
  });
}
