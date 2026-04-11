'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
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

import { DEMO_DISTRICT } from '@/lib/world-lens/district-seed';
import { SEED_MATERIALS } from '@/lib/world-lens/material-seed';
import { cacheMaterials } from '@/lib/world-lens/validation-engine';
import type {
  District, CreationMode, PlacedBuildingDTU, InfrastructureDTU,
  TerrainCell, Citation, BuildingDTU, MaterialDTU, ValidationReport,
} from '@/lib/world-lens/types';
import type { ConcordiaDistrict } from '@/components/world-lens/ConcordiaHub';

import {
  Globe, ChevronDown, Layers, Map as MapIcon, Zap, X,
} from 'lucide-react';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';

// ── View Modes ──────────────────────────────────────────────────────

type ViewMode = 'concordia' | 'district';

// ── Component ───────────────────────────────────────────────────────

export default function WorldLensPage() {
  useLensNav('world');

  const router = useRouter();
  const { isLive, lastUpdated } = useRealtimeLens('world');

  // ── State ─────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('concordia');
  const [activeDistrict, setActiveDistrict] = useState<District>(DEMO_DISTRICT);
  const [creationMode, setCreationMode] = useState<CreationMode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<0 | 1 | 2 | 3>(0);
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
