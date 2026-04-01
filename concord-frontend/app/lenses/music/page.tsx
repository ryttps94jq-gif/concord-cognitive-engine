'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Play, Pause, Plus, Search, Home, Disc3, ListMusic,
  Clock, Upload, BarChart3, Heart, Library, Mic2,
  TrendingUp, Sparkles, GitFork, DollarSign,
  Users, X, Headphones,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/lib/music/store';
import { getPlayer } from '@/lib/music/player';
import type {
  MusicTrack, Artist, Playlist,
  MusicLensView, UploadProgress,
} from '@/lib/music/types';
import { previewRoyaltyObligations, ROYALTY_CONSTANTS } from '@/lib/music/royalty-cascade';
import { TrackCard } from '@/components/music/TrackCard';
import { ArtistProfile } from '@/components/music/ArtistProfile';
// AlbumView unused — album support pending
import { UploadFlow } from '@/components/music/UploadFlow';
import { PlaylistView } from '@/components/music/PlaylistView';
import { MediaUpload } from '@/components/media/MediaUpload';
import { UniversalPlayer } from '@/components/media/UniversalPlayer';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { VisionAnalyzeButton } from '@/components/common/VisionAnalyzeButton';

// ============================================================================
// Seed Data — empty; all data comes from the backend API
// ============================================================================

const SEED_TRACKS: MusicTrack[] = [];

const SEED_ARTISTS: Artist[] = [];

const SEED_PLAYLISTS: Playlist[] = [];

// ============================================================================
// Music Lens Page
// ============================================================================

