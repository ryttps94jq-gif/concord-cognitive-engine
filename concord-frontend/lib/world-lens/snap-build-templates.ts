/**
 * World Lens — Snap-Build Seed Templates
 *
 * Pre-validated building templates for casual users.
 * Each template is a complete, physics-validated structure
 * that can be placed directly into a district without
 * requiring engineering knowledge.
 */

export type SnapBuildCategory =
  | 'residential'
  | 'commercial'
  | 'public'
  | 'infrastructure'
  | 'industrial'
  | 'custom';

export type TemplateSize = '1x1' | '2x2' | '3x3' | '4x4+';

export interface SnapBuildTemplate {
  id: string;
  name: string;
  description: string;
  category: SnapBuildCategory;
  creator: string;
  creatorHandle: string;
  citations: number;
  validationStatus: 'validated';
  difficulty: 1 | 2 | 3 | 4 | 5;
  size: TemplateSize;
  materialSummary: string;
  infrastructureRequirements: string[];
  previewDescription: string;
  tags: string[];
  publishedAt: string;
  featured?: boolean;
  basedOn?: string; // citation chain — handle of original architect
}

export const SNAP_BUILD_CATEGORIES: {
  key: SnapBuildCategory;
  label: string;
  subcategories: string[];
}[] = [
  { key: 'residential', label: 'Residential', subcategories: ['houses', 'apartments'] },
  { key: 'commercial', label: 'Commercial', subcategories: ['shops', 'offices'] },
  { key: 'public', label: 'Public', subcategories: ['library', 'school', 'park'] },
  { key: 'infrastructure', label: 'Infrastructure', subcategories: ['power station', 'water treatment'] },
  { key: 'industrial', label: 'Industrial', subcategories: ['workshop', 'warehouse'] },
  { key: 'custom', label: 'Custom', subcategories: ['user-published templates'] },
];

