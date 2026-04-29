// server/lib/messaging/adapter-interface.js
// Abstract interface and normalised message types for all external messaging adapters.
// Each platform adapter must export an object conforming to MessagingAdapter.

/**
 * @typedef {'whatsapp'|'telegram'|'discord'|'signal'|'imessage'|'slack'|'email'} Platform
 */

/**
 * @typedef {Object} NormalizedMessage
 * @property {boolean} ok
 * @property {'text'|'image'|'voice'|'sticker'|'file'|'unsupported'} type
 * @property {string} text
 * @property {string} externalId   - platform-native sender ID
 * @property {string} chatId       - platform-native channel/chat ID
 * @property {Platform} platform
 * @property {string} [userId]     - resolved Concord userId if binding exists
 * @property {string} [messageId]  - platform-native message ID
 * @property {object} raw          - unmodified platform payload
 */

/**
 * @typedef {Object} SendResult
 * @property {boolean} ok
 * @property {string} [messageId]
 * @property {string} [error]
 */

/**
 * Validate that an adapter object satisfies the required interface.
 * Throws if required methods are missing.
 * @param {string} name
 * @param {object} adapter
 */
export function validateAdapter(name, adapter) {
  const required = ["platform", "isConfigured", "verifyIncoming", "parseIncoming", "sendMessage"];
  for (const method of required) {
    if (typeof adapter[method] !== "function" && typeof adapter[method] !== "string") {
      throw new Error(`Messaging adapter "${name}" is missing required field/method: ${method}`);
    }
  }
  return true;
}

/**
 * Create a stub no-op adapter for platforms that aren't available on this host.
 * @param {Platform} platform
 * @param {string} reason
 * @returns {object}
 */
export function createStubAdapter(platform, reason) {
  return {
    platform,
    isConfigured() { return false; },
    verifyIncoming() { return false; },
    parseIncoming() { return { ok: false, type: "unsupported", text: "", externalId: "", chatId: "", platform, raw: {} }; },
    async sendMessage() { return { ok: false, error: reason }; },
    _stub: true,
    _reason: reason,
  };
}

/**
 * Build the full adapter registry from all available adapters.
 * Returns a Map of platform → adapter, falling back to stubs for unconfigured platforms.
 * @param {object} adapters - map of platform name → adapter module
 * @returns {Map<string, object>}
 */
export function buildAdapterRegistry(adapters) {
  const registry = new Map();
  for (const [name, adapter] of Object.entries(adapters)) {
    try {
      validateAdapter(name, adapter);
      registry.set(name, adapter);
    } catch (err) {
      console.warn(`[messaging] Adapter "${name}" failed validation: ${err.message}. Using stub.`);
      registry.set(name, createStubAdapter(name, err.message));
    }
  }
  return registry;
}
