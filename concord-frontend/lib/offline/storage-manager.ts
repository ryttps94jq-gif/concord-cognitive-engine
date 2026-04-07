/**
 * Storage Manager — LRU Eviction + Quota Enforcement
 *
 * Keeps IndexedDB under 40MB with automatic eviction of oldest
 * non-pinned items. Warns at 35MB. Users can pin DTUs to prevent eviction.
 *
 * Budget: 40MB total across all tables. 35MB warning threshold.
 * Eviction: Oldest-accessed non-pinned items first (LRU).
 * Pinning: Users mark important DTUs as pinned — these survive eviction.
 */

import { getDB } from './db';

// ── Budget Constants ──────────────────────────────────────
export const STORAGE_BUDGET_MB = 40;
export const STORAGE_WARNING_MB = 35;
export const STORAGE_BUDGET_BYTES = STORAGE_BUDGET_MB * 1024 * 1024;
export const STORAGE_WARNING_BYTES = STORAGE_WARNING_MB * 1024 * 1024;

// ── Types ─────────────────────────────────────────────────
export interface StorageUsage {
  totalBytes: number;
  totalMB: number;
  budgetMB: number;
  percentUsed: number;
  overWarning: boolean;
  overBudget: boolean;
  tables: Record<string, { count: number; estimatedBytes: number }>;
}

export interface EvictionResult {
  evictedCount: number;
  freedBytes: number;
  tables: Record<string, number>;
}

// ── Pin Management ────────────────────────────────────────
// Pinned DTU IDs are stored in localStorage (tiny, survives IDB clearing)
const PINNED_KEY = 'concord_pinned_dtus';

export function getPinnedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function pinDTU(id: string): void {
  const pinned = getPinnedIds();
  pinned.add(id);
  localStorage.setItem(PINNED_KEY, JSON.stringify([...pinned]));
}

export function unpinDTU(id: string): void {
  const pinned = getPinnedIds();
  pinned.delete(id);
  localStorage.setItem(PINNED_KEY, JSON.stringify([...pinned]));
}

export function isDTUPinned(id: string): boolean {
  return getPinnedIds().has(id);
}

// ── Access Tracking ───────────────────────────────────────
// Track last access time per DTU for LRU ordering
const ACCESS_KEY = 'concord_dtu_access';

function getAccessTimes(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function touchDTU(id: string): void {
  const times = getAccessTimes();
  times[id] = Date.now();
  // Keep only last 2000 entries to prevent localStorage bloat
  const entries = Object.entries(times);
  if (entries.length > 2000) {
    entries.sort((a, b) => b[1] - a[1]);
    const trimmed = Object.fromEntries(entries.slice(0, 1500));
    localStorage.setItem(ACCESS_KEY, JSON.stringify(trimmed));
  } else {
    localStorage.setItem(ACCESS_KEY, JSON.stringify(times));
  }
}

// ── Storage Estimation ────────────────────────────────────

/** Estimate size of a record in bytes (rough JSON serialization size) */
function estimateRecordSize(record: unknown): number {
  try {
    return new Blob([JSON.stringify(record)]).size;
  } catch {
    // Fallback: rough estimate
    return JSON.stringify(record).length * 2;
  }
}

/** Get current storage usage across all tables */
export async function getStorageUsage(): Promise<StorageUsage> {
  const db = getDB();

  // Count records in each table
  const [dtuCount, pendingCount, chatCount, conflictCount] = await Promise.all([
    db.dtus.count(),
    db.pendingActions.count(),
    db.chatMessages.count(),
    db.conflicts.count(),
  ]);

  // Sample-based size estimation (sample up to 50 records per table)
  const estimateTable = async (table: string, count: number): Promise<number> => {
    if (count === 0) return 0;
    const sampleSize = Math.min(count, 50);
    const samples = await (db.table(table) as ReturnType<typeof db.table>).limit(sampleSize).toArray();
    if (samples.length === 0) return 0;
    const avgSize = samples.reduce((sum: number, r: unknown) => sum + estimateRecordSize(r), 0) / samples.length;
    return Math.round(avgSize * count);
  };

  const [dtuBytes, pendingBytes, chatBytes, conflictBytes] = await Promise.all([
    estimateTable('dtus', dtuCount),
    estimateTable('pendingActions', pendingCount),
    estimateTable('chatMessages', chatCount),
    estimateTable('conflicts', conflictCount),
  ]);

  const totalBytes = dtuBytes + pendingBytes + chatBytes + conflictBytes;
  const totalMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

  return {
    totalBytes,
    totalMB,
    budgetMB: STORAGE_BUDGET_MB,
    percentUsed: Math.round((totalBytes / STORAGE_BUDGET_BYTES) * 100),
    overWarning: totalBytes >= STORAGE_WARNING_BYTES,
    overBudget: totalBytes >= STORAGE_BUDGET_BYTES,
    tables: {
      dtus: { count: dtuCount, estimatedBytes: dtuBytes },
      pendingActions: { count: pendingCount, estimatedBytes: pendingBytes },
      chatMessages: { count: chatCount, estimatedBytes: chatBytes },
      conflicts: { count: conflictCount, estimatedBytes: conflictBytes },
    },
  };
}

// ── Native Storage Manager API ────────────────────────────

/** Try to get real quota info from the Storage API */
export async function getNativeQuota(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    return { usage: est.usage || 0, quota: est.quota || 0 };
  } catch {
    return null;
  }
}

