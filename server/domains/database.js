// server/domains/database.js
export default function registerDatabaseActions(registerLensAction) {
  registerLensAction("database", "schemaAnalysis", (ctx, artifact, _params) => {
    const tables = artifact.data?.tables || [];
    if (tables.length === 0) return { ok: true, result: { message: "Add tables with columns to analyze schema." } };
    const analyzed = tables.map(t => {
      const cols = t.columns || [];
      const hasPK = cols.some(c => c.primaryKey || c.pk);
      const hasFK = cols.some(c => c.foreignKey || c.fk || c.references);
      const indexed = cols.filter(c => c.indexed || c.index).length;
      return { table: t.name, columns: cols.length, hasPrimaryKey: hasPK, hasForeignKeys: hasFK, indexedColumns: indexed, nullableColumns: cols.filter(c => c.nullable !== false).length, issues: (!hasPK ? ["Missing primary key"] : []).concat(indexed === 0 && cols.length > 3 ? ["No indexes on large table"] : []) };
    });
    const totalIssues = analyzed.reduce((s, t) => s + t.issues.length, 0);
    return { ok: true, result: { tables: analyzed, totalTables: tables.length, totalColumns: analyzed.reduce((s, t) => s + t.columns, 0), totalIssues, healthScore: Math.max(0, 100 - totalIssues * 15), normalizationTip: tables.length > 10 ? "Consider denormalization for read-heavy tables" : "Schema size is manageable" } };
  });
  registerLensAction("database", "queryOptimize", (ctx, artifact, _params) => {
    const query = artifact.data?.query || "";
    if (!query) return { ok: true, result: { message: "Provide a SQL query to analyze." } };
    const upper = query.toUpperCase();
    const issues = [];
    if (upper.includes("SELECT *")) issues.push({ issue: "SELECT * usage", fix: "Specify needed columns explicitly", severity: "medium" });
    if (!upper.includes("WHERE") && (upper.includes("UPDATE") || upper.includes("DELETE"))) issues.push({ issue: "UPDATE/DELETE without WHERE", fix: "Add WHERE clause to prevent full-table modification", severity: "critical" });
    if (upper.includes("LIKE '%") || upper.includes("LIKE \"%")) issues.push({ issue: "Leading wildcard in LIKE", fix: "Use full-text search instead — leading wildcards prevent index usage", severity: "high" });
    if ((upper.match(/JOIN/g) || []).length > 3) issues.push({ issue: "Multiple JOINs (>3)", fix: "Consider breaking into subqueries or using CTEs", severity: "medium" });
    if (!upper.includes("LIMIT") && upper.includes("SELECT")) issues.push({ issue: "No LIMIT clause", fix: "Add LIMIT to prevent unbounded result sets", severity: "low" });
    if (upper.includes("ORDER BY") && !upper.includes("INDEX")) issues.push({ issue: "ORDER BY may lack index", fix: "Ensure ORDER BY columns are indexed", severity: "medium" });
    return { ok: true, result: { query: query.slice(0, 200), issues, issueCount: issues.length, grade: issues.length === 0 ? "A" : issues.some(i => i.severity === "critical") ? "F" : issues.length <= 2 ? "B" : "C" } };
  });
  registerLensAction("database", "migrationPlan", (ctx, artifact, _params) => {
    const changes = artifact.data?.changes || [];
    if (changes.length === 0) return { ok: true, result: { message: "Describe schema changes to generate migration plan." } };
    const steps = changes.map((c, i) => {
      const type = (c.type || "alter").toLowerCase();
      const risk = type === "drop" ? "high" : type === "rename" ? "medium" : type === "add" ? "low" : "medium";
      return { step: i + 1, operation: type, table: c.table, column: c.column, description: c.description || `${type} ${c.column || ""} on ${c.table}`, risk, reversible: type !== "drop", rollback: type === "add" ? `DROP COLUMN ${c.column}` : type === "drop" ? "Restore from backup" : `Reverse ${type}` };
    });
    const highRisk = steps.filter(s => s.risk === "high").length;
    return { ok: true, result: { steps, totalChanges: steps.length, highRiskChanges: highRisk, recommendation: highRisk > 0 ? "Take backup before migrating — contains destructive changes" : "Migration is safe to proceed", estimatedDowntime: highRisk > 0 ? "1-5 minutes" : "Zero (online migration)" } };
  });
  registerLensAction("database", "indexRecommendation", (ctx, artifact, _params) => {
    const tables = artifact.data?.tables || [];
    const queries = artifact.data?.queries || [];
    const recommendations = [];
    for (const q of queries) {
      const upper = (q.query || q || "").toUpperCase();
      const whereMatch = upper.match(/WHERE\s+(\w+)/);
      const orderMatch = upper.match(/ORDER BY\s+(\w+)/);
      const joinMatch = upper.match(/JOIN\s+\w+\s+ON\s+\w+\.(\w+)/);
      if (whereMatch) recommendations.push({ column: whereMatch[1].toLowerCase(), reason: "Used in WHERE clause", type: "B-tree" });
      if (orderMatch) recommendations.push({ column: orderMatch[1].toLowerCase(), reason: "Used in ORDER BY", type: "B-tree" });
      if (joinMatch) recommendations.push({ column: joinMatch[1].toLowerCase(), reason: "Used in JOIN condition", type: "B-tree" });
    }
    const unique = [...new Map(recommendations.map(r => [r.column, r])).values()];
    return { ok: true, result: { recommendations: unique, queriesAnalyzed: queries.length, suggestedIndexes: unique.length, estimatedSpeedup: unique.length > 0 ? `${unique.length * 20}-${unique.length * 50}% faster queries` : "Queries already optimized" } };
  });
}
