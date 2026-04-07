/**
 * Offline Queue — Typed Action Queue with Sync Indicator
 *
 * Actions taken offline get queued in IndexedDB and flush in order
 * when connection restores. Conflicts resolved by timestamp.
 *
 * Queued action types:
 *   - DTU creation
 *   - Social posts
 *   - Marketplace listings
 *   - Chat messages (with "will send when online" indicator)
 */

import { getDB, getNormalizedTimestamp, isOnline, onOnlineStatusChange } from './db';
import { checkAndEvict } from './storage-manager';

// ── Types ─────────────────────────────────────────────────

export type QueuedActionType =
  | 'dtu:create' | 'dtu:update' | 'dtu:delete'
  | 'chat:send'
  | 'social:post' | 'social:like' | 'social:comment'
  | 'market:list' | 'market:purchase'
  | 'profile:update'
  | 'feed:subscribe' | 'feed:unsubscribe';

export interface QueuedAction {
  id: string;
  actionType: QueuedActionType;
  endpoint: string;    // API endpoint to call when online
  method: 'POST' | 'PUT' | 'DELETE';
  payload: unknown;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed' | 'quarantined';
  attempts: number;
  lastError?: string;
}

export interface QueueStatus {
  pending: number;
  syncing: number;
  failed: number;
  quarantined: number;
  total: number;
  oldestPending?: string;
}

// ── Queue Operations ──────────────────────────────────────

/** Add an action to the offline queue */
export async function queueAction(
  actionType: QueuedActionType,
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE',
  payload: unknown
): Promise<string> {
  const db = getDB();
  const id = `oq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await db.pendingActions.add({
    id,
    type: method === 'DELETE' ? 'delete' : method === 'PUT' ? 'update' : 'create',
    entity: actionType.split(':')[0] as 'dtu' | 'chat' | 'market',
    payload: { actionType, endpoint, method, payload },
    timestamp: getNormalizedTimestamp(),
    attempts: 0,
  });

  // Check storage after write
  await checkAndEvict();

  return id;
}

/** Get queue status summary */
export async function getQueueStatus(): Promise<QueueStatus> {
  const db = getDB();
  const all = await db.pendingActions.toArray();

  const pending = all.filter(a => !a.quarantined && a.attempts === 0).length;
  const syncing = 0; // tracked in-memory during flush
  const failed = all.filter(a => !a.quarantined && a.attempts > 0).length;
  const quarantined = all.filter(a => a.quarantined).length;
  const oldest = all
    .filter(a => !a.quarantined)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];

  return {
    pending,
    syncing,
    failed,
    quarantined,
    total: all.length,
    oldestPending: oldest?.timestamp,
  };
}

// ── Queue Flush ───────────────────────────────────────────

let _flushing = false;
const _flushListeners: Array<(status: QueueStatus) => void> = [];

export function onQueueChange(listener: (status: QueueStatus) => void): () => void {
  _flushListeners.push(listener);
  return () => {
    const idx = _flushListeners.indexOf(listener);
    if (idx >= 0) _flushListeners.splice(idx, 1);
  };
}

async function notifyListeners() {
  const status = await getQueueStatus();
  _flushListeners.forEach(l => l(status));
}

/**
 * Flush all pending actions to the server.
 * Processes in order (oldest first). Stops on auth errors.
 */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  if (_flushing || !isOnline()) return { synced: 0, failed: 0 };
  _flushing = true;

  const db = getDB();
  let synced = 0;
  let failed = 0;

  try {
    const actions = await db.pendingActions
      .orderBy('timestamp')
      .filter(a => !a.quarantined)
      .toArray();

    for (const action of actions) {
      const detail = action.payload as {
        actionType: string;
        endpoint: string;
        method: string;
        payload: unknown;
      };

      try {
        const res = await fetch(detail.endpoint, {
          method: detail.method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: detail.method !== 'DELETE' ? JSON.stringify(detail.payload) : undefined,
        });

        if (res.ok || res.status === 201 || res.status === 204) {
          await db.pendingActions.delete(action.id);
          synced++;
        } else if (res.status === 401 || res.status === 403) {
          // Auth error — stop flushing, user needs to re-login
          console.warn('[OfflineQueue] Auth error, stopping flush');
          break;
        } else if (res.status === 409) {
          // Conflict — server has newer version, discard local action
          console.warn(`[OfflineQueue] Conflict for ${action.id}, discarding`);
          await db.pendingActions.delete(action.id);
          failed++;
        } else {
          // Other error — increment attempts
          const newAttempts = action.attempts + 1;
          await db.pendingActions.update(action.id, {
            attempts: newAttempts,
            quarantined: newAttempts >= 5,
          });
          failed++;
        }
      } catch {
        // Network error — stop flushing
        failed++;
        break;
      }

      await notifyListeners();
    }
  } finally {
    _flushing = false;
    await notifyListeners();
  }

  return { synced, failed };
}

// ── Auto-Flush on Reconnect ──────────────────────────────

let _autoFlushCleanup: (() => void) | null = null;

/** Start auto-flushing when connection is restored */
export function startAutoFlush(): void {
  if (_autoFlushCleanup) return;

  _autoFlushCleanup = onOnlineStatusChange(async (online) => {
    if (online) {
      console.debug('[OfflineQueue] Online — flushing queue...');
      const result = await flushQueue();
      console.debug(`[OfflineQueue] Flushed: ${result.synced} synced, ${result.failed} failed`);
    }
  });
}

/** Stop auto-flush */
export function stopAutoFlush(): void {
  _autoFlushCleanup?.();
  _autoFlushCleanup = null;
}
