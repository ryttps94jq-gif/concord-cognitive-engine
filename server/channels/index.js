/**
 * Channel Router — Unified Messaging Integration Layer
 *
 * Routes outbound messages and notifications through the user's preferred
 * channel (Telegram, Discord, email, or in-app). Routes inbound messages
 * from any channel into the server's chat pipeline via chat-router.
 *
 * User preferences are stored in STATE.channelPreferences as a Map of
 * userId -> { preferredChannel, channels: { telegram, discord, email } }.
 *
 * Exports:
 *   routeMessage(userId, message, preferredChannel) — Route outbound message
 *   routeNotification(userId, event, data)          — Route outbound notification
 *   routeInbound(channel, normalized, STATE)         — Route inbound to chat pipeline
 *   getUserPreferences(userId, STATE)                — Get user channel settings
 *   setUserPreferences(userId, prefs, STATE)         — Update user channel settings
 *   linkChannel(userId, channel, channelData, STATE) — Link a channel account
 *   getChannelStatus()                               — Health/config status of all channels
 */

import * as telegram from "./telegram.js";
import * as discord from "./discord.js";
import * as email from "./email.js";
import { routeMessage as chatRouterRoute } from "../lib/chat-router.js";
import logger from "../logger.js";

// ── Supported Channels ─────────────────────────────────────────────────────

export const CHANNELS = Object.freeze({
  TELEGRAM: "telegram",
  DISCORD: "discord",
  EMAIL: "email",
  IN_APP: "inApp",
});

const CHANNEL_LIST = Object.values(CHANNELS);

// ── Preferences Management ─────────────────────────────────────────────────

/**
 * Ensure the channelPreferences map exists on STATE.
 *
 * @param {object} STATE
 * @returns {Map}
 */
function ensurePrefsMap(STATE) {
  if (!STATE.channelPreferences) {
    STATE.channelPreferences = new Map();
  }
  return STATE.channelPreferences;
}

/**
 * Get the default preference structure for a new user.
 *
 * @returns {object}
 */
