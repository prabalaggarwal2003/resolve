import { User, Location, Department, Vendor } from '../models/index.js';

const FIELD_LABELS = {
  name: 'Name',
  model: 'Model',
  category: 'Category',
  serialNumber: 'Serial number',
  status: 'Status',
  condition: 'Condition',
  assignedTo: 'Assigned to',
  assignedToName: 'Assigned to',
  assignedToEmployeeCode: 'Employee code',
  locationId: 'Location',
  departmentId: 'Department',
  purchaseDate: 'Purchase date',
  warrantyExpiry: 'Warranty expiry',
  vendorId: 'Vendor',
  cost: 'Cost',
  amcExpiry: 'AMC expiry',
  nextMaintenanceDate: 'Next maintenance',
  tags: 'Tags',
};

/** Fields that require a change reason when modified */
export const IMPORTANT_CHANGE_FIELDS = new Set([
  'status',
  'locationId',
  'departmentId',
  'assignedTo',
  'assignedToName',
  'assignedToEmployeeCode',
  'warrantyExpiry',
  'amcExpiry',
  'nextMaintenanceDate',
  'cost',
  'purchaseDate',
  'vendorId',
  'condition',
]);

const REFERENCE_FIELDS = new Set(['assignedTo', 'locationId', 'departmentId', 'vendorId']);

const SKIP_FIELDS = new Set([
  '_id',
  '__v',
  'organizationId',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'assignedAt',
  'qrCodeUrl',
  'photos',
  'documents',
  'maintenanceHistory',
  'maintenanceStartDate',
  'maintenanceCompletedDate',
  'maintenanceReason',
]);

function normalizeId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function formatPrimitive(field, value) {
  if (value == null || value === '') return '—';
  if (field === 'status') return String(value).replace(/_/g, ' ');
  if (field === 'cost') return String(value);
  if (field === 'tags') {
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    return String(value);
  }
  if (['purchaseDate', 'warrantyExpiry', 'amcExpiry', 'nextMaintenanceDate'].includes(field)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN');
  }
  return String(value);
}

function valuesEqual(field, oldVal, newVal) {
  if (normalizeId(oldVal) === normalizeId(newVal)) return true;
  if (oldVal === newVal) return true;

  if (field === 'cost') {
    const oldNum = oldVal == null || oldVal === '' ? null : Number(oldVal);
    const newNum = newVal == null || newVal === '' ? null : Number(newVal);
    return oldNum === newNum;
  }

  if (field === 'tags') {
    const oldTags = Array.isArray(oldVal) ? oldVal : oldVal ? [oldVal] : [];
    const newTags = Array.isArray(newVal) ? newVal : newVal ? [newVal] : [];
    if (oldTags.length !== newTags.length) return false;
    return oldTags.every((t, i) => String(t) === String(newTags[i]));
  }

  if (['purchaseDate', 'warrantyExpiry', 'amcExpiry', 'nextMaintenanceDate'].includes(field)) {
    const oldDate = oldVal ? new Date(oldVal) : null;
    const newDate = newVal ? new Date(newVal) : null;
    if (!oldDate && !newDate) return true;
    if (!oldDate || !newDate) return false;
    return oldDate.toDateString() === newDate.toDateString();
  }

  return false;
}

function formatLocationDisplay(loc) {
  if (!loc) return '—';
  const raw = typeof loc === 'object' ? loc.path || loc.name : String(loc);
  if (!raw) return '—';
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' > ');
}

async function resolveDisplayValue(field, value, cache) {
  if (value == null || value === '') return '—';
  if (!REFERENCE_FIELDS.has(field)) return formatPrimitive(field, value);

  const id = normalizeId(value);
  if (!id) return '—';

  if (field === 'assignedTo') {
    if (!cache.users[id]) {
      const user = await User.findById(id).select('name').lean();
      cache.users[id] = user?.name || id;
    }
    return cache.users[id];
  }
  if (field === 'locationId') {
    if (!cache.locations[id]) {
      const loc = await Location.findById(id).select('name path').lean();
      cache.locations[id] = formatLocationDisplay(loc) || id;
    }
    return cache.locations[id];
  }
  if (field === 'departmentId') {
    if (!cache.departments[id]) {
      const dept = await Department.findById(id).select('name').lean();
      cache.departments[id] = dept?.name || id;
    }
    return cache.departments[id];
  }
  if (field === 'vendorId') {
    if (!cache.vendors[id]) {
      const vendor = await Vendor.findById(id).select('name vendorId').lean();
      cache.vendors[id] = vendor ? `${vendor.vendorId} — ${vendor.name}` : id;
    }
    return cache.vendors[id];
  }

  return formatPrimitive(field, value);
}

function formatChangeLine(change) {
  if (change.label === 'Created') return `Created: ${change.newValue}`;
  return `${change.label}: ${change.oldValue} → ${change.newValue}`;
}

export function formatChangesSummary(changes) {
  if (!changes?.length) return '';
  return changes.map(formatChangeLine).join(' · ');
}

export function getImportantChanges(fieldChanges) {
  if (!fieldChanges?.length) return [];
  return fieldChanges.filter((c) => IMPORTANT_CHANGE_FIELDS.has(c.field));
}

