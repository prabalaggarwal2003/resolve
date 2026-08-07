/** Field-level diffs and audit payloads for Report Studio mutations. */

const DEFINITION_FIELD_LABELS = {
  name: 'Name',
  description: 'Description',
  kind: 'Kind',
  scope: 'Scope',
  category: 'Category',
  published: 'Published',
  quickKey: 'Quick report key',
};

const CONFIG_FIELD_LABELS = {
  primarySource: 'Primary source',
  dataSources: 'Data sources',
  fields: 'Fields',
  filters: 'Filters',
  groupBy: 'Group by',
  sort: 'Sort',
  calculations: 'Calculations',
  visualization: 'Visualization',
  formatting: 'Formatting',
  exportOptions: 'Export options',
};

const SETTINGS_FIELD_LABELS = {
  defaultFilenameFormat: 'Filename format',
};

const FORMATTING_FIELD_LABELS = {
  header: 'Header',
  footer: 'Footer',
  watermark: 'Watermark',
  orientation: 'Orientation',
  paperSize: 'Paper size',
};

const SCHEDULE_FIELD_LABELS = {
  name: 'Name',
  reportId: 'Report',
  enabled: 'Enabled',
  frequency: 'Frequency',
  dayOfWeek: 'Day of week',
  dayOfMonth: 'Day of month',
  timeOfDay: 'Time of day',
  timezone: 'Timezone',
  exportFormat: 'Export format',
  recipients: 'Recipients',
};

function toPlain(value) {
  if (value == null) return value;
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
}

function normalizeValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(toPlain(value));
  return String(value);
}

