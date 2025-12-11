// ConcordOS Community Edition - server.js
// Monolithic backend for GitHub release
// Offline-first DTU Cognitive OS with stubs for advanced systems.

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --------------------------------------------------
// Path helpers
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// Env / config
// --------------------------------------------------
const PORT = process.env.PORT || "5050";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_CONFIGURED = !!OPENAI_API_KEY;

// Single state file for simple persistence
const STATE_FILE = path.join(__dirname, "concord-state.json");

// --------------------------------------------------
// In-memory state with lazy load/save
// --------------------------------------------------
let state = {
  dtus: [],
  osState: {
    temporalOS: true,
    realityOS: true,
    physicsOS: true,
    existentialOS: true,
    emotionalOS: true,
    motivationOS: true,
    perceptionOS: true,
    sensemakingOS: true,
  },
  autoprocessState: {
    dream: false,
    evolution: false,
    autogen: false,
    autocrawl: false,
    ticks: 0,
    lastTick: null,
    lastAutogen: null,
    lastEvolution: null,
  },
  autocrawlState: {
    enabled: false,
    crawledToday: 0,
    maxPerDay: 50,
    whitelist: [
      "oerproject.com",
      "openstax.org",
      "khanacademy.org",
      "creativecommons.org",
    ],
  },
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      state = {
        ...state,
        ...parsed,
        osState: { ...state.osState, ...(parsed.osState || {}) },
        autoprocessState: {
          ...state.autoprocessState,
          ...(parsed.autoprocessState || {}),
        },
        autocrawlState: {
          ...state.autocrawlState,
          ...(parsed.autocrawlState || {}),
        },
        dtus: Array.isArray(parsed.dtus) ? parsed.dtus : [],
      };
      console.log("[Concord] State loaded from", STATE_FILE);
    } else {
      console.log("[Concord] No existing state file, starting fresh.");
    }
  } catch (err) {
    console.error("[Concord] Failed to load state:", err);
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("[Concord] Failed to save state:", err);
  }
}

loadState();

// --------------------------------------------------
// DTU helpers
// --------------------------------------------------
function createDtuId() {
  const base = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `dtu_${base}_${rand}`;
}

function createDTUFromText({ title, content, tags = [], source = "manual" }) {
  const id = createDtuId();
  const dtu = {
    id,
    createdAt: new Date().toISOString(),
    meta: { title },
    content,
    tags,
    source,
  };
  state.dtus.unshift(dtu);
  saveState();
  return dtu;
}

// --------------------------------------------------
// LLM helper (optional; stub if no key)
// --------------------------------------------------
async function runLLMChat(systemPrompt, messages) {
  // If no API key, return simple stubbed reasoning
  if (!OPENAI_CONFIGURED) {
    const lastUser = messages.filter((m) => m.role === "user").pop();
    const userText = lastUser?.content || "";
    const snippet =
      state.dtus.slice(0, 2).map((d) => d.meta?.title || d.id).join(", ") ||
      "no DTUs yet";
    return `Offline stub reply.\n\nYou asked: "${userText.slice(
      0,
      400
    )}".\n\nConcordOS Community Edition is running without an external LLM key, so this is a local reasoning stub.\nKnown DTUs: ${snippet}`;
  }

  // Minimal OpenAI Chat Completions call using fetch
  const payload = {
    model: "gpt-4.1-mini",
    messages,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Concord] OpenAI error:", res.status, text);
    return `LLM error (${res.status}). Falling back to stub.`;
  }

  const data = await res.json();
  const content =
    data.choices?.[0]?.message?.content ||
    "No content returned from LLM (unexpected).";
  return content;
}

// --------------------------------------------------
// Express app
// --------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// --------------------------------------------------
// Status endpoint
// --------------------------------------------------
app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    service: "ConcordOS",
    version: "ConcordOS v0.1.0 â Community Edition (DTU Cognitive OS)",
    port: PORT,
    mode: process.env.CONCORD_MODE || (OPENAI_CONFIGURED ? "online" : "offline"),
    dtuCount: state.dtus.length,
    memoryCount: 0,
    simulationCount: 0,
  });
});