export function requiresChangeReason(fieldChanges) {
  return getImportantChanges(fieldChanges).length > 0;
}

async function diffCustomFields(prevCustom, nextCustom, cache) {
  const changes = [];
  const prev = prevCustom || {};
  const next = nextCustom || {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of keys) {
    const oldVal = prev[key];
    const newVal = next[key];
    if (JSON.stringify(oldVal ?? null) === JSON.stringify(newVal ?? null)) continue;

    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const oldValue =
      oldVal == null || oldVal === ''
        ? '—'
        : Array.isArray(oldVal)
        ? oldVal.join(', ')
        : String(oldVal);
    const newValue =
      newVal == null || newVal === ''
        ? '—'
        : Array.isArray(newVal)
        ? newVal.join(', ')
        : String(newVal);

    if (oldValue === newValue) continue;
    changes.push({ field: `custom:${key}`, label, oldValue, newValue });
  }

  return changes;
}

function parseSummaryToChanges(summary) {
  if (!summary?.trim()) return [];
  return summary
    .split(' · ')
    .map((part) => {
      const created = part.match(/^Created:\s*(.+)$/);
      if (created) {
        return { field: 'created', label: 'Created', oldValue: '—', newValue: created[1].trim() };
      }
      const change = part.match(/^(.+?):\s*(.+?)\s*→\s*(.+)$/);
      if (change) {
        return {
          field: change[1].toLowerCase().replace(/\s+/g, '_'),
          label: change[1].trim(),
          oldValue: change[2].trim(),
          newValue: change[3].trim(),
        };
      }
      return null;
    })
    .filter(Boolean);
}

export async function buildAssetEditChanges(prev, patchBody) {
  const cache = { users: {}, locations: {}, departments: {}, vendors: {} };
  const changes = [];

  for (const [key, newVal] of Object.entries(patchBody)) {
    if (SKIP_FIELDS.has(key) || key.startsWith('maintenanceHistory.') || key === '$push') continue;
    if (key === 'customFields') continue;

    const label = FIELD_LABELS[key];
    if (!label) continue;

    const oldVal = prev[key];
    if (valuesEqual(key, oldVal, newVal)) continue;

    const oldValue = await resolveDisplayValue(key, oldVal, cache);
    const newValue = await resolveDisplayValue(key, newVal, cache);
    if (oldValue === newValue) continue;

    changes.push({
      field: key,
      label,
      oldValue: String(oldValue),
      newValue: String(newValue),
    });
  }

  if (patchBody.customFields !== undefined) {
    const customChanges = await diffCustomFields(prev.customFields, patchBody.customFields, cache);
    changes.push(...customChanges);
  }

  if (changes.length === 0) return null;

  return {
    fieldChanges: changes,
    summary: formatChangesSummary(changes),
  };
}

export async function createAssetEditLog(
  AssetLog,
  { assetId, userId, fieldChanges, summary, changeReason, type = 'edit' }
) {
  if (!fieldChanges?.length && type === 'edit') return;

  const normalizedChanges = (fieldChanges || []).map((c) => ({
    field: String(c.field ?? ''),
    label: String(c.label ?? c.field ?? 'Field'),
    oldValue: String(c.oldValue ?? '—'),
    newValue: String(c.newValue ?? '—'),
  }));

  const summaryText = summary || formatChangesSummary(normalizedChanges);

  await AssetLog.create({
    assetId,
    userId,
    type,
    fieldChanges: normalizedChanges,
    details: { changes: normalizedChanges, changeReason: changeReason || undefined },
    summary: summaryText,
    changeReason: changeReason?.trim() || undefined,
  });
}

export async function createAssetNoteLog(AssetLog, { assetId, userId, text }) {
  const note = String(text || '').trim();
  if (!note) return null;

  return AssetLog.create({
    assetId,
    userId,
    type: 'note',
    notes: note,
    summary: note.length > 120 ? `${note.slice(0, 117)}…` : note,
  });
}

export async function createAssetMaintenanceLog(AssetLog, { assetId, userId, summary, notes }) {
  return AssetLog.create({
    assetId,
    userId,
    type: 'maintenance',
    summary,
    notes: notes || undefined,
  });
}

export function extractFieldChanges(log) {
  if (log.fieldChanges?.length) return log.fieldChanges;
  if (log.details?.changes?.length) return log.details.changes;
  if (Array.isArray(log.changes) && log.changes.length) return log.changes;
  return parseSummaryToChanges(log.summary);
}

export function serializeAssetLogs(logs) {
  return logs.map((log) => serializeTimelineEntry(log));
}

export function serializeTimelineEntry(log) {
  const fieldChanges = extractFieldChanges(log);
  const user = log.userId && typeof log.userId === 'object'
    ? { _id: log.userId._id, name: log.userId.name, email: log.userId.email }
    : null;

  return {
    _id: log._id,
    type: log.type,
    fieldChanges,
    summary: log.summary || formatChangesSummary(fieldChanges),
    changeReason: log.changeReason || log.details?.changeReason || null,
    noteText: log.type === 'note' ? log.notes || log.summary : null,
    notes: log.notes || null,
    user,
    createdAt: log.createdAt,
  };
}
