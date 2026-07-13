import {
  User,
  Vendor,
  Department,
  Budget,
  AssetGroup,
  Location,
  AssetTemplate,
} from '../models/index.js';

const REF_MODEL_BY_FIELD = {
  budgetOwnerId: User,
  vendorId: Vendor,
  budgetId: Budget,
  departmentId: Department,
  groupId: AssetGroup,
  locationId: Location,
  templateId: AssetTemplate,
};

function toComparable(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    return JSON.stringify(value);
  }
  return String(value);
}

function displayBasic(value) {
  if (value == null || value === '') return '—';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function resolveRefName(field, value) {
  if (value == null || value === '') return '—';
  const id = typeof value === 'object' && value._id ? value._id : value;
  const Model = REF_MODEL_BY_FIELD[field];
  if (!Model) return String(id);
  try {
    const doc = await Model.findById(id).select('name').lean();
    return doc?.name || String(id);
  } catch {
    return String(id);
  }
}

/**
 * Diff a set of top-level fields between two plain objects.
 * descriptors: [{ key, label, type?: 'ref'|'option'|'date'|'plain', options?, display? }]
 * Returns [{ field, label, from, to }] for changed fields only.
 */
export async function diffFields(prev, next, descriptors) {
  const changes = [];
  for (const d of descriptors) {
    const before = prev?.[d.key];
    const after = next?.[d.key];
    if (toComparable(before) === toComparable(after)) continue;

    let fromDisp;
    let toDisp;
    if (d.type === 'ref') {
      [fromDisp, toDisp] = await Promise.all([
        resolveRefName(d.key, before),
        resolveRefName(d.key, after),
      ]);
    } else if (d.type === 'option') {
      const nameOf = (v) => (v == null || v === '' ? '—' : (d.options || []).find((o) => o.id === v)?.name || String(v));
      fromDisp = nameOf(before);
      toDisp = nameOf(after);
    } else {
      fromDisp = displayBasic(before);
      toDisp = displayBasic(after);
    }

    changes.push({ field: d.key, label: d.label, from: fromDisp, to: toDisp });
  }
  return changes;
}

/**
 * Diff a keyed object map (dimensions / custom fields).
 * labelFor(key) -> human label; resolveValue(key, value) -> display string (may be async).
 */
export async function diffKeyedMap(prevMap = {}, nextMap = {}, prefix, labelFor, resolveValue) {
  const changes = [];
  const keys = new Set([...Object.keys(prevMap || {}), ...Object.keys(nextMap || {})]);
  for (const key of keys) {
    const before = prevMap?.[key];
    const after = nextMap?.[key];
    if (toComparable(before) === toComparable(after)) continue;
    const [fromDisp, toDisp] = await Promise.all([
      resolveValue ? resolveValue(key, before) : Promise.resolve(displayBasic(before)),
      resolveValue ? resolveValue(key, after) : Promise.resolve(displayBasic(after)),
    ]);
    changes.push({
      field: `${prefix}.${key}`,
      label: labelFor ? labelFor(key) : key,
      from: fromDisp,
      to: toDisp,
    });
  }
  return changes;
}

export { resolveRefName, displayBasic };
