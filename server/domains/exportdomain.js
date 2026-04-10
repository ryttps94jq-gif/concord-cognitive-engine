// server/domains/exportdomain.js
export default function registerExportActions(registerLensAction) {
  registerLensAction("export", "generatePackage", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const items = data.items || [];
    const format = (data.format || "json").toLowerCase();
    const formats = { json: { mime: "application/json", ext: ".json" }, csv: { mime: "text/csv", ext: ".csv" }, xml: { mime: "application/xml", ext: ".xml" }, pdf: { mime: "application/pdf", ext: ".pdf" }, zip: { mime: "application/zip", ext: ".zip" } };
    const fmt = formats[format] || formats.json;
    const estimatedSize = items.length * (format === "json" ? 500 : format === "csv" ? 100 : 800);
    return { ok: true, result: { format, mimeType: fmt.mime, extension: fmt.ext, itemCount: items.length, estimatedSizeBytes: estimatedSize, estimatedSizeHuman: estimatedSize > 1048576 ? `${Math.round(estimatedSize / 1048576 * 10) / 10} MB` : `${Math.round(estimatedSize / 1024 * 10) / 10} KB`, status: "ready", includes: { metadata: true, timestamps: true, relationships: data.includeRelationships !== false } } };
  });
  registerLensAction("export", "validateExport", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const items = data.items || [];
    const schema = data.schema || {};
    const errors = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.id && !item.title) errors.push({ index: i, error: "Missing id or title" });
      if (schema.requiredFields) for (const f of schema.requiredFields) { if (!item[f] && !item.data?.[f]) errors.push({ index: i, error: `Missing required field: ${f}` }); }
    }
    return { ok: true, result: { totalItems: items.length, valid: items.length - errors.length, invalid: errors.length, errors: errors.slice(0, 20), exportReady: errors.length === 0 } };
  });
  registerLensAction("export", "scheduleExport", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const frequency = data.frequency || "daily";
    const destination = data.destination || "local";
    return { ok: true, result: { schedule: { frequency, destination, format: data.format || "json", filters: data.filters || {}, lastRun: data.lastRun || null, nextRun: frequency === "daily" ? "Tomorrow at midnight" : frequency === "weekly" ? "Next Monday" : frequency === "monthly" ? "1st of next month" : "On demand" }, status: "configured" } };
  });
  registerLensAction("export", "diffExport", (ctx, artifact, _params) => {
    const current = artifact.data?.current || [];
    const previous = artifact.data?.previous || [];
    const currentIds = new Set(current.map(i => i.id));
    const previousIds = new Set(previous.map(i => i.id));
    const added = current.filter(i => !previousIds.has(i.id)).length;
    const removed = previous.filter(i => !currentIds.has(i.id)).length;
    const modified = current.filter(i => previousIds.has(i.id)).length;
    return { ok: true, result: { added, removed, modified, unchanged: current.length - added - modified, totalCurrent: current.length, totalPrevious: previous.length, changePercent: previous.length > 0 ? Math.round(((added + removed) / previous.length) * 100) : 100 } };
  });
}
