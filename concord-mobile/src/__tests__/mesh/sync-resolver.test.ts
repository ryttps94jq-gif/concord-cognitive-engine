// Tests for Sync Conflict Resolution module

import {
  createSyncResolver,
  type SyncResolver,
  type SyncMeta,
} from '../../mesh/sync/sync-resolver';
import { DTU_TYPES, DTU_VERSION } from '../../utils/constants';
import type { DTU, DTUTypeCode } from '../../utils/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDTU(id: string, overrides: Partial<{
  timestamp: number;
  contentHash: Uint8Array;
  content: Uint8Array;
}> = {}): DTU {
  return {
    id,
    header: {
      version: DTU_VERSION,
      flags: 0,
      type: DTU_TYPES.TEXT as DTUTypeCode,
      timestamp: overrides.timestamp ?? Date.now(),
      contentLength: 64,
      contentHash: overrides.contentHash ?? new Uint8Array(32).fill(0xaa),
    },
    content: overrides.content ?? new Uint8Array(64).fill(0x61),
    tags: ['test'],
    meta: { scope: 'local', published: false, painTagged: false, crpiScore: 0, relayCount: 0, ttl: 7 },
    lineage: { parentId: null, ancestors: [], depth: 0 },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SyncResolver', () => {
  let resolver: SyncResolver;

  beforeEach(() => {
    resolver = createSyncResolver('device_test_001');
  });

  // ── Conflict Detection ────────────────────────────────────────────────────

  describe('detectConflict', () => {
    it('returns null when content hashes match', () => {
      const local = makeDTU('dtu_1');
      const remote = makeDTU('dtu_1');
      expect(resolver.detectConflict(local, remote)).toBeNull();
    });

    it('returns null for different DTU IDs', () => {
      const local = makeDTU('dtu_1');
      const remote = makeDTU('dtu_2');
      expect(resolver.detectConflict(local, remote)).toBeNull();
    });

    it('detects conflict when content hashes differ', () => {
      const local = makeDTU('dtu_1', { contentHash: new Uint8Array(32).fill(0xaa) });
      const remote = makeDTU('dtu_1', { contentHash: new Uint8Array(32).fill(0xbb) });

      const conflict = resolver.detectConflict(local, remote);
      expect(conflict).not.toBeNull();
      expect(conflict!.localContentHash).not.toBe(conflict!.remoteContentHash);
      expect(conflict!.detectedAt).toBeGreaterThan(0);
    });

    it('includes timestamps in conflict record', () => {
      const local = makeDTU('dtu_1', { timestamp: 1000, contentHash: new Uint8Array(32).fill(0x01) });
      const remote = makeDTU('dtu_1', { timestamp: 2000, contentHash: new Uint8Array(32).fill(0x02) });

      const conflict = resolver.detectConflict(local, remote);
      expect(conflict!.localTimestamp).toBe(1000);
      expect(conflict!.remoteTimestamp).toBe(2000);
    });
  });

  // ── Conflict Resolution ───────────────────────────────────────────────────

  describe('resolve', () => {
    it('last-write-wins: remote wins when newer', () => {
      const local = makeDTU('dtu_1', { timestamp: 1000, contentHash: new Uint8Array(32).fill(0x01) });
      const remote = makeDTU('dtu_1', { timestamp: 2000, contentHash: new Uint8Array(32).fill(0x02) });

      const resolution = resolver.resolve(local, remote, 'last-write-wins');
      expect(resolution.winner).toBe('remote');
      expect(resolution.strategy).toBe('last-write-wins');
      expect(resolution.resolvedBy).toBe('auto');
    });

    it('last-write-wins: local wins when newer', () => {
      const local = makeDTU('dtu_1', { timestamp: 3000, contentHash: new Uint8Array(32).fill(0x01) });
      const remote = makeDTU('dtu_1', { timestamp: 2000, contentHash: new Uint8Array(32).fill(0x02) });

      const resolution = resolver.resolve(local, remote, 'last-write-wins');
      expect(resolution.winner).toBe('local');
    });

    it('last-write-wins: local wins on tie', () => {
      const local = makeDTU('dtu_1', { timestamp: 1000, contentHash: new Uint8Array(32).fill(0x01) });
      const remote = makeDTU('dtu_1', { timestamp: 1000, contentHash: new Uint8Array(32).fill(0x02) });

      const resolution = resolver.resolve(local, remote, 'last-write-wins');
      expect(resolution.winner).toBe('local');
    });

    it('content-hash-priority: deterministic winner', () => {
      const local = makeDTU('dtu_1', { contentHash: new Uint8Array(32).fill(0xff) });
      const remote = makeDTU('dtu_1', { contentHash: new Uint8Array(32).fill(0x01) });

      const resolution = resolver.resolve(local, remote, 'content-hash-priority');
      expect(resolution.winner).toBe('local'); // 0xff > 0x01
      expect(resolution.resolvedBy).toBe('auto');
    });

    it('content-hash-priority: remote wins when hash is higher', () => {
      const local = makeDTU('dtu_1', { contentHash: new Uint8Array(32).fill(0x01) });
      const remote = makeDTU('dtu_1', { contentHash: new Uint8Array(32).fill(0xff) });

      const resolution = resolver.resolve(local, remote, 'content-hash-priority');
      expect(resolution.winner).toBe('remote');
    });

    it('manual strategy defaults to local', () => {
      const local = makeDTU('dtu_1', { contentHash: new Uint8Array(32).fill(0x01) });
      const remote = makeDTU('dtu_1', { contentHash: new Uint8Array(32).fill(0x02) });

      const resolution = resolver.resolve(local, remote, 'manual');
      expect(resolution.winner).toBe('local');
      expect(resolution.resolvedBy).toBe('user');
    });
  });

  // ── Sync Metadata Tracking ────────────────────────────────────────────────

  describe('sync metadata', () => {
    it('stores and retrieves sync metadata', () => {
      const meta: SyncMeta = {
        dtuId: 'dtu_1',
        localVersion: 1,
        remoteVersion: 1,
        syncedAt: Date.now(),
        status: 'synced',
      };
      resolver.setSyncMeta(meta);
      expect(resolver.getSyncMeta('dtu_1')).toEqual(meta);
    });

    it('returns undefined for unknown DTU', () => {
      expect(resolver.getSyncMeta('nonexistent')).toBeUndefined();
    });

    it('markSynced updates version and status', () => {
      resolver.markDirty('dtu_1');
      resolver.markSynced('dtu_1', 5);

      const meta = resolver.getSyncMeta('dtu_1');
      expect(meta!.status).toBe('synced');
      expect(meta!.localVersion).toBe(5);
      expect(meta!.remoteVersion).toBe(5);
      expect(meta!.syncedAt).toBeGreaterThan(0);
    });

    it('markDirty creates new entry if none exists', () => {
      resolver.markDirty('dtu_new');
      const meta = resolver.getSyncMeta('dtu_new');
      expect(meta!.status).toBe('pending_upload');
      expect(meta!.localVersion).toBe(1);
      expect(meta!.remoteVersion).toBe(0);
    });

    it('markDirty increments version on existing entry', () => {
      resolver.markSynced('dtu_1', 3);
      resolver.markDirty('dtu_1');

      const meta = resolver.getSyncMeta('dtu_1');
      expect(meta!.status).toBe('pending_upload');
      expect(meta!.localVersion).toBe(4);
    });
  });

  // ── Filtering ─────────────────────────────────────────────────────────────

  describe('filtering', () => {
    beforeEach(() => {
      resolver.setSyncMeta({ dtuId: 'd1', localVersion: 1, remoteVersion: 1, syncedAt: 100, status: 'synced' });
      resolver.setSyncMeta({ dtuId: 'd2', localVersion: 2, remoteVersion: 1, syncedAt: 100, status: 'pending_upload' });
      resolver.setSyncMeta({ dtuId: 'd3', localVersion: 1, remoteVersion: 2, syncedAt: 100, status: 'pending_download' });
      resolver.setSyncMeta({
        dtuId: 'd4', localVersion: 2, remoteVersion: 2, syncedAt: 100, status: 'conflicted',
        conflictData: {
          localTimestamp: 1000, remoteTimestamp: 2000,
          localContentHash: 'aaa', remoteContentHash: 'bbb', detectedAt: Date.now(),
        },
      });
    });

    it('getPendingUploads returns only pending_upload items', () => {
      const uploads = resolver.getPendingUploads();
      expect(uploads).toHaveLength(1);
      expect(uploads[0].dtuId).toBe('d2');
    });

    it('getPendingDownloads returns only pending_download items', () => {
      const downloads = resolver.getPendingDownloads();
      expect(downloads).toHaveLength(1);
      expect(downloads[0].dtuId).toBe('d3');
    });

    it('getConflicts returns only conflicted items', () => {
      const conflicts = resolver.getConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].dtuId).toBe('d4');
      expect(conflicts[0].conflictData).toBeDefined();
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns accurate counts', () => {
      resolver.setSyncMeta({ dtuId: 'd1', localVersion: 1, remoteVersion: 1, syncedAt: 500, status: 'synced' });
      resolver.setSyncMeta({ dtuId: 'd2', localVersion: 2, remoteVersion: 1, syncedAt: 100, status: 'pending_upload' });
      resolver.setSyncMeta({ dtuId: 'd3', localVersion: 1, remoteVersion: 2, syncedAt: 200, status: 'pending_download' });
      resolver.setSyncMeta({ dtuId: 'd4', localVersion: 2, remoteVersion: 2, syncedAt: 300, status: 'conflicted' });

      const stats = resolver.getStats();
      expect(stats.totalTracked).toBe(4);
      expect(stats.synced).toBe(1);
      expect(stats.pendingUpload).toBe(1);
      expect(stats.pendingDownload).toBe(1);
      expect(stats.conflicted).toBe(1);
      expect(stats.lastSyncAt).toBe(500);
    });

    it('returns zeros for empty resolver', () => {
      const stats = resolver.getStats();
      expect(stats.totalTracked).toBe(0);
      expect(stats.synced).toBe(0);
      expect(stats.lastSyncAt).toBe(0);
    });
  });

  // ── Clear ─────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all tracked metadata', () => {
      resolver.markDirty('d1');
      resolver.markDirty('d2');
      expect(resolver.getStats().totalTracked).toBe(2);

      resolver.clear();
      expect(resolver.getStats().totalTracked).toBe(0);
      expect(resolver.getSyncMeta('d1')).toBeUndefined();
    });
  });

  // ── End-to-End Sync Flow ──────────────────────────────────────────────────

  describe('end-to-end sync flow', () => {
    it('detects, resolves, and marks conflict as synced', () => {
      const local = makeDTU('dtu_1', { timestamp: 1000, contentHash: new Uint8Array(32).fill(0x01) });
      const remote = makeDTU('dtu_1', { timestamp: 2000, contentHash: new Uint8Array(32).fill(0x02) });

      // Step 1: Detect conflict
      const conflict = resolver.detectConflict(local, remote);
      expect(conflict).not.toBeNull();

      // Step 2: Record conflict in metadata
      resolver.setSyncMeta({
        dtuId: 'dtu_1',
        localVersion: 1,
        remoteVersion: 2,
        syncedAt: 0,
        status: 'conflicted',
        conflictData: conflict!,
      });
      expect(resolver.getConflicts()).toHaveLength(1);

      // Step 3: Resolve with last-write-wins
      const resolution = resolver.resolve(local, remote, 'last-write-wins');
      expect(resolution.winner).toBe('remote');

      // Step 4: Apply resolution and mark synced
      resolver.markSynced('dtu_1', 2);
      expect(resolver.getConflicts()).toHaveLength(0);
      expect(resolver.getSyncMeta('dtu_1')!.status).toBe('synced');
    });

    it('handles local edits after sync', () => {
      // Initially synced
      resolver.markSynced('dtu_1', 1);
      expect(resolver.getSyncMeta('dtu_1')!.status).toBe('synced');

      // Local edit
      resolver.markDirty('dtu_1');
      expect(resolver.getSyncMeta('dtu_1')!.status).toBe('pending_upload');
      expect(resolver.getSyncMeta('dtu_1')!.localVersion).toBe(2);

      // Sync again
      resolver.markSynced('dtu_1', 2);
      expect(resolver.getSyncMeta('dtu_1')!.status).toBe('synced');
    });
  });
});
