/**
 * Discord Channel — Webhook & Bot Integration
 *
 * Handles outbound messaging via webhooks and bot DMs, plus inbound
 * slash command interactions routed to the chat pipeline.
 *
 * Uses the native https module to avoid external dependencies.
 *
 * Env:
 *   DISCORD_BOT_TOKEN   — Bot token from Discord Developer Portal
 *   DISCORD_WEBHOOK_URL — Default webhook URL for outbound notifications
 *   DISCORD_APP_ID      — Application ID (for interaction verification)
 *   DISCORD_PUBLIC_KEY   — Public key for interaction signature verification
 *
 * Exports:
 *   sendWebhook(webhookUrl, content)    — Post a message via webhook
 *   handleSlashCommand(interaction)     — Process inbound slash command
 *   sendDM(userId, text)                — Send a DM to a Discord user
 */

import https from "https";
import crypto from "crypto";
import logger from "../logger.js";

// ── Configuration ──────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const DEFAULT_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";
const API_BASE = "https://discord.com/api/v10";

// Discord interaction response types
const INTERACTION_RESPONSE = Object.freeze({
  PONG: 1,
  CHANNEL_MESSAGE: 4,
  DEFERRED_CHANNEL_MESSAGE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
});

// ── Internal HTTP helper ───────────────────────────────────────────────────

/**
 * Make an HTTPS request to the Discord API.
 *
 * @param {string} method  - HTTP method (GET, POST, etc.)
 * @param {string} urlPath - API path (e.g., "/channels/123/messages")
 * @param {object} [body]  - JSON-serializable request body
 * @param {object} [headers] - Additional headers
 * @returns {Promise<object>} Parsed API response
 */
function discordAPI(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${urlPath}`);
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${BOT_TOKEN}`,
        ...headers,
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
      timeout: 15_000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const text = Buffer.concat(chunks).toString("utf8");
          // 204 No Content
          if (res.statusCode === 204) {
            resolve({ ok: true, status: 204 });
            return;
          }
          const json = JSON.parse(text);
          if (res.statusCode >= 400) {
            logger.warn("discord", `API error: ${method} ${urlPath}`, {
              status: res.statusCode,
              code: json.code,
              message: json.message,
            });
            resolve({ ok: false, status: res.statusCode, ...json });
          } else {
            resolve({ ok: true, status: res.statusCode, ...json });
          }
        } catch (err) {
          reject(new Error(`Discord API parse error: ${err.message}`));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Discord API network error: ${err.message}`)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Discord API request timed out"));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * POST to a Discord webhook URL (does not require bot token).
 *
 * @param {string} webhookUrl - Full webhook URL
 * @param {object} body       - Webhook payload
 * @returns {Promise<object>}
 */
function postWebhook(webhookUrl, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const payload = JSON.stringify(body);

    const options = {
      method: "POST",
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 15_000,
    };

    const mod = url.protocol === "https:" ? https : https; // Always HTTPS for Discord
    const req = mod.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode === 204) {
            resolve({ ok: true, status: 204 });
            return;
          }
          if (!text) {
            resolve({ ok: res.statusCode < 400, status: res.statusCode });
            return;
          }
          const json = JSON.parse(text);
          resolve({ ok: res.statusCode < 400, status: res.statusCode, ...json });
        } catch (err) {
          reject(new Error(`Webhook parse error: ${err.message}`));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Webhook network error: ${err.message}`)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Webhook request timed out"));
    });

    req.write(payload);
    req.end();
  });
}

// ── Outbound: Webhooks ─────────────────────────────────────────────────────

/**
 * Send a message through a Discord webhook.
 *
 * Supports plain text, embeds, and username overrides.
 *
 * @param {string} webhookUrl - Webhook URL (falls back to DISCORD_WEBHOOK_URL)
 * @param {string|object} content - Text string or full webhook payload
 * @returns {Promise<object>}
 */
