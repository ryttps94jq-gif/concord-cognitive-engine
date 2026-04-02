/**
 * Offline-First Module — Barrel exports
 *
 * Three-layer architecture:
 *   Layer 1: IndexedDB (under 40MB, LRU eviction)
 *   Layer 2: User's cloud storage (Google Drive / Dropbox)
 *   Layer 3: Server (only for shared content)
 */

// Core database
export { getDB, dtuOffline, pendingActions, chatOffline, conflicts } from './db';
export { updateClockOffset, getNormalizedTimestamp, isOnline, onOnlineStatusChange } from './db';
export type { ConflictRecord } from './db';

// Storage management (LRU eviction, pinning, quota)
export {
  getStorageUsage, checkAndEvict, evict,
  pinDTU, unpinDTU, isDTUPinned, getPinnedIds,
  touchDTU, onStorageWarning,
  getNativeQuota,
  STORAGE_BUDGET_MB, STORAGE_WARNING_MB,
} from './storage-manager';
export type { StorageUsage, EvictionResult } from './storage-manager';

// Cloud storage bridge
export {
  uploadArtifact, downloadArtifact, deleteArtifact,
  getCloudConfig, saveCloudConfig, clearCloudConfig,
  isCloudConnected, checkCloudConnection, getCloudUsage,
} from './cloud-bridge';
export type { CloudProvider, CloudConfig, ExternalRef, CloudUploadResult } from './cloud-bridge';

// Offline queue
export {
  queueAction, getQueueStatus, flushQueue,
  onQueueChange, startAutoFlush, stopAutoFlush,
} from './offline-queue';
export type { QueuedActionType, QueuedAction, QueueStatus } from './offline-queue';

// Substrate cache
export { cacheSubstrateLocally, loadOfflineSubstrate, clearOfflineSubstrate, getOfflineCacheInfo } from './substrate-cache';