function defaultPreferences() {
  return {
    preferredChannel: CHANNELS.IN_APP,
    channels: {
      telegram: { linked: false, chatId: null },
      discord: { linked: false, userId: null, webhookUrl: null },
      email: { linked: false, address: null },
    },
    notifications: {
      alerts: true,
      initiatives: true,
      digests: true,
      quietHoursStart: null, // e.g. "22:00"
      quietHoursEnd: null,   // e.g. "08:00"
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a user's channel preferences.
 *
 * @param {string} userId
 * @param {object} STATE
 * @returns {object}
 */
export function getUserPreferences(userId, STATE) {
  const prefs = ensurePrefsMap(STATE);
  return prefs.get(userId) || defaultPreferences();
}

/**
 * Update a user's channel preferences (partial merge).
 *
 * @param {string} userId
 * @param {object} updates - Partial preferences to merge
 * @param {object} STATE
 * @returns {object} Updated preferences
 */
export function setUserPreferences(userId, updates, STATE) {
  const prefs = ensurePrefsMap(STATE);
  const current = prefs.get(userId) || defaultPreferences();

  // Validate preferred channel
  if (updates.preferredChannel && !CHANNEL_LIST.includes(updates.preferredChannel)) {
    throw new Error(`Invalid channel: ${updates.preferredChannel}. Must be one of: ${CHANNEL_LIST.join(", ")}`);
  }

  // Merge top-level fields
  if (updates.preferredChannel) {
    current.preferredChannel = updates.preferredChannel;
  }

  // Merge notification settings
  if (updates.notifications) {
    current.notifications = { ...current.notifications, ...updates.notifications };
  }

  current.updatedAt = new Date().toISOString();
  prefs.set(userId, current);

  logger.info("channels", "Preferences updated", { userId, preferredChannel: current.preferredChannel });
  return current;
}

/**
 * Link a messaging channel account to a user.
 *
 * @param {string} userId
 * @param {string} channel  - "telegram"|"discord"|"email"
 * @param {object} channelData - Channel-specific link data
 * @param {object} STATE
 * @returns {object}
 */
export function linkChannel(userId, channel, channelData, STATE) {
  const prefs = ensurePrefsMap(STATE);
  const current = prefs.get(userId) || defaultPreferences();

  switch (channel) {
    case CHANNELS.TELEGRAM: {
      current.channels.telegram = {
        linked: true,
        chatId: channelData.chatId || null,
        username: channelData.username || null,
        linkedAt: new Date().toISOString(),
      };
      break;
    }
    case CHANNELS.DISCORD: {
      current.channels.discord = {
        linked: true,
        userId: channelData.userId || null,
        username: channelData.username || null,
        webhookUrl: channelData.webhookUrl || null,
        linkedAt: new Date().toISOString(),
      };
      break;
    }
    case CHANNELS.EMAIL: {
      current.channels.email = {
        linked: true,
        address: channelData.address || null,
        verified: channelData.verified || false,
        linkedAt: new Date().toISOString(),
      };
      break;
    }
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }

  current.updatedAt = new Date().toISOString();
  prefs.set(userId, current);

  logger.info("channels", "Channel linked", { userId, channel });
  return { ok: true, channel, linked: true };
}

/**
 * Unlink a messaging channel from a user.
 *
 * @param {string} userId
 * @param {string} channel
 * @param {object} STATE
 * @returns {object}
 */
export function unlinkChannel(userId, channel, STATE) {
  const prefs = ensurePrefsMap(STATE);
  const current = prefs.get(userId) || defaultPreferences();

  if (current.channels[channel]) {
    current.channels[channel] = { linked: false };

    // Reset preferred channel if it was the one being unlinked
    if (current.preferredChannel === channel) {
      current.preferredChannel = CHANNELS.IN_APP;
    }
  }

  current.updatedAt = new Date().toISOString();
  prefs.set(userId, current);

  logger.info("channels", "Channel unlinked", { userId, channel });
  return { ok: true, channel, linked: false };
}

// ── Outbound: Message Routing ──────────────────────────────────────────────

/**
 * Route an outbound message to the user through their preferred channel.
 *
 * Falls back to in-app if the preferred channel is not linked or delivery fails.
 *
 * @param {string} userId           - Target user
 * @param {string} message          - Message text
 * @param {string} [preferredChannel] - Override the user's default preference
 * @param {object} STATE            - Server state
 * @returns {Promise<{ ok: boolean, channel: string, fallback?: boolean }>}
 */
export async function routeMessage(userId, message, preferredChannel, STATE) {
  if (!userId || !message) {
    return { ok: false, error: "missing_userId_or_message" };
  }

  const prefs = getUserPreferences(userId, STATE);
  const channel = preferredChannel || prefs.preferredChannel || CHANNELS.IN_APP;

  // Check quiet hours
  if (isQuietHours(prefs.notifications)) {
    logger.debug("channels", "Quiet hours active, deferring message", { userId, channel });
    return { ok: true, channel: CHANNELS.IN_APP, deferred: true, reason: "quiet_hours" };
  }

  const result = await deliverMessage(channel, prefs, message);

  // Fallback to in-app on failure
  if (!result.ok && channel !== CHANNELS.IN_APP) {
    logger.warn("channels", `Delivery via ${channel} failed, falling back to in-app`, { userId });
    return { ok: true, channel: CHANNELS.IN_APP, fallback: true, originalChannel: channel };
  }

  return { ...result, channel };
}

/**
 * Route a notification to the user (supports structured data for rich formatting).
 *
 * @param {string} userId
 * @param {string} event   - Event type (e.g., "dtu_alert", "initiative", "citation")
 * @param {object} data    - Event data
 * @param {object} STATE   - Server state
 * @returns {Promise<{ ok: boolean, channel: string }>}
 */
export async function routeNotification(userId, event, data, STATE) {
  if (!userId || !event) {
    return { ok: false, error: "missing_userId_or_event" };
  }

  const prefs = getUserPreferences(userId, STATE);
  const channel = prefs.preferredChannel || CHANNELS.IN_APP;

  // Check if this notification type is enabled
  if (!isNotificationEnabled(prefs.notifications, event)) {
    return { ok: true, channel: CHANNELS.IN_APP, skipped: true, reason: "notification_disabled" };
  }

  // Check quiet hours
  if (isQuietHours(prefs.notifications)) {
    return { ok: true, channel: CHANNELS.IN_APP, deferred: true, reason: "quiet_hours" };
  }

  const result = await deliverNotification(channel, prefs, event, data);

  if (!result.ok && channel !== CHANNELS.IN_APP) {
    logger.warn("channels", `Notification via ${channel} failed, falling back to in-app`, { userId, event });
    return { ok: true, channel: CHANNELS.IN_APP, fallback: true };
  }

  return { ...result, channel };
}

// ── Inbound: Route to Chat Pipeline ────────────────────────────────────────

/**
 * Route an inbound message from any channel into the chat pipeline.
 *
 * @param {string} channel     - Source channel ("telegram"|"discord"|"email")
 * @param {object} normalized  - Normalized inbound payload from the channel handler
 * @param {object} STATE       - Server state
 * @returns {{ ok: boolean, route?: object }}
 */
export function routeInbound(channel, normalized, STATE) {
  if (!normalized?.ok || !normalized.text) {
    return { ok: false, reason: "invalid_inbound_payload" };
  }

  const userId = resolveUserId(channel, normalized, STATE);

  // Route through the chat pipeline
  try {
    const route = chatRouterRoute(normalized.text, {
      userId,
      sessionContext: null, // Inbound channels start fresh context
    });

    logger.info("channels", "Inbound routed to chat pipeline", {
      channel,
      userId,
      actionType: route.actionType,
      confidence: route.confidence,
    });

    return {
      ok: true,
      route,
      userId,
      channel,
      text: normalized.text,
    };
  } catch (err) {
    logger.error("channels", "Inbound routing failed", { channel, error: err.message });
    return { ok: false, error: err.message };
  }
}

// ── Channel Status ─────────────────────────────────────────────────────────

/**
 * Get the configuration status of all channels.
 *
 * @returns {object}
 */
export function getChannelStatus() {
  return {
    telegram: {
      configured: telegram.isConfigured(),
      type: "bot",
    },
    discord: {
      configured: discord.isConfigured(),
      type: "bot+webhook",
    },
    email: {
      configured: email.isConfigured(),
      type: "sendgrid",
    },
    inApp: {
      configured: true,
      type: "websocket",
    },
  };
}

// ── Internal Delivery ──────────────────────────────────────────────────────

/**
 * Deliver a plain text message through a specific channel.
 */
async function deliverMessage(channel, prefs, message) {
  switch (channel) {
    case CHANNELS.TELEGRAM: {
      const chatId = prefs.channels.telegram?.chatId;
      if (!chatId) return { ok: false, error: "telegram_not_linked" };
      return telegram.sendMessage(chatId, message);
    }

    case CHANNELS.DISCORD: {
      const discordUserId = prefs.channels.discord?.userId;
      if (discordUserId) {
        return discord.sendDM(discordUserId, message);
      }
      const webhookUrl = prefs.channels.discord?.webhookUrl;
      if (webhookUrl) {
        return discord.sendWebhook(webhookUrl, message);
      }
      return { ok: false, error: "discord_not_linked" };
    }

    case CHANNELS.EMAIL: {
      const address = prefs.channels.email?.address;
      if (!address) return { ok: false, error: "email_not_linked" };
      return email.sendEmail(address, "Message from Concord", `<p>${escapeForEmail(message)}</p>`);
    }

    case CHANNELS.IN_APP:
    default:
      // In-app messages are handled by the WebSocket layer
      return { ok: true, inApp: true };
  }
}

/**
 * Deliver a structured notification through a specific channel.
 */
async function deliverNotification(channel, prefs, event, data) {
  const title = data.title || formatEventTitle(event);
  const body = data.body || data.message || data.description || "";

  switch (channel) {
    case CHANNELS.TELEGRAM: {
      const chatId = prefs.channels.telegram?.chatId;
      if (!chatId) return { ok: false, error: "telegram_not_linked" };

      if (data.initiative) {
        return telegram.sendInitiativeMessage(chatId, data.initiative);
      }
      return telegram.sendAlert(chatId, title, body);
    }

    case CHANNELS.DISCORD: {
      const webhookUrl = prefs.channels.discord?.webhookUrl;
      const discordUserId = prefs.channels.discord?.userId;

      if (event === "dtu_alert" && webhookUrl) {
        return discord.sendDTUAlert(webhookUrl, {
          title,
          description: body,
          severity: data.severity || "info",
          fields: data.fields || [],
        });
      }

      if (discordUserId) {
        return discord.sendDM(discordUserId, `**${title}**\n${body}`);
      }
      if (webhookUrl) {
        return discord.sendWebhook(webhookUrl, `**${title}**\n${body}`);
      }
      return { ok: false, error: "discord_not_linked" };
    }

    case CHANNELS.EMAIL: {
      const address = prefs.channels.email?.address;
      if (!address) return { ok: false, error: "email_not_linked" };

      if (data.initiative) {
        return email.sendInitiativeEmail(address, data.initiative);
      }
      return email.sendNotification(address, {
        title,
        body,
        severity: data.severity || "info",
        actionUrl: data.actionUrl || null,
        actionLabel: data.actionLabel || null,
      });
    }

    case CHANNELS.IN_APP:
    default:
      return { ok: true, inApp: true };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve a Concord user ID from an inbound channel payload.
 *
 * Looks up the channel-specific ID in channelPreferences to find
 * the Concord user ID.
 */
function resolveUserId(channel, normalized, STATE) {
  const prefs = ensurePrefsMap(STATE);

  // Direct userId from email parsing
  if (normalized.userId) {
    return normalized.userId;
  }

  // Search through preferences for a matching channel link
  for (const [userId, userPrefs] of prefs) {
    switch (channel) {
      case CHANNELS.TELEGRAM:
        if (String(userPrefs.channels?.telegram?.chatId) === String(normalized.chatId)) {
          return userId;
        }
        break;
      case CHANNELS.DISCORD:
        if (String(userPrefs.channels?.discord?.userId) === String(normalized.userId)) {
          return userId;
        }
        break;
      case CHANNELS.EMAIL:
        if (userPrefs.channels?.email?.address === normalized.from) {
          return userId;
        }
        break;
    }
  }

  // Fallback: use the channel-specific identifier
  return `${channel}:${normalized.userId || normalized.chatId || normalized.from || "unknown"}`;
}

/**
 * Check if we're in quiet hours.
 */
function isQuietHours(notifSettings) {
  if (!notifSettings?.quietHoursStart || !notifSettings?.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = notifSettings.quietHoursStart.split(":").map(Number);
  const [endH, endM] = notifSettings.quietHoursEnd.split(":").map(Number);
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    // Same-day range (e.g., 09:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Overnight range (e.g., 22:00 - 08:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * Check if a notification type is enabled.
 */
function isNotificationEnabled(notifSettings, event) {
  if (!notifSettings) return true;

  const eventToSetting = {
    dtu_alert: "alerts",
    initiative: "initiatives",
    citation_alert: "alerts",
    digest: "digests",
    substrate_discovery: "alerts",
  };

  const setting = eventToSetting[event];
  if (setting && notifSettings[setting] === false) {
    return false;
  }

  return true;
}

/**
 * Format an event type into a human-readable title.
 */
function formatEventTitle(event) {
  const titles = {
    dtu_alert: "DTU Alert",
    initiative: "New Initiative",
    citation_alert: "Citation Alert",
    digest: "Your Digest",
    substrate_discovery: "Substrate Discovery",
    check_in: "Check-in",
    pending_work: "Pending Work",
  };
  return titles[event] || event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Basic HTML escaping for email content.
 */
function escapeForEmail(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}
