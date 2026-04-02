'use client';

import { ExternalLink, Shield, BookOpen, Rss, Search, Upload, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceInfo {
  name?: string;
  url?: string;
  license?: string;
  attribution?: string;
  via?: string;
  fetchedAt?: string;
}

interface SourceAttributionProps {
  source?: SourceInfo;
  meta?: {
    via?: string;
    source?: SourceInfo;
    sourceName?: string;
    sourceUrl?: string;
    lineage?: {
      originalSource?: SourceInfo;
    };
    createdBy?: string;
  };
  compact?: boolean;
  className?: string;
}

const VIA_ICONS: Record<string, typeof Rss> = {
  'feed-manager': Rss,
  'web-search': Search,
  'openstax-ingest': BookOpen,
  'user-ingest': Upload,
  'webhook': Globe,
};

const LICENSE_COLORS: Record<string, string> = {
  'CC BY 4.0': 'text-green-400 bg-green-900/20 border-green-800/30',
  'CC BY-NC-SA 4.0': 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
  'CC BY-NC 4.0': 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
  'CC0 / Public Domain': 'text-blue-400 bg-blue-900/20 border-blue-800/30',
  'Public Domain': 'text-blue-400 bg-blue-900/20 border-blue-800/30',
  'US Government Work': 'text-blue-400 bg-blue-900/20 border-blue-800/30',
  'All Rights Reserved': 'text-red-400 bg-red-900/20 border-red-800/30',
  'Fair Use': 'text-orange-400 bg-orange-900/20 border-orange-800/30',
};

/**
 * SourceAttribution — Displays source attribution for externally-sourced DTUs.
 * Shows source name, license badge, link to original, and via indicator.
 */
export function SourceAttribution({ source, meta, compact = false, className }: SourceAttributionProps) {
  // Resolve source from multiple possible locations
  const src: SourceInfo = source || meta?.source || meta?.lineage?.originalSource || {};
  const via = src.via || meta?.via;
  const sourceName = src.name || meta?.sourceName || '';
  const sourceUrl = src.url || meta?.sourceUrl || '';
  const license = src.license || '';

  // Nothing to show for user-created content without external source
  if (!sourceName && !via && !sourceUrl) return null;

  const ViaIcon = via ? (VIA_ICONS[via] || Globe) : Globe;
  const licenseColor = license ? (LICENSE_COLORS[license] || 'text-gray-400 bg-gray-900/20 border-gray-700/30') : '';

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[10px]', className)}>
        <ViaIcon className="w-3 h-3 text-cyan-400" />
        <span className="text-gray-400">via {sourceName || via || 'external'}</span>
        {license && (
          <span className={cn('px-1 py-0 rounded border text-[9px]', licenseColor)}>
            {license}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={cn(
      'flex flex-col gap-1 p-2 rounded-md bg-gray-800/30 border border-gray-700/40',
      className
    )}>
      <div className="flex items-center gap-2">
        <ViaIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span className="text-xs text-gray-300">
          Source: <span className="text-white font-medium">{sourceName || 'External'}</span>
        </span>
        {license && (
          <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-medium', licenseColor)}>
            {license}
          </span>
        )}
      </div>

      {src.attribution && (
        <p className="text-[10px] text-gray-400 ml-6">{src.attribution}</p>
      )}

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-cyan-400 hover:text-cyan-300 ml-6 inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          View original
        </a>
      )}
    </div>
  );
}
