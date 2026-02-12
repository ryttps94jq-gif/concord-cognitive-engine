/**
 * Automation Bindings - Per-lens trigger-to-macro mappings,
 * import/export format declarations, and domain RBAC policies.
 *
 * Dimensions 3, 4, and 5 of competitor parity:
 *   3. Import/Export Parity - what formats each lens ingests/exports
 *   4. Automation Layer - which events trigger which macros
 *   5. Multi-User Controls - domain-specific RBAC overrides
 *
 * These bind into the existing infrastructure:
 *   - server/emergent/public-api.js (webhook events)
 *   - server.js macro registry (registerLensAction)
 *   - server/emergent/rbac.js (role/permission system)
 */

// ── Import/Export Format Declarations ──────────────────────────

export type ImportFormat = 'csv' | 'json' | 'xml' | 'hl7' | 'fhir' | 'edi' | 'iif' | 'ofx' | 'qfx' | 'xlsx' | 'geojson' | 'kml' | 'ical' | 'vcf';
export type ExportFormat = 'csv' | 'json' | 'xml' | 'pdf' | 'hl7' | 'fhir' | 'edi' | 'iif' | 'ofx' | 'xlsx' | 'geojson' | 'kml' | 'ical' | 'docx' | 'markdown';

export interface ImportExportProfile {
  domain: string;
  imports: {
    format: ImportFormat;
    /** Which entity this maps to */
    entity: string;
    /** Example: "Drag a CSV of patients to import" */
    hint: string;
  }[];
  exports: {
    format: ExportFormat;
    entity: string;
    hint: string;
  }[];
  /** Industry-standard API surface this lens can interop with */
  apiCompat?: string[];
  /** Webhook events this lens emits */
  webhookEvents: string[];
}

// ── Automation Trigger Definitions ─────────────────────────────

export interface AutomationTrigger {
  /** The event that fires (from webhook event system) */
  event: string;
  /** Human-readable description */
  label: string;
  /** The macro to execute (domain.action format) */
  macro: string;
  /** Condition expression (evaluated at runtime) */
  condition?: string;
  /** Whether this is enabled by default */
  defaultEnabled: boolean;
}

export interface AutomationProfile {
  domain: string;
  triggers: AutomationTrigger[];
}

// ── Domain RBAC Policy ─────────────────────────────────────────

export interface DomainPermission {
  action: string;
  label: string;
  /** Minimum role that can perform this action */
  minRole: 'viewer' | 'reviewer' | 'editor' | 'admin' | 'owner';
  /** Whether this permission can be delegated */
  delegable?: boolean;
}

export interface DomainRBACProfile {
  domain: string;
  /** Domain-specific permissions beyond the base RBAC set */
  permissions: DomainPermission[];
  /** Whether this lens supports shared artifacts */
  sharedArtifacts: boolean;
  /** Whether this lens has an activity feed */
  activityFeed: boolean;
}

// ═══════════════════════════════════════════════════════════════
// IMPORT/EXPORT PROFILES
// ═══════════════════════════════════════════════════════════════

