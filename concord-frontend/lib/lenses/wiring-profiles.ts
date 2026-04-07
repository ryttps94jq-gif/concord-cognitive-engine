/**
 * Wiring Profiles — Per-category integration profiles
 *
 * Each of the 13 lens categories has a wiring profile that defines which
 * of the 30 universal integration hooks from LensProvider are enabled by
 * default, along with layout, format, correlation, automation, AI, and
 * compliance settings.
 *
 * The 175 lenses across 13 categories share these profiles so the platform
 * can wire up infrastructure automatically when a lens is loaded.
 *
 * Usage:
 *   import { getWiringProfile, getCategoryIntegrationScore } from '@/lib/lenses/wiring-profiles';
 *   const profile = getWiringProfile('healthcare');
 */

// ── Interface ─────────────────────────────────────────────────────

export interface WiringProfile {
  category: string;
  label: string;
  description: string;
  /** Which of the 30 integration hooks are enabled by default for this category */
  enabledHooks: string[];
  /** Default layout for lenses in this category */
  defaultLayout: 'default' | 'split' | 'full' | 'minimal';
  /** Default export formats */
  defaultExports: string[];
  /** Default import formats */
  defaultImports: string[];
  /** Cross-domain correlation strength with other categories (0-1) */
  correlations: Record<string, number>;
  /** Default automation triggers available */
  automationTriggers: string[];
  /** AI features enabled by default */
  aiFeatures: ('brain' | 'recommendations' | 'predictions')[];
  /** Real-time features enabled */
  realtimeFeatures: ('socket' | 'presence' | 'notifications' | 'sync')[];
  /** Analytics level */
  analyticsLevel: 'basic' | 'standard' | 'advanced';
  /** Compliance requirements */
  complianceRequirements: string[];
}

// ── All 30 Hook Names (from LensProvider) ─────────────────────────

export const ALL_HOOK_NAMES: string[] = [
  // Data hooks (6)
  'useLensData',
  'useLensQuery',
  'useLensMutations',
  'useLensDTUs',
  'useLensSearch',
  'useLensFilters',
  // Real-time hooks (4)
  'useLensSocket',
  'useLensPresence',
  'useLensNotifications',
  'useLensSync',
  // UI hooks (5)
  'useLensLayout',
  'useLensTheme',
  'useLensShortcuts',
  'useLensAccessibility',
  'useLensResponsive',
  // Integration hooks (5)
  'useLensImport',
  'useLensExport',
  'useLensWebhooks',
  'useLensAPI',
  'useLensAutomation',
  // Analytics hooks (4)
  'useLensAnalytics',
  'useLensMetrics',
  'useLensAudit',
  'useLensHealth',
  // AI hooks (3)
  'useLensBrain',
  'useLensRecommendations',
  'useLensPredictions',
  // Cross-domain hooks (3)
  'useLensCrossDomain',
  'useLensFederation',
  'useLensCitations',
];

// ── Profiles ──────────────────────────────────────────────────────

