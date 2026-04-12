'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { useSocket } from '@/hooks/useSocket';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

import DistrictViewport from '@/components/world-lens/DistrictViewport';
import CreationToolbar from '@/components/world-lens/CreationToolbar';
import InspectorPanel from '@/components/world-lens/InspectorPanel';
import StatusBar from '@/components/world-lens/StatusBar';
import GuidedCreator from '@/components/world-lens/GuidedCreator';
import ComponentCreator from '@/components/world-lens/ComponentCreator';
import RawDTUEditor from '@/components/world-lens/RawDTUEditor';
import MarketplacePalette from '@/components/world-lens/MarketplacePalette';
import ConcordiaHub from '@/components/world-lens/ConcordiaHub';
import OnboardingTutorial from '@/components/world-lens/OnboardingTutorial';

import dynamic from 'next/dynamic';
import { DEMO_DISTRICT } from '@/lib/world-lens/district-seed';

const ConcordiaScene = dynamic(() => import('@/components/world-lens/ConcordiaScene'), { ssr: false });
const AvatarSystem3D = dynamic(() => import('@/components/world-lens/AvatarSystem3D'), { ssr: false });
const CameraControls = dynamic(() => import('@/components/world-lens/CameraControls'), { ssr: false });
const HUDOverlay = dynamic(() => import('@/components/world-lens/HUDOverlay'), { ssr: false });
const ChatSystem = dynamic(() => import('@/components/world-lens/ChatSystem'), { ssr: false });
const InventoryPanel = dynamic(() => import('@/components/world-lens/InventoryPanel'), { ssr: false });
const QuestPanel = dynamic(() => import('@/components/world-lens/QuestPanel'), { ssr: false });
const PlayerPresence = dynamic(() => import('@/components/world-lens/PlayerPresence'), { ssr: false });
const MapNavigation = dynamic(() => import('@/components/world-lens/MapNavigation'), { ssr: false });
const PlayerProfile = dynamic(() => import('@/components/world-lens/PlayerProfile'), { ssr: false });
const CraftingPanel = dynamic(() => import('@/components/world-lens/CraftingPanel'), { ssr: false });
const CollaborationTools = dynamic(() => import('@/components/world-lens/CollaborationTools'), { ssr: false });
const LiveCollaboration = dynamic(() => import('@/components/world-lens/LiveCollaboration'), { ssr: false });
const EventsGatherings = dynamic(() => import('@/components/world-lens/EventsGatherings'), { ssr: false });
const SocialProofFeed = dynamic(() => import('@/components/world-lens/SocialProofFeed'), { ssr: false });
const NotificationFeed = dynamic(() => import('@/components/world-lens/NotificationFeed'), { ssr: false });
const SmartNotifications = dynamic(() => import('@/components/world-lens/SmartNotifications'), { ssr: false });
const ModerationPanel = dynamic(() => import('@/components/world-lens/ModerationPanel'), { ssr: false });
const OwnershipProfile = dynamic(() => import('@/components/world-lens/OwnershipProfile'), { ssr: false });
const FederationPanel = dynamic(() => import('@/components/world-lens/FederationPanel'), { ssr: false });
const VoiceInterface = dynamic(() => import('@/components/world-lens/VoiceInterface'), { ssr: false });
const VoiceAssistant = dynamic(() => import('@/components/world-lens/VoiceAssistant'), { ssr: false });
const BuildingRenderer3D = dynamic(() => import('@/components/world-lens/BuildingRenderer3D'), { ssr: false });
const TerrainRenderer = dynamic(() => import('@/components/world-lens/TerrainRenderer'), { ssr: false });
const SkyWeatherRenderer = dynamic(() => import('@/components/world-lens/SkyWeatherRenderer'), { ssr: false });
const WaterRenderer = dynamic(() => import('@/components/world-lens/WaterRenderer'), { ssr: false });
const ParticleEffectsComponent = dynamic(() => import('@/components/world-lens/ParticleEffects'), { ssr: false });
const SoundscapeEngine = dynamic(() => import('@/components/world-lens/SoundscapeEngine'), { ssr: false });
const AnimationManager = dynamic(() => import('@/components/world-lens/AnimationManager'), { ssr: false });
const GameJuice = dynamic(() => import('@/components/world-lens/GameJuice'), { ssr: false });
const LoadingTransitions = dynamic(() => import('@/components/world-lens/LoadingTransitions'), { ssr: false });

// ── Builder / Tools (District mode) ───────────────────────────────
const SnapBuildCatalog = dynamic(() => import('@/components/world-lens/SnapBuildCatalog'), { ssr: false });
const ConcordDSLEditor = dynamic(() => import('@/components/world-lens/ConcordDSLEditor'), { ssr: false });
const ConcordTerminal = dynamic(() => import('@/components/world-lens/ConcordTerminal'), { ssr: false });
const DTUDiffViewer = dynamic(() => import('@/components/world-lens/DTUDiffViewer'), { ssr: false });
const StandardsLibrary = dynamic(() => import('@/components/world-lens/StandardsLibrary'), { ssr: false });
const FabricationExportPanel = dynamic(() => import('@/components/world-lens/FabricationExportPanel'), { ssr: false });
const ExportEmbed = dynamic(() => import('@/components/world-lens/ExportEmbed'), { ssr: false });
const NotebookEditor = dynamic(() => import('@/components/world-lens/NotebookEditor'), { ssr: false });
const DependencyGraphViewer = dynamic(() => import('@/components/world-lens/DependencyGraphViewer'), { ssr: false });
const DigitalTwinDashboard = dynamic(() => import('@/components/world-lens/DigitalTwinDashboard'), { ssr: false });
const SensorDashboard = dynamic(() => import('@/components/world-lens/SensorDashboard'), { ssr: false });
const ServiceMarketplace = dynamic(() => import('@/components/world-lens/ServiceMarketplace'), { ssr: false });
const CertificatePanel = dynamic(() => import('@/components/world-lens/CertificatePanel'), { ssr: false });
const NotarizationPanel = dynamic(() => import('@/components/world-lens/NotarizationPanel'), { ssr: false });
const StressTestPanel = dynamic(() => import('@/components/world-lens/StressTestPanel'), { ssr: false });
const ReplayForensics = dynamic(() => import('@/components/world-lens/ReplayForensics'), { ssr: false });
const ReplaySpectator = dynamic(() => import('@/components/world-lens/ReplaySpectator'), { ssr: false });

