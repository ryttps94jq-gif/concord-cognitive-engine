// shared-state — Redis write-through for process-local maps that split multi-HTTP.
//
// Fail-soft: memory is always primary (sync). Redis is write-behind / read-through
// when a client is connected. SQLite optional for durable session-activity rows.
// See docs/CONCURRENCY_STATE_AUDIT.md Tier S.
//
// Intentionally NOT covered (derived / per-node OK): STATE.qualia, STATE.shadowDtus.
// STATE.sessions chat buffers remain sticky-routed (nginx / port affinity) until
// a fuller Redis session store lands.

const PREFIX = () => process.env.REDIS_PREFIX || "concord:";

/**
 * @param {() => import('redis').RedisClientType | null | undefined} getRedis
 */
export function createSessionActivityBridge(getRedis, opts = {}) {
  const ttlSec = Math.max(60, Number(opts.ttlSec) || Math.ceil((Number(process.env.SESSION_IDLE_TIMEOUT_MS) || 7 * 86400000) / 1000) * 2);
  const keyFor = (jti) => `${PREFIX()}session-activity:${jti}`;

  return {
    /** Fire-and-forget write-behind after local Map.set */
    writeBehindTouch(jti, ts) {
      if (!jti) return;
      const redis = getRedis?.();
      if (!redis) return;
      redis.setEx(keyFor(jti), ttlSec, String(ts)).catch(() => {});
    },
    writeBehindClear(jti) {
      if (!jti) return;
      const redis = getRedis?.();
      if (!redis) return;
      redis.del(keyFor(jti)).catch(() => {});
    },
    /** Async read-through — merge peer node's lastSeen into local Map */
    async hydrateInto(localMap, jti) {
      if (!jti || !localMap) return null;
      const redis = getRedis?.();
      if (!redis) return localMap.get(jti) ?? null;
      try {
        const raw = await redis.get(keyFor(jti));
        if (!raw) return localMap.get(jti) ?? null;
        const ts = Number(raw);
        if (!Number.isFinite(ts)) return localMap.get(jti) ?? null;
        const local = localMap.get(jti);
        if (local === undefined || ts > local) localMap.set(jti, ts);
        return localMap.get(jti);
      } catch {
        return localMap.get(jti) ?? null;
      }
    },
  };
}

/**
 * Shared macro rate-limit: Redis counter per window, OR local LruMap fallback.
 * Local path stays sync; when Redis is up we ALSO bump a Redis key so peers
 * observe approximate shared pressure (fail-soft — Redis errors ignored).
 *
 * @param {() => import('redis').RedisClientType | null | undefined} getRedis
 */
export function createMacroRateBridge(getRedis) {
  const keyFor = (macroKey, windowId) => `${PREFIX()}macro-rl:${macroKey}:${windowId}`;

  return {
    writeBehindHit(macroKey, windowMs) {
      if (!macroKey) return;
      const redis = getRedis?.();
      if (!redis) return;
      const windowId = Math.floor(Date.now() / windowMs);
      const k = keyFor(macroKey, windowId);
      const ttl = Math.max(2, Math.ceil(windowMs / 1000) + 1);
      redis
        .multi()
        .incr(k)
        .expire(k, ttl)
        .exec()
        .catch(() => {});
    },
    async remoteCount(macroKey, windowMs) {
      const redis = getRedis?.();
      if (!redis || !macroKey) return null;
      try {
        const windowId = Math.floor(Date.now() / windowMs);
        const raw = await redis.get(keyFor(macroKey, windowId));
        return raw == null ? 0 : Number(raw) || 0;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Soft API usage windows — same pattern as macro RL.
 */
export function createApiRateBridge(getRedis) {
  const keyFor = (userKey, windowId) => `${PREFIX()}api-rl:${userKey}:${windowId}`;
  return {
    writeBehindHit(userKey, windowMs) {
      if (!userKey) return;
      const redis = getRedis?.();
      if (!redis) return;
      const windowId = Math.floor(Date.now() / windowMs);
      const k = keyFor(userKey, windowId);
      const ttl = Math.max(2, Math.ceil(windowMs / 1000) + 1);
      redis
        .multi()
        .incr(k)
        .expire(k, ttl)
        .exec()
        .catch(() => {});
    },
  };
}

export function sharedStateCoverage() {
  return {
    writeThrough: [
      "_SESSION_ACTIVITY.lastSeen",
      "_macroRateLimits",
      "_TOKEN_BLACKLIST (pre-existing)",
      "sticky-session (observability, CONCORD_STICKY_REDIS)",
    ],
    stickyRequired: ["STATE.sessions", "STATE.styleVectors", "socket.io rooms"],
    perNodeOk: ["STATE.qualia", "STATE.shadowDtus", "_llmQueue", "_breakers"],
  };
}
