// server/domains/alliance.js
// Domain actions for partnership/alliance management: compatibility scoring, network analysis, risk assessment.

export default function registerAllianceActions(registerLensAction) {
  /**
   * compatibilityScore
   * Score compatibility between potential partners based on capabilities, values alignment,
   * resource complementarity using Jaccard similarity and weighted scoring.
   * artifact.data.partnerA: { name, capabilities: [string], values: [string], resources: [string], strengths: [string] }
   * artifact.data.partnerB: { name, capabilities: [string], values: [string], resources: [string], strengths: [string] }
   * params.weights — optional { capabilities, values, resources, complementarity } weight overrides
   */
  registerLensAction("alliance", "compatibilityScore", (ctx, artifact, params) => {
    const a = artifact.data.partnerA || {};
    const b = artifact.data.partnerB || {};

    const weights = {
      capabilities: 0.3,
      values: 0.35,
      resources: 0.15,
      complementarity: 0.2,
      ...(params.weights || {}),
    };

    // Jaccard similarity: |A ∩ B| / |A ∪ B|
    function jaccard(setA, setB) {
      const a = new Set(setA);
      const b = new Set(setB);
      if (a.size === 0 && b.size === 0) return 1;
      let intersection = 0;
      for (const item of a) {
        if (b.has(item)) intersection++;
      }
      const union = a.size + b.size - intersection;
      return union > 0 ? intersection / union : 0;
    }

    // Complementarity: items one has that the other lacks (mutual fill-the-gap)
    function complementarity(listA, listB) {
      const a = new Set(listA || []);
      const b = new Set(listB || []);
      if (a.size === 0 && b.size === 0) return 0;
      let aOnly = 0;
      let bOnly = 0;
      for (const item of a) {
        if (!b.has(item)) aOnly++;
      }
      for (const item of b) {
        if (!a.has(item)) bOnly++;
      }
      // High complementarity = both bring unique things, low overlap
      const totalUnique = aOnly + bOnly;
      const total = a.size + b.size;
      return total > 0 ? totalUnique / total : 0;
    }

    const capabilitySimilarity = jaccard(a.capabilities || [], b.capabilities || []);
    const valuesSimilarity = jaccard(a.values || [], b.values || []);
    const resourceSimilarity = jaccard(a.resources || [], b.resources || []);
    const resourceComplementarity = complementarity(a.resources || [], b.resources || []);
    const strengthComplementarity = complementarity(a.strengths || [], b.strengths || []);

    // Combined complementarity score: higher is better (partners bring different things)
    const complementarityScore = (resourceComplementarity + strengthComplementarity) / 2;

    // Weighted composite: values alignment and capability overlap are good,
    // complementarity in resources is good (they fill each other's gaps)
    const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
    const composite = (
      capabilitySimilarity * weights.capabilities +
      valuesSimilarity * weights.values +
      resourceSimilarity * weights.resources +
      complementarityScore * weights.complementarity
    ) / totalWeight;

    // Overlap analysis
    const capOverlap = (a.capabilities || []).filter(c => (b.capabilities || []).includes(c));
    const valOverlap = (a.values || []).filter(v => (b.values || []).includes(v));
    const resOverlap = (a.resources || []).filter(r => (b.resources || []).includes(r));

    // Unique contributions from each partner
    const aUniqueCapabilities = (a.capabilities || []).filter(c => !(b.capabilities || []).includes(c));
    const bUniqueCapabilities = (b.capabilities || []).filter(c => !(a.capabilities || []).includes(c));
    const aUniqueResources = (a.resources || []).filter(r => !(b.resources || []).includes(r));
    const bUniqueResources = (b.resources || []).filter(r => !(a.resources || []).includes(r));

    const compatibilityLevel = composite >= 0.75 ? "excellent"
      : composite >= 0.55 ? "good"
      : composite >= 0.35 ? "moderate"
      : "low";

    const result = {
      analyzedAt: new Date().toISOString(),
      partnerA: a.name || "Partner A",
      partnerB: b.name || "Partner B",
      compositeScore: Math.round(composite * 10000) / 100,
      compatibilityLevel,
      componentScores: {
        capabilitySimilarity: Math.round(capabilitySimilarity * 10000) / 100,
        valuesAlignment: Math.round(valuesSimilarity * 10000) / 100,
        resourceSimilarity: Math.round(resourceSimilarity * 10000) / 100,
        complementarity: Math.round(complementarityScore * 10000) / 100,
      },
      overlap: {
        capabilities: capOverlap,
        values: valOverlap,
        resources: resOverlap,
      },
      uniqueContributions: {
        [a.name || "partnerA"]: { capabilities: aUniqueCapabilities, resources: aUniqueResources },
        [b.name || "partnerB"]: { capabilities: bUniqueCapabilities, resources: bUniqueResources },
      },
      weights,
    };

    artifact.data.compatibilityScore = result;
    return { ok: true, result };
  });

  /**
   * networkAnalysis
   * Analyze alliance network for structural holes, brokerage positions,
   * and cluster coefficients.
   * artifact.data.nodes: [{ id, name, attributes? }]
   * artifact.data.edges: [{ source, target, weight? }]
   */
  registerLensAction("alliance", "networkAnalysis", (ctx, artifact, params) => {
    const nodes = artifact.data.nodes || [];
    const edges = artifact.data.edges || [];

    if (nodes.length === 0) {
      return { ok: true, result: { message: "No nodes provided for network analysis." } };
    }

    // Build adjacency list (undirected)
    const adj = {};
    const nodeSet = new Set(nodes.map(n => n.id));
    for (const n of nodes) {
      adj[n.id] = new Set();
    }
    for (const edge of edges) {
      if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
        adj[edge.source].add(edge.target);
        adj[edge.target].add(edge.source);
      }
    }

    // Degree centrality
    const degrees = {};
    const maxPossibleDegree = nodes.length - 1;
    for (const n of nodes) {
      degrees[n.id] = {
        degree: adj[n.id].size,
        centrality: maxPossibleDegree > 0 ? Math.round((adj[n.id].size / maxPossibleDegree) * 10000) / 10000 : 0,
      };
    }

    // Betweenness centrality (Brandes algorithm simplified for small networks)
    const betweenness = {};
    for (const n of nodes) betweenness[n.id] = 0;

    for (const s of nodes) {
      const stack = [];
      const pred = {};
      const sigma = {};
      const dist = {};
      const delta = {};

      for (const n of nodes) {
        pred[n.id] = [];
        sigma[n.id] = 0;
        dist[n.id] = -1;
        delta[n.id] = 0;
      }

      sigma[s.id] = 1;
      dist[s.id] = 0;
      const queue = [s.id];

      while (queue.length > 0) {
        const v = queue.shift();
        stack.push(v);
        for (const w of adj[v]) {
          if (dist[w] < 0) {
            queue.push(w);
            dist[w] = dist[v] + 1;
          }
          if (dist[w] === dist[v] + 1) {
            sigma[w] += sigma[v];
            pred[w].push(v);
          }
        }
      }

      while (stack.length > 0) {
        const w = stack.pop();
        for (const v of pred[w]) {
          delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        }
        if (w !== s.id) {
          betweenness[w] += delta[w];
        }
      }
    }

    // Normalize betweenness
    const n = nodes.length;
    const normFactor = n > 2 ? 2 / ((n - 1) * (n - 2)) : 1;
    for (const id of Object.keys(betweenness)) {
      betweenness[id] = Math.round(betweenness[id] * normFactor * 10000) / 10000;
    }

    // Local clustering coefficient for each node
    const clustering = {};
    for (const node of nodes) {
      const neighbors = [...adj[node.id]];
      const k = neighbors.length;
      if (k < 2) {
        clustering[node.id] = 0;
        continue;
      }
      let triangles = 0;
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          if (adj[neighbors[i]].has(neighbors[j])) {
            triangles++;
          }
        }
      }
      const possibleTriangles = (k * (k - 1)) / 2;
      clustering[node.id] = Math.round((triangles / possibleTriangles) * 10000) / 10000;
    }

    // Global clustering coefficient
    const clusterValues = Object.values(clustering);
    const globalClustering = clusterValues.length > 0
      ? Math.round((clusterValues.reduce((s, v) => s + v, 0) / clusterValues.length) * 10000) / 10000
      : 0;

    // Structural holes: nodes with high betweenness but low clustering (brokers)
    const brokers = nodes
      .map(node => ({
        id: node.id,
        name: node.name,
        betweenness: betweenness[node.id],
        clustering: clustering[node.id],
        degree: degrees[node.id].degree,
        // Constraint measure: high betweenness + low clustering = structural hole
        brokerageScore: Math.round(((betweenness[node.id] || 0) * (1 - (clustering[node.id] || 0))) * 10000) / 10000,
      }))
      .sort((a, b) => b.brokerageScore - a.brokerageScore);

    // Identify connected components
    const visited = new Set();
    const components = [];
    for (const node of nodes) {
      if (visited.has(node.id)) continue;
      const component = [];
      const bfsQueue = [node.id];
      visited.add(node.id);
      while (bfsQueue.length > 0) {
        const current = bfsQueue.shift();
        component.push(current);
        for (const neighbor of adj[current]) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            bfsQueue.push(neighbor);
          }
        }
      }
      components.push(component);
    }

    // Network density
    const maxEdges = (n * (n - 1)) / 2;
    const density = maxEdges > 0 ? Math.round((edges.length / maxEdges) * 10000) / 10000 : 0;

    const result = {
      analyzedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      density,
      connectedComponents: components.length,
      componentSizes: components.map(c => c.length).sort((a, b) => b - a),
      globalClusteringCoefficient: globalClustering,
      degrees,
      betweennessCentrality: betweenness,
      localClustering: clustering,
      brokers: brokers.slice(0, 10),
      topByDegree: [...nodes].sort((a, b) => degrees[b.id].degree - degrees[a.id].degree).slice(0, 5).map(n => ({ id: n.id, name: n.name, degree: degrees[n.id].degree })),
      topByBetweenness: [...nodes].sort((a, b) => betweenness[b.id] - betweenness[a.id]).slice(0, 5).map(n => ({ id: n.id, name: n.name, betweenness: betweenness[n.id] })),
    };

    artifact.data.networkAnalysis = result;
    return { ok: true, result };
  });

  /**
   * riskAssessment
   * Evaluate alliance risks — dependency concentration, single points of failure,
   * diversification index.
   * artifact.data.alliances: [{ partnerId, partnerName, dependencyPct, categories: [string], revenue?, critical? }]
   * params.concentrationThreshold — pct threshold for concentration risk (default 30)
   */
  registerLensAction("alliance", "riskAssessment", (ctx, artifact, params) => {
    const alliances = artifact.data.alliances || [];
    if (alliances.length === 0) {
      return { ok: true, result: { message: "No alliances provided for risk assessment." } };
    }

    const concentrationThreshold = params.concentrationThreshold || 30;

    // Dependency concentration: partners with outsized dependency share
    const totalDependency = alliances.reduce((s, a) => s + (parseFloat(a.dependencyPct) || 0), 0);
    const concentrationRisks = alliances
      .map(a => {
        const dep = parseFloat(a.dependencyPct) || 0;
        const normalized = totalDependency > 0 ? (dep / totalDependency) * 100 : 0;
        return {
          partnerId: a.partnerId,
          partnerName: a.partnerName,
          dependencyPct: dep,
          normalizedPct: Math.round(normalized * 100) / 100,
          isConcentrated: dep >= concentrationThreshold,
        };
      })
      .sort((a, b) => b.dependencyPct - a.dependencyPct);

    // Herfindahl-Hirschman Index (HHI) for dependency concentration
    // HHI = sum of squared market shares; 10000 = monopoly, <1500 = diversified
    const hhi = alliances.reduce((sum, a) => {
      const share = totalDependency > 0
        ? ((parseFloat(a.dependencyPct) || 0) / totalDependency) * 100
        : 0;
      return sum + share * share;
    }, 0);
    const hhiRounded = Math.round(hhi);
    const hhiClassification = hhiRounded < 1500 ? "well-diversified"
      : hhiRounded < 2500 ? "moderately-concentrated"
      : "highly-concentrated";

    // Single points of failure: critical partners with no category overlap from others
    const categoryProviders = {};
    for (const alliance of alliances) {
      for (const cat of (alliance.categories || [])) {
        if (!categoryProviders[cat]) categoryProviders[cat] = [];
        categoryProviders[cat].push(alliance.partnerId);
      }
    }

    const singlePointsOfFailure = [];
    for (const [category, providers] of Object.entries(categoryProviders)) {
      if (providers.length === 1) {
        const partner = alliances.find(a => a.partnerId === providers[0]);
        singlePointsOfFailure.push({
          category,
          partnerId: providers[0],
          partnerName: partner ? partner.partnerName : providers[0],
          isCritical: partner ? !!partner.critical : false,
        });
      }
    }

    // Diversification index: 1 - (HHI / 10000)
    const diversificationIndex = Math.round((1 - hhi / 10000) * 10000) / 10000;

    // Category coverage analysis
    const allCategories = new Set();
    for (const a of alliances) {
      for (const cat of (a.categories || [])) allCategories.add(cat);
    }
    const categoryRedundancy = {};
    for (const cat of allCategories) {
      categoryRedundancy[cat] = {
        providerCount: categoryProviders[cat].length,
        providers: categoryProviders[cat],
        redundancy: categoryProviders[cat].length > 1 ? "redundant" : "single-source",
      };
    }

    // Revenue concentration risk
    const totalRevenue = alliances.reduce((s, a) => s + (parseFloat(a.revenue) || 0), 0);
    const revenueConcentration = alliances
      .filter(a => a.revenue)
      .map(a => ({
        partnerId: a.partnerId,
        partnerName: a.partnerName,
        revenue: parseFloat(a.revenue) || 0,
        revenuePct: totalRevenue > 0 ? Math.round(((parseFloat(a.revenue) || 0) / totalRevenue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Overall risk score: 0-100, higher is riskier
    let riskScore = 0;
    // HHI contribution (0-40 points)
    riskScore += Math.min(40, (hhiRounded / 10000) * 40);
    // Single points of failure (0-30 points)
    const criticalSPOF = singlePointsOfFailure.filter(s => s.isCritical).length;
    riskScore += Math.min(30, criticalSPOF * 15 + (singlePointsOfFailure.length - criticalSPOF) * 5);
    // Concentration risk (0-30 points)
    const concentratedCount = concentrationRisks.filter(c => c.isConcentrated).length;
    riskScore += Math.min(30, concentratedCount * 10);
    riskScore = Math.round(Math.min(100, riskScore) * 100) / 100;

    const riskLevel = riskScore >= 70 ? "critical"
      : riskScore >= 45 ? "high"
      : riskScore >= 25 ? "moderate"
      : "low";

    const result = {
      analyzedAt: new Date().toISOString(),
      allianceCount: alliances.length,
      overallRiskScore: riskScore,
      riskLevel,
      hhi: hhiRounded,
      hhiClassification,
      diversificationIndex,
      concentrationRisks,
      singlePointsOfFailure,
      categoryRedundancy,
      revenueConcentration,
      summary: {
        concentratedPartners: concentratedCount,
        singleSourceCategories: singlePointsOfFailure.length,
        criticalSPOF: criticalSPOF,
        totalCategories: allCategories.size,
      },
    };

    artifact.data.riskAssessment = result;
    return { ok: true, result };
  });
}
