/**
 * Cross-Domain Service — Enables data sharing and correlation between
 * lenses across the 13 Concord platform categories (175 lenses).
 *
 * This is the connective tissue that lets a citation in a Legal lens
 * surface as a compliance reference in Finance, or an Engineering
 * material spec enrich a Construction estimate.
 *
 * Categories:
 *   knowledge, creative, system, social, productivity, finance,
 *   healthcare, trades, operations, agriculture, government,
 *   services, lifestyle
 */

// ── Types ─────────────────────────────────────────────────────────

export interface CrossDomainQuery {
  sourceDomain: string;
  targetDomains: string[];
  query: string;
  correlationType: 'related' | 'dependency' | 'citation' | 'derived' | 'complementary';
  maxResults?: number;
}

export interface CrossDomainResult {
  sourceDomain: string;
  targetDomain: string;
  artifacts: CrossDomainArtifact[];
  correlationScore: number;
  relationship: string;
}

export interface CrossDomainArtifact {
  id: string;
  domain: string;
  type: string;
  title: string;
  relevanceScore: number;
  citationPath?: string[];
}

export interface GraphNode {
  id: string;
  domain: string;
  category: string;
  label: string;
  weight: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  relationship: string;
}

export interface CitationNode {
  artifactId: string;
  domain: string;
  title: string;
  generation: number;
  citedBy: string[];
  cites: string[];
}

// ── Domain Category Map ───────────────────────────────────────────

const DOMAIN_CATEGORIES: Record<string, string> = {
  // knowledge
  'research': 'knowledge', 'education': 'knowledge', 'library': 'knowledge',
  'science': 'knowledge', 'philosophy': 'knowledge', 'history': 'knowledge',
  'linguistics': 'knowledge', 'mathematics': 'knowledge', 'statistics': 'knowledge',
  'data-science': 'knowledge', 'machine-learning': 'knowledge', 'ai-ethics': 'knowledge',
  'archaeology': 'knowledge', 'astronomy': 'knowledge',
  // creative
  'writing': 'creative', 'design': 'creative', 'music': 'creative',
  'video': 'creative', 'photography': 'creative', 'art': 'creative',
  'animation': 'creative', 'game-design': 'creative', 'fashion': 'creative',
  'architecture': 'creative', 'interior-design': 'creative', 'graphic-design': 'creative',
  'ux-design': 'creative', 'film': 'creative',
  // system
  'engineering': 'system', 'devops': 'system', 'security': 'system',
  'infrastructure': 'system', 'networking': 'system', 'database': 'system',
  'cloud': 'system', 'firmware': 'system', 'embedded': 'system',
  'systems-admin': 'system', 'qa-testing': 'system', 'site-reliability': 'system',
  // social
  'community': 'social', 'social-media': 'social', 'communications': 'social',
  'public-relations': 'social', 'marketing': 'social', 'advocacy': 'social',
  'nonprofit': 'social', 'fundraising': 'social', 'events': 'social',
  'volunteer': 'social', 'mentoring': 'social', 'journalism': 'social',
  // productivity
  'project-management': 'productivity', 'tasks': 'productivity', 'calendar': 'productivity',
  'notes': 'productivity', 'documents': 'productivity', 'spreadsheets': 'productivity',
  'presentations': 'productivity', 'email': 'productivity', 'crm': 'productivity',
  'hr': 'productivity', 'recruiting': 'productivity', 'time-tracking': 'productivity',
  'knowledge-base': 'productivity', 'wiki': 'productivity',
  // finance
  'accounting': 'finance', 'invoicing': 'finance', 'budgeting': 'finance',
  'payroll': 'finance', 'tax': 'finance', 'investments': 'finance',
  'banking': 'finance', 'insurance': 'finance', 'audit': 'finance',
  'financial-planning': 'finance', 'cryptocurrency': 'finance', 'trading': 'finance',
  'real-estate-finance': 'finance',
  // healthcare
  'clinical': 'healthcare', 'pharmacy': 'healthcare', 'lab': 'healthcare',
  'radiology': 'healthcare', 'nursing': 'healthcare', 'mental-health': 'healthcare',
  'dental': 'healthcare', 'veterinary': 'healthcare', 'nutrition': 'healthcare',
  'physical-therapy': 'healthcare', 'public-health': 'healthcare',
  'medical-research': 'healthcare', 'telemedicine': 'healthcare',
  // trades
  'construction': 'trades', 'electrical': 'trades', 'plumbing': 'trades',
  'hvac': 'trades', 'carpentry': 'trades', 'welding': 'trades',
  'auto-mechanic': 'trades', 'landscaping': 'trades', 'roofing': 'trades',
  'painting': 'trades', 'masonry': 'trades', 'materials': 'trades',
  // operations
  'logistics': 'operations', 'supply-chain': 'operations', 'warehouse': 'operations',
  'fleet': 'operations', 'manufacturing': 'operations', 'quality-control': 'operations',
  'procurement': 'operations', 'inventory': 'operations', 'shipping': 'operations',
  'customs': 'operations', 'compliance': 'operations',
  // agriculture
  'farming': 'agriculture', 'livestock': 'agriculture', 'aquaculture': 'agriculture',
  'forestry': 'agriculture', 'agronomy': 'agriculture', 'soil-science': 'agriculture',
  'irrigation': 'agriculture', 'pest-management': 'agriculture', 'organic': 'agriculture',
  'food-processing': 'agriculture', 'viticulture': 'agriculture',
  // government
  'legislation': 'government', 'courts': 'government', 'law-enforcement': 'government',
  'public-works': 'government', 'urban-planning': 'government', 'defense': 'government',
  'immigration': 'government', 'taxation': 'government', 'elections': 'government',
  'regulatory': 'government', 'diplomacy': 'government', 'emergency-mgmt': 'government',
  // services
  'legal': 'services', 'consulting': 'services', 'real-estate': 'services',
  'hospitality': 'services', 'retail': 'services', 'food-service': 'services',
  'transportation': 'services', 'cleaning': 'services', 'tutoring': 'services',
  'pet-care': 'services', 'beauty': 'services', 'travel': 'services',
  // lifestyle
  'fitness': 'lifestyle', 'cooking': 'lifestyle', 'gardening': 'lifestyle',
  'diy': 'lifestyle', 'parenting': 'lifestyle', 'personal-finance': 'lifestyle',
  'meditation': 'lifestyle', 'sports': 'lifestyle', 'gaming': 'lifestyle',
  'collecting': 'lifestyle', 'crafts': 'lifestyle', 'home-automation': 'lifestyle',
};