// --------------------------------------------------
// DTU endpoints
// --------------------------------------------------
app.get("/api/dtus", (req, res) => {
  res.json({ dtus: state.dtus });
});

app.get("/api/dtus/:id", (req, res) => {
  const dtu = state.dtus.find((d) => d.id === req.params.id);
  if (!dtu) {
    return res.status(404).json({ error: "DTU not found" });
  }
  res.json(dtu);
});

app.post("/api/dtus", (req, res) => {
  const { title, content, tags } = req.body || {};
  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "content (string) is required" });
  }
  const dtu = createDTUFromText({
    title: title || "Manual DTU",
    content,
    tags: Array.isArray(tags) ? tags : [],
    source: "manual",
  });
  res.json({ ok: true, dtu });
});

// --------------------------------------------------
// Ask Concord endpoint (online/offline)
// --------------------------------------------------
app.post("/api/ask", async (req, res) => {
  const { message, mode } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const offline = mode === "offline" || !OPENAI_CONFIGURED;
  const systemPrompt = offline
    ? "You are ConcordOS Community Edition running in offline mode. Use only the DTU context and reason carefully."
    : "You are ConcordOS Community Edition using DTUs plus an external LLM. Be precise, structured, and helpful.";

  const contextSnippet = state.dtus
    .slice(0, 8)
    .map((d) => `# ${d.meta?.title || d.id}\n${(d.content || "").slice(0, 400)}`)
    .join("\n\n");

  try {
    const reply = await runLLMChat(systemPrompt, [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: "Recent DTU context:\n" + (contextSnippet || "None yet."),
      },
      { role: "user", content: message },
    ]);

    const dtu = createDTUFromText({
      title: "Ask Concord",
      content: `Q: ${message}\n\nA: ${reply}`,
      tags: ["console", "ask"],
      source: "ask",
    });

    res.json({ reply, dtuId: dtu.id });
  } catch (err) {
    console.error("[Concord] /api/ask error:", err);
    res.status(500).json({ error: "Internal error in ask endpoint." });
  }
});

// --------------------------------------------------
// PersonaOS
// --------------------------------------------------
const personaDefinitions = [
  {
    id: "skeptic",
    label: "The Skeptic",
    style:
      "Question assumptions, look for weaknesses, and challenge every claim.",
  },
  {
    id: "socratic",
    label: "The Socratic",
    style: "Ask probing questions to refine the user's thinking.",
  },
  {
    id: "idealist",
    label: "The Idealist",
    style: "Seek the highest ethical and long-term outcome.",
  },
  {
    id: "pragmatist",
    label: "The Pragmatist",
    style:
      "Focus on what can actually be implemented with minimal friction now.",
  },
  {
    id: "strategist",
    label: "The Strategist",
    style: "Think long-term, multi-move planning with risk analysis.",
  },
];

const personaMemory = {};

function getPersonaLog(personaId) {
  if (!personaMemory[personaId]) {
    personaMemory[personaId] = [];
  }
  return personaMemory[personaId];
}

app.get("/api/personas", (req, res) => {
  res.json({ personas: personaDefinitions });
});

