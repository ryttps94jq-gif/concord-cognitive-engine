import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "./api.js";
import concordLogo from "./assets/concord.png";

/**
 * ConcordOS v1 — Frontend Monolith (App.jsx)
 * Connects to your server routes:
 *  GET  /api/status
 *  GET  /api/jobs/status
 *  POST /api/jobs/toggle
 *  GET  /api/dtus
 *  POST /api/dtus
 *  POST /api/forge
 *  POST /api/chat
 *  POST /api/ask
 *  GET  /api/personas
 *  POST /api/personas/:id/speak
 *  POST /api/personas/:id/animate
 *  POST /api/council/debate
 *  POST /api/swarm/run
 *  GET  /api/simulations
 *  POST /api/simulations/whatif
 *  GET  /api/marketplace/listings
 *  GET  /api/global/feed
 *  GET  /api/events
 *
 * No full-screen overlays/modals/backdrops are rendered (prevents the “black circle” issue).
 */

const API_BASE =
  (import.meta?.env?.VITE_API_BASE && String(import.meta.env.VITE_API_BASE)) ||
  "http://localhost:5050";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "jobs", label: "Builder / Jobs" },
  { id: "chat", label: "Chat" },
  { id: "dtus", label: "DTUs" },
  { id: "forge", label: "Forge" },
  { id: "personas", label: "Personas" },
  { id: "council", label: "Council" },
  { id: "swarm", label: "Swarm" },
  { id: "sim", label: "Simulation" },
  { id: "market", label: "Marketplace" },
  { id: "global", label: "Global" },
];

