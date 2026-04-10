// server/domains/ingest.js
export default function registerIngestActions(registerLensAction) {
  registerLensAction("ingest", "parseDocument", (ctx, artifact, _params) => {
    const text = artifact.data?.text || artifact.data?.content || "";
    if (!text) return { ok: true, result: { message: "Provide text or content to parse." } };
    const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(Boolean);
    const lines = text.split("\n");
    const sections = lines.filter(l => /^#{1,6}\s/.test(l) || /^[A-Z][A-Z\s]{3,}$/.test(l.trim()));
    const hasMarkdown = /[#*_`\[\]]/.test(text);
    const hasHtml = /<\/?[a-z][\s\S]*>/i.test(text);
    const format = hasHtml ? "html" : hasMarkdown ? "markdown" : "plaintext";
    return { ok: true, result: { format, lineCount: lines.length, paragraphCount: paragraphs.length, sentenceCount: sentences.length, wordCount: words.length, sectionCount: sections.length, sections: sections.slice(0, 20), avgWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0, avgWordsPerParagraph: paragraphs.length > 0 ? Math.round(words.length / paragraphs.length) : 0 } };
  });

  registerLensAction("ingest", "extractEntities", (ctx, artifact, _params) => {
    const text = artifact.data?.text || artifact.data?.content || "";
    if (!text) return { ok: true, result: { message: "Provide text to extract entities from." } };
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const dateRegex = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi;
    const numberRegex = /\$[\d,.]+|\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b/g;
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const emails = [...new Set(text.match(emailRegex) || [])];
    const urls = [...new Set(text.match(urlRegex) || [])];
    const dates = [...new Set(text.match(dateRegex) || [])];
    const numbers = [...new Set((text.match(numberRegex) || []).filter(n => n.length > 1))].slice(0, 50);
    const phones = [...new Set(text.match(phoneRegex) || [])];
    return { ok: true, result: { emails, urls, dates, phones, numbers: numbers.slice(0, 30), summary: { emailCount: emails.length, urlCount: urls.length, dateCount: dates.length, phoneCount: phones.length, numberCount: numbers.length } } };
  });

  registerLensAction("ingest", "validateSchema", (ctx, artifact, _params) => {
    const data = artifact.data?.records || artifact.data?.rows || [];
    const schema = artifact.data?.schema || artifact.data?.expectedFields || [];
    if (data.length === 0) return { ok: true, result: { message: "Provide records/rows and a schema to validate against." } };
    if (schema.length === 0) {
      const allKeys = new Set();
      data.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
      return { ok: true, result: { message: "No schema provided. Detected fields from data:", detectedFields: [...allKeys], recordCount: data.length } };
    }
    const expectedKeys = schema.map(s => typeof s === "string" ? s : s.field || s.name);
    const results = data.map((record, i) => {
      const recordKeys = Object.keys(record);
      const missing = expectedKeys.filter(k => !(k in record));
      const extra = recordKeys.filter(k => !expectedKeys.includes(k));
      const nullFields = expectedKeys.filter(k => record[k] === null || record[k] === undefined || record[k] === "");
      return { row: i, valid: missing.length === 0 && nullFields.length === 0, missingFields: missing, extraFields: extra, nullFields };
    });
    const validCount = results.filter(r => r.valid).length;
    return { ok: true, result: { totalRecords: data.length, validRecords: validCount, invalidRecords: data.length - validCount, validationRate: Math.round((validCount / data.length) * 100), issues: results.filter(r => !r.valid).slice(0, 20) } };
  });

  registerLensAction("ingest", "batchStatus", (ctx, artifact, _params) => {
    const items = artifact.data?.items || artifact.data?.batch || [];
    if (items.length === 0) return { ok: true, result: { message: "Provide batch items with status fields to summarize." } };
    const statusCounts = {};
    const errors = [];
    items.forEach((item, i) => {
      const status = (item.status || "unknown").toLowerCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (status === "error" || status === "failed") errors.push({ index: i, id: item.id || `item-${i}`, error: item.error || item.message || "Unknown error" });
    });
    const completed = (statusCounts.completed || 0) + (statusCounts.done || 0) + (statusCounts.success || 0);
    const pending = (statusCounts.pending || 0) + (statusCounts.queued || 0) + (statusCounts.waiting || 0);
    const failed = (statusCounts.error || 0) + (statusCounts.failed || 0);
    const inProgress = (statusCounts.processing || 0) + (statusCounts["in-progress"] || 0) + (statusCounts.running || 0);
    return { ok: true, result: { totalItems: items.length, completed, pending, inProgress, failed, completionRate: Math.round((completed / items.length) * 100), statusBreakdown: statusCounts, recentErrors: errors.slice(0, 10), estimatedRemaining: pending + inProgress } };
  });
}
