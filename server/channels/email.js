/**
 * Email Channel — SendGrid Integration
 *
 * Outbound: Sends formatted HTML emails for notifications, alerts,
 * brain responses, and initiative messages via SendGrid's v3 API.
 *
 * Inbound: Handles SendGrid Inbound Parse webhook payloads to
 * route incoming emails to the chat pipeline.
 *
 * Uses the native https module — no external dependencies.
 *
 * Env:
 *   SENDGRID_API_KEY  — SendGrid API key
 *   EMAIL_FROM        — Default sender address (falls back to noreply@concord-os.org)
 *   EMAIL_FROM_NAME   — Sender display name (falls back to "Concord")
 *
 * Exports:
 *   sendEmail(to, subject, html)       — Send an HTML email
 *   handleInboundEmail(payload)        — Process a SendGrid inbound parse webhook
 */

import https from "https";
import logger from "../logger.js";

// ── Configuration ──────────────────────────────────────────────────────────

const API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@concord-os.org";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Concord";

// ── Internal HTTP helper ───────────────────────────────────────────────────

/**
 * Make a POST request to the SendGrid v3 API.
 *
 * @param {string} endpoint - API path (e.g., "/v3/mail/send")
 * @param {object} body     - JSON-serializable request body
 * @returns {Promise<object>}
 */
function sendgridAPI(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const options = {
      method: "POST",
      hostname: "api.sendgrid.com",
      path: endpoint,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 20_000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");

        // SendGrid returns 202 Accepted on success with empty body
        if (res.statusCode === 202 || res.statusCode === 200) {
          resolve({ ok: true, status: res.statusCode });
          return;
        }

        try {
          const json = JSON.parse(text);
          logger.warn("email", `SendGrid API error: ${endpoint}`, {
            status: res.statusCode,
            errors: json.errors,
          });
          resolve({ ok: false, status: res.statusCode, errors: json.errors || [] });
        } catch {
          resolve({ ok: false, status: res.statusCode, raw: text.slice(0, 500) });
        }
      });
    });

    req.on("error", (err) => reject(new Error(`SendGrid network error: ${err.message}`)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("SendGrid API request timed out"));
    });

    req.write(payload);
    req.end();
  });
}

// ── Outbound ───────────────────────────────────────────────────────────────

/**
 * Send an HTML email via SendGrid.
 *
 * @param {string|string[]} to    - Recipient email address(es)
 * @param {string} subject        - Email subject line
 * @param {string} html           - HTML body content
 * @param {object} [opts]
 * @param {string} [opts.text]    - Plain text fallback
 * @param {string} [opts.from]    - Override sender address
 * @param {string} [opts.fromName] - Override sender name
 * @param {string} [opts.replyTo] - Reply-to address
 * @param {object} [opts.headers] - Custom email headers
 * @returns {Promise<object>}
 */
export async function sendEmail(to, subject, html, opts = {}) {
  if (!API_KEY) {
    logger.warn("email", "SENDGRID_API_KEY not configured, logging email instead");
    logger.info("email", "Email (dev mode)", { to, subject, htmlLength: html?.length });
    return { ok: false, error: "not_configured", devMode: true };
  }

  if (!to || !subject) {
    return { ok: false, error: "missing_to_or_subject" };
  }

  // Normalize recipients
  const recipients = Array.isArray(to) ? to : [to];
  const personalizations = [{
    to: recipients.map((email) => ({ email: String(email).trim() })),
  }];

  const body = {
    personalizations,
    from: {
      email: opts.from || FROM_EMAIL,
      name: opts.fromName || FROM_NAME,
    },
    subject: String(subject).slice(0, 998), // RFC 2822 limit
    content: [],
  };

  // Add plain text if provided
  if (opts.text) {
    body.content.push({ type: "text/plain", value: String(opts.text) });
  }

  // Add HTML content
  if (html) {
    body.content.push({ type: "text/html", value: String(html) });
  }

  // Fallback: ensure at least one content block
  if (body.content.length === 0) {
    body.content.push({ type: "text/plain", value: "(no content)" });
  }

  if (opts.replyTo) {
    body.reply_to = { email: opts.replyTo };
  }

  if (opts.headers) {
    body.headers = opts.headers;
  }

  try {
    const result = await sendgridAPI("/v3/mail/send", body);
    logger.info("email", "Email sent", {
      to: recipients.join(", "),
      subject,
      ok: result.ok,
    });
    return result;
  } catch (err) {
    logger.error("email", "sendEmail failed", {
      to: recipients.join(", "),
      error: err.message,
    });
    return { ok: false, error: err.message };
  }
}

/**
 * Send a notification email using a standard template.
 *
 * @param {string} to
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} [opts.severity="info"] - "info"|"warning"|"critical"
 * @param {string} [opts.actionUrl]
 * @param {string} [opts.actionLabel]
 * @returns {Promise<object>}
 */
