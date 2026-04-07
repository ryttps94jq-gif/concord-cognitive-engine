// server/domains/organ.js
// Domain actions for organization/team management: org chart analysis,
// team composition evaluation, and communication flow modeling.

export default function registerOrganActions(registerLensAction) {
  /**
   * orgChart
   * Analyze org chart structure from artifact.data.employees:
   * [{ id, name, managerId, title?, level? }]
   * Computes span of control, depth, flatness ratio, bottleneck managers.
   */
  registerLensAction("organ", "orgChart", (ctx, artifact, _params) => {
    const employees = artifact.data?.employees || [];
    if (employees.length === 0) {
      return { ok: true, result: { message: "No employee data to analyze." } };
    }

    // Build adjacency: managerId -> list of direct reports
    const byId = {};
    const children = {};
    const roots = [];
    for (const emp of employees) {
      byId[emp.id] = emp;
      if (!children[emp.id]) children[emp.id] = [];
    }
    for (const emp of employees) {
      if (emp.managerId == null || !byId[emp.managerId]) {
        roots.push(emp.id);
      } else {
        if (!children[emp.managerId]) children[emp.managerId] = [];
        children[emp.managerId].push(emp.id);
      }
    }

    // Compute depth of each node via BFS from roots
    const depth = {};
    const queue = roots.map(id => ({ id, d: 0 }));
    while (queue.length > 0) {
      const { id, d } = queue.shift();
      depth[id] = d;
      for (const childId of (children[id] || [])) {
        queue.push({ id: childId, d: d + 1 });
      }
    }

    const maxDepth = Math.max(...Object.values(depth), 0);
    const totalNodes = employees.length;

    // Span of control: direct reports per manager
    const managers = Object.entries(children)
      .filter(([, reports]) => reports.length > 0)
      .map(([id, reports]) => ({
        id,
        name: byId[id]?.name || id,
        title: byId[id]?.title || "unknown",
        directReports: reports.length,
        depth: depth[id] ?? 0,
      }));

    const spans = managers.map(m => m.directReports);
    const avgSpan = spans.length > 0 ? spans.reduce((s, v) => s + v, 0) / spans.length : 0;
    const maxSpan = spans.length > 0 ? Math.max(...spans) : 0;
    const minSpan = spans.length > 0 ? Math.min(...spans) : 0;
    const spanStdDev = spans.length > 1
      ? Math.sqrt(spans.reduce((s, v) => s + Math.pow(v - avgSpan, 2), 0) / spans.length)
      : 0;

    // Flatness ratio: ratio of max possible depth (n-1) to actual depth
    const flatnessRatio = totalNodes > 1 ? 1 - (maxDepth / (totalNodes - 1)) : 1;

    // Bottleneck managers: span > avgSpan + 1.5 * stdDev or > 10
    const bottleneckThreshold = Math.max(avgSpan + 1.5 * spanStdDev, 8);
    const bottlenecks = managers
      .filter(m => m.directReports >= bottleneckThreshold)
      .sort((a, b) => b.directReports - a.directReports);

    // Level distribution
    const levelCounts = {};
    for (const d of Object.values(depth)) {
      levelCounts[d] = (levelCounts[d] || 0) + 1;
    }

    // Compute subtree sizes for each manager
    function subtreeSize(id) {
      let size = 1;
      for (const c of (children[id] || [])) {
        size += subtreeSize(c);
      }
      return size;
    }
    const managerSubtrees = managers.map(m => ({
      ...m,
      subtreeSize: subtreeSize(m.id),
    })).sort((a, b) => b.subtreeSize - a.subtreeSize);

    const r = (v) => Math.round(v * 1000) / 1000;

    return {
      ok: true,
      result: {
        totalEmployees: totalNodes,
        totalManagers: managers.length,
        individualContributors: totalNodes - managers.length,
        roots: roots.map(id => byId[id]?.name || id),
        depth: { max: maxDepth, levelDistribution: levelCounts },
        spanOfControl: {
          average: r(avgSpan),
          min: minSpan,
          max: maxSpan,
          stdDev: r(spanStdDev),
        },
        flatnessRatio: r(flatnessRatio),
        flatnessLabel: flatnessRatio > 0.9 ? "very flat" : flatnessRatio > 0.7 ? "flat" : flatnessRatio > 0.4 ? "moderate" : "tall",
        bottleneckManagers: bottlenecks.slice(0, 10),
        largestSubtrees: managerSubtrees.slice(0, 5).map(m => ({
          name: m.name, title: m.title, subtreeSize: m.subtreeSize, directReports: m.directReports,
        })),
      },
    };
  });

  /**
   * teamComposition
   * Evaluate team composition from artifact.data.team:
   * [{ name, skills: [string], role?, demographics?: { ... } }]
   * Computes skills coverage, diversity metrics, Belbin role balance.
   */
  registerLensAction("organ", "teamComposition", (ctx, artifact, params) => {
    const team = artifact.data?.team || [];
    const requiredSkills = params.requiredSkills || artifact.data?.requiredSkills || [];
    if (team.length === 0) {
      return { ok: true, result: { message: "No team data to analyze." } };
    }

    // Skills coverage matrix
    const allSkills = new Set();
    for (const member of team) {
      for (const skill of (member.skills || [])) allSkills.add(skill.toLowerCase());
    }
    for (const skill of requiredSkills) allSkills.add(skill.toLowerCase());

    const skillCoverage = {};
    for (const skill of allSkills) {
      const holders = team.filter(m => (m.skills || []).map(s => s.toLowerCase()).includes(skill));
      skillCoverage[skill] = {
        count: holders.length,
        holders: holders.map(m => m.name),
        coverage: team.length > 0 ? Math.round((holders.length / team.length) * 100) : 0,
        isRequired: requiredSkills.map(s => s.toLowerCase()).includes(skill),
      };
    }

    // Identify gaps: required skills with zero coverage
    const gaps = requiredSkills
      .filter(s => (skillCoverage[s.toLowerCase()]?.count || 0) === 0)
      .map(s => s);

    // Single-point-of-failure: required skills held by only one person
    const singlePoints = requiredSkills
      .filter(s => (skillCoverage[s.toLowerCase()]?.count || 0) === 1)
      .map(s => ({
        skill: s,
        holder: skillCoverage[s.toLowerCase()].holders[0],
      }));

    // Skill diversity: Shannon entropy over skill distribution
    const skillCounts = team.map(m => (m.skills || []).length);
    const totalSkillInstances = skillCounts.reduce((s, v) => s + v, 0);
    const skillFreqs = {};
    for (const member of team) {
      for (const skill of (member.skills || [])) {
        const s = skill.toLowerCase();
        skillFreqs[s] = (skillFreqs[s] || 0) + 1;
      }
    }
    let skillEntropy = 0;
    if (totalSkillInstances > 0) {
      for (const count of Object.values(skillFreqs)) {
        const p = count / totalSkillInstances;
        if (p > 0) skillEntropy -= p * Math.log2(p);
      }
    }
    const maxEntropy = allSkills.size > 0 ? Math.log2(allSkills.size) : 0;
    const skillDiversityIndex = maxEntropy > 0 ? skillEntropy / maxEntropy : 0;

    // Belbin role balance scoring
    const belbinRoles = [
      "plant", "monitor-evaluator", "coordinator", "resource-investigator",
      "implementer", "completer-finisher", "teamworker", "shaper", "specialist",
    ];
    const roleMapping = {};
    for (const role of belbinRoles) roleMapping[role] = 0;
    for (const member of team) {
      const role = (member.role || "").toLowerCase();
      if (roleMapping[role] !== undefined) {
        roleMapping[role]++;
      }
    }
    const filledRoles = Object.values(roleMapping).filter(c => c > 0).length;
    const belbinBalance = filledRoles / belbinRoles.length;
    const missingBelbinRoles = belbinRoles.filter(r => roleMapping[r] === 0);

    // Demographic diversity (Simpson's diversity index) per attribute
    const demographics = {};
    const demoKeys = new Set();
    for (const member of team) {
      if (member.demographics) {
        for (const key of Object.keys(member.demographics)) demoKeys.add(key);
      }
    }
    for (const key of demoKeys) {
      const groups = {};
      for (const member of team) {
        const val = member.demographics?.[key] || "unspecified";
        groups[val] = (groups[val] || 0) + 1;
      }
      const n = team.length;
      // Simpson's diversity: 1 - sum(p_i^2)
      let simpsonSum = 0;
      for (const count of Object.values(groups)) {
        const p = count / n;
        simpsonSum += p * p;
      }
      demographics[key] = {
        groups,
        simpsonDiversity: Math.round((1 - simpsonSum) * 1000) / 1000,
        uniqueValues: Object.keys(groups).length,
      };
    }

    const r = (v) => Math.round(v * 1000) / 1000;

    return {
      ok: true,
      result: {
        teamSize: team.length,
        uniqueSkills: allSkills.size,
        skillCoverage,
        gaps,
        singlePointsOfFailure: singlePoints,
        skillDiversity: {
          shannonEntropy: r(skillEntropy),
          normalizedDiversity: r(skillDiversityIndex),
          label: skillDiversityIndex > 0.8 ? "excellent" : skillDiversityIndex > 0.6 ? "good" : skillDiversityIndex > 0.4 ? "moderate" : "low",
        },
        belbinRoleBalance: {
          score: r(belbinBalance),
          filledRoles,
          totalRoles: belbinRoles.length,
          missingRoles: missingBelbinRoles,
          distribution: roleMapping,
        },
        demographics,
      },
    };
  });

  /**
   * communicationFlow
   * Analyze communication patterns from artifact.data.communications:
   * [{ from, to, channel?, timestamp?, weight? }]
   * Builds communication graph, detects silos, computes flow efficiency.
   */
  registerLensAction("organ", "communicationFlow", (ctx, artifact, _params) => {
    const comms = artifact.data?.communications || [];
    if (comms.length === 0) {
      return { ok: true, result: { message: "No communication data to analyze." } };
    }

    // Build adjacency matrix and node set
    const nodes = new Set();
    const edges = {};
    const inDegree = {};
    const outDegree = {};
    for (const c of comms) {
      if (!c.from || !c.to) continue;
      nodes.add(c.from);
      nodes.add(c.to);
      const key = `${c.from}|${c.to}`;
      const w = c.weight || 1;
      edges[key] = (edges[key] || 0) + w;
      outDegree[c.from] = (outDegree[c.from] || 0) + w;
      inDegree[c.to] = (inDegree[c.to] || 0) + w;
    }

    const nodeList = [...nodes];
    const n = nodeList.length;
    const nodeIdx = {};
    nodeList.forEach((nd, i) => { nodeIdx[nd] = i; });

    // Build adjacency list for reachability
    const adj = {};
    for (const nd of nodeList) adj[nd] = new Set();
    for (const c of comms) {
      if (c.from && c.to) adj[c.from].add(c.to);
    }

    // Detect connected components (undirected) for silo detection
    const visited = new Set();
    const components = [];
    for (const nd of nodeList) {
      if (visited.has(nd)) continue;
      const component = [];
      const stack = [nd];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (visited.has(cur)) continue;
        visited.add(cur);
        component.push(cur);
        // Treat as undirected for component detection
        for (const neighbor of (adj[cur] || [])) {
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
        // Reverse edges
        for (const other of nodeList) {
          if (adj[other]?.has(cur) && !visited.has(other)) stack.push(other);
        }
      }
      components.push(component);
    }

    // Density: actual edges / possible edges
    const uniqueEdges = Object.keys(edges).length;
    const maxEdges = n * (n - 1);
    const density = maxEdges > 0 ? uniqueEdges / maxEdges : 0;

    // Reciprocity: fraction of edges with reciprocal
    let reciprocalCount = 0;
    for (const key of Object.keys(edges)) {
      const [from, to] = key.split("|");
      const reverseKey = `${to}|${from}`;
      if (edges[reverseKey]) reciprocalCount++;
    }
    const reciprocity = uniqueEdges > 0 ? reciprocalCount / uniqueEdges : 0;

    // Hub analysis: nodes with highest total degree
    const totalDegree = {};
    for (const nd of nodeList) {
      totalDegree[nd] = (inDegree[nd] || 0) + (outDegree[nd] || 0);
    }
    const hubs = nodeList
      .map(nd => ({ node: nd, totalDegree: totalDegree[nd], inDegree: inDegree[nd] || 0, outDegree: outDegree[nd] || 0 }))
      .sort((a, b) => b.totalDegree - a.totalDegree);

    // Betweenness centrality approximation (BFS shortest paths)
    const betweenness = {};
    for (const nd of nodeList) betweenness[nd] = 0;
    for (const source of nodeList) {
      // BFS
      const dist = {};
      const sigma = {};
      const pred = {};
      for (const nd of nodeList) { dist[nd] = -1; sigma[nd] = 0; pred[nd] = []; }
      dist[source] = 0;
      sigma[source] = 1;
      const bfsQueue = [source];
      const order = [];
      while (bfsQueue.length > 0) {
        const v = bfsQueue.shift();
        order.push(v);
        for (const w of (adj[v] || [])) {
          if (dist[w] < 0) {
            dist[w] = dist[v] + 1;
            bfsQueue.push(w);
          }
          if (dist[w] === dist[v] + 1) {
            sigma[w] += sigma[v];
            pred[w].push(v);
          }
        }
      }
      const delta = {};
      for (const nd of nodeList) delta[nd] = 0;
      while (order.length > 0) {
        const w = order.pop();
        for (const v of pred[w]) {
          delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        }
        if (w !== source) betweenness[w] += delta[w];
      }
    }

    const brokers = nodeList
      .map(nd => ({ node: nd, betweenness: Math.round(betweenness[nd] * 1000) / 1000 }))
      .sort((a, b) => b.betweenness - a.betweenness);

    // Silo detection: components with >= 2 members and weak inter-component links
    const silos = components.filter(c => c.length >= 2).map(c => ({
      members: c,
      size: c.length,
    }));

    // Channel distribution
    const channelCounts = {};
    for (const c of comms) {
      const ch = c.channel || "unspecified";
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    }

    // Information flow efficiency: avg shortest path length
    let totalPathLength = 0;
    let reachablePairs = 0;
    for (const source of nodeList) {
      const dist = {};
      dist[source] = 0;
      const q = [source];
      while (q.length > 0) {
        const v = q.shift();
        for (const w of (adj[v] || [])) {
          if (dist[w] === undefined) {
            dist[w] = dist[v] + 1;
            q.push(w);
          }
        }
      }
      for (const target of nodeList) {
        if (target !== source && dist[target] !== undefined) {
          totalPathLength += dist[target];
          reachablePairs++;
        }
      }
    }
    const avgPathLength = reachablePairs > 0 ? totalPathLength / reachablePairs : Infinity;
    const reachability = maxEdges > 0 ? reachablePairs / maxEdges : 0;

    const r = (v) => Math.round(v * 1000) / 1000;

    return {
      ok: true,
      result: {
        nodes: n,
        edges: uniqueEdges,
        totalMessages: comms.length,
        density: r(density),
        reciprocity: r(reciprocity),
        connectedComponents: components.length,
        silos: silos.length > 1 ? silos : [],
        siloDetected: components.length > 1,
        hubs: hubs.slice(0, 5),
        brokers: brokers.slice(0, 5),
        channels: channelCounts,
        flowEfficiency: {
          avgPathLength: r(avgPathLength),
          reachability: r(reachability),
          label: avgPathLength <= 2 ? "excellent" : avgPathLength <= 3 ? "good" : avgPathLength <= 5 ? "moderate" : "poor",
        },
      },
    };
  });
}
