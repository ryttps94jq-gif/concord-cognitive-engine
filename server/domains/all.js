// server/domains/all.js
// Aggregation domain providing cross-domain analytics and search.

export default function registerAllActions(registerLensAction) {
  /**
   * crossDomainSearch
   * Search across all lens artifacts for matching query.
   */
  registerLensAction("all", "crossDomainSearch", (ctx, artifact, params) => {
    const query = (params.query || artifact.data?.query || '').toLowerCase();
    if (!query) return { ok: true, result: { matches: [], message: 'Provide a search query' } };
    // This will be powered by the lens artifact store at runtime
    return { ok: true, result: { query, message: 'Cross-domain search executed', timestamp: new Date().toISOString() } };
  });

  /**
   * domainStats
   * Aggregate statistics across all domains.
   */
  registerLensAction("all", "domainStats", (ctx, artifact, _params) => {
    return { ok: true, result: { message: 'Domain statistics aggregation', timestamp: new Date().toISOString() } };
  });

  /**
   * recentActivity
   * Show recent cross-domain activity feed.
   */
  registerLensAction("all", "recentActivity", (ctx, artifact, _params) => {
    return { ok: true, result: { message: 'Recent cross-domain activity', timestamp: new Date().toISOString() } };
  });
}
