'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { Leaf, Sun, Droplet, Wind, TreeDeciduous, TrendingUp } from 'lucide-react';

export default function EcoLensPage() {
  useLensNav('eco');

  const ecosystemMetrics = [
    { id: 'energy', name: 'Energy Flow', value: 0.85, unit: 'TJ/day', icon: Sun, color: 'text-yellow-500' },
    { id: 'water', name: 'Water Cycle', value: 0.92, unit: 'ML/day', icon: Droplet, color: 'text-neon-blue' },
    { id: 'carbon', name: 'Carbon Balance', value: 0.78, unit: 'kt CO2', icon: Wind, color: 'text-gray-400' },
    { id: 'biodiversity', name: 'Biodiversity', value: 0.88, unit: 'index', icon: TreeDeciduous, color: 'text-neon-green' },
  ];

  const organisms = [
    { type: 'Producers', count: 1250, growth: 0.05 },
    { type: 'Consumers', count: 340, growth: -0.02 },
    { type: 'Decomposers', count: 890, growth: 0.08 },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🌿</span>
        <div>
          <h1 className="text-xl font-bold">Eco Lens</h1>
          <p className="text-sm text-gray-400">
            Ecosystem simulations with Growth OS analogs
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ecosystemMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.id} className="lens-card">
              <Icon className={`w-5 h-5 ${metric.color} mb-2`} />
              <p className="text-2xl font-bold">{(metric.value * 100).toFixed(0)}%</p>
              <p className="text-sm text-gray-400">{metric.name}</p>
            </div>
          );
        })}
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-neon-green" />
          Ecosystem Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {organisms.map((org) => (
            <div key={org.type} className="lens-card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">{org.type}</p>
                <span className={`text-xs ${org.growth >= 0 ? 'text-neon-green' : 'text-neon-pink'}`}>
                  {org.growth >= 0 ? '+' : ''}{(org.growth * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-neon-cyan">{org.count.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Population</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-neon-blue" />
          Growth OS Mapping
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Maps ecosystem dynamics to organism maturation kernel
        </p>
        <div className="h-32 flex items-end gap-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-neon-green to-neon-cyan rounded-t"
              style={{ height: `${30 + Math.sin(i * 0.5) * 50 + Math.random() * 20}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
