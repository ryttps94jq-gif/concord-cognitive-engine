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
  Globe, ChevronDown, Layers, Map as MapIcon,
} from 'lucide-react';

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
