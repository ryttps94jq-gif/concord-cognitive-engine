// lib/conkay/unity-bridge.ts
//
// Honest LIVE stub: browser → Unity WebGL iframe postMessage path.
// ConKay (or any client) posts typed `concordia:cmd` envelopes into the
// iframe that world/page.tsx mounts when NEXT_PUBLIC_CONCORDIA_RENDERER=unity-webgl.
// Reverse path listens for `concordia:event` from the iframe (or same-origin
// child). No CAD/physics pipeline — that remains DESIGN.
//
// No-op safe: if the iframe is missing / not yet loaded / cross-origin without
// contentWindow, send returns false and does nothing. Unity C#/jslib receive
// stays PARTIAL until the next WebGL rebuild ships a receiver (see
// ~/.zuko/CONKAY_UNITY_BRIDGE.md).

export const UNITY_IFRAME_ID = 'concordia-unity-webgl';

export const CONCORDIA_CMD = 'concordia:cmd' as const;
export const CONCORDIA_EVENT = 'concordia:event' as const;

/** Commands the browser may post into the Unity WebGL iframe. */
export type ConcordiaCmdName =
  | 'ping'
  | 'hello'
  | 'focus'
  | 'notify'
  | 'camera'
  | 'intent';

/** Events the iframe / Unity build may post back to the parent. */
export type ConcordiaEventName =
  | 'pong'
  | 'ready'
  | 'ack'
  | 'status'
  | 'error';

export interface ConcordiaCmdMessage {
  type: typeof CONCORDIA_CMD;
  cmd: ConcordiaCmdName;
  /** Opaque payload — stub only; no CAD/mesh contract yet. */
  payload?: Record<string, unknown>;
  /** Correlation id for optional ack matching. */
  id?: string;
  ts: number;
}

export interface ConcordiaEventMessage {
  type: typeof CONCORDIA_EVENT;
  event: ConcordiaEventName;
  payload?: Record<string, unknown>;
  id?: string;
  ts?: number;
}

export function isConcordiaEventMessage(data: unknown): data is ConcordiaEventMessage {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.type === CONCORDIA_EVENT && typeof d.event === 'string';
}

/** Find the live Unity WebGL iframe, or null if not mounted. */
export function getUnityIframe(): HTMLIFrameElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(UNITY_IFRAME_ID);
  return el instanceof HTMLIFrameElement ? el : null;
}

export function unityIframePresent(): boolean {
  return getUnityIframe() != null;
}

/**
 * Post a typed command into the Unity WebGL iframe.
 * Returns true if postMessage was attempted; false if iframe missing.
 * Does NOT claim Unity handled it — handler is PARTIAL until rebuild.
 */
export function postUnityCmd(
  cmd: ConcordiaCmdName,
  payload?: Record<string, unknown>,
  id?: string,
): boolean {
  const iframe = getUnityIframe();
  const win = iframe?.contentWindow;
  if (!win) return false;
  const msg: ConcordiaCmdMessage = {
    type: CONCORDIA_CMD,
    cmd,
    payload: payload ?? {},
    id,
    ts: Date.now(),
  };
  try {
    // Same-origin static build under /concordia-webgl — '*' is fine for stub;
    // tighten to location.origin when a cross-origin host is used.
    win.postMessage(msg, typeof window !== 'undefined' ? window.location.origin : '*');
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to `concordia:event` messages from the Unity iframe (or any
 * same-origin child). Returns an unsubscribe function. No-op safe on SSR.
 */
export function onUnityEvent(
  handler: (msg: ConcordiaEventMessage, raw: MessageEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const onMessage = (ev: MessageEvent) => {
    // Only accept same-origin (or null source from about:blank during load).
    if (ev.origin && ev.origin !== window.location.origin) return;
    if (!isConcordiaEventMessage(ev.data)) return;
    handler(ev.data, ev);
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
