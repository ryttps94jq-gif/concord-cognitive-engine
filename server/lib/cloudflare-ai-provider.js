// @env-config-ok: intentional external URL references
// server/lib/cloudflare-ai-provider.js
//
// Cloudflare Workers AI adapter (NOT OpenAI-compatible — custom format).
//
// Endpoint: https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}
// Auth: Authorization: Bearer ${API_TOKEN}
// Models: @cf/meta/llama-3.1-8b-instruct, @cf/mistral/mistral-7b-instruct-v0.1
//
// Returns same shape as ollamaChat: {ok, text, toolCalls, tokensIn, tokensOut, error?}

import { scanMessagesForLeaks } from "./outbound-content-guard.js";

const DEFAULT_TIMEOUT_MS = 60_000;

async function cloudflareChat({ apiKey, modelId, messages, opts = {} }) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    return { ok: false, text: "", toolCalls: [], tokensIn: 0, tokensOut: 0, error: "cloudflare_account_id_missing" };
  }

  const body = {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  };

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId || "@cf/meta/llama-3.1-8b-instruct"}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, text: "", toolCalls: [], tokensIn: 0, tokensOut: 0, error: `cloudflare_${res.status}: ${err.slice(0, 200)}` };
    }

    const j = await res.json();
    if (j.errors?.length) {
      return { ok: false, text: "", toolCalls: [], tokensIn: 0, tokensOut: 0, error: `cloudflare_error: ${j.errors[0].message}` };
    }

    return {
      ok: true,
      text: j.response || "",
      toolCalls: [], // Cloudflare doesn't support tool calls in free tier
      tokensIn: j.tokens_in || 0,
      tokensOut: j.tokens_out || 0,
    };
  } catch (err) {
    return { ok: false, text: "", toolCalls: [], tokensIn: 0, tokensOut: 0, error: err?.message || String(err) };
  }
}

export default cloudflareChat;