export const IMPORT_EXPORT_PROFILES: ImportExportProfile[] = [
  {
    domain: 'healthcare',
    imports: [
      { format: 'csv', entity: 'Patient', hint: 'Import patient roster as CSV' },
      { format: 'hl7', entity: 'Encounter', hint: 'Import HL7 ADT messages' },
      { format: 'fhir', entity: 'Patient', hint: 'Import FHIR Patient bundle' },
      { format: 'fhir', entity: 'Encounter', hint: 'Import FHIR Encounter bundle' },
      { format: 'json', entity: 'Prescription', hint: 'Import prescription records' },
    ],
    exports: [
      { format: 'fhir', entity: 'Patient', hint: 'Export as FHIR Patient resource' },
      { format: 'fhir', entity: 'Encounter', hint: 'Export as FHIR Encounter resource' },
      { format: 'csv', entity: 'Patient', hint: 'Export patient list as CSV' },
      { format: 'hl7', entity: 'Encounter', hint: 'Export as HL7 message' },
      { format: 'pdf', entity: 'Encounter', hint: 'Export encounter summary as PDF' },
    ],
    apiCompat: ['FHIR R4', 'HL7v2', 'CDA'],
    webhookEvents: ['encounter.created', 'encounter.completed', 'prescription.created', 'prescription.discontinued', 'patient.updated'],
  },

  {
    domain: 'legal',
    imports: [
      { format: 'csv', entity: 'Case', hint: 'Import case list from CSV' },
      { format: 'json', entity: 'Contract', hint: 'Import contracts as JSON' },
      { format: 'xml', entity: 'Filing', hint: 'Import filings from LegalXML' },
    ],
    exports: [
      { format: 'pdf', entity: 'Contract', hint: 'Export contract as PDF' },
      { format: 'docx', entity: 'Filing', hint: 'Export filing as Word document' },
      { format: 'csv', entity: 'Case', hint: 'Export case list as CSV' },
      { format: 'json', entity: 'Case', hint: 'Export case data as JSON' },
    ],
    apiCompat: ['SALI/LMSS', 'LegalXML'],
    webhookEvents: ['case.status_changed', 'contract.executed', 'contract.expired', 'filing.filed', 'case.deadline_approaching'],
  },

  {
    domain: 'accounting',
    imports: [
      { format: 'csv', entity: 'Transaction', hint: 'Import bank transactions as CSV' },
      { format: 'ofx', entity: 'Transaction', hint: 'Import OFX bank feed' },
      { format: 'qfx', entity: 'Transaction', hint: 'Import Quicken QFX data' },
      { format: 'iif', entity: 'Account', hint: 'Import QuickBooks IIF file' },
      { format: 'json', entity: 'Invoice', hint: 'Import invoices from JSON' },
    ],
    exports: [
      { format: 'csv', entity: 'Transaction', hint: 'Export transactions as CSV' },
      { format: 'iif', entity: 'Account', hint: 'Export as QuickBooks IIF' },
      { format: 'pdf', entity: 'Invoice', hint: 'Export invoice as PDF' },
      { format: 'xlsx', entity: 'Transaction', hint: 'Export ledger as Excel' },
      { format: 'json', entity: 'Account', hint: 'Export chart of accounts' },
    ],
    apiCompat: ['OFX', 'QFX', 'IIF', 'xBRL'],
    webhookEvents: ['invoice.sent', 'invoice.paid', 'invoice.overdue', 'transaction.reconciled', 'account.balance_changed'],
  },

  {
    domain: 'security',
    imports: [
      { format: 'json', entity: 'Incident', hint: 'Import SIEM incidents as JSON' },
      { format: 'csv', entity: 'Threat', hint: 'Import threat intelligence CSV' },
      { format: 'xml', entity: 'Incident', hint: 'Import STIX/TAXII feed' },
    ],
    exports: [
      { format: 'json', entity: 'Incident', hint: 'Export incident report as JSON' },
      { format: 'csv', entity: 'Incident', hint: 'Export incident log as CSV' },
      { format: 'pdf', entity: 'Incident', hint: 'Export post-mortem as PDF' },
    ],
    apiCompat: ['STIX', 'TAXII', 'CEF', 'MITRE ATT&CK'],
    webhookEvents: ['incident.reported', 'incident.escalated', 'incident.contained', 'incident.closed', 'threat.level_changed'],
  },

  {
    domain: 'manufacturing',
    imports: [
      { format: 'csv', entity: 'WorkOrder', hint: 'Import work orders from CSV' },
      { format: 'json', entity: 'BOM', hint: 'Import bill of materials' },
      { format: 'xml', entity: 'BOM', hint: 'Import BOM from ERP (XML)' },
    ],
    exports: [
      { format: 'csv', entity: 'WorkOrder', hint: 'Export work orders as CSV' },
      { format: 'pdf', entity: 'QCInspection', hint: 'Export QC report as PDF' },
      { format: 'json', entity: 'BOM', hint: 'Export BOM as JSON' },
      { format: 'xlsx', entity: 'WorkOrder', hint: 'Export production schedule' },
    ],
    apiCompat: ['ISA-95', 'OPC-UA', 'MTConnect'],
    webhookEvents: ['workorder.started', 'workorder.completed', 'qc.passed', 'qc.failed', 'bom.approved'],
  },

  {
    domain: 'education',
    imports: [
      { format: 'csv', entity: 'Student', hint: 'Import student roster from CSV' },
      { format: 'csv', entity: 'Course', hint: 'Import course catalog' },
      { format: 'json', entity: 'Assignment', hint: 'Import assignments from LMS JSON' },
    ],
    exports: [
      { format: 'csv', entity: 'Student', hint: 'Export student list as CSV' },
      { format: 'pdf', entity: 'Student', hint: 'Export transcript as PDF' },
      { format: 'json', entity: 'Course', hint: 'Export course data as JSON' },
    ],
    apiCompat: ['LTI 1.3', 'xAPI', 'SCORM', 'Caliper'],
    webhookEvents: ['student.enrolled', 'student.graduated', 'assignment.graded', 'course.completed'],
  },

  {
    domain: 'retail',
    imports: [
      { format: 'csv', entity: 'Product', hint: 'Import product catalog from CSV' },
      { format: 'json', entity: 'Order', hint: 'Import orders from JSON' },
      { format: 'csv', entity: 'Customer', hint: 'Import customer list' },
      { format: 'xlsx', entity: 'Product', hint: 'Import inventory from Excel' },
    ],
    exports: [
      { format: 'csv', entity: 'Product', hint: 'Export product catalog' },
      { format: 'csv', entity: 'Order', hint: 'Export orders as CSV' },
      { format: 'json', entity: 'Order', hint: 'Export orders as JSON' },
      { format: 'pdf', entity: 'Order', hint: 'Export order receipt' },
    ],
    apiCompat: ['Shopify API', 'WooCommerce', 'Square'],
    webhookEvents: ['order.placed', 'order.shipped', 'order.delivered', 'product.low_stock', 'customer.tier_changed'],
  },

  {
    domain: 'government',
    imports: [
      { format: 'csv', entity: 'Permit', hint: 'Import permit applications from CSV' },
      { format: 'json', entity: 'Violation', hint: 'Import violations from JSON' },
      { format: 'xml', entity: 'Permit', hint: 'Import permits from e-Gov XML' },
    ],
    exports: [
      { format: 'csv', entity: 'Permit', hint: 'Export permit log as CSV' },
      { format: 'pdf', entity: 'Permit', hint: 'Export permit certificate' },
      { format: 'json', entity: 'Violation', hint: 'Export violations as JSON' },
    ],
    apiCompat: ['NIEM', 'Open311'],
    webhookEvents: ['permit.submitted', 'permit.approved', 'permit.denied', 'violation.reported', 'violation.remediated'],
  },

  {
    domain: 'realestate',
    imports: [
      { format: 'csv', entity: 'Listing', hint: 'Import listings from CSV' },
      { format: 'xml', entity: 'Listing', hint: 'Import RETS/RESO feed' },
      { format: 'json', entity: 'Listing', hint: 'Import from MLS JSON' },
    ],
    exports: [
      { format: 'csv', entity: 'Listing', hint: 'Export listings as CSV' },
      { format: 'pdf', entity: 'Listing', hint: 'Export listing sheet' },
      { format: 'json', entity: 'Listing', hint: 'Export as RESO Web API' },
    ],
    apiCompat: ['RESO Web API', 'RETS', 'IDX'],
    webhookEvents: ['listing.published', 'listing.price_changed', 'listing.under_contract', 'listing.sold'],
  },

  {
    domain: 'insurance',
    imports: [
      { format: 'csv', entity: 'Claim', hint: 'Import claims from CSV' },
      { format: 'edi', entity: 'Claim', hint: 'Import EDI 837 claims' },
      { format: 'json', entity: 'Claim', hint: 'Import claims from JSON' },
    ],
    exports: [
      { format: 'edi', entity: 'Claim', hint: 'Export as EDI 835 remittance' },
      { format: 'csv', entity: 'Claim', hint: 'Export claims log' },
      { format: 'pdf', entity: 'Claim', hint: 'Export claim summary' },
    ],
    apiCompat: ['EDI 837/835', 'ACORD'],
    webhookEvents: ['claim.filed', 'claim.approved', 'claim.denied', 'claim.paid'],
  },

  {
    domain: 'logistics',
    imports: [
      { format: 'csv', entity: 'Shipment', hint: 'Import shipments from CSV' },
      { format: 'edi', entity: 'Shipment', hint: 'Import EDI 856 ASN' },
      { format: 'json', entity: 'Shipment', hint: 'Import shipments from JSON' },
    ],
    exports: [
      { format: 'csv', entity: 'Shipment', hint: 'Export shipment log' },
      { format: 'edi', entity: 'Shipment', hint: 'Export EDI 856 ASN' },
      { format: 'json', entity: 'Shipment', hint: 'Export tracking data' },
    ],
    apiCompat: ['EDI 856', 'GS1'],
    webhookEvents: ['shipment.dispatched', 'shipment.delivered', 'shipment.exception'],
  },

  {
    domain: 'agriculture',
    imports: [
      { format: 'csv', entity: 'CropCycle', hint: 'Import field/crop data from CSV' },
      { format: 'geojson', entity: 'CropCycle', hint: 'Import field boundaries as GeoJSON' },
      { format: 'json', entity: 'CropCycle', hint: 'Import sensor data as JSON' },
    ],
    exports: [
      { format: 'csv', entity: 'CropCycle', hint: 'Export crop records' },
      { format: 'geojson', entity: 'CropCycle', hint: 'Export field map as GeoJSON' },
      { format: 'pdf', entity: 'CropCycle', hint: 'Export season report' },
    ],
    apiCompat: ['AgGateway ADAPT', 'ISO 11783'],
    webhookEvents: ['crop.planted', 'crop.harvested', 'sensor.alert'],
  },

  {
    domain: 'events',
    imports: [
      { format: 'csv', entity: 'Event', hint: 'Import event list from CSV' },
      { format: 'ical', entity: 'Event', hint: 'Import events from iCal' },
      { format: 'json', entity: 'Event', hint: 'Import events from JSON' },
    ],
    exports: [
      { format: 'ical', entity: 'Event', hint: 'Export as iCal' },
      { format: 'csv', entity: 'Event', hint: 'Export event list' },
      { format: 'pdf', entity: 'Event', hint: 'Export event program' },
    ],
    apiCompat: ['iCal/ICS', 'Schema.org Event'],
    webhookEvents: ['event.announced', 'event.registration_open', 'event.sold_out', 'event.completed'],
  },

  {
    domain: 'nonprofit',
    imports: [
      { format: 'csv', entity: 'Grant', hint: 'Import donor/grant list' },
      { format: 'json', entity: 'Grant', hint: 'Import grant data' },
    ],
    exports: [
      { format: 'csv', entity: 'Grant', hint: 'Export grant tracker' },
      { format: 'pdf', entity: 'Grant', hint: 'Export grant report' },
      { format: 'xlsx', entity: 'Grant', hint: 'Export financials for board' },
    ],
    apiCompat: ['GuideStar API', 'Candid'],
    webhookEvents: ['grant.awarded', 'grant.closed', 'donation.received'],
  },

  {
    domain: 'aviation',
    imports: [
      { format: 'csv', entity: 'Flight', hint: 'Import flight schedule' },
      { format: 'json', entity: 'Flight', hint: 'Import flight data' },
    ],
    exports: [
      { format: 'csv', entity: 'Flight', hint: 'Export flight log' },
      { format: 'pdf', entity: 'Flight', hint: 'Export flight report' },
      { format: 'json', entity: 'Flight', hint: 'Export for FAA/EASA' },
    ],
    apiCompat: ['ARINC 424', 'SWIM', 'FIXM'],
    webhookEvents: ['flight.departed', 'flight.landed', 'flight.cancelled', 'maintenance.due'],
  },

  {
    domain: 'fitness',
    imports: [
      { format: 'csv', entity: 'Program', hint: 'Import workout programs' },
      { format: 'json', entity: 'Program', hint: 'Import training data' },
    ],
    exports: [
      { format: 'csv', entity: 'Program', hint: 'Export training log' },
      { format: 'pdf', entity: 'Program', hint: 'Export program summary' },
      { format: 'json', entity: 'Program', hint: 'Export workout data' },
    ],
    apiCompat: ['Apple HealthKit', 'Google Fit', 'FIT Protocol'],
    webhookEvents: ['program.started', 'program.completed', 'goal.achieved'],
  },

  // ── Core lenses ──────────────────────────────────────────────

  {
    domain: 'paper',
    imports: [
      { format: 'json', entity: 'project', hint: 'Import research project data' },
      { format: 'csv', entity: 'claim', hint: 'Import claims from CSV' },
    ],
    exports: [
      { format: 'markdown', entity: 'project', hint: 'Export paper as Markdown' },
      { format: 'pdf', entity: 'project', hint: 'Export paper as PDF' },
      { format: 'json', entity: 'project', hint: 'Export project data' },
    ],
    webhookEvents: ['paper.published', 'claim.verified', 'claim.contradicted'],
  },

  {
    domain: 'code',
    imports: [
      { format: 'json', entity: 'project', hint: 'Import project metadata' },
      { format: 'json', entity: 'snippet', hint: 'Import code snippets' },
    ],
    exports: [
      { format: 'json', entity: 'project', hint: 'Export project data' },
      { format: 'markdown', entity: 'snippet', hint: 'Export snippets as Markdown' },
    ],
    webhookEvents: ['review.approved', 'review.merged', 'snippet.created'],
  },

  {
    domain: 'graph',
    imports: [
      { format: 'json', entity: 'entity', hint: 'Import knowledge graph nodes' },
      { format: 'csv', entity: 'relation', hint: 'Import edges from CSV' },
    ],
    exports: [
      { format: 'json', entity: 'entity', hint: 'Export graph as JSON-LD' },
      { format: 'csv', entity: 'relation', hint: 'Export edge list as CSV' },
    ],
    webhookEvents: ['entity.created', 'relation.created', 'graph.merged'],
  },
];

