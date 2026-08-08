import { suggestStatusValue, suggestConditionValue, ASSET_CONDITION_VALUES } from './importAliases.js';

function applyCase(value, mode) {
  const s = String(value ?? '');
  if (mode === 'upper') return s.toUpperCase();
  if (mode === 'lower') return s.toLowerCase();
  if (mode === 'title') {
    return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
  return s;
}

/**
 * Parse a number from messy spreadsheet cells.
 * Strips currency symbols, letters, and thousand separators — e.g. "Rs. 1,250.50/-" → 1250.5
 */
export function parseNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const s = String(value).trim();
  if (!s) return null;

  // First run of digits / separators (ignores INR, Rs, USD, approx, etc. around it)
  const chunk = s.match(/-?\d[\d.,]*/);
  if (!chunk) return null;

  let num = chunk[0];

  if (num.includes(',') && num.includes('.')) {
    // Last separator is the decimal point
    if (num.lastIndexOf(',') > num.lastIndexOf('.')) {
      num = num.replace(/\./g, '').replace(',', '.');
    } else {
      num = num.replace(/,/g, '');
    }
  } else if (num.includes(',')) {
    // "1,50" → decimal; "1,500" / "1,50,000" → thousands
    if (/^-?\d+,\d{1,2}$/.test(num)) {
      num = num.replace(',', '.');
    } else {
      num = num.replace(/,/g, '');
    }
  }

  const n = Number(num);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(value, preferredFormat) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const s = String(value).trim();
  if (!s) return null;

  // ISO / YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    let day;
    let month;
    if (preferredFormat === 'MDY') {
      month = a;
      day = b;
    } else {
      // default DMY (common in IN/EU orgs)
      day = a;
      month = b;
      // heuristic: if first > 12, must be DMY; if second > 12, must be MDY
      if (a > 12 && b <= 12) {
        day = a;
        month = b;
      } else if (b > 12 && a <= 12) {
        month = a;
        day = b;
      }
    }
    const d = new Date(Date.UTC(y, month - 1, day));
    if (d.getUTCFullYear() === y && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return d;
    }
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function parseBoolean(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(s)) return true;
  if (['false', 'no', 'n', '0'].includes(s)) return false;
  return null;
}

export function transformCell(rawValue, fieldDef, transform = {}, valueMap = {}) {
  let value = rawValue;
  if (value == null) value = '';
  value = String(value);

  if (transform.trim !== false) value = value.trim();
  if (transform.case) value = applyCase(value, transform.case);

  if (!value) {
    if (transform.emptyTo != null && transform.emptyTo !== '') return transform.emptyTo;
    return '';
  }

  // Explicit value mapping wins (empty string = keep original / not chosen yet)
  if (valueMap && Object.prototype.hasOwnProperty.call(valueMap, value)) {
    const mapped = valueMap[value];
    if (mapped !== '' && mapped != null) return mapped;
  }
  // Case-insensitive map lookup
  if (valueMap) {
    const hit = Object.entries(valueMap).find(([k]) => k.toLowerCase() === value.toLowerCase());
    if (hit && hit[1] !== '' && hit[1] != null) return hit[1];
  }

  const type = fieldDef?.type || 'text';
  if (fieldDef?.key === 'status' || type === 'status') {
    const suggested = suggestStatusValue(value, fieldDef?.options || []);
    return suggested || value;
  }
  if (fieldDef?.key === 'condition') {
    const allowed = fieldDef?.options?.length ? fieldDef.options : ASSET_CONDITION_VALUES;
    const suggested = suggestConditionValue(value, allowed);
    // Never leave an invalid enum — default to good
    return suggested || 'good';
  }
  // Case-insensitive match against allowed options (category, custom selects)
  if ((type === 'select' || type === 'radio' || fieldDef?.key === 'category') && fieldDef?.options?.length) {
    const exact = fieldDef.options.find((o) => String(o) === value);
    if (exact != null) return exact;
    const ci = fieldDef.options.find((o) => String(o).toLowerCase() === value.toLowerCase());
    if (ci != null) return ci;
  }
  if (type === 'number' || fieldDef?.key === 'cost') {
    const n = parseNumber(value);
    // Prefer extracted number; empty/unparseable → '' so required checks can run
    return n == null ? '' : n;
  }
  if (type === 'date' || /date|expiry/i.test(fieldDef?.key || '')) {
    return parseDate(value, transform.dateFormat);
  }
  if (type === 'checkbox' || type === 'boolean') {
    return parseBoolean(value);
  }
  if (type === 'tags' || type === 'multiselect') {
    return value
      .split(/[,|;]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return value;
}

/**
 * Apply column mappings + transforms to a raw row.
 * Returns { mapped, ignoredColumns }
 */
export function mapRawRow(raw, columnMappings = [], fieldByKey = new Map(), transforms = {}, valueMappings = {}) {
  const mapped = {};
  for (const mapping of columnMappings) {
    if (!mapping || mapping.ignored || !mapping.targetField) continue;
    const source = mapping.sourceColumn;
    const target = mapping.targetField;
    const fieldDef = fieldByKey.get(target) || { key: target, type: 'text' };
    const transform = transforms[target] || transforms.get?.(target) || {};
    const valueMap = valueMappings[target] || valueMappings.get?.(target) || {};
    mapped[target] = transformCell(raw?.[source], fieldDef, transform, valueMap);
  }
  return mapped;
}

export function mapToObject(mapLike) {
  if (!mapLike) return {};
  if (mapLike instanceof Map) return Object.fromEntries(mapLike.entries());
  if (typeof mapLike.toObject === 'function') return mapLike.toObject();
  return { ...mapLike };
}
