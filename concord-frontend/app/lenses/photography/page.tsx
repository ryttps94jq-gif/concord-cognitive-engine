'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Plus, Search, Upload, Grid, Image as ImageIcon,
  Heart, Share2, Filter, Eye, Download, X,
  Aperture, Sun, Contrast, Sliders, BarChart3,
  Layers, MapPin, Clock, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';
import { VisionAnalyzeButton } from '@/components/common/VisionAnalyzeButton';

type PhotoTab = 'gallery' | 'upload' | 'collections' | 'editing' | 'stats';

interface PhotoItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  camera?: string;
  lens?: string;
  iso?: number;
  aperture?: string;
  shutter?: string;
  location?: string;
  mediaId?: string;
  likes: number;
  views: number;
  createdAt: string;
}

const PHOTO_CATEGORIES = ['Landscape', 'Portrait', 'Street', 'Architecture', 'Nature', 'Macro', 'Astrophotography', 'Abstract', 'Documentary', 'Fashion'];

export default function PhotographyPage() {
  useLensNav('photography');
  const queryClient = useQueryClient();
  const { latestData: realtimeData, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('photography');
  const { contextDTUs, isLoading: dtusLoading } = useLensDTUs({ lens: 'photography' });

  const { items: photoItems, isLoading, isError, error, refetch, create: createPhoto } = useLensData<PhotoItem>('photography', 'photo', { seed: [] });
  const photos = useMemo(() => photoItems.map(i => ({ ...(i.data as unknown as PhotoItem), id: i.id, title: i.title })), [photoItems]);

  const [tab, setTab] = useState<PhotoTab>('gallery');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Upload form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadCamera, setUploadCamera] = useState('');

  // Upload via media API
  const uploadMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const mediaResp = await apiHelpers.media.upload({
        title: data.title,
        mediaType: 'image',
        tags: data.tags,
        description: data.description,
      });
      // Also store as lens artifact
      await createPhoto({
        title: data.title as string,
        data: { ...data, mediaId: mediaResp.data?.id, createdAt: new Date().toISOString(), likes: 0, views: 0 },
      });
      return mediaResp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lens', 'photography'] });
      setShowUpload(false);
      setUploadTitle('');
      setUploadDesc('');
      setUploadTags('');
      refetch();
    },
  });

  const handleUpload = useCallback(() => {
    uploadMutation.mutate({
      title: uploadTitle || 'Untitled Photo',
      description: uploadDesc,
      tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
      camera: uploadCamera,
    });
  }, [uploadTitle, uploadDesc, uploadTags, uploadCamera, uploadMutation]);

  const filteredPhotos = useMemo(() => {
    let result = photos;
    if (categoryFilter) result = result.filter(p => p.tags?.includes(categoryFilter.toLowerCase()));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.title?.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)));
    }
    return result;
  }, [photos, categoryFilter, searchQuery]);

  const TABS: { id: PhotoTab; label: string; icon: typeof Camera }[] = [
    { id: 'gallery', label: 'Gallery', icon: Grid },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'collections', label: 'Collections', icon: Layers },
    { id: 'editing', label: 'Editing', icon: Sliders },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <div data-lens-theme="photography" className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Camera className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-bold">Photography</h1>
            <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          </div>
          <div className="flex items-center gap-2">
            <DTUExportButton domain="photography" data={{}} compact />
            <button onClick={() => setShowFeatures(!showFeatures)} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">Features</button>
            <button onClick={() => setShowUpload(true)} className="px-3 py-1.5 text-xs bg-sky-500/20 border border-sky-500/30 rounded-lg hover:bg-sky-500/30 flex items-center gap-1">
              <Upload className="w-3 h-3" /> Upload
            </button>
          </div>
        </div>

        {showFeatures && <LensFeaturePanel lensId="photography" />}
        <RealtimeDataPanel data={realtimeData} insights={realtimeInsights} />

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors', tab === t.id ? 'bg-sky-500/20 text-sky-400' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {isError && <ErrorState error={error?.message} onRetry={refetch} />}

        {/* Gallery */}
        {tab === 'gallery' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search photos..." className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setCategoryFilter(null)} className={cn('text-[10px] px-2 py-1 rounded', !categoryFilter ? 'bg-sky-500/20 text-sky-400' : 'text-gray-400 hover:text-white')}>All</button>
                {PHOTO_CATEGORIES.slice(0, 6).map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn('text-[10px] px-2 py-1 rounded', categoryFilter === cat ? 'bg-sky-500/20 text-sky-400' : 'text-gray-400 hover:text-white')}>{cat}</button>
                ))}
              </div>
            </div>
            {filteredPhotos.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No photos yet. Upload your first shot.</p>
                <button onClick={() => setShowUpload(true)} className="mt-3 px-4 py-2 text-xs bg-sky-500/20 rounded-lg hover:bg-sky-500/30">Upload Photo</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredPhotos.map(photo => (
                  <motion.div key={photo.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-sky-500/30 transition-colors group">
                    <div className="aspect-square bg-gradient-to-br from-sky-900/30 to-purple-900/30 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-gray-600" />
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs font-medium truncate">{photo.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                        {photo.camera && <span className="flex items-center gap-0.5"><Aperture className="w-2.5 h-2.5" />{photo.camera}</span>}
                        <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{photo.views || 0}</span>
                        <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{photo.likes || 0}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload tab */}
        {tab === 'upload' && (
          <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Upload className="w-5 h-5 text-sky-400" /> Upload Photo</h2>
            <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center">
              <Camera className="w-8 h-8 mx-auto mb-2 text-gray-500" />
              <p className="text-xs text-gray-500">Drag & drop or click to upload</p>
            </div>
            <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Photo title" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
            <textarea value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="Description" rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm resize-none" />
            <input value={uploadCamera} onChange={e => setUploadCamera(e.target.value)} placeholder="Camera / lens info" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
            <input value={uploadTags} onChange={e => setUploadTags(e.target.value)} placeholder="Tags (comma separated)" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
            <button onClick={handleUpload} disabled={uploadMutation.isPending} className="w-full py-2 bg-sky-500/20 border border-sky-500/30 rounded-lg text-sm hover:bg-sky-500/30 disabled:opacity-50">
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        )}

        {/* Collections */}
        {tab === 'collections' && (
          <div className="text-center py-16 text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">Photo Collections</p>
            <p className="text-xs text-gray-600">Organize your photos into themed collections and albums.</p>
            <div className="mt-4 text-xs text-gray-600">{photos.length} photos in library</div>
          </div>
        )}

        {/* Editing */}
        {tab === 'editing' && (
          <div className="text-center py-16 text-gray-500">
            <Sliders className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">Photo Editing</p>
            <p className="text-xs text-gray-600">Exposure, contrast, color grading, and LUT presets.</p>
            <VisionAnalyzeButton domain="photography" onResult={() => {}} />
          </div>
        )}

        {/* Stats */}
        {tab === 'stats' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Total Photos</div>
              <div className="text-2xl font-bold">{photos.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Photo DTUs</div>
              <div className="text-2xl font-bold">{contextDTUs.length}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Categories</div>
              <div className="text-2xl font-bold">{new Set(photos.flatMap(p => p.tags || [])).size}</div>
            </div>
          </div>
        )}

        {/* Upload modal */}
        <AnimatePresence>
          {showUpload && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowUpload(false)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-gray-900 border border-white/10 rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Quick Upload</h3>
                  <button onClick={() => setShowUpload(false)}><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Photo title" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
                  <input value={uploadTags} onChange={e => setUploadTags(e.target.value)} placeholder="Tags (comma separated)" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
                  <button onClick={handleUpload} disabled={uploadMutation.isPending} className="w-full py-2 bg-sky-500/20 rounded-lg text-sm hover:bg-sky-500/30 disabled:opacity-50">
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