app.post("/api/persona/send", async (req, res) => {
  const { personaId, message } = req.body || {};
  if (!personaId || !message) {
    return res
      .status(400)
      .json({ error: "personaId and message are required." });
  }

  const persona = personaDefinitions.find((p) => p.id === personaId);
  if (!persona) {
    return res.status(400).json({ error: "Unknown personaId." });
  }

  const log = getPersonaLog(personaId);
  log.push({ role: "user", content: message });

  const systemPrompt = `You are the persona "${persona.label}". Style: ${persona.style}. Respond concisely but with depth.`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content:
        "You are part of a multi-persona ConcordOS reasoning council. Reference DTUs if helpful.",
    },
    ...log.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const reply = await runLLMChat(systemPrompt, messages);
    log.push({ role: "assistant", content: reply });

    const dtu = createDTUFromText({
      title: `PersonaOS: ${persona.label}`,
      content: `Persona: ${persona.label}\n\nUser: ${message}\n\nReply: ${reply}`,
      tags: ["persona", personaId],
      source: "persona",
    });

    res.json({ reply, dtuId: dtu.id });
  } catch (err) {
    console.error("[Concord] /api/persona/send error:", err);
    res.status(500).json({ error: "Internal error in persona endpoint." });
  }
});

// --------------------------------------------------
// Forge Mode (CRETI)
// --------------------------------------------------
app.post("/api/forge/suggest", async (req, res) => {
  const { seedDtuId, idea } = req.body || {};
  if (!idea) {
    return res.status(400).json({ error: "idea is required" });
  }

  const seed =
    seedDtuId && state.dtus.find((d) => d.id === seedDtuId)
      ? state.dtus.find((d) => d.id === seedDtuId)
      : null;

  const systemPrompt = `You are Concord Forge (CRETI engine).
Break ideas into:
- Core
- Reasoning
- Evidence
- Testing
- Impact
Return JSON with keys: core, reasoning, evidence, testing, impact, tags.`;

  const userPrompt = `Idea: ${idea}\n\nSeed DTU: ${
    seed ? seed.content.slice(0, 800) : "none"
  }`;

  let draft = {
    core: "",
    reasoning: "",
    evidence: "",
    testing: "",
    impact: "",
    tags: [],
  };

  try {
    const reply = await runLLMChat(systemPrompt, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    if (!OPENAI_CONFIGURED || reply.startsWith("Offline stub")) {
      // Offline stub formatting
      draft.core = idea;
      draft.reasoning =
        "High-level reasoning about this idea based on current DTUs.";
      draft.evidence = "Evidence would be gathered from ingested DTUs.";
      draft.testing = "Define tests or pilots to validate this idea.";
      draft.impact =
        "Describe short, medium, and long-term impact if this idea succeeds.";
      draft.tags = ["forge", "creti"];
    } else {
      // Try to parse LLM JSON; if fails, keep as plain text
      try {
        const parsed = JSON.parse(reply);
        draft = {
          ...draft,
          ...parsed,
          tags: Array.isArray(parsed.tags) ? parsed.tags : ["forge", "creti"],
        };
      } catch {
        draft.core = reply;
        draft.reasoning = "LLM returned non-JSON response; stored as core.";
        draft.tags = ["forge", "creti"];
      }
    }

    const content = `Core: ${draft.core}\n\nReasoning: ${draft.reasoning}\n\nEvidence: ${draft.evidence}\n\nTesting: ${draft.testing}\n\nImpact: ${draft.impact}`;
    const dtu = createDTUFromText({
      title: "Forge Draft",
      content,
      tags: draft.tags,
      source: "forge",
    });

    res.json({ draft, dtuId: dtu.id });
  } catch (err) {
    console.error("[Concord] /api/forge/suggest error:", err);
    res.status(500).json({ error: "Internal error in forge endpoint." });
  }
});

// --------------------------------------------------
// OS Stack
// --------------------------------------------------
app.get("/api/os/state", (req, res) => {
  res.json(state.osState);
});

app.post("/api/os/toggle", (req, res) => {
  const { key } = req.body || {};
  if (!key || !(key in state.osState)) {
    return res.status(400).json({ error: "Unknown OS key", key });
  }
  state.osState[key] = !state.osState[key];
  saveState();
  res.json(state.osState);
});

// --------------------------------------------------
// Autoprocess (dream / evolution / autogen / heartbeat)
// --------------------------------------------------
app.get("/api/autoprocess/state", (req, res) => {
  res.json(state.autoprocessState);
});

app.post("/api/autoprocess/toggle", (req, res) => {
  const { key } = req.body || {};
  if (!key || !(key in state.autoprocessState)) {
    return res.status(400).json({ error: "Unknown autoprocess key", key });
  }
  if (["ticks", "lastTick", "lastAutogen", "lastEvolution"].includes(key)) {
    return res.status(400).json({ error: "Cannot toggle counter field", key });
  }
  state.autoprocessState[key] = !state.autoprocessState[key];
  saveState();
  res.json(state.autoprocessState);
});

app.post("/api/autoprocess/heartbeat", async (req, res) => {
  const now = new Date().toISOString();
  state.autoprocessState.ticks += 1;
  state.autoprocessState.lastTick = now;

  try {
    // evolution: refine latest DTU
    if (state.autoprocessState.evolution && state.dtus.length > 0) {
      const target = state.dtus[0];
      const systemPrompt =
        "You are Concord Evolution. Refine and clarify the DTU content while preserving original meaning.";
      const refined = await runLLMChat(systemPrompt, [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Refine this DTU:\n\n${target.content.slice(0, 2000)}`,
        },
      ]);
      createDTUFromText({
        title: `${target.meta?.title || target.id} (evolved)`,
        content: refined,
        tags: [...(target.tags || []), "evolved"],
        source: "evolution",
      });
      state.autoprocessState.lastEvolution = now;
    }

    // autogen: create new DTU from context
    if (state.autoprocessState.autogen) {
      const contextSnippet = state.dtus
        .slice(0, 5)
        .map((d) => d.meta?.title || d.id)
        .join(", ");
      const systemPrompt =
        "You are Concord Autogen. Propose one new DTU idea based on recent DTUs.";
      const reply = await runLLMChat(systemPrompt, [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Recent DTUs: ${contextSnippet || "none yet"}`,
        },
      ]);
      createDTUFromText({
        title: "Autogen DTU",
        content: reply,
        tags: ["autogen"],
        source: "autogen",
      });
      state.autoprocessState.lastAutogen = now;
    }

    saveState();
    res.json(state.autoprocessState);
  } catch (err) {
    console.error("[Concord] heartbeat error:", err);
    res.status(500).json({ error: "Heartbeat internal error." });
  }
});

