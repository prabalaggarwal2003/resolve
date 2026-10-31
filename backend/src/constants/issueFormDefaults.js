/** Shared form field definitions for issue types (public report + staff). */

export const FORM_FIELD_TYPES = [
  'text',
  'number',
  'dropdown',
  'multiselect',
  'date',
  'checkbox',
  'textarea',
  'user',
  'contact',
  'asset',
  'location',
  'attachment',
];

/**
 * @typedef {object} FormFieldDef
 * @property {string} key
 * @property {string} label
 * @property {string} type
 * @property {boolean} [required]
 * @property {string[]} [options]
 * @property {string} [placeholder]
 * @property {{ field: string, equals?: string|boolean|number, notEquals?: string|boolean|number }|null} [showWhen]
 */

export const BASE_REPORT_FIELDS = [
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    required: true,
    placeholder: 'Describe the issue…',
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'dropdown',
    required: false,
    options: ['low', 'medium', 'high', 'critical'],
  },
];

function withBase(extra = []) {
  return [...BASE_REPORT_FIELDS, ...extra];
}

/** Stub issue types — with per-type form field definitions. */
export const DEFAULT_ISSUE_TYPES = [
  {
    id: 'incident',
    name: 'Incident',
    description: 'Unexpected failure or outage',
    color: '#ef4444',
    isDefault: true,
    formFields: withBase([
      {
        key: 'impact',
        label: 'Impact',
        type: 'dropdown',
        required: true,
        options: ['single_user', 'team', 'building', 'campus'],
      },
      {
        key: 'startedAt',
        label: 'When did it start?',
        type: 'date',
        required: false,
      },
      {
        key: 'safetyRisk',
        label: 'Safety risk?',
        type: 'checkbox',
        required: false,
      },
      {
        key: 'safetyNotes',
        label: 'Safety notes',
        type: 'textarea',
        required: true,
        showWhen: { field: 'safetyRisk', equals: true },
      },
    ]),
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    description: 'Scheduled or requested maintenance',
    color: '#f59e0b',
    isDefault: false,
    formFields: withBase([
      {
        key: 'maintenanceKind',
        label: 'Maintenance kind',
        type: 'dropdown',
        required: true,
        options: ['preventive', 'corrective', 'inspection'],
      },
      {
        key: 'preferredDate',
        label: 'Preferred date',
        type: 'date',
        required: false,
      },
    ]),
  },
  {
    id: 'damage',
    name: 'Damage',
    description: 'Physical damage',
    color: '#f97316',
    isDefault: false,
    formFields: withBase([
      {
        key: 'damageSeverity',
        label: 'Damage severity',
        type: 'dropdown',
        required: true,
        options: ['cosmetic', 'functional', 'critical'],
      },
      {
        key: 'causeKnown',
        label: 'Cause known?',
        type: 'checkbox',
        required: false,
      },
      {
        key: 'cause',
        label: 'Cause',
        type: 'text',
        required: true,
        showWhen: { field: 'causeKnown', equals: true },
      },
    ]),
  },
  {
    id: 'request',
    name: 'Request',
    description: 'Service or change request',
    color: '#60a5fa',
    isDefault: false,
    formFields: withBase([
      {
        key: 'requestCategory',
        label: 'Request category',
        type: 'dropdown',
        required: true,
        options: ['access', 'upgrade', 'move', 'other'],
      },
    ]),
  },
  {
    id: 'inspection',
    name: 'Inspection',
    description: 'Inspection finding',
    color: '#a78bfa',
    isDefault: false,
    formFields: withBase([
      {
        key: 'finding',
        label: 'Finding',
        type: 'dropdown',
        required: true,
        options: ['pass', 'fail', 'needs_attention'],
      },
      {
        key: 'checklistNotes',
        label: 'Checklist notes',
        type: 'textarea',
        required: false,
      },
    ]),
  },
  {
    id: 'complaint',
    name: 'Complaint',
    description: 'Complaint or feedback',
    color: '#94a3b8',
    isDefault: false,
    formFields: withBase([
      {
        key: 'complaintArea',
        label: 'Area',
        type: 'dropdown',
        required: false,
        options: ['service', 'quality', 'noise', 'other'],
      },
    ]),
  },
  {
    id: 'repair',
    name: 'Repair',
    description: 'Repair needed',
    color: '#f59e0b',
    isDefault: false,
    formFields: withBase([
      {
        key: 'urgency',
        label: 'Urgency',
        type: 'dropdown',
        required: false,
        options: ['low', 'medium', 'high'],
      },
    ]),
  },
  {
    id: 'not_working',
    name: 'Not Working',
    description: 'Asset not turning on / not working',
    color: '#ef4444',
    isDefault: false,
    formFields: withBase([
      {
        key: 'powerLight',
        label: 'Power light on?',
        type: 'checkbox',
        required: false,
      },
      {
        key: 'lastWorked',
        label: 'Last worked',
        type: 'date',
        required: false,
      },
    ]),
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Uncategorized',
    color: '#6b7280',
    isDefault: false,
    formFields: withBase(),
  },
];
