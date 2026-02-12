/**
 * Workflow Definitions - Per-lens state machines with states,
 * transitions, guards, and lifecycle hooks.
 *
 * Every competitor-level application has a workflow engine:
 * Draft → Review → Approved → Archived with permissions per stage.
 *
 * This file defines the state machines that the existing
 * atlas-write-guard and atlas-scope-router infrastructure can enforce.
 */

// ── Types ──────────────────────────────────────────────────────

export interface WorkflowState {
  name: string;
  /** Human-readable label */
  label: string;
  /** Is this the initial state for new artifacts? */
  initial?: boolean;
  /** Is this a terminal state? */
  terminal?: boolean;
  /** Required RBAC permission to be in this state */
  requiredPermission?: string;
  /** Color hint for UI rendering */
  color?: 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'purple';
}

export interface WorkflowTransition {
  from: string;
  to: string;
  /** Action name that triggers this transition */
  action: string;
  /** Human-readable label for the action button */
  label: string;
  /** RBAC permission required to perform this transition */
  requiredPermission?: string;
  /** Minimum role required */
  requiredRole?: 'viewer' | 'reviewer' | 'editor' | 'admin' | 'owner';
  /** Guard: domain-specific validation that must pass */
  guard?: string;
}

export interface WorkflowDef {
  domain: string;
  /** Which entity this workflow applies to (e.g. 'Case', 'WorkOrder') */
  entity: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

// ── Workflow Definitions ───────────────────────────────────────

export const WORKFLOW_DEFINITIONS: WorkflowDef[] = [

  // ── Paper / Research ─────────────────────────────────────────
  {
    domain: 'paper',
    entity: 'project',
    states: [
      { name: 'draft', label: 'Draft', initial: true, color: 'gray' },
      { name: 'in_review', label: 'In Review', color: 'yellow', requiredPermission: 'write' },
      { name: 'revision', label: 'Revision Requested', color: 'orange' },
      { name: 'published', label: 'Published', color: 'green', requiredPermission: 'promote' },
      { name: 'archived', label: 'Archived', terminal: true, color: 'purple' },
    ],
    transitions: [
      { from: 'draft', to: 'in_review', action: 'submit', label: 'Submit for Review', requiredRole: 'editor', guard: 'hasAbstract' },
      { from: 'in_review', to: 'revision', action: 'request_changes', label: 'Request Changes', requiredRole: 'reviewer' },
      { from: 'in_review', to: 'published', action: 'approve', label: 'Publish', requiredRole: 'admin', guard: 'hasMinClaims' },
      { from: 'revision', to: 'in_review', action: 'resubmit', label: 'Resubmit', requiredRole: 'editor' },
      { from: 'published', to: 'archived', action: 'archive', label: 'Archive', requiredRole: 'admin' },
      { from: 'in_review', to: 'draft', action: 'withdraw', label: 'Withdraw', requiredRole: 'editor' },
    ],
  },

  // ── Code ─────────────────────────────────────────────────────
  {
    domain: 'code',
    entity: 'review',
    states: [
      { name: 'open', label: 'Open', initial: true, color: 'blue' },
      { name: 'changes_requested', label: 'Changes Requested', color: 'orange' },
      { name: 'approved', label: 'Approved', color: 'green', requiredPermission: 'promote' },
      { name: 'merged', label: 'Merged', terminal: true, color: 'purple' },
    ],
    transitions: [
      { from: 'open', to: 'approved', action: 'approve', label: 'Approve', requiredRole: 'reviewer' },
      { from: 'open', to: 'changes_requested', action: 'request_changes', label: 'Request Changes', requiredRole: 'reviewer' },
      { from: 'changes_requested', to: 'open', action: 'address', label: 'Address Feedback', requiredRole: 'editor' },
      { from: 'approved', to: 'merged', action: 'merge', label: 'Merge', requiredRole: 'admin' },
    ],
  },

  // ── Healthcare ───────────────────────────────────────────────
  {
    domain: 'healthcare',
    entity: 'Encounter',
    states: [
      { name: 'scheduled', label: 'Scheduled', initial: true, color: 'blue' },
      { name: 'checked_in', label: 'Checked In', color: 'yellow' },
      { name: 'in_progress', label: 'In Progress', color: 'orange' },
      { name: 'completed', label: 'Completed', color: 'green' },
      { name: 'billed', label: 'Billed', terminal: true, color: 'purple' },
      { name: 'cancelled', label: 'Cancelled', terminal: true, color: 'gray' },
      { name: 'no_show', label: 'No Show', terminal: true, color: 'red' },
    ],
    transitions: [
      { from: 'scheduled', to: 'checked_in', action: 'check_in', label: 'Check In', requiredRole: 'editor' },
      { from: 'scheduled', to: 'cancelled', action: 'cancel', label: 'Cancel', requiredRole: 'editor' },
      { from: 'scheduled', to: 'no_show', action: 'mark_no_show', label: 'Mark No Show', requiredRole: 'editor' },
      { from: 'checked_in', to: 'in_progress', action: 'start', label: 'Start Encounter', requiredRole: 'editor', guard: 'hasProvider' },
      { from: 'in_progress', to: 'completed', action: 'complete', label: 'Complete', requiredRole: 'editor', guard: 'hasDiagnosis' },
      { from: 'completed', to: 'billed', action: 'bill', label: 'Submit for Billing', requiredRole: 'admin' },
    ],
  },

  {
    domain: 'healthcare',
    entity: 'Prescription',
    states: [
      { name: 'active', label: 'Active', initial: true, color: 'green' },
      { name: 'on_hold', label: 'On Hold', color: 'yellow' },
      { name: 'completed', label: 'Completed', terminal: true, color: 'gray' },
      { name: 'discontinued', label: 'Discontinued', terminal: true, color: 'red' },
    ],
    transitions: [
      { from: 'active', to: 'on_hold', action: 'hold', label: 'Place on Hold', requiredRole: 'editor' },
      { from: 'active', to: 'discontinued', action: 'discontinue', label: 'Discontinue', requiredRole: 'editor', guard: 'hasDiscontinueReason' },
      { from: 'active', to: 'completed', action: 'complete', label: 'Mark Complete', requiredRole: 'editor' },
      { from: 'on_hold', to: 'active', action: 'resume', label: 'Resume', requiredRole: 'editor' },
      { from: 'on_hold', to: 'discontinued', action: 'discontinue', label: 'Discontinue', requiredRole: 'editor' },
    ],
  },

  // ── Legal ────────────────────────────────────────────────────
  {
    domain: 'legal',
    entity: 'Case',
    states: [
      { name: 'intake', label: 'Intake', initial: true, color: 'gray' },
      { name: 'active', label: 'Active', color: 'blue' },
      { name: 'discovery', label: 'Discovery', color: 'yellow' },
      { name: 'trial', label: 'Trial', color: 'orange' },
      { name: 'appeal', label: 'Appeal', color: 'red' },
      { name: 'settled', label: 'Settled', terminal: true, color: 'green' },
      { name: 'closed', label: 'Closed', terminal: true, color: 'purple' },
    ],
    transitions: [
      { from: 'intake', to: 'active', action: 'accept', label: 'Accept Case', requiredRole: 'admin', guard: 'hasClient' },
      { from: 'active', to: 'discovery', action: 'begin_discovery', label: 'Begin Discovery', requiredRole: 'editor' },
      { from: 'discovery', to: 'trial', action: 'proceed_to_trial', label: 'Proceed to Trial', requiredRole: 'admin' },
      { from: 'trial', to: 'appeal', action: 'appeal', label: 'File Appeal', requiredRole: 'admin' },
      { from: 'active', to: 'settled', action: 'settle', label: 'Settle', requiredRole: 'admin' },
      { from: 'trial', to: 'settled', action: 'settle', label: 'Settle', requiredRole: 'admin' },
      { from: 'trial', to: 'closed', action: 'close', label: 'Close', requiredRole: 'admin' },
      { from: 'appeal', to: 'closed', action: 'close', label: 'Close', requiredRole: 'admin' },
      { from: 'settled', to: 'closed', action: 'close', label: 'Archive', requiredRole: 'admin' },
    ],
  },

  {
    domain: 'legal',
    entity: 'Contract',
    states: [
      { name: 'draft', label: 'Draft', initial: true, color: 'gray' },
      { name: 'review', label: 'Under Review', color: 'yellow' },
      { name: 'negotiation', label: 'Negotiation', color: 'orange' },
      { name: 'executed', label: 'Executed', color: 'green' },
      { name: 'expired', label: 'Expired', terminal: true, color: 'gray' },
      { name: 'terminated', label: 'Terminated', terminal: true, color: 'red' },
    ],
    transitions: [
      { from: 'draft', to: 'review', action: 'submit', label: 'Submit for Review', requiredRole: 'editor' },
      { from: 'review', to: 'negotiation', action: 'negotiate', label: 'Enter Negotiation', requiredRole: 'admin' },
      { from: 'review', to: 'draft', action: 'return', label: 'Return to Draft', requiredRole: 'reviewer' },
      { from: 'negotiation', to: 'executed', action: 'execute', label: 'Execute Contract', requiredRole: 'admin', guard: 'hasAllParties' },
      { from: 'negotiation', to: 'draft', action: 'restart', label: 'Restart Draft', requiredRole: 'admin' },
      { from: 'executed', to: 'expired', action: 'expire', label: 'Mark Expired', requiredRole: 'admin' },
      { from: 'executed', to: 'terminated', action: 'terminate', label: 'Terminate', requiredRole: 'owner' },
    ],
  },

  // ── Accounting ───────────────────────────────────────────────
  {
    domain: 'accounting',
    entity: 'Invoice',
    states: [
      { name: 'draft', label: 'Draft', initial: true, color: 'gray' },
      { name: 'sent', label: 'Sent', color: 'blue' },
      { name: 'overdue', label: 'Overdue', color: 'red' },
      { name: 'paid', label: 'Paid', terminal: true, color: 'green' },
      { name: 'void', label: 'Void', terminal: true, color: 'gray' },
    ],
    transitions: [
      { from: 'draft', to: 'sent', action: 'send', label: 'Send Invoice', requiredRole: 'editor', guard: 'hasLineItems' },
      { from: 'draft', to: 'void', action: 'void', label: 'Void', requiredRole: 'admin' },
      { from: 'sent', to: 'paid', action: 'record_payment', label: 'Record Payment', requiredRole: 'editor' },
      { from: 'sent', to: 'overdue', action: 'mark_overdue', label: 'Mark Overdue', requiredRole: 'editor' },
      { from: 'overdue', to: 'paid', action: 'record_payment', label: 'Record Payment', requiredRole: 'editor' },
      { from: 'sent', to: 'void', action: 'void', label: 'Void', requiredRole: 'admin' },
    ],
  },

  // ── Security ─────────────────────────────────────────────────
  {
    domain: 'security',
    entity: 'Incident',
    states: [
      { name: 'reported', label: 'Reported', initial: true, color: 'red' },
      { name: 'triaged', label: 'Triaged', color: 'orange' },
      { name: 'investigating', label: 'Investigating', color: 'yellow' },
      { name: 'contained', label: 'Contained', color: 'blue' },
      { name: 'remediated', label: 'Remediated', color: 'green' },
      { name: 'closed', label: 'Closed', terminal: true, color: 'purple' },
    ],
    transitions: [
      { from: 'reported', to: 'triaged', action: 'triage', label: 'Triage', requiredRole: 'editor' },
      { from: 'triaged', to: 'investigating', action: 'investigate', label: 'Begin Investigation', requiredRole: 'editor', guard: 'hasAssignee' },
      { from: 'investigating', to: 'contained', action: 'contain', label: 'Mark Contained', requiredRole: 'editor' },
      { from: 'contained', to: 'remediated', action: 'remediate', label: 'Remediate', requiredRole: 'editor' },
      { from: 'remediated', to: 'closed', action: 'close', label: 'Close Incident', requiredRole: 'admin', guard: 'hasPostMortem' },
      { from: 'reported', to: 'closed', action: 'dismiss', label: 'Dismiss (False Positive)', requiredRole: 'admin' },
    ],
  },

  // ── Manufacturing ────────────────────────────────────────────
  {
    domain: 'manufacturing',
    entity: 'WorkOrder',
    states: [
      { name: 'planned', label: 'Planned', initial: true, color: 'gray' },
      { name: 'scheduled', label: 'Scheduled', color: 'blue' },
      { name: 'in_progress', label: 'In Progress', color: 'yellow' },
      { name: 'quality_check', label: 'Quality Check', color: 'orange' },
      { name: 'completed', label: 'Completed', color: 'green' },
      { name: 'shipped', label: 'Shipped', terminal: true, color: 'purple' },
    ],
    transitions: [
      { from: 'planned', to: 'scheduled', action: 'schedule', label: 'Schedule', requiredRole: 'editor', guard: 'hasBOM' },
      { from: 'scheduled', to: 'in_progress', action: 'start', label: 'Start Production', requiredRole: 'editor', guard: 'hasMachine' },
      { from: 'in_progress', to: 'quality_check', action: 'submit_qc', label: 'Submit for QC', requiredRole: 'editor' },
      { from: 'quality_check', to: 'completed', action: 'pass_qc', label: 'QC Passed', requiredRole: 'reviewer' },
      { from: 'quality_check', to: 'in_progress', action: 'fail_qc', label: 'QC Failed — Rework', requiredRole: 'reviewer' },
      { from: 'completed', to: 'shipped', action: 'ship', label: 'Ship', requiredRole: 'admin' },
    ],
  },

  {
    domain: 'manufacturing',
    entity: 'BOM',
    states: [
      { name: 'draft', label: 'Draft', initial: true, color: 'gray' },
      { name: 'approved', label: 'Approved', color: 'green' },
      { name: 'deprecated', label: 'Deprecated', terminal: true, color: 'red' },
    ],
    transitions: [
      { from: 'draft', to: 'approved', action: 'approve', label: 'Approve BOM', requiredRole: 'admin', guard: 'hasParts' },
      { from: 'approved', to: 'deprecated', action: 'deprecate', label: 'Deprecate', requiredRole: 'admin' },
    ],
  },

  // ── Education ────────────────────────────────────────────────
  {
    domain: 'education',
    entity: 'Student',
    states: [
      { name: 'enrolled', label: 'Enrolled', initial: true, color: 'green' },
      { name: 'suspended', label: 'Suspended', color: 'red' },
      { name: 'graduated', label: 'Graduated', terminal: true, color: 'purple' },
      { name: 'withdrawn', label: 'Withdrawn', terminal: true, color: 'gray' },
    ],
    transitions: [
      { from: 'enrolled', to: 'suspended', action: 'suspend', label: 'Suspend', requiredRole: 'admin' },
      { from: 'suspended', to: 'enrolled', action: 'reinstate', label: 'Reinstate', requiredRole: 'admin' },
      { from: 'enrolled', to: 'graduated', action: 'graduate', label: 'Graduate', requiredRole: 'admin', guard: 'meetsRequirements' },
      { from: 'enrolled', to: 'withdrawn', action: 'withdraw', label: 'Withdraw', requiredRole: 'editor' },
    ],
  },

  // ── Retail ───────────────────────────────────────────────────
  {
    domain: 'retail',
    entity: 'Order',
    states: [
      { name: 'pending', label: 'Pending', initial: true, color: 'gray' },
      { name: 'confirmed', label: 'Confirmed', color: 'blue' },
      { name: 'processing', label: 'Processing', color: 'yellow' },
      { name: 'shipped', label: 'Shipped', color: 'orange' },
      { name: 'delivered', label: 'Delivered', terminal: true, color: 'green' },
      { name: 'returned', label: 'Returned', terminal: true, color: 'red' },
      { name: 'cancelled', label: 'Cancelled', terminal: true, color: 'gray' },
    ],
    transitions: [
      { from: 'pending', to: 'confirmed', action: 'confirm', label: 'Confirm Order', requiredRole: 'editor' },
      { from: 'pending', to: 'cancelled', action: 'cancel', label: 'Cancel', requiredRole: 'editor' },
      { from: 'confirmed', to: 'processing', action: 'process', label: 'Begin Processing', requiredRole: 'editor' },
      { from: 'confirmed', to: 'cancelled', action: 'cancel', label: 'Cancel', requiredRole: 'admin' },
      { from: 'processing', to: 'shipped', action: 'ship', label: 'Ship', requiredRole: 'editor', guard: 'hasShippingAddress' },
      { from: 'shipped', to: 'delivered', action: 'deliver', label: 'Mark Delivered', requiredRole: 'editor' },
      { from: 'delivered', to: 'returned', action: 'return', label: 'Process Return', requiredRole: 'editor' },
    ],
  },

  // ── Government ───────────────────────────────────────────────
  {
    domain: 'government',
    entity: 'Permit',
    states: [
      { name: 'submitted', label: 'Submitted', initial: true, color: 'blue' },
      { name: 'under_review', label: 'Under Review', color: 'yellow' },
      { name: 'revision_requested', label: 'Revision Requested', color: 'orange' },
      { name: 'approved', label: 'Approved', color: 'green' },
      { name: 'denied', label: 'Denied', terminal: true, color: 'red' },
      { name: 'expired', label: 'Expired', terminal: true, color: 'gray' },
      { name: 'revoked', label: 'Revoked', terminal: true, color: 'red' },
    ],
    transitions: [
      { from: 'submitted', to: 'under_review', action: 'begin_review', label: 'Begin Review', requiredRole: 'reviewer' },
      { from: 'under_review', to: 'revision_requested', action: 'request_revision', label: 'Request Revision', requiredRole: 'reviewer' },
      { from: 'revision_requested', to: 'under_review', action: 'resubmit', label: 'Resubmit', requiredRole: 'editor' },
      { from: 'under_review', to: 'approved', action: 'approve', label: 'Approve', requiredRole: 'admin', guard: 'hasFeesPaid' },
      { from: 'under_review', to: 'denied', action: 'deny', label: 'Deny', requiredRole: 'admin' },
      { from: 'approved', to: 'expired', action: 'expire', label: 'Mark Expired', requiredRole: 'admin' },
      { from: 'approved', to: 'revoked', action: 'revoke', label: 'Revoke', requiredRole: 'owner' },
    ],
  },

  {
    domain: 'government',
    entity: 'Violation',
    states: [
      { name: 'reported', label: 'Reported', initial: true, color: 'red' },
      { name: 'investigating', label: 'Investigating', color: 'yellow' },
      { name: 'cited', label: 'Cited', color: 'orange' },
      { name: 'remediated', label: 'Remediated', terminal: true, color: 'green' },
      { name: 'dismissed', label: 'Dismissed', terminal: true, color: 'gray' },
    ],
    transitions: [
      { from: 'reported', to: 'investigating', action: 'investigate', label: 'Investigate', requiredRole: 'editor' },
      { from: 'investigating', to: 'cited', action: 'cite', label: 'Issue Citation', requiredRole: 'admin' },
      { from: 'investigating', to: 'dismissed', action: 'dismiss', label: 'Dismiss', requiredRole: 'admin' },
      { from: 'cited', to: 'remediated', action: 'remediate', label: 'Mark Remediated', requiredRole: 'editor' },
    ],
  },

  // ── Real Estate ──────────────────────────────────────────────
  {
    domain: 'realestate',
    entity: 'Listing',
    states: [
      { name: 'draft', label: 'Draft', initial: true, color: 'gray' },
      { name: 'active', label: 'Active', color: 'green' },
      { name: 'under_contract', label: 'Under Contract', color: 'yellow' },
      { name: 'pending', label: 'Pending', color: 'orange' },
      { name: 'sold', label: 'Sold', terminal: true, color: 'purple' },
      { name: 'withdrawn', label: 'Withdrawn', terminal: true, color: 'gray' },
    ],
    transitions: [
      { from: 'draft', to: 'active', action: 'publish', label: 'Publish Listing', requiredRole: 'editor', guard: 'hasPrice' },
      { from: 'active', to: 'under_contract', action: 'accept_offer', label: 'Accept Offer', requiredRole: 'editor' },
      { from: 'under_contract', to: 'pending', action: 'go_pending', label: 'Go Pending', requiredRole: 'editor' },
      { from: 'pending', to: 'sold', action: 'close', label: 'Close Sale', requiredRole: 'admin' },
      { from: 'under_contract', to: 'active', action: 'fall_through', label: 'Back to Active', requiredRole: 'editor' },
      { from: 'active', to: 'withdrawn', action: 'withdraw', label: 'Withdraw', requiredRole: 'editor' },
    ],
  },

  // ── Insurance ────────────────────────────────────────────────
  {
    domain: 'insurance',
    entity: 'Claim',
    states: [
      { name: 'filed', label: 'Filed', initial: true, color: 'blue' },
      { name: 'under_review', label: 'Under Review', color: 'yellow' },
      { name: 'investigation', label: 'Investigation', color: 'orange' },
      { name: 'approved', label: 'Approved', color: 'green' },
      { name: 'denied', label: 'Denied', terminal: true, color: 'red' },
      { name: 'paid', label: 'Paid', terminal: true, color: 'purple' },
    ],
    transitions: [
      { from: 'filed', to: 'under_review', action: 'begin_review', label: 'Begin Review', requiredRole: 'editor' },
      { from: 'under_review', to: 'investigation', action: 'investigate', label: 'Flag for Investigation', requiredRole: 'reviewer' },
      { from: 'under_review', to: 'approved', action: 'approve', label: 'Approve Claim', requiredRole: 'admin' },
      { from: 'under_review', to: 'denied', action: 'deny', label: 'Deny Claim', requiredRole: 'admin' },
      { from: 'investigation', to: 'approved', action: 'approve', label: 'Approve', requiredRole: 'admin' },
      { from: 'investigation', to: 'denied', action: 'deny', label: 'Deny', requiredRole: 'admin' },
      { from: 'approved', to: 'paid', action: 'pay', label: 'Issue Payment', requiredRole: 'admin' },
    ],
  },

  // ── Logistics ────────────────────────────────────────────────
  {
    domain: 'logistics',
    entity: 'Shipment',
    states: [
      { name: 'created', label: 'Created', initial: true, color: 'gray' },
      { name: 'picked', label: 'Picked', color: 'blue' },
      { name: 'packed', label: 'Packed', color: 'yellow' },
      { name: 'in_transit', label: 'In Transit', color: 'orange' },
      { name: 'out_for_delivery', label: 'Out for Delivery', color: 'yellow' },
      { name: 'delivered', label: 'Delivered', terminal: true, color: 'green' },
      { name: 'exception', label: 'Exception', color: 'red' },
    ],
    transitions: [
      { from: 'created', to: 'picked', action: 'pick', label: 'Pick Items', requiredRole: 'editor' },
      { from: 'picked', to: 'packed', action: 'pack', label: 'Pack', requiredRole: 'editor' },
      { from: 'packed', to: 'in_transit', action: 'dispatch', label: 'Dispatch', requiredRole: 'editor', guard: 'hasTrackingNumber' },
      { from: 'in_transit', to: 'out_for_delivery', action: 'out_for_delivery', label: 'Out for Delivery', requiredRole: 'editor' },
      { from: 'out_for_delivery', to: 'delivered', action: 'deliver', label: 'Mark Delivered', requiredRole: 'editor' },
      { from: 'in_transit', to: 'exception', action: 'flag_exception', label: 'Flag Exception', requiredRole: 'editor' },
      { from: 'exception', to: 'in_transit', action: 'resolve', label: 'Resolve & Resume', requiredRole: 'admin' },
    ],
  },

  // ── Nonprofit ────────────────────────────────────────────────
  {
    domain: 'nonprofit',
    entity: 'Grant',
    states: [
      { name: 'prospecting', label: 'Prospecting', initial: true, color: 'gray' },
      { name: 'application', label: 'Application', color: 'blue' },
      { name: 'submitted', label: 'Submitted', color: 'yellow' },
      { name: 'awarded', label: 'Awarded', color: 'green' },
      { name: 'active', label: 'Active', color: 'green' },
      { name: 'reporting', label: 'Reporting', color: 'orange' },
      { name: 'closed', label: 'Closed', terminal: true, color: 'purple' },
      { name: 'declined', label: 'Declined', terminal: true, color: 'red' },
    ],
    transitions: [
      { from: 'prospecting', to: 'application', action: 'begin_application', label: 'Begin Application', requiredRole: 'editor' },
      { from: 'application', to: 'submitted', action: 'submit', label: 'Submit', requiredRole: 'admin', guard: 'hasRequiredDocs' },
      { from: 'submitted', to: 'awarded', action: 'award', label: 'Award', requiredRole: 'admin' },
      { from: 'submitted', to: 'declined', action: 'decline', label: 'Declined', requiredRole: 'admin' },
      { from: 'awarded', to: 'active', action: 'activate', label: 'Activate', requiredRole: 'admin' },
      { from: 'active', to: 'reporting', action: 'begin_reporting', label: 'Begin Reporting', requiredRole: 'editor' },
      { from: 'reporting', to: 'closed', action: 'close', label: 'Close Grant', requiredRole: 'admin' },
    ],
  },

  // ── Events ───────────────────────────────────────────────────
  {
    domain: 'events',
    entity: 'Event',
    states: [
      { name: 'planning', label: 'Planning', initial: true, color: 'gray' },
      { name: 'announced', label: 'Announced', color: 'blue' },
      { name: 'registration_open', label: 'Registration Open', color: 'green' },
      { name: 'sold_out', label: 'Sold Out', color: 'orange' },
      { name: 'in_progress', label: 'In Progress', color: 'yellow' },
      { name: 'completed', label: 'Completed', terminal: true, color: 'purple' },
      { name: 'cancelled', label: 'Cancelled', terminal: true, color: 'red' },
    ],
    transitions: [
      { from: 'planning', to: 'announced', action: 'announce', label: 'Announce', requiredRole: 'admin', guard: 'hasVenue' },
      { from: 'announced', to: 'registration_open', action: 'open_registration', label: 'Open Registration', requiredRole: 'admin' },
      { from: 'registration_open', to: 'sold_out', action: 'sell_out', label: 'Mark Sold Out', requiredRole: 'editor' },
      { from: 'registration_open', to: 'in_progress', action: 'start', label: 'Start Event', requiredRole: 'admin' },
      { from: 'sold_out', to: 'in_progress', action: 'start', label: 'Start Event', requiredRole: 'admin' },
      { from: 'in_progress', to: 'completed', action: 'complete', label: 'Complete', requiredRole: 'admin' },
      { from: 'planning', to: 'cancelled', action: 'cancel', label: 'Cancel', requiredRole: 'owner' },
      { from: 'announced', to: 'cancelled', action: 'cancel', label: 'Cancel', requiredRole: 'owner' },
    ],
  },

  // ── Agriculture ──────────────────────────────────────────────
  {
    domain: 'agriculture',
    entity: 'CropCycle',
    states: [
      { name: 'planning', label: 'Planning', initial: true, color: 'gray' },
      { name: 'planted', label: 'Planted', color: 'green' },
      { name: 'growing', label: 'Growing', color: 'yellow' },
      { name: 'harvest_ready', label: 'Harvest Ready', color: 'orange' },
      { name: 'harvested', label: 'Harvested', terminal: true, color: 'purple' },
    ],
    transitions: [
      { from: 'planning', to: 'planted', action: 'plant', label: 'Mark Planted', requiredRole: 'editor', guard: 'hasField' },
      { from: 'planted', to: 'growing', action: 'sprout', label: 'Mark Growing', requiredRole: 'editor' },
      { from: 'growing', to: 'harvest_ready', action: 'ready', label: 'Mark Harvest Ready', requiredRole: 'editor' },
      { from: 'harvest_ready', to: 'harvested', action: 'harvest', label: 'Record Harvest', requiredRole: 'editor', guard: 'hasYieldData' },
    ],
  },

  // ── Fitness ──────────────────────────────────────────────────
  {
    domain: 'fitness',
    entity: 'Program',
    states: [
      { name: 'draft', label: 'Draft', initial: true, color: 'gray' },
      { name: 'active', label: 'Active', color: 'green' },
      { name: 'paused', label: 'Paused', color: 'yellow' },
      { name: 'completed', label: 'Completed', terminal: true, color: 'purple' },
    ],
    transitions: [
      { from: 'draft', to: 'active', action: 'activate', label: 'Activate', requiredRole: 'editor' },
      { from: 'active', to: 'paused', action: 'pause', label: 'Pause', requiredRole: 'editor' },
      { from: 'paused', to: 'active', action: 'resume', label: 'Resume', requiredRole: 'editor' },
      { from: 'active', to: 'completed', action: 'complete', label: 'Complete', requiredRole: 'editor' },
    ],
  },

  // ── Aviation ─────────────────────────────────────────────────
  {
    domain: 'aviation',
    entity: 'Flight',
    states: [
      { name: 'scheduled', label: 'Scheduled', initial: true, color: 'blue' },
      { name: 'preflight', label: 'Preflight Check', color: 'yellow' },
      { name: 'boarding', label: 'Boarding', color: 'orange' },
      { name: 'in_flight', label: 'In Flight', color: 'green' },
      { name: 'landed', label: 'Landed', color: 'blue' },
      { name: 'completed', label: 'Completed', terminal: true, color: 'purple' },
      { name: 'cancelled', label: 'Cancelled', terminal: true, color: 'red' },
    ],
    transitions: [
      { from: 'scheduled', to: 'preflight', action: 'begin_preflight', label: 'Begin Preflight', requiredRole: 'editor', guard: 'hasCrewAssigned' },
      { from: 'preflight', to: 'boarding', action: 'clear_preflight', label: 'Clear for Boarding', requiredRole: 'editor', guard: 'preflightComplete' },
      { from: 'boarding', to: 'in_flight', action: 'depart', label: 'Depart', requiredRole: 'editor' },
      { from: 'in_flight', to: 'landed', action: 'land', label: 'Land', requiredRole: 'editor' },
      { from: 'landed', to: 'completed', action: 'complete', label: 'Complete', requiredRole: 'editor' },
      { from: 'scheduled', to: 'cancelled', action: 'cancel', label: 'Cancel Flight', requiredRole: 'admin' },
    ],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────

const _workflowMap = new Map<string, WorkflowDef[]>();
for (const w of WORKFLOW_DEFINITIONS) {
  const list = _workflowMap.get(w.domain) ?? [];
  list.push(w);
  _workflowMap.set(w.domain, list);
}

export function getWorkflowsForDomain(domain: string): WorkflowDef[] {
  return _workflowMap.get(domain) ?? [];
}

export function getWorkflow(domain: string, entity: string): WorkflowDef | undefined {
  return (_workflowMap.get(domain) ?? []).find(w => w.entity === entity);
}

export function getAvailableTransitions(domain: string, entity: string, currentState: string, userRole: string): WorkflowTransition[] {
  const wf = getWorkflow(domain, entity);
  if (!wf) return [];
  const roleHierarchy = ['viewer', 'reviewer', 'editor', 'admin', 'owner'];
  const userLevel = roleHierarchy.indexOf(userRole);
  return wf.transitions.filter(t => {
    if (t.from !== currentState) return false;
    if (t.requiredRole) {
      const reqLevel = roleHierarchy.indexOf(t.requiredRole);
      if (userLevel < reqLevel) return false;
    }
    return true;
  });
}

export function isValidTransition(domain: string, entity: string, from: string, to: string): boolean {
  const wf = getWorkflow(domain, entity);
  if (!wf) return false;
  return wf.transitions.some(t => t.from === from && t.to === to);
}

export function getInitialState(domain: string, entity: string): string | undefined {
  const wf = getWorkflow(domain, entity);
  if (!wf) return undefined;
  return wf.states.find(s => s.initial)?.name;
}

export function getDomainsWithWorkflows(): string[] {
  return [..._workflowMap.keys()];
}
