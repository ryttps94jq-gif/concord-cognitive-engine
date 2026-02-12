/**
 * Domain Schema Registry - Per-lens entity models with typed fields,
 * validation rules, relationships, and audit contracts.
 *
 * This is the "depth" layer that turns manifest declarations into
 * enforceable domain models. A lens without a domain schema is a
 * UI scaffold. A lens with one rivals vertical SaaS.
 *
 * Pattern: Each lens declares its entities, their fields, field types,
 * validation rules, required fields, entity relationships, and which
 * fields carry audit history.
 */

// ── Field Types ────────────────────────────────────────────────

export type FieldType =
  | 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime'
  | 'enum' | 'currency' | 'email' | 'url' | 'phone'
  | 'json' | 'array' | 'reference' | 'file' | 'geo' | 'duration';

export interface FieldDef {
  name: string;
  type: FieldType;
  required?: boolean;
  /** For enum fields */
  enumValues?: string[];
  /** For reference fields - which entity this points to */
  refEntity?: string;
  /** For array fields - element type */
  arrayOf?: FieldType | string;
  /** Default value */
  defaultValue?: unknown;
  /** Validation rule (regex pattern for strings, min/max for numbers) */
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  /** Whether changes to this field are tracked in audit history */
  audited?: boolean;
  /** Whether this field is indexed for search */
  indexed?: boolean;
}

export interface EntityDef {
  name: string;
  /** The primary display field (e.g. 'title', 'name') */
  displayField: string;
  fields: FieldDef[];
  /** Soft-delete support */
  softDelete?: boolean;
  /** Versioning support */
  versioned?: boolean;
}

export interface RelationDef {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  /** The field on 'from' that holds the reference */
  foreignKey: string;
  /** Cascade behavior on delete */
  onDelete?: 'cascade' | 'nullify' | 'restrict';
}

export interface DomainSchema {
  domain: string;
  entities: EntityDef[];
  relations: RelationDef[];
}

// ── Domain Schema Registry ─────────────────────────────────────

