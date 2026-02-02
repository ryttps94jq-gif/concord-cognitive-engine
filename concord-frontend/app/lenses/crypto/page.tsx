'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Coins, TrendingUp, Lock, RefreshCw, ArrowRightLeft, Wallet } from 'lucide-react';

export default function CryptoLensPage() {
  useLensNav('crypto');
  const [selectedChain, setSelectedChain] = useState('concord');

  const chains = [
    { id: 'concord', name: 'Concord Chain', symbol: 'CC', balance: 1000, price: 1.00 },
    { id: 'ethereum', name: 'Ethereum (Sim)', symbol: 'sETH', balance: 2.5, price: 2400 },
    { id: 'bitcoin', name: 'Bitcoin (Sim)', symbol: 'sBTC', balance: 0.05, price: 45000 },
  ];

  const transactions = [
    { id: 't-001', type: 'earn', amount: 100, symbol: 'CC', description: 'Quest completion', timestamp: new Date().toISOString() },
    { id: 't-002', type: 'spend', amount: 25, symbol: 'CC', description: 'DTU purchase', timestamp: new Date().toISOString() },
    { id: 't-003', type: 'earn', amount: 50, symbol: 'CC', description: 'Council vote reward', timestamp: new Date().toISOString() },
  ];

  const selectedChainData = chains.find((c) => c.id === selectedChain);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🪙</span>
        <div>
          <h1 className="text-xl font-bold">Crypto Lens</h1>
          <p className="text-sm text-gray-400">
            Blockchain simulations and CC ledger management
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Wallet className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{selectedChainData?.balance} {selectedChainData?.symbol}</p>
          <p className="text-sm text-gray-400">Balance</p>
        </div>
        <div className="lens-card">
          <TrendingUp className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">${selectedChainData?.price}</p>
          <p className="text-sm text-gray-400">Price</p>
        </div>
        <div className="lens-card">
          <ArrowRightLeft className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{transactions.length}</p>
          <p className="text-sm text-gray-400">Transactions</p>
        </div>
        <div className="lens-card">
          <Lock className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">Verified</p>
          <p className="text-sm text-gray-400">Ledger Status</p>
        </div>
      </div>

      {/* Chain Selector */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Coins className="w-4 h-4 text-neon-green" />
          Chains
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {chains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedChain(chain.id)}
              className={`lens-card text-left ${
                selectedChain === chain.id ? 'border-neon-green ring-1 ring-neon-green' : ''
              }`}
            >
              <p className="font-semibold">{chain.name}</p>
              <p className="text-2xl font-bold text-neon-green mt-2">
                {chain.balance} {chain.symbol}
              </p>
              <p className="text-xs text-gray-400">${(chain.balance * chain.price).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-neon-blue" />
          Recent Transactions
        </h2>
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${tx.type === 'earn' ? 'bg-neon-green' : 'bg-neon-pink'}`} />
                <div>
                  <p className="text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <span className={`font-mono ${tx.type === 'earn' ? 'text-neon-green' : 'text-neon-pink'}`}>
                {tx.type === 'earn' ? '+' : '-'}{tx.amount} {tx.symbol}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
