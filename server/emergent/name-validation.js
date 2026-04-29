// server/emergent/name-validation.js
// Validates and checks uniqueness of emergent given names.

const NAME_RULES = {
  minLength: 2,
  maxLength: 30,
  allowedChars: /^[a-zA-Z0-9\-' ]+$/,
  reserved: ["admin", "system", "concord", "cipher", "root", "god", "null", "undefined"],
};

/**
 * Validates a proposed emergent name against naming rules.
 * @param {string} name
 * @returns {boolean}
 */
export function isNameValid(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < NAME_RULES.minLength) return false;
  if (trimmed.length > NAME_RULES.maxLength) return false;
  if (!NAME_RULES.allowedChars.test(trimmed)) return false;
  if (NAME_RULES.reserved.includes(trimmed.toLowerCase())) return false;
  return true;
}

/**
 * Checks that no other emergent already holds this name.
 * @param {string} name
 * @param {object} db - better-sqlite3 instance
 * @param {string} [excludeId] - emergent_id to exclude (for re-naming)
 * @returns {boolean}
 */
export function isNameUnique(name, db, excludeId) {
  if (!db) return true;
  try {
    const sql = excludeId
      ? "SELECT emergent_id FROM emergent_identity WHERE LOWER(given_name) = LOWER(?) AND emergent_id != ?"
      : "SELECT emergent_id FROM emergent_identity WHERE LOWER(given_name) = LOWER(?)";
    const args = excludeId ? [name.trim(), excludeId] : [name.trim()];
    const row = db.prepare(sql).get(...args);
    return !row;
  } catch { return true; }
}

/**
 * Clean raw LLM name output — strip quotes, trailing punctuation, trim.
 * @param {string} raw
 * @returns {string}
 */
export function cleanNameResponse(raw) {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
}

export { NAME_RULES };
