/**
 * Telegram Channel — Bot API Wrapper
 *
 * Handles outbound messaging (alerts, brain responses, initiative messages)
 * and inbound webhook updates routed to the chat pipeline.
 *
 * Uses the native https module to avoid external dependencies.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN — Bot token from @BotFather
 *
 * Exports:
 *   sendMessage(chatId, text, opts)   — Send a text message
 *   handleIncoming(update)            — Process an inbound webhook update
 *   registerWebhook(url)              — Set the webhook URL with Telegram
 */

import https from "https";
import crypto from "crypto";
import logger from "../logger.js";

// ── Configuration ──────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Internal HTTP helper ───────────────────────────────────────────────────

/**
 * Make a POST request to the Telegram Bot API.
 *
 * @param {string} method - Telegram API method (e.g., "sendMessage")
 * @param {object} body   - JSON-serializable request body
 * @returns {Promise<object>} Parsed API response
 */
function telegramAPI(method, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(`${API_BASE}/${method}`);

    const options = {
      method: "POST",
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 15_000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        try {
          const text = Buffer.concat(chunks).toString("utf8");
          const json = JSON.parse(text);
          if (!json.ok) {
            logger.warn("telegram", `API error: ${method}`, {
              error_code: json.error_code,
              description: json.description,
            });
          }
          resolve(json);
        } catch (err) {
          reject(new Error(`Telegram API parse error: ${err.message}`));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Telegram API network error: ${err.message}`)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Telegram API request timed out"));
    });

    req.write(payload);
    req.end();
  });
}

// ── Outbound ───────────────────────────────────────────────────────────────

/**
 * Send a text message to a Telegram chat.
 *
 * @param {string|number} chatId - Telegram chat ID
 * @param {string} text          - Message text (Markdown supported)
 * @param {object} [opts]
 * @param {string} [opts.parseMode="Markdown"] - Parse mode (Markdown|HTML|MarkdownV2)
 * @param {boolean} [opts.disableNotification=false]
 * @param {object} [opts.replyMarkup] - Inline keyboard or reply markup
 * @returns {Promise<object>} Telegram API response
 */
export async function sendMessage(chatId, text, opts = {}) {
  if (!BOT_TOKEN) {
    logger.warn("telegram", "TELEGRAM_BOT_TOKEN not configured, skipping send");
    return { ok: false, error: "not_configured" };
  }

  if (!chatId || !text) {
    return { ok: false, error: "missing_chatId_or_text" };
  }

  const body = {
    chat_id: chatId,
    text: String(text).slice(0, 4096), // Telegram limit
    parse_mode: opts.parseMode || "Markdown",
  };

  if (opts.disableNotification) {
    body.disable_notification = true;
  }
  if (opts.replyMarkup) {
    body.reply_markup = opts.replyMarkup;
  }

  try {
    const result = await telegramAPI("sendMessage", body);
    logger.info("telegram", "Message sent", { chatId, ok: result.ok });
    return result;
  } catch (err) {
    logger.error("telegram", "sendMessage failed", { chatId, error: err.message });
    return { ok: false, error: err.message };
  }
}

/**
 * Send an alert-formatted message (bold header + body).
 *
 * @param {string|number} chatId
 * @param {string} title
 * @param {string} body
 * @returns {Promise<object>}
 */
export async function sendAlert(chatId, title, body) {
  const text = `*${escapeMarkdown(title)}*\n\n${escapeMarkdown(body)}`;
  return sendMessage(chatId, text);
}

/**
 * Send an initiative message (proactive outreach from the brain).
 *
 * @param {string|number} chatId
 * @param {object} initiative - Initiative object from the initiative engine
 * @returns {Promise<object>}
 */
export async function sendInitiativeMessage(chatId, initiative) {
  const priority = initiative.priority || "normal";
  const icon = priority === "urgent" ? "\u26a0\ufe0f" : priority === "high" ? "\u2757" : "\ud83d\udcac";
  const title = initiative.title || "Concord has something for you";
  const body = initiative.body || initiative.message || "";

  const text = `${icon} *${escapeMarkdown(title)}*\n\n${escapeMarkdown(body)}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "Reply", callback_data: `initiative_respond_${initiative.id || "unknown"}` },
        { text: "Dismiss", callback_data: `initiative_dismiss_${initiative.id || "unknown"}` },
      ],
    ],
  };

  return sendMessage(chatId, text, { replyMarkup });
}

