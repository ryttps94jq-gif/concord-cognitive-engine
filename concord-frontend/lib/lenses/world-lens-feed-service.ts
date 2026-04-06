/**
 * World Lens Feed Service — Aggregates activity across all 175 lenses
 * into a unified feed for the World Lens view.
 *
 * The World Lens is the bird's-eye view of the entire Concord platform:
 * every create, cite, collaborate, and milestone event flows through
 * here. Citation royalty flows are tracked using Concord's 21% base
 * rate that halves per generation (21% → 10.5% → 5.25% → …).
 */

// ── Types ─────────────────────────────────────────────────────────

export interface FeedItem {
  id: string;
  domain: string;
  type: 'create' | 'update' | 'delete' | 'cite' | 'collaborate' | 'achieve' | 'milestone';
  title: string;
  description: string;
  actor: { id: string; name: string; avatar?: string };
  timestamp: string;
  metadata: Record<string, unknown>;
  citations?: { dtuId: string; domain: string }[];
  royaltyGenerated?: number;
}

export interface FeedFilter {
  domains?: string[];
  types?: FeedItem['type'][];
  actorIds?: string[];
  since?: string;
  limit?: number;
  category?: string;
}

export interface TrendingDomain {
  domain: string;
  activity: number;
  growth: number;
}

export interface DomainActivityTimeline {
  hourly: number[];
  daily: number[];
  weekly: number[];
}

export interface RoyaltyFlow {
  from: string;
  to: string;
  amount: number;
}

export interface GlobalStats {
  totalDTUs: number;
  totalCitations: number;
  totalRoyalties: number;
  activeLenses: number;
  activeUsers: number;
}

// ── Category lookup (mirrors cross-domain-service) ────────────────

const CATEGORY_DOMAINS: Record<string, string[]> = {
  knowledge: ['research', 'education', 'library', 'science', 'data-science', 'machine-learning', 'mathematics', 'statistics'],
  creative: ['writing', 'design', 'music', 'video', 'photography', 'art', 'animation', 'game-design', 'architecture', 'ux-design'],
  system: ['engineering', 'devops', 'security', 'infrastructure', 'cloud', 'qa-testing', 'site-reliability', 'database'],
  social: ['community', 'social-media', 'communications', 'marketing', 'journalism', 'events', 'nonprofit'],
  productivity: ['project-management', 'tasks', 'calendar', 'notes', 'documents', 'spreadsheets', 'crm', 'hr', 'recruiting'],
  finance: ['accounting', 'invoicing', 'budgeting', 'payroll', 'tax', 'investments', 'banking', 'audit', 'financial-planning'],
  healthcare: ['clinical', 'pharmacy', 'lab', 'radiology', 'nursing', 'mental-health', 'dental', 'nutrition', 'public-health'],
  trades: ['construction', 'electrical', 'plumbing', 'hvac', 'carpentry', 'welding', 'auto-mechanic', 'materials', 'roofing'],
  operations: ['logistics', 'supply-chain', 'warehouse', 'fleet', 'manufacturing', 'quality-control', 'procurement', 'inventory'],
  agriculture: ['farming', 'livestock', 'aquaculture', 'forestry', 'agronomy', 'soil-science', 'irrigation', 'pest-management'],
  government: ['legislation', 'courts', 'law-enforcement', 'public-works', 'urban-planning', 'defense', 'regulatory', 'elections'],
  services: ['legal', 'consulting', 'real-estate', 'hospitality', 'retail', 'food-service', 'transportation', 'travel'],
  lifestyle: ['fitness', 'cooking', 'gardening', 'diy', 'parenting', 'personal-finance', 'meditation', 'sports', 'gaming'],
};

function getCategoryForDomain(domain: string): string | undefined {
  for (const [cat, domains] of Object.entries(CATEGORY_DOMAINS)) {
    if (domains.includes(domain)) return cat;
  }
  return undefined;
}

// ── Seed actors ───────────────────────────────────────────────────

