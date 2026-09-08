/** Default Issue / Tickets module configuration (org-scoped). */

import {
  DEFAULT_ISSUE_TYPES,
  FORM_FIELD_TYPES,
  BASE_REPORT_FIELDS,
} from './issueFormDefaults.js';

export { DEFAULT_ISSUE_TYPES, FORM_FIELD_TYPES, BASE_REPORT_FIELDS };

export const LEGACY_STATUS_MAP = {
  open: 'new',
  in_progress: 'in_progress',
  completed: 'resolved',
  cancelled: 'cancelled',
};

/** Statuses that mean the ticket is still active / open. */
export const OPEN_STATUS_IDS = ['new', 'triaged', 'assigned', 'in_progress', 'waiting', 'open'];

/** Statuses that mean work is done or ticket ended. */
export const CLOSED_STATUS_IDS = ['resolved', 'verified', 'closed', 'cancelled', 'completed'];

export const DEFAULT_ISSUE_STATUSES = [
  { id: 'new', name: 'New', color: '#f59e0b', isDefault: true, isClosed: false },
  { id: 'triaged', name: 'Triaged', color: '#a78bfa', isDefault: false, isClosed: false },
  { id: 'assigned', name: 'Assigned', color: '#60a5fa', isDefault: false, isClosed: false },
  { id: 'in_progress', name: 'In Progress', color: '#3b82f6', isDefault: false, isClosed: false },
  { id: 'waiting', name: 'Waiting', color: '#f97316', isDefault: false, isClosed: false },
  { id: 'resolved', name: 'Resolved', color: '#34d399', isDefault: false, isClosed: false },
  { id: 'verified', name: 'Verified', color: '#10b981', isDefault: false, isClosed: false },
  { id: 'closed', name: 'Closed', color: '#6b7280', isDefault: false, isClosed: true },
  { id: 'cancelled', name: 'Cancelled', color: '#9ca3af', isDefault: false, isClosed: true },
];

export const DEFAULT_PRIORITIES = [
  { id: 'low', name: 'Low', color: '#94a3b8', isDefault: false },
  { id: 'medium', name: 'Medium', color: '#60a5fa', isDefault: true },
  { id: 'high', name: 'High', color: '#f59e0b', isDefault: false },
  { id: 'critical', name: 'Critical', color: '#ef4444', isDefault: false },
];

export const DEFAULT_SEVERITIES = [
  { id: 'low', name: 'Low', color: '#94a3b8', isDefault: false },
  { id: 'medium', name: 'Medium', color: '#60a5fa', isDefault: true },
  { id: 'high', name: 'High', color: '#f59e0b', isDefault: false },
  { id: 'critical', name: 'Critical', color: '#ef4444', isDefault: false },
];

export const DEFAULT_ISSUE_SETTINGS = {
  ticketPrefix: 'TKT',
  defaultPriorityId: 'medium',
  defaultSeverityId: 'medium',
  defaultIssueTypeId: 'incident',
  defaultWorkflowKey: 'default',
  /** When true, Resolved must go through Verified before Closed. */
  requireVerificationBeforeClose: true,
  /** When true, the user who resolved cannot also verify. */
  preventSelfVerification: true,
  /** Next sequence for auto-generated employee IDs (import). */
  employeeIdAutoSeq: 1,
};

/**
 * Default workflow transitions.
 * requiredFields: ticket-level keys that must be present on the payload (e.g. resolution.notes).
 */
export const DEFAULT_WORKFLOW_TRANSITIONS = [
  { from: 'new', to: 'triaged', requireReason: false },
  { from: 'new', to: 'assigned', requireReason: false },
  { from: 'new', to: 'cancelled', requireReason: true },
  { from: 'triaged', to: 'assigned', requireReason: false },
  { from: 'triaged', to: 'in_progress', requireReason: false },
  { from: 'triaged', to: 'cancelled', requireReason: true },
  { from: 'assigned', to: 'in_progress', requireReason: false },
  { from: 'assigned', to: 'waiting', requireReason: true },
  { from: 'assigned', to: 'cancelled', requireReason: true },
  { from: 'in_progress', to: 'waiting', requireReason: true },
  { from: 'in_progress', to: 'resolved', requireReason: true, requiredFields: ['resolution.notes'] },
  { from: 'in_progress', to: 'cancelled', requireReason: true },
  { from: 'waiting', to: 'in_progress', requireReason: false },
  { from: 'waiting', to: 'cancelled', requireReason: true },
  { from: 'resolved', to: 'verified', requireReason: false, requiredFields: ['verification.notes'] },
  { from: 'resolved', to: 'in_progress', requireReason: true },
  { from: 'verified', to: 'closed', requireReason: false },
  { from: 'verified', to: 'in_progress', requireReason: true },
  { from: 'closed', to: 'in_progress', requireReason: true },
  { from: 'cancelled', to: 'new', requireReason: true },
];

export const DEFAULT_WORKFLOW = {
  key: 'default',
  name: 'Default ticket workflow',
  description: 'New → Triage → Assign → In Progress → Waiting/Resolve → Verify → Close',
  isDefault: true,
  stages: DEFAULT_ISSUE_STATUSES.map((s) => s.id),
  transitions: DEFAULT_WORKFLOW_TRANSITIONS,
};

export function getDefaultIssueOrgConfig() {
  return {
    statuses: DEFAULT_ISSUE_STATUSES,
    priorities: DEFAULT_PRIORITIES,
    severities: DEFAULT_SEVERITIES,
    issueTypes: DEFAULT_ISSUE_TYPES,
    settings: { ...DEFAULT_ISSUE_SETTINGS },
  };
}

/** Map legacy public category / issueType strings to issueTypeId. */
export function mapLegacyCategoryToTypeId(category) {
  const key = String(category || 'other').toLowerCase().replace(/\s+/g, '_');
  const known = DEFAULT_ISSUE_TYPES.find((t) => t.id === key);
  return known ? known.id : 'other';
}
