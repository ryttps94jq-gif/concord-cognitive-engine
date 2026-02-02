'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Wifi, WifiOff, Database, RefreshCw, Upload, Download, Trash2 } from 'lucide-react';

interface SyncItem {
  id: string;
  type: 'dtu' | 'event' | 'setting';
  action: 'create' | 'update' | 'delete';
  timestamp: string;
  synced: boolean;
}

export default function OfflineLensPage() {
  useLensNav('offline');
  const [isOnline, setIsOnline] = useState(true);

  const cacheStats = {
    dtus: 1250,
    events: 3400,
    settings: 45,
    totalSize: '24.5 MB',
  };

  const pendingSync: SyncItem[] = [
    { id: 's-001', type: 'dtu', action: 'create', timestamp: new Date().toISOString(), synced: false },
    { id: 's-002', type: 'event', action: 'update', timestamp: new Date().toISOString(), synced: false },
    { id: 's-003', type: 'dtu', action: 'update', timestamp: new Date().toISOString(), synced: false },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📴</span>
          <div>
            <h1 className="text-xl font-bold">Offline Lens</h1>
            <p className="text-sm text-gray-400">
              Dexie cache manager and sync queue resolution
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            isOnline ? 'bg-neon-green/20 text-neon-green' : 'bg-neon-pink/20 text-neon-pink'
          }`}
        >
          {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Database className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{cacheStats.dtus}</p>
          <p className="text-sm text-gray-400">Cached DTUs</p>
        </div>
        <div className="lens-card">
          <RefreshCw className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{pendingSync.length}</p>
          <p className="text-sm text-gray-400">Pending Sync</p>
        </div>
        <div className="lens-card">
          <Download className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{cacheStats.totalSize}</p>
          <p className="text-sm text-gray-400">Cache Size</p>
        </div>
        <div className="lens-card">
          <Upload className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{cacheStats.events}</p>
          <p className="text-sm text-gray-400">Cached Events</p>
        </div>
      </div>

      {/* Sync Queue */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-neon-purple" />
            Sync Queue
          </h2>
          <button className="btn-neon text-sm" disabled={!isOnline}>
            <Upload className="w-4 h-4 mr-2 inline" />
            Sync All
          </button>
        </div>
        <div className="space-y-2">
          {pendingSync.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${item.synced ? 'bg-neon-green' : 'bg-yellow-500'}`} />
                <div>
                  <p className="text-sm font-medium capitalize">{item.action} {item.type}</p>
                  <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 bg-neon-green/20 text-neon-green rounded" disabled={!isOnline}>
                  <Upload className="w-4 h-4" />
                </button>
                <button className="p-2 bg-neon-pink/20 text-neon-pink rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cache Management */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-neon-blue" />
          Cache Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="lens-card text-left hover:border-neon-green">
            <Download className="w-5 h-5 text-neon-green mb-2" />
            <p className="font-medium">Download All</p>
            <p className="text-xs text-gray-400">Cache entire database locally</p>
          </button>
          <button className="lens-card text-left hover:border-neon-blue">
            <RefreshCw className="w-5 h-5 text-neon-blue mb-2" />
            <p className="font-medium">Force Refresh</p>
            <p className="text-xs text-gray-400">Re-sync from server</p>
          </button>
          <button className="lens-card text-left hover:border-neon-pink">
            <Trash2 className="w-5 h-5 text-neon-pink mb-2" />
            <p className="font-medium">Clear Cache</p>
            <p className="text-xs text-gray-400">Remove all cached data</p>
          </button>
        </div>
      </div>
    </div>
  );
}
