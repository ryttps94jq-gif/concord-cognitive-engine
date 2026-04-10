'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  Glasses, Camera, Scan, Settings2, Layers, Eye, Maximize, Plus,
  Search, Trash2, X, BarChart3, Zap, ChevronDown, Box,
  MapPin, Globe, Cpu, Image, Video, Monitor,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

type ModeTab = 'scenes' | 'layers' | 'anchors' | 'models' | 'configs' | 'captures';
type ArtifactType = 'Scene' | 'Layer' | 'Anchor' | 'Model3D' | 'Config' | 'Capture';
type Status = 'active' | 'inactive' | 'rendering' | 'published' | 'draft' | 'archived';

interface ARArtifact {
  name: string; type: ArtifactType; status: Status; description: string; notes: string;
  layerType?: string; opacity?: number; visible?: boolean; zIndex?: number;
  trackingMode?: string; renderQuality?: string; dtuDensity?: number;
  position?: string; rotation?: string; scale?: number;
  format?: string; fileSize?: string; polyCount?: number;
  resolution?: string; fps?: number; codec?: string;
  anchorType?: string; surfaceType?: string; confidence?: number;
}

const MODE_TABS: { id: ModeTab; label: string; icon: typeof Glasses; artifactType: ArtifactType }[] = [
  { id: 'scenes', label: 'Scenes', icon: Globe, artifactType: 'Scene' },
  { id: 'layers', label: 'Layers', icon: Layers, artifactType: 'Layer' },
  { id: 'anchors', label: 'Anchors', icon: MapPin, artifactType: 'Anchor' },
  { id: 'models', label: '3D Models', icon: Box, artifactType: 'Model3D' },
  { id: 'configs', label: 'Configs', icon: Settings2, artifactType: 'Config' },
  { id: 'captures', label: 'Captures', icon: Camera, artifactType: 'Capture' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'green-400' }, inactive: { label: 'Inactive', color: 'gray-400' },
  rendering: { label: 'Rendering', color: 'blue-400' }, published: { label: 'Published', color: 'emerald-400' },
  draft: { label: 'Draft', color: 'yellow-400' }, archived: { label: 'Archived', color: 'gray-400' },
};

const LAYER_TYPES = ['DTU Overlay', 'Resonance Field', 'Lattice Grid', 'Temporal Markers', 'Spatial Audio', 'Data Visualization', 'Navigation', 'Custom'];
const TRACKING_MODES = ['World', 'Face', 'Image', 'Object', 'Body', 'Geo'];
const RENDER_QUALITIES = ['Low', 'Medium', 'High', 'Ultra'];
const ANCHOR_TYPES = ['Plane', 'Point', 'Image', 'Face', 'Object', 'Geo'];
const MODEL_FORMATS = ['GLTF', 'GLB', 'USDZ', 'OBJ', 'FBX', 'STL'];

