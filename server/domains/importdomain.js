// server/domains/importdomain.js
// Domain actions for import: validate imports, map fields, detect duplicates, transform preview.
// File named importdomain.js to avoid JS keyword conflict; domain registered as "import".

export default function registerImportActions(registerLensAction) {
  /**
   * validateImport
   * Check required fields, data types, and detect malformed rows.
   * artifact.data.rows: [{ ... }]
   * artifact.data.schema: { fieldName: { type: "string"|"number"|"boolean"|"date", required?: boolean } }
   */
  registerLensAction("import", "validateImport", (ctx, artifact, _params) => {
    const rows = artifact.data?.rows || [];
    const schema = artifact.data?.schema || {};

    if (rows.length === 0) {
      return { ok: true, result: { message: "No rows provided. Supply artifact.data.rows as an array of objects and artifact.data.schema as { fieldName: { type, required? } }.", valid: 0, invalid: 0, errors: [] } };
    }

    const schemaFields = Object.keys(schema);
    const requiredFields = schemaFields.filter((f) => schema[f].required);

    // Type checking helpers
    function checkType(value, expectedType) {
      if (value === null || value === undefined || value === "") return { valid: false, reason: "empty" };
      switch (expectedType) {
        case "string":
          return { valid: typeof value === "string" || typeof value === "number", reason: typeof value !== "string" && typeof value !== "number" ? `expected string, got ${typeof value}` : null };
        case "number": {
          const num = Number(value);
          return { valid: !isNaN(num) && value !== "" && value !== null, reason: isNaN(Number(value)) ? `"${value}" is not a valid number` : null };
        }
        case "boolean": {
          const boolVals = new Set(["true", "false", "1", "0", "yes", "no"]);
          const isValid = typeof value === "boolean" || boolVals.has(String(value).toLowerCase());
          return { valid: isValid, reason: isValid ? null : `"${value}" is not a valid boolean` };
        }
        case "date": {
          const d = new Date(value);
          const isValid = !isNaN(d.getTime()) && String(value).trim().length > 0;
          return { valid: isValid, reason: isValid ? null : `"${value}" is not a valid date` };
        }
        default:
          return { valid: true, reason: null };
      }
    }

    let validCount = 0;
    let invalidCount = 0;
    const allErrors = [];
    const fieldErrorCounts = {};
    const rowsChecked = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors = [];

      // Check if row is actually an object
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        rowErrors.push({ field: "_row", error: "Row is not a valid object", value: row });
        invalidCount++;
        allErrors.push({ rowIndex: i, errors: rowErrors });
        continue;
      }

      // Check required fields
      for (const field of requiredFields) {
        if (row[field] === undefined || row[field] === null || row[field] === "") {
          rowErrors.push({ field, error: "required field missing", value: row[field] ?? null });
          fieldErrorCounts[field] = (fieldErrorCounts[field] || 0) + 1;
        }
      }

      // Check types for all schema fields present
      for (const field of schemaFields) {
        if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
          const typeCheck = checkType(row[field], schema[field].type);
          if (!typeCheck.valid && typeCheck.reason !== "empty") {
            rowErrors.push({ field, error: `type mismatch: ${typeCheck.reason}`, value: row[field] });
            fieldErrorCounts[field] = (fieldErrorCounts[field] || 0) + 1;
          }
        }
      }

      // Detect extra fields not in schema
      if (schemaFields.length > 0) {
        for (const key of Object.keys(row)) {
          if (!schema[key]) {
            rowErrors.push({ field: key, error: "unexpected field not in schema", value: row[key] });
          }
        }
      }

      if (rowErrors.length > 0) {
        invalidCount++;
        allErrors.push({ rowIndex: i, errors: rowErrors });
      } else {
        validCount++;
      }

      rowsChecked.push({
        rowIndex: i,
        isValid: rowErrors.length === 0,
        errorCount: rowErrors.length,
      });
    }

    // Summary of field-level issues
    const fieldSummary = Object.entries(fieldErrorCounts)
      .map(([field, count]) => ({
        field,
        errorCount: count,
        errorRate: Math.round((count / rows.length) * 10000) / 100,
      }))
      .sort((a, b) => b.errorCount - a.errorCount);

    const validationRate = Math.round((validCount / rows.length) * 10000) / 100;

    const result = {
      totalRows: rows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      validationRate,
      status: invalidCount === 0 ? "pass" : invalidCount / rows.length < 0.1 ? "warning" : "fail",
      fieldSummary,
      errors: allErrors.slice(0, 50),
      errorsTruncated: allErrors.length > 50,
      totalErrorCount: allErrors.reduce((s, e) => s + e.errors.length, 0),
    };

    artifact.data.validationResult = result;
    return { ok: true, result };
  });

  /**
   * mapFields
   * Suggest source-to-target field mappings using name similarity.
   * artifact.data.sourceFields: [string]
   * artifact.data.targetFields: [string]
   */
  registerLensAction("import", "mapFields", (ctx, artifact, _params) => {
    const sourceFields = artifact.data?.sourceFields || [];
    const targetFields = artifact.data?.targetFields || [];

    if (sourceFields.length === 0 || targetFields.length === 0) {
      return { ok: true, result: { message: "Provide artifact.data.sourceFields and artifact.data.targetFields as arrays of field name strings.", mappings: [], unmapped: [] } };
    }

    // Normalize a field name for comparison
    function normalize(name) {
      return String(name)
        .toLowerCase()
        .replace(/[_\-\s.]+/g, "")
        .replace(/[^a-z0-9]/g, "");
    }

    // Tokenize a field name into words
    function tokenize(name) {
      return String(name)
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(/[_\-\s.]+/)
        .filter((t) => t.length > 0);
    }

    // Levenshtein distance
    function levenshtein(a, b) {
      const m = a.length;
      const n = b.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
        }
      }
      return dp[m][n];
    }

    // Compute similarity score between two field names (0-1)
    function similarity(source, target) {
      const normS = normalize(source);
      const normT = normalize(target);

      // Exact match after normalization
      if (normS === normT) return 1.0;

      // Prefix/suffix match
      const prefixLen = Math.min(normS.length, normT.length);
      let prefixMatch = 0;
      for (let i = 0; i < prefixLen; i++) {
        if (normS[i] === normT[i]) prefixMatch++;
        else break;
      }
      const prefixScore = prefixMatch / Math.max(normS.length, normT.length, 1);

      // Containment
      const containsScore = normS.includes(normT) || normT.includes(normS) ? 0.7 : 0;

      // Levenshtein similarity
      const maxLen = Math.max(normS.length, normT.length, 1);
      const editDist = levenshtein(normS, normT);
      const editScore = 1 - editDist / maxLen;

      // Token overlap (Jaccard-like)
      const tokensS = new Set(tokenize(source));
      const tokensT = new Set(tokenize(target));
      let tokenOverlap = 0;
      for (const t of tokensS) {
        if (tokensT.has(t)) tokenOverlap++;
      }
      const tokenUnion = new Set([...tokensS, ...tokensT]).size;
      const tokenScore = tokenUnion > 0 ? tokenOverlap / tokenUnion : 0;

      // Weighted combination
      return Math.round(Math.max(
        editScore * 0.4 + tokenScore * 0.3 + prefixScore * 0.2 + containsScore * 0.1,
        containsScore,
        tokenScore
      ) * 10000) / 10000;
    }

    // Compute all pairwise similarities
    const scoreboard = [];
    for (const src of sourceFields) {
      for (const tgt of targetFields) {
        const score = similarity(src, tgt);
        scoreboard.push({ source: src, target: tgt, score });
      }
    }
    scoreboard.sort((a, b) => b.score - a.score);

    // Greedy assignment: pick best score, remove both source and target, repeat
    const usedSources = new Set();
    const usedTargets = new Set();
    const mappings = [];

    for (const entry of scoreboard) {
      if (usedSources.has(entry.source) || usedTargets.has(entry.target)) continue;
      if (entry.score < 0.2) continue; // threshold for minimum acceptable similarity
      mappings.push({
        source: entry.source,
        target: entry.target,
        confidence: entry.score,
        confidenceLabel: entry.score >= 0.9 ? "exact" : entry.score >= 0.7 ? "high" : entry.score >= 0.5 ? "medium" : "low",
      });
      usedSources.add(entry.source);
      usedTargets.add(entry.target);
    }

    const unmappedSources = sourceFields.filter((f) => !usedSources.has(f));
    const unmappedTargets = targetFields.filter((f) => !usedTargets.has(f));

    // For unmapped sources, show best partial matches
    const suggestions = unmappedSources.map((src) => {
      const best = scoreboard
        .filter((s) => s.source === src && !usedTargets.has(s.target))
        .slice(0, 3)
        .map((s) => ({ target: s.target, score: s.score }));
      return { source: src, possibleTargets: best };
    });

    const result = {
      mappingCount: mappings.length,
      mappings,
      unmappedSources,
      unmappedTargets,
      suggestions,
      coverage: {
        sourcesCovered: Math.round((usedSources.size / sourceFields.length) * 10000) / 100,
        targetsCovered: Math.round((usedTargets.size / targetFields.length) * 10000) / 100,
      },
      averageConfidence: mappings.length > 0
        ? Math.round((mappings.reduce((s, m) => s + m.confidence, 0) / mappings.length) * 10000) / 10000
        : 0,
    };

    artifact.data.fieldMappings = result;
    return { ok: true, result };
  });

  /**
   * detectDuplicates
   * Find duplicate rows by key fields using hash comparison.
   * artifact.data.rows: [{ ... }]
   * artifact.data.keyFields: [string] (fields to compare for uniqueness)
   * artifact.data.fuzzy: boolean (optional, use normalized comparison)
   */
  registerLensAction("import", "detectDuplicates", (ctx, artifact, _params) => {
    const rows = artifact.data?.rows || [];
    const keyFields = artifact.data?.keyFields || [];
    const fuzzy = artifact.data?.fuzzy || false;

    if (rows.length === 0) {
      return { ok: true, result: { message: "No rows provided. Supply artifact.data.rows and artifact.data.keyFields (array of field names to check for uniqueness).", duplicates: [], uniqueCount: 0 } };
    }

    // If no key fields specified, use all fields from the first row
    const effectiveKeys = keyFields.length > 0 ? keyFields : Object.keys(rows[0] || {});

    if (effectiveKeys.length === 0) {
      return { ok: true, result: { message: "No key fields could be determined. Supply artifact.data.keyFields.", duplicates: [], uniqueCount: 0 } };
    }

    // Build hash for each row
    function normalizeValue(val) {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (fuzzy) {
        return str.toLowerCase().trim().replace(/\s+/g, " ");
      }
      return str;
    }

    function hashRow(row) {
      return effectiveKeys.map((k) => normalizeValue(row[k])).join("|||");
    }

    // Group rows by hash
    const hashMap = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (typeof row !== "object" || row === null) continue;
      const hash = hashRow(row);
      if (!hashMap[hash]) hashMap[hash] = [];
      hashMap[hash].push(i);
    }

    // Find groups with more than one row
    const duplicateGroups = [];
    let duplicateRowCount = 0;
    let uniqueCount = 0;

    for (const [hash, indices] of Object.entries(hashMap)) {
      if (indices.length > 1) {
        const keyValues = {};
        for (const k of effectiveKeys) {
          keyValues[k] = rows[indices[0]][k];
        }
        duplicateGroups.push({
          keyValues,
          count: indices.length,
          rowIndices: indices,
          firstOccurrence: indices[0],
          duplicateIndices: indices.slice(1),
        });
        duplicateRowCount += indices.length - 1; // excess copies
      } else {
        uniqueCount++;
      }
    }

    // Sort by count descending
    duplicateGroups.sort((a, b) => b.count - a.count);

    // Field-level analysis: which fields have the most repeated values
    const fieldRepetition = effectiveKeys.map((field) => {
      const values = {};
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue;
        const val = normalizeValue(row[field]);
        values[val] = (values[val] || 0) + 1;
      }
      const uniqueValues = Object.keys(values).length;
      const maxRepeat = Math.max(0, ...Object.values(values));
      return {
        field,
        uniqueValues,
        uniquenessRatio: rows.length > 0 ? Math.round((uniqueValues / rows.length) * 10000) / 100 : 0,
        mostRepeatedCount: maxRepeat,
      };
    });

    const result = {
      totalRows: rows.length,
      uniqueRows: uniqueCount + duplicateGroups.length,
      duplicateGroupCount: duplicateGroups.length,
      duplicateRowCount,
      deduplicationSavings: rows.length > 0 ? Math.round((duplicateRowCount / rows.length) * 10000) / 100 : 0,
      keyFields: effectiveKeys,
      fuzzyMatching: fuzzy,
      duplicateGroups: duplicateGroups.slice(0, 50),
      groupsTruncated: duplicateGroups.length > 50,
      fieldRepetition,
    };

    artifact.data.duplicateDetection = result;
    return { ok: true, result };
  });

  /**
   * transformPreview
   * Show first N rows with applied transformations like type coercion, trimming.
   * artifact.data.rows: [{ ... }]
   * artifact.data.transforms: [{ field, operation, ... }]
   *   operations: "trim", "lowercase", "uppercase", "toNumber", "toDate", "replace", "default", "truncate"
   * artifact.data.previewCount: number (default 5)
   */
  registerLensAction("import", "transformPreview", (ctx, artifact, _params) => {
    const rows = artifact.data?.rows || [];
    const transforms = artifact.data?.transforms || [];
    const previewCount = Math.min(parseInt(artifact.data?.previewCount) || 5, rows.length);

    if (rows.length === 0) {
      return { ok: true, result: { message: "No rows provided. Supply artifact.data.rows and artifact.data.transforms as [{ field, operation, ... }].", preview: [], transformsApplied: 0 } };
    }

    if (transforms.length === 0) {
      return { ok: true, result: { message: "No transforms specified. Supply artifact.data.transforms as [{ field, operation }]. Supported: trim, lowercase, uppercase, toNumber, toDate, replace, default, truncate.", preview: rows.slice(0, previewCount), transformsApplied: 0 } };
    }

    // Apply transforms to each row
    let totalTransformations = 0;
    let errorCount = 0;
    const transformLog = [];

    function applyTransform(value, transform) {
      const op = transform.operation;
      try {
        switch (op) {
          case "trim":
            return typeof value === "string" ? value.trim() : value;
          case "lowercase":
            return typeof value === "string" ? value.toLowerCase() : value;
          case "uppercase":
            return typeof value === "string" ? value.toUpperCase() : value;
          case "toNumber": {
            if (value === null || value === undefined || value === "") return transform.defaultValue !== undefined ? transform.defaultValue : null;
            const num = Number(value);
            return isNaN(num) ? (transform.defaultValue !== undefined ? transform.defaultValue : value) : num;
          }
          case "toDate": {
            if (!value) return null;
            const d = new Date(value);
            return isNaN(d.getTime()) ? value : d.toISOString();
          }
          case "replace": {
            if (typeof value !== "string") return value;
            const pattern = transform.pattern || "";
            const replacement = transform.replacement || "";
            if (transform.regex) {
              return value.replace(new RegExp(pattern, "g"), replacement);
            }
            return value.split(pattern).join(replacement);
          }
          case "default":
            return (value === null || value === undefined || value === "") ? transform.defaultValue : value;
          case "truncate": {
            const maxLen = parseInt(transform.maxLength) || 100;
            return typeof value === "string" && value.length > maxLen ? value.slice(0, maxLen) + "..." : value;
          }
          default:
            return value;
        }
      } catch (err) {
        errorCount++;
        return value;
      }
    }

    const allTransformed = rows.map((row, rowIdx) => {
      if (typeof row !== "object" || row === null) return row;
      const transformed = { ...row };
      for (const transform of transforms) {
        const field = transform.field;
        if (field && transformed[field] !== undefined) {
          const before = transformed[field];
          transformed[field] = applyTransform(transformed[field], transform);
          if (before !== transformed[field]) {
            totalTransformations++;
            if (rowIdx < previewCount) {
              transformLog.push({
                rowIndex: rowIdx,
                field,
                operation: transform.operation,
                before,
                after: transformed[field],
              });
            }
          }
        } else if (field && transform.operation === "default" && (transformed[field] === undefined || transformed[field] === null || transformed[field] === "")) {
          transformed[field] = transform.defaultValue;
          totalTransformations++;
          if (rowIdx < previewCount) {
            transformLog.push({
              rowIndex: rowIdx,
              field,
              operation: "default",
              before: transformed[field],
              after: transform.defaultValue,
            });
          }
        }
      }
      return transformed;
    });

    // Compute diff summary: how many values changed per field
    const fieldChangeCounts = {};
    for (let i = 0; i < rows.length; i++) {
      const original = rows[i];
      const transformed = allTransformed[i];
      if (typeof original !== "object" || typeof transformed !== "object") continue;
      for (const key of Object.keys(transformed)) {
        if (original[key] !== transformed[key]) {
          fieldChangeCounts[key] = (fieldChangeCounts[key] || 0) + 1;
        }
      }
    }

    const fieldImpact = Object.entries(fieldChangeCounts).map(([field, count]) => ({
      field,
      changedRows: count,
      changeRate: Math.round((count / rows.length) * 10000) / 100,
    })).sort((a, b) => b.changedRows - a.changedRows);

    const result = {
      totalRows: rows.length,
      previewCount,
      preview: allTransformed.slice(0, previewCount),
      originalPreview: rows.slice(0, previewCount),
      transformsApplied: transforms.length,
      totalValueChanges: totalTransformations,
      transformErrors: errorCount,
      changeLog: transformLog,
      fieldImpact,
    };

    artifact.data.transformPreview = result;
    return { ok: true, result };
  });
}