const ACTORS = [
  { id: 'user-001', name: 'Elena Vasquez', avatar: '/avatars/ev.png' },
  { id: 'user-002', name: 'Marcus Chen', avatar: '/avatars/mc.png' },
  { id: 'user-003', name: 'Aisha Patel', avatar: '/avatars/ap.png' },
  { id: 'user-004', name: 'James Okafor', avatar: '/avatars/jo.png' },
  { id: 'user-005', name: 'Sofia Andersson', avatar: '/avatars/sa.png' },
  { id: 'user-006', name: 'Kenji Tanaka', avatar: '/avatars/kt.png' },
  { id: 'user-007', name: 'Priya Sharma', avatar: '/avatars/ps.png' },
  { id: 'user-008', name: 'Diego Morales', avatar: '/avatars/dm.png' },
  { id: 'user-009', name: 'Fatima Al-Rashid' },
  { id: 'user-010', name: 'Liam O\'Brien', avatar: '/avatars/lo.png' },
];

// ── Seed Feed (30 items across diverse domains) ───────────────────

const SEED_FEED: FeedItem[] = [
  // knowledge
  { id: 'feed-001', domain: 'research', type: 'create', title: 'Published: Quantum Error Correction Survey', description: 'New literature review covering 2024-2026 advances in topological codes.', actor: ACTORS[0], timestamp: '2026-04-06T09:12:00Z', metadata: { pages: 42, references: 118 } },
  { id: 'feed-002', domain: 'data-science', type: 'cite', title: 'Churn Model cited by Marketing', description: 'Customer churn prediction notebook cited in Spring campaign strategy.', actor: ACTORS[1], timestamp: '2026-04-06T08:45:00Z', metadata: { citedIn: 'marketing' }, citations: [{ dtuId: 'dtu-ds-003', domain: 'data-science' }], royaltyGenerated: 0.21 },
  { id: 'feed-003', domain: 'machine-learning', type: 'milestone', title: 'XGBoost Classifier hit 94% accuracy', description: 'Production model exceeded accuracy threshold after retraining on Q1 data.', actor: ACTORS[6], timestamp: '2026-04-06T07:30:00Z', metadata: { accuracy: 0.94, f1: 0.91 } },

  // creative
  { id: 'feed-004', domain: 'design', type: 'create', title: 'New Visual Identity Kit uploaded', description: 'Brand refresh assets for Spring product launch.', actor: ACTORS[2], timestamp: '2026-04-06T08:00:00Z', metadata: { fileCount: 24, formats: ['svg', 'png', 'figma'] } },
  { id: 'feed-005', domain: 'writing', type: 'collaborate', title: 'Co-editing: Annual Report Draft', description: 'Three authors collaborating on the 2025 annual report narrative.', actor: ACTORS[4], timestamp: '2026-04-06T06:15:00Z', metadata: { collaborators: 3, wordCount: 12400 } },
  { id: 'feed-006', domain: 'architecture', type: 'update', title: 'Updated: Community Center Floor Plans', description: 'Revised floor plans incorporating accessibility feedback.', actor: ACTORS[5], timestamp: '2026-04-05T22:10:00Z', metadata: { revision: 4 } },

  // system
  { id: 'feed-007', domain: 'engineering', type: 'create', title: 'Steel Alloy Spec v3 published', description: 'Updated tensile requirements for structural steel components.', actor: ACTORS[3], timestamp: '2026-04-06T10:00:00Z', metadata: { standard: 'ASTM-A36', version: 3 } },
  { id: 'feed-008', domain: 'devops', type: 'milestone', title: 'Zero-downtime deployment achieved', description: 'Microservices pipeline completed 100th consecutive zero-downtime deploy.', actor: ACTORS[1], timestamp: '2026-04-06T05:45:00Z', metadata: { consecutiveSuccesses: 100 } },
  { id: 'feed-009', domain: 'security', type: 'achieve', title: 'SOC 2 Type II Certification Renewed', description: 'Annual SOC 2 audit passed with zero findings.', actor: ACTORS[8], timestamp: '2026-04-05T18:00:00Z', metadata: { auditYear: 2026, findings: 0 } },

  // social
  { id: 'feed-010', domain: 'marketing', type: 'create', title: 'Spring Campaign Launched', description: 'Multi-channel campaign targeting Q2 product launch across 4 platforms.', actor: ACTORS[2], timestamp: '2026-04-06T09:30:00Z', metadata: { channels: ['email', 'social', 'search', 'display'], budget: 45000 }, citations: [{ dtuId: 'dtu-des-004', domain: 'design' }], royaltyGenerated: 0.21 },
  { id: 'feed-011', domain: 'community', type: 'collaborate', title: 'Community Guidelines v2 Draft', description: 'Open review period for updated community guidelines.', actor: ACTORS[7], timestamp: '2026-04-05T20:30:00Z', metadata: { reviewers: 12, comments: 34 } },

  // productivity
  { id: 'feed-012', domain: 'project-management', type: 'update', title: 'V3 Migration Roadmap updated', description: 'Added Phase 4 milestones and revised timeline for data migration.', actor: ACTORS[0], timestamp: '2026-04-06T08:20:00Z', metadata: { phases: 5, completedPhases: 2 } },
  { id: 'feed-013', domain: 'hr', type: 'create', title: 'Q2 Hiring Plan Published', description: '18 new positions across engineering, design, and operations.', actor: ACTORS[4], timestamp: '2026-04-05T15:00:00Z', metadata: { positions: 18, departments: 3 } },

  // finance
  { id: 'feed-014', domain: 'accounting', type: 'create', title: 'Q1 Revenue Recognition Complete', description: 'Revenue recognized for 847 contracts across all business units.', actor: ACTORS[3], timestamp: '2026-04-06T07:00:00Z', metadata: { contracts: 847, totalRevenue: 12400000 } },
  { id: 'feed-015', domain: 'tax', type: 'cite', title: 'Tax filing cites Q1 revenue data', description: 'Quarterly estimated tax worksheet derived from revenue recognition.', actor: ACTORS[8], timestamp: '2026-04-06T09:50:00Z', metadata: { filingType: 'quarterly' }, citations: [{ dtuId: 'dtu-fin-022', domain: 'accounting' }], royaltyGenerated: 0.21 },
  { id: 'feed-016', domain: 'audit', type: 'update', title: 'SOX Checklist 2026 Updated', description: 'Added new controls for AI-generated financial reports.', actor: ACTORS[9], timestamp: '2026-04-05T16:45:00Z', metadata: { controls: 142, newControls: 8 }, citations: [{ dtuId: 'dtu-fin-022', domain: 'accounting' }], royaltyGenerated: 0.105 },

  // healthcare
  { id: 'feed-017', domain: 'clinical', type: 'create', title: 'Hypertension Protocol Published', description: 'Evidence-based protocol for Stage 2 hypertension management.', actor: ACTORS[6], timestamp: '2026-04-06T06:00:00Z', metadata: { evidenceLevel: 'A', guidelines: 'JNC-9' } },
  { id: 'feed-018', domain: 'pharmacy', type: 'cite', title: 'Formulary updated from clinical protocol', description: 'ACE Inhibitor formulary entry derived from new hypertension protocol.', actor: ACTORS[7], timestamp: '2026-04-06T08:30:00Z', metadata: { drugClass: 'ACE Inhibitor' }, citations: [{ dtuId: 'dtu-hc-010', domain: 'clinical' }], royaltyGenerated: 0.21 },

  // trades
  { id: 'feed-019', domain: 'construction', type: 'create', title: 'Foundation Pour Estimate Filed', description: 'Cost estimate for 2,400 sq ft foundation including materials and labor.', actor: ACTORS[3], timestamp: '2026-04-06T07:15:00Z', metadata: { sqft: 2400, estimatedCost: 48000 }, citations: [{ dtuId: 'dtu-mat-012', domain: 'materials' }, { dtuId: 'dtu-eng-001', domain: 'engineering' }], royaltyGenerated: 0.315 },
  { id: 'feed-020', domain: 'electrical', type: 'achieve', title: 'Solar Array Installation Complete', description: 'Completed 50kW commercial rooftop solar installation ahead of schedule.', actor: ACTORS[5], timestamp: '2026-04-05T17:30:00Z', metadata: { capacity: '50kW', daysAhead: 3 } },

  // operations
  { id: 'feed-021', domain: 'logistics', type: 'update', title: 'West Coast Routes Optimized', description: 'Route optimization reduced average delivery time by 14%.', actor: ACTORS[1], timestamp: '2026-04-06T04:00:00Z', metadata: { routes: 23, avgReduction: 0.14 } },
  { id: 'feed-022', domain: 'supply-chain', type: 'cite', title: 'Demand forecast uses logistics data', description: 'Q2 demand model incorporates updated distribution route capacities.', actor: ACTORS[0], timestamp: '2026-04-06T06:30:00Z', metadata: { forecastPeriod: 'Q2-2026' }, citations: [{ dtuId: 'dtu-log-004', domain: 'logistics' }], royaltyGenerated: 0.21 },
  { id: 'feed-023', domain: 'manufacturing', type: 'milestone', title: 'Production Line 3 hit 99.2% yield', description: 'Highest yield rate achieved since line commissioning.', actor: ACTORS[9], timestamp: '2026-04-05T14:00:00Z', metadata: { yield: 0.992, line: 3 } },

  // agriculture
  { id: 'feed-024', domain: 'farming', type: 'create', title: 'Corn Rotation Schedule Published', description: '2026 crop rotation plan for 640-acre operation.', actor: ACTORS[7], timestamp: '2026-04-05T12:00:00Z', metadata: { acres: 640, crops: ['corn', 'soybean', 'wheat'] }, citations: [{ dtuId: 'dtu-soil-002', domain: 'soil-science' }], royaltyGenerated: 0.21 },
  { id: 'feed-025', domain: 'soil-science', type: 'create', title: 'North Field Nutrient Profile', description: 'Comprehensive soil analysis showing nitrogen and phosphorus levels.', actor: ACTORS[8], timestamp: '2026-04-05T10:00:00Z', metadata: { nitrogen: 42, phosphorus: 28, potassium: 180, unit: 'ppm' } },

  // government
  { id: 'feed-026', domain: 'urban-planning', type: 'collaborate', title: 'Downtown Rezoning Workshop', description: 'Public workshop with 84 participants on mixed-use zoning proposal.', actor: ACTORS[4], timestamp: '2026-04-05T19:00:00Z', metadata: { participants: 84, proposals: 6 } },

  // services
  { id: 'feed-027', domain: 'legal', type: 'create', title: 'MSA Template v4 Published', description: 'Updated Master Service Agreement with AI liability clauses.', actor: ACTORS[9], timestamp: '2026-04-06T10:30:00Z', metadata: { version: 4, clauses: 42 } },
  { id: 'feed-028', domain: 'consulting', type: 'cite', title: 'Strategy deck cites legal framework', description: 'Digital transformation proposal references AI liability terms.', actor: ACTORS[2], timestamp: '2026-04-06T11:00:00Z', metadata: { client: 'Enterprise Client A' }, citations: [{ dtuId: 'dtu-leg-009', domain: 'legal' }], royaltyGenerated: 0.21 },

  // lifestyle
  { id: 'feed-029', domain: 'fitness', type: 'achieve', title: 'Community 10K Challenge Complete', description: '342 users completed the 30-day 10K steps challenge.', actor: ACTORS[5], timestamp: '2026-04-05T21:00:00Z', metadata: { participants: 342, completionRate: 0.78 } },
  { id: 'feed-030', domain: 'cooking', type: 'create', title: 'Spring Recipe Collection', description: 'Curated 24 seasonal recipes with nutritional analysis.', actor: ACTORS[6], timestamp: '2026-04-05T13:00:00Z', metadata: { recipes: 24, avgCalories: 480 }, citations: [{ dtuId: 'dtu-nutr-001', domain: 'nutrition' }], royaltyGenerated: 0.21 },
];

