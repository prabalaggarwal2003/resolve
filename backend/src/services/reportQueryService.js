import {
  Asset,
  Issue,
  Vendor,
  Location,
  User,
  AuditLog,
  Budget,
  Procurement,
  Invoice,
} from '../models/index.js';

function empty(val) {
  return val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
}

/** Normalize for tolerant search (case/spacing/punctuation insensitive). */
function normalizeSearch(val) {
  return String(val ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Soft match: substring on normalized text, or all query tokens present. */
function softMatch(haystack, needle) {
  const h = normalizeSearch(haystack);
  const n = normalizeSearch(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  const tokens = n.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => h.includes(t));
}

function matchCondition(row, condition) {
  const { field, op, value, valueTo } = condition;
  const raw = row[field];

  switch (op) {
    case 'eq':
      return normalizeSearch(raw) === normalizeSearch(value);
    case 'neq':
      return normalizeSearch(raw) !== normalizeSearch(value);
    case 'contains':
    case 'search':
      return softMatch(raw, value);
    case 'starts_with':
      return normalizeSearch(raw).startsWith(normalizeSearch(value));
    case 'ends_with':
      return normalizeSearch(raw).endsWith(normalizeSearch(value));
    case 'gt':
      return Number(raw) > Number(value) || (raw instanceof Date && new Date(raw) > new Date(value));
    case 'gte':
      return Number(raw) >= Number(value) || (raw instanceof Date && new Date(raw) >= new Date(value));
    case 'lt':
      return Number(raw) < Number(value) || (raw instanceof Date && new Date(raw) < new Date(value));
    case 'lte':
      return Number(raw) <= Number(value) || (raw instanceof Date && new Date(raw) <= new Date(value));
    case 'between': {
      if (raw instanceof Date || (typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) && Number.isNaN(Number(raw)))) {
        const t = new Date(raw).getTime();
        return t >= new Date(value).getTime() && t <= new Date(valueTo).getTime();
      }
      return Number(raw) >= Number(value) && Number(raw) <= Number(valueTo);
    }
    case 'in': {
      const list = Array.isArray(value)
        ? value
        : String(value || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      return list.some((item) => softMatch(raw, item) || normalizeSearch(raw) === normalizeSearch(item));
    }
    case 'is_empty':
      return empty(raw);
    case 'is_not_empty':
      return !empty(raw);
    default:
      return true;
  }
}

function matchFilterGroup(row, group) {
  if (!group) return true;
  const logic = group.logic === 'or' ? 'or' : 'and';
  const conditions = group.conditions || [];
  const groups = group.groups || [];

  if (!conditions.length && !groups.length) return true;

  const condResults = conditions.map((c) => matchCondition(row, c));
  const groupResults = groups.map((g) => matchFilterGroup(row, g));
  const all = [...condResults, ...groupResults];

  return logic === 'or' ? all.some(Boolean) : all.every(Boolean);
}

function hydrateAsset(doc) {
  const custom = doc.customFields || {};
  const row = {
    _id: String(doc._id),
    assetId: doc.assetId,
    name: doc.name,
    category: doc.category,
    model: doc.model,
    serialNumber: doc.serialNumber,
    status: doc.status,
    condition: doc.condition,
    purchaseDate: doc.purchaseDate,
    cost: doc.cost,
    vendor: doc.vendor,
    warrantyExpiry: doc.warrantyExpiry,
    amcExpiry: doc.amcExpiry,
    nextMaintenanceDate: doc.nextMaintenanceDate,
    assignedToName: doc.assignedToName,
    assignedToEmployeeCode: doc.assignedToEmployeeCode,
    maintenanceReason: doc.maintenanceReason,
    maintenanceStartDate: doc.maintenanceStartDate,
    maintenanceCompletedDate: doc.maintenanceCompletedDate,
    locationName: doc.locationId?.path || doc.locationId?.name || '',
    departmentName: doc.departmentId?.name || '',
    vendorName: doc.vendorId?.name || doc.vendor || '',
    assignedUserName: doc.assignedTo?.name || doc.assignedToName || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  for (const [k, v] of Object.entries(custom)) {
    row[`custom.${k}`] = v;
  }
  return row;
}

function hydrateIssue(doc) {
  return {
    _id: String(doc._id),
    ticketId: doc.ticketId,
    title: doc.title,
    category: doc.category,
    status: doc.status,
    priority: doc.priority,
    reporterName: doc.reporterName,
    assetName: doc.assetId?.name || '',
    assetTag: doc.assetId?.assetId || '',
    locationName: doc.locationId?.path || doc.locationId?.name || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function hydrateMaintenance(doc) {
  const start = doc.maintenanceStartDate ? new Date(doc.maintenanceStartDate) : null;
  const days = start ? Math.floor((Date.now() - start.getTime()) / 86400000) : null;
  const row = hydrateAsset(doc);
  row.daysUnderMaintenance = days;
  return row;
}

function hydrateVendor(doc) {
  return {
    _id: String(doc._id),
    vendorId: doc.vendorId,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    category: doc.category,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

function hydrateLocation(doc) {
  return {
    _id: String(doc._id),
    name: doc.name,
    path: doc.path,
    type: doc.type,
    createdAt: doc.createdAt,
  };
}

function hydrateUser(doc) {
  return {
    _id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    isActive: doc.isActive !== false,
    lastLogin: doc.lastLogin,
    createdAt: doc.createdAt,
  };
}

function hydrateAudit(doc) {
  return {
    _id: String(doc._id),
    action: doc.action,
    resource: doc.resource,
    resourceName: doc.resourceName,
    description: doc.description,
    severity: doc.severity,
    userName: doc.userId?.name || 'System',
    createdAt: doc.createdAt,
  };
}

function hydrateBudget(doc) {
  const allocated = Number(doc.allocatedAmount) || 0;
  const spent = Number(doc.actualSpend) || 0;
  const row = {
    _id: String(doc._id),
    name: doc.name,
    code: doc.code,
    budgetTypeId: doc.budgetTypeId,
    status: doc.status,
    allocatedAmount: allocated,
    actualSpend: spent,
    remaining: allocated - spent,
    financialYear: doc.financialYear,
    createdAt: doc.createdAt,
  };
  for (const [k, v] of Object.entries(doc.customFields || {})) {
    row[`custom.${k}`] = v;
  }
  return row;
}

function hydrateProcurement(doc) {
  const row = {
    _id: String(doc._id),
    purchaseId: doc.purchaseId,
    purchaseOrderNumber: doc.purchaseOrderNumber,
    lifecycleStage: doc.lifecycleStage,
    paymentStatus: doc.paymentStatus,
    amount: doc.amount,
    totalCost: doc.totalCost,
    vendorName: doc.vendorId?.name || '',
    purchaseDate: doc.purchaseDate,
    createdAt: doc.createdAt,
  };
  for (const [k, v] of Object.entries(doc.customFields || {})) {
    row[`custom.${k}`] = v;
  }
  return row;
}

function hydrateInvoice(doc) {
  return {
    _id: String(doc._id),
    invoiceNumber: doc.invoiceNumber,
    totalAmount: doc.totalAmount,
    paidAmount: doc.paidAmount,
    status: doc.status,
    vendorName: doc.vendorId?.name || '',
    purchaseDate: doc.purchaseDate,
    createdAt: doc.createdAt,
  };
}

async function fetchSourceRows(organizationId, source) {
  switch (source) {
    case 'assets': {
      const docs = await Asset.find({ organizationId })
        .populate('locationId', 'name path')
        .populate('departmentId', 'name')
        .populate('vendorId', 'name')
        .populate('assignedTo', 'name email')
        .lean();
      return docs.map(hydrateAsset);
    }
    case 'maintenance': {
      const docs = await Asset.find({ organizationId, status: 'under_maintenance' })
        .populate('locationId', 'name path')
        .populate('departmentId', 'name')
        .populate('vendorId', 'name')
        .populate('assignedTo', 'name email')
        .lean();
      return docs.map(hydrateMaintenance);
    }
    case 'issues': {
      const docs = await Issue.find({ organizationId })
        .populate('assetId', 'name assetId')
        .populate('locationId', 'name path')
        .lean();
      return docs.map(hydrateIssue);
    }
    case 'vendors': {
      const docs = await Vendor.find({ organizationId }).lean();
      return docs.map(hydrateVendor);
    }
    case 'locations': {
      const docs = await Location.find({ organizationId }).lean();
      return docs.map(hydrateLocation);
    }
    case 'users': {
      const docs = await User.find({ organizationId })
        .select('-passwordHash -twoFactorSecret -backupCodes')
        .lean();
      return docs.map(hydrateUser);
    }
    case 'audits': {
      const docs = await AuditLog.find({ organizationId })
        .sort({ createdAt: -1 })
        .limit(5000)
        .populate('userId', 'name email')
        .lean();
      return docs.map(hydrateAudit);
    }
    case 'budgets': {
      const docs = await Budget.find({ organizationId }).lean();
      return docs.map(hydrateBudget);
    }
    case 'procurement': {
      const docs = await Procurement.find({ organizationId }).populate('vendorId', 'name').lean();
      return docs.map(hydrateProcurement);
    }
    case 'invoices': {
      const docs = await Invoice.find({ organizationId }).populate('vendorId', 'name').lean();
      return docs.map(hydrateInvoice);
    }
    default:
      return [];
  }
}

function applySort(rows, sort) {
  if (!sort?.length) return rows;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const s of sort) {
      const dir = s.dir === 'desc' ? -1 : 1;
      const av = a[s.key];
      const bv = b[s.key];
      if (av == null && bv == null) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av instanceof Date || bv instanceof Date || (!Number.isNaN(Date.parse(av)) && !Number.isNaN(Date.parse(bv)) && Number.isNaN(Number(av)))) {
        const d = new Date(av).getTime() - new Date(bv).getTime();
        if (d !== 0) return d * dir;
        continue;
      }
      if (typeof av === 'number' || typeof bv === 'number') {
        const d = Number(av) - Number(bv);
        if (d !== 0) return d * dir;
        continue;
      }
      const d = String(av).localeCompare(String(bv));
      if (d !== 0) return d * dir;
    }
    return 0;
  });
  return sorted;
}

function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function projectRows(rows, fields) {
  const keys = (fields || []).map((f) => f.key);
  if (!keys.length) return rows;
  return rows.map((row) => {
    const out = { _id: row._id };
    for (const key of keys) out[key] = formatCell(row[key]);
    return out;
  });
}

function computeAggregates(rows, calculations, fields) {
  if (!calculations?.length) return [];
  return calculations.map((calc) => {
    const field = calc.field;
    const values = rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined && v !== '');
    const nums = values.map(Number).filter((n) => !Number.isNaN(n));
    let value = null;
    switch (calc.type) {
      case 'count':
        value = rows.length;
        break;
      case 'distinct':
        value = new Set(values.map(String)).size;
        break;
      case 'sum':
        value = nums.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        break;
      case 'min':
        value = nums.length ? Math.min(...nums) : null;
        break;
      case 'max':
        value = nums.length ? Math.max(...nums) : null;
        break;
      case 'median': {
        if (!nums.length) {
          value = null;
          break;
        }
        const s = [...nums].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        value = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
        break;
      }
      case 'percentage':
        value = rows.length ? Math.round((values.length / rows.length) * 10000) / 100 : 0;
        break;
      case 'running_total':
        value = nums.reduce((a, b) => a + b, 0);
        break;
      default:
        value = null;
    }
    return {
      id: calc.id,
      type: calc.type,
      field,
      label: calc.label || `${calc.type}(${field})`,
      value,
    };
  });
}

function groupRows(rows, groupBy) {
  if (!groupBy?.length) return null;
  const key = groupBy[0].key;
  const map = new Map();
  for (const row of rows) {
    const g = row[key] == null || row[key] === '' ? '(empty)' : String(row[key]);
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(row);
  }
  return [...map.entries()].map(([group, items]) => ({
    group,
    count: items.length,
    rows: items,
  }));
}

function buildChart(rows, config, groups) {
  const viz = config.visualization?.type || 'table';
  if (viz === 'table') return null;

  // Prefer explicit groupBy buckets
  if (groups?.length) {
    return {
      type: viz,
      labels: groups.map((g) => g.group),
      values: groups.map((g) => g.count),
    };
  }

  // Otherwise bucket by first selected field (or first groupable-looking column)
  const groupField =
    config.groupBy?.[0]?.key ||
    config.fields?.find((f) => !['cost', 'amount', 'allocatedAmount', 'actualSpend', 'totalAmount'].includes(f.key))?.key ||
    config.fields?.[0]?.key;

  if (!groupField || !rows?.length) {
    return {
      type: viz,
      labels: ['Records'],
      values: [rows?.length || 0],
    };
  }

  const counts = new Map();
  for (const row of rows) {
    const g = row[groupField] == null || row[groupField] === '' ? '(empty)' : String(row[groupField]);
    counts.set(g, (counts.get(g) || 0) + 1);
  }

  // Cap chart series for readability
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);

  return {
    type: viz,
    labels: entries.map(([k]) => k),
    values: entries.map(([, v]) => v),
  };
}

/**
 * Execute a report configuration.
 * Architecture: data source → filters → sort → project fields → group → calculations → viz.
 */
export async function runReportQuery(organizationId, config, options = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(500, Math.max(1, Number(options.limit) || 50));
  const primary = config.primarySource || config.dataSources?.[0] || 'assets';

  let rows = await fetchSourceRows(organizationId, primary);
  rows = rows.filter((row) => matchFilterGroup(row, config.filters));
  rows = applySort(rows, config.sort);

  const total = rows.length;
  const aggregates = computeAggregates(rows, config.calculations, config.fields);
  const groups = groupRows(rows, config.groupBy);

  // Build chart from full filtered set (not just current page)
  const chart = buildChart(rows, config, groups);

  const start = (page - 1) * limit;
  const pageRows = rows.slice(start, start + limit);
  const projected = projectRows(pageRows, config.fields);

  return {
    primarySource: primary,
    total,
    page,
    limit,
    columns: (config.fields || []).map((f) => ({
      key: f.key,
      label: f.label || f.key,
      source: f.source || primary,
    })),
    rows: projected,
    groups: groups
      ? groups.map((g) => ({ group: g.group, count: g.count }))
      : null,
    aggregates,
    chart,
    visualization: config.visualization?.type || 'table',
  };
}

export function rowsToCsv(result) {
  const cols = result.columns || [];
  const header = cols.map((c) => csvEscape(c.label)).join(',');
  const lines = (result.rows || []).map((row) =>
    cols.map((c) => csvEscape(row[c.key])).join(',')
  );
  return [header, ...lines].join('\n');
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildExportFilename(template, reportName, format) {
  const date = new Date().toISOString().slice(0, 10);
  const base = (template || '{reportName}_{date}')
    .replace('{reportName}', String(reportName || 'report').replace(/[^\w\-]+/g, '_'))
    .replace('{date}', date);
  return `${base}.${format === 'xlsx' ? 'xlsx' : format === 'docx' ? 'docx' : format}`;
}

/**
 * Distinct values for a field (for filter search autocomplete).
 */
export async function getDistinctFieldValues(organizationId, source, field, q = '', limit = 40) {
  const rows = await fetchSourceRows(organizationId, source || 'assets');
  const counts = new Map();
  for (const row of rows) {
    const raw = row[field];
    if (raw === null || raw === undefined || raw === '') continue;
    const label = String(raw);
    if (q && !softMatch(label, q)) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}