// ── Inbound ────────────────────────────────────────────────────────────────

/**
 * Handle an incoming Telegram webhook update.
 *
 * Extracts the user message (or callback query) and returns a normalized
 * payload suitable for routing through the chat pipeline.
 *
 * @param {object} update - Raw Telegram Update object
 * @returns {{ ok: boolean, chatId?: string|number, userId?: string, username?: string, text?: string, callbackData?: string, type: string }}
 */
export function handleIncoming(update) {
  if (!update) {
    return { ok: false, type: "empty" };
  }

  // Text message
  if (update.message?.text) {
    const msg = update.message;
    return {
      ok: true,
      type: "message",
      chatId: msg.chat.id,
      userId: String(msg.from.id),
      username: msg.from.username || null,
      firstName: msg.from.first_name || null,
      text: msg.text,
      messageId: msg.message_id,
      isGroup: msg.chat.type !== "private",
    };
  }

  // Callback query (inline keyboard button press)
  if (update.callback_query) {
    const cb = update.callback_query;
    return {
      ok: true,
      type: "callback",
      chatId: cb.message?.chat?.id || null,
      userId: String(cb.from.id),
      username: cb.from.username || null,
      callbackData: cb.data,
      messageId: cb.message?.message_id || null,
    };
  }

  // Edited message
  if (update.edited_message?.text) {
    const msg = update.edited_message;
    return {
      ok: true,
      type: "edited_message",
      chatId: msg.chat.id,
      userId: String(msg.from.id),
      text: msg.text,
      messageId: msg.message_id,
    };
  }

  return { ok: false, type: "unsupported" };
}

// ── Webhook Registration ───────────────────────────────────────────────────

/**
 * Register (or update) the Telegram webhook URL.
 *
 * @param {string} url - Public HTTPS URL for the webhook endpoint
 * @param {object} [opts]
 * @param {string[]} [opts.allowedUpdates] - Update types to receive
 * @param {string} [opts.secretToken]      - Secret for X-Telegram-Bot-Api-Secret-Token header
 * @returns {Promise<object>}
 */
export async function registerWebhook(url, opts = {}) {
  if (!BOT_TOKEN) {
    logger.warn("telegram", "TELEGRAM_BOT_TOKEN not configured, cannot register webhook");
    return { ok: false, error: "not_configured" };
  }

  if (!url || !url.startsWith("https://")) {
    return { ok: false, error: "webhook_url_must_be_https" };
  }

  const body = {
    url,
    allowed_updates: opts.allowedUpdates || ["message", "callback_query", "edited_message"],
    drop_pending_updates: false,
  };

  if (opts.secretToken) {
    body.secret_token = opts.secretToken;
  }

  try {
    const result = await telegramAPI("setWebhook", body);
    logger.info("telegram", "Webhook registered", { url, ok: result.ok });
    return result;
  } catch (err) {
    logger.error("telegram", "registerWebhook failed", { url, error: err.message });
    return { ok: false, error: err.message };
  }
}

/**
 * Remove the current webhook (switch to polling mode).
 *
 * @returns {Promise<object>}
 */
export async function removeWebhook() {
  if (!BOT_TOKEN) return { ok: false, error: "not_configured" };

  try {
    return await telegramAPI("deleteWebhook", { drop_pending_updates: false });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Get current webhook info.
 *
 * @returns {Promise<object>}
 */
export async function getWebhookInfo() {
  if (!BOT_TOKEN) return { ok: false, error: "not_configured" };

  try {
    return await telegramAPI("getWebhookInfo", {});
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Escape special characters for Telegram Markdown.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeMarkdown(text) {
  if (!text) return "";
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

/**
 * Verify the X-Telegram-Bot-Api-Secret-Token header matches our secret.
 *
 * @param {string} headerValue - Value from the request header
 * @param {string} expectedSecret
 * @returns {boolean}
 */
export function verifyWebhookSecret(headerValue, expectedSecret) {
  if (!expectedSecret) return true; // No secret configured = accept all
  if (!headerValue) return false;
  // Constant-time comparison
  try {
    const a = Buffer.from(String(headerValue));
    const b = Buffer.from(String(expectedSecret));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Check whether the Telegram channel is configured.
 *
 * @returns {boolean}
 */
export function isConfigured() {
  return Boolean(BOT_TOKEN);
}
