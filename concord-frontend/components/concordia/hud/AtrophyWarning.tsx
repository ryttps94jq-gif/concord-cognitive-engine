'use client';

import React from 'react';

interface AtrophyRisk {
  daysUnused: number | null;
  projectedLoss: number;
  immune: boolean;
}

interface AtrophyWarningProps {
  risk: AtrophyRisk | null;
  className?: string;
}

export function AtrophyWarning({ risk, className = '' }: AtrophyWarningProps) {
  if (!risk || risk.immune || !risk.daysUnused || risk.daysUnused < 7) return null;

  const isRed = risk.daysUnused >= 14;
  const color = isRed ? 'bg-red-500' : 'bg-amber-500';
  const pulse = isRed ? 'animate-pulse' : '';
  const label = isRed
    ? `Decaying (${risk.daysUnused}d unused)`
    : `Idle (${risk.daysUnused}d)`;

  return (
    <span
      className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${color} ${pulse} ${className}`}
      title={label}
    />
  );
}