// ═══════════════════════════════════════════════════════════════
// AUTOMATION PROFILES
// ═══════════════════════════════════════════════════════════════

export const AUTOMATION_PROFILES: AutomationProfile[] = [
  {
    domain: 'healthcare',
    triggers: [
      { event: 'encounter.completed', label: 'Auto-generate billing codes on encounter completion', macro: 'healthcare.generateBillingCodes', defaultEnabled: true },
      { event: 'prescription.created', label: 'Check drug interactions on new prescription', macro: 'healthcare.drugInteractionCheck', defaultEnabled: true },
      { event: 'patient.updated', label: 'Flag incomplete patient records', macro: 'healthcare.validatePatientRecord', condition: 'missingRequiredFields', defaultEnabled: false },
      { event: 'encounter.completed', label: 'Auto-send follow-up reminder', macro: 'healthcare.scheduleFollowUp', condition: 'requiresFollowUp', defaultEnabled: false },
    ],
  },
  {
    domain: 'legal',
    triggers: [
      { event: 'case.deadline_approaching', label: 'Alert on approaching deadlines (7 days)', macro: 'legal.deadlineAlert', condition: 'daysUntilDeadline <= 7', defaultEnabled: true },
      { event: 'contract.expired', label: 'Notify on contract expiration', macro: 'legal.contractExpirationNotice', defaultEnabled: true },
      { event: 'contract.executed', label: 'Auto-generate contract summary', macro: 'legal.generateContractSummary', defaultEnabled: false },
      { event: 'case.status_changed', label: 'Log status change to audit trail', macro: 'legal.auditStatusChange', defaultEnabled: true },
    ],
  },
  {
    domain: 'accounting',
    triggers: [
      { event: 'invoice.overdue', label: 'Auto-send payment reminder', macro: 'accounting.sendPaymentReminder', defaultEnabled: true },
      { event: 'transaction.reconciled', label: 'Update running balance on reconciliation', macro: 'accounting.updateBalance', defaultEnabled: true },
      { event: 'invoice.paid', label: 'Auto-reconcile matching transactions', macro: 'accounting.autoReconcile', defaultEnabled: false },
      { event: 'account.balance_changed', label: 'Alert on unusual balance changes', macro: 'accounting.anomalyDetection', condition: 'changePercent > 20', defaultEnabled: false },
    ],
  },
  {
    domain: 'security',
    triggers: [
      { event: 'incident.reported', label: 'Auto-triage based on severity', macro: 'security.autoTriage', defaultEnabled: true },
      { event: 'incident.escalated', label: 'Notify security team on escalation', macro: 'security.escalationNotify', defaultEnabled: true },
      { event: 'threat.level_changed', label: 'Update threat dashboard', macro: 'security.updateThreatBoard', defaultEnabled: true },
      { event: 'incident.closed', label: 'Generate post-mortem template', macro: 'security.generatePostMortem', defaultEnabled: false },
    ],
  },
  {
    domain: 'manufacturing',
    triggers: [
      { event: 'qc.failed', label: 'Auto-create rework order on QC failure', macro: 'manufacturing.createRework', defaultEnabled: true },
      { event: 'workorder.completed', label: 'Update inventory on work order completion', macro: 'manufacturing.updateInventory', defaultEnabled: true },
      { event: 'bom.approved', label: 'Calculate total cost on BOM approval', macro: 'manufacturing.calculateBOMCost', defaultEnabled: true },
      { event: 'workorder.started', label: 'Reserve materials from inventory', macro: 'manufacturing.reserveMaterials', defaultEnabled: false },
    ],
  },
  {
    domain: 'education',
    triggers: [
      { event: 'assignment.graded', label: 'Auto-update GPA on grade entry', macro: 'education.gradeCalculation', defaultEnabled: true },
      { event: 'student.enrolled', label: 'Check schedule conflicts on enrollment', macro: 'education.scheduleConflict', defaultEnabled: true },
      { event: 'course.completed', label: 'Update progress tracking', macro: 'education.progressTrack', defaultEnabled: true },
    ],
  },
  {
    domain: 'retail',
    triggers: [
      { event: 'product.low_stock', label: 'Auto-create reorder when below reorder point', macro: 'retail.autoReorder', condition: 'quantity <= reorderPoint', defaultEnabled: false },
      { event: 'order.placed', label: 'Validate inventory availability', macro: 'retail.validateInventory', defaultEnabled: true },
      { event: 'order.delivered', label: 'Update customer lifetime value', macro: 'retail.updateCustomerLTV', defaultEnabled: true },
      { event: 'customer.tier_changed', label: 'Notify customer of tier change', macro: 'retail.tierChangeNotify', defaultEnabled: false },
    ],
  },
  {
    domain: 'government',
    triggers: [
      { event: 'permit.submitted', label: 'Auto-assign reviewer on submission', macro: 'government.assignReviewer', defaultEnabled: true },
      { event: 'permit.approved', label: 'Generate permit certificate', macro: 'government.generateCertificate', defaultEnabled: true },
      { event: 'violation.reported', label: 'Auto-classify violation severity', macro: 'government.classifyViolation', defaultEnabled: false },
    ],
  },
  {
    domain: 'logistics',
    triggers: [
      { event: 'shipment.exception', label: 'Alert operations on shipment exception', macro: 'logistics.exceptionAlert', defaultEnabled: true },
      { event: 'shipment.delivered', label: 'Auto-close shipment and update tracking', macro: 'logistics.closeShipment', defaultEnabled: true },
      { event: 'shipment.dispatched', label: 'Send tracking notification', macro: 'logistics.sendTrackingNotification', defaultEnabled: false },
    ],
  },
  {
    domain: 'realestate',
    triggers: [
      { event: 'listing.price_changed', label: 'Notify watchers on price change', macro: 'realestate.priceChangeNotify', defaultEnabled: true },
      { event: 'listing.sold', label: 'Generate closing documents', macro: 'realestate.generateClosingDocs', defaultEnabled: false },
    ],
  },
  {
    domain: 'insurance',
    triggers: [
      { event: 'claim.filed', label: 'Auto-assign adjuster', macro: 'insurance.assignAdjuster', defaultEnabled: true },
      { event: 'claim.approved', label: 'Calculate payout amount', macro: 'insurance.calculatePayout', defaultEnabled: true },
      { event: 'claim.filed', label: 'Flag potential fraud indicators', macro: 'insurance.fraudScreen', condition: 'claimAmount > threshold', defaultEnabled: false },
    ],
  },
  {
    domain: 'nonprofit',
    triggers: [
      { event: 'donation.received', label: 'Auto-generate thank you receipt', macro: 'nonprofit.generateReceipt', defaultEnabled: true },
      { event: 'grant.closed', label: 'Generate final grant report', macro: 'nonprofit.generateGrantReport', defaultEnabled: false },
    ],
  },
  {
    domain: 'events',
    triggers: [
      { event: 'event.registration_open', label: 'Send registration notification', macro: 'events.registrationNotify', defaultEnabled: true },
      { event: 'event.sold_out', label: 'Enable waitlist', macro: 'events.enableWaitlist', defaultEnabled: false },
      { event: 'event.completed', label: 'Send feedback survey', macro: 'events.sendFeedbackSurvey', defaultEnabled: false },
    ],
  },
  {
    domain: 'agriculture',
    triggers: [
      { event: 'sensor.alert', label: 'Alert on sensor threshold breach', macro: 'agriculture.sensorAlert', defaultEnabled: true },
      { event: 'crop.harvested', label: 'Calculate yield metrics', macro: 'agriculture.yieldAnalysis', defaultEnabled: true },
    ],
  },
  {
    domain: 'aviation',
    triggers: [
      { event: 'flight.cancelled', label: 'Notify passengers on cancellation', macro: 'aviation.cancellationNotify', defaultEnabled: true },
      { event: 'maintenance.due', label: 'Create maintenance work order', macro: 'aviation.createMaintenanceOrder', defaultEnabled: true },
    ],
  },
  {
    domain: 'fitness',
    triggers: [
      { event: 'goal.achieved', label: 'Congratulate on goal achievement', macro: 'fitness.goalAchievedNotify', defaultEnabled: false },
      { event: 'program.completed', label: 'Generate progress report', macro: 'fitness.progressReport', defaultEnabled: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// DOMAIN RBAC PROFILES
// ═══════════════════════════════════════════════════════════════

export const DOMAIN_RBAC_PROFILES: DomainRBACProfile[] = [
  {
    domain: 'healthcare',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_patient', label: 'View patient records', minRole: 'viewer' },
      { action: 'edit_patient', label: 'Edit patient records', minRole: 'editor' },
      { action: 'prescribe', label: 'Create prescriptions', minRole: 'editor' },
      { action: 'sign_off', label: 'Sign off on encounters', minRole: 'admin' },
      { action: 'view_billing', label: 'View billing data', minRole: 'reviewer' },
      { action: 'export_phi', label: 'Export protected health information', minRole: 'admin', delegable: false },
    ],
  },
  {
    domain: 'legal',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_case', label: 'View case files', minRole: 'viewer' },
      { action: 'edit_case', label: 'Edit case details', minRole: 'editor' },
      { action: 'manage_contracts', label: 'Manage contracts', minRole: 'editor' },
      { action: 'file_document', label: 'File court documents', minRole: 'admin' },
      { action: 'settle_case', label: 'Approve settlements', minRole: 'admin', delegable: false },
      { action: 'view_privileged', label: 'View privileged documents', minRole: 'admin', delegable: false },
    ],
  },
  {
    domain: 'accounting',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_accounts', label: 'View chart of accounts', minRole: 'viewer' },
      { action: 'create_transaction', label: 'Create transactions', minRole: 'editor' },
      { action: 'reconcile', label: 'Reconcile accounts', minRole: 'editor' },
      { action: 'approve_invoice', label: 'Approve invoices', minRole: 'admin' },
      { action: 'close_period', label: 'Close accounting period', minRole: 'admin', delegable: false },
      { action: 'export_financials', label: 'Export financial reports', minRole: 'admin' },
    ],
  },
  {
    domain: 'security',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_incidents', label: 'View security incidents', minRole: 'viewer' },
      { action: 'report_incident', label: 'Report incidents', minRole: 'editor' },
      { action: 'manage_incident', label: 'Manage incident lifecycle', minRole: 'editor' },
      { action: 'close_incident', label: 'Close incidents', minRole: 'admin' },
      { action: 'view_threat_intel', label: 'View threat intelligence', minRole: 'reviewer', delegable: false },
    ],
  },
  {
    domain: 'manufacturing',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_orders', label: 'View work orders', minRole: 'viewer' },
      { action: 'manage_orders', label: 'Manage work orders', minRole: 'editor' },
      { action: 'approve_bom', label: 'Approve BOMs', minRole: 'admin' },
      { action: 'perform_qc', label: 'Perform quality checks', minRole: 'reviewer' },
      { action: 'ship', label: 'Authorize shipment', minRole: 'admin' },
    ],
  },
  {
    domain: 'education',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_students', label: 'View student records', minRole: 'viewer' },
      { action: 'grade', label: 'Enter grades', minRole: 'editor' },
      { action: 'manage_enrollment', label: 'Manage enrollment', minRole: 'admin' },
      { action: 'graduate', label: 'Approve graduation', minRole: 'admin', delegable: false },
    ],
  },
  {
    domain: 'retail',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_catalog', label: 'View product catalog', minRole: 'viewer' },
      { action: 'manage_products', label: 'Manage products', minRole: 'editor' },
      { action: 'process_orders', label: 'Process orders', minRole: 'editor' },
      { action: 'issue_refund', label: 'Issue refunds', minRole: 'admin' },
      { action: 'manage_pricing', label: 'Manage pricing', minRole: 'admin', delegable: true },
    ],
  },
  {
    domain: 'government',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_permits', label: 'View permits', minRole: 'viewer' },
      { action: 'review_permits', label: 'Review permit applications', minRole: 'reviewer' },
      { action: 'approve_permits', label: 'Approve/deny permits', minRole: 'admin' },
      { action: 'issue_violations', label: 'Issue violations', minRole: 'admin' },
      { action: 'revoke_permits', label: 'Revoke permits', minRole: 'owner', delegable: false },
    ],
  },
  {
    domain: 'realestate',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_listings', label: 'View listings', minRole: 'viewer' },
      { action: 'manage_listings', label: 'Manage listings', minRole: 'editor' },
      { action: 'close_sale', label: 'Close sales', minRole: 'admin' },
    ],
  },
  {
    domain: 'insurance',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_claims', label: 'View claims', minRole: 'viewer' },
      { action: 'file_claim', label: 'File claims', minRole: 'editor' },
      { action: 'adjudicate', label: 'Adjudicate claims', minRole: 'admin' },
      { action: 'authorize_payment', label: 'Authorize payments', minRole: 'admin', delegable: false },
    ],
  },
  {
    domain: 'logistics',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_shipments', label: 'View shipments', minRole: 'viewer' },
      { action: 'manage_shipments', label: 'Manage shipments', minRole: 'editor' },
      { action: 'resolve_exceptions', label: 'Resolve exceptions', minRole: 'admin' },
    ],
  },
  {
    domain: 'nonprofit',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_grants', label: 'View grant records', minRole: 'viewer' },
      { action: 'manage_grants', label: 'Manage grants', minRole: 'editor' },
      { action: 'submit_applications', label: 'Submit grant applications', minRole: 'admin' },
    ],
  },
  {
    domain: 'events',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_events', label: 'View events', minRole: 'viewer' },
      { action: 'manage_events', label: 'Manage events', minRole: 'editor' },
      { action: 'cancel_events', label: 'Cancel events', minRole: 'owner' },
    ],
  },
  {
    domain: 'agriculture',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_fields', label: 'View field data', minRole: 'viewer' },
      { action: 'manage_crops', label: 'Manage crop cycles', minRole: 'editor' },
      { action: 'record_harvest', label: 'Record harvest data', minRole: 'editor' },
    ],
  },
  {
    domain: 'aviation',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_flights', label: 'View flight schedule', minRole: 'viewer' },
      { action: 'manage_flights', label: 'Manage flights', minRole: 'editor' },
      { action: 'clear_preflight', label: 'Clear preflight checks', minRole: 'editor' },
      { action: 'cancel_flight', label: 'Cancel flights', minRole: 'admin', delegable: false },
    ],
  },
  {
    domain: 'fitness',
    sharedArtifacts: false,
    activityFeed: true,
    permissions: [
      { action: 'view_programs', label: 'View programs', minRole: 'viewer' },
      { action: 'manage_programs', label: 'Manage programs', minRole: 'editor' },
    ],
  },

  // ── Core lenses ──────────────────────────────────────────────

  {
    domain: 'paper',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_papers', label: 'View papers', minRole: 'viewer' },
      { action: 'edit_papers', label: 'Edit papers', minRole: 'editor' },
      { action: 'publish', label: 'Publish papers', minRole: 'admin' },
      { action: 'retract', label: 'Retract claims', minRole: 'admin', delegable: false },
    ],
  },
  {
    domain: 'code',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_code', label: 'View code', minRole: 'viewer' },
      { action: 'edit_code', label: 'Edit code', minRole: 'editor' },
      { action: 'approve_review', label: 'Approve reviews', minRole: 'reviewer' },
      { action: 'merge', label: 'Merge code', minRole: 'admin' },
    ],
  },
  {
    domain: 'graph',
    sharedArtifacts: true,
    activityFeed: true,
    permissions: [
      { action: 'view_graph', label: 'View knowledge graph', minRole: 'viewer' },
      { action: 'edit_entities', label: 'Edit entities and relations', minRole: 'editor' },
      { action: 'merge_graphs', label: 'Merge graph fragments', minRole: 'admin' },
    ],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────

const _importExportMap = new Map(IMPORT_EXPORT_PROFILES.map(p => [p.domain, p]));
const _automationMap = new Map(AUTOMATION_PROFILES.map(p => [p.domain, p]));
const _rbacMap = new Map(DOMAIN_RBAC_PROFILES.map(p => [p.domain, p]));

export function getImportExportProfile(domain: string): ImportExportProfile | undefined {
  return _importExportMap.get(domain);
}

export function getAutomationProfile(domain: string): AutomationProfile | undefined {
  return _automationMap.get(domain);
}

export function getDomainRBAC(domain: string): DomainRBACProfile | undefined {
  return _rbacMap.get(domain);
}

export function getDomainsWithImportExport(): string[] {
  return IMPORT_EXPORT_PROFILES.map(p => p.domain);
}

export function getDomainsWithAutomation(): string[] {
  return AUTOMATION_PROFILES.map(p => p.domain);
}

export function getDomainsWithRBAC(): string[] {
  return DOMAIN_RBAC_PROFILES.map(p => p.domain);
}