export default function ARLensPage() {
  useLensNav('ar');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('ar');

  const [activeTab, setActiveTab] = useState<ModeTab>('scenes');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<ARArtifact> | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showFeatures, setShowFeatures] = useState(true);
  const [arEnabled, setArEnabled] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<Status>('active');
  const [formNotes, setFormNotes] = useState('');
  const [formLayerType, setFormLayerType] = useState(LAYER_TYPES[0]);
  const [formOpacity, setFormOpacity] = useState('75');
  const [formTrackingMode, setFormTrackingMode] = useState(TRACKING_MODES[0]);
  const [formRenderQuality, setFormRenderQuality] = useState(RENDER_QUALITIES[1]);
  const [formDtuDensity, setFormDtuDensity] = useState('50');
  const [formPosition, setFormPosition] = useState('');
  const [formRotation, setFormRotation] = useState('');
  const [formScale, setFormScale] = useState('1');
  const [formFormat, setFormFormat] = useState(MODEL_FORMATS[0]);
  const [formPolyCount, setFormPolyCount] = useState('');
  const [formResolution, setFormResolution] = useState('1920x1080');
  const [formFps, setFormFps] = useState('60');
  const [formAnchorType, setFormAnchorType] = useState(ANCHOR_TYPES[0]);
  const [formConfidence, setFormConfidence] = useState('');
  const [formZIndex, setFormZIndex] = useState('0');

  const activeArtifactType = MODE_TABS.find(t => t.id === activeTab)?.artifactType || 'Scene';
  const { items, isLoading, isError, error, refetch, create, update, remove } = useLensData<ARArtifact>('ar', activeArtifactType, { seed: [] });
  const runAction = useRunArtifact('ar');

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) { const q = searchQuery.toLowerCase(); result = result.filter(i => i.title.toLowerCase().includes(q) || (i.data as unknown as ARArtifact).description?.toLowerCase().includes(q)); }
    if (filterStatus !== 'all') result = result.filter(i => (i.data as unknown as ARArtifact).status === filterStatus);
    return result;
  }, [items, searchQuery, filterStatus]);

  const handleAction = useCallback(async (action: string, artifactId?: string) => {
    const targetId = artifactId || filtered[0]?.id;
    if (!targetId) return;
    try { await runAction.mutateAsync({ id: targetId, action }); } catch (err) { console.error('Action failed:', err); }
  }, [filtered, runAction]);

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormStatus('active'); setFormNotes('');
    setFormLayerType(LAYER_TYPES[0]); setFormOpacity('75');
    setFormTrackingMode(TRACKING_MODES[0]); setFormRenderQuality(RENDER_QUALITIES[1]);
    setFormDtuDensity('50'); setFormPosition(''); setFormRotation('');
    setFormScale('1'); setFormFormat(MODEL_FORMATS[0]); setFormPolyCount('');
    setFormResolution('1920x1080'); setFormFps('60');
    setFormAnchorType(ANCHOR_TYPES[0]); setFormConfidence(''); setFormZIndex('0');
  };

  const openCreate = () => { setEditingItem(null); resetForm(); setEditorOpen(true); };
  const openEdit = (item: LensItem<ARArtifact>) => {
    const d = item.data as unknown as ARArtifact;
    setEditingItem(item); setFormName(d.name || ''); setFormDescription(d.description || '');
    setFormStatus(d.status || 'active'); setFormNotes(d.notes || '');
    setFormLayerType(d.layerType || LAYER_TYPES[0]); setFormOpacity(d.opacity?.toString() || '75');
    setFormTrackingMode(d.trackingMode || TRACKING_MODES[0]);
    setFormRenderQuality(d.renderQuality || RENDER_QUALITIES[1]);
    setFormDtuDensity(d.dtuDensity?.toString() || '50');
    setFormPosition(d.position || ''); setFormRotation(d.rotation || '');
    setFormScale(d.scale?.toString() || '1'); setFormFormat(d.format || MODEL_FORMATS[0]);
    setFormPolyCount(d.polyCount?.toString() || '');
    setFormResolution(d.resolution || '1920x1080'); setFormFps(d.fps?.toString() || '60');
    setFormAnchorType(d.anchorType || ANCHOR_TYPES[0]);
    setFormConfidence(d.confidence?.toString() || ''); setFormZIndex(d.zIndex?.toString() || '0');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    const data: Record<string, unknown> = {
      name: formName, type: activeArtifactType, status: formStatus,
      description: formDescription, notes: formNotes,
      layerType: formLayerType, opacity: formOpacity ? parseInt(formOpacity) : undefined,
      trackingMode: formTrackingMode, renderQuality: formRenderQuality,
      dtuDensity: formDtuDensity ? parseInt(formDtuDensity) : undefined,
      position: formPosition, rotation: formRotation,
      scale: formScale ? parseFloat(formScale) : undefined,
      format: formFormat, polyCount: formPolyCount ? parseInt(formPolyCount) : undefined,
      resolution: formResolution, fps: formFps ? parseInt(formFps) : undefined,
      anchorType: formAnchorType,
      confidence: formConfidence ? parseFloat(formConfidence) : undefined,
      zIndex: formZIndex ? parseInt(formZIndex) : undefined,
    };
    if (editingItem) await update(editingItem.id, { title: formName, data, meta: { tags: [], status: formStatus, visibility: 'private' } });
    else await create({ title: formName, data, meta: { tags: [], status: formStatus, visibility: 'private' } });
    setEditorOpen(false);
  };

  if (isError) return <ErrorState error={error?.message} onRetry={refetch} />;

  const renderDashboard = () => {
    const all = items.map(i => i.data as unknown as ARArtifact);
    const activeLayers = all.filter(a => a.status === 'active').length;
    const totalAnchors = all.filter(a => a.anchorType).length;
    const modelCount = all.filter(a => a.format).length;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={ds.panel}><Layers className="w-5 h-5 text-neon-purple mb-2" /><p className={ds.textMuted}>Active Layers</p><p className="text-xl font-bold text-white">{activeLayers}</p></div>
          <div className={ds.panel}><Eye className="w-5 h-5 text-neon-cyan mb-2" /><p className={ds.textMuted}>AR Status</p><p className="text-xl font-bold text-white">{arEnabled ? 'LIVE' : 'OFF'}</p></div>
          <div className={ds.panel}><MapPin className="w-5 h-5 text-neon-green mb-2" /><p className={ds.textMuted}>Anchors</p><p className="text-xl font-bold text-white">{totalAnchors}</p></div>
          <div className={ds.panel}><Box className="w-5 h-5 text-neon-blue mb-2" /><p className={ds.textMuted}>3D Models</p><p className="text-xl font-bold text-white">{modelCount}</p></div>
        </div>
        {/* AR Viewport Preview */}
        <div className={ds.panel}>
          <div className="h-48 relative overflow-hidden rounded-lg bg-lattice-deep flex items-center justify-center">
            {arEnabled ? (
              <div className="text-center"><Scan className="w-16 h-16 mx-auto text-neon-cyan animate-pulse mb-2" /><p className="text-sm text-neon-cyan">AR Mode Active</p></div>
            ) : (
              <div className="text-center text-gray-500"><Glasses className="w-12 h-12 mx-auto mb-2 opacity-50" /><p className="text-sm">Enable AR to begin</p></div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderEditor = () => {
    if (!editorOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditorOpen(false)}>
        <div className={cn(ds.panel, 'w-full max-w-lg max-h-[85vh] overflow-y-auto')} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h3 className={ds.heading3}>{editingItem ? 'Edit' : 'New'} {activeArtifactType}</h3><button onClick={() => setEditorOpen(false)} className={ds.btnGhost}><X className="w-4 h-4" /></button></div>
          <div className="space-y-3">
            <div><label className={ds.label}>Name</label><input className={ds.input} value={formName} onChange={e => setFormName(e.target.value)} /></div>
            <div><label className={ds.label}>Description</label><textarea className={ds.textarea} rows={2} value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
            <div><label className={ds.label}>Status</label><select className={ds.select} value={formStatus} onChange={e => setFormStatus(e.target.value as Status)}>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>

            {(activeArtifactType === 'Scene' || activeArtifactType === 'Config') && (<>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ds.label}>Tracking Mode</label><select className={ds.select} value={formTrackingMode} onChange={e => setFormTrackingMode(e.target.value)}>{TRACKING_MODES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className={ds.label}>Render Quality</label><select className={ds.select} value={formRenderQuality} onChange={e => setFormRenderQuality(e.target.value)}>{RENDER_QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ds.label}>DTU Density</label><input type="number" className={ds.input} value={formDtuDensity} onChange={e => setFormDtuDensity(e.target.value)} min="1" max="100" /></div>
                <div><label className={ds.label}>Target FPS</label><input type="number" className={ds.input} value={formFps} onChange={e => setFormFps(e.target.value)} /></div>
              </div>
              <div><label className={ds.label}>Resolution</label><input className={ds.input} value={formResolution} onChange={e => setFormResolution(e.target.value)} /></div>
            </>)}

            {activeArtifactType === 'Layer' && (<>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ds.label}>Layer Type</label><select className={ds.select} value={formLayerType} onChange={e => setFormLayerType(e.target.value)}>{LAYER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className={ds.label}>Z-Index</label><input type="number" className={ds.input} value={formZIndex} onChange={e => setFormZIndex(e.target.value)} /></div>
              </div>
              <div><label className={ds.label}>Opacity (%)</label><input type="number" className={ds.input} value={formOpacity} onChange={e => setFormOpacity(e.target.value)} min="0" max="100" /></div>
            </>)}

            {activeArtifactType === 'Anchor' && (<>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ds.label}>Anchor Type</label><select className={ds.select} value={formAnchorType} onChange={e => setFormAnchorType(e.target.value)}>{ANCHOR_TYPES.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                <div><label className={ds.label}>Confidence (0-1)</label><input type="number" step="0.01" className={ds.input} value={formConfidence} onChange={e => setFormConfidence(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ds.label}>Position (x,y,z)</label><input className={ds.input} value={formPosition} onChange={e => setFormPosition(e.target.value)} placeholder="0, 0, 0" /></div>
                <div><label className={ds.label}>Rotation</label><input className={ds.input} value={formRotation} onChange={e => setFormRotation(e.target.value)} placeholder="0, 0, 0" /></div>
              </div>
            </>)}

            {activeArtifactType === 'Model3D' && (<>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ds.label}>Format</label><select className={ds.select} value={formFormat} onChange={e => setFormFormat(e.target.value)}>{MODEL_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                <div><label className={ds.label}>Poly Count</label><input type="number" className={ds.input} value={formPolyCount} onChange={e => setFormPolyCount(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ds.label}>Scale</label><input type="number" step="0.1" className={ds.input} value={formScale} onChange={e => setFormScale(e.target.value)} /></div>
                <div><label className={ds.label}>Position</label><input className={ds.input} value={formPosition} onChange={e => setFormPosition(e.target.value)} placeholder="0, 0, 0" /></div>
              </div>
            </>)}

            {activeArtifactType === 'Capture' && (<>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ds.label}>Resolution</label><input className={ds.input} value={formResolution} onChange={e => setFormResolution(e.target.value)} /></div>
                <div><label className={ds.label}>Format</label><select className={ds.select} value={formFormat} onChange={e => setFormFormat(e.target.value)}><option value="PNG">PNG</option><option value="JPEG">JPEG</option><option value="MP4">MP4</option><option value="WebM">WebM</option></select></div>
              </div>
            </>)}

            <div><label className={ds.label}>Notes</label><textarea className={ds.textarea} rows={2} value={formNotes} onChange={e => setFormNotes(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4"><button onClick={() => setEditorOpen(false)} className={ds.btnSecondary}>Cancel</button><button onClick={handleSave} className={ds.btnPrimary} disabled={!formName.trim()}>Save</button></div>
        </div>
      </div>
    );
  };

  const renderLibrary = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input className={cn(ds.input, 'pl-10')} placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        <select className={cn(ds.select, 'w-auto')} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">All Status</option>{Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <button onClick={openCreate} className={ds.btnPrimary}><Plus className="w-4 h-4" /> New</button>
      </div>
      {isLoading ? <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-neon-purple border-t-transparent rounded-full animate-spin" /></div>
      : filtered.length === 0 ? <div className={cn(ds.panel, 'text-center py-12')}><Glasses className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className={ds.textMuted}>No {activeArtifactType} items yet</p><button onClick={openCreate} className={cn(ds.btnPrimary, 'mt-3')}><Plus className="w-4 h-4" /> Create First</button></div>
      : filtered.map((item, index) => {
        const d = item.data as unknown as ARArtifact;
        const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.active;
        return (
          <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={ds.panelHover} onClick={() => openEdit(item)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><Glasses className="w-5 h-5 text-neon-purple" /><div>
                <p className="text-white font-medium">{d.name || item.title}</p>
                <p className={ds.textMuted}>
                  {d.layerType && <span>{d.layerType} </span>}
                  {d.trackingMode && <span>{d.trackingMode} tracking </span>}
                  {d.anchorType && <span>{d.anchorType} anchor </span>}
                  {d.format && <span>{d.format} </span>}
                  {d.polyCount && <span>{d.polyCount.toLocaleString()} polys </span>}
                  {d.renderQuality && <span>&middot; {d.renderQuality} </span>}
                </p>
              </div></div>
              <div className="flex items-center gap-2">
                {d.opacity !== undefined && <span className="text-xs text-neon-cyan">{d.opacity}%</span>}
                {d.confidence !== undefined && <span className="text-xs text-neon-green">{(d.confidence * 100).toFixed(0)}%</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full bg-${sc.color}/20 text-${sc.color}`}>{sc.label}</span>
                <button onClick={e => { e.stopPropagation(); handleAction('render', item.id); }} className={ds.btnGhost}><Zap className="w-4 h-4 text-neon-purple" /></button>
                <button onClick={e => { e.stopPropagation(); remove(item.id); }} className={ds.btnGhost}><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  return (
    <div data-lens-theme="ar" className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center"><Glasses className="w-5 h-5 text-white" /></div>
          <div><div className="flex items-center gap-2"><h1 className={ds.heading1}>AR</h1><LiveIndicator isLive={isLive} lastUpdated={lastUpdated} /></div><p className={ds.textMuted}>Scenes, layers, anchors, 3D models, configs, and captures</p></div>
        </div>
        <div className="flex items-center gap-2">
          {runAction.isPending && <span className="text-xs text-neon-purple animate-pulse">AI processing...</span>}
          <DTUExportButton domain="ar" data={{}} compact />
          <button onClick={() => setArEnabled(!arEnabled)} className={cn(arEnabled ? ds.btnPrimary : ds.btnSecondary)}>
            {arEnabled ? <><Camera className="w-4 h-4" /> Stop AR</> : <><Glasses className="w-4 h-4" /> Start AR</>}
          </button>
          <button onClick={() => setShowDashboard(!showDashboard)} className={cn(showDashboard ? ds.btnPrimary : ds.btnSecondary)}><BarChart3 className="w-4 h-4" /> Dashboard</button>
        </div>
      </header>
      <RealtimeDataPanel domain="ar" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <UniversalActions domain="ar" artifactId={items[0]?.id} compact />

      {(() => { const all = items.map(i => i.data as unknown as ARArtifact); return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={ds.panel}><Layers className="w-5 h-5 text-neon-purple mb-2" /><p className={ds.textMuted}>Total Items</p><p className="text-xl font-bold text-white">{items.length}</p></div>
          <div className={ds.panel}><Eye className="w-5 h-5 text-neon-cyan mb-2" /><p className={ds.textMuted}>AR Status</p><p className="text-xl font-bold text-white">{arEnabled ? 'LIVE' : 'OFF'}</p></div>
          <div className={ds.panel}><MapPin className="w-5 h-5 text-neon-green mb-2" /><p className={ds.textMuted}>Active</p><p className="text-xl font-bold text-white">{all.filter(a => a.status === 'active').length}</p></div>
          <div className={ds.panel}><Monitor className="w-5 h-5 text-neon-blue mb-2" /><p className={ds.textMuted}>Rendering</p><p className="text-xl font-bold text-white">{all.filter(a => a.status === 'rendering').length}</p></div>
        </div>
      ); })()}

      <nav className="flex items-center gap-2 border-b border-lattice-border pb-4 flex-wrap">{MODE_TABS.map(tab => (<button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowDashboard(false); }} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap', activeTab === tab.id && !showDashboard ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white hover:bg-lattice-elevated')}><tab.icon className="w-4 h-4" />{tab.label}</button>))}</nav>
      {showDashboard ? renderDashboard() : renderLibrary()}
      {renderEditor()}
      <div className="border-t border-white/10">
        <button onClick={() => setShowFeatures(!showFeatures)} className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-white transition-colors bg-white/[0.02] hover:bg-white/[0.04] rounded-lg"><span className="flex items-center gap-2"><Layers className="w-4 h-4" />Lens Features & Capabilities</span><ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} /></button>
        {showFeatures && <div className="px-4 pb-4"><LensFeaturePanel lensId="ar" /></div>}
      </div>
    </div>
  );
}
