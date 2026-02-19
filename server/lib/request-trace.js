/**
 * Request Tracing — Unified Observability
 *
 * Provides a single trace ID that flows through the entire request pipeline:
 *   HTTP request → middleware → macro → retrieval → activation → LLM → response
 *
 * Features:
 *   - Trace ID stamped on every request (reuses X-Request-ID if present)
 *   - Span-based timing: each subsystem creates a span with start/end
 *   - Trace logs aggregated per request for post-mortem debugging
 *   - Async-local-storage based context propagation (no manual threading)
 *   - Exportable trace format for external observability tools
 */

import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "crypto";

// ── Trace Context ────────────────────────────────────────────────────────────

const traceStorage = new AsyncLocalStorage();

/**
 * Generate a trace ID.
 */
function generateTraceId() {
  return `tr_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * Get the current trace context (if inside a traced request).
 * @returns {TraceContext|null}
 */
export function currentTrace() {
  return traceStorage.getStore() || null;
}

// ── Express Middleware ────────────────────────────────────────────────────────

/**
 * Express middleware that initializes request tracing.
 * Must be registered early in the middleware chain.
 */
export function traceMiddleware(req, res, next) {
  const traceId = req.headers["x-trace-id"] || req.id || generateTraceId();
  const startTime = Date.now();

  const trace = {
    traceId,
    startTime,
    spans: [],
    logs: [],
    method: req.method,
    path: req.path,
  };

  // Attach to request for easy access
  req.trace = trace;
  req.traceId = traceId;

  // Set response header
  res.setHeader("X-Trace-ID", traceId);

  // On response finish, finalize the trace
  res.on("finish", () => {
    trace.durationMs = Date.now() - startTime;
    trace.statusCode = res.statusCode;

    // Close any open spans
    for (const span of trace.spans) {
      if (!span.endTime) {
        span.endTime = Date.now();
        span.durationMs = span.endTime - span.startTime;
        span.status = "timeout";
      }
    }
  });

  // Run the rest of the middleware inside async local storage
  traceStorage.run(trace, () => next());
}

// ── Span API ─────────────────────────────────────────────────────────────────

/**
 * Start a named span within the current trace.
 *
 * @param {string} name - Span name (e.g., "retrieval", "activation", "llm.ollama")
 * @param {Object} [attrs] - Optional attributes
 * @returns {{ end: Function, addAttr: Function }|null} Span handle, or null if no trace
 */
export function startSpan(name, attrs = {}) {
  const trace = currentTrace();
  if (!trace) return { end: () => {}, addAttr: () => {} };

  const span = {
    name,
    startTime: Date.now(),
    endTime: null,
    durationMs: null,
    status: "in_progress",
    attrs: { ...attrs },
  };
  trace.spans.push(span);

  return {
    end(status = "ok", extraAttrs) {
      span.endTime = Date.now();
      span.durationMs = span.endTime - span.startTime;
      span.status = status;
      if (extraAttrs) Object.assign(span.attrs, extraAttrs);
    },
    addAttr(key, value) {
      span.attrs[key] = value;
    },
  };
}

/**
 * Add a log entry to the current trace.
 *
 * @param {string} level - "info", "warn", "error"
 * @param {string} message - Log message
 * @param {Object} [data] - Optional structured data
 */
export function traceLog(level, message, data) {
  const trace = currentTrace();
  if (!trace) return;

  trace.logs.push({
    timestamp: Date.now(),
    level,
    message,
    data: data || undefined,
  });
}

// ── Trace Query ──────────────────────────────────────────────────────────────

// Ring buffer of recent traces for debugging (last 200)
const TRACE_BUFFER_SIZE = 200;
const traceBuffer = [];

/**
 * Store a completed trace in the ring buffer.
 * Call this from response-finish hook or explicitly.
 *
 * @param {Object} trace
 */
export function storeTrace(trace) {
  if (!trace?.traceId) return;
  traceBuffer.push({
    traceId: trace.traceId,
    method: trace.method,
    path: trace.path,
    durationMs: trace.durationMs,
    statusCode: trace.statusCode,
    spanCount: trace.spans.length,
    logCount: trace.logs.length,
    timestamp: new Date(trace.startTime).toISOString(),
  });
  if (traceBuffer.length > TRACE_BUFFER_SIZE) {
    traceBuffer.shift();
  }
}

/**
 * Get a specific trace by ID from the current request context.
 * (For real production use, you'd query an external store.)
 *
 * @param {string} traceId
 * @returns {Object|null}
 */
export function getTraceById(traceId) {
  return traceBuffer.find(t => t.traceId === traceId) || null;
}

/**
 * Get recent traces.
 *
 * @param {Object} [opts]
 * @param {number} [opts.limit=50]
 * @param {number} [opts.minDurationMs] - Only traces slower than this
 * @returns {{ ok, traces }}
 */
export function getRecentTraces(opts = {}) {
  const limit = opts.limit || 50;
  let traces = [...traceBuffer].reverse();

  if (opts.minDurationMs) {
    traces = traces.filter(t => t.durationMs >= opts.minDurationMs);
  }

  return {
    ok: true,
    traces: traces.slice(0, limit),
    total: traceBuffer.length,
  };
}

/**
 * Get trace metrics summary.
 */
export function getTraceMetrics() {
  if (traceBuffer.length === 0) {
    return { ok: true, count: 0, avgDurationMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0 };
  }

  const durations = traceBuffer.map(t => t.durationMs).filter(d => d != null).sort((a, b) => a - b);
  const n = durations.length;

  return {
    ok: true,
    count: n,
    avgDurationMs: Math.round(durations.reduce((a, b) => a + b, 0) / n),
    p50Ms: durations[Math.floor(n * 0.5)] || 0,
    p95Ms: durations[Math.floor(n * 0.95)] || 0,
    p99Ms: durations[Math.floor(n * 0.99)] || 0,
    bufferSize: TRACE_BUFFER_SIZE,
  };
}
