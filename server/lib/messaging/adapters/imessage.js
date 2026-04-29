// server/lib/messaging/adapters/imessage.js
// iMessage adapter via BlueBubbles bridge (or compatible HTTP API).
// iMessage has no official API — this requires a macOS host running BlueBubbles server.
// Requires: IMESSAGE_BRIDGE_URL, IMESSAGE_BRIDGE_PASSWORD

const BRIDGE_URL = (process.env.IMESSAGE_BRIDGE_URL || "").replace(/\/$/, "");
const BRIDGE_PASSWORD = process.env.IMESSAGE_BRIDGE_PASSWORD || "";

export const platform = "imessage";

export function isConfigured() {
  return Boolean(BRIDGE_URL);
}

/** BlueBubbles webhook sends a shared password header */
export function verifyIncoming(req) {
  if (!BRIDGE_PASSWORD) return isConfigured();
  const provided = req.headers?.["x-bluebubbles-password"] || req.query?.password || "";
  return provided === BRIDGE_PASSWORD;
}

/** Parse BlueBubbles webhook payload */
export function parseIncoming(body) {
  try {
    const data = body?.data || body;
    const type = body?.type || "";

    if (type !== "new-message" && type !== "updated-message") {
      return { ok: false, type: "unsupported", text: "", externalId: "", chatId: "", platform, raw: body };
    }

    const text = data?.text || data?.subject || "";
    const handle = data?.handle?.id || data?.chats?.[0]?.participants?.[0]?.id || "";

    return {
      ok: true,
      type: "text",
      text,
      externalId: handle,
      chatId: data?.chats?.[0]?.guid || handle,
      platform,
      messageId: data?.guid || data?.id || String(Date.now()),
      raw: body,
    };
  } catch {
    return { ok: false, type: "unsupported", text: "", externalId: "", chatId: "", platform, raw: body };
  }
}

/** Send a message via BlueBubbles REST API */
export async function sendMessage(chatGuid, text) {
  if (!isConfigured()) return { ok: false, error: "imessage_bridge_not_configured" };

  try {
    const url = new URL(`${BRIDGE_URL}/api/v1/message/text`);
    if (BRIDGE_PASSWORD) url.searchParams.set("password", BRIDGE_PASSWORD);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatGuid,
        message: String(text).slice(0, 65535),
        method: "apple-script",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, error: `BlueBubbles ${res.status}: ${err}` };
    }

    const data = await res.json().catch(() => null);
    return { ok: true, messageId: data?.data?.guid || data?.guid || String(Date.now()) };
  } catch (err) {
    return { ok: false, error: err?.message || "imessage_send_failed" };
  }
}