// ── Domain Correlations (~50 pairs) ───────────────────────────────

export const DOMAIN_CORRELATIONS: Map<string, number> = new Map([
  // System ↔ System
  ['engineering|devops', 0.95],
  ['engineering|security', 0.82],
  ['engineering|qa-testing', 0.91],
  ['devops|cloud', 0.93],
  ['devops|site-reliability', 0.96],
  ['security|compliance', 0.88],
  ['infrastructure|networking', 0.90],
  ['database|data-science', 0.84],
  // Finance ↔ Finance
  ['accounting|invoicing', 0.94],
  ['accounting|tax', 0.92],
  ['accounting|audit', 0.91],
  ['budgeting|financial-planning', 0.93],
  ['investments|trading', 0.90],
  ['payroll|hr', 0.88],
  ['banking|cryptocurrency', 0.72],
  // Healthcare ↔ Healthcare
  ['clinical|pharmacy', 0.89],
  ['clinical|lab', 0.91],
  ['clinical|radiology', 0.87],
  ['clinical|nursing', 0.93],
  ['mental-health|nutrition', 0.68],
  ['medical-research|public-health', 0.85],
  // Trades ↔ Trades / Operations
  ['construction|materials', 0.95],
  ['construction|electrical', 0.88],
  ['construction|plumbing', 0.85],
  ['construction|architecture', 0.90],
  ['hvac|electrical', 0.78],
  ['manufacturing|quality-control', 0.92],
  ['logistics|supply-chain', 0.96],
  ['logistics|shipping', 0.93],
  ['warehouse|inventory', 0.94],
  // Cross-category high correlation
  ['engineering|materials', 0.95],
  ['engineering|manufacturing', 0.86],
  ['data-science|statistics', 0.93],
  ['data-science|machine-learning', 0.96],
  ['marketing|social-media', 0.91],
  ['marketing|design', 0.82],
  ['legal|compliance', 0.90],
  ['legal|legislation', 0.88],
  ['legal|courts', 0.86],
  ['hr|recruiting', 0.92],
  ['project-management|tasks', 0.93],
  ['urban-planning|construction', 0.84],
  ['urban-planning|public-works', 0.89],
  ['nutrition|cooking', 0.83],
  ['fitness|physical-therapy', 0.79],
  ['farming|soil-science', 0.91],
  ['farming|irrigation', 0.88],
  ['farming|pest-management', 0.85],
  ['real-estate|real-estate-finance', 0.94],
  ['education|tutoring', 0.86],
  ['journalism|public-relations', 0.77],
]);