export async function sendWebhook(webhookUrl, content) {
  const url = webhookUrl || DEFAULT_WEBHOOK_URL;
  if (!url) {
    logger.warn("discord", "No webhook URL configured, skipping send");
    return { ok: false, error: "no_webhook_url" };
  }

  const body = typeof content === "string"
    ? { content: content.slice(0, 2000), username: "Concord" }
    : { username: "Concord", ...content };

  try {
    const result = await postWebhook(url, body);
    logger.info("discord", "Webhook message sent", { ok: result.ok });
    return result;
  } catch (err) {
    logger.error("discord", "sendWebhook failed", { error: err.message });
    return { ok: false, error: err.message };
  }
}

/**
 * Send a DTU alert embed through a webhook.
 *
 * @param {string} webhookUrl
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} [opts.severity="info"] - "info"|"warning"|"critical"
 * @param {object[]} [opts.fields]
 * @param {string} [opts.url]
 * @returns {Promise<object>}
 */
export async function sendDTUAlert(webhookUrl, opts = {}) {
  const colorMap = {
    info: 0x3498db,     // Blue
    warning: 0xf39c12,  // Orange
    critical: 0xe74c3c, // Red
    success: 0x2ecc71,  // Green
  };

  const embed = {
    title: opts.title || "DTU Alert",
    description: (opts.description || "").slice(0, 4096),
    color: colorMap[opts.severity] || colorMap.info,
    timestamp: new Date().toISOString(),
    footer: { text: "Concord Cognitive Engine" },
  };

  if (opts.fields && Array.isArray(opts.fields)) {
    embed.fields = opts.fields.slice(0, 25).map((f) => ({
      name: String(f.name || "").slice(0, 256),
      value: String(f.value || "").slice(0, 1024),
      inline: Boolean(f.inline),
    }));
  }

  if (opts.url) {
    embed.url = opts.url;
  }

  return sendWebhook(webhookUrl, { embeds: [embed] });
}

// ── Outbound: Bot DMs ─────────────────────────────────────────────────────

/**
 * Send a direct message to a Discord user via the bot.
 *
 * Opens a DM channel first, then sends the message.
 *
 * @param {string} userId - Discord user ID
 * @param {string} text   - Message text
 * @returns {Promise<object>}
 */
export async function sendDM(userId, text) {
  if (!BOT_TOKEN) {
    logger.warn("discord", "DISCORD_BOT_TOKEN not configured, skipping DM");
    return { ok: false, error: "not_configured" };
  }

  if (!userId || !text) {
    return { ok: false, error: "missing_userId_or_text" };
  }

  try {
    // Step 1: Open a DM channel
    const channel = await discordAPI("POST", "/users/@me/channels", {
      recipient_id: userId,
    });

    if (!channel.ok || !channel.id) {
      logger.warn("discord", "Failed to open DM channel", { userId, channel });
      return { ok: false, error: "dm_channel_failed" };
    }

    // Step 2: Send the message
    const result = await discordAPI("POST", `/channels/${channel.id}/messages`, {
      content: String(text).slice(0, 2000),
    });

    logger.info("discord", "DM sent", { userId, ok: result.ok });
    return result;
  } catch (err) {
    logger.error("discord", "sendDM failed", { userId, error: err.message });
    return { ok: false, error: err.message };
  }
}

/**
 * Send a rich embed DM to a Discord user.
 *
 * @param {string} userId
 * @param {object} embed - Discord embed object
 * @returns {Promise<object>}
 */
export async function sendEmbedDM(userId, embed) {
  if (!BOT_TOKEN) {
    return { ok: false, error: "not_configured" };
  }

  try {
    const channel = await discordAPI("POST", "/users/@me/channels", {
      recipient_id: userId,
    });

    if (!channel.ok || !channel.id) {
      return { ok: false, error: "dm_channel_failed" };
    }

    const result = await discordAPI("POST", `/channels/${channel.id}/messages`, {
      embeds: [embed],
    });

    return result;
  } catch (err) {
    logger.error("discord", "sendEmbedDM failed", { userId, error: err.message });
    return { ok: false, error: err.message };
  }
}

// ── Inbound: Slash Commands ────────────────────────────────────────────────

/**
 * Handle an inbound Discord interaction (slash command or component).
 *
 * Returns a normalized payload for routing through the chat pipeline,
 * plus the appropriate interaction response.
 *
 * @param {object} interaction - Raw Discord Interaction object
 * @returns {{ ok: boolean, type: string, userId?: string, username?: string, text?: string, channelId?: string, guildId?: string, response?: object }}
 */