export default function MusicLensPage() {
  useLensNav('music');
  const { latestData: realtimeData, alerts: _realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('music');
  const { isLoading: _trackLoading, items: trackItems, create: createTrackItem } = useLensData<Record<string, unknown>>('music', 'track', {
    seed: SEED_TRACKS.map(t => ({ title: t.title, data: t as unknown as Record<string, unknown> })),
  });
  const { items: artistItems } = useLensData<Record<string, unknown>>('music', 'artist', {
    seed: SEED_ARTISTS.map(a => ({ title: a.name, data: a as unknown as Record<string, unknown> })),
  });
  const { items: playlistItems, create: createPlaylistItem } = useLensData<Record<string, unknown>>('music', 'playlist', {
    seed: SEED_PLAYLISTS.map(p => ({ title: p.name, data: p as unknown as Record<string, unknown> })),
  });
  const {
    contextDTUs: _contextDTUs, hyperDTUs: _hyperDTUs, megaDTUs: _megaDTUs, regularDTUs: _regularDTUs,
    publishToMarketplace: _publishToMarketplace,
    isLoading: _dtusLoading,
  } = useLensDTUs({ lens: 'music' });

  // ---- Transform lens items to domain types ----
  const tracks = useMemo<MusicTrack[]>(() =>
    trackItems.map(item => ({ ...(item.data as unknown as MusicTrack), id: item.id, title: item.title })),
    [trackItems]
  );
  const artists = useMemo<Artist[]>(() =>
    artistItems.map(item => ({ ...(item.data as unknown as Artist), id: item.id, name: item.title || (item.data as Record<string, unknown>)?.name as string })),
    [artistItems]
  );
  const playlists = useMemo<Playlist[]>(() =>
    playlistItems.map(item => ({ ...(item.data as unknown as Playlist), id: item.id, name: item.title || (item.data as Record<string, unknown>)?.name as string })),
    [playlistItems]
  );

  // ---- View State ----
  const [view, setView] = useState<MusicLensView>('home');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [browseGenre, setBrowseGenre] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [libraryTab, setLibraryTab] = useState<'playlists' | 'liked' | 'purchased' | 'recent'>('playlists');
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());

  const { playTrack, addToQueue, nowPlaying } = useMusicStore();

  // ---- Navigation ----
  const navigateToArtist = useCallback((artistId: string) => {
    setSelectedArtistId(artistId);
    setView('artist');
  }, []);

  const navigateToAlbum = useCallback((albumId: string) => {
    setSelectedAlbumId(albumId);
    setView('album');
  }, []);

  const navigateToPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setView('playlist');
  }, []);

  const navigateHome = useCallback(() => {
    setView('home');
    setSelectedArtistId(null);
    setSelectedAlbumId(null);
    setSelectedPlaylistId(null);
  }, []);

  // ---- Like toggle ----
  const toggleLike = useCallback((trackId: string) => {
    setLikedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  // ---- Playlist creation ----
  const handleCreatePlaylist = useCallback(() => {
    const playlistData: Partial<Playlist> = {
      name: `New Playlist ${playlists.length + 1}`,
      description: '',
      coverArtUrl: null,
      creatorId: 'user-1',
      creatorName: 'Sovereign',
      isCollaborative: false,
      isPublic: true,
      tracks: [],
      totalDuration: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createPlaylistItem({ title: playlistData.name!, data: playlistData as unknown as Record<string, unknown> })
      .catch(err => console.error('Failed to create playlist:', err instanceof Error ? err.message : err));
  }, [playlists.length, createPlaylistItem]);

  // ---- Royalty preview ----
  const royaltyPreview = useMemo(() => {
    return previewRoyaltyObligations(9.99, [], new Map());
  }, []);

  // ---- Search ----
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return tracks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artistName.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }, [searchQuery, tracks]);

  // ---- Browse by genre ----
  const genreGroups = useMemo(() => {
    const groups: Record<string, MusicTrack[]> = {};
    for (const t of tracks) {
      const g = t.genre;
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    }
    return groups;
  }, [tracks]);

  const allGenres = useMemo(() => Object.keys(genreGroups).sort(), [genreGroups]);

  // ---- Upload handler ----
  const handleUpload = useCallback(async (data: unknown, _file: File) => {
    const uploadData = data as Record<string, unknown>;
    const trackTitle = (uploadData?.title as string) || _file.name.replace(/\.[^.]+$/, '');
    setUploadProgress({ stage: 'uploading', progress: 0, audioAnalysis: null, error: null });

    try {
      // Upload via media API
      setUploadProgress({ stage: 'uploading', progress: 30, audioAnalysis: null, error: null });
      const { api: apiClient } = await import('@/lib/api/client');
      const mediaResp = await apiClient.post('/api/media/upload', {
        title: trackTitle,
        mediaType: 'audio',
        mimeType: _file.type || 'audio/mpeg',
        fileSize: _file.size,
        originalFilename: _file.name,
        duration: (uploadData?.duration as number) || 240,
        tags: (uploadData?.tags as string[]) || [],
      });

      setUploadProgress({ stage: 'analyzing', progress: 60, audioAnalysis: null, error: null });
      const mediaId = mediaResp.data?.id || mediaResp.data?.media?.id;

      setUploadProgress({
        stage: 'processing', progress: 80,
        audioAnalysis: {
          bpm: 128, key: 'Am', loudnessLUFS: -14, spectralCentroid: 2200,
          onsetDensity: 4.2, waveformPeaks: [], chromaprintHash: mediaId || 'abc123',
          duration: 240, sampleRate: 44100, bitDepth: 24, channels: 2,
        },
        error: null,
      });

      // Persist the new track via lens data
      const newTrack: Partial<MusicTrack> = {
        id: mediaId || `t-upload-${Date.now()}`,
        title: trackTitle,
        artistId: 'user-1',
        artistName: 'You',
        albumId: null, albumTitle: null, coverArtUrl: null,
        audioUrl: mediaId ? `/api/media/${mediaId}/stream` : '',
        previewUrl: null, duration: 240, trackNumber: null,
        genre: (uploadData?.genre as string) || 'electronic',
        subGenre: (uploadData?.subGenre as string) || null,
        tags: (uploadData?.tags as string[]) || [],
        bpm: 128, key: 'Am', loudnessLUFS: -14, spectralCentroid: 2200,
        onsetDensity: 4.2,
        waveformPeaks: Array.from({ length: 200 }, () => Math.random() * 0.8),
        tiers: (uploadData?.tiers as MusicTrack['tiers']) || [
          { tier: 'listen', enabled: true, price: 0, currency: 'USD', maxLicenses: null, licensesIssued: 0 },
          { tier: 'create', enabled: true, price: 9.99, currency: 'USD', maxLicenses: null, licensesIssued: 0 },
          { tier: 'commercial', enabled: true, price: 99.99, currency: 'USD', maxLicenses: null, licensesIssued: 0 },
        ],
        playCount: 0, purchaseCount: 0, remixCount: 0,
        parentTrackId: (uploadData?.parentTrackId as string) || null,
        parentArtistId: null, parentTitle: null,
        lineageDepth: (uploadData?.parentTrackId) ? 1 : 0,
        stems: [],
        releaseDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isExplicit: (uploadData?.isExplicit as boolean) || false,
        lyrics: null, credits: [], chromaprintHash: null,
      };
      await createTrackItem({ title: trackTitle, data: newTrack as unknown as Record<string, unknown> });

      setUploadProgress({ stage: 'complete', progress: 100, audioAnalysis: null, error: null });
      setTimeout(() => { setUploadProgress(null); setView('home'); }, 2000);
    } catch (err) {
      console.error('Upload failed:', err instanceof Error ? err.message : err);
      setUploadProgress({ stage: 'uploading', progress: 0, audioAnalysis: null, error: err instanceof Error ? err.message : 'Upload failed' });
      setTimeout(() => setUploadProgress(null), 3000);
    }
  }, [createTrackItem]);

  // ---- Selected entities ----
  const selectedArtist = artists.find(a => a.id === selectedArtistId);
  const artistTracks = tracks.filter(t => t.artistId === selectedArtistId);
  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  // ---- Render ----
  return (
    <div className="lens-music flex flex-col h-full overflow-hidden" data-lens-theme="music">
      {/* Top Navigation */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-purple-500/10 bg-gradient-to-r from-purple-950/20 via-transparent to-indigo-950/20 flex-shrink-0">
        <div className="flex items-center gap-1">
          {[
            { id: 'home' as MusicLensView, icon: Home, label: 'Home' },
            { id: 'browse' as MusicLensView, icon: Disc3, label: 'Browse' },
            { id: 'library' as MusicLensView, icon: Library, label: 'Library' },
            { id: 'search' as MusicLensView, icon: Search, label: 'Search' },
          ].map(nav => (
            <button
              key={nav.id}
              onClick={() => setView(nav.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                view === nav.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-400 hover:text-purple-300 hover:bg-purple-500/10',
              )}
            >
              <nav.icon className="w-4 h-4" />
              {nav.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isLive && <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />}
          <VisionAnalyzeButton
            domain="music"
            prompt="Analyze this image related to music (album cover, concert photo, instrument, etc.). Describe what you see and suggest relevant genre tags, mood, and metadata for music cataloging."
            onResult={(res) => {
              handleCreatePlaylist();
              console.log('[Vision] Music analysis:', res.analysis);
            }}
          />
          <button
            onClick={() => setView('upload')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
          <button
            onClick={() => setView('revenue')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              view === 'revenue' ? 'bg-neon-green/10 text-neon-green' : 'text-gray-400 hover:text-white',
            )}
          >
            <DollarSign className="w-4 h-4" /> Revenue
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* ---- HOME ---- */}
            {view === 'home' && (
              <div className="space-y-8">
                {/* Hero */}
                <div className="bg-gradient-to-r from-neon-cyan/10 via-neon-purple/10 to-neon-pink/10 rounded-2xl p-8 border border-white/5">
                  <h1 className="text-3xl font-bold mb-2">Music Lens</h1>
                  <p className="text-gray-400 max-w-2xl">
                    Post your music for free. Background play. Real artist profiles.
                    Listeners purchase your artifacts and get remix rights. You keep 90%+.
                    No ads. No algorithmic gatekeeping.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setView('upload')}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-neon-cyan text-black text-sm font-semibold hover:brightness-110 transition"
                    >
                      <Upload className="w-4 h-4" /> Upload Track
                    </button>
                    <button
                      onClick={() => setView('browse')}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition"
                    >
                      <Search className="w-4 h-4" /> Browse Music
                    </button>
                  </div>
                </div>

                {/* New Releases (chronological) */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="w-5 h-5 text-neon-cyan" /> New Releases
                    </h2>
                    <span className="text-xs text-gray-500">Chronological — not algorithmic</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {tracks.slice(0, 6).map(track => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        variant="card"
                        showTiers
                        showLineage
                        onArtistClick={navigateToArtist}
                        onAlbumClick={navigateToAlbum}
                      />
                    ))}
                  </div>
                </section>

                {/* Trending */}
                <section>
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-neon-purple" /> Most Played
                  </h2>
                  <div className="space-y-1">
                    {[...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 8).map(track => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        variant="row"
                        showTiers
                        showLineage
                        onArtistClick={navigateToArtist}
                        onAlbumClick={navigateToAlbum}
                      />
                    ))}
                  </div>
                </section>

                {/* Artists */}
                <section>
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-neon-pink" /> Artists
                  </h2>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {artists.map(artist => (
                      <button
                        key={artist.id}
                        onClick={() => navigateToArtist(artist.id)}
                        className="flex-shrink-0 text-center group"
                      >
                        <div className="relative w-28 h-28 rounded-full bg-white/5 overflow-hidden group-hover:ring-2 ring-neon-cyan/30 transition-all mx-auto">
                          {artist.avatarUrl ? (
                            <Image src={artist.avatarUrl} alt={artist.name} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20">
                              <Music className="w-8 h-8 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm mt-2 text-gray-300 group-hover:text-white transition-colors">{artist.name}</p>
                        <p className="text-[10px] text-gray-500">{artist.stats.totalPlays.toLocaleString()} plays</p>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Playlists */}
                <section>
                  <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <ListMusic className="w-5 h-5 text-neon-green" /> Your Playlists
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {playlists.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => navigateToPlaylist(pl.id)}
                        className="group bg-white/[0.03] rounded-xl border border-white/5 hover:border-white/10 p-4 text-left transition-all"
                      >
                        <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-neon-cyan/10 to-neon-purple/10 flex items-center justify-center mb-3 overflow-hidden">
                          <ListMusic className="w-12 h-12 text-gray-600" />
                        </div>
                        <p className="text-sm font-medium truncate">{pl.name}</p>
                        <p className="text-xs text-gray-500">{pl.tracks.length} tracks</p>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Sovereignty Pitch */}
                <section className="bg-white/[0.02] rounded-xl border border-white/5 p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-neon-cyan" /> Creator Sovereignty
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { icon: Headphones, label: 'Listen Tier', desc: 'Stream free. Background play. Offline cache.', color: 'text-neon-cyan' },
                      { icon: Mic2, label: 'Create Tier', desc: 'Download, remix, sample. Derivative works.', color: 'text-neon-purple' },
                      { icon: DollarSign, label: 'Commercial Tier', desc: 'Sync, public performance. Full rights.', color: 'text-neon-green' },
                      { icon: GitFork, label: 'Royalty Cascade', desc: `${ROYALTY_CONSTANTS.BASE_RATE * 100}% to originals. Halves at each level. System invariant.`, color: 'text-neon-pink' },
                    ].map(item => (
                      <div key={item.label} className="p-4 rounded-lg bg-white/[0.03] border border-white/5">
                        <item.icon className={cn('w-6 h-6 mb-2', item.color)} />
                        <h3 className="text-sm font-semibold mb-1">{item.label}</h3>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ---- BROWSE ---- */}
            {view === 'browse' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold">Browse</h1>
                  <span className="text-xs text-gray-500">Chronological, not algorithmic</span>
                </div>

                {/* Genre filter */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBrowseGenre(null)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs transition-colors border',
                      !browseGenre ? 'bg-white/10 text-white border-white/20' : 'text-gray-500 border-white/5 hover:text-white',
                    )}
                  >
                    All
                  </button>
                  {allGenres.map(g => (
                    <button
                      key={g}
                      onClick={() => setBrowseGenre(g)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs capitalize transition-colors border',
                        browseGenre === g ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20' : 'text-gray-500 border-white/5 hover:text-white',
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                {/* Results */}
                <div className="space-y-1">
                  {(browseGenre ? tracks.filter(t => t.genre === browseGenre) : tracks).map(track => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      variant="row"
                      showTiers
                      showLineage
                      onArtistClick={navigateToArtist}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ---- SEARCH ---- */}
            {view === 'search' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-neon-cyan/50"
                    placeholder="Search tracks, artists, genres, tags..."
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {searchQuery ? (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 mb-2">{searchResults.length} results</p>
                    {searchResults.map(track => (
                      <TrackCard key={track.id} track={track} variant="row" showTiers onArtistClick={navigateToArtist} />
                    ))}
                    {searchResults.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Browse by Genre</h3>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {allGenres.map(g => (
                          <button
                            key={g}
                            onClick={() => { setBrowseGenre(g); setView('browse'); }}
                            className="p-4 rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/5 hover:border-white/10 text-sm capitalize text-center transition-colors"
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Browse by Key</h3>
                      <div className="flex flex-wrap gap-2">
                        {['C', 'Am', 'Dm', 'Em', 'Fm', 'Gm', 'Bb', 'Cm', 'Ab', 'Eb', 'F#m', 'D'].map(key => (
                          <button
                            key={key}
                            onClick={() => setSearchQuery(key)}
                            className="px-3 py-1.5 rounded-full text-xs border border-white/5 hover:border-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---- LIBRARY ---- */}
            {view === 'library' && (
              <div className="space-y-4">
                <h1 className="text-xl font-bold">Your Library</h1>

                <div className="flex gap-1 border-b border-white/5">
                  {(['playlists', 'liked', 'purchased', 'recent'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setLibraryTab(tab)}
                      className={cn(
                        'px-4 py-2 text-sm capitalize border-b-2 transition-colors',
                        libraryTab === tab ? 'border-neon-cyan text-neon-cyan' : 'border-transparent text-gray-400 hover:text-white',
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {libraryTab === 'playlists' && (
                  <div className="space-y-2">
                    <button onClick={handleCreatePlaylist} className="flex items-center gap-2 w-full p-3 rounded-lg bg-white/[0.03] border border-dashed border-white/10 hover:border-neon-cyan/30 text-sm text-gray-400 hover:text-white transition-colors">
                      <Plus className="w-4 h-4" /> Create Playlist
                    </button>
                    {playlists.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => navigateToPlaylist(pl.id)}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-white/5 text-left transition-colors"
                      >
                        <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                          <ListMusic className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{pl.name}</p>
                          <p className="text-xs text-gray-500">{pl.tracks.length} tracks · {pl.creatorName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {libraryTab === 'liked' && (
                  <div className="space-y-1">
                    {tracks.filter(t => likedTrackIds.has(t.id)).map(track => (
                      <TrackCard key={track.id} track={track} variant="row" onArtistClick={navigateToArtist} />
                    ))}
                    {likedTrackIds.size === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No liked tracks yet</p>
                      </div>
                    )}
                  </div>
                )}

                {libraryTab === 'purchased' && (
                  <div className="text-center py-12 text-gray-500">
                    <Headphones className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No purchased artifacts yet</p>
                    <p className="text-xs mt-1">Purchase Create or Commercial tier to access downloads and remix rights</p>
                  </div>
                )}

                {libraryTab === 'recent' && (
                  <div className="space-y-1">
                    {tracks.slice(0, 5).map(track => (
                      <TrackCard key={track.id} track={track} variant="row" onArtistClick={navigateToArtist} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- ARTIST ---- */}
            {view === 'artist' && selectedArtist && (
              <ArtistProfile
                artist={selectedArtist}
                tracks={artistTracks}
                albums={[]}
                onAlbumClick={navigateToAlbum}
                onBack={navigateHome}
              />
            )}

            {/* ---- ALBUM ---- */}
            {view === 'album' && (
              <div className="text-center py-16 text-gray-500">
                <Disc3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No albums yet</p>
                <p className="text-xs mt-1">Albums will appear here when artists release them.</p>
                <button onClick={navigateHome} className="text-xs text-neon-cyan hover:underline mt-4 inline-block">
                  &larr; Back to Home
                </button>
              </div>
            )}

            {/* ---- PLAYLIST ---- */}
            {view === 'playlist' && selectedPlaylist && (
              <PlaylistView
                playlist={selectedPlaylist}
                onArtistClick={navigateToArtist}
                onBack={navigateHome}
                isOwner
              />
            )}

            {/* ---- UPLOAD ---- */}
            {view === 'upload' && (
              <UploadFlow
                onUpload={handleUpload}
                onCancel={navigateHome}
                progress={uploadProgress}
              />
            )}

            {/* ---- REVENUE ---- */}
            {view === 'revenue' && (
              <div className="space-y-6 max-w-4xl">
                <h1 className="text-xl font-bold">Revenue Dashboard</h1>

                {/* Overview cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Revenue', value: '$15,840.00', icon: DollarSign, color: 'text-neon-green', bg: 'bg-neon-green/10' },
                    { label: 'Direct Sales', value: '$12,200.00', icon: BarChart3, color: 'text-neon-cyan', bg: 'bg-neon-cyan/10' },
                    { label: 'Remix Royalties', value: '$2,430.00', icon: GitFork, color: 'text-neon-purple', bg: 'bg-neon-purple/10' },
                    { label: 'Citation Royalties', value: '$1,210.00', icon: Sparkles, color: 'text-neon-pink', bg: 'bg-neon-pink/10' },
                  ].map(stat => (
                    <div key={stat.label} className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', stat.bg)}>
                        <stat.icon className={cn('w-4 h-4', stat.color)} />
                      </div>
                      <p className="text-xl font-bold">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Royalty cascade explainer */}
                <div className="bg-white/[0.03] rounded-xl border border-white/5 p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-neon-purple" /> Royalty Cascade — System Invariant
                  </h3>
                  <p className="text-xs text-gray-400">
                    {(ROYALTY_CONSTANTS.BASE_RATE * 100)}% of net revenue to original creators. Halves at each derivative level.
                    Floor: {(ROYALTY_CONSTANTS.ROYALTY_FLOOR * 100)}%. Platform fee: {(ROYALTY_CONSTANTS.PLATFORM_FEE_RATE * 100)}%.
                    Same for every creator.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-white/5">
                          <th className="text-left py-2 pr-4">Level</th>
                          <th className="text-left py-2 pr-4">Rate</th>
                          <th className="text-left py-2">Example ($10 sale)</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        <tr className="border-b border-white/[0.03]">
                          <td className="py-2 pr-4">1st derivative (direct remix)</td>
                          <td className="py-2 pr-4 text-neon-cyan">30%</td>
                          <td className="py-2">$2.73 to original</td>
                        </tr>
                        <tr className="border-b border-white/[0.03]">
                          <td className="py-2 pr-4">2nd derivative</td>
                          <td className="py-2 pr-4 text-neon-purple">15% + 30%</td>
                          <td className="py-2">$1.37 to original, $2.73 to 1st</td>
                        </tr>
                        <tr className="border-b border-white/[0.03]">
                          <td className="py-2 pr-4">3rd derivative</td>
                          <td className="py-2 pr-4 text-neon-pink">7.5% + 15% + 30%</td>
                          <td className="py-2">Continues halving</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4">Below 1%</td>
                          <td className="py-2 pr-4 text-gray-500">Floor</td>
                          <td className="py-2">Ancestor royalties cease</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent transactions */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Recent Transactions</h3>
                  <div className="space-y-2">
                    {[
                      { track: 'Substrate Dreams', tier: 'create', amount: 9.99, buyer: 'User-4821', date: '2h ago' },
                      { track: 'Lattice Pulse', tier: 'listen', amount: 0, buyer: 'User-9023', date: '5h ago' },
                      { track: 'Resonance Field', tier: 'commercial', amount: 99.99, buyer: 'Studio-Twelve', date: '1d ago' },
                      { track: 'Substrate Dreams', tier: 'create', amount: 9.99, buyer: 'User-3301', date: '2d ago' },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                        <div className="flex items-center gap-3">
                          <Music className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-gray-300">{tx.track}</p>
                            <p className="text-gray-500">{tx.buyer} · {tx.tier} tier</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn('font-mono', tx.amount > 0 ? 'text-neon-green' : 'text-gray-500')}>
                            {tx.amount > 0 ? `+$${tx.amount.toFixed(2)}` : 'Free'}
                          </p>
                          <p className="text-gray-600">{tx.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Royalty Preview */}
                {royaltyPreview.obligations.length > 0 && (
                  <div className="bg-white/[0.03] rounded-xl border border-white/5 p-5 space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-neon-green" /> Royalty Obligations Preview
                    </h3>
                    <div className="space-y-2">
                      {royaltyPreview.obligations.map((ob, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-white/[0.02]">
                          <div>
                            <span className="text-gray-300">{ob.name}</span>
                            <span className="text-gray-500 ml-2">({ob.title})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">{ob.rate}</span>
                            <span className="text-neon-green font-mono">{ob.amount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Net to creator: ${royaltyPreview.breakdown.creatorNet.toFixed(2)} · Platform: ${royaltyPreview.breakdown.platformFee.toFixed(2)}
                    </p>
                  </div>
                )}

                <button onClick={navigateHome} className="text-xs text-gray-400 hover:text-white">← Back to Home</button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Now Playing Bar — purple/indigo accent */}
      {nowPlaying.track && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-950/90 via-lattice-surface/95 to-indigo-950/90 backdrop-blur-xl border-t border-purple-500/20 px-6 py-3 shadow-[0_-4px_24px_rgba(139,92,246,0.15)]">
          <div className="flex items-center justify-between max-w-screen-xl mx-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/10">
                <Music className="w-5 h-5 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{nowPlaying.track.title}</p>
                <p className="text-xs text-gray-500 truncate">{nowPlaying.track.artistName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleLike(nowPlaying.track!.id)}
                className={cn('p-1.5 rounded transition-colors', likedTrackIds.has(nowPlaying.track.id) ? 'text-pink-400' : 'text-gray-500 hover:text-white')}
              >
                <Heart className={cn('w-4 h-4', likedTrackIds.has(nowPlaying.track.id) && 'fill-current')} />
              </button>
              <button
                onClick={() => {
                  const player = getPlayer();
                  if (nowPlaying.playbackState === 'playing') player.pause();
                  else player.play();
                }}
                className="p-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:brightness-110 transition shadow-lg shadow-purple-500/25"
              >
                {nowPlaying.playbackState === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => addToQueue(nowPlaying.track!)}
                className="p-1.5 rounded text-gray-500 hover:text-white transition-colors"
                title="Add to queue"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time panel */}
      {isLive && realtimeData && (
        <div className="fixed right-4 bottom-24 z-40">
          <RealtimeDataPanel
            domain="music"
            data={realtimeData}
            insights={realtimeInsights}
            isLive={isLive}
            lastUpdated={lastUpdated}
          />
        </div>
      )}
    </div>
  );
}