// ── Seed Artifacts ────────────────────────────────────────────────

const SEED_ARTIFACTS: CrossDomainArtifact[] = [
  { id: 'dtu-eng-001', domain: 'engineering', type: 'specification', title: 'Steel Alloy Tensile Requirements v3', relevanceScore: 0.97, citationPath: ['dtu-mat-012'] },
  { id: 'dtu-mat-012', domain: 'materials', type: 'datasheet', title: 'A36 Steel Properties Reference', relevanceScore: 0.95 },
  { id: 'dtu-con-005', domain: 'construction', type: 'estimate', title: 'Foundation Pour Cost Estimate Q2', relevanceScore: 0.88, citationPath: ['dtu-mat-012', 'dtu-eng-001'] },
  { id: 'dtu-fin-022', domain: 'accounting', type: 'report', title: 'Q1 Revenue Recognition Summary', relevanceScore: 0.91 },
  { id: 'dtu-fin-023', domain: 'tax', type: 'filing', title: 'Quarterly Estimated Tax Worksheet', relevanceScore: 0.89, citationPath: ['dtu-fin-022'] },
  { id: 'dtu-fin-024', domain: 'audit', type: 'checklist', title: 'SOX Compliance Checklist 2026', relevanceScore: 0.86, citationPath: ['dtu-fin-022'] },
  { id: 'dtu-hc-010', domain: 'clinical', type: 'protocol', title: 'Hypertension Management Protocol', relevanceScore: 0.93 },
  { id: 'dtu-hc-011', domain: 'pharmacy', type: 'formulary', title: 'ACE Inhibitor Formulary Entry', relevanceScore: 0.90, citationPath: ['dtu-hc-010'] },
  { id: 'dtu-ds-003', domain: 'data-science', type: 'notebook', title: 'Customer Churn Prediction Model', relevanceScore: 0.92, citationPath: ['dtu-ml-001'] },
  { id: 'dtu-ml-001', domain: 'machine-learning', type: 'model', title: 'XGBoost Churn Classifier v2', relevanceScore: 0.94 },
  { id: 'dtu-mkt-007', domain: 'marketing', type: 'campaign', title: 'Spring Product Launch Campaign', relevanceScore: 0.87, citationPath: ['dtu-des-004'] },
  { id: 'dtu-des-004', domain: 'design', type: 'asset', title: 'Product Launch Visual Identity Kit', relevanceScore: 0.85 },
  { id: 'dtu-leg-009', domain: 'legal', type: 'contract', title: 'Master Service Agreement Template', relevanceScore: 0.91 },
  { id: 'dtu-comp-003', domain: 'compliance', type: 'policy', title: 'GDPR Data Processing Addendum', relevanceScore: 0.89, citationPath: ['dtu-leg-009'] },
  { id: 'dtu-agr-006', domain: 'farming', type: 'plan', title: 'Corn Rotation Schedule 2026', relevanceScore: 0.88, citationPath: ['dtu-soil-002'] },
  { id: 'dtu-soil-002', domain: 'soil-science', type: 'analysis', title: 'North Field Nutrient Profile', relevanceScore: 0.92 },
  { id: 'dtu-pm-015', domain: 'project-management', type: 'plan', title: 'Platform V3 Migration Roadmap', relevanceScore: 0.90 },
  { id: 'dtu-devops-008', domain: 'devops', type: 'pipeline', title: 'CI/CD Pipeline for Microservices', relevanceScore: 0.93, citationPath: ['dtu-pm-015'] },
  { id: 'dtu-log-004', domain: 'logistics', type: 'route', title: 'West Coast Distribution Routes', relevanceScore: 0.87 },
  { id: 'dtu-sc-002', domain: 'supply-chain', type: 'forecast', title: 'Q2 Demand Forecast Model', relevanceScore: 0.91, citationPath: ['dtu-log-004'] },
];

