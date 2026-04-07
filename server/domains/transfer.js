// server/domains/transfer.js
// Domain actions for data/knowledge transfer: schema mapping, data quality
// assessment, and migration plan generation.

export default function registerTransferActions(registerLensAction) {
  /**
   * schemaMapping
   * Map fields between source and target schemas using Levenshtein similarity,
   * type compatibility, and hierarchical matching.
   * artifact.data.sourceSchema = [{ name, type?, path?, description?, required? }]
   * artifact.data.targetSchema = [{ name, type?, path?, description?, required? }]
   * params.similarityThreshold (default: 0.5)
   */
  registerLensAction("transfer", "schemaMapping", (ctx, artifact, params) => {
    const source = artifact.data?.sourceSchema || [];
    const target = artifact.data?.targetSchema || [];
    if (source.length === 0 || target.length === 0) {
      return { ok: false, error: "Both sourceSchema and targetSchema are required." };
    }

    const threshold = params.similarityThreshold || 0.5;
    const r = (v) => Math.round(v * 1000) / 1000;

    // Levenshtein distance
    function levenshtein(a, b) {
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
      return dp[m][n];
    }

    function levenshteinSimilarity(a, b) {
      const maxLen = Math.max(a.length, b.length);
      if (maxLen === 0) return 1;
      return 1 - levenshtein(a, b) / maxLen;
    }

    // Normalize field name for comparison
    function normalize(name) {
      return (name || "")
        .toLowerCase()
        .replace(/[_\-\s]+/g, "")
        .replace(/id$/i, "")
        .replace(/^(get|set|is|has)/i, "");
    }

    // Type compatibility scoring
    const typeGroups = {
      string: ["string", "text", "varchar", "char", "nvarchar"],
      number: ["number", "int", "integer", "float", "double", "decimal", "numeric", "bigint"],
      boolean: ["boolean", "bool", "bit"],
      date: ["date", "datetime", "timestamp", "time"],
      array: ["array", "list", "collection"],
      object: ["object", "map", "struct", "record"],
    };

    function typeCompatibility(t1, t2) {
      if (!t1 || !t2) return 0.5; // unknown types get neutral score
      const norm1 = (t1 || "").toLowerCase();
      const norm2 = (t2 || "").toLowerCase();
      if (norm1 === norm2) return 1;
      for (const group of Object.values(typeGroups)) {
        if (group.includes(norm1) && group.includes(norm2)) return 0.9;
      }
      return 0.1;
    }

    // Hierarchical path similarity
    function pathSimilarity(p1, p2) {
      if (!p1 || !p2) return 0;
      const parts1 = p1.split(/[./]/).map(normalize);
      const parts2 = p2.split(/[./]/).map(normalize);
      // Check if terminal segments match
      const termSim = levenshteinSimilarity(parts1[parts1.length - 1] || "", parts2[parts2.length - 1] || "");
      // Check parent path overlap
      let pathOverlap = 0;
      const minLen = Math.min(parts1.length, parts2.length);
      for (let i = 0; i < minLen; i++) {
        if (levenshteinSimilarity(parts1[i], parts2[i]) > 0.7) pathOverlap++;
      }
      const pathScore = minLen > 0 ? pathOverlap / Math.max(parts1.length, parts2.length) : 0;
      return termSim * 0.6 + pathScore * 0.4;
    }

    // Compute similarity matrix
    const mappings = [];
    const usedTargets = new Set();

    // Score all source-target pairs
    const allPairs = [];
    for (const s of source) {
      for (const t of target) {
        const nameSim = levenshteinSimilarity(normalize(s.name), normalize(t.name));
        const typeSim = typeCompatibility(s.type, t.type);
        const pathSim = pathSimilarity(s.path, t.path);

        // Combined score: weighted average
        const score = nameSim * 0.5 + typeSim * 0.3 + pathSim * 0.2;

        allPairs.push({
          source: s.name,
          target: t.name,
          nameSimilarity: r(nameSim),
          typeCompatibility: r(typeSim),
          pathSimilarity: r(pathSim),
          combinedScore: r(score),
          sourceType: s.type || "unknown",
          targetType: t.type || "unknown",
        });
      }
    }

    // Greedy best-match assignment
    allPairs.sort((a, b) => b.combinedScore - a.combinedScore);
    const usedSources = new Set();
    for (const pair of allPairs) {
      if (usedSources.has(pair.source) || usedTargets.has(pair.target)) continue;
      if (pair.combinedScore >= threshold) {
        mappings.push({
          ...pair,
          confidence: pair.combinedScore > 0.8 ? "high" : pair.combinedScore > 0.6 ? "medium" : "low",
          requiresTransform: pair.typeCompatibility < 0.9,
        });
        usedSources.add(pair.source);
        usedTargets.add(pair.target);
      }
    }

    // Unmapped fields
    const unmappedSource = source.filter(s => !usedSources.has(s.name)).map(s => ({
      name: s.name, type: s.type, required: s.required,
      bestCandidate: allPairs.filter(p => p.source === s.name).sort((a, b) => b.combinedScore - a.combinedScore)[0] || null,
    }));
    const unmappedTarget = target.filter(t => !usedTargets.has(t.name)).map(t => ({
      name: t.name, type: t.type, required: t.required,
    }));

    // Coverage metrics
    const mappedSourcePercent = source.length > 0 ? (usedSources.size / source.length) * 100 : 0;
    const mappedTargetPercent = target.length > 0 ? (usedTargets.size / target.length) * 100 : 0;
    const requiredTargetsMapped = target.filter(t => t.required).every(t => usedTargets.has(t.name));

    return {
      ok: true,
      result: {
        mappings,
        mappingCount: mappings.length,
        unmappedSource,
        unmappedTarget,
        coverage: {
          sourceFieldsMapped: r(mappedSourcePercent) + "%",
          targetFieldsMapped: r(mappedTargetPercent) + "%",
          allRequiredMapped: requiredTargetsMapped,
        },
        averageConfidence: r(mappings.length > 0 ? mappings.reduce((s, m) => s + m.combinedScore, 0) / mappings.length : 0),
        transformsRequired: mappings.filter(m => m.requiresTransform).length,
        threshold,
      },
    };
  });

  /**
   * dataQuality
   * Assess data quality for transfer — completeness, accuracy, consistency,
   * timeliness scoring with field-level breakdown.
   * artifact.data.records = [{ ...fields }]
   * artifact.data.schema = [{ name, type?, required?, pattern?, validValues?, maxAge? }]
   */
  registerLensAction("transfer", "dataQuality", (ctx, artifact, _params) => {
    const records = artifact.data?.records || [];
    const schema = artifact.data?.schema || [];
    if (records.length === 0) return { ok: false, error: "No records to assess." };

    const r = (v) => Math.round(v * 1000) / 1000;
    const n = records.length;

    // Detect all fields if schema not provided
    const allFields = new Set();
    for (const rec of records) {
      for (const key of Object.keys(rec)) allFields.add(key);
    }
    for (const s of schema) allFields.add(s.name);
    const fields = [...allFields];

    const schemaMap = {};
    for (const s of schema) schemaMap[s.name] = s;

    const fieldReports = {};
    let totalCompleteness = 0;
    let totalAccuracy = 0;
    let totalConsistency = 0;
    let fieldCount = 0;

    for (const field of fields) {
      const spec = schemaMap[field] || {};
      const values = records.map(rec => rec[field]);
      const nonNull = values.filter(v => v !== null && v !== undefined && v !== "");
      const nullCount = n - nonNull.length;

      // Completeness: fraction of non-null values
      const completeness = n > 0 ? nonNull.length / n : 0;

      // Accuracy: type checking and pattern/valid value matching
      let accurateCount = 0;
      for (const val of nonNull) {
        let isAccurate = true;

        // Type check
        if (spec.type) {
          const t = spec.type.toLowerCase();
          if (t === "number" || t === "int" || t === "integer" || t === "float") {
            if (isNaN(Number(val))) isAccurate = false;
          } else if (t === "boolean" || t === "bool") {
            if (typeof val !== "boolean" && val !== "true" && val !== "false" && val !== 0 && val !== 1) isAccurate = false;
          } else if (t === "date" || t === "datetime") {
            if (isNaN(new Date(val).getTime())) isAccurate = false;
          }
        }

        // Pattern check (regex)
        if (spec.pattern && isAccurate) {
          try {
            if (!new RegExp(spec.pattern).test(String(val))) isAccurate = false;
          } catch (e) { /* ignore invalid regex */ }
        }

        // Valid values check
        if (spec.validValues && isAccurate) {
          if (!spec.validValues.includes(val)) isAccurate = false;
        }

        if (isAccurate) accurateCount++;
      }
      const accuracy = nonNull.length > 0 ? accurateCount / nonNull.length : 1;

      // Consistency: check for inconsistent formats/casing within the field
      const stringVals = nonNull.filter(v => typeof v === "string").map(v => String(v));
      let consistency = 1;
      if (stringVals.length > 1) {
        // Check casing consistency
        const allUpper = stringVals.every(v => v === v.toUpperCase());
        const allLower = stringVals.every(v => v === v.toLowerCase());
        const allTitle = stringVals.every(v => v[0] === v[0].toUpperCase());
        const casingConsistent = allUpper || allLower || allTitle;

        // Check format consistency (e.g., all same length for codes)
        const lengths = stringVals.map(v => v.length);
        const lengthSet = new Set(lengths);
        const lengthConsistent = lengthSet.size <= Math.ceil(stringVals.length * 0.1) + 1;

        consistency = (casingConsistent ? 0.5 : 0) + (lengthConsistent ? 0.5 : 0);
      }

      // Uniqueness
      const uniqueValues = new Set(nonNull.map(v => JSON.stringify(v)));
      const uniqueness = nonNull.length > 0 ? uniqueValues.size / nonNull.length : 1;

      // Duplicate detection
      const duplicates = nonNull.length - uniqueValues.size;

      fieldReports[field] = {
        completeness: r(completeness),
        accuracy: r(accuracy),
        consistency: r(consistency),
        uniqueness: r(uniqueness),
        nullCount,
        duplicates,
        totalValues: n,
        nonNullValues: nonNull.length,
        isRequired: spec.required || false,
        qualityScore: r((completeness * 0.3 + accuracy * 0.3 + consistency * 0.2 + uniqueness * 0.2)),
      };

      totalCompleteness += completeness;
      totalAccuracy += accuracy;
      totalConsistency += consistency;
      fieldCount++;
    }

    const avgCompleteness = fieldCount > 0 ? totalCompleteness / fieldCount : 0;
    const avgAccuracy = fieldCount > 0 ? totalAccuracy / fieldCount : 0;
    const avgConsistency = fieldCount > 0 ? totalConsistency / fieldCount : 0;

    // Timeliness: check date fields for freshness
    let timeliness = null;
    const now = Date.now();
    for (const field of fields) {
      const spec = schemaMap[field] || {};
      if (spec.type === "date" || spec.type === "datetime") {
        const dates = records
          .map(rec => new Date(rec[field]).getTime())
          .filter(t => !isNaN(t));
        if (dates.length > 0) {
          const maxDate = Math.max(...dates);
          const ageMs = now - maxDate;
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          const maxAgeDays = spec.maxAge || 365;
          timeliness = {
            field,
            mostRecentDate: new Date(maxDate).toISOString(),
            ageDays: r(ageDays),
            maxAcceptableAgeDays: maxAgeDays,
            isFresh: ageDays <= maxAgeDays,
            score: r(Math.max(0, 1 - ageDays / maxAgeDays)),
          };
          break;
        }
      }
    }

    // Overall quality score
    const overallScore = avgCompleteness * 0.3 + avgAccuracy * 0.3 + avgConsistency * 0.2 + (timeliness?.score ?? 1) * 0.2;

    // Critical issues
    const criticalIssues = [];
    for (const [field, report] of Object.entries(fieldReports)) {
      if (report.isRequired && report.completeness < 1) {
        criticalIssues.push({ field, issue: "required_field_incomplete", completeness: report.completeness });
      }
      if (report.accuracy < 0.5) {
        criticalIssues.push({ field, issue: "low_accuracy", accuracy: report.accuracy });
      }
    }

    return {
      ok: true,
      result: {
        recordCount: n,
        fieldCount: fields.length,
        fieldReports,
        overallQuality: {
          completeness: r(avgCompleteness),
          accuracy: r(avgAccuracy),
          consistency: r(avgConsistency),
          timeliness: timeliness || { note: "No date fields to assess" },
          compositeScore: r(overallScore),
          grade: overallScore > 0.9 ? "A" : overallScore > 0.8 ? "B" : overallScore > 0.7 ? "C" : overallScore > 0.5 ? "D" : "F",
        },
        criticalIssues,
        transferReadiness: criticalIssues.length === 0 && overallScore > 0.7 ? "ready" : "needs_remediation",
      },
    };
  });

  /**
   * migrationPlan
   * Generate migration plan with dependency ordering (topological sort),
   * batch sizing, and rollback checkpoints.
   * artifact.data.entities = [{ id, name, size?, dependencies?: string[], priority? }]
   * params.batchSizeLimit (max records per batch, default: 1000)
   * params.checkpointInterval (batches between checkpoints, default: 5)
   */
  registerLensAction("transfer", "migrationPlan", (ctx, artifact, params) => {
    const entities = artifact.data?.entities || [];
    if (entities.length === 0) return { ok: false, error: "No entities to migrate." };

    const batchSizeLimit = params.batchSizeLimit || 1000;
    const checkpointInterval = params.checkpointInterval || 5;
    const r = (v) => Math.round(v * 1000) / 1000;

    // Build dependency graph
    const entityMap = {};
    const adj = {}; // entity -> dependencies
    for (const e of entities) {
      entityMap[e.id] = { ...e, size: e.size || 100, dependencies: e.dependencies || [], priority: e.priority || 5 };
      adj[e.id] = e.dependencies || [];
    }

    // Topological sort (Kahn's algorithm)
    const inDegree = {};
    for (const e of entities) inDegree[e.id] = 0;
    for (const e of entities) {
      for (const dep of (e.dependencies || [])) {
        if (inDegree[dep] !== undefined) {
          // dep must come before e, so e has an incoming edge from dep
        }
        inDegree[e.id] = (inDegree[e.id] || 0);
      }
    }
    // Recompute: count how many entities depend on each
    for (const e of entities) {
      for (const dep of (e.dependencies || [])) {
        // e depends on dep, so e has in-degree from dep
      }
    }
    // Proper in-degree: for each entity, count its dependencies that are in our set
    for (const e of entities) {
      inDegree[e.id] = (e.dependencies || []).filter(d => entityMap[d]).length;
    }

    const sorted = [];
    const queue = entities.filter(e => inDegree[e.id] === 0).map(e => e.id);
    // Sort queue by priority (lower = higher priority)
    queue.sort((a, b) => (entityMap[a].priority || 5) - (entityMap[b].priority || 5));

    const visited = new Set();
    while (queue.length > 0) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      sorted.push(id);

      // Find entities that depend on this one
      for (const e of entities) {
        if (e.dependencies?.includes(id) && !visited.has(e.id)) {
          inDegree[e.id]--;
          if (inDegree[e.id] <= 0) {
            queue.push(e.id);
            queue.sort((a, b) => (entityMap[a].priority || 5) - (entityMap[b].priority || 5));
          }
        }
      }
    }

    // Detect circular dependencies
    const circularDeps = entities.filter(e => !visited.has(e.id)).map(e => e.id);
    if (circularDeps.length > 0) {
      // Still include them at the end with a warning
      for (const id of circularDeps) sorted.push(id);
    }

    // Batch sizing
    const batches = [];
    let currentBatch = { entities: [], totalSize: 0, batchNumber: 1 };

    for (const id of sorted) {
      const entity = entityMap[id];
      const size = entity.size;

      if (currentBatch.totalSize + size > batchSizeLimit && currentBatch.entities.length > 0) {
        batches.push(currentBatch);
        currentBatch = { entities: [], totalSize: 0, batchNumber: batches.length + 1 };
      }

      currentBatch.entities.push({
        id,
        name: entity.name,
        size,
        dependencies: entity.dependencies.filter(d => entityMap[d]),
      });
      currentBatch.totalSize += size;
    }
    if (currentBatch.entities.length > 0) batches.push(currentBatch);

    // Add rollback checkpoints
    const plan = [];
    let phase = 1;
    for (let i = 0; i < batches.length; i++) {
      plan.push({
        step: plan.length + 1,
        type: "migrate",
        batch: batches[i].batchNumber,
        entities: batches[i].entities.map(e => ({ id: e.id, name: e.name, size: e.size })),
        totalSize: batches[i].totalSize,
        phase,
      });

      if ((i + 1) % checkpointInterval === 0 || i === batches.length - 1) {
        plan.push({
          step: plan.length + 1,
          type: "checkpoint",
          description: `Rollback checkpoint after batch ${batches[i].batchNumber}`,
          entitiesMigrated: sorted.slice(0, batches.slice(0, i + 1).reduce((s, b) => s + b.entities.length, 0)).length,
          phase,
        });
        phase++;
      }
    }

    // Add validation step at end
    plan.push({
      step: plan.length + 1,
      type: "validate",
      description: "Validate all migrated entities for integrity and completeness",
      checks: ["referential_integrity", "record_count_match", "data_checksum", "constraint_validation"],
    });

    // Summary statistics
    const totalSize = entities.reduce((s, e) => s + (e.size || 100), 0);
    const totalBatches = batches.length;
    const totalCheckpoints = plan.filter(s => s.type === "checkpoint").length;

    // Dependency depth analysis
    function depthOf(id, cache = {}) {
      if (cache[id] !== undefined) return cache[id];
      const deps = entityMap[id]?.dependencies?.filter(d => entityMap[d]) || [];
      if (deps.length === 0) { cache[id] = 0; return 0; }
      const maxDepth = Math.max(...deps.map(d => depthOf(d, cache)));
      cache[id] = maxDepth + 1;
      return cache[id];
    }
    const depths = sorted.map(id => ({ id, name: entityMap[id].name, depth: depthOf(id) }));
    const maxDepth = Math.max(...depths.map(d => d.depth), 0);

    // Critical path: entities with maximum dependency depth
    const criticalPath = depths.filter(d => d.depth === maxDepth);

    return {
      ok: true,
      result: {
        migrationOrder: sorted.map((id, i) => ({ order: i + 1, id, name: entityMap[id].name, size: entityMap[id].size, dependencyDepth: depthOf(id) })),
        plan,
        summary: {
          totalEntities: entities.length,
          totalSize,
          totalBatches,
          totalCheckpoints,
          totalPhases: phase - 1,
          batchSizeLimit,
          maxDependencyDepth: maxDepth,
        },
        criticalPath: criticalPath.map(d => d.name),
        circularDependencies: circularDeps.length > 0 ? { detected: true, entities: circularDeps } : { detected: false },
        estimatedSteps: plan.length,
      },
    };
  });
}
