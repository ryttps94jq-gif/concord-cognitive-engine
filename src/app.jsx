// src/App.jsx
import { useEffect, useState } from "react";

const API_BASE = window.location.origin.replace(/\/+$/, "") || "http://localhost:5050";

function App() {
  // --------------------------------------------------
  // Global status
  // --------------------------------------------------
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);

  // --------------------------------------------------
  // Ask Concord
  // --------------------------------------------------
  const [askMessage, setAskMessage] = useState("");
  const [askReply, setAskReply] = useState("");
  const [askLoading, setAskLoading] = useState(false);

  // --------------------------------------------------
  // DTUs
  // --------------------------------------------------
  const [dtus, setDtus] = useState([]);
  const [selectedDtu, setSelectedDtu] = useState(null);
  const [dtuInspectorText, setDtuInspectorText] = useState("");
  const [dtusLoading, setDtusLoading] = useState(false);

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------
  async function fetchJSON(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text || "request failed"}`);
    }
    return res.json();
  }

  function cardStyle(extra = {}) {
    return {
      background: "#020617",
      borderRadius: "10px",
      border: "1px solid #1f2937",
      padding: "12px",
      marginBottom: "10px",
      ...extra,
    };
  }

  function sectionTitle(text) {
    return (
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "4px",
          color: "#e5e7eb",
        }}
      >
        {text}
      </div>
    );
  }

  // --------------------------------------------------
  // Init: load status + DTUs
  // --------------------------------------------------
  useEffect(() => {
    async function init() {
      try {
        const s = await fetchJSON("/api/status");
        setStatus(s);
      } catch (err) {
        setStatusError(err.message);
      }

      refreshDtus();
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------
  // Ask Concord
  // --------------------------------------------------
  async function handleAsk() {
    if (!askMessage.trim()) return;
    setAskLoading(true);
    setAskReply("");

    try {
      const data = await fetchJSON("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: askMessage }),
      });

      setAskReply(data.reply || JSON.stringify(data, null, 2));
      // After a successful ask, reload DTUs so users can see what was created.
      refreshDtus();
    } catch (err) {
      setAskReply("Error talking to backend: " + err.message);
    } finally {
      setAskLoading(false);
    }
  }

  // --------------------------------------------------
  // DTUs
  // --------------------------------------------------
  async function refreshDtus() {
    setDtusLoading(true);
    try {
      const list = await fetchJSON("/api/dtus");
      const arr = list.dtus || list || [];
      setDtus(arr);
    } catch (err) {
      console.error("Error loading DTUs", err);
    } finally {
      setDtusLoading(false);
    }
  }

  async function loadDtu(dtuId) {
    try {
      const data = await fetchJSON(`/api/dtus/${encodeURIComponent(dtuId)}`);
      setSelectedDtu(data);
      const text =
        (data.content || "").trim() ||
        JSON.stringify(data, null, 2).slice(0, 2000);
      setDtuInspectorText(text);
    } catch (err) {
      setSelectedDtu(null);
      setDtuInspectorText("Error loading DTU: " + err.message);
    }
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "10px 14px",
      }}
    >
      {/* Top status bar */}
      <div
        style={{
          marginBottom: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "13px",
        }}
      >
        <div style={{ fontWeight: 600 }}>ConcordOS Community Studio</div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {status && (
            <>
              <span>
                Backend:{" "}
                <span style={{ color: status.ok ? "#22c55e" : "#f97316" }}>
                  {status.ok ? "Online" : "Error"}
                </span>
              </span>
              {status.version && <span>Version: {status.version}</span>}
              {typeof status.dtuCount === "number" && (
                <span>DTUs: {status.dtuCount}</span>
              )}
            </>
          )}
          {statusError && (
            <span style={{ color: "#f97316" }}>{statusError}</span>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: "10px" }}>
        {/* Left column */}
        <div style={{ flex: 3, minWidth: 0 }}>
          {/* Ask Concord */}
          <div style={cardStyle()}>
            {sectionTitle("Ask Concord")}
            <div
              style={{
                marginBottom: "6px",
                fontSize: "12px",
                color: "#9ca3af",
              }}
            >
              Ask Concord a question. The backend will use your local DTUs as
              context (and an LLM if configured).
            </div>
            <textarea
              value={askMessage}
              onChange={(e) => setAskMessage(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                background: "#020617",
                borderRadius: "8px",
                border: "1px solid #1f2937",
                color: "#e5e7eb",
                padding: "8px",
                fontSize: "13px",
                marginBottom: "8px",
                resize: "vertical",
              }}
              placeholder="Ask Concord about your ingested notes, research, docs, etc..."
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "4px",
              }}
            >
              <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                Tip: every reply can become a DTU on the backend. Use this to
                grow your local knowledge graph.
              </div>
              <button
                onClick={handleAsk}
                disabled={askLoading || !askMessage.trim()}
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background: askLoading ? "#4b5563" : "#22c55e",
                  border: "none",
                  fontSize: "13px",
                  cursor: askLoading ? "default" : "pointer",
                  fontWeight: 500,
                  opacity: askLoading ? 0.8 : 1,
                }}
              >
                {askLoading ? "Thinking..." : "Send"}
              </button>
            </div>
            {askReply && (
              <div
                style={{
                  marginTop: "6px",
                  padding: "8px",
                  borderRadius: "8px",
                  background: "#020617",
                  border: "1px solid #1f2937",
                  fontSize: "13px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {askReply}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: 2, minWidth: 0 }}>
          {/* DTU list */}
          <div
            style={cardStyle({
              maxHeight: "260px",
              overflowY: "auto",
            })}
          >
            {sectionTitle("DTUs")}
            <div
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                marginBottom: "4px",
              }}
            >
              Latest DTUs created by the backend (ingests, Q&A, etc.).
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <button
                onClick={refreshDtus}
                disabled={dtusLoading}
                style={{
                  padding: "4px 8px",
                  borderRadius: "999px",
                  border: "1px solid #4b5563",
                  background: "transparent",
                  color: "#9ca3af",
                  fontSize: "11px",
                  cursor: dtusLoading ? "default" : "pointer",
                  opacity: dtusLoading ? 0.8 : 1,
                }}
              >
                {dtusLoading ? "Refreshing..." : "Refresh DTUs"}
              </button>
              <div
                style={{
                  fontSize: "11px",
                  color: "#6b7280",
                }}
              >
                Count: {dtus.length}
              </div>
            </div>
            <div>
              {dtus.map((d) => (
                <div
                  key={d.id}
                  onClick={() => loadDtu(d.id)}
                  style={{
                    padding: "6px",
                    borderRadius: "6px",
                    border:
                      selectedDtu && selectedDtu.id === d.id
                        ? "1px solid #22c55e"
                        : "1px solid #111827",
                    marginBottom: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    background:
                      selectedDtu && selectedDtu.id === d.id
                        ? "#022c22"
                        : "#020617",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {(d.meta && d.meta.title) || d.id}
                  </div>
                  <div style={{ color: "#9ca3af" }}>
                    {(d.tags || []).join(", ")}
                  </div>
                  {d.source && (
                    <div style={{ color: "#6b7280", fontSize: "11px" }}>
                      source: {d.source}
                    </div>
                  )}
                </div>
              ))}
              {dtus.length === 0 && !dtusLoading && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    marginTop: "6px",
                  }}
                >
                  No DTUs yet. Ingest something or ask Concord to start
                  building your graph.
                </div>
              )}
            </div>
          </div>

          {/* DTU Inspector */}
          <div
            style={cardStyle({
              maxHeight: "240px",
              overflowY: "auto",
            })}
          >
            {sectionTitle("DTU Inspector")}
            <div
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                marginBottom: "4px",
              }}
            >
              Click a DTU from the list to see its content.
            </div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "12px",
                color: "#e5e7eb",
              }}
            >
              {dtuInspectorText || "No DTU selected."}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;