// ── Seed Citation Chain ───────────────────────────────────────────

const SEED_CITATION_CHAINS: Map<string, CitationNode[]> = new Map([
  ['dtu-con-005', [
    { artifactId: 'dtu-con-005', domain: 'construction', title: 'Foundation Pour Cost Estimate Q2', generation: 0, citedBy: [], cites: ['dtu-mat-012', 'dtu-eng-001'] },
    { artifactId: 'dtu-eng-001', domain: 'engineering', title: 'Steel Alloy Tensile Requirements v3', generation: 1, citedBy: ['dtu-con-005'], cites: ['dtu-mat-012'] },
    { artifactId: 'dtu-mat-012', domain: 'materials', title: 'A36 Steel Properties Reference', generation: 2, citedBy: ['dtu-con-005', 'dtu-eng-001'], cites: [] },
  ]],
  ['dtu-fin-023', [
    { artifactId: 'dtu-fin-023', domain: 'tax', title: 'Quarterly Estimated Tax Worksheet', generation: 0, citedBy: [], cites: ['dtu-fin-022'] },
    { artifactId: 'dtu-fin-022', domain: 'accounting', title: 'Q1 Revenue Recognition Summary', generation: 1, citedBy: ['dtu-fin-023', 'dtu-fin-024'], cites: [] },
  ]],
  ['dtu-hc-011', [
    { artifactId: 'dtu-hc-011', domain: 'pharmacy', title: 'ACE Inhibitor Formulary Entry', generation: 0, citedBy: [], cites: ['dtu-hc-010'] },
    { artifactId: 'dtu-hc-010', domain: 'clinical', title: 'Hypertension Management Protocol', generation: 1, citedBy: ['dtu-hc-011'], cites: [] },
  ]],
  ['dtu-ds-003', [
    { artifactId: 'dtu-ds-003', domain: 'data-science', title: 'Customer Churn Prediction Model', generation: 0, citedBy: [], cites: ['dtu-ml-001'] },
    { artifactId: 'dtu-ml-001', domain: 'machine-learning', title: 'XGBoost Churn Classifier v2', generation: 1, citedBy: ['dtu-ds-003'], cites: [] },
  ]],
]);

// ── Helper: look up correlation for a domain pair ─────────────────

function getCorrelation(a: string, b: string): number {
  const key1 = `${a}|${b}`;
  const key2 = `${b}|${a}`;
  return DOMAIN_CORRELATIONS.get(key1) ?? DOMAIN_CORRELATIONS.get(key2) ?? 0;
}

function getCategoryForDomain(domain: string): string {
  return DOMAIN_CATEGORIES[domain] ?? 'unknown';
}

// ── Service ───────────────────────────────────────────────────────

export class CrossDomainService {

