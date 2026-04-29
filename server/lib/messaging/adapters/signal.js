// server/lib/messaging/adapters/signal.js
// Signal Messenger adapter via signal-cli HTTP API.
// Requires: SIGNAL_CLI_URL (e.g., http://localhost:8080), SIGNAL_PHONE_NUMBER
// Signal has no hosted bot API — this adapter talks to a local signal-cli daemon.

const CLI_URL = (process.env.SIGNAL_CLI_URL || "").replace(/\/$/, "");
const PHONE = process.env.SIGNAL_PHONE_NUMBER || "";

export const platform = "signal";

export function isConfigured() {
  return Boolean(CLI_URL && PHONE);
}

/** Signal doesn't use webhook signatures — trust network-local calls only */
export function verifyIncoming(_req) {
  return isConfigured();
}

/** Parse a signal-cli REST API inbound message event */
export function parseIncoming(body) {
  try {
    // signal-cli /v1/receive format
    const envelope = body?.envelope || body;
    const dataMessage = envelope?.dataMessage;
    if (!dataMessage) return { ok: false, type: "unsupported", text: "", externalId: "", chatId: "", platform, raw: body };

    return {
      ok: true,
      type: "text",
      text: dataMessage.message || "",
      externalId: envelope.source || envelope.sourceNumber || "",
      chatId: envelope.source || envelope.sourceNumber || "",
      platform,
      messageId: String(envelope.timestamp || Date.now()),
      raw: body,
    };
  } catch {
    return { ok: false, type: "unsupported", text: "", externalId: "", chatId: "", platform, raw: body };
  }
}

/** Send a message via signal-cli REST API */
export async function sendMessage(recipient, text) {
  if (!isConfigured()) return { ok: false, error: "signal_not_configured" };

  try {
    const res = await fetch(`${CLI_URL}/v2/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: String(text).slice(0, 2000),
        number: PHONE,
        recipients: [recipient],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, error: `signal-cli ${res.status}: ${err}` };
    }

    const data = await res.json().catch(() => null);
    return { ok: true, messageId: String(data?.timestamp || Date.now()) };
  } catch (err) {
    return { ok: false, error: err?.message || "signal_send_failed" };
  }
}

/** Poll for new messages from signal-cli (use when webhooks not available) */
export async function pollMessages() {
  if (!isConfigured()) return [];

  try {
    const res = await fetch(`${CLI_URL}/v1/receive/${encodeURIComponent(PHONE)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
