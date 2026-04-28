'use client';

import { useState } from 'react';
import { useEvent } from '@/lib/realtime/event-bus';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityData {
  activeSessions: number;
  dtuCount: number;
  sessionCount: number;
}

export function ActivityBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEvent<ActivityData>('platform:activity', (data) => {
    setCount(data.activeSessions || data.sessionCount || 0);
  });

  if (!count) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-full bg-neon-green/10 border border-neon-green/20',
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
      <Users className="w-3 h-3 text-neon-green" />
      <span className="text-[10px] text-neon-green font-medium">{count} active</span>
    </div>
  );
}