  /**
   * Find related artifacts across domains based on a query and
   * correlation type.
   */
  queryAcrossDomains(query: CrossDomainQuery): CrossDomainResult[] {
    const { sourceDomain, targetDomains, correlationType, maxResults = 10 } = query;
    const queryLower = query.query.toLowerCase();

    const results: CrossDomainResult[] = [];

    for (const target of targetDomains) {
      const correlation = getCorrelation(sourceDomain, target);

      // Filter artifacts by target domain and basic text match
      const matching = SEED_ARTIFACTS
        .filter(a => a.domain === target)
        .filter(a => a.title.toLowerCase().includes(queryLower) || queryLower === '*')
        .map(a => ({
          ...a,
          relevanceScore: a.relevanceScore * (correlation > 0 ? correlation : 0.3),
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);

      if (matching.length > 0 || correlation > 0) {
        results.push({
          sourceDomain,
          targetDomain: target,
          artifacts: matching,
          correlationScore: correlation,
          relationship: this._describeRelationship(sourceDomain, target, correlationType),
        });
      }
    }

    return results
      .sort((a, b) => b.correlationScore - a.correlationScore)
      .slice(0, maxResults);
  }

  /**
   * Get correlation strengths between a given domain and all other
   * domains that have a defined correlation.
   */
  getDomainCorrelations(domain: string): Map<string, number> {
    const result = new Map<string, number>();

    for (const [key, score] of DOMAIN_CORRELATIONS) {
      const [a, b] = key.split('|');
      if (a === domain) result.set(b, score);
      else if (b === domain) result.set(a, score);
    }

    return result;
  }

  /**
   * Build a knowledge graph across the specified domains. Nodes are
   * domains, edges are correlation pairs with weight.
   */
  buildKnowledgeGraph(domains: string[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const domainSet = new Set(domains);

    const nodes: GraphNode[] = domains.map(d => ({
      id: `node-${d}`,
      domain: d,
      category: getCategoryForDomain(d),
      label: d.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      weight: SEED_ARTIFACTS.filter(a => a.domain === d).length,
    }));

    const edges: GraphEdge[] = [];
    const seen = new Set<string>();

    for (const [key, weight] of DOMAIN_CORRELATIONS) {
      const [a, b] = key.split('|');
      if (domainSet.has(a) && domainSet.has(b)) {
        const edgeKey = [a, b].sort().join('|');
        if (!seen.has(edgeKey)) {
          seen.add(edgeKey);
          edges.push({
            source: `node-${a}`,
            target: `node-${b}`,
            weight,
            relationship: weight >= 0.9 ? 'strong' : weight >= 0.75 ? 'moderate' : 'weak',
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Trace the citation lineage for an artifact across domains.
   */
  getCitationChain(artifactId: string): CitationNode[] {
    const chain = SEED_CITATION_CHAINS.get(artifactId);
    if (chain) return chain;

    // If the artifact exists but has no pre-built chain, return a
    // single-node chain.
    const artifact = SEED_ARTIFACTS.find(a => a.id === artifactId);
    if (artifact) {
      return [{
        artifactId: artifact.id,
        domain: artifact.domain,
        title: artifact.title,
        generation: 0,
        citedBy: [],
        cites: artifact.citationPath ?? [],
      }];
    }

    return [];
  }

  /**
   * Recommend related domains based on correlation strength.
   * Returns domains sorted by relevance, excluding the input domain.
   */
  getRecommendedDomains(currentDomain: string): string[] {
    const correlations = this.getDomainCorrelations(currentDomain);

    // Also include domains in the same category
    const currentCategory = getCategoryForDomain(currentDomain);
    for (const [domain, category] of Object.entries(DOMAIN_CATEGORIES)) {
      if (category === currentCategory && domain !== currentDomain && !correlations.has(domain)) {
        correlations.set(domain, 0.5); // moderate intra-category baseline
      }
    }

    return [...correlations.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([domain]) => domain);
  }

  // ── Private helpers ─────────────────────────────────────────────

  private _describeRelationship(
    source: string,
    target: string,
    type: CrossDomainQuery['correlationType'],
  ): string {
    const sourceLabel = source.replace(/-/g, ' ');
    const targetLabel = target.replace(/-/g, ' ');

    switch (type) {
      case 'related':
        return `${sourceLabel} has related data in ${targetLabel}`;
      case 'dependency':
        return `${sourceLabel} depends on artifacts from ${targetLabel}`;
      case 'citation':
        return `${sourceLabel} cites work from ${targetLabel}`;
      case 'derived':
        return `${sourceLabel} is derived from ${targetLabel} data`;
      case 'complementary':
        return `${sourceLabel} and ${targetLabel} provide complementary perspectives`;
    }
  }
}