export const DOMAIN_SCHEMAS: DomainSchema[] = [

  // ═══════════════════════════════════════════════════════════════
  // CORE PRODUCT LENSES
  // ═══════════════════════════════════════════════════════════════

  {
    domain: 'paper',
    entities: [
      {
        name: 'project', displayField: 'title', versioned: true, softDelete: true,
        fields: [
          { name: 'title', type: 'string', required: true, indexed: true, validation: { maxLength: 200 } },
          { name: 'abstract', type: 'text' },
          { name: 'status', type: 'enum', enumValues: ['draft', 'in_review', 'published', 'archived'], required: true, audited: true },
          { name: 'tags', type: 'array', arrayOf: 'string', indexed: true },
          { name: 'wordCount', type: 'number' },
          { name: 'authors', type: 'array', arrayOf: 'string' },
          { name: 'publishedAt', type: 'datetime' },
        ],
      },
      {
        name: 'claim', displayField: 'statement', versioned: true,
        fields: [
          { name: 'statement', type: 'text', required: true },
          { name: 'confidence', type: 'number', validation: { min: 0, max: 1 }, audited: true },
          { name: 'projectId', type: 'reference', refEntity: 'project', required: true },
          { name: 'evidenceIds', type: 'array', arrayOf: 'reference' },
          { name: 'status', type: 'enum', enumValues: ['proposed', 'supported', 'contradicted', 'retracted'], audited: true },
        ],
      },
      {
        name: 'evidence', displayField: 'summary',
        fields: [
          { name: 'summary', type: 'text', required: true },
          { name: 'sourceUrl', type: 'url' },
          { name: 'sourceTier', type: 'enum', enumValues: ['primary', 'secondary', 'tertiary'] },
          { name: 'claimId', type: 'reference', refEntity: 'claim' },
          { name: 'strength', type: 'enum', enumValues: ['strong', 'moderate', 'weak'] },
        ],
      },
    ],
    relations: [
      { from: 'claim', to: 'project', type: 'many-to-many', foreignKey: 'projectId', onDelete: 'cascade' },
      { from: 'evidence', to: 'claim', type: 'many-to-many', foreignKey: 'claimId', onDelete: 'nullify' },
    ],
  },

  {
    domain: 'code',
    entities: [
      {
        name: 'project', displayField: 'name', versioned: true, softDelete: true,
        fields: [
          { name: 'name', type: 'string', required: true, indexed: true },
          { name: 'language', type: 'enum', enumValues: ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'other'] },
          { name: 'description', type: 'text' },
          { name: 'repoUrl', type: 'url' },
          { name: 'status', type: 'enum', enumValues: ['active', 'archived', 'deprecated'], audited: true },
        ],
      },
      {
        name: 'snippet', displayField: 'title', versioned: true,
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'content', type: 'text', required: true },
          { name: 'language', type: 'string' },
          { name: 'projectId', type: 'reference', refEntity: 'project' },
          { name: 'tags', type: 'array', arrayOf: 'string' },
        ],
      },
      {
        name: 'review', displayField: 'title',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'diff', type: 'text', required: true },
          { name: 'status', type: 'enum', enumValues: ['open', 'approved', 'changes_requested', 'merged'], audited: true },
          { name: 'projectId', type: 'reference', refEntity: 'project', required: true },
          { name: 'reviewer', type: 'string' },
        ],
      },
    ],
    relations: [
      { from: 'snippet', to: 'project', type: 'many-to-many', foreignKey: 'projectId', onDelete: 'cascade' },
      { from: 'review', to: 'project', type: 'many-to-many', foreignKey: 'projectId', onDelete: 'cascade' },
    ],
  },

  {
    domain: 'graph',
    entities: [
      {
        name: 'entity', displayField: 'label', versioned: true,
        fields: [
          { name: 'label', type: 'string', required: true, indexed: true },
          { name: 'entityType', type: 'string', required: true, indexed: true },
          { name: 'properties', type: 'json' },
          { name: 'confidence', type: 'number', validation: { min: 0, max: 1 } },
        ],
      },
      {
        name: 'relation', displayField: 'label',
        fields: [
          { name: 'label', type: 'string', required: true },
          { name: 'fromEntityId', type: 'reference', refEntity: 'entity', required: true },
          { name: 'toEntityId', type: 'reference', refEntity: 'entity', required: true },
          { name: 'weight', type: 'number', validation: { min: 0, max: 1 } },
          { name: 'sourceId', type: 'reference', refEntity: 'source' },
        ],
      },
      {
        name: 'source', displayField: 'title',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'url', type: 'url' },
          { name: 'tier', type: 'enum', enumValues: ['primary', 'secondary', 'tertiary'] },
        ],
      },
    ],
    relations: [
      { from: 'relation', to: 'entity', type: 'many-to-many', foreignKey: 'fromEntityId', onDelete: 'cascade' },
      { from: 'relation', to: 'source', type: 'many-to-many', foreignKey: 'sourceId', onDelete: 'nullify' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // SUPER-LENSES (representative set - same pattern for all 23)
  // ═══════════════════════════════════════════════════════════════

  {
    domain: 'healthcare',
    entities: [
      {
        name: 'Patient', displayField: 'name', softDelete: true, versioned: true,
        fields: [
          { name: 'name', type: 'string', required: true, indexed: true },
          { name: 'dateOfBirth', type: 'date', required: true },
          { name: 'mrn', type: 'string', indexed: true, validation: { pattern: '^[A-Z0-9]+$' } },
          { name: 'sex', type: 'enum', enumValues: ['male', 'female', 'other', 'unknown'] },
          { name: 'allergies', type: 'array', arrayOf: 'string' },
          { name: 'insuranceId', type: 'string' },
          { name: 'primaryProvider', type: 'string' },
          { name: 'status', type: 'enum', enumValues: ['active', 'inactive', 'deceased'], audited: true },
        ],
      },
      {
        name: 'Encounter', displayField: 'reason', versioned: true,
        fields: [
          { name: 'patientId', type: 'reference', refEntity: 'Patient', required: true },
          { name: 'reason', type: 'text', required: true },
          { name: 'encounterType', type: 'enum', enumValues: ['office_visit', 'telehealth', 'emergency', 'inpatient', 'procedure'] },
          { name: 'providerId', type: 'string', required: true },
          { name: 'date', type: 'datetime', required: true },
          { name: 'status', type: 'enum', enumValues: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'], audited: true },
          { name: 'diagnosis', type: 'array', arrayOf: 'string' },
          { name: 'notes', type: 'text' },
        ],
      },
      {
        name: 'Prescription', displayField: 'medication',
        fields: [
          { name: 'patientId', type: 'reference', refEntity: 'Patient', required: true },
          { name: 'medication', type: 'string', required: true, indexed: true },
          { name: 'dosage', type: 'string', required: true },
          { name: 'frequency', type: 'string', required: true },
          { name: 'startDate', type: 'date', required: true },
          { name: 'endDate', type: 'date' },
          { name: 'prescriberId', type: 'string', required: true },
          { name: 'status', type: 'enum', enumValues: ['active', 'completed', 'discontinued', 'on_hold'], audited: true },
          { name: 'refillsRemaining', type: 'number', validation: { min: 0 } },
        ],
      },
    ],
    relations: [
      { from: 'Encounter', to: 'Patient', type: 'many-to-many', foreignKey: 'patientId', onDelete: 'restrict' },
      { from: 'Prescription', to: 'Patient', type: 'many-to-many', foreignKey: 'patientId', onDelete: 'restrict' },
    ],
  },

  {
    domain: 'legal',
    entities: [
      {
        name: 'Case', displayField: 'title', versioned: true, softDelete: true,
        fields: [
          { name: 'title', type: 'string', required: true, indexed: true },
          { name: 'caseNumber', type: 'string', indexed: true },
          { name: 'caseType', type: 'enum', enumValues: ['litigation', 'transactional', 'compliance', 'immigration', 'ip', 'criminal', 'family'] },
          { name: 'status', type: 'enum', enumValues: ['intake', 'active', 'discovery', 'trial', 'appeal', 'settled', 'closed'], audited: true },
          { name: 'client', type: 'string', required: true },
          { name: 'opposingParty', type: 'string' },
          { name: 'jurisdiction', type: 'string' },
          { name: 'filingDate', type: 'date' },
          { name: 'deadlines', type: 'array', arrayOf: 'json' },
          { name: 'assignedAttorneys', type: 'array', arrayOf: 'string' },
        ],
      },
      {
        name: 'Contract', displayField: 'title', versioned: true,
        fields: [
          { name: 'title', type: 'string', required: true, indexed: true },
          { name: 'contractType', type: 'enum', enumValues: ['nda', 'employment', 'vendor', 'lease', 'license', 'partnership', 'sla'] },
          { name: 'status', type: 'enum', enumValues: ['draft', 'review', 'negotiation', 'executed', 'expired', 'terminated'], audited: true },
          { name: 'parties', type: 'array', arrayOf: 'string', required: true },
          { name: 'effectiveDate', type: 'date' },
          { name: 'expirationDate', type: 'date' },
          { name: 'value', type: 'currency' },
          { name: 'autoRenew', type: 'boolean' },
          { name: 'clauseCount', type: 'number' },
        ],
      },
      {
        name: 'Filing', displayField: 'title',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'caseId', type: 'reference', refEntity: 'Case', required: true },
          { name: 'filingType', type: 'enum', enumValues: ['motion', 'brief', 'pleading', 'discovery', 'exhibit', 'order'] },
          { name: 'filedDate', type: 'datetime' },
          { name: 'deadline', type: 'datetime' },
          { name: 'status', type: 'enum', enumValues: ['draft', 'filed', 'served', 'responded'], audited: true },
        ],
      },
    ],
    relations: [
      { from: 'Filing', to: 'Case', type: 'many-to-many', foreignKey: 'caseId', onDelete: 'cascade' },
    ],
  },

  {
    domain: 'accounting',
    entities: [
      {
        name: 'Account', displayField: 'name', softDelete: true,
        fields: [
          { name: 'name', type: 'string', required: true, indexed: true },
          { name: 'accountNumber', type: 'string', required: true, indexed: true },
          { name: 'accountType', type: 'enum', enumValues: ['asset', 'liability', 'equity', 'revenue', 'expense'], required: true },
          { name: 'balance', type: 'currency', audited: true },
          { name: 'currency', type: 'enum', enumValues: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'], required: true },
          { name: 'isActive', type: 'boolean', required: true },
          { name: 'parentAccountId', type: 'reference', refEntity: 'Account' },
        ],
      },
      {
        name: 'Transaction', displayField: 'description', versioned: true,
        fields: [
          { name: 'description', type: 'string', required: true },
          { name: 'amount', type: 'currency', required: true, audited: true },
          { name: 'date', type: 'date', required: true, indexed: true },
          { name: 'debitAccountId', type: 'reference', refEntity: 'Account', required: true },
          { name: 'creditAccountId', type: 'reference', refEntity: 'Account', required: true },
          { name: 'category', type: 'string', indexed: true },
          { name: 'reconciled', type: 'boolean', audited: true },
          { name: 'attachmentUrl', type: 'url' },
        ],
      },
      {
        name: 'Invoice', displayField: 'invoiceNumber', versioned: true,
        fields: [
          { name: 'invoiceNumber', type: 'string', required: true, indexed: true },
          { name: 'client', type: 'string', required: true },
          { name: 'amount', type: 'currency', required: true },
          { name: 'issueDate', type: 'date', required: true },
          { name: 'dueDate', type: 'date', required: true },
          { name: 'status', type: 'enum', enumValues: ['draft', 'sent', 'paid', 'overdue', 'void'], audited: true },
          { name: 'lineItems', type: 'array', arrayOf: 'json' },
          { name: 'paidDate', type: 'date' },
        ],
      },
    ],
    relations: [
      { from: 'Transaction', to: 'Account', type: 'many-to-many', foreignKey: 'debitAccountId', onDelete: 'restrict' },
      { from: 'Invoice', to: 'Account', type: 'many-to-many', foreignKey: 'invoiceNumber', onDelete: 'restrict' },
    ],
  },

  {
    domain: 'security',
    entities: [
      {
        name: 'Incident', displayField: 'title', versioned: true, softDelete: true,
        fields: [
          { name: 'title', type: 'string', required: true, indexed: true },
          { name: 'severity', type: 'enum', enumValues: ['critical', 'high', 'medium', 'low', 'info'], required: true, audited: true },
          { name: 'status', type: 'enum', enumValues: ['reported', 'triaged', 'investigating', 'contained', 'remediated', 'closed'], audited: true },
          { name: 'reportedAt', type: 'datetime', required: true },
          { name: 'assignee', type: 'string' },
          { name: 'category', type: 'enum', enumValues: ['breach', 'malware', 'phishing', 'physical', 'policy_violation', 'other'] },
          { name: 'affectedAssets', type: 'array', arrayOf: 'reference' },
          { name: 'timeline', type: 'array', arrayOf: 'json' },
        ],
      },
      {
        name: 'Threat', displayField: 'name',
        fields: [
          { name: 'name', type: 'string', required: true, indexed: true },
          { name: 'threatLevel', type: 'enum', enumValues: ['critical', 'elevated', 'guarded', 'low'], audited: true },
          { name: 'source', type: 'string' },
          { name: 'indicators', type: 'array', arrayOf: 'string' },
          { name: 'mitigations', type: 'array', arrayOf: 'string' },
          { name: 'lastAssessedAt', type: 'datetime' },
        ],
      },
    ],
    relations: [
      { from: 'Incident', to: 'Threat', type: 'many-to-many', foreignKey: 'affectedAssets', onDelete: 'nullify' },
    ],
  },

  {
    domain: 'manufacturing',
    entities: [
      {
        name: 'WorkOrder', displayField: 'orderNumber', versioned: true,
        fields: [
          { name: 'orderNumber', type: 'string', required: true, indexed: true },
          { name: 'product', type: 'string', required: true },
          { name: 'quantity', type: 'number', required: true, validation: { min: 1 } },
          { name: 'status', type: 'enum', enumValues: ['planned', 'scheduled', 'in_progress', 'quality_check', 'completed', 'shipped'], audited: true },
          { name: 'priority', type: 'enum', enumValues: ['urgent', 'high', 'normal', 'low'] },
          { name: 'startDate', type: 'date' },
          { name: 'dueDate', type: 'date', required: true },
          { name: 'machineId', type: 'reference', refEntity: 'Machine' },
          { name: 'bomId', type: 'reference', refEntity: 'BOM' },
        ],
      },
      {
        name: 'BOM', displayField: 'name',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'version', type: 'number', required: true },
          { name: 'parts', type: 'array', arrayOf: 'json', required: true },
          { name: 'totalCost', type: 'currency' },
          { name: 'status', type: 'enum', enumValues: ['draft', 'approved', 'deprecated'], audited: true },
        ],
      },
      {
        name: 'QCInspection', displayField: 'inspectionId',
        fields: [
          { name: 'inspectionId', type: 'string', required: true },
          { name: 'workOrderId', type: 'reference', refEntity: 'WorkOrder', required: true },
          { name: 'result', type: 'enum', enumValues: ['pass', 'fail', 'conditional'], audited: true },
          { name: 'defects', type: 'array', arrayOf: 'json' },
          { name: 'inspectedAt', type: 'datetime', required: true },
          { name: 'inspector', type: 'string', required: true },
        ],
      },
    ],
    relations: [
      { from: 'WorkOrder', to: 'BOM', type: 'many-to-many', foreignKey: 'bomId', onDelete: 'restrict' },
      { from: 'QCInspection', to: 'WorkOrder', type: 'many-to-many', foreignKey: 'workOrderId', onDelete: 'cascade' },
    ],
  },

  {
    domain: 'education',
    entities: [
      {
        name: 'Student', displayField: 'name', softDelete: true,
        fields: [
          { name: 'name', type: 'string', required: true, indexed: true },
          { name: 'studentId', type: 'string', required: true, indexed: true },
          { name: 'email', type: 'email' },
          { name: 'enrollmentDate', type: 'date', required: true },
          { name: 'status', type: 'enum', enumValues: ['enrolled', 'graduated', 'withdrawn', 'suspended'], audited: true },
          { name: 'gpa', type: 'number', validation: { min: 0, max: 4 } },
        ],
      },
      {
        name: 'Course', displayField: 'title',
        fields: [
          { name: 'title', type: 'string', required: true, indexed: true },
          { name: 'courseCode', type: 'string', required: true, indexed: true },
          { name: 'credits', type: 'number', required: true, validation: { min: 0.5, max: 12 } },
          { name: 'instructor', type: 'string' },
          { name: 'capacity', type: 'number', validation: { min: 1 } },
          { name: 'schedule', type: 'json' },
        ],
      },
      {
        name: 'Assignment', displayField: 'title', versioned: true,
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'courseId', type: 'reference', refEntity: 'Course', required: true },
          { name: 'dueDate', type: 'datetime', required: true },
          { name: 'maxScore', type: 'number', required: true, validation: { min: 0 } },
          { name: 'weight', type: 'number', validation: { min: 0, max: 1 } },
          { name: 'assignmentType', type: 'enum', enumValues: ['homework', 'quiz', 'exam', 'project', 'participation'] },
        ],
      },
    ],
    relations: [
      { from: 'Assignment', to: 'Course', type: 'many-to-many', foreignKey: 'courseId', onDelete: 'cascade' },
    ],
  },

  {
    domain: 'retail',
    entities: [
      {
        name: 'Product', displayField: 'name', versioned: true, softDelete: true,
        fields: [
          { name: 'name', type: 'string', required: true, indexed: true },
          { name: 'sku', type: 'string', required: true, indexed: true },
          { name: 'price', type: 'currency', required: true, audited: true },
          { name: 'cost', type: 'currency' },
          { name: 'quantity', type: 'number', validation: { min: 0 }, audited: true },
          { name: 'reorderPoint', type: 'number', validation: { min: 0 } },
          { name: 'category', type: 'string', indexed: true },
          { name: 'status', type: 'enum', enumValues: ['active', 'discontinued', 'out_of_stock', 'seasonal'], audited: true },
        ],
      },
      {
        name: 'Order', displayField: 'orderNumber', versioned: true,
        fields: [
          { name: 'orderNumber', type: 'string', required: true, indexed: true },
          { name: 'customerId', type: 'reference', refEntity: 'Customer', required: true },
          { name: 'total', type: 'currency', required: true },
          { name: 'status', type: 'enum', enumValues: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'], audited: true },
          { name: 'lineItems', type: 'array', arrayOf: 'json', required: true },
          { name: 'orderDate', type: 'datetime', required: true },
          { name: 'shippingAddress', type: 'json' },
        ],
      },
      {
        name: 'Customer', displayField: 'name', softDelete: true,
        fields: [
          { name: 'name', type: 'string', required: true, indexed: true },
          { name: 'email', type: 'email', indexed: true },
          { name: 'phone', type: 'phone' },
          { name: 'lifetimeValue', type: 'currency', audited: true },
          { name: 'tier', type: 'enum', enumValues: ['standard', 'silver', 'gold', 'platinum'] },
          { name: 'firstPurchaseDate', type: 'date' },
          { name: 'lastPurchaseDate', type: 'date' },
        ],
      },
    ],
    relations: [
      { from: 'Order', to: 'Customer', type: 'many-to-many', foreignKey: 'customerId', onDelete: 'restrict' },
    ],
  },

  {
    domain: 'government',
    entities: [
      {
        name: 'Permit', displayField: 'title', versioned: true,
        fields: [
          { name: 'title', type: 'string', required: true, indexed: true },
          { name: 'permitNumber', type: 'string', required: true, indexed: true },
          { name: 'permitType', type: 'enum', enumValues: ['building', 'zoning', 'environmental', 'business', 'event', 'special_use'] },
          { name: 'applicant', type: 'string', required: true },
          { name: 'status', type: 'enum', enumValues: ['submitted', 'under_review', 'revision_requested', 'approved', 'denied', 'expired', 'revoked'], audited: true },
          { name: 'submittedDate', type: 'date', required: true },
          { name: 'reviewDeadline', type: 'date' },
          { name: 'location', type: 'geo' },
          { name: 'fees', type: 'currency' },
        ],
      },
      {
        name: 'Violation', displayField: 'title',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'code', type: 'string', required: true },
          { name: 'severity', type: 'enum', enumValues: ['critical', 'major', 'minor', 'notice'], audited: true },
          { name: 'status', type: 'enum', enumValues: ['reported', 'investigating', 'cited', 'remediated', 'dismissed'], audited: true },
          { name: 'location', type: 'geo' },
          { name: 'reportedDate', type: 'date', required: true },
          { name: 'deadline', type: 'date' },
        ],
      },
    ],
    relations: [],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────

const _schemaMap = new Map(DOMAIN_SCHEMAS.map(s => [s.domain, s]));

export function getDomainSchema(domain: string): DomainSchema | undefined {
  return _schemaMap.get(domain);
}

export function getDomainEntities(domain: string): EntityDef[] {
  return _schemaMap.get(domain)?.entities ?? [];
}

export function getDomainRelations(domain: string): RelationDef[] {
  return _schemaMap.get(domain)?.relations ?? [];
}

export function getDomainsWithSchemas(): string[] {
  return DOMAIN_SCHEMAS.map(s => s.domain);
}
