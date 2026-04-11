/**
 * Basic CRUD Lens Template
 *
 * Generates a domain handler with standard Create, Read, Update, Delete actions
 * plus list/search. Suitable for any entity-management lens.
 */

export const id = "basic-crud";
export const name = "Basic CRUD";
export const description = "Create, read, update, delete, list, and search operations for an entity-based lens.";
export const category = "data-management";
export const tags = ["crud", "entity", "data", "management", "list", "search"];

/**
 * Generate domain handler code for a CRUD lens.
 *
 * @param {object} config
 * @param {string} config.domain - Domain/lens ID (e.g. "inventory")
 * @param {string} config.entityName - Singular entity name (e.g. "Product")
 * @param {string[]} [config.fields] - Entity fields (default: id, name, description, status)
 * @param {boolean} [config.softDelete] - Use soft delete instead of hard delete (default true)
 * @returns {{ handler: string, page: string }}
 */
export function generate(config) {
  const domain = config.domain || "my-lens";
  const entity = config.entityName || "Item";
  const entityLower = entity.toLowerCase();
  const fields = config.fields || ["id", "name", "description", "status"];
  const softDelete = config.softDelete !== false;

  const fieldValidation = fields
    .filter(f => f !== "id")
    .map(f => `        if (!data.${f} && data.${f} !== 0) missing.push("${f}");`)
    .join("\n");

  const handler = `// server/domains/${domain}.js
// Domain actions for ${domain}: CRUD operations for ${entity} entities.

export default function register${pascal(domain)}Actions(registerLensAction) {
  /**
   * create${entity}
   * Create a new ${entityLower} from artifact data.
   * artifact.data = { ${fields.filter(f => f !== "id").join(", ")} }
   */
  registerLensAction("${domain}", "create${entity}", (ctx, artifact, params) => {
    const data = artifact.data || {};
    const missing = [];
${fieldValidation}
    if (missing.length > 0) {
      return { ok: false, error: \`Missing required fields: \${missing.join(", ")}\` };
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    const record = { id, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

    // Store in artifact for persistence
    if (!artifact.data._records) artifact.data._records = [];
    artifact.data._records.push(record);

    return { ok: true, result: { created: record, total: artifact.data._records.length } };
  });

  /**
   * get${entity}
   * Retrieve a single ${entityLower} by ID.
   * params.id = the record ID
   */
  registerLensAction("${domain}", "get${entity}", (ctx, artifact, params) => {
    const records = artifact.data?._records || [];
    const id = params.id || artifact.data?.id;
    if (!id) return { ok: false, error: "Provide params.id to retrieve a ${entityLower}." };

    const record = records.find(r => r.id === id);
    if (!record${softDelete ? " || record._deleted" : ""}) {
      return { ok: false, error: "${entity} not found." };
    }
    return { ok: true, result: record };
  });

  /**
   * update${entity}
   * Update fields on an existing ${entityLower}.
   * params.id = the record ID, artifact.data = fields to update
   */
  registerLensAction("${domain}", "update${entity}", (ctx, artifact, params) => {
    const records = artifact.data?._records || [];
    const id = params.id || artifact.data?.id;
    if (!id) return { ok: false, error: "Provide params.id to update." };

    const idx = records.findIndex(r => r.id === id${softDelete ? " && !r._deleted" : ""});
    if (idx === -1) return { ok: false, error: "${entity} not found." };

    const updates = { ...artifact.data };
    delete updates._records;
    delete updates.id;

    records[idx] = { ...records[idx], ...updates, updatedAt: new Date().toISOString() };
    return { ok: true, result: { updated: records[idx] } };
  });

  /**
   * delete${entity}
   * ${softDelete ? "Soft-delete" : "Delete"} a ${entityLower} by ID.
   * params.id = the record ID
   */
  registerLensAction("${domain}", "delete${entity}", (ctx, artifact, params) => {
    const records = artifact.data?._records || [];
    const id = params.id || artifact.data?.id;
    if (!id) return { ok: false, error: "Provide params.id to delete." };

    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return { ok: false, error: "${entity} not found." };

${softDelete
    ? `    records[idx]._deleted = true;
    records[idx].deletedAt = new Date().toISOString();
    return { ok: true, result: { deleted: id, soft: true } };`
    : `    const removed = records.splice(idx, 1)[0];
    return { ok: true, result: { deleted: removed } };`}
  });

  /**
   * list${entity}s
   * List all ${entityLower}s with optional pagination and filtering.
   * params.limit, params.offset, params.status
   */
  registerLensAction("${domain}", "list${entity}s", (ctx, artifact, params) => {
    let records = (artifact.data?._records || [])${softDelete ? ".filter(r => !r._deleted)" : ""};

    // Filter by status if provided
    if (params.status) {
      records = records.filter(r => r.status === params.status);
    }

    const total = records.length;
    const limit = Math.min(parseInt(params.limit) || 25, 100);
    const offset = parseInt(params.offset) || 0;
    const page = records.slice(offset, offset + limit);

    return {
      ok: true,
      result: {
        items: page,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  });

  /**
   * search${entity}s
   * Full-text search across ${entityLower} fields.
   * params.query = search string
   */
  registerLensAction("${domain}", "search${entity}s", (ctx, artifact, params) => {
    const query = (params.query || "").toLowerCase();
    if (!query) return { ok: true, result: { matches: [], message: "Provide a search query." } };

    const records = (artifact.data?._records || [])${softDelete ? ".filter(r => !r._deleted)" : ""};
    const matches = records.filter(r => {
      return ${JSON.stringify(fields)}.some(field => {
        const val = r[field];
        return typeof val === "string" && val.toLowerCase().includes(query);
      });
    });

    return { ok: true, result: { matches, count: matches.length, query } };
  });
}
`;

  const page = generatePageTemplate(domain, entity, [
    `create${entity}`, `get${entity}`, `update${entity}`,
    `delete${entity}`, `list${entity}s`, `search${entity}s`,
  ]);

  return { handler, page };
}

/** Convert kebab-case to PascalCase */
function pascal(str) {
  return str.replace(/(^|-)(\w)/g, (_, _sep, c) => c.toUpperCase());
}

/** Generate a basic Next.js page template for the lens */
function generatePageTemplate(domain, entity, actions) {
  return `"use client";
import { useState } from "react";

export default function ${pascal(domain)}Lens() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runAction(action, data = {}) {
    setLoading(true);
    try {
      const res = await fetch(\`/api/lens/${domain}/action\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const json = await res.json();
      setResult(json);
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">${entity} Manager</h1>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {${JSON.stringify(actions)}.map(action => (
          <button
            key={action}
            onClick={() => runAction(action)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {action}
          </button>
        ))}
      </div>
      {result && (
        <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
`;
}

export default { id, name, description, category, tags, generate };
