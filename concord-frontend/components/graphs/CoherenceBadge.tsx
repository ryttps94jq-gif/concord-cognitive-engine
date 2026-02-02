'use client';

import { Activity } from 'lucide-react';

interface CoherenceBadgeProps {
  score?: number;
  label?: string;
}

export function CoherenceBadge({ score = 0, label }: CoherenceBadgeProps) {
  // Determine color based on score thresholds
  const getColor = () => {
    if (score >= 100) return 'text-neon-green bg-neon-green/20 border-neon-green/30';
    if (score >= 50) return 'text-neon-cyan bg-neon-cyan/20 border-neon-cyan/30';
    if (score >= 20) return 'text-neon-blue bg-neon-blue/20 border-neon-blue/30';
    return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };

  const getLevel = () => {
    if (score >= 100) return 'Peak';
    if (score >= 50) return 'High';
    if (score >= 20) return 'Active';
    if (score > 0) return 'Low';
    return 'Idle';
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getColor()}`}
    >
      <Activity className="w-4 h-4" />
      <span className="text-sm font-medium">
        {label || getLevel()}
      </span>
      <span className="text-xs opacity-75">
        {score}
      </span>
    </div>
  );
}

export default CoherenceBadge;