export const WIRING_PROFILES: Record<string, WiringProfile> = {

  // ═══════════════════════════════════════════════════════════════
  // KNOWLEDGE
  // ═══════════════════════════════════════════════════════════════

  knowledge: {
    category: 'knowledge',
    label: 'Knowledge',
    description: 'Research, chat, notes, documents, and knowledge-graph lenses. Heavy on search, AI, and cross-domain linking.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensShortcuts', 'useLensAccessibility', 'useLensResponsive',
      'useLensImport', 'useLensExport',
      'useLensAnalytics', 'useLensAudit',
      'useLensBrain', 'useLensRecommendations', 'useLensPredictions',
      'useLensCrossDomain', 'useLensCitations',
    ],
    defaultLayout: 'split',
    defaultExports: ['json', 'pdf', 'markdown', 'csv', 'docx'],
    defaultImports: ['json', 'csv', 'xlsx', 'xml', 'markdown'],
    correlations: {
      creative: 0.65,
      productivity: 0.80,
      social: 0.55,
      finance: 0.40,
      healthcare: 0.45,
      government: 0.50,
      services: 0.35,
    },
    automationTriggers: [
      'on_document_created',
      'on_search_threshold',
      'on_citation_added',
      'on_knowledge_graph_updated',
      'on_summary_generated',
      'on_duplicate_detected',
    ],
    aiFeatures: ['brain', 'recommendations', 'predictions'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'advanced',
    complianceRequirements: ['GDPR', 'CCPA'],
  },

  // ═══════════════════════════════════════════════════════════════
  // CREATIVE
  // ═══════════════════════════════════════════════════════════════

  creative: {
    category: 'creative',
    label: 'Creative',
    description: 'Music, art, design, video, writing, and studio lenses. Focused on real-time collaboration and rich media export.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensPresence', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensShortcuts', 'useLensAccessibility', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensWebhooks',
      'useLensAnalytics',
      'useLensBrain', 'useLensRecommendations',
      'useLensCrossDomain', 'useLensCitations',
    ],
    defaultLayout: 'full',
    defaultExports: ['json', 'pdf', 'png', 'svg', 'mp3', 'wav', 'mp4', 'glb'],
    defaultImports: ['json', 'png', 'svg', 'mp3', 'wav', 'midi', 'psd', 'ai'],
    correlations: {
      knowledge: 0.65,
      social: 0.70,
      lifestyle: 0.50,
      services: 0.45,
      productivity: 0.40,
      operations: 0.20,
    },
    automationTriggers: [
      'on_asset_uploaded',
      'on_render_complete',
      'on_version_published',
      'on_collaboration_started',
      'on_export_finished',
    ],
    aiFeatures: ['brain', 'recommendations'],
    realtimeFeatures: ['socket', 'presence', 'notifications', 'sync'],
    analyticsLevel: 'standard',
    complianceRequirements: ['DMCA', 'GDPR'],
  },

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM
  // ═══════════════════════════════════════════════════════════════

  system: {
    category: 'system',
    label: 'System',
    description: 'Platform admin, settings, user management, and developer tools. Full observability and automation.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensShortcuts', 'useLensResponsive',
      'useLensWebhooks', 'useLensAPI', 'useLensAutomation',
      'useLensAnalytics', 'useLensMetrics', 'useLensAudit', 'useLensHealth',
      'useLensBrain',
      'useLensCrossDomain', 'useLensFederation',
    ],
    defaultLayout: 'default',
    defaultExports: ['json', 'csv', 'yaml', 'log'],
    defaultImports: ['json', 'csv', 'yaml'],
    correlations: {
      operations: 0.85,
      government: 0.50,
      finance: 0.45,
      healthcare: 0.40,
      productivity: 0.35,
      knowledge: 0.30,
    },
    automationTriggers: [
      'on_health_degraded',
      'on_error_rate_spike',
      'on_user_provisioned',
      'on_role_changed',
      'on_deployment_complete',
      'on_config_updated',
      'on_audit_alert',
    ],
    aiFeatures: ['brain'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'advanced',
    complianceRequirements: ['SOC2', 'ISO27001', 'GDPR'],
  },

  // ═══════════════════════════════════════════════════════════════
  // SOCIAL
  // ═══════════════════════════════════════════════════════════════

  social: {
    category: 'social',
    label: 'Social',
    description: 'World, community, messaging, events, and profile lenses. Heavy on presence and real-time collaboration.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensPresence', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensShortcuts', 'useLensAccessibility', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensWebhooks',
      'useLensAnalytics',
      'useLensRecommendations',
      'useLensCrossDomain', 'useLensFederation',
    ],
    defaultLayout: 'default',
    defaultExports: ['json', 'csv', 'ical', 'vcf'],
    defaultImports: ['json', 'csv', 'ical', 'vcf'],
    correlations: {
      creative: 0.70,
      knowledge: 0.55,
      lifestyle: 0.60,
      services: 0.45,
      productivity: 0.40,
      government: 0.25,
    },
    automationTriggers: [
      'on_message_received',
      'on_event_rsvp',
      'on_member_joined',
      'on_mention_detected',
      'on_community_milestone',
    ],
    aiFeatures: ['recommendations'],
    realtimeFeatures: ['socket', 'presence', 'notifications', 'sync'],
    analyticsLevel: 'standard',
    complianceRequirements: ['GDPR', 'CCPA', 'COPPA'],
  },

  // ═══════════════════════════════════════════════════════════════
  // PRODUCTIVITY
  // ═══════════════════════════════════════════════════════════════

  productivity: {
    category: 'productivity',
    label: 'Productivity',
    description: 'Tasks, calendars, email, projects, and time-tracking lenses. Strong automation and cross-domain linking.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensShortcuts', 'useLensAccessibility', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensWebhooks', 'useLensAPI', 'useLensAutomation',
      'useLensAnalytics', 'useLensMetrics',
      'useLensBrain', 'useLensRecommendations',
      'useLensCrossDomain',
    ],
    defaultLayout: 'split',
    defaultExports: ['json', 'csv', 'ical', 'pdf', 'xlsx'],
    defaultImports: ['json', 'csv', 'ical', 'xlsx'],
    correlations: {
      knowledge: 0.80,
      finance: 0.55,
      operations: 0.65,
      social: 0.40,
      services: 0.50,
      creative: 0.40,
      trades: 0.35,
    },
    automationTriggers: [
      'on_task_completed',
      'on_deadline_approaching',
      'on_assignment_changed',
      'on_project_milestone',
      'on_time_entry_logged',
      'on_recurring_due',
    ],
    aiFeatures: ['brain', 'recommendations'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'advanced',
    complianceRequirements: ['GDPR'],
  },

  // ═══════════════════════════════════════════════════════════════
  // FINANCE
  // ═══════════════════════════════════════════════════════════════

  finance: {
    category: 'finance',
    label: 'Finance',
    description: 'Accounting, invoicing, payroll, tax, and investment lenses. Strict audit trails and compliance.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensWebhooks', 'useLensAPI', 'useLensAutomation',
      'useLensAnalytics', 'useLensMetrics', 'useLensAudit', 'useLensHealth',
      'useLensBrain', 'useLensPredictions',
      'useLensCrossDomain',
    ],
    defaultLayout: 'split',
    defaultExports: ['json', 'csv', 'xlsx', 'pdf', 'ofx', 'iif', 'xml'],
    defaultImports: ['json', 'csv', 'xlsx', 'ofx', 'qfx', 'iif', 'xml'],
    correlations: {
      productivity: 0.55,
      operations: 0.60,
      government: 0.50,
      healthcare: 0.35,
      trades: 0.45,
      services: 0.55,
      agriculture: 0.30,
    },
    automationTriggers: [
      'on_invoice_created',
      'on_payment_received',
      'on_reconciliation_mismatch',
      'on_budget_threshold_exceeded',
      'on_tax_deadline_approaching',
      'on_expense_submitted',
      'on_payroll_processed',
    ],
    aiFeatures: ['brain', 'predictions'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'advanced',
    complianceRequirements: ['SOX', 'GAAP', 'PCI-DSS', 'GDPR', 'AML'],
  },

  // ═══════════════════════════════════════════════════════════════
  // HEALTHCARE
  // ═══════════════════════════════════════════════════════════════

  healthcare: {
    category: 'healthcare',
    label: 'Healthcare',
    description: 'Patient records, prescriptions, scheduling, labs, and billing lenses. Strict compliance and interoperability.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensAccessibility', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensWebhooks', 'useLensAPI', 'useLensAutomation',
      'useLensAnalytics', 'useLensMetrics', 'useLensAudit', 'useLensHealth',
      'useLensBrain', 'useLensRecommendations', 'useLensPredictions',
      'useLensCrossDomain',
    ],
    defaultLayout: 'split',
    defaultExports: ['json', 'csv', 'pdf', 'hl7', 'fhir', 'xml', 'xlsx'],
    defaultImports: ['json', 'csv', 'hl7', 'fhir', 'xml', 'xlsx'],
    correlations: {
      knowledge: 0.45,
      finance: 0.35,
      government: 0.55,
      operations: 0.40,
      services: 0.50,
      lifestyle: 0.30,
    },
    automationTriggers: [
      'on_patient_checked_in',
      'on_lab_result_received',
      'on_prescription_renewed',
      'on_appointment_reminder',
      'on_critical_value_flagged',
      'on_insurance_verified',
      'on_discharge_initiated',
      'on_referral_created',
    ],
    aiFeatures: ['brain', 'recommendations', 'predictions'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'advanced',
    complianceRequirements: ['HIPAA', 'HITECH', 'HL7', 'GDPR', 'FDA-21CFR11'],
  },

  // ═══════════════════════════════════════════════════════════════
  // TRADES
  // ═══════════════════════════════════════════════════════════════

  trades: {
    category: 'trades',
    label: 'Trades',
    description: 'Plumbing, electrical, HVAC, construction, and field-service lenses. Mobile-first with offline sync.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensAPI', 'useLensAutomation',
      'useLensAnalytics', 'useLensMetrics',
      'useLensRecommendations',
      'useLensCrossDomain',
    ],
    defaultLayout: 'minimal',
    defaultExports: ['json', 'csv', 'pdf', 'xlsx'],
    defaultImports: ['json', 'csv', 'xlsx'],
    correlations: {
      operations: 0.70,
      finance: 0.45,
      productivity: 0.35,
      services: 0.55,
      agriculture: 0.30,
    },
    automationTriggers: [
      'on_work_order_created',
      'on_job_dispatched',
      'on_inspection_completed',
      'on_parts_ordered',
      'on_permit_approved',
      'on_invoice_generated',
    ],
    aiFeatures: ['recommendations'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'standard',
    complianceRequirements: ['OSHA', 'NEC', 'IBC'],
  },

  // ═══════════════════════════════════════════════════════════════
  // OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  operations: {
    category: 'operations',
    label: 'Operations',
    description: 'Inventory, logistics, supply-chain, fleet, and warehouse lenses. Data-heavy with strong automation.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensWebhooks', 'useLensAPI', 'useLensAutomation',
      'useLensAnalytics', 'useLensMetrics', 'useLensAudit', 'useLensHealth',
      'useLensBrain', 'useLensPredictions',
      'useLensCrossDomain', 'useLensFederation',
    ],
    defaultLayout: 'default',
    defaultExports: ['json', 'csv', 'xlsx', 'pdf', 'edi', 'xml'],
    defaultImports: ['json', 'csv', 'xlsx', 'edi', 'xml'],
    correlations: {
      system: 0.85,
      finance: 0.60,
      trades: 0.70,
      agriculture: 0.55,
      productivity: 0.65,
      government: 0.35,
      services: 0.40,
    },
    automationTriggers: [
      'on_stock_below_threshold',
      'on_shipment_status_changed',
      'on_order_received',
      'on_quality_check_failed',
      'on_delivery_confirmed',
      'on_route_optimized',
      'on_vendor_sla_breach',
    ],
    aiFeatures: ['brain', 'predictions'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'advanced',
    complianceRequirements: ['ISO9001', 'ISO14001', 'GDPR'],
  },

  // ═══════════════════════════════════════════════════════════════
  // AGRICULTURE
  // ═══════════════════════════════════════════════════════════════

  agriculture: {
    category: 'agriculture',
    label: 'Agriculture',
    description: 'Crop planning, livestock, equipment, weather, and soil lenses. Geospatial data with seasonal automation.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensAPI', 'useLensAutomation',
      'useLensAnalytics', 'useLensMetrics',
      'useLensBrain', 'useLensPredictions',
      'useLensCrossDomain',
    ],
    defaultLayout: 'default',
    defaultExports: ['json', 'csv', 'xlsx', 'geojson', 'kml', 'pdf'],
    defaultImports: ['json', 'csv', 'xlsx', 'geojson', 'kml'],
    correlations: {
      operations: 0.55,
      finance: 0.30,
      government: 0.45,
      trades: 0.30,
      lifestyle: 0.25,
    },
    automationTriggers: [
      'on_weather_alert',
      'on_soil_moisture_threshold',
      'on_harvest_window_open',
      'on_livestock_health_flag',
      'on_equipment_maintenance_due',
      'on_yield_forecast_updated',
    ],
    aiFeatures: ['brain', 'predictions'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'standard',
    complianceRequirements: ['USDA-GAP', 'EPA', 'GLOBALG.A.P.'],
  },

  // ═══════════════════════════════════════════════════════════════
  // GOVERNMENT
  // ═══════════════════════════════════════════════════════════════

  government: {
    category: 'government',
    label: 'Government',
    description: 'Permits, licenses, compliance, case management, and public records lenses. Heavy audit and access controls.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensAccessibility', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensWebhooks', 'useLensAPI',
      'useLensAnalytics', 'useLensMetrics', 'useLensAudit', 'useLensHealth',
      'useLensBrain',
      'useLensCrossDomain', 'useLensFederation',
    ],
    defaultLayout: 'default',
    defaultExports: ['json', 'csv', 'xlsx', 'pdf', 'xml'],
    defaultImports: ['json', 'csv', 'xlsx', 'xml'],
    correlations: {
      healthcare: 0.55,
      finance: 0.50,
      knowledge: 0.50,
      system: 0.50,
      agriculture: 0.45,
      operations: 0.35,
      services: 0.40,
    },
    automationTriggers: [
      'on_permit_submitted',
      'on_review_period_expired',
      'on_compliance_violation',
      'on_public_comment_received',
      'on_case_status_changed',
      'on_foia_request_received',
    ],
    aiFeatures: ['brain'],
    realtimeFeatures: ['socket', 'notifications', 'sync'],
    analyticsLevel: 'advanced',
    complianceRequirements: ['FedRAMP', 'FISMA', 'Section508', 'FOIA', 'GDPR'],
  },

  // ═══════════════════════════════════════════════════════════════
  // SERVICES
  // ═══════════════════════════════════════════════════════════════

  services: {
    category: 'services',
    label: 'Services',
    description: 'CRM, booking, support tickets, client portals, and SLA lenses. Client-facing with strong notification and API integration.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensPresence', 'useLensNotifications', 'useLensSync',
      'useLensLayout', 'useLensTheme', 'useLensResponsive',
      'useLensImport', 'useLensExport', 'useLensWebhooks', 'useLensAPI', 'useLensAutomation',
      'useLensAnalytics', 'useLensMetrics', 'useLensAudit',
      'useLensBrain', 'useLensRecommendations',
      'useLensCrossDomain',
    ],
    defaultLayout: 'split',
    defaultExports: ['json', 'csv', 'xlsx', 'pdf', 'vcf'],
    defaultImports: ['json', 'csv', 'xlsx', 'vcf'],
    correlations: {
      productivity: 0.50,
      finance: 0.55,
      trades: 0.55,
      social: 0.45,
      healthcare: 0.50,
      operations: 0.40,
    },
    automationTriggers: [
      'on_ticket_created',
      'on_sla_breach_imminent',
      'on_client_feedback_received',
      'on_booking_confirmed',
      'on_contract_renewal_due',
      'on_lead_qualified',
      'on_escalation_triggered',
    ],
    aiFeatures: ['brain', 'recommendations'],
    realtimeFeatures: ['socket', 'presence', 'notifications', 'sync'],
    analyticsLevel: 'advanced',
    complianceRequirements: ['GDPR', 'CCPA', 'SOC2'],
  },

  // ═══════════════════════════════════════════════════════════════
  // LIFESTYLE
  // ═══════════════════════════════════════════════════════════════

  lifestyle: {
    category: 'lifestyle',
    label: 'Lifestyle',
    description: 'Fitness, nutrition, travel, hobbies, and personal-finance lenses. Consumer-friendly with recommendations.',
    enabledHooks: [
      'useLensData', 'useLensQuery', 'useLensMutations', 'useLensDTUs',
      'useLensSearch', 'useLensFilters',
      'useLensSocket', 'useLensNotifications',
      'useLensLayout', 'useLensTheme', 'useLensShortcuts', 'useLensAccessibility', 'useLensResponsive',
      'useLensImport', 'useLensExport',
      'useLensAnalytics',
      'useLensBrain', 'useLensRecommendations', 'useLensPredictions',
      'useLensCrossDomain',
    ],
    defaultLayout: 'default',
    defaultExports: ['json', 'csv', 'pdf', 'ical'],
    defaultImports: ['json', 'csv', 'ical'],
    correlations: {
      social: 0.60,
      healthcare: 0.30,
      creative: 0.50,
      knowledge: 0.35,
      services: 0.40,
    },
    automationTriggers: [
      'on_goal_milestone_reached',
      'on_streak_broken',
      'on_daily_reminder',
      'on_nutrition_target_exceeded',
      'on_trip_itinerary_changed',
    ],
    aiFeatures: ['brain', 'recommendations', 'predictions'],
    realtimeFeatures: ['socket', 'notifications'],
    analyticsLevel: 'basic',
    complianceRequirements: ['GDPR', 'CCPA'],
  },
};

// ── Lookup Functions ──────────────────────────────────────────────

/**
 * Retrieve the wiring profile for a given category.
 * Throws if the category is unknown.
 */
export function getWiringProfile(category: string): WiringProfile {
  const profile = WIRING_PROFILES[category];
  if (!profile) {
    throw new Error(
      `Unknown wiring-profile category "${category}". ` +
      `Valid categories: ${Object.keys(WIRING_PROFILES).join(', ')}`,
    );
  }
  return profile;
}

/**
 * Return the enabled hooks for a specific lens, identified by its
 * domain name and category. Currently this returns the category-level
 * hooks directly; future versions may apply per-domain overrides.
 */
export function getEnabledHooksForDomain(domain: string, category: string): string[] {
  const profile = getWiringProfile(category);
  // Reserved for future per-domain overrides keyed by `domain`
  void domain;
  return profile.enabledHooks;
}

/**
 * Return a 0-1 score indicating what fraction of the 30 universal hooks
 * are enabled for the given category.
 */
export function getCategoryIntegrationScore(category: string): number {
  const profile = getWiringProfile(category);
  return profile.enabledHooks.length / ALL_HOOK_NAMES.length;
}
