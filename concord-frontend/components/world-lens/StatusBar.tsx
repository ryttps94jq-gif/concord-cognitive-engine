'use client';

import React from 'react';
import { Users, Zap, Droplets, Building2, Leaf, Globe } from 'lucide-react';
import type { District } from '@/lib/world-lens/types';

interface StatusBarProps {
  district: District | null;
}

export default function StatusBar({ district }: StatusBarProps) {
  if (!district) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-black/80 border-t border-white/10 text-[11px]">
      <span className="flex items-center gap-1 text-cyan-400 font-medium">
        <Globe className="w-3.5 h-3.5" />
        {district.name}
      </span>
      <span className="text-gray-600">|</span>
      <span className="flex items-center gap-1 text-gray-400">
        <Users className="w-3 h-3" />
        Pop: {district.populationCapacity.toLocaleString()}
      </span>
      <span className="flex items-center gap-1 text-yellow-400">
        <Zap className="w-3 h-3" />
        Power: {district.powerCapacity.toLocaleString()} kW
      </span>
      <span className="flex items-center gap-1 text-blue-400">
        <Droplets className="w-3 h-3" />
        Water: {district.waterCapacity.toLocaleString()} gal/day
      </span>
      <span className="flex items-center gap-1 text-gray-400">
        <Building2 className="w-3 h-3" />
        Buildings: {district.buildings.length}
      </span>
      <span className="flex items-center gap-1 text-green-400">
        <Leaf className="w-3 h-3" />
        Env: {district.environmentalScore}/100
      </span>
    </div>
  );
}