import { SEED_MATERIALS } from '@/lib/world-lens/material-seed';
import { cacheMaterials } from '@/lib/world-lens/validation-engine';
import type {
  District, CreationMode, PlacedBuildingDTU, InfrastructureDTU,
  TerrainCell, Citation, BuildingDTU, MaterialDTU, ValidationReport,
} from '@/lib/world-lens/types';
import type { ConcordiaDistrict } from '@/components/world-lens/ConcordiaHub';

import {
  Globe, ChevronDown, Layers, Map as MapIcon, Zap, X,
  Radio, Eye, Play, Square, Users, Clock, Coins,
  HeartHandshake, CalendarDays, Bell, Mic, MessageSquare,
  ThumbsUp, BellRing, Shield, Fingerprint, Network, AudioLines,
  Wrench, Package, Code2, Terminal, Diff, BookOpen, BoxSelect,
  FileCode, GitBranch, Activity, Gauge, ShoppingCart,
  Award, Stamp, FlaskConical, History, Clapperboard, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api/client';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';

// ── City Streaming Types ───────────────────────────────────────

interface CityStream {
  id: string;
  creatorId: string;
  cityId: string;
  title: string;
  startedAt: string;
  viewerCount: number;
  dtusCreated: number;
  salesMade: number;
  ccEarned: number;
  status: 'live' | 'ended';
}

interface StreamEvent {
  id: string;
  type: 'dtu-created' | 'sale' | 'viewer-joined' | 'viewer-left';
  message: string;
  timestamp: string;
}

// ── City Streaming Section ─────────────────────────────────────

function CityStreamingSection() {
  const { on, off, isConnected } = useSocket({ autoConnect: true });

  // Creator controls
  const [myStream, setMyStream] = useState<CityStream | null>(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCityId, setStreamCityId] = useState('concordia-central');
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Viewer state
  const [activeStreams, setActiveStreams] = useState<CityStream[]>([]);
  const [watchingStreamId, setWatchingStreamId] = useState<string | null>(null);
  const [activityFeed, setActivityFeed] = useState<StreamEvent[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const eventCounter = useRef(0);

  // Fetch active streams
  const fetchStreams = useCallback(async () => {
    setIsLoadingStreams(true);
    try {
      const { data } = await api.get('/api/city/streams');
      const streams = Array.isArray(data) ? data : (data?.streams ?? []);
      setActiveStreams(streams);
    } catch {
      // Silently handle — streams may not be available
    } finally {
      setIsLoadingStreams(false);
    }
  }, []);

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 15000);
    return () => clearInterval(interval);
  }, [fetchStreams]);

  // Socket listeners for live events
  useEffect(() => {
    const handleDtuCreated = (data: unknown) => {
      const d = data as Record<string, unknown>;
      setActivityFeed(prev => [...prev.slice(-49), {
        id: `evt-${++eventCounter.current}`,
        type: 'dtu-created' as const,
        message: `DTU created: ${d.title || d.dtuId || 'untitled'}`,
        timestamp: new Date().toISOString(),
      }]);
      // Update stream stats
      setActiveStreams(prev => prev.map(s =>
        s.id === d.streamId ? { ...s, dtusCreated: (s.dtusCreated || 0) + 1 } : s
      ));
    };

    const handleSale = (data: unknown) => {
      const d = data as Record<string, unknown>;
      setActivityFeed(prev => [...prev.slice(-49), {
        id: `evt-${++eventCounter.current}`,
        type: 'sale' as const,
        message: `Sale: ${d.amount || 0} CC`,
        timestamp: new Date().toISOString(),
      }]);
      setActiveStreams(prev => prev.map(s =>
        s.id === d.streamId ? {
          ...s,
          salesMade: (s.salesMade || 0) + 1,
          ccEarned: (s.ccEarned || 0) + Number(d.amount || 0),
        } : s
      ));
    };

    const handleStreamStarted = (data: unknown) => {
      const d = data as CityStream;
      setActiveStreams(prev => {
        if (prev.some(s => s.id === d.id)) return prev;
        return [...prev, d];
      });
    };

    const handleStreamEnded = (data: unknown) => {
      const d = data as Record<string, unknown>;
      setActiveStreams(prev => prev.filter(s => s.id !== d.streamId && s.id !== d.id));
      if (watchingStreamId === (d.streamId ?? d.id)) {
        setWatchingStreamId(null);
      }
    };

    on('city:stream-dtu-created', handleDtuCreated);
    on('city:stream-sale', handleSale);
    on('city:stream-started', handleStreamStarted);
    on('city:stream-ended', handleStreamEnded);

    return () => {
      off('city:stream-dtu-created', handleDtuCreated);
      off('city:stream-sale', handleSale);
      off('city:stream-started', handleStreamStarted);
      off('city:stream-ended', handleStreamEnded);
    };
  }, [on, off, watchingStreamId]);

  // Auto-scroll activity feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityFeed.length]);

  // Creator: start stream
  const handleStartStream = async () => {
    if (!streamTitle.trim()) return;
    setIsStarting(true);
    try {
      const { data } = await api.post('/api/city/stream/start', {
        cityId: streamCityId,
        title: streamTitle.trim(),
      });
      setMyStream(data?.stream ?? data);
      setStreamTitle('');
      fetchStreams();
    } catch (err) {
      console.error('Failed to start stream:', err);
    } finally {
      setIsStarting(false);
    }
  };

  // Creator: end stream
  const handleEndStream = async () => {
    setIsEnding(true);
    try {
      await api.post('/api/city/stream/end', {});
      setMyStream(null);
      fetchStreams();
    } catch (err) {
      console.error('Failed to end stream:', err);
    } finally {
      setIsEnding(false);
    }
  };

  // Viewer: follow/unfollow stream
  const handleToggleWatch = async (streamId: string) => {
    const isWatching = watchingStreamId === streamId;
    try {
      await api.post('/api/macros/run', {
        domain: 'city',
        name: isWatching ? 'unfollowStream' : 'followStream',
        input: { streamId },
      });
      setWatchingStreamId(isWatching ? null : streamId);
      if (!isWatching) {
        setActivityFeed([]);
      }
    } catch (err) {
      console.error('Failed to toggle stream watch:', err);
    }
  };

  const watchedStream = activeStreams.find(s => s.id === watchingStreamId);

  // Duration helper
  const formatDuration = (startedAt: string) => {
    const ms = Date.now() - new Date(startedAt).getTime();
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Connection status */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        {isConnected ? 'Live connection' : 'Connecting...'}
      </div>

      {/* ── Creator Controls ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
          <Radio className="w-4 h-4" />
          Stream Controls
        </h3>

        {myStream ? (
          <div className="space-y-3">
            {/* Active stream status */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-400">LIVE</span>
              <span className="text-xs text-gray-400 ml-auto">
                {formatDuration(myStream.startedAt)}
              </span>
            </div>
            <div className="text-sm text-white font-medium">{myStream.title}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                  <Eye className="w-3 h-3" /> Viewers
                </div>
                <div className="text-sm font-bold text-white">{myStream.viewerCount}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-xs text-gray-400">DTUs</div>
                <div className="text-sm font-bold text-cyan-300">{myStream.dtusCreated}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                  <Coins className="w-3 h-3" /> Earned
                </div>
                <div className="text-sm font-bold text-green-400">{myStream.ccEarned} CC</div>
              </div>
            </div>
            <button
              onClick={handleEndStream}
              disabled={isEnding}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {isEnding ? (
                <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Square className="w-3 h-3" />
              )}
              End Stream
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={streamTitle}
              onChange={e => setStreamTitle(e.target.value)}
              placeholder="Stream title..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
            <select
              value={streamCityId}
              onChange={e => setStreamCityId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="concordia-central">Concordia Central</option>
              <option value="neon-district">Neon District</option>
              <option value="maker-mile">Maker Mile</option>
              <option value="data-harbor">Data Harbor</option>
            </select>
            <button
              onClick={handleStartStream}
              disabled={isStarting || !streamTitle.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 disabled:opacity-50 transition-colors"
            >
              {isStarting ? (
                <div className="w-3 h-3 border border-cyan-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Go Live
            </button>
          </div>
        )}
      </motion.div>

      {/* ── Active Streams ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Active Streams
          </h3>
          <button
            onClick={fetchStreams}
            disabled={isLoadingStreams}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Radio className={`w-3.5 h-3.5 ${isLoadingStreams ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {activeStreams.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-xs">
            No active streams right now
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {activeStreams.map(stream => (
                <motion.div
                  key={stream.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white/5 rounded-lg p-3 border transition-colors ${
                    watchingStreamId === stream.id
                      ? 'border-cyan-500/50 bg-cyan-500/5'
                      : 'border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs text-gray-400 truncate">
                          {stream.creatorId}
                        </span>
                      </div>
                      <div className="text-sm text-white font-medium truncate mt-0.5">
                        {stream.title}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                        <span className="flex items-center gap-0.5">
                          <Globe className="w-2.5 h-2.5" /> {stream.cityId}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" /> {stream.viewerCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> {formatDuration(stream.startedAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleWatch(stream.id)}
                      className={`shrink-0 px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                        watchingStreamId === stream.id
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30'
                      }`}
                    >
                      {watchingStreamId === stream.id ? 'Leave' : 'Watch'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* ── Live Stream View (when watching) ──────────────── */}
      <AnimatePresence>
        {watchedStream && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white/[0.03] border border-cyan-500/20 rounded-xl p-4 space-y-3 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                {watchedStream.title}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-0.5">
                  <Eye className="w-3 h-3" /> {watchedStream.viewerCount}
                </span>
                <span>{formatDuration(watchedStream.startedAt)}</span>
              </div>
            </div>

            {/* Real-time activity feed */}
            <div className="bg-black/30 rounded-lg border border-white/5 max-h-48 overflow-y-auto p-2 space-y-1">
              {activityFeed.length === 0 ? (
                <div className="text-center py-4 text-gray-600 text-[10px]">
                  Waiting for stream activity...
                </div>
              ) : (
                activityFeed.map(evt => (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-[11px] py-0.5"
                  >
                    <span className={`w-1 h-1 rounded-full shrink-0 ${
                      evt.type === 'sale' ? 'bg-green-400' : 'bg-cyan-400'
                    }`} />
                    <span className={
                      evt.type === 'sale' ? 'text-green-400' : 'text-gray-300'
                    }>
                      {evt.message}
                    </span>
                    <span className="text-gray-600 ml-auto text-[9px]">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </motion.div>
                ))
              )}
              <div ref={feedEndRef} />
            </div>

            {/* Stream stats bar */}
            <div className="flex items-center gap-4 text-[10px]">
              <span className="text-gray-400">
                DTUs: <span className="text-cyan-300 font-medium">{watchedStream.dtusCreated}</span>
              </span>
              <span className="text-gray-400">
                Sales: <span className="text-green-400 font-medium">{watchedStream.salesMade}</span>
              </span>
              <span className="text-gray-400">
                Earned: <span className="text-green-400 font-medium">{watchedStream.ccEarned} CC</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── View Modes ──────────────────────────────────────────────────────

type ViewMode = 'concordia' | 'district' | 'streams' | 'explore';

type DistrictTool =
  | 'snapbuild' | 'dsl' | 'terminal' | 'diff' | 'standards'
  | 'fabrication' | 'embed' | 'notebook' | 'depgraph'
  | 'digitaltwin' | 'sensors' | 'marketplace'
  | 'certificates' | 'notarization' | 'stresstest'
  | 'replay' | 'spectator' | null;

const DISTRICT_TOOLS: { key: Exclude<DistrictTool, null>; label: string; icon: React.ComponentType<{ className?: string }>; group: string }[] = [
  // Build
  { key: 'snapbuild', label: 'Snap Build', icon: Package, group: 'Build' },
  { key: 'dsl', label: 'DSL Editor', icon: Code2, group: 'Build' },
  { key: 'terminal', label: 'Terminal', icon: Terminal, group: 'Build' },
  { key: 'notebook', label: 'Notebook', icon: FileCode, group: 'Build' },
  // Inspect
  { key: 'diff', label: 'DTU Diff', icon: Diff, group: 'Inspect' },
  { key: 'standards', label: 'Standards', icon: BookOpen, group: 'Inspect' },
  { key: 'depgraph', label: 'Dependencies', icon: GitBranch, group: 'Inspect' },
  { key: 'digitaltwin', label: 'Digital Twin', icon: Activity, group: 'Inspect' },
  { key: 'sensors', label: 'Sensors', icon: Gauge, group: 'Inspect' },
  // Export & Services
  { key: 'fabrication', label: 'Fabrication', icon: BoxSelect, group: 'Export' },
  { key: 'embed', label: 'Embed Export', icon: Code2, group: 'Export' },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingCart, group: 'Export' },
  // Verify
  { key: 'certificates', label: 'Certificates', icon: Award, group: 'Verify' },
  { key: 'notarization', label: 'Notarization', icon: Stamp, group: 'Verify' },
  { key: 'stresstest', label: 'Stress Test', icon: FlaskConical, group: 'Verify' },
  // Replay
  { key: 'replay', label: 'Replay', icon: History, group: 'Replay' },
  { key: 'spectator', label: 'Spectator', icon: Clapperboard, group: 'Replay' },
];

// ── Component ───────────────────────────────────────────────────────

export default function WorldLensPage() {
  useLensNav('world');

  const router = useRouter();
  const { isLive, lastUpdated } = useRealtimeLens('world');
  // World-lens socket for player movement + nearby-player broadcasts.
  // The CityStreamingSection component already uses its own useSocket
  // for stream events — this instance is dedicated to multiplayer.
  const worldSocket = useSocket({ autoConnect: true });

  // ── State ─────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('concordia');
  const [activeDistrict, setActiveDistrict] = useState<District>(DEMO_DISTRICT);
  const [creationMode, setCreationMode] = useState<CreationMode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<0 | 1 | 2 | 3>(0);

  // District tools state
  const [activeTool, setActiveTool] = useState<DistrictTool>(null);
  const [toolsExpanded, setToolsExpanded] = useState(false);

  // 3D Explore mode state
  const [cameraMode, setCameraMode] = useState<'isometric' | 'follow' | 'free' | 'interior' | 'cinematic'>('follow');
  const [showPanel, setShowPanel] = useState<'none' | 'inventory' | 'quests' | 'chat' | 'map' | 'crafting' | 'players' | 'profile' | 'collaboration' | 'livecollab' | 'events' | 'socialproof' | 'notifications' | 'smartnotify' | 'moderation' | 'ownership' | 'federation' | 'voice' | 'voiceassist'>('none');
  // Local player avatar — mutable so moves update it in place. On
  // first mount we ask the server for saved state (via player:load)
  // and land back wherever the user logged off.
  const [playerAvatar, setPlayerAvatar] = useState({
    id: 'player-1',
    name: 'You',
    appearance: {
      skinColor: '#c8956c',
      hairColor: '#3d2314',
      hairStyle: 'short' as const,
      bodyType: 'average' as const,
      clothing: {
        top: { color: '#1a5276', type: 'shirt' as const },
        bottom: { color: '#2c3e50', type: 'pants' as const },
      },
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    currentAnimation: 'idle' as const,
  });
  // Other players in the same chunk(s), updated via city:positions
  // socket broadcasts.
  const [otherPlayers, setOtherPlayers] = useState<Array<{
    id: string;
    name: string;
    appearance: typeof playerAvatar.appearance;
    position: { x: number; y: number; z: number };
    rotation: number;
    currentAnimation: 'idle' | 'walk' | 'run' | 'sit' | 'build' | 'emote' | 'wave' | 'dance' | 'cheer' | 'point' | 'nod' | 'shake' | 'clap' | 'bow' | 'laugh' | 'cry' | 'think' | 'celebrate' | 'craft' | 'paint' | 'play' | 'write' | 'read' | 'mentor' | 'construct' | 'sweep' | 'lecture';
    timestamp: number;
  }>>([]);
  const [visibleLayers, setVisibleLayers] = useState(new Set(['water', 'power', 'drainage', 'road', 'data']));
  const [showValidation, setShowValidation] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  // Selection state
  const [selectedBuilding, setSelectedBuilding] = useState<PlacedBuildingDTU | null>(null);
  const [selectedInfra, setSelectedInfra] = useState<InfrastructureDTU | null>(null);
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainCell | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);

  // Materials
  const [materials] = useState<MaterialDTU[]>(SEED_MATERIALS);

  // Cache materials for validation engine
  useEffect(() => {
    cacheMaterials(materials);
  }, [materials]);

  // ── MMO multiplayer wiring ──────────────────────────────────────────
  // On mount: ask the server for our last-saved position, subscribe
  // to city:positions broadcasts (100ms tick) that populate other
  // players in the same chunk, and to player:load:ack + player:move:ack
  // for rehydration + low-latency nearby updates.
  useEffect(() => {
    if (!worldSocket.isConnected) return;

    // Request saved state on first connect
    worldSocket.emit('player:load');

    const handleLoadAck = (msg: unknown) => {
      const data = msg as { ok: boolean; state?: { x: number; y: number; z: number; rotation?: number; currentAnimation?: string } | null };
      if (data?.ok && data.state) {
        setPlayerAvatar((prev) => ({
          ...prev,
          position: { x: data.state!.x, y: data.state!.y, z: data.state!.z },
          rotation: data.state!.rotation ?? 0,
          currentAnimation: (data.state!.currentAnimation as typeof prev.currentAnimation) ?? 'idle',
        }));
      }
    };

    // Convert city:positions broadcast chunks into a flat otherPlayers
    // array. The broadcast is per-chunk so multiple events may arrive
    // in a single tick — we dedupe by user id and prefer the most
    // recent entry per user.
    const handleCityPositions = (msg: unknown) => {
      const data = msg as {
        cityId: string;
        users: Array<{
          userId: string;
          x: number; y: number; z: number;
          direction?: number; rotation?: number;
          action?: string; avatar?: unknown;
          displayName?: string;
        }>;
      };
      if (!data?.users?.length) return;
      setOtherPlayers((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        for (const u of data.users) {
          if (u.userId === playerAvatar.id) continue;
          byId.set(u.userId, {
            id: u.userId,
            name: u.displayName || u.userId.slice(0, 12),
            // Reuse the local player's appearance config shape — the
            // server doesn't send an avatar yet so we render a default
            // silhouette until the profile lookup is wired.
            appearance: playerAvatar.appearance,
            position: { x: u.x, y: u.y, z: u.z },
            rotation: u.rotation ?? u.direction ?? 0,
            currentAnimation: (u.action as typeof playerAvatar.currentAnimation) || 'idle',
            timestamp: Date.now(),
          });
        }
        // Drop stale entries (>5s without update) so ghosts don't linger
        const cutoff = Date.now() - 5000;
        const fresh = Array.from(byId.values()).filter((p) => p.timestamp >= cutoff);
        return fresh;
      });
    };

    const handleMoveAck = (msg: unknown) => {
      const data = msg as { nearby?: Array<{ userId: string; x: number; y: number; z: number; direction?: number; action?: string; displayName?: string }>; };
      if (!data?.nearby?.length) return;
      // Short-circuit: if the ack includes nearby players we apply
      // them immediately without waiting for the next broadcast tick.
      handleCityPositions({
        cityId: activeDistrict.id,
        users: data.nearby.map((n) => ({ ...n, rotation: n.direction })),
      });
    };

    worldSocket.on('player:load:ack', handleLoadAck);
    worldSocket.on('city:positions', handleCityPositions);
    worldSocket.on('player:move:ack', handleMoveAck);

    return () => {
      worldSocket.off('player:load:ack', handleLoadAck);
      worldSocket.off('city:positions', handleCityPositions);
      worldSocket.off('player:move:ack', handleMoveAck);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSocket.isConnected, activeDistrict.id]);

  // Check first visit
  useEffect(() => {
    const visited = localStorage.getItem('world_lens_visited');
    if (!visited) {
      setShowOnboarding(true);
    }
  }, []);

  // DTU persistence
  const { items: _buildingItems, create: createBuilding } = useLensData('world', 'building', {
    seed: [],
    enabled: true,
  });

  const runWorldAction = useRunArtifact('world');
  const [worldActionResult, setWorldActionResult] = useState<{ action: string; result: Record<string, unknown> } | null>(null);
  const [worldActiveAction, setWorldActiveAction] = useState<string | null>(null);

  const handleWorldAction = useCallback(async (action: string) => {
    const id = _buildingItems[0]?.id;
    if (!id) return;
    setWorldActiveAction(action);
    try {
      const res = await runWorldAction.mutateAsync({ id, action });
      if (res.ok) setWorldActionResult({ action, result: res.result as Record<string, unknown> });
    } finally {
      setWorldActiveAction(null);
    }
  }, [_buildingItems, runWorldAction]);

  // ── Handlers ──────────────────────────────────────────────────

  const handleBuildingClick = useCallback((building: PlacedBuildingDTU) => {
    setSelectedBuilding(building);
    setSelectedInfra(null);
    setSelectedTerrain(null);
    // Generate mock citations for demo
    setCitations([
      { id: 'c1', citingDTU: building.dtuId, citedDTU: 'comp-concrete-found-v2', citedCreator: '@engineer_jane', timestamp: new Date().toISOString(), context: 'foundation' },
      { id: 'c2', citingDTU: building.dtuId, citedDTU: 'mat-usb-a', citedCreator: '@materials_lab', timestamp: new Date().toISOString(), context: 'beam material' },
      { id: 'c3', citingDTU: building.dtuId, citedDTU: 'infra-water-1', citedCreator: '@civil_sara', timestamp: new Date().toISOString(), context: 'water connection' },
    ]);
  }, []);

  const handleInfraClick = useCallback((infra: InfrastructureDTU) => {
    setSelectedInfra(infra);
    setSelectedBuilding(null);
    setSelectedTerrain(null);
    setCitations([]);
  }, []);

  const handleTerrainClick = useCallback((x: number, y: number) => {
    const cell = activeDistrict.terrain.grid[y]?.[x] || null;
    setSelectedTerrain(cell);
    setSelectedBuilding(null);
    setSelectedInfra(null);
    setCitations([]);
  }, [activeDistrict]);

  const handleCloseInspector = useCallback(() => {
    setSelectedBuilding(null);
    setSelectedInfra(null);
    setSelectedTerrain(null);
    setCitations([]);
    setValidationReport(null);
  }, []);

  const handleToggleLayer = useCallback((layer: string) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => ((prev + 1) % 4) as 0 | 1 | 2 | 3);
  }, []);

  const handlePublishBuilding = useCallback((building: BuildingDTU) => {
    createBuilding({
      title: building.name,
      data: building as unknown as Record<string, unknown>,
    });
    setCreationMode(null);
    // Add to district
    setActiveDistrict(prev => ({
      ...prev,
      buildings: [
        ...prev.buildings,
        {
          id: `placed-${building.id}`,
          dtuId: building.id,
          position: { x: 10 + Math.random() * 5, y: 10 + Math.random() * 5 },
          rotation: 0,
          validationStatus: building.validationReport?.overallPass ? 'validated' : 'experimental',
          creator: building.creator,
          placedAt: new Date().toISOString().slice(0, 10),
        },
      ],
    }));
  }, [createBuilding]);

  const handlePublishComponent = useCallback((component: {
    name: string;
    category: string;
    materialId: string;
    dimensions: { length: number; width: number; height: number };
    crossSection: string;
  }) => {
    createBuilding({
      title: component.name,
      data: component as unknown as Record<string, unknown>,
    });
    setCreationMode(null);
  }, [createBuilding]);

  const handlePublishRawDTU = useCallback((dtu: Record<string, unknown>) => {
    createBuilding({
      title: (dtu.name as string) || 'Raw DTU',
      data: dtu,
    });
    setCreationMode(null);
  }, [createBuilding]);

  const handleConcordiaDistrictSelect = useCallback((_district: ConcordiaDistrict) => {
    // In future: load actual district data from server
    setViewMode('district');
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem('world_lens_visited', '1');
    setShowOnboarding(false);
  }, []);

  return (
    <div data-lens-theme="world" className="flex flex-col h-full min-h-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold">World Lens</h1>
              <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
            </div>
            <p className="text-[10px] text-gray-500">
              Design, validate, and publish DTU-based creations in shared districts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('concordia')}
              className={`px-3 py-1.5 text-xs ${viewMode === 'concordia' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-white'}`}
            >
              <Globe className="w-3.5 h-3.5 inline mr-1" />
              Concordia
            </button>
            <button
              onClick={() => setViewMode('district')}
              className={`px-3 py-1.5 text-xs ${viewMode === 'district' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-white'}`}
            >
              <MapIcon className="w-3.5 h-3.5 inline mr-1" />
              District
            </button>
            <button
              onClick={() => setViewMode('explore')}
              className={`px-3 py-1.5 text-xs ${viewMode === 'explore' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'}`}
            >
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Explore 3D
            </button>
            <button
              onClick={() => setViewMode('streams')}
              className={`px-3 py-1.5 text-xs ${viewMode === 'streams' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-white'}`}
            >
              <Radio className="w-3.5 h-3.5 inline mr-1" />
              Streams
            </button>
          </div>
          <UniversalActions domain="world" artifactId={undefined} compact />
        </div>
      </header>

      {/* Main Content */}
      {viewMode === 'concordia' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <ConcordiaHub
            onDistrictSelect={handleConcordiaDistrictSelect}
            onNavigateToLens={(lens) => router.push(`/lenses/${lens}`)}
          />
        </div>
      ) : viewMode === 'explore' ? (
        /* ── 3D Explore Mode ── */
        <div className="flex-1 relative min-h-0">
          <ConcordiaScene
            districtId={activeDistrict.id}
            quality="medium"
            onBuildingClick={(id) => {
              const b = activeDistrict.buildings.find(b => b.id === id);
              if (b) setSelectedBuilding(b);
            }}
            onTerrainClick={() => {}}
            width="100%"
            height="100%"
          />
          {/* 3D scene rendering layers */}
          <TerrainRenderer
            districts={[]}
            lodCenter={{ x: 0, z: 0 }}
            quality="medium"
          />
          <BuildingRenderer3D
            buildings={[]}
            viewMode="normal"
          />
          <SkyWeatherRenderer
            timeOfDay={12}
            weather="clear"
            windDirection={0}
            windSpeed={2}
            season="summer"
            quality="medium"
          />
          <WaterRenderer
            riverConfig={{ width: 20, flowDirection: 0, flowSpeed: 1, centerX: 0, length: 100 }}
            creekPath={[]}
            timeOfDay={12}
            quality="medium"
          />
          <ParticleEffectsComponent
            canvasWidth={800}
            canvasHeight={600}
            emitters={[]}
            weather={null}
            active={false}
          />
          <SoundscapeEngine />
          <AnimationManager><></></AnimationManager>
          <GameJuice><></></GameJuice>
          <LoadingTransitions
            transition="district"
            destination={{ name: 'Loading...' }}
            progress={0}
            phase="terrain"
          />
          <div className="absolute inset-0 pointer-events-none">
            <AvatarSystem3D
              playerAvatar={playerAvatar}
              otherPlayers={otherPlayers}
              npcs={[]}
              onMove={(pos, rotation) => {
                // Update local avatar immediately for snappy
                // response, then emit to the server so other players
                // see us move. The server rate-limits to ~30Hz.
                setPlayerAvatar((prev) => ({ ...prev, position: pos, rotation }));
                if (worldSocket.isConnected) {
                  worldSocket.emit('player:move', {
                    cityId: activeDistrict.id,
                    districtId: activeDistrict.id,
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    rotation,
                    direction: rotation,
                    action: 'walk',
                    currentAnimation: 'walk',
                  });
                }
              }}
              onEmote={(emote) => {
                setPlayerAvatar((prev) => ({ ...prev, currentAnimation: emote }));
                if (worldSocket.isConnected) {
                  worldSocket.emit('player:move', {
                    cityId: activeDistrict.id,
                    districtId: activeDistrict.id,
                    x: playerAvatar.position.x,
                    y: playerAvatar.position.y,
                    z: playerAvatar.position.z,
                    rotation: playerAvatar.rotation,
                    direction: playerAvatar.rotation,
                    action: emote,
                    currentAnimation: emote,
                  });
                }
              }}
            />
          </div>
          {/* Camera mode controls */}
          <div className="absolute top-4 right-4 z-20">
            <CameraControls
              cameraState={{ mode: cameraMode, zoom: 15, rotation: 'NE', followTarget: 'avatar', cinematicPlaying: false, cinematicTime: 0, cinematicDuration: 0, transitioning: false }}
              onModeChange={(mode) => setCameraMode(mode as typeof cameraMode)}
              onZoom={() => {}}
              onRotate={() => {}}
              onTransition={() => {}}
            />
          </div>
          {/* HUD overlay */}
          <HUDOverlay
            mode="explore"
            district={activeDistrict.name}
            timeOfDay="day"
            weather="clear"
            playerCount={1}
            currency={{ concordCoin: 0, pendingRoyalties: 0 }}
            professionBadge=""
            reputationLevel={1}
            notifications={[]}
            unreadCount={0}
            tools={[]}
            onToolSelect={() => {}}
            onMenuOpen={() => {}}
          />
          {/* Gameplay toolbar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/70 border border-white/10 rounded-xl px-2 py-1.5 pointer-events-auto">
            {([
              { key: 'inventory', label: 'Inventory', icon: Layers },
              { key: 'quests', label: 'Quests', icon: Zap },
              { key: 'chat', label: 'Chat', icon: MessageSquare },
              { key: 'map', label: 'Map', icon: MapIcon },
              { key: 'crafting', label: 'Craft', icon: Layers },
              { key: 'players', label: 'Players', icon: Users },
              { key: 'profile', label: 'Profile', icon: Eye },
              { key: 'collaboration', label: 'Collab', icon: HeartHandshake },
              { key: 'livecollab', label: 'Live Co-op', icon: Radio },
              { key: 'events', label: 'Events', icon: CalendarDays },
              { key: 'socialproof', label: 'Social', icon: ThumbsUp },
              { key: 'notifications', label: 'Notifs', icon: Bell },
              { key: 'smartnotify', label: 'Smart', icon: BellRing },
              { key: 'moderation', label: 'Mod', icon: Shield },
              { key: 'ownership', label: 'Own', icon: Fingerprint },
              { key: 'federation', label: 'Fed', icon: Network },
              { key: 'voice', label: 'Voice', icon: Mic },
              { key: 'voiceassist', label: 'Assist', icon: AudioLines },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setShowPanel(showPanel === key ? 'none' : key)}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] transition-colors ${showPanel === key ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          {/* Side panels */}
          {showPanel === 'inventory' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <InventoryPanel onClose={() => setShowPanel('none')} />
            </div>
          )}
          {showPanel === 'quests' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <QuestPanel onClose={() => setShowPanel('none')} />
            </div>
          )}
          {showPanel === 'chat' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <ChatSystem />
            </div>
          )}
          {showPanel === 'map' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <MapNavigation
                playerPosition={{ x: 0, y: 0 }}
                district={activeDistrict.name}
                buildings={[]}
                npcs={[]}
                players={[]}
                waypoints={[]}
                onWaypointPlace={() => {}}
                mapMode="district"
              />
            </div>
          )}
          {showPanel === 'crafting' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <CraftingPanel onClose={() => setShowPanel('none')} />
            </div>
          )}
          {showPanel === 'players' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <PlayerPresence />
            </div>
          )}
          {showPanel === 'profile' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <PlayerProfile isOwnProfile />
            </div>
          )}
          {showPanel === 'collaboration' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <CollaborationTools />
            </div>
          )}
          {showPanel === 'livecollab' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <LiveCollaboration
                session={{ id: '', dtuId: '', dtuName: '', branch: 'main', isDraft: true, validationStatus: 'checking', validationMessages: [] }}
                participants={[]}
                editHistory={[]}
                conflicts={[]}
              />
            </div>
          )}
          {showPanel === 'events' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <EventsGatherings />
            </div>
          )}
          {showPanel === 'socialproof' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <SocialProofFeed />
            </div>
          )}
          {showPanel === 'notifications' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <NotificationFeed
                notifications={[]}
                preferences={{ citation: true, royalty: true, discovery: true, event: true, system: true, social: true, moderation: true, milestone: true }}
                onRead={() => {}}
                onReadAll={() => {}}
                onAction={() => {}}
                onPreferenceChange={() => {}}
              />
            </div>
          )}
          {showPanel === 'smartnotify' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <SmartNotifications
                notifications={[]}
                profile={{
                  interests: [],
                  quietHours: { enabled: false, start: '22:00', end: '08:00' },
                  smartMode: true,
                  analytics: { totalReceived: 0, readRate: 0, actionRate: 0, topDomains: [] },
                  learningSuggestions: [],
                }}
                rules={[]}
                onUpdateRule={() => {}}
                onDismiss={() => {}}
                onLearn={() => {}}
              />
            </div>
          )}
          {showPanel === 'moderation' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <ModerationPanel
                role="player"
                reports={[]}
                permissions={[]}
                undoHistory={[]}
                onReport={() => {}}
                onUndo={() => {}}
              />
            </div>
          )}
          {showPanel === 'ownership' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <OwnershipProfile />
            </div>
          )}
          {showPanel === 'federation' && (
            <div className="absolute top-4 left-4 z-20 w-96 max-h-[70vh] overflow-auto pointer-events-auto">
              <FederationPanel />
            </div>
          )}
          {showPanel === 'voice' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <VoiceInterface />
            </div>
          )}
          {showPanel === 'voiceassist' && (
            <div className="absolute top-4 left-4 z-20 w-80 max-h-[70vh] overflow-auto pointer-events-auto">
              <VoiceAssistant />
            </div>
          )}
        </div>
      ) : viewMode === 'streams' ? (
        <CityStreamingSection />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Left Sidebar: Toolbar + Creation Panel */}
          <div className="flex flex-col w-56 flex-shrink-0 border-r border-white/10 overflow-y-auto">
            <CreationToolbar
              activeMode={creationMode}
              onModeChange={setCreationMode}
              zoom={zoom}
              onZoomChange={setZoom}
              rotation={rotation}
              onRotate={handleRotate}
              visibleLayers={visibleLayers}
              onToggleLayer={handleToggleLayer}
              showValidationOverlay={showValidation}
              onToggleValidation={() => setShowValidation(!showValidation)}
              showWeatherOverlay={showWeather}
              onToggleWeather={() => setShowWeather(!showWeather)}
            />

            {/* Marketplace palette when in guided/component mode */}
            {(creationMode === 'guided' || creationMode === 'component') && (
              <div className="border-t border-white/10 p-2">
                <MarketplacePalette
                  onSelectComponent={(entry) => {
                    // Auto-cite when selecting from marketplace
                    console.log('Selected component:', entry.dtuId, 'by', entry.creator);
                  }}
                />
              </div>
            )}

            {/* ── Tools Panel ──────────────────────────────── */}
            <div className="border-t border-white/10">
              <button
                onClick={() => setToolsExpanded(!toolsExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                  Tools
                  {activeTool && (
                    <span className="ml-1 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${toolsExpanded ? 'rotate-90' : ''}`} />
              </button>
              {toolsExpanded && (
                <div className="px-2 pb-2 space-y-2">
                  {(['Build', 'Inspect', 'Export', 'Verify', 'Replay'] as const).map(group => {
                    const tools = DISTRICT_TOOLS.filter(t => t.group === group);
                    return (
                      <div key={group}>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 px-1 mb-1">{group}</div>
                        <div className="grid grid-cols-2 gap-1">
                          {tools.map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              onClick={() => setActiveTool(activeTool === key ? null : key)}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-colors ${
                                activeTool === key
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                              }`}
                            >
                              <Icon className="w-3 h-3 shrink-0" />
                              <span className="truncate">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center: District Viewport */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Creation panels overlay */}
            {creationMode === 'guided' && (
              <div className="absolute left-60 top-24 z-20 w-80">
                <GuidedCreator
                  district={activeDistrict}
                  materials={materials}
                  onPublish={handlePublishBuilding}
                  onCancel={() => setCreationMode(null)}
                />
              </div>
            )}
            {creationMode === 'component' && (
              <div className="absolute left-60 top-24 z-20 w-72">
                <ComponentCreator
                  materials={materials}
                  onPublish={handlePublishComponent}
                  onCancel={() => setCreationMode(null)}
                />
              </div>
            )}
            {creationMode === 'raw' && (
              <div className="absolute left-60 top-24 z-20 w-96">
                <RawDTUEditor
                  materials={materials}
                  onPublish={handlePublishRawDTU}
                  onCancel={() => setCreationMode(null)}
                />
              </div>
            )}

            {/* ── Tool panel overlays ──────────────────────── */}
            {activeTool && (
              <div className="absolute left-60 top-24 z-20 w-[480px] max-h-[75vh] overflow-auto bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl">
                <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gray-900/95 backdrop-blur">
                  <span className="text-xs font-semibold text-cyan-300">
                    {DISTRICT_TOOLS.find(t => t.key === activeTool)?.label}
                  </span>
                  <button onClick={() => setActiveTool(null)} className="p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-2">
                  {activeTool === 'snapbuild' && <SnapBuildCatalog onClose={() => setActiveTool(null)} />}
                  {activeTool === 'dsl' && <ConcordDSLEditor />}
                  {activeTool === 'terminal' && <ConcordTerminal />}
                  {activeTool === 'diff' && <DTUDiffViewer />}
                  {activeTool === 'standards' && <StandardsLibrary />}
                  {activeTool === 'fabrication' && <FabricationExportPanel />}
                  {activeTool === 'embed' && (
                    <ExportEmbed
                      dtuId={selectedBuilding?.dtuId ?? 'none'}
                      dtuName={selectedBuilding?.dtuId ?? 'Selected DTU'}
                    />
                  )}
                  {activeTool === 'notebook' && <NotebookEditor />}
                  {activeTool === 'depgraph' && <DependencyGraphViewer />}
                  {activeTool === 'digitaltwin' && <DigitalTwinDashboard />}
                  {activeTool === 'sensors' && <SensorDashboard />}
                  {activeTool === 'marketplace' && <ServiceMarketplace />}
                  {activeTool === 'certificates' && <CertificatePanel />}
                  {activeTool === 'notarization' && <NotarizationPanel />}
                  {activeTool === 'stresstest' && (
                    <StressTestPanel
                      districtId={activeDistrict.id}
                      buildingCount={activeDistrict.buildings.length}
                    />
                  )}
                  {activeTool === 'replay' && <ReplayForensics />}
                  {activeTool === 'spectator' && <ReplaySpectator />}
                </div>
              </div>
            )}

            <DistrictViewport
              district={activeDistrict}
              selectedBuildingId={selectedBuilding?.id || null}
              onBuildingClick={handleBuildingClick}
              onInfrastructureClick={handleInfraClick}
              onTerrainClick={handleTerrainClick}
              showValidationOverlay={showValidation}
              showWeatherOverlay={showWeather}
              visibleLayers={visibleLayers}
              zoom={zoom}
              rotation={rotation}
            />
          </div>

          {/* Right Sidebar: Inspector */}
          <InspectorPanel
            selectedBuilding={selectedBuilding}
            selectedInfra={selectedInfra}
            selectedTerrain={selectedTerrain}
            validationReport={validationReport}
            citations={citations}
            materials={materials}
            onClose={handleCloseInspector}
          />
        </div>
      )}

      {/* Bottom Status Bar */}
      <StatusBar district={viewMode === 'district' ? activeDistrict : null} />

      {/* World Actions Panel */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-neon-green" />
            World Actions
          </h3>
          {worldActionResult && (
            <button onClick={() => setWorldActionResult(null)} className="p-0.5 rounded hover:bg-white/5 text-gray-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {(['countryCompare', 'indicatorTrack', 'tradeFlow', 'demographicProfile'] as const).map((action) => (
            <button
              key={action}
              onClick={() => handleWorldAction(action)}
              disabled={!_buildingItems[0]?.id || worldActiveAction !== null}
              className="px-2.5 py-1 text-xs rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {worldActiveAction === action ? (
                <div className="w-2.5 h-2.5 border border-neon-green border-t-transparent rounded-full animate-spin" />
              ) : null}
              {action === 'countryCompare' ? 'Compare' : action === 'indicatorTrack' ? 'Indicators' : action === 'tradeFlow' ? 'Trade Flow' : 'Demographics'}
            </button>
          ))}
        </div>
        {worldActionResult && (
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-2 text-xs space-y-1">
            {worldActionResult.action === 'countryCompare' && (() => {
              const r = worldActionResult.result;
              const countries = Array.isArray(r.countries) ? r.countries as Array<Record<string, unknown>> : [];
              return (
                <div className="space-y-1">
                  <div className="text-gray-400">Comparing <span className="text-white">{String(r.comparisonCount ?? countries.length)}</span> countries</div>
                  {countries.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex justify-between bg-white/5 px-2 py-0.5 rounded">
                      <span className="text-gray-300">{String(c.name ?? c.code ?? `Country ${i + 1}`)}</span>
                      <span className="text-neon-green">{String(c.gdp ?? c.score ?? '-')}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {worldActionResult.action === 'indicatorTrack' && (() => {
              const r = worldActionResult.result;
              const indicators = Array.isArray(r.indicators) ? r.indicators as Array<Record<string, unknown>> : [];
              return (
                <div className="space-y-1">
                  <div className="text-gray-400">Tracked: <span className="text-white">{String(r.indicatorCount ?? indicators.length)}</span></div>
                  {indicators.slice(0, 4).map((ind, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-gray-300">{String(ind.name ?? ind.indicator)}</span>
                      <span className="text-white">{String(ind.value ?? ind.current ?? '-')}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {worldActionResult.action === 'tradeFlow' && (() => {
              const r = worldActionResult.result;
              return (
                <div className="flex flex-wrap gap-3">
                  <span className="text-gray-400">Total Trade: <span className="text-white font-medium">{String(r.totalTradeVolume ?? r.totalVolume ?? 0)}</span></span>
                  <span className="text-gray-400">Partners: <span className="text-white">{String(r.partnerCount ?? 0)}</span></span>
                  <span className="text-gray-400">Balance: <span className={Number(r.tradeBalance ?? 0) >= 0 ? 'text-neon-green' : 'text-red-400'}>{String(r.tradeBalance ?? 0)}</span></span>
                </div>
              );
            })()}
            {worldActionResult.action === 'demographicProfile' && (() => {
              const r = worldActionResult.result;
              return (
                <div className="flex flex-wrap gap-3">
                  <span className="text-gray-400">Population: <span className="text-white font-medium">{String(r.population ?? '-')}</span></span>
                  <span className="text-gray-400">Median Age: <span className="text-white">{String(r.medianAge ?? '-')}</span></span>
                  <span className="text-gray-400">Growth: <span className="text-white">{String(r.growthRate ?? '-')}%</span></span>
                  <span className="text-gray-400">Urban: <span className="text-white">{String(r.urbanPercent ?? '-')}%</span></span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Lens Features (collapsible) */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Lens Features</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && (
          <div className="px-4 pb-3">
            <LensFeaturePanel lensId="world" />
          </div>
        )}
      </div>

      {/* Onboarding Tutorial */}
      {showOnboarding && (
        <OnboardingTutorial
          onComplete={handleOnboardingComplete}
          onDismiss={handleOnboardingComplete}
        />
      )}
    </div>
  );
}