export function handleSlashCommand(interaction) {
  if (!interaction) {
    return { ok: false, type: "empty" };
  }

  // Ping (interaction type 1) — respond with Pong
  if (interaction.type === 1) {
    return {
      ok: true,
      type: "ping",
      response: { type: INTERACTION_RESPONSE.PONG },
    };
  }

  // Application command (type 2)
  if (interaction.type === 2) {
    const data = interaction.data || {};
    const user = interaction.member?.user || interaction.user || {};

    // Extract command options into a text string for the chat pipeline
    const optionText = (data.options || [])
      .map((opt) => opt.value)
      .filter(Boolean)
      .join(" ");

    const commandText = `/${data.name || "unknown"} ${optionText}`.trim();

    return {
      ok: true,
      type: "command",
      commandName: data.name,
      userId: user.id || null,
      username: user.username || null,
      discriminator: user.discriminator || null,
      text: commandText,
      channelId: interaction.channel_id || null,
      guildId: interaction.guild_id || null,
      interactionId: interaction.id,
      interactionToken: interaction.token,
      response: {
        type: INTERACTION_RESPONSE.DEFERRED_CHANNEL_MESSAGE,
        data: { flags: 0 },
      },
    };
  }

  // Message component (type 3) — button press, select menu
  if (interaction.type === 3) {
    const user = interaction.member?.user || interaction.user || {};
    return {
      ok: true,
      type: "component",
      customId: interaction.data?.custom_id || null,
      userId: user.id || null,
      username: user.username || null,
      channelId: interaction.channel_id || null,
      guildId: interaction.guild_id || null,
      interactionId: interaction.id,
      interactionToken: interaction.token,
      response: {
        type: INTERACTION_RESPONSE.DEFERRED_UPDATE_MESSAGE,
      },
    };
  }

  return { ok: false, type: "unsupported" };
}

/**
 * Send a follow-up message after a deferred interaction response.
 *
 * @param {string} interactionToken - The interaction token
 * @param {string|object} content   - Text or message payload
 * @returns {Promise<object>}
 */
export async function sendFollowup(interactionToken, content) {
  if (!BOT_TOKEN) {
    return { ok: false, error: "not_configured" };
  }

  const appId = process.env.DISCORD_APP_ID || "";
  if (!appId) {
    return { ok: false, error: "missing_app_id" };
  }

  const body = typeof content === "string"
    ? { content: content.slice(0, 2000) }
    : content;

  try {
    const result = await discordAPI(
      "POST",
      `/webhooks/${appId}/${interactionToken}`,
      body,
      {} // No extra auth — webhook token is self-authenticating
    );
    return result;
  } catch (err) {
    logger.error("discord", "sendFollowup failed", { error: err.message });
    return { ok: false, error: err.message };
  }
}

// ── Interaction Verification ───────────────────────────────────────────────

/**
 * Verify a Discord interaction signature (Ed25519).
 *
 * Discord requires signature verification for all interaction endpoints.
 *
 * @param {string} rawBody     - Raw request body string
 * @param {string} signature   - X-Signature-Ed25519 header
 * @param {string} timestamp   - X-Signature-Timestamp header
 * @returns {boolean}
 */
export function verifyInteractionSignature(rawBody, signature, timestamp) {
  if (!PUBLIC_KEY || !signature || !timestamp) return false;

  try {
    const message = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signature, "hex");
    const key = Buffer.from(PUBLIC_KEY, "hex");

    // Ed25519 verification via Node's crypto
    return crypto.verify(null, message, { key, format: "der", type: "raw" }, sig);
  } catch {
    // If the crypto primitives are unavailable or the key is malformed, reject
    return false;
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Check whether the Discord channel is configured.
 *
 * @returns {{ bot: boolean, webhook: boolean }}
 */
export function isConfigured() {
  return {
    bot: Boolean(BOT_TOKEN),
    webhook: Boolean(DEFAULT_WEBHOOK_URL),
  };
}

/**
 * Get bot info (requires valid token).
 *
 * @returns {Promise<object>}
 */
export async function getBotInfo() {
  if (!BOT_TOKEN) return { ok: false, error: "not_configured" };

  try {
    return await discordAPI("GET", "/users/@me");
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