const PERSONA_ART = {
  p_ethicist: new URL("./assets/personas/ethicist.png", import.meta.url).href,
  p_engineer: new URL("./assets/personas/engineer.png", import.meta.url).href,
  p_historian: new URL("./assets/personas/historian.png", import.meta.url).href,
  p_economist: new URL("./assets/personas/economist.png", import.meta.url).href,
};

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}
function safeStr(x) {
  try {
    return typeof x === "string" ? x : JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}
function clampText(s, n = 2400) {
  return String(s || "").slice(0, n);
}
function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

// local UI-only “builder mode” toggle (does NOT affect backend)
function getBuilderModeLocal() {
  try {
    return localStorage.getItem("concord_builder_mode") === "1";
  } catch {
    return false;
  }
}
function setBuilderModeLocal(v) {
  try {
    localStorage.setItem("concord_builder_mode", v ? "1" : "0");
  } catch {}
}

export default function App() {
  // ---- global ui
  const [tab, setTab] = useState("overview");
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimerRef = useRef(null);

  // ---- backend state
  const [status, setStatus] = useState(null);
  const [jobsState, setJobsState] = useState(null);
  const [events, setEvents] = useState([]);
  const [dtus, setDtus] = useState([]);

  // ---- DTU library / inspector
  const [selectedDTUId, setSelectedDTUId] = useState(null);
  const [dtuSearch, setDtuSearch] = useState("");
  const [dtuPage, setDtuPage] = useState(1);
  const DTU_PAGE_SIZE = 22;

  // ---- chat (global)
  const [chatMsg, setChatMsg] = useState("");
  const [chatMode, setChatMode] = useState("overview");
  const [chatOut, setChatOut] = useState(null);
  const [busyChat, setBusyChat] = useState(false);

  // ---- ask (DTU-scoped)
  const [askMsg, setAskMsg] = useState("");
  const [askOut, setAskOut] = useState(null);
  const [busyAsk, setBusyAsk] = useState(false);

  // ---- create DTU
  const [dtuTitle, setDtuTitle] = useState("");
  const [dtuTags, setDtuTags] = useState("core");
  const [dtuContent, setDtuContent] = useState("");
  const [busyCreateDTU, setBusyCreateDTU] = useState(false);

  // ---- forge
  const [forgeTitle, setForgeTitle] = useState("Forge DTU");
  const [forgeTags, setForgeTags] = useState("forge");
  const [forgeContent, setForgeContent] = useState("");
  const [busyForge, setBusyForge] = useState(false);
  const [forgeOut, setForgeOut] = useState(null);

  // ---- personas
  const [personas, setPersonas] = useState([]);
  const [personaId, setPersonaId] = useState("p_ethicist");
  const [personaText, setPersonaText] = useState("Hello. I’m ready.");
  const [personaCue, setPersonaCue] = useState({ state: "idle", intensity: 0.2, durationMs: 800 });
  const [busyPersona, setBusyPersona] = useState(false);

  // ---- council
  const [councilTopic, setCouncilTopic] = useState("hi");
  const [councilOut, setCouncilOut] = useState(null);
  const [busyCouncil, setBusyCouncil] = useState(false);

  // ---- swarm
  const [swarmPrompt, setSwarmPrompt] = useState("");
  const [swarmCount, setSwarmCount] = useState(6);
  const [swarmOut, setSwarmOut] = useState(null);
  const [busySwarm, setBusySwarm] = useState(false);

  // ---- simulation
  const [simTitle, setSimTitle] = useState("What-if");
  const [simPrompt, setSimPrompt] = useState("");
  const [simAssumptions, setSimAssumptions] = useState("");
  const [simOut, setSimOut] = useState(null);
  const [busySim, setBusySim] = useState(false);

  // ---- global feed
  const [globalFeed, setGlobalFeed] = useState(null);

  // ---- jobs/ingest/autocrawl UI
  const [builderMode, setBuilderMode] = useState(getBuilderModeLocal());
  const [jobsBusy, setJobsBusy] = useState(false);
  const [jobsErr, setJobsErr] = useState(null);

  const [ingestText, setIngestText] = useState("");
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestTags, setIngestTags] = useState("ingest");
  const [busyIngest, setBusyIngest] = useState(false);

  const [autocrawlUrl, setAutocrawlUrl] = useState("");
  const [autocrawlTags, setAutocrawlTags] = useState("autocrawl");
  const [busyAutocrawl, setBusyAutocrawl] = useState(false);

  // ---------------- toast ----------------
  function toast(text) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(String(text || ""));
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2600);
  }

  // ---------------- cue animation ----------------
  function applyCue(cue) {
    if (!cue) return;
    const next = {
      state: cue.state || "talk",
      intensity: Number(cue.intensity ?? 0.6),
      durationMs: Number(cue.durationMs ?? 1200),
    };
    setPersonaCue(next);

    // auto-return to idle after duration
    const ms = Math.max(250, Math.min(6000, next.durationMs || 1200));
    window.setTimeout(() => {
      setPersonaCue((prev) => ({ ...prev, state: "idle", intensity: 0.2, durationMs: 800 }));
    }, ms);
  }

  function speakBrowser(text) {
    try {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  // ---------------- fetchers ----------------
  async function refreshStatus({ silent = false } = {}) {
    try {
      const out = await apiGet(`${API_BASE}/api/status`);
      setStatus(out);
      if (!silent && out?.ok) toast("Status updated");
    } catch (e) {
      if (!silent) toast(`Status error: ${String(e?.message || e)}`);
    }
  }

  async function refreshJobs({ silent = false } = {}) {
    setJobsErr(null);
    try {
      const out = await apiGet(`${API_BASE}/api/jobs/status`);
      setJobsState(out);
      if (!silent && out?.ok) toast("Jobs updated");
    } catch (e) {
      setJobsErr(String(e?.message || e));
      if (!silent) toast(`Jobs error: ${String(e?.message || e)}`);
    }
  }

  async function refreshDTUs({ silent = false } = {}) {
    try {
      const out = await apiGet(`${API_BASE}/api/dtus`);
      // server returns { ok:true, dtus } in your latest, but handle older too
      const list = Array.isArray(out?.dtus) ? out.dtus : Array.isArray(out) ? out : [];
      setDtus(list);
      if (!silent) toast(`DTUs loaded (${list.length})`);
      // keep selected id if still exists
      if (selectedDTUId && !list.some((d) => d.id === selectedDTUId)) {
        setSelectedDTUId(list[0]?.id || null);
      }
    } catch (e) {
      if (!silent) toast(`DTU error: ${String(e?.message || e)}`);
    }
  }

  async function refreshPersonas({ silent = false } = {}) {
    try {
      const out = await apiGet(`${API_BASE}/api/personas`);
      const list = Array.isArray(out?.personas) ? out.personas : Array.isArray(out) ? out : [];
      setPersonas(list);
      if (!silent) toast(`Personas loaded (${list.length || 0})`);
    } catch (e) {
      if (!silent) toast(`Persona error: ${String(e?.message || e)}`);
    }
  }

  async function refreshEvents({ silent = true } = {}) {
    try {
      const out = await apiGet(`${API_BASE}/api/events`);
      const list = Array.isArray(out?.events) ? out.events : [];
      setEvents(list);
    } catch {}
  }

  async function refreshAll({ silent = true } = {}) {
    await Promise.all([
      refreshStatus({ silent }),
      refreshJobs({ silent: true }),
      refreshDTUs({ silent: true }),
      refreshPersonas({ silent: true }),
      refreshEvents({ silent: true }),
    ]);
  }

  // initial load
  useEffect(() => {
    refreshAll({ silent: true }).catch(() => {});
    // periodic refresh (keeps “dream/autogen/heartbeat” visible as DTUs grow)
    const t = setInterval(() => refreshDTUs({ silent: true }).catch(() => {}), 7000);
    const t2 = setInterval(() => refreshJobs({ silent: true }).catch(() => {}), 5000);
    return () => {
      clearInterval(t);
      clearInterval(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // if dtus loaded but none selected, select first
  useEffect(() => {
    if (!selectedDTUId && dtus.length) setSelectedDTUId(dtus[0].id);
  }, [dtus, selectedDTUId]);

  // ---------------- computed ----------------
  const filteredDTUs = useMemo(() => {
    const q = dtuSearch.trim().toLowerCase();
    if (!q) return dtus;
    return dtus.filter((d) => {
      const title = d?.meta?.title || "";
      const tags = Array.isArray(d?.tags) ? d.tags.join(" ") : "";
      const body = d?.content || "";
      return (
        String(title).toLowerCase().includes(q) ||
        String(tags).toLowerCase().includes(q) ||
        String(body).toLowerCase().includes(q)
      );
    });
  }, [dtus, dtuSearch]);

  const dtuPageCount = Math.max(1, Math.ceil(filteredDTUs.length / DTU_PAGE_SIZE));
  const dtuPageSafe = Math.min(Math.max(1, dtuPage), dtuPageCount);

  const pagedDTUs = useMemo(() => {
    const start = (dtuPageSafe - 1) * DTU_PAGE_SIZE;
    return filteredDTUs.slice(start, start + DTU_PAGE_SIZE);
  }, [filteredDTUs, dtuPageSafe]);

  const selectedDTU = useMemo(() => {
    return dtus.find((d) => d.id === selectedDTUId) || null;
  }, [dtus, selectedDTUId]);

  const currentPersona = useMemo(() => {
    const fromBackend = personas.find((p) => p.id === personaId);
    return (
      fromBackend ||
      { id: personaId, name: personaId.replace("p_", ""), style: "" }
    );
  }, [personas, personaId]);

  // ---------------- actions ----------------
  async function doChat() {
    const m = chatMsg.trim();
    if (!m) return toast("Type a message first.");
    setBusyChat(true);
    setChatOut(null);
    try {
      const out = await apiPost(`${API_BASE}/api/chat`, { message: m, mode: chatMode });
      setChatOut(out);
      if (out?.cue) applyCue(out.cue);
      if (out?.reply) toast("Chat replied");
    } catch (e) {
      toast(`Chat error: ${String(e?.message || e)}`);
    } finally {
      setBusyChat(false);
    }
  }

  async function doAskSelectedDTU() {
    const q = askMsg.trim();
    if (!q) return toast("Ask something first.");
    if (!selectedDTU) return toast("Select a DTU first.");
    setBusyAsk(true);
    setAskOut(null);
    try {
      // Your server has /api/ask AND /api/chat.
      // /api/ask should be the “Ask Concord across DTUs” endpoint (LLM + DTU sift).
      const out = await apiPost(`${API_BASE}/api/ask`, {
        question: q,
        dtuId: selectedDTU.id,
        // optional: pass current DTU content to help, server may ignore
        context: {
          title: selectedDTU?.meta?.title || "",
          tags: selectedDTU?.tags || [],
          content: selectedDTU?.content || "",
        },
      });
      setAskOut(out);
      if (out?.cue) applyCue(out.cue);
    } catch (e) {
      toast(`Ask error: ${String(e?.message || e)}`);
    } finally {
      setBusyAsk(false);
    }
  }

  async function doCreateDTU() {
    const c = dtuContent.trim();
    if (!c) return toast("DTU content required.");
    setBusyCreateDTU(true);
    try {
      const tags = dtuTags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const out = await apiPost(`${API_BASE}/api/dtus`, {
        title: dtuTitle || "DTU",
        content: c,
        tags,
        source: "manual",
      });
      if (!out?.ok) throw new Error(out?.error || "DTU create failed");
      toast("DTU created");
      setDtuTitle("");
      setDtuContent("");
      await refreshDTUs({ silent: true });
    } catch (e) {
      toast(`Create error: ${String(e?.message || e)}`);
    } finally {
      setBusyCreateDTU(false);
    }
  }

  async function doForge() {
    const c = forgeContent.trim();
    if (!c) return toast("Forge content required.");
    setBusyForge(true);
    setForgeOut(null);
    try {
      const tags = forgeTags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const out = await apiPost(`${API_BASE}/api/forge`, {
        title: forgeTitle || "Forge DTU",
        content: c,
        tags,
        source: "forge",
      });
      setForgeOut(out);
      if (out?.cue) applyCue(out.cue);
      toast("Forge created a DTU");
      await refreshDTUs({ silent: true });
    } catch (e) {
      toast(`Forge error: ${String(e?.message || e)}`);
    } finally {
      setBusyForge(false);
    }
  }

  async function doPersonaSpeak() {
    const t = personaText.trim();
    if (!t) return toast("Enter persona text.");
    setBusyPersona(true);
    try {
      const out = await apiPost(`${API_BASE}/api/personas/${personaId}/speak`, { text: t });
      if (!out?.ok) throw new Error(out?.error || "Speak failed");
      if (out?.cue) applyCue(out.cue);
      // optional: speech in browser
      if (out?.speech?.engine === "browser_speechsynthesis") speakBrowser(t);
      toast(`${currentPersona?.name || "Persona"} spoke`);
    } catch (e) {
      toast(`Speak error: ${String(e?.message || e)}`);
    } finally {
      setBusyPersona(false);
    }
  }

  async function doPersonaAnimate(kind) {
    setBusyPersona(true);
    try {
      const out = await apiPost(`${API_BASE}/api/personas/${personaId}/animate`, { kind });
      if (!out?.ok) throw new Error(out?.error || "Animate failed");
      if (out?.cue) applyCue(out.cue);
      toast(`Cue: ${out?.cue?.state || kind}`);
    } catch (e) {
      toast(`Animate error: ${String(e?.message || e)}`);
    } finally {
      setBusyPersona(false);
    }
  }

  async function doCouncil() {
    setBusyCouncil(true);
    setCouncilOut(null);
    try {
      const out = await apiPost(`${API_BASE}/api/council/debate`, {
        topic: councilTopic || "Debate",
        // optional parents: last 2 selected dtus if any
        dtuA: dtus[0]?.id,
        dtuB: dtus[1]?.id,
      });
      if (!out?.ok) throw new Error(out?.error || "Council failed");
      setCouncilOut(out);
      if (out?.debate?.cue) applyCue(out.debate.cue);
      toast("Council completed");
      await refreshDTUs({ silent: true });
    } catch (e) {
      toast(`Council error: ${String(e?.message || e)}`);
    } finally {
      setBusyCouncil(false);
    }
  }

  async function doSwarm() {
    const p = swarmPrompt.trim();
    if (!p) return toast("Enter a swarm prompt.");
    setBusySwarm(true);
    setSwarmOut(null);
    try {
      const out = await apiPost(`${API_BASE}/api/swarm/run`, { prompt: p, count: Number(swarmCount || 6) });
      if (!out?.ok) throw new Error(out?.error || "Swarm failed");
      setSwarmOut(out);
      if (out?.cue) applyCue(out.cue);
      toast("Swarm completed");
    } catch (e) {
      toast(`Swarm error: ${String(e?.message || e)}`);
    } finally {
      setBusySwarm(false);
    }
  }

  async function doSim() {
    const p = simPrompt.trim();
    if (!p) return toast("Enter a simulation prompt.");
    setBusySim(true);
    setSimOut(null);
    try {
      const assumptions = simAssumptions
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      const out = await apiPost(`${API_BASE}/api/simulations/whatif`, {
        title: simTitle || "What-if",
        prompt: p,
        assumptions,
      });
      if (!out?.ok) throw new Error(out?.error || "Simulation failed");
      setSimOut(out);
      if (out?.cue) applyCue(out.cue);
      toast("Simulation completed");
      await refreshDTUs({ silent: true });
    } catch (e) {
      toast(`Simulation error: ${String(e?.message || e)}`);
    } finally {
      setBusySim(false);
    }
  }

  async function loadGlobal() {
    try {
      const out = await apiGet(`${API_BASE}/api/global/feed`);
      setGlobalFeed(out);
      if (out?.cue) applyCue(out.cue);
      toast("Global feed loaded");
    } catch (e) {
      toast(`Global error: ${String(e?.message || e)}`);
    }
  }

  async function toggleJob(jobKey) {
    if (!jobKey) return;
    setJobsBusy(true);
    try {
      const current = jobsState?.jobs?.[jobKey]?.enabled;
      const next = !current;
      const out = await apiPost(`${API_BASE}/api/jobs/toggle`, { job: jobKey, enabled: next });
      if (!out?.ok) throw new Error(out?.error || "Toggle failed");
      toast(`${jobKey}: ${next ? "ON" : "OFF"}`);
      await refreshJobs({ silent: true });
    } catch (e) {
      toast(`Toggle error: ${String(e?.message || e)}`);
    } finally {
      setJobsBusy(false);
    }
  }

  async function runIngestNow() {
    setBusyIngest(true);
    try {
      const tags = ingestTags.split(",").map((x) => x.trim()).filter(Boolean);
      const out = await apiPost(`${API_BASE}/api/ingest`, {
        text: ingestText || "",
        url: ingestUrl || "",
        tags,
      });
      if (!out?.ok) throw new Error(out?.error || "Ingest failed");
      toast("Ingest ran");
      setIngestText("");
      setIngestUrl("");
      await refreshDTUs({ silent: true });
      await refreshJobs({ silent: true });
    } catch (e) {
      toast(`Ingest error: ${String(e?.message || e)}`);
    } finally {
      setBusyIngest(false);
    }
  }

  async function queueIngest() {
    setBusyIngest(true);
    try {
      const tags = ingestTags.split(",").map((x) => x.trim()).filter(Boolean);
      const out = await apiPost(`${API_BASE}/api/ingest/queue`, {
        text: ingestText || "",
        url: ingestUrl || "",
        tags,
      });
      if (!out?.ok) throw new Error(out?.error || "Queue ingest failed");
      toast("Ingest queued");
      setIngestText("");
      setIngestUrl("");
      await refreshJobs({ silent: true });
    } catch (e) {
      toast(`Queue error: ${String(e?.message || e)}`);
    } finally {
      setBusyIngest(false);
    }
  }

  async function runAutocrawlNow() {
    setBusyAutocrawl(true);
    try {
      const tags = autocrawlTags.split(",").map((x) => x.trim()).filter(Boolean);
      const out = await apiPost(`${API_BASE}/api/autocrawl`, {
        url: autocrawlUrl || "",
        tags,
      });
      if (!out?.ok) throw new Error(out?.error || "Autocrawl failed");
      toast("Autocrawl ran");
      setAutocrawlUrl("");
      await refreshDTUs({ silent: true });
      await refreshJobs({ silent: true });
    } catch (e) {
      toast(`Autocrawl error: ${String(e?.message || e)}`);
    } finally {
      setBusyAutocrawl(false);
    }
  }

  async function queueAutocrawl() {
    setBusyAutocrawl(true);
    try {
      const tags = autocrawlTags.split(",").map((x) => x.trim()).filter(Boolean);
      const out = await apiPost(`${API_BASE}/api/autocrawl/queue`, {
        url: autocrawlUrl || "",
        tags,
      });
      if (!out?.ok) throw new Error(out?.error || "Queue autocrawl failed");
      toast("Autocrawl queued");
      setAutocrawlUrl("");
      await refreshJobs({ silent: true });
    } catch (e) {
      toast(`Queue error: ${String(e?.message || e)}`);
    } finally {
      setBusyAutocrawl(false);
    }
  }

  // ---------------- DTU list item ----------------
  function DTUCard({ d }) {
    const title = d?.meta?.title || "DTU";
    const tags = Array.isArray(d?.tags) ? d.tags : [];
    return (
      <div
        className={cls("dtuCard", selectedDTUId === d.id && "sel")}
        onClick={() => setSelectedDTUId(d.id)}
        title={title}
      >
        <div className="dtuTitle">{clampText(title, 56)}</div>
        <div className="dtuMeta">
          {tags.slice(0, 4).map((t, i) => (
            <span key={i} className={cls("tag", i % 2 ? "blue" : "green")}>
              {t}
            </span>
          ))}
          {tags.length > 4 ? <span className="muted">+{tags.length - 4}</span> : null}
        </div>
      </div>
    );
  }

  // ---------------- persona animation style ----------------
  const cueState = personaCue?.state || "idle";
  const cueIntensity = Number(personaCue?.intensity || 0.2);
  const cueScale = 1 + Math.max(0, Math.min(0.18, cueIntensity * 0.16));

  const personaImg = PERSONA_ART?.[personaId];

  return (
    <div className="app">
      {/* inline styles (monolith) */}
      <style>{`
        :root{
          --bg:#070A10;
          --panel:rgba(255,255,255,.045);
          --panel2:rgba(255,255,255,.06);
          --stroke:rgba(255,255,255,.10);
          --txt:rgba(255,255,255,.92);
          --muted:rgba(255,255,255,.62);
          --green:#42ffb3;
          --blue:#6aa6ff;
          --red:#ff5d6a;
          --gold:#ffd36a;
          --shadow:0 14px 46px rgba(0,0,0,.55);
          --r:18px;
          --mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
          --ui:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji";
        }
        *{box-sizing:border-box}
        html,body{height:100%}
        body{
          margin:0;
          background:
            radial-gradient(1200px 800px at 20% 10%, rgba(80,120,255,0.12), transparent 55%),
            radial-gradient(900px 700px at 80% 0%, rgba(66,255,179,0.10), transparent 60%),
            var(--bg);
          color:var(--txt);
          font-family:var(--ui);
        }
        .app{min-height:100vh;padding:18px}
        .topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
        .brand{display:flex;align-items:center;gap:10px}
        .logo{width:30px;height:30px;border-radius:10px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,.35)}
        .title{font-weight:900;letter-spacing:.2px}
        .subtitle{color:var(--muted);font-size:12px;margin-top:2px}
        .tabs{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
        .tab{
          cursor:pointer;padding:8px 10px;border:1px solid var(--stroke);
          background:rgba(255,255,255,.03);
          border-radius:999px;font-size:12px;color:var(--muted);user-select:none;
          transition:transform .12s ease, border-color .12s ease, color .12s ease;
        }
        .tab:hover{transform:translateY(-1px)}
        .tab.active{color:var(--txt);border-color:rgba(106,166,255,.55);background:rgba(106,166,255,.08)}
        .grid{display:grid;grid-template-columns:340px 1fr;gap:14px}
        .panel{
          background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03));
          border:1px solid var(--stroke);
          border-radius:var(--r);
          box-shadow:var(--shadow);
          overflow:hidden;
          min-height:72vh;
        }
        .hd{
          padding:12px 14px;
          display:flex;align-items:center;justify-content:space-between;gap:10px;
          border-bottom:1px solid var(--stroke);
          background:rgba(0,0,0,.18);
        }
        .h1{font-weight:900}
        .bd{padding:12px 14px}
        .row{display:flex;align-items:center;gap:10px}
        .col{display:flex;flex-direction:column;gap:10px}
        .muted{color:var(--muted)}
        .mono{font-family:var(--mono);white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.35}
        .pill{
          padding:6px 10px;border-radius:999px;font-size:12px;
          border:1px solid var(--stroke);background:rgba(255,255,255,.03);
        }
        .pill.green{border-color:rgba(66,255,179,.35);color:rgba(66,255,179,.95);background:rgba(66,255,179,.07)}
        .pill.blue{border-color:rgba(106,166,255,.35);color:rgba(106,166,255,.95);background:rgba(106,166,255,.08)}
        .pill.red{border-color:rgba(255,93,106,.35);color:rgba(255,93,106,.95);background:rgba(255,93,106,.07)}
        .btn{
          cursor:pointer;border:1px solid var(--stroke);background:rgba(255,255,255,.05);
          color:var(--txt);padding:10px 12px;border-radius:12px;font-weight:800;
          transition:transform .12s ease, background .12s ease;
        }
        .btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.08)}
        .btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
        .btn.ghost{background:transparent}
        .input,.ta,select{
          width:100%;
          border:1px solid var(--stroke);
          background:rgba(0,0,0,.25);
          color:var(--txt);
          border-radius:12px;
          padding:10px 12px;
          outline:none;
        }
        .ta{min-height:110px;resize:vertical}
        .divider{height:1px;background:rgba(255,255,255,.08);margin:10px 0}
        .card{
          border:1px solid var(--stroke);
          background:rgba(255,255,255,.04);
          border-radius:16px;
          padding:12px;
        }

        /* left DTU sidebar */
        .sidebarTop{display:flex;gap:8px;align-items:center}
        .dtuList{display:flex;flex-direction:column;gap:8px;max-height:62vh;overflow:auto;padding-right:6px}
        .dtuCard{
          cursor:pointer;
          border:1px solid rgba(255,255,255,.08);
          background:rgba(0,0,0,.18);
          border-radius:14px;
          padding:10px 10px;
          transition:transform .12s ease, border-color .12s ease, background .12s ease;
        }
        .dtuCard:hover{transform:translateY(-1px);border-color:rgba(106,166,255,.35);background:rgba(106,166,255,.06)}
        .dtuCard.sel{border-color:rgba(66,255,179,.35);background:rgba(66,255,179,.06)}
        .dtuTitle{font-weight:900;font-size:13px}
        .dtuMeta{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
        .tag{
          font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid var(--stroke);
          background:rgba(255,255,255,.03);color:var(--muted)
        }
        .tag.green{border-color:rgba(66,255,179,.3);color:rgba(66,255,179,.9);background:rgba(66,255,179,.07)}
        .tag.blue{border-color:rgba(106,166,255,.3);color:rgba(106,166,255,.95);background:rgba(106,166,255,.08)}

        /* toast (NOT fullscreen; no overlay) */
        .toast{
          position:fixed;right:16px;bottom:16px;
          background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.18);
          color:var(--txt);border-radius:14px;padding:10px 12px;
          box-shadow:0 18px 60px rgba(0,0,0,.55);
          max-width:420px;font-weight:800;font-size:12px;
          z-index:50;
        }

        /* persona card */
        .personaWrap{display:flex;gap:12px;align-items:center}
        .personaAvatar{
          width:96px;height:96px;border-radius:24px;overflow:hidden;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(0,0,0,.25);
          display:flex;align-items:center;justify-content:center;
          transform:scale(${cueScale});
          transition:transform .16s ease;
          box-shadow:0 18px 48px rgba(0,0,0,.45);
        }
        .personaAvatar img{width:100%;height:100%;object-fit:cover}
        .personaFallback{
          width:100%;height:100%;
          display:flex;align-items:center;justify-content:center;
          font-weight:900;
          background:radial-gradient(120px 120px at 30% 30%, rgba(106,166,255,.18), rgba(0,0,0,.25));
          color:rgba(255,255,255,.9);
        }
        .pulseTalk{animation:pulseTalk 1.2s ease-in-out infinite}
        .pulseThink{animation:pulseThink 1.4s ease-in-out infinite}
        .pulseEmph{animation:pulseEmph .9s ease-in-out infinite}
        @keyframes pulseTalk{
          0%{filter:brightness(1)}
          50%{filter:brightness(1.12)}
          100%{filter:brightness(1)}
        }
        @keyframes pulseThink{
          0%{filter:saturate(1)}
          50%{filter:saturate(1.25)}
          100%{filter:saturate(1)}
        }
        @keyframes pulseEmph{
          0%{filter:contrast(1)}
          50%{filter:contrast(1.2)}
          100%{filter:contrast(1)}
        }

        /* responsive */
        @media (max-width: 980px){
          .grid{grid-template-columns:1fr}
          .panel{min-height:auto}
          .dtuList{max-height:34vh}
        }
      `}</style>

      <div className="topbar">
        <div className="brand">
          <img className="logo" src={concordLogo} alt="Concord" />
          <div>
            <div className="title">ConcordOS</div>
            <div className="subtitle">v1 — Studio UI • {API_BASE}</div>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <div
              key={t.id}
              className={cls("tab", tab === t.id && "active")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid">
        {/* LEFT: DTU Sidebar */}
        <div className="panel">
          <div className="hd">
            <div className="h1">DTU Library</div>
            <span className={cls("pill", status?.ok ? "green" : "red")}>
              {status?.ok ? "Backend: OK" : "Backend: ?"}
            </span>
          </div>
          <div className="bd">
            <div className="sidebarTop">
              <input
                className="input"
                placeholder="Search DTUs (title, tags, content)…"
                value={dtuSearch}
                onChange={(e) => {
                  setDtuSearch(e.target.value);
                  setDtuPage(1);
                }}
              />
              <button className="btn" onClick={() => refreshDTUs({ silent: false })}>
                Refresh
              </button>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Showing {pagedDTUs.length} / {filteredDTUs.length} (total: {dtus.length})
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                Page {dtuPageSafe} / {dtuPageCount}
              </span>
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn ghost" disabled={dtuPageSafe <= 1} onClick={() => setDtuPage((p) => Math.max(1, p - 1))}>
                ◀
              </button>
              <button className="btn ghost" disabled={dtuPageSafe >= dtuPageCount} onClick={() => setDtuPage((p) => Math.min(dtuPageCount, p + 1))}>
                ▶
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                Tip: click any DTU to inspect + talk.
              </span>
            </div>

            <div className="divider" />

            <div className="dtuList">
              {pagedDTUs.map((d) => (
                <DTUCard key={d.id} d={d} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Workspace */}
        <div className="panel">
          <div className="hd">
            <div className="h1">{TABS.find((x) => x.id === tab)?.label || "Workspace"}</div>
            <div className="row">
              <span className="pill blue">DTUs: {status?.counts?.dtus ?? dtus.length}</span>
              <button className="btn ghost" onClick={() => refreshAll({ silent: false })}>
                Refresh All
              </button>
            </div>
          </div>

          <div className="bd">
            {/* OVERVIEW */}
            {tab === "overview" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>System Status</div>
                  <div className="divider" />
                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div className="col" style={{ minWidth: 280 }}>
                      <div><b>Status:</b> {status?.ok ? "Online" : "Unknown"}</div>
                      <div><b>Backend:</b> {API_BASE}</div>
                      <div><b>Frontend:</b> http://localhost:5173</div>
                      <div className="divider" />
                      <div className="muted">
                        Live in v1: Chat, DTUs, Forge, Personas, Council, Swarm, Simulation, Jobs (Governor).
                        <br />
                        Marketplace visible but <b>“coming soon 😄”</b>. Global shows stub feed.
                      </div>
                    </div>
                    <div className="col" style={{ minWidth: 320 }}>
                      <div><b>Counts</b></div>
                      <div className="muted">DTUs: {status?.counts?.dtus ?? dtus.length}</div>
                      <div className="muted">Sims: {status?.counts?.simulations ?? "—"}</div>
                      <div className="muted">Listings: {status?.counts?.listings ?? "—"}</div>
                      <div className="muted">Events: {status?.counts?.events ?? events.length}</div>
                      <div className="muted">Wallets: {status?.counts?.wallets ?? "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div style={{ fontWeight: 900 }}>OS State</div>
                  <div className="divider" />
                  <div className="mono muted">{safeStr(status?.osState || status?.os || {})}</div>
                </div>

                <div className="card">
                  <div style={{ fontWeight: 900 }}>Selected DTU</div>
                  <div className="divider" />
                  {selectedDTU ? (
                    <>
                      <div><b>{selectedDTU?.meta?.title || "DTU"}</b></div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Tags: {(selectedDTU?.tags || []).join(", ") || "—"} • Updated: {fmtTime(selectedDTU?.meta?.updatedAt)}
                      </div>
                      <div className="divider" />
                      <div className="mono">{clampText(selectedDTU?.content || "", 3200)}</div>
                    </>
                  ) : (
                    <div className="muted">No DTU selected yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* JOBS / GOVERNOR */}
            {tab === "jobs" && (
              <div className="col">
                <div className="card">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>Builder Mode — Governor</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        Control Concord’s background jobs (local-first). Toggle systems, run ingest/autocrawl, watch queues.
                      </div>
                    </div>
                    <div className="row">
                      <button
                        className={cls("btn", builderMode ? "" : "ghost")}
                        onClick={() => {
                          const next = !builderMode;
                          setBuilderMode(next);
                          setBuilderModeLocal(next);
                          toast(next ? "Builder mode: ON" : "Builder mode: OFF");
                        }}
                      >
                        {builderMode ? "Builder: ON" : "Builder: OFF"}
                      </button>
                      <button className="btn" onClick={() => refreshJobs({ silent: false })}>
                        Refresh
                      </button>
                    </div>
                  </div>

                  {jobsErr ? (
                    <div className="divider" />
                  ) : null}
                  {jobsErr ? <div className="pill red">Jobs error: {jobsErr}</div> : null}

                  <div className="divider" />

                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div className="col" style={{ minWidth: 280 }}>
                      <div style={{ fontWeight: 900 }}>Jobs</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Toggle which loops are enabled on the backend.
                      </div>
                      <div className="divider" />
                      {jobsState?.jobs ? (
                        <div className="col">
                          {Object.keys(jobsState.jobs).map((k) => {
                            const enabled = !!jobsState.jobs[k]?.enabled;
                            return (
                              <div key={k} className="row" style={{ justifyContent: "space-between" }}>
                                <span className="mono">{k}</span>
                                <button
                                  className={cls("btn", enabled ? "" : "ghost")}
                                  disabled={jobsBusy}
                                  onClick={() => toggleJob(k)}
                                >
                                  {enabled ? "ON" : "OFF"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="muted">No jobs payload yet. Hit Refresh.</div>
                      )}
                    </div>

                    <div className="col" style={{ minWidth: 360 }}>
                      <div style={{ fontWeight: 900 }}>Governor Snapshot</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Read-only status (startedAt, last runs, queues, intervals).
                      </div>
                      <div className="divider" />
                      <div className="mono">{safeStr(jobsState || { ok: false, note: "No jobs data yet" })}</div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div style={{ fontWeight: 900 }}>Ingest</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Add knowledge into DTUs (manual ingest or queued ingest).
                  </div>
                  <div className="divider" />
                  <input
                    className="input"
                    placeholder="Optional URL to ingest (https://...)"
                    value={ingestUrl}
                    onChange={(e) => setIngestUrl(e.target.value)}
                  />
                  <textarea
                    className="ta"
                    placeholder="Paste text to ingest…"
                    value={ingestText}
                    onChange={(e) => setIngestText(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Tags (comma-separated) e.g. ingest, notes, research"
                    value={ingestTags}
                    onChange={(e) => setIngestTags(e.target.value)}
                  />
                  <div className="row">
                    <button className="btn" disabled={busyIngest} onClick={runIngestNow}>
                      {busyIngest ? "Working…" : "Run Ingest Now"}
                    </button>
                    <button className="btn ghost" disabled={busyIngest} onClick={queueIngest}>
                      {busyIngest ? "Working…" : "Queue Ingest"}
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div style={{ fontWeight: 900 }}>Autocrawl</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Crawl a page and turn it into DTUs / CRETI-styled content (as your backend implements).
                  </div>
                  <div className="divider" />
                  <input
                    className="input"
                    placeholder="URL to crawl (https://...)"
                    value={autocrawlUrl}
                    onChange={(e) => setAutocrawlUrl(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Tags (comma-separated) e.g. autocrawl, source, web"
                    value={autocrawlTags}
                    onChange={(e) => setAutocrawlTags(e.target.value)}
                  />
                  <div className="row">
                    <button className="btn" disabled={busyAutocrawl} onClick={runAutocrawlNow}>
                      {busyAutocrawl ? "Working…" : "Run Autocrawl Now"}
                    </button>
                    <button className="btn ghost" disabled={busyAutocrawl} onClick={queueAutocrawl}>
                      {busyAutocrawl ? "Working…" : "Queue Autocrawl"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CHAT */}
            {tab === "chat" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>Chat with Concord</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    This hits <span className="mono">POST /api/chat</span>.
                  </div>
                  <div className="divider" />

                  <div className="row">
                    <select value={chatMode} onChange={(e) => setChatMode(e.target.value)}>
                      <option value="overview">overview</option>
                      <option value="builder">builder</option>
                      <option value="research">research</option>
                      <option value="creative">creative</option>
                      <option value="debug">debug</option>
                    </select>
                    <button className="btn" disabled={busyChat} onClick={doChat}>
                      {busyChat ? "Thinking…" : "Send"}
                    </button>
                  </div>

                  <textarea
                    className="ta"
                    placeholder="Ask Concord…"
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                  />

                  <div className="divider" />

                  <div className="mono">{safeStr(chatOut || { ok: true, note: "No output yet." })}</div>
                </div>
              </div>
            )}

            {/* DTUS */}
            {tab === "dtus" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>DTU Inspector</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Select a DTU from the left sidebar to inspect it. Then talk to it using <span className="mono">POST /api/ask</span>.
                  </div>
                  <div className="divider" />

                  {selectedDTU ? (
                    <>
                      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                        <div className="col" style={{ gap: 4 }}>
                          <div style={{ fontWeight: 900 }}>{selectedDTU?.meta?.title || "DTU"}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            Tags: {(selectedDTU?.tags || []).join(", ") || "—"}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            Updated: {fmtTime(selectedDTU?.meta?.updatedAt)} • Source: {selectedDTU?.meta?.source || "—"}
                          </div>
                        </div>
                        <button className="btn ghost" onClick={() => { setAskOut(null); setAskMsg(""); }}>
                          Clear Ask
                        </button>
                      </div>

                      <div className="divider" />
                      <div className="mono">{clampText(selectedDTU?.content || "", 5000)}</div>

                      <div className="divider" />

                      <div className="row">
                        <input
                          className="input"
                          placeholder="Ask this DTU / Ask Concord using this DTU…"
                          value={askMsg}
                          onChange={(e) => setAskMsg(e.target.value)}
                        />
                        <button className="btn" disabled={busyAsk} onClick={doAskSelectedDTU}>
                          {busyAsk ? "Asking…" : "Talk to DTU"}
                        </button>
                      </div>

                      <div className="divider" />
                      <div className="mono">{safeStr(askOut || { ok: true, note: "No ask output yet." })}</div>
                    </>
                  ) : (
                    <div className="muted">No DTU selected. Create one below or select from left.</div>
                  )}
                </div>

                <div className="card">
                  <div style={{ fontWeight: 900 }}>Create DTU</div>
                  <div className="divider" />
                  <input
                    className="input"
                    placeholder="Title"
                    value={dtuTitle}
                    onChange={(e) => setDtuTitle(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Tags (comma-separated) e.g. core, plan, idea"
                    value={dtuTags}
                    onChange={(e) => setDtuTags(e.target.value)}
                  />
                  <textarea
                    className="ta"
                    placeholder="DTU content…"
                    value={dtuContent}
                    onChange={(e) => setDtuContent(e.target.value)}
                  />
                  <button className="btn" disabled={busyCreateDTU} onClick={doCreateDTU}>
                    {busyCreateDTU ? "Creating…" : "Create DTU"}
                  </button>
                </div>
              </div>
            )}

            {/* FORGE */}
            {tab === "forge" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>Forge Mode</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Forge generates a DTU via <span className="mono">POST /api/forge</span>.
                  </div>
                  <div className="divider" />

                  <input className="input" value={forgeTitle} onChange={(e) => setForgeTitle(e.target.value)} />
                  <input className="input" value={forgeTags} onChange={(e) => setForgeTags(e.target.value)} />
                  <textarea
                    className="ta"
                    placeholder="Forge content… (you can paste CRETI-like blocks)"
                    value={forgeContent}
                    onChange={(e) => setForgeContent(e.target.value)}
                  />

                  <div className="row">
                    <button className="btn" disabled={busyForge} onClick={doForge}>
                      {busyForge ? "Forging…" : "Forge → DTU"}
                    </button>
                    <button className="btn ghost" onClick={() => setForgeOut(null)}>Clear</button>
                  </div>

                  <div className="divider" />
                  <div className="mono">{safeStr(forgeOut || { ok: true, note: "No forge output yet." })}</div>
                </div>
              </div>
            )}

            {/* PERSONAS */}
            {tab === "personas" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>Personas</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Uses <span className="mono">/api/personas</span>, <span className="mono">/api/personas/:id/speak</span>, <span className="mono">/api/personas/:id/animate</span>.
                  </div>
                  <div className="divider" />

                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div className="row" style={{ minWidth: 320, flex: 1 }}>
                      <select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                        {(personas.length ? personas : [
                          { id: "p_ethicist", name: "Ethicist" },
                          { id: "p_engineer", name: "Engineer" },
                          { id: "p_historian", name: "Historian" },
                          { id: "p_economist", name: "Economist" },
                        ]).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn ghost" onClick={() => refreshPersonas({ silent: false })}>
                        Refresh Personas
                      </button>
                    </div>
                    <span className="pill blue">
                      Cue: {cueState} • intensity {cueIntensity.toFixed(2)}
                    </span>
                  </div>

                  <div className="divider" />

                  <div className="personaWrap">
                    <div
                      className={cls(
                        "personaAvatar",
                        cueState === "talk" && "pulseTalk",
                        cueState === "thinking" && "pulseThink",
                        cueState === "emphasize" && "pulseEmph"
                      )}
                    >
                      {personaImg ? (
                        <img src={personaImg} alt={currentPersona?.name || "Persona"} />
                      ) : (
                        <div className="personaFallback">{(currentPersona?.name || "Persona").slice(0, 1)}</div>
                      )}
                    </div>

                    <div className="col" style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{currentPersona?.name || "Persona"}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {currentPersona?.style || "—"}
                      </div>

                      <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                        <button className="btn ghost" disabled={busyPersona} onClick={() => doPersonaAnimate("idle")}>Idle</button>
                        <button className="btn ghost" disabled={busyPersona} onClick={() => doPersonaAnimate("thinking")}>Thinking</button>
                        <button className="btn ghost" disabled={busyPersona} onClick={() => doPersonaAnimate("talk")}>Talk</button>
                        <button className="btn ghost" disabled={busyPersona} onClick={() => doPersonaAnimate("emphasize")}>Emphasize</button>
                      </div>
                    </div>
                  </div>

                  <div className="divider" />

                  <textarea
                    className="ta"
                    value={personaText}
                    onChange={(e) => setPersonaText(e.target.value)}
                  />
                  <button className="btn" disabled={busyPersona} onClick={doPersonaSpeak}>
                    {busyPersona ? "Working…" : "Speak"}
                  </button>
                </div>
              </div>
            )}

            {/* COUNCIL */}
            {tab === "council" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>Council Debate</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Uses <span className="mono">POST /api/council/debate</span> and writes a synthesis DTU.
                  </div>
                  <div className="divider" />
                  <input className="input" value={councilTopic} onChange={(e) => setCouncilTopic(e.target.value)} />
                  <button className="btn" disabled={busyCouncil} onClick={doCouncil}>
                    {busyCouncil ? "Debating…" : "Run Council"}
                  </button>
                  <div className="divider" />
                  <div className="mono">{safeStr(councilOut || { ok: true, note: "No council output yet." })}</div>
                </div>
              </div>
            )}

            {/* SWARM */}
            {tab === "swarm" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>Swarm</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Uses <span className="mono">POST /api/swarm/run</span>.
                  </div>
                  <div className="divider" />
                  <textarea
                    className="ta"
                    placeholder="Swarm prompt…"
                    value={swarmPrompt}
                    onChange={(e) => setSwarmPrompt(e.target.value)}
                  />
                  <div className="row">
                    <input
                      className="input"
                      style={{ maxWidth: 140 }}
                      value={swarmCount}
                      onChange={(e) => setSwarmCount(e.target.value)}
                    />
                    <button className="btn" disabled={busySwarm} onClick={doSwarm}>
                      {busySwarm ? "Running…" : "Run Swarm"}
                    </button>
                  </div>
                  <div className="divider" />
                  <div className="mono">{safeStr(swarmOut || { ok: true, note: "No swarm output yet." })}</div>
                </div>
              </div>
            )}

            {/* SIMULATION */}
            {tab === "sim" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>Simulation</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Uses <span className="mono">POST /api/simulations/whatif</span>.
                  </div>
                  <div className="divider" />
                  <input className="input" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} />
                  <textarea
                    className="ta"
                    placeholder="Simulation prompt…"
                    value={simPrompt}
                    onChange={(e) => setSimPrompt(e.target.value)}
                  />
                  <textarea
                    className="ta"
                    placeholder="Assumptions (one per line)…"
                    value={simAssumptions}
                    onChange={(e) => setSimAssumptions(e.target.value)}
                  />
                  <button className="btn" disabled={busySim} onClick={doSim}>
                    {busySim ? "Simulating…" : "Run Simulation"}
                  </button>
                  <div className="divider" />
                  <div className="mono">{safeStr(simOut || { ok: true, note: "No simulation output yet." })}</div>
                </div>
              </div>
            )}

            {/* MARKETPLACE */}
            {tab === "market" && (
              <div className="col">
                <div className="card">
                  <div style={{ fontWeight: 900 }}>Marketplace</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    coming soon 😄
                  </div>
                </div>
              </div>
            )}

            {/* GLOBAL */}
            {tab === "global" && (
              <div className="col">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Global Feed</span>
                  <button className="btn" onClick={loadGlobal}>Load</button>
                </div>
                <div className="card">
                  <div className="mono">{safeStr(globalFeed || { ok: true, note: "No feed loaded yet." })}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toastMsg ? <div className="toast">{toastMsg}</div> : null}
    </div>
  );
}