export const SEED_SNAP_TEMPLATES: SnapBuildTemplate[] = [
  // ── Residential ──────────────────────────────────────────────────
  {
    id: 'snap-craftsman-house',
    name: 'Craftsman House',
    description: 'A cozy single-family home with a covered porch, gabled roof, and open-plan living area. Classic Craftsman style with tapered columns and exposed rafters.',
    category: 'residential',
    creator: '@architect_alex',
    creatorHandle: 'architect_alex',
    citations: 214,
    validationStatus: 'validated',
    difficulty: 1,
    size: '2x2',
    materialSummary: 'Timber frame, USB-A beams, concrete foundation, cedar siding',
    infrastructureRequirements: ['water', 'power', 'drainage'],
    previewDescription: 'Two-story timber-frame house with wraparound porch, 3 bedrooms, 2 bathrooms. Warm amber lighting visible through windows at dusk.',
    tags: ['house', 'family', 'craftsman', 'timber'],
    publishedAt: '2025-11-10',
    featured: true,
  },
  {
    id: 'snap-modern-apartment',
    name: 'Modern Apartment Block',
    description: 'A 4-story apartment building with 12 units, rooftop garden, and ground-floor retail space. Clean modernist lines with floor-to-ceiling windows.',
    category: 'residential',
    creator: '@urban_studio',
    creatorHandle: 'urban_studio',
    citations: 387,
    validationStatus: 'validated',
    difficulty: 2,
    size: '3x3',
    materialSummary: 'Reinforced concrete, steel frame, glass curtain wall, USB-B columns',
    infrastructureRequirements: ['water', 'power', 'drainage', 'data'],
    previewDescription: 'Sleek four-story block with alternating glass and concrete panels. Rooftop greenery visible from above. Balconies on south-facing units.',
    tags: ['apartment', 'modern', 'multi-family', 'urban'],
    publishedAt: '2025-10-22',
    featured: true,
  },

  // ── Commercial ───────────────────────────────────────────────────
  {
    id: 'snap-corner-shop',
    name: 'Corner Shop',
    description: 'A charming neighborhood shop with large display windows, awning, and a small stockroom in the back. Perfect for a bakery, bookstore, or cafe.',
    category: 'commercial',
    creator: '@main_street',
    creatorHandle: 'main_street',
    citations: 156,
    validationStatus: 'validated',
    difficulty: 1,
    size: '1x1',
    materialSummary: 'Brick walls, timber roof truss, glass storefront, tile flooring',
    infrastructureRequirements: ['water', 'power'],
    previewDescription: 'Single-story brick building on a street corner. Striped awning over large windows. Warm interior light spilling onto the sidewalk.',
    tags: ['shop', 'retail', 'small-business', 'brick'],
    publishedAt: '2025-12-01',
  },
  {
    id: 'snap-startup-office',
    name: 'Startup Office',
    description: 'An open-plan office space with meeting rooms, a break area, and server closet. Industrial-chic aesthetic with exposed ductwork and polished concrete floors.',
    category: 'commercial',
    creator: '@workspace_lab',
    creatorHandle: 'workspace_lab',
    citations: 98,
    validationStatus: 'validated',
    difficulty: 2,
    size: '2x2',
    materialSummary: 'Steel frame, concrete slab, glass partitions, USB-A beams',
    infrastructureRequirements: ['power', 'data', 'water'],
    previewDescription: 'Two-story glass-and-steel office. Open floor plan visible through facade. Rooftop HVAC units. Bike rack by entrance.',
    tags: ['office', 'startup', 'open-plan', 'industrial-chic'],
    publishedAt: '2025-11-28',
  },

  // ── Public ───────────────────────────────────────────────────────
  {
    id: 'snap-community-library',
    name: 'Community Library',
    description: 'A welcoming public library with reading rooms, children\'s section, computer lab, and community meeting space. Clerestory windows fill the interior with natural light.',
    category: 'public',
    creator: '@civic_design',
    creatorHandle: 'civic_design',
    citations: 423,
    validationStatus: 'validated',
    difficulty: 3,
    size: '3x3',
    materialSummary: 'Glulam timber frame, stone cladding, glass clerestory, green roof',
    infrastructureRequirements: ['water', 'power', 'data', 'drainage'],
    previewDescription: 'Low-slung timber building with dramatic clerestory roof. Stone base with warm wood upper walls. Garden courtyard visible through glass walls.',
    tags: ['library', 'public', 'community', 'timber'],
    publishedAt: '2025-09-15',
    featured: true,
  },
  {
    id: 'snap-neighborhood-school',
    name: 'Neighborhood School',
    description: 'A primary school with 8 classrooms, gymnasium, cafeteria, and playground. Bright colors and rounded corners create a child-friendly environment.',
    category: 'public',
    creator: '@edu_arch',
    creatorHandle: 'edu_arch',
    citations: 291,
    validationStatus: 'validated',
    difficulty: 4,
    size: '4x4+',
    materialSummary: 'Reinforced concrete, steel trusses, colored panels, rubber flooring',
    infrastructureRequirements: ['water', 'power', 'drainage', 'data', 'road'],
    previewDescription: 'U-shaped two-story building around a central courtyard with playground equipment. Colorful facade panels. Solar panels on flat roof.',
    tags: ['school', 'education', 'children', 'public'],
    publishedAt: '2025-10-05',
  },

  // ── Infrastructure ───────────────────────────────────────────────
  {
    id: 'snap-solar-power-station',
    name: 'Solar Power Station',
    description: 'A neighborhood-scale solar power station with battery storage, inverter building, and transformer yard. Generates 500 kW peak capacity.',
    category: 'infrastructure',
    creator: '@power_mike',
    creatorHandle: 'power_mike',
    citations: 178,
    validationStatus: 'validated',
    difficulty: 3,
    size: '3x3',
    materialSummary: 'Solar arrays, steel racking, concrete pad, battery units, USB-C cabling',
    infrastructureRequirements: ['power', 'road'],
    previewDescription: 'Rows of tilted solar panels on steel frames. Small control building with battery wall. Gravel access road.',
    tags: ['power', 'solar', 'energy', 'renewable'],
    publishedAt: '2025-11-18',
  },
  {
    id: 'snap-water-treatment',
    name: 'Water Treatment Facility',
    description: 'A compact water treatment plant with filtration, UV disinfection, and storage tanks. Serves up to 2,000 residents with clean potable water.',
    category: 'infrastructure',
    creator: '@hydro_eng',
    creatorHandle: 'hydro_eng',
    citations: 134,
    validationStatus: 'validated',
    difficulty: 5,
    size: '4x4+',
    materialSummary: 'Reinforced concrete tanks, stainless steel pipes, USB-B structural frame',
    infrastructureRequirements: ['water', 'power', 'drainage', 'road'],
    previewDescription: 'Series of circular concrete tanks connected by covered walkways. Control building with monitoring equipment. Chain-link perimeter fence.',
    tags: ['water', 'treatment', 'utility', 'infrastructure'],
    publishedAt: '2025-10-30',
  },

  // ── Industrial ───────────────────────────────────────────────────
  {
    id: 'snap-makers-workshop',
    name: "Maker's Workshop",
    description: 'A flexible workshop space with power tools area, assembly bench, materials storage, and small office. Roll-up garage door for large project access.',
    category: 'industrial',
    creator: '@fab_shop',
    creatorHandle: 'fab_shop',
    citations: 203,
    validationStatus: 'validated',
    difficulty: 2,
    size: '2x2',
    materialSummary: 'Steel portal frame, metal cladding, concrete slab, roller door',
    infrastructureRequirements: ['power', 'water'],
    previewDescription: 'Single-story steel building with large roller door open to reveal workbenches and tool walls. Skylights in corrugated roof.',
    tags: ['workshop', 'maker', 'fabrication', 'industrial'],
    publishedAt: '2025-12-05',
  },
  {
    id: 'snap-storage-warehouse',
    name: 'Storage Warehouse',
    description: 'A medium-scale warehouse with loading dock, racking system, and small office. Climate-controlled zone for sensitive materials.',
    category: 'industrial',
    creator: '@logistics_co',
    creatorHandle: 'logistics_co',
    citations: 167,
    validationStatus: 'validated',
    difficulty: 2,
    size: '3x3',
    materialSummary: 'Pre-engineered steel, concrete tilt-up walls, insulated panels',
    infrastructureRequirements: ['power', 'road'],
    previewDescription: 'Large rectangular building with corrugated metal walls. Loading dock with raised platform on one side. Parking area in front.',
    tags: ['warehouse', 'storage', 'logistics', 'industrial'],
    publishedAt: '2025-11-22',
  },

  // ── Custom ───────────────────────────────────────────────────────
  {
    id: 'snap-treehouse-retreat',
    name: 'Treehouse Retreat',
    description: 'A whimsical elevated cabin nestled in a tree canopy. Rope bridge access, wrap-around deck, and sustainable composting systems. Community favorite.',
    category: 'custom',
    creator: '@forest_dreamer',
    creatorHandle: 'forest_dreamer',
    citations: 512,
    validationStatus: 'validated',
    difficulty: 3,
    size: '1x1',
    materialSummary: 'Reclaimed timber, USB-C lightweight frame, rope, living tree anchors',
    infrastructureRequirements: ['power'],
    previewDescription: 'Small wooden cabin perched among tree branches. Rope bridge connects to a platform staircase. Warm lantern glow from within. Fairy lights along the railing.',
    tags: ['treehouse', 'custom', 'whimsical', 'sustainable'],
    publishedAt: '2025-12-10',
    featured: true,
    basedOn: '@architect_alex',
  },
  {
    id: 'snap-floating-greenhouse',
    name: 'Floating Greenhouse',
    description: 'A glass-paneled greenhouse on pontoon foundations for waterfront districts. Hydroponic growing beds, rainwater collection, and automated climate control.',
    category: 'custom',
    creator: '@aqua_grow',
    creatorHandle: 'aqua_grow',
    citations: 89,
    validationStatus: 'validated',
    difficulty: 4,
    size: '2x2',
    materialSummary: 'Aluminum frame, tempered glass, foam-core pontoons, hydroponic rigs',
    infrastructureRequirements: ['water', 'power'],
    previewDescription: 'Transparent greenhouse structure floating on calm water. Green plants visible through glass walls. Solar panels on roof ridge. Small dock for access.',
    tags: ['greenhouse', 'floating', 'hydroponics', 'custom'],
    publishedAt: '2025-12-15',
    basedOn: '@hydro_eng',
  },
];