export async function sendNotification(to, opts = {}) {
  const colorMap = {
    info: "#3498db",
    warning: "#f39c12",
    critical: "#e74c3c",
    success: "#2ecc71",
  };

  const color = colorMap[opts.severity] || colorMap.info;
  const title = opts.title || "Notification";
  const bodyText = opts.body || "";

  const actionButton = opts.actionUrl
    ? `<p style="margin-top:16px"><a href="${escapeHtml(opts.actionUrl)}" style="display:inline-block;padding:10px 20px;background:${color};color:#fff;text-decoration:none;border-radius:4px;font-weight:600">${escapeHtml(opts.actionLabel || "View Details")}</a></p>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff">
    <tr>
      <td style="padding:24px 32px;border-left:4px solid ${color}">
        <h2 style="margin:0 0 12px;color:#333;font-size:20px">${escapeHtml(title)}</h2>
        <p style="margin:0;color:#555;font-size:15px;line-height:1.5">${escapeHtml(bodyText)}</p>
        ${actionButton}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;color:#999;font-size:12px;border-top:1px solid #eee">
        Concord Cognitive Engine &middot; You received this because of your notification settings.
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `${title}\n\n${bodyText}${opts.actionUrl ? `\n\n${opts.actionLabel || "View Details"}: ${opts.actionUrl}` : ""}`;

  return sendEmail(to, title, html, { text });
}

/**
 * Send an initiative message email.
 *
 * @param {string} to
 * @param {object} initiative - Initiative object from the initiative engine
 * @returns {Promise<object>}
 */
export async function sendInitiativeEmail(to, initiative) {
  const priority = initiative.priority || "normal";
  const severity = priority === "urgent" ? "critical" : priority === "high" ? "warning" : "info";

  return sendNotification(to, {
    title: initiative.title || "Concord has something for you",
    body: initiative.body || initiative.message || "",
    severity,
    actionUrl: initiative.actionUrl || null,
    actionLabel: initiative.actionLabel || "Open in Concord",
  });
}

// ── Inbound: SendGrid Parse ────────────────────────────────────────────────

/**
 * Handle a SendGrid Inbound Parse webhook payload.
 *
 * SendGrid sends multipart/form-data or JSON depending on configuration.
 * This expects the JSON payload variant (or pre-parsed body).
 *
 * Returns a normalized payload suitable for routing through the chat pipeline.
 *
 * @param {object} payload - Parsed inbound email fields
 * @returns {{ ok: boolean, type: string, from?: string, to?: string, subject?: string, text?: string, html?: string, userId?: string }}
 */
export function handleInboundEmail(payload) {
  if (!payload) {
    return { ok: false, type: "empty" };
  }

  const from = extractEmailAddress(payload.from || payload.sender || "");
  const to = extractEmailAddress(payload.to || payload.recipient || "");
  const subject = payload.subject || "";
  const text = payload.text || payload["stripped-text"] || "";
  const html = payload.html || payload["stripped-html"] || "";
  const spamScore = parseFloat(payload.spam_score || payload.SPF || "0");

  // Basic spam check
  if (spamScore > 5.0) {
    logger.warn("email", "Inbound email flagged as spam", { from, spamScore });
    return { ok: false, type: "spam", from, spamScore };
  }

  if (!from || !text) {
    return { ok: false, type: "invalid", reason: "missing_from_or_text" };
  }

  // Extract a user identifier from the To field
  // Convention: <userId>@inbound.concord-os.org
  const userMatch = to.match(/^([^@]+)@/);
  const userId = userMatch ? userMatch[1] : null;

  return {
    ok: true,
    type: "email",
    from,
    to,
    subject,
    text: text.slice(0, 10000), // Reasonable limit
    html: html.slice(0, 50000),
    userId,
    messageId: payload["Message-Id"] || payload.message_id || null,
    inReplyTo: payload["In-Reply-To"] || null,
    envelope: payload.envelope ? safeJsonParse(payload.envelope) : null,
    attachmentCount: parseInt(payload.attachments || "0", 10),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract a bare email address from a "Name <email>" string.
 *
 * @param {string} raw
 * @returns {string}
 */
function extractEmailAddress(raw) {
  if (!raw) return "";
  const match = String(raw).match(/<([^>]+)>/);
  return match ? match[1].trim() : String(raw).trim();
}

/**
 * Escape HTML special characters.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Safe JSON parse with fallback.
 *
 * @param {string} str
 * @returns {object|null}
 */
function safeJsonParse(str) {
  try {
    return typeof str === "string" ? JSON.parse(str) : str;
  } catch {
    return null;
  }
}

/**
 * Check whether the email channel is configured.
 *
 * @returns {boolean}
 */
export function isConfigured() {
  return Boolean(API_KEY);
}