// ── Service ───────────────────────────────────────────────────────

export class WorldLensFeedService {

  /**
   * Get a filtered feed of activity across all lenses.
   * Returns seed data filtered by the provided criteria.
   */
  getFeed(filter?: FeedFilter): FeedItem[] {
    let items = [...SEED_FEED];

    if (!filter) return items;

    if (filter.domains && filter.domains.length > 0) {
      items = items.filter(i => filter.domains!.includes(i.domain));
    }

    if (filter.types && filter.types.length > 0) {
      items = items.filter(i => filter.types!.includes(i.type));
    }

    if (filter.actorIds && filter.actorIds.length > 0) {
      items = items.filter(i => filter.actorIds!.includes(i.actor.id));
    }

    if (filter.since) {
      const sinceDate = new Date(filter.since);
      items = items.filter(i => new Date(i.timestamp) >= sinceDate);
    }

    if (filter.category) {
      const domainsInCategory = CATEGORY_DOMAINS[filter.category] ?? [];
      items = items.filter(i => domainsInCategory.includes(i.domain));
    }

    // Sort by timestamp descending (most recent first)
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter.limit && filter.limit > 0) {
      items = items.slice(0, filter.limit);
    }

    return items;
  }

  /**
   * Top 10 most active domains by activity count and growth rate.
   */
  getTrendingDomains(): TrendingDomain[] {
    // Count activity per domain from the seed feed
    const activityMap = new Map<string, number>();
    for (const item of SEED_FEED) {
      activityMap.set(item.domain, (activityMap.get(item.domain) ?? 0) + 1);
    }

    // Build trending list with simulated growth percentages
    const trending: TrendingDomain[] = [
      { domain: 'engineering', activity: activityMap.get('engineering') ?? 0 + 47, growth: 23.4 },
      { domain: 'data-science', activity: activityMap.get('data-science') ?? 0 + 38, growth: 31.2 },
      { domain: 'accounting', activity: activityMap.get('accounting') ?? 0 + 35, growth: 12.8 },
      { domain: 'clinical', activity: activityMap.get('clinical') ?? 0 + 32, growth: 18.5 },
      { domain: 'construction', activity: activityMap.get('construction') ?? 0 + 29, growth: 15.3 },
      { domain: 'marketing', activity: activityMap.get('marketing') ?? 0 + 27, growth: 28.7 },
      { domain: 'logistics', activity: activityMap.get('logistics') ?? 0 + 24, growth: 9.4 },
      { domain: 'legal', activity: activityMap.get('legal') ?? 0 + 22, growth: 14.1 },
      { domain: 'farming', activity: activityMap.get('farming') ?? 0 + 19, growth: 42.6 },
      { domain: 'devops', activity: activityMap.get('devops') ?? 0 + 18, growth: 11.9 },
    ];

    return trending.sort((a, b) => b.activity - a.activity);
  }

  /**
   * Get activity timeline for a specific domain.
   * Returns simulated hourly (24h), daily (30d), and weekly (12w) data.
   */
  getDomainActivity(domain: string): DomainActivityTimeline {
    // Seed deterministic-ish data based on domain name hash
    const hash = domain.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

    const hourly = Array.from({ length: 24 }, (_, i) => {
      const base = Math.max(2, (hash % 20) + Math.round(8 * Math.sin(i / 4)));
      return base + (i >= 9 && i <= 17 ? 12 : 0); // business hours bump
    });

    const daily = Array.from({ length: 30 }, (_, i) => {
      const dayOfWeek = i % 7;
      const weekendDip = dayOfWeek >= 5 ? 0.4 : 1;
      return Math.round(((hash % 30) + 40 + 10 * Math.sin(i / 5)) * weekendDip);
    });

    const weekly = Array.from({ length: 12 }, (_, i) => {
      return (hash % 100) + 200 + Math.round(30 * Math.sin(i / 3)) + i * 5;
    });

    return { hourly, daily, weekly };
  }

  /**
   * Get citation royalty flows between domains.
   * Concord's model: 21% base royalty, halving per generation.
   *   Gen 0 → Gen 1: 21%
   *   Gen 1 → Gen 2: 10.5%
   *   Gen 2 → Gen 3: 5.25%
   */
  getCitationRoyaltyFlow(): RoyaltyFlow[] {
    const flows: RoyaltyFlow[] = [];
    const BASE_ROYALTY = 0.21;

    for (const item of SEED_FEED) {
      if (item.citations && item.citations.length > 0) {
        for (let gen = 0; gen < item.citations.length; gen++) {
          const citation = item.citations[gen];
          const royalty = BASE_ROYALTY * Math.pow(0.5, gen);
          flows.push({
            from: item.domain,
            to: citation.domain,
            amount: Math.round(royalty * 1000) / 1000, // 3 decimal places
          });
        }
      }
    }

    // Aggregate flows between same domain pairs
    const aggregated = new Map<string, RoyaltyFlow>();
    for (const flow of flows) {
      const key = `${flow.from}→${flow.to}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.amount = Math.round((existing.amount + flow.amount) * 1000) / 1000;
      } else {
        aggregated.set(key, { ...flow });
      }
    }

    return [...aggregated.values()].sort((a, b) => b.amount - a.amount);
  }

  /**
   * Platform-wide aggregate statistics.
   */
  getGlobalStats(): GlobalStats {
    const citationCount = SEED_FEED
      .filter(i => i.citations && i.citations.length > 0)
      .reduce((sum, i) => sum + (i.citations?.length ?? 0), 0);

    const totalRoyalties = SEED_FEED
      .reduce((sum, i) => sum + (i.royaltyGenerated ?? 0), 0);

    const activeDomains = new Set(SEED_FEED.map(i => i.domain)).size;

    return {
      totalDTUs: 248_571,
      totalCitations: 41_832 + citationCount,
      totalRoyalties: Math.round((128_450.75 + totalRoyalties) * 100) / 100,
      activeLenses: activeDomains + 155, // seed domains + simulated others
      activeUsers: 12_847,
    };
  }
}
