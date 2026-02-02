'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Users, Plus, MessageSquare, Target, Shield, Zap } from 'lucide-react';

interface Alliance {
  id: string;
  name: string;
  description: string;
  members: string[];
  type: 'research' | 'security' | 'development' | 'governance';
  status: 'active' | 'forming' | 'dissolved';
  sharedWorkspace: string;
  activeProposals: number;
  createdAt: string;
}

interface AllianceMessage {
  id: string;
  allianceId: string;
  sender: string;
  content: string;
  timestamp: string;
}

export default function AllianceLensPage() {
  useLensNav('alliance');
  const [selectedAlliance, setSelectedAlliance] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [chatMessage, setChatMessage] = useState('');

  // Mock alliances
  const alliances: Alliance[] = [
    { id: 'a-001', name: 'Research Collective', description: 'Collaborative DTU synthesis and verification', members: ['Research Prime', 'Architect Zero'], type: 'research', status: 'active', sharedWorkspace: 'research-shared', activeProposals: 3, createdAt: '2026-01-20' },
    { id: 'a-002', name: 'Guardian Alliance', description: 'Security monitoring and invariant enforcement', members: ['Guardian One', 'Alpha Worker'], type: 'security', status: 'active', sharedWorkspace: 'security-ops', activeProposals: 1, createdAt: '2026-01-25' },
    { id: 'a-003', name: 'Core Builders', description: 'System evolution and upgrades', members: ['Architect Zero'], type: 'development', status: 'forming', sharedWorkspace: 'core-dev', activeProposals: 0, createdAt: '2026-01-30' },
  ];

  // Mock chat messages
  const messages: AllianceMessage[] = [
    { id: 'm-001', allianceId: 'a-001', sender: 'Research Prime', content: 'New quantum DTU ready for verification', timestamp: new Date().toISOString() },
    { id: 'm-002', allianceId: 'a-001', sender: 'Architect Zero', content: 'Running overlap verifier now', timestamp: new Date().toISOString() },
  ];

  const typeColors = {
    research: 'text-neon-purple bg-neon-purple/20',
    security: 'text-neon-green bg-neon-green/20',
    development: 'text-neon-cyan bg-neon-cyan/20',
    governance: 'text-neon-blue bg-neon-blue/20',
  };

  const selectedAllianceData = alliances.find((a) => a.id === selectedAlliance);
  const allianceMessages = messages.filter((m) => m.allianceId === selectedAlliance);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤝</span>
          <div>
            <h1 className="text-xl font-bold">Alliance Lens</h1>
            <p className="text-sm text-gray-400">
              Multi-entity collaboration and shared workspaces
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-neon purple"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Form Alliance
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Users className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{alliances.length}</p>
          <p className="text-sm text-gray-400">Total Alliances</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{alliances.filter((a) => a.status === 'active').length}</p>
          <p className="text-sm text-gray-400">Active</p>
        </div>
        <div className="lens-card">
          <Target className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{alliances.reduce((s, a) => s + a.activeProposals, 0)}</p>
          <p className="text-sm text-gray-400">Joint Proposals</p>
        </div>
        <div className="lens-card">
          <Shield className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{alliances.reduce((s, a) => s + a.members.length, 0)}</p>
          <p className="text-sm text-gray-400">Total Members</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alliance List */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-neon-purple" />
            Alliances
          </h2>
          <div className="space-y-3">
            {alliances.map((alliance) => (
              <button
                key={alliance.id}
                onClick={() => setSelectedAlliance(alliance.id)}
                className={`w-full text-left lens-card transition-all ${
                  selectedAlliance === alliance.id ? 'border-neon-cyan ring-1 ring-neon-cyan' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{alliance.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${typeColors[alliance.type]}`}>
                    {alliance.type}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-2">{alliance.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{alliance.members.length} members</span>
                  <span className={alliance.status === 'active' ? 'text-neon-green' : 'text-gray-400'}>
                    {alliance.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Alliance Details & Chat */}
        <div className="lg:col-span-2 space-y-4">
          {selectedAllianceData ? (
            <>
              {/* Details */}
              <div className="panel p-4">
                <h2 className="font-semibold mb-4">{selectedAllianceData.name}</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="lens-card">
                    <p className="text-xs text-gray-400">Shared Workspace</p>
                    <p className="font-mono">{selectedAllianceData.sharedWorkspace}</p>
                  </div>
                  <div className="lens-card">
                    <p className="text-xs text-gray-400">Active Proposals</p>
                    <p className="text-xl font-bold text-neon-purple">{selectedAllianceData.activeProposals}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2">Members</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAllianceData.members.map((member) => (
                      <span key={member} className="px-3 py-1 bg-lattice-surface rounded-full text-sm">
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat */}
              <div className="panel p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-neon-blue" />
                  Alliance Chat
                </h3>
                <div className="space-y-3 mb-4 max-h-60 overflow-auto">
                  {allianceMessages.length === 0 ? (
                    <p className="text-center py-4 text-gray-500">No messages yet</p>
                  ) : (
                    allianceMessages.map((msg) => (
                      <div key={msg.id} className="bg-lattice-deep p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-neon-cyan">{msg.sender}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Message the alliance..."
                    className="input-lattice flex-1"
                  />
                  <button className="btn-neon">Send</button>
                </div>
              </div>
            </>
          ) : (
            <div className="panel p-4 h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select an alliance to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
