'use client';

import React, { useEffect, useState } from 'react';
import { useSyncStatus } from '@/hooks/useOfflineFirst';

/**
 * SyncIndicator — Shows sync queue status in the UI.
 *
 * States:
 *   - Online, nothing pending: hidden
 *   - Online, items syncing: blue pulse "Syncing N items..."
 *   - Offline, items queued: amber "N items queued (offline)"
 *   - Offline, nothing queued: gray "Offline"
 */
export default function SyncIndicator() {
  const { pending, online } = useSyncStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show when offline or when there are pending items
    setVisible(!online || pending > 0);
  }, [online, pending]);

  if (!visible) return null;

  const isOfflineWithItems = !online && pending > 0;
  const isOfflineClean = !online && pending === 0;
  const isSyncing = online && pending > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono shadow-lg backdrop-blur-sm">
      {isSyncing && (
        <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/40 text-blue-300 px-3 py-2 rounded-lg">
          <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          Syncing {pending} item{pending !== 1 ? 's' : ''}...
        </div>
      )}
      {isOfflineWithItems && (
        <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-3 py-2 rounded-lg">
          <span className="inline-block w-2 h-2 bg-amber-400 rounded-full" />
          {pending} item{pending !== 1 ? 's' : ''} queued (offline)
        </div>
      )}
      {isOfflineClean && (
        <div className="flex items-center gap-2 bg-gray-500/20 border border-gray-500/40 text-gray-400 px-3 py-2 rounded-lg">
          <span className="inline-block w-2 h-2 bg-gray-500 rounded-full" />
          Offline
        </div>
      )}
    </div>
  );
}
