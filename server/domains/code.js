// server/domains/code.js
// Domain actions for software development: complexity analysis, dependency
// auditing, test coverage computation, and change-risk assessment.

export default function registerCodeActions(registerLensAction) {
  /**
   * complexityAnalysis
   * Compute cyclomatic complexity, cognitive complexity, and maintainability
   * index from artifact.data.modules:
   * [{ name, lines, functions, branches, loops, nestingDepth, dependencies? }]
   */
  registerLensAction("code", "complexityAnalysis", (ctx, artifact, _params) => {
    const modules = artifact.data?.modules || [];
    if (modules.length === 0) {
      return { ok: true, result: { modules: [], message: "No modules to analyze." } };
    }

    const analyzed = modules.map(mod => {
      const lines = mod.lines || 0;
      const functions = mod.functions || 0;
      const branches = mod.branches || 0;
      const loops = mod.loops || 0;
      const depth = mod.nestingDepth || 0;

      // Cyclomatic complexity: edges - nodes + 2p, approximated from branches/loops
      const cyclomaticComplexity = 1 + branches + loops;

      // Cognitive complexity: branches + loops + nesting penalty
      // Deep nesting compounds cognitive load
      const nestingPenalty = depth > 0 ? (depth * (depth + 1)) / 2 : 0;
      const cognitiveComplexity = branches + loops * 2 + nestingPenalty;

      // Halstead volume approximation from line count and operators
      const operatorEstimate = branches + loops + functions;
      const operandEstimate = Math.max(1, lines - operatorEstimate);
      const vocabulary = operatorEstimate + operandEstimate;
      const length = lines;
      const volume = vocabulary > 0 ? Math.round(length * Math.log2(Math.max(vocabulary, 2))) : 0;

      // Maintainability index: MI = 171 - 5.2*ln(V) - 0.23*CC - 16.2*ln(LOC)
      const mi = Math.max(0, Math.min(100, Math.round(
        171
        - 5.2 * Math.log(Math.max(volume, 1))
        - 0.23 * cyclomaticComplexity
        - 16.2 * Math.log(Math.max(lines, 1))
      )));

      const rating = mi >= 80 ? "A" : mi >= 60 ? "B" : mi >= 40 ? "C" : mi >= 20 ? "D" : "F";

      return {
        name: mod.name,
        lines, functions, branches, loops, nestingDepth: depth,
        cyclomaticComplexity, cognitiveComplexity,
        halsteadVolume: volume,
        maintainabilityIndex: mi,
        rating,
      };
    });

    // Aggregate
    const totalLines = analyzed.reduce((s, m) => s + m.lines, 0);
    const avgMI = Math.round(analyzed.reduce((s, m) => s + m.maintainabilityIndex, 0) / analyzed.length);
    const hotspots = analyzed.filter(m => m.cyclomaticComplexity > 10 || m.cognitiveComplexity > 15)
      .sort((a, b) => b.cognitiveComplexity - a.cognitiveComplexity);

    artifact.data.lastComplexityAnalysis = { timestamp: new Date().toISOString(), avgMI, hotspotCount: hotspots.length };

    return {
      ok: true, result: {
        modules: analyzed, totalModules: modules.length, totalLines,
        averageMaintainability: avgMI,
        overallRating: avgMI >= 80 ? "A" : avgMI >= 60 ? "B" : avgMI >= 40 ? "C" : avgMI >= 20 ? "D" : "F",
        hotspots: hotspots.slice(0, 10),
      },
    };
  });

  /**
   * dependencyAudit
   * Analyze dependency tree for security risks, version staleness, and
   * circular references.
   * artifact.data.dependencies = [{ name, version, latest?, license?, direct?, dependencies?: string[] }]
   */
  registerLensAction("code", "dependencyAudit", (ctx, artifact, _params) => {
    const deps = artifact.data?.dependencies || [];
    if (deps.length === 0) {
      return { ok: true, result: { dependencies: [], message: "No dependencies to audit." } };
    }

    const riskyLicenses = new Set(["GPL-3.0", "AGPL-3.0", "SSPL-1.0", "EUPL-1.2"]);
    const permissiveLicenses = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense"]);

    const audited = deps.map(dep => {
      const issues = [];

      // Version staleness check
      if (dep.version && dep.latest) {
        const [curMajor, curMinor] = dep.version.replace(/^[^0-9]*/, "").split(".").map(Number);
        const [latMajor, latMinor] = dep.latest.replace(/^[^0-9]*/, "").split(".").map(Number);
        if (latMajor > curMajor) {
          issues.push({ type: "major_version_behind", current: dep.version, latest: dep.latest, severity: "high" });
        } else if (latMinor > curMinor + 5) {
          issues.push({ type: "significantly_outdated", current: dep.version, latest: dep.latest, severity: "moderate" });
        }
      }

      // License risk
      const license = dep.license || "unknown";
      if (riskyLicenses.has(license)) {
        issues.push({ type: "copyleft_license", license, severity: "high" });
      } else if (!permissiveLicenses.has(license) && license !== "unknown") {
        issues.push({ type: "uncommon_license", license, severity: "low" });
      } else if (license === "unknown") {
        issues.push({ type: "unknown_license", severity: "moderate" });
      }

      return {
        name: dep.name, version: dep.version, latest: dep.latest,
        license, direct: dep.direct !== false,
        issues, riskLevel: issues.some(i => i.severity === "high") ? "high"
          : issues.some(i => i.severity === "moderate") ? "moderate" : "low",
      };
    });

    // Circular dependency detection
    const depMap = {};
    for (const dep of deps) {
      depMap[dep.name] = dep.dependencies || [];
    }
    const circulars = [];
    for (const name of Object.keys(depMap)) {
      const stack = [name];
      const visited = new Set();
      const queue = [...(depMap[name] || [])];
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === name) {
          circulars.push({ from: name, cycle: [...stack, current] });
          break;
        }
        if (visited.has(current)) continue;
        visited.add(current);
        stack.push(current);
        for (const child of (depMap[current] || [])) queue.push(child);
      }
    }

    const directCount = audited.filter(d => d.direct).length;
    const transitiveCount = audited.length - directCount;
    const highRisk = audited.filter(d => d.riskLevel === "high");

    return {
      ok: true, result: {
        dependencies: audited, totalDependencies: deps.length,
        directCount, transitiveCount,
        highRisk: highRisk.map(d => ({ name: d.name, issues: d.issues })),
        circularDependencies: circulars.slice(0, 5),
        licenseSummary: {
          permissive: audited.filter(d => permissiveLicenses.has(d.license)).length,
          copyleft: audited.filter(d => riskyLicenses.has(d.license)).length,
          unknown: audited.filter(d => d.license === "unknown").length,
        },
      },
    };
  });

  /**
   * coverageAnalysis
   * Compute test coverage metrics and identify coverage gaps.
   * artifact.data.coverage = [{ file, statements, branches, functions,
   *   statementsHit, branchesHit, functionsHit, uncoveredLines?: number[] }]
   */
  registerLensAction("code", "coverageAnalysis", (ctx, artifact, _params) => {
    const coverage = artifact.data?.coverage || [];
    if (coverage.length === 0) {
      return { ok: true, result: { files: [], message: "No coverage data available." } };
    }

    const analyzed = coverage.map(f => {
      const stmtCov = f.statements > 0 ? f.statementsHit / f.statements : 0;
      const branchCov = f.branches > 0 ? f.branchesHit / f.branches : 0;
      const fnCov = f.functions > 0 ? f.functionsHit / f.functions : 0;
      // Combined score weighted: statements 50%, branches 30%, functions 20%
      const combined = stmtCov * 0.5 + branchCov * 0.3 + fnCov * 0.2;

      return {
        file: f.file,
        statementCoverage: Math.round(stmtCov * 10000) / 100,
        branchCoverage: Math.round(branchCov * 10000) / 100,
        functionCoverage: Math.round(fnCov * 10000) / 100,
        combinedScore: Math.round(combined * 10000) / 100,
        uncoveredLines: f.uncoveredLines || [],
        risk: combined < 0.5 ? "high" : combined < 0.8 ? "moderate" : "low",
      };
    });

    // Aggregate metrics
    const totalStatements = coverage.reduce((s, f) => s + (f.statements || 0), 0);
    const totalHit = coverage.reduce((s, f) => s + (f.statementsHit || 0), 0);
    const totalBranches = coverage.reduce((s, f) => s + (f.branches || 0), 0);
    const totalBranchesHit = coverage.reduce((s, f) => s + (f.branchesHit || 0), 0);
    const overallStatement = totalStatements > 0 ? Math.round((totalHit / totalStatements) * 10000) / 100 : 0;
    const overallBranch = totalBranches > 0 ? Math.round((totalBranchesHit / totalBranches) * 10000) / 100 : 0;

    const gaps = analyzed.filter(f => f.risk === "high").sort((a, b) => a.combinedScore - b.combinedScore);

    return {
      ok: true, result: {
        files: analyzed,
        overall: { statementCoverage: overallStatement, branchCoverage: overallBranch, totalFiles: coverage.length },
        gaps: gaps.slice(0, 10),
        meetsThreshold80: overallStatement >= 80,
      },
    };
  });

  /**
   * changeRiskAssessment
   * Score the risk of a proposed changeset based on file history,
   * complexity, ownership, and test coverage.
   * artifact.data.changes = [{ file, linesAdded, linesRemoved, recentBugCount?,
   *   lastModified?, authors?, hasCoverage? }]
   */
  registerLensAction("code", "changeRiskAssessment", (ctx, artifact, _params) => {
    const changes = artifact.data?.changes || [];
    if (changes.length === 0) {
      return { ok: true, result: { files: [], overallRisk: "low", message: "No changes to assess." } };
    }

    const assessed = changes.map(ch => {
      let riskScore = 0;
      const factors = [];

      // Size risk: large changes are riskier
      const churn = (ch.linesAdded || 0) + (ch.linesRemoved || 0);
      if (churn > 500) { riskScore += 3; factors.push("very_large_change"); }
      else if (churn > 200) { riskScore += 2; factors.push("large_change"); }
      else if (churn > 50) { riskScore += 1; factors.push("moderate_change"); }

      // Bug history: files with recent bugs are riskier
      const bugCount = ch.recentBugCount || 0;
      if (bugCount > 5) { riskScore += 3; factors.push("high_bug_history"); }
      else if (bugCount > 2) { riskScore += 2; factors.push("some_bug_history"); }

      // Multiple authors = diffused ownership risk
      const authorCount = (ch.authors || []).length;
      if (authorCount > 5) { riskScore += 2; factors.push("many_authors"); }
      else if (authorCount > 3) { riskScore += 1; factors.push("shared_ownership"); }

      // No test coverage = higher risk
      if (ch.hasCoverage === false) { riskScore += 2; factors.push("no_test_coverage"); }

      // Recently modified files have more context risk
      if (ch.lastModified) {
        const daysSince = (Date.now() - new Date(ch.lastModified).getTime()) / 86400000;
        if (daysSince < 7) { riskScore += 1; factors.push("recently_modified"); }
      }

      const level = riskScore >= 6 ? "critical" : riskScore >= 4 ? "high" : riskScore >= 2 ? "moderate" : "low";

      return { file: ch.file, churn, riskScore, riskLevel: level, factors };
    });

    assessed.sort((a, b) => b.riskScore - a.riskScore);
    const avgRisk = assessed.reduce((s, a) => s + a.riskScore, 0) / assessed.length;
    const overallRisk = avgRisk >= 5 ? "critical" : avgRisk >= 3 ? "high" : avgRisk >= 1.5 ? "moderate" : "low";

    return {
      ok: true, result: {
        files: assessed, totalFiles: changes.length,
        totalChurn: changes.reduce((s, c) => s + (c.linesAdded || 0) + (c.linesRemoved || 0), 0),
        overallRisk, averageRiskScore: Math.round(avgRisk * 100) / 100,
        criticalFiles: assessed.filter(a => a.riskLevel === "critical").map(a => a.file),
        recommendations: [
          ...assessed.filter(a => a.factors.includes("no_test_coverage")).length > 0 ? ["Add tests for uncovered files before merging"] : [],
          ...assessed.filter(a => a.factors.includes("high_bug_history")).length > 0 ? ["Extra review recommended for bug-prone files"] : [],
          ...assessed.some(a => a.churn > 500) ? ["Consider splitting large changes into smaller PRs"] : [],
        ],
      },
    };
  });
}
