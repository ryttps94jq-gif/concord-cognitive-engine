/**
 * World Lens — Demo District Seed Data
 *
 * Pre-built district with buildings, infrastructure, and terrain
 * for the onboarding experience (Task 5.1).
 */

import type { District, TerrainCell, SoilType } from './types';

function generateTerrainGrid(width: number, height: number): TerrainCell[][] {
  const soilTypes: SoilType[] = ['clay', 'sand', 'rock', 'loam', 'gravel'];
  const grid: TerrainCell[][] = [];

  for (let y = 0; y < height; y++) {
    const row: TerrainCell[] = [];
    for (let x = 0; x < width; x++) {
      // Create varied terrain
      const centerDist = Math.sqrt((x - width / 2) ** 2 + (y - height / 2) ** 2);
      const elevation = 10 + Math.sin(x * 0.3) * 3 + Math.cos(y * 0.25) * 2 - centerDist * 0.1;

      row.push({
        soilType: soilTypes[(x + y * 3) % soilTypes.length],
        bedrockDepth: 5 + Math.sin(x * 0.5) * 2 + Math.cos(y * 0.4) * 1.5,
        waterTableDepth: 3 + Math.sin(x * 0.2 + y * 0.3) * 1,
        seismicZone: Math.min(5, Math.max(1, Math.floor(2 + Math.sin(x * 0.1) * 1.5))),
        elevation: Math.max(0, elevation),
      });
    }
    grid.push(row);
  }

  return grid;
}

export const DEMO_DISTRICT: District = {
  id: 'district-demo-001',
  name: 'Pioneer Valley',
  terrain: {
    grid: generateTerrainGrid(20, 20),
    dimensions: { width: 20, height: 20 },
  },
  zoning: {
    zones: [
      { id: 'zone-res-1', type: 'residential', densityLimit: 50, buildingCodeRef: 'code-standard', creator: 'system' },
      { id: 'zone-com-1', type: 'commercial', densityLimit: 80, buildingCodeRef: 'code-standard', creator: 'system' },
      { id: 'zone-edu-1', type: 'education', densityLimit: 30, buildingCodeRef: 'code-standard', creator: 'system' },
      { id: 'zone-res-2', type: 'residential', densityLimit: 40, buildingCodeRef: 'code-standard', creator: 'system' },
      { id: 'zone-ind-1', type: 'industrial', densityLimit: 60, buildingCodeRef: 'code-standard', creator: 'system' },
      { id: 'zone-mixed-1', type: 'mixed', densityLimit: 70, buildingCodeRef: 'code-standard', creator: 'system' },
    ],
  },
  infrastructure: {
    waterMains: [
      {
        id: 'infra-water-1', type: 'water',
        path: [{ x: 0, y: 10 }, { x: 5, y: 10 }, { x: 10, y: 10 }, { x: 15, y: 10 }, { x: 20, y: 10 }],
        capacity: 50000, creator: '@civil_sara', citations: 12,
      },
      {
        id: 'infra-water-2', type: 'water',
        path: [{ x: 10, y: 0 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 10, y: 15 }, { x: 10, y: 20 }],
        capacity: 40000, creator: '@water_mike', citations: 8,
      },
    ],
    powerGrid: [
      {
        id: 'infra-power-1', type: 'power',
        path: [{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 10, y: 2 }, { x: 15, y: 2 }, { x: 18, y: 2 }],
        capacity: 5000, creator: '@power_mike', citations: 15,
      },
      {
        id: 'infra-power-2', type: 'power',
        path: [{ x: 10, y: 2 }, { x: 10, y: 8 }, { x: 10, y: 14 }, { x: 10, y: 18 }],
        capacity: 3000, creator: '@power_mike', citations: 9,
      },
    ],
    drainage: [
      {
        id: 'infra-drain-1', type: 'drainage',
        path: [{ x: 3, y: 15 }, { x: 8, y: 15 }, { x: 13, y: 15 }, { x: 18, y: 15 }],
        capacity: 30000, creator: '@drain_eng', citations: 5,
      },
    ],
    roads: [
      {
        id: 'infra-road-main', type: 'road',
        path: [{ x: 0, y: 10 }, { x: 4, y: 10 }, { x: 8, y: 10 }, { x: 12, y: 10 }, { x: 16, y: 10 }, { x: 20, y: 10 }],
        capacity: 1000, creator: '@roads_dept', citations: 20,
      },
      {
        id: 'infra-road-cross', type: 'road',
        path: [{ x: 10, y: 0 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 10, y: 15 }, { x: 10, y: 20 }],
        capacity: 800, creator: '@roads_dept', citations: 18,
      },
    ],
    dataNetwork: [
      {
        id: 'infra-data-1', type: 'data',
        path: [{ x: 5, y: 5 }, { x: 10, y: 5 }, { x: 15, y: 5 }],
        capacity: 10000, creator: '@net_admin', citations: 3,
      },
    ],
  },
  weather: {
    baseTemperature: 15,
    seasonalRange: { min: -5, max: 35 },
    avgWindSpeed: 12,
    avgWindDirection: 270,
    annualRainfall: 800,
    snowLoad: 25,
    seismicRisk: 5.5,
  },
  buildings: [
    {
      id: 'placed-lib-1', dtuId: 'bldg-library-001', position: { x: 6, y: 8 },
      rotation: 0, validationStatus: 'validated', creator: '@architect_alex', placedAt: '2025-10-15',
    },
    {
      id: 'placed-apt-1', dtuId: 'bldg-apartment-001', position: { x: 3, y: 4 },
      rotation: 0, validationStatus: 'validated', creator: '@builder_bob', placedAt: '2025-10-20',
    },
    {
      id: 'placed-shop-1', dtuId: 'bldg-shop-001', position: { x: 12, y: 9 },
      rotation: 90, validationStatus: 'validated', creator: '@designer_dee', placedAt: '2025-11-01',
    },
    {
      id: 'placed-school-1', dtuId: 'bldg-school-001', position: { x: 14, y: 4 },
      rotation: 0, validationStatus: 'experimental', creator: '@edu_eng', placedAt: '2025-11-10',
    },
    {
      id: 'placed-solar-1', dtuId: 'bldg-solar-001', position: { x: 16, y: 14 },
      rotation: 0, validationStatus: 'validated', creator: '@power_mike', placedAt: '2025-11-15',
    },
    {
      id: 'placed-park-1', dtuId: 'bldg-park-001', position: { x: 8, y: 14 },
      rotation: 0, validationStatus: 'validated', creator: '@green_gina', placedAt: '2025-11-20',
    },
  ],
  environmentalScore: 72,
  populationCapacity: 2400,
  powerCapacity: 5000,
  waterCapacity: 90000,
};
