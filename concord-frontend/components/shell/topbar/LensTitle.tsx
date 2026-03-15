'use client';

import { useUIStore } from '@/store/ui';
import { getLensById } from '@/lib/lens-registry';

export function LensTitle() {
  const activeLens = useUIStore((s) => s.activeLens);

  const lensEntry = activeLens ? getLensById(activeLens) : null;
  const displayName =
    lensEntry?.name ||
    (activeLens ? activeLens.charAt(0).toUpperCase() + activeLens.slice(1) : 'Dashboard');

  return (
    <div className="flex items-center gap-2">
      {lensEntry &&
        (() => {
          const LensIcon = lensEntry.icon;
          return <LensIcon className="w-4 h-4 text-gray-400" />;
        })()}
      <h1 className="text-base lg:text-lg font-semibold truncate max-w-[120px] sm:max-w-none">
        {displayName}
      </h1>
    </div>
  );
}