// ── LRU Eviction ──────────────────────────────────────────

/**
 * Evict oldest non-pinned items to bring storage under budget.
 * Order: resolved conflicts first, then old chat messages, then LRU DTUs.
 * Never evicts pinned DTUs or pending actions.
 */
export async function evict(targetBytes: number = STORAGE_WARNING_BYTES): Promise<EvictionResult> {
  const db = getDB();
  const usage = await getStorageUsage();
  const result: EvictionResult = { evictedCount: 0, freedBytes: 0, tables: {} };

  if (usage.totalBytes <= targetBytes) return result;

  const toFree = usage.totalBytes - targetBytes;
  let freed = 0;

  // Phase 1: Clear resolved conflicts (they're just records, safe to purge)
  if (freed < toFree) {
    const resolved = await db.conflicts
      .where('resolution')
      .anyOf(['local_wins', 'server_wins', 'merged'])
      .toArray();

    for (const conflict of resolved) {
      if (freed >= toFree) break;
      const size = estimateRecordSize(conflict);
      await db.conflicts.delete(conflict.id);
      freed += size;
      result.evictedCount++;
      result.tables['conflicts'] = (result.tables['conflicts'] || 0) + 1;
    }
  }

  // Phase 2: Evict old synced chat messages (keep last 100)
  if (freed < toFree) {
    const allChat = await db.chatMessages.orderBy('timestamp').toArray();
    const syncedOld = allChat
      .filter(m => m.synced)
      .slice(0, Math.max(0, allChat.length - 100)); // keep last 100

    for (const msg of syncedOld) {
      if (freed >= toFree) break;
      const size = estimateRecordSize(msg);
      await db.chatMessages.delete(msg.id);
      freed += size;
      result.evictedCount++;
      result.tables['chatMessages'] = (result.tables['chatMessages'] || 0) + 1;
    }
  }

  // Phase 3: Evict LRU non-pinned, synced DTUs
  if (freed < toFree) {
    const pinned = getPinnedIds();
    const accessTimes = getAccessTimes();
    const allDtus = await db.dtus.toArray();

    // Filter: only synced, non-pinned DTUs are evictable
    const evictable = allDtus
      .filter(d => d.synced && !pinned.has(d.id))
      .sort((a, b) => {
        // Sort by last access time ascending (oldest accessed first)
        const aTime = accessTimes[a.id] || new Date(a.timestamp).getTime();
        const bTime = accessTimes[b.id] || new Date(b.timestamp).getTime();
        return aTime - bTime;
      });

    for (const dtu of evictable) {
      if (freed >= toFree) break;
      const size = estimateRecordSize(dtu);
      await db.dtus.delete(dtu.id);
      freed += size;
      result.evictedCount++;
      result.tables['dtus'] = (result.tables['dtus'] || 0) + 1;
    }
  }

  result.freedBytes = freed;
  return result;
}

// ── Auto-Eviction Check ──────────────────────────────────

/** Storage warning/eviction listeners */
type StorageListener = (usage: StorageUsage) => void;
const _warningListeners: StorageListener[] = [];

export function onStorageWarning(listener: StorageListener): () => void {
  _warningListeners.push(listener);
  return () => {
    const idx = _warningListeners.indexOf(listener);
    if (idx >= 0) _warningListeners.splice(idx, 1);
  };
}

/**
 * Check storage and auto-evict if over budget.
 * Call this periodically or after writes.
 */
export async function checkAndEvict(): Promise<StorageUsage> {
  const usage = await getStorageUsage();

  if (usage.overWarning) {
    _warningListeners.forEach(l => l(usage));
  }

  if (usage.overBudget) {
    console.warn(`[Storage] Over budget: ${usage.totalMB}MB / ${STORAGE_BUDGET_MB}MB. Evicting...`);
    const result = await evict();
    console.debug(`[Storage] Evicted ${result.evictedCount} items, freed ${Math.round(result.freedBytes / 1024)}KB`);
  }

  return usage;
}