function displayValue(value) {
  if (value == null || value === '') return '(empty)';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)';
    // Keep small arrays readable; summarize large ones.
    if (value.length <= 8 && value.every((v) => typeof v !== 'object' || v == null)) {
      return value.map((v) => (v == null || v === '' ? '(empty)' : String(v))).join(', ');
    }
    return `${value.length} item(s)`;
  }
  if (typeof value === 'object') {
    const plain = toPlain(value);
    if (plain && typeof plain === 'object' && !Array.isArray(plain)) {
      if (plain.type && Object.keys(plain).length <= 3) {
        return String(plain.type);
      }
      if (plain.logic != null && Array.isArray(plain.conditions)) {
        return `${plain.logic.toUpperCase()}, ${plain.conditions.length} condition(s)`;
      }
    }
    const json = JSON.stringify(plain);
    return json.length > 240 ? `${json.slice(0, 237)}…` : json;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function humanizeKey(key) {
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function toAuditFieldChanges(changes = []) {
  return (Array.isArray(changes) ? changes : []).map((c) => {
    const hasFrom = c.from !== undefined || c.oldValue !== undefined;
    const fromRaw = hasFrom ? (c.oldValue ?? c.from) : undefined;
    const toRaw = c.newValue ?? c.to ?? '';
    const fromStr =
      fromRaw === undefined || fromRaw === null || fromRaw === ''
        ? ''
        : String(fromRaw);
    const toStr = toRaw === undefined || toRaw === null || toRaw === '' ? '' : String(toRaw);
    return {
      field: c.field || '',
      label: c.label || humanizeKey(c.field || 'field'),
      oldValue: fromStr,
      newValue: toStr,
      from: fromStr,
      to: toStr,
    };
  });
}

export function formatReportFieldChangesSummary(resourceName, changes = []) {
  const name = resourceName || 'Report';
  const list = toAuditFieldChanges(changes);
  if (!list.length) return `${name}: updated`;
  const parts = list.map((c) => {
    const blankOld = !c.oldValue || c.oldValue === '—' || c.oldValue === '(empty)';
    if (blankOld) return `${c.label}: ${c.newValue || '—'}`;
    return `${c.label}: ${c.oldValue} → ${c.newValue}`;
  });
  const joined = parts.join('; ');
  if (joined.length <= 280) return `${name}: ${joined}`;
  return `${name}: ${list.map((c) => c.label).join(', ')} updated`;
}

export function reportAuditDetails(resourceName, changes = [], extra = {}) {
  const fieldChanges = toAuditFieldChanges(changes);
  return {
    fieldChanges,
    changes: fieldChanges,
    summary: formatReportFieldChangesSummary(resourceName, fieldChanges),
    ...extra,
  };
}

function pushChange(changes, field, label, from, to) {
  if (normalizeValue(from) === normalizeValue(to)) return;
  changes.push({
    field,
    label,
    from: displayValue(from),
    to: displayValue(to),
  });
}

function diffLabeledFields(prev = {}, next = {}, labels = {}, { fieldPrefix = '' } = {}) {
  const changes = [];
  for (const [field, label] of Object.entries(labels)) {
    if (!(field in next) && !(field in prev)) continue;
    if (!(field in next)) continue;
    pushChange(
      changes,
      fieldPrefix ? `${fieldPrefix}.${field}` : field,
      label,
      prev?.[field],
      next?.[field]
    );
  }
  return changes;
}

/** Diff report definition scalar fields + config subsections. */
export function diffReportDefinition(prev = {}, next = {}) {
  const before = toPlain(prev) || {};
  const after = toPlain(next) || {};
  const changes = diffLabeledFields(before, after, DEFINITION_FIELD_LABELS);

  const prevConfig = toPlain(before.config) || {};
  const nextConfig = toPlain(after.config) || {};
  if (after.config !== undefined || before.config !== undefined) {
    for (const [field, label] of Object.entries(CONFIG_FIELD_LABELS)) {
      if (!(field in nextConfig) && !(field in prevConfig)) continue;
      // Only compare keys present on either side when config is being updated
      pushChange(changes, `config.${field}`, label, prevConfig[field], nextConfig[field]);
    }
  }

  return changes;
}

/** Snapshot of definition fields for create audits (value-only, no empty →). */
export function snapshotDefinitionFields(doc = {}) {
  const plain = toPlain(doc) || {};
  const config = toPlain(plain.config) || {};
  const changes = [];
  for (const [field, label] of Object.entries(DEFINITION_FIELD_LABELS)) {
    if (plain[field] == null || plain[field] === '') continue;
    changes.push({
      field,
      label,
      to: displayValue(plain[field]),
    });
  }
  for (const [field, label] of Object.entries(CONFIG_FIELD_LABELS)) {
    if (config[field] == null) continue;
    const empty =
      (Array.isArray(config[field]) && config[field].length === 0) ||
      (typeof config[field] === 'object' &&
        !Array.isArray(config[field]) &&
        Object.keys(config[field]).length === 0);
    if (empty) continue;
    changes.push({
      field: `config.${field}`,
      label,
      to: displayValue(config[field]),
    });
  }
  return changes;
}

export function diffReportSettings(prev = {}, next = {}) {
  const before = toPlain(prev) || {};
  const after = toPlain(next) || {};
  const changes = diffLabeledFields(before, after, SETTINGS_FIELD_LABELS);

  const prevFmt = toPlain(before.defaultFormatting) || {};
  const nextFmt = toPlain(after.defaultFormatting) || {};
  for (const [key, label] of Object.entries(FORMATTING_FIELD_LABELS)) {
    pushChange(changes, `defaultFormatting.${key}`, label, prevFmt[key], nextFmt[key]);
  }

  const prevBranding = toPlain(before.branding) || {};
  const nextBranding = toPlain(after.branding) || {};
  pushChange(
    changes,
    'branding.companyName',
    'Company name',
    prevBranding.companyName,
    nextBranding.companyName
  );
  if (normalizeValue(prevBranding.logoData) !== normalizeValue(nextBranding.logoData)) {
    changes.push({
      field: 'branding.logoData',
      label: 'Report logo',
      from: prevBranding.logoData ? '(set)' : '(empty)',
      to: nextBranding.logoData ? '(set)' : '(empty)',
    });
  }
  return changes;
}

export function diffReportSchedule(prev = {}, next = {}) {
  const before = toPlain(prev) || {};
  const after = toPlain(next) || {};
  return diffLabeledFields(before, after, SCHEDULE_FIELD_LABELS);
}

export function snapshotScheduleFields(doc = {}) {
  const plain = toPlain(doc) || {};
  const changes = [];
  for (const [field, label] of Object.entries(SCHEDULE_FIELD_LABELS)) {
    if (plain[field] == null || plain[field] === '') continue;
    changes.push({
      field,
      label,
      to: displayValue(plain[field]),
    });
  }
  return changes;
}
