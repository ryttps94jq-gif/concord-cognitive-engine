'use client';

/**
 * DTUDetailView — Full detail view for a single DTU, fetched from /api/dtus/:id.
 *
 * Shows: title, full content, type/tier, created date, creator, tags,
 *        lineage (parent DTUs), citation count, integrity badge.
 *
 * Wired to:
 *   - GET /api/dtus/:id       (via apiHelpers.dtus.get)
 *   - GET /api/dtus/:id/lineage (via apiHelpers.dtus.lineage)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import type { DTU } from '@/lib/api/generated-types';
import { DTUIntegrityBadge } from './DTUIntegrityBadge';
import { ProvenanceBadge } from './ProvenanceBadge';
import {
  X, Clock, GitBranch, Tag, FileText, Zap, Crown, Ghost,
  Copy, ExternalLink, ChevronRight, Download, Upload,
  Music, Image as ImageIcon, Video, Code, FileType,
} from 'lucide-react';
import { ArtifactRenderer } from '@/components/artifact/ArtifactRenderer';
import { DTUImportZone } from '@/components/lens/DTUImportZone';
import { TierBadge, TierBadgeDetail, TierPromotionTimeline } from './TierBadge';

interface DTUDetailViewProps {
  dtuId: string;
  onClose: () => void;
  onNavigate?: (id: string) => void;
}

const tierConfig = {
  regular: { icon: Zap, color: 'text-neon-blue', label: 'Regular DTU', bg: 'bg-neon-blue/10' },
  mega: { icon: Crown, color: 'text-neon-purple', label: 'Mega DTU', bg: 'bg-neon-purple/10' },
  hyper: { icon: Zap, color: 'text-neon-pink', label: 'Hyper DTU', bg: 'bg-neon-pink/10' },
  shadow: { icon: Ghost, color: 'text-gray-400', label: 'Shadow DTU', bg: 'bg-gray-500/10' },
};

export function DTUDetailView({ dtuId, onClose, onNavigate }: DTUDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'lineage' | 'metadata'>('content');

  // Fetch DTU details
  const { data: dtuData, isLoading, isError } = useQuery({
    queryKey: ['dtu-detail', dtuId],
    queryFn: async () => {
      const res = await apiHelpers.dtus.get(dtuId);
      return (res.data?.dtu || res.data) as DTU;
    },
    enabled: Boolean(dtuId),
    staleTime: 30_000,
  });

  // Fetch lineage
  const { data: lineageData } = useQuery({
    queryKey: ['dtu-lineage', dtuId],
    queryFn: async () => {
      const res = await apiHelpers.dtus.lineage(dtuId);
      return res.data as {
        ok: boolean;
        parents?: Array<{ id: string; title?: string; summary?: string; tier?: string }>;
        children?: Array<{ id: string; title?: string; summary?: string; tier?: string }>;
        ancestors?: Array<{ id: string; title?: string; summary?: string; tier?: string }>;
        descendants?: Array<{ id: string; title?: string; summary?: string; tier?: string }>;
      };
    },
    enabled: Boolean(dtuId) && activeTab === 'lineage',
    staleTime: 60_000,
  });

  const dtu = dtuData;
  const config = tierConfig[dtu?.tier || 'regular'];
  const TierIcon = config.icon;

  const parentDtus = lineageData?.parents || lineageData?.ancestors || [];
  const childDtus = lineageData?.children || lineageData?.descendants || [];

  const handleCopyId = () => {
    navigator.clipboard.writeText(dtuId);
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadDtu = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/dtus/${dtuId}/export.dtu`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const tier = dtu?.tier || 'regular';
      const ext = tier === 'hyper' ? '.hyper.dtu' : tier === 'mega' ? '.mega.dtu' : '.dtu';
      const name = (dtu?.title || dtuId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('DTU download failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  // Determine primaryType for artifact rendering
  const primaryType = dtu?.primaryType || dtu?.meta?.primaryType as string | undefined;
  const artifactRef = dtu?.artifactRef || dtu?.meta?.artifactId as string | undefined;

  const primaryTypeIcon: Record<string, typeof Music> = {
    play_audio: Music,
    display_image: ImageIcon,
    play_video: Video,
    render_code: Code,
    render_document: FileType,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-lattice-border">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded bg-lattice-deep animate-pulse" />
              <div className="h-5 w-32 bg-lattice-deep rounded animate-pulse" />
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-1.5 rounded ${config.bg}`}>
                <TierIcon className={`w-5 h-5 ${config.color}`} />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold truncate flex items-center gap-2">
                  {dtu?.title || dtu?.summary || config.label}
                  {dtu && <ProvenanceBadge source={dtu.source} model={dtu.meta?.model as string} authority={dtu.meta?.authority as string} />}
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-mono truncate">{dtuId.slice(0, 20)}...</span>
                  <button onClick={handleCopyId} className="hover:text-white" title="Copy ID">
                    <Copy className="w-3 h-3" />
                  </button>
                  <TierBadge tier={dtu?.tier || 'regular'} showRegular size="sm" />
                  {dtu?.domain && (
                    <span className="text-gray-600">{dtu.domain}</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownloadDtu}
              disabled={downloading || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors disabled:opacity-40"
              title="Download as .dtu file"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Exporting...' : `.${dtu?.tier === 'mega' ? 'mega.' : dtu?.tier === 'hyper' ? 'hyper.' : ''}dtu`}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-lattice-elevated transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-lattice-border">
          {(['content', 'lineage', 'metadata'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-neon-cyan border-b-2 border-neon-cyan'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 w-24 bg-lattice-deep rounded animate-pulse" />
              <div className="h-20 bg-lattice-deep rounded animate-pulse" />
              <div className="h-4 w-48 bg-lattice-deep rounded animate-pulse" />
            </div>
          ) : isError || !dtu ? (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">Failed to load DTU details</p>
              <p className="text-xs text-gray-500 mt-1">The DTU may have been deleted or you may not have access.</p>
            </div>
          ) : (
            <>
              {activeTab === 'content' && (
                <div className="space-y-4">
                  {/* Title */}
                  {dtu.title && dtu.title !== dtu.summary && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">Title</h3>
                      <p className="text-white text-lg font-medium">{dtu.title}</p>
                    </div>
                  )}

                  {/* Summary */}
                  {dtu.summary && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">Summary</h3>
                      <p className="text-gray-200">{dtu.summary}</p>
                    </div>
                  )}

                  {/* Full content */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Full Content</h3>
                    <div className="bg-lattice-deep p-4 rounded-lg">
                      <p className="text-gray-200 whitespace-pre-wrap text-sm">
                        {dtu.content || '(No content)'}
                      </p>
                    </div>
                  </div>

                  {/* Artifact preview — based on primaryType */}
                  {primaryType && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                        {primaryTypeIcon[primaryType] ? (() => {
                          const Icon = primaryTypeIcon[primaryType];
                          return <Icon className="w-4 h-4" />;
                        })() : <FileType className="w-4 h-4" />}
                        Artifact Preview
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/10 text-neon-purple uppercase">
                          {primaryType.replace(/_/g, ' ')}
                        </span>
                      </h3>
                      {artifactRef ? (
                        <ArtifactRenderer
                          dtuId={artifactRef}
                          artifact={{
                            type: primaryType === 'play_audio' ? 'audio/mpeg'
                              : primaryType === 'display_image' ? 'image/png'
                              : primaryType === 'play_video' ? 'video/mp4'
                              : primaryType === 'render_code' ? 'text/plain'
                              : primaryType === 'render_document' ? 'text/markdown'
                              : 'application/octet-stream',
                            filename: dtu.title || dtu.id,
                            sizeBytes: (dtu.meta?.artifactSize as number) || 0,
                            multipart: false,
                          }}
                          mode="inline"
                        />
                      ) : (
                        <div className="bg-lattice-deep p-4 rounded-lg text-center">
                          <p className="text-gray-500 text-sm">
                            This DTU has type "{primaryType.replace(/_/g, ' ')}" but no artifact is attached.
                          </p>
                        </div>
                      )}
                      {artifactRef && (
                        <a
                          href={`/api/media/${artifactRef}/download`}
                          download
                          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download artifact
                        </a>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {dtu.tags && dtu.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {dtu.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-lattice-elevated rounded-full text-sm text-gray-300"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metrics row */}
                  <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(dtu.timestamp).toLocaleString()}
                    </span>
                    {dtu.ownerId && (
                      <span className="text-gray-500">Creator: {dtu.ownerId}</span>
                    )}
                    {dtu.source && (
                      <span className="text-gray-500">Source: {dtu.source}</span>
                    )}
                    {dtu.resonance !== undefined && (
                      <span>Resonance: {(dtu.resonance * 100).toFixed(1)}%</span>
                    )}
                    {dtu.coherence !== undefined && (
                      <span>Coherence: {(dtu.coherence * 100).toFixed(1)}%</span>
                    )}
                  </div>

                  {/* Citation count (children = citations) */}
                  {(dtu.children?.length || 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <GitBranch className="w-4 h-4" />
                      <span>{dtu.children.length} citation{dtu.children.length !== 1 ? 's' : ''} (child DTUs)</span>
                    </div>
                  )}

                  {/* Integrity badge */}
                  <DTUIntegrityBadge
                    dtuId={dtu.id}
                    status={dtu.meta?.integrityStatus as 'verified' | 'unverified' | 'tampered' || 'unverified'}
                    contentHash={dtu.meta?.contentHash as string}
                  />
                </div>
              )}

              {activeTab === 'lineage' && (
                <div className="space-y-4">
                  {/* Parent DTUs */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">
                      Parent DTUs ({dtu.parents?.length || parentDtus.length || 0})
                    </h3>
                    {(parentDtus.length > 0 || (dtu.parents && dtu.parents.length > 0)) ? (
                      <div className="space-y-2">
                        {(parentDtus.length > 0 ? parentDtus : (dtu.parents || []).map(id => ({ id, title: undefined, summary: undefined, tier: undefined }))).map((parent) => (
                          <button
                            key={typeof parent === 'string' ? parent : parent.id}
                            onClick={() => onNavigate?.(typeof parent === 'string' ? parent : parent.id)}
                            className="w-full text-left p-3 rounded-lg border border-lattice-border hover:border-neon-cyan/50 transition-colors flex items-center gap-2"
                          >
                            <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm text-gray-200 truncate block">
                                {(typeof parent !== 'string' && (parent.title || parent.summary)) || (typeof parent === 'string' ? parent : parent.id).slice(0, 24)}
                              </span>
                              {typeof parent !== 'string' && parent.tier && (
                                <span className="text-[10px] text-gray-500 uppercase">{parent.tier}</span>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No parent DTUs (this is a root thought)</p>
                    )}
                  </div>

                  {/* Child DTUs */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">
                      Children / Citations ({dtu.children?.length || childDtus.length || 0})
                    </h3>
                    {(childDtus.length > 0 || (dtu.children && dtu.children.length > 0)) ? (
                      <div className="space-y-2">
                        {(childDtus.length > 0 ? childDtus : (dtu.children || []).map(id => ({ id, title: undefined, summary: undefined, tier: undefined }))).map((child) => (
                          <button
                            key={typeof child === 'string' ? child : child.id}
                            onClick={() => onNavigate?.(typeof child === 'string' ? child : child.id)}
                            className="w-full text-left p-3 rounded-lg border border-lattice-border hover:border-neon-cyan/50 transition-colors flex items-center gap-2"
                          >
                            <GitBranch className="w-4 h-4 text-gray-400 rotate-180 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-sm text-gray-200 truncate block">
                                {(typeof child !== 'string' && (child.title || child.summary)) || (typeof child === 'string' ? child : child.id).slice(0, 24)}
                              </span>
                              {typeof child !== 'string' && child.tier && (
                                <span className="text-[10px] text-gray-500 uppercase">{child.tier}</span>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No children DTUs yet</p>
                    )}
                  </div>

                  {/* Related IDs */}
                  {dtu.relatedIds && dtu.relatedIds.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">
                        Related ({dtu.relatedIds.length})
                      </h3>
                      <div className="space-y-1">
                        {dtu.relatedIds.slice(0, 10).map((relId) => (
                          <button
                            key={relId}
                            onClick={() => onNavigate?.(relId)}
                            className="text-xs text-neon-cyan hover:underline font-mono block"
                          >
                            {relId.slice(0, 24)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'metadata' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Properties
                    </h3>
                    <div className="space-y-1 text-xs">
                      {[
                        ['ID', dtu.id],
                        ['Tier', dtu.tier],
                        ['Source', dtu.source],
                        ['Primary Type', primaryType],
                        ['Artifact', artifactRef],
                        ['Domain', dtu.domain],
                        ['Owner', dtu.ownerId],
                        ['Global', dtu.isGlobal ? 'Yes' : 'No'],
                        ['Created', dtu.timestamp],
                        ['Updated', dtu.updatedAt],
                        ['Resonance', dtu.resonance?.toFixed(3)],
                        ['Coherence', dtu.coherence?.toFixed(3)],
                        ['Stability', dtu.stability?.toFixed(3)],
                        ['Parents', dtu.parents?.length || 0],
                        ['Children', dtu.children?.length || 0],
                      ].filter(([, v]) => v !== undefined && v !== null && v !== '').map(([key, val]) => (
                        <div key={key} className="flex items-start justify-between">
                          <span className="text-gray-500">{key}:</span>
                          <span className="text-gray-300 text-right font-mono max-w-[250px] truncate">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Raw Metadata</h3>
                    <pre className="bg-lattice-deep p-4 rounded-lg text-xs font-mono overflow-auto max-h-60">
                      {JSON.stringify(dtu.meta || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