// --------------------------------------------------
// Autocrawl (Community Edition stub - no real crawling)
// --------------------------------------------------
app.get("/api/autocrawl/state", (req, res) => {
  res.json(state.autocrawlState);
});

app.post("/api/autocrawl/toggle", (req, res) => {
  state.autocrawlState.enabled = !state.autocrawlState.enabled;
  saveState();
  res.json(state.autocrawlState);
});

// --------------------------------------------------
// Community Edition stubs for advanced systems
// --------------------------------------------------
function stubEndpoint(label) {
  return (req, res) => {
    res.json({
      ok: true,
      system: label,
      edition: "ConcordOS Community Edition",
      status: "stub",
      note:
        "Full logic is available in Concord Global / CRI deployments, not in the open-source community server.",
    });
  };
}

app.get("/api/marketplace/status", stubEndpoint("DTU Marketplace"));
app.get("/api/cri/status", stubEndpoint("Concord Research Institute"));
app.get("/api/quests/status", stubEndpoint("Quest Engine"));
app.get("/api/treasury/status", stubEndpoint("Concord Treasury"));
app.get("/api/usb/status", stubEndpoint("USB Infrastructure"));

// --------------------------------------------------
// Start server
// --------------------------------------------------
app.listen(Number(PORT), () => {
  console.log(
    `ConcordOS v0.1.0 â Community Edition running on port ${PORT} (DTU Cognitive OS)`
  );
  console.log(
    OPENAI_CONFIGURED
      ? "[Concord] External LLM is configured (OPENAI_API_KEY present)."
      : "[Concord] No LLM key found. Running in offline stub mode."
  );
});