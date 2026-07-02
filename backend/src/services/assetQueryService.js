import mongoose from 'mongoose';
import { Location } from '../models/index.js';

const SORT_FIELDS = new Set([
  'purchaseDate',
  'createdAt',
  'updatedAt',
  'cost',
  'name',
  'assetId',
  'category',
  'status',
  'warrantyExpiry',
  'serialNumber',
  'model',
]);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseFilters(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function customFieldPathExists(path) {
  return { [path]: { $exists: true, $nin: [null, ''] } };
}

function isNumericFilterValue(strVal) {
  if (strVal === '' || strVal == null) return false;
  const num = Number(strVal);
  return !Number.isNaN(num);
}

/** Strict numeric match on a custom field — field must exist and value must equal exactly */
function buildCustomFieldNumericClause(path, operator, strVal) {
  const num = Number(strVal);
  if (Number.isNaN(num)) return null;

  const fieldRef = `$${path}`;
  const asDouble = {
    $convert: { input: fieldRef, to: 'double', onError: null, onNull: null },
  };

  const exprByOp = {
    eq: { $eq: [asDouble, num] },
    ne: { $ne: [asDouble, num] },
    gt: { $gt: [asDouble, num] },
    gte: { $gte: [asDouble, num] },
    lt: { $lt: [asDouble, num] },
    lte: { $lte: [asDouble, num] },
  };
  const expr = exprByOp[operator];
  if (!expr) return null;

  return {
    $and: [customFieldPathExists(path), { $expr: expr }],
  };
}

function buildNumericClause(path, operator, strVal) {
  const num = Number(strVal);
  if (Number.isNaN(num)) return null;
  const ops = {
    eq: num,
    ne: { $ne: num },
    gt: { $gt: num },
    gte: { $gte: num },
    lt: { $lt: num },
    lte: { $lte: num },
  };
  const clause = ops[operator];
  return clause !== undefined ? { [path]: clause } : null;
}

function buildDateClause(path, operator, strVal) {
  const d = new Date(strVal);
  if (Number.isNaN(d.getTime())) return null;
  if (operator === 'eq') {
    return { [path]: { $gte: startOfDay(d), $lte: endOfDay(d) } };
  }
  if (operator === 'before' || operator === 'lt') return { [path]: { $lt: startOfDay(d) } };
  if (operator === 'after' || operator === 'gt') return { [path]: { $gt: endOfDay(d) } };
  if (operator === 'on_or_before' || operator === 'lte') return { [path]: { $lte: endOfDay(d) } };
  if (operator === 'on_or_after' || operator === 'gte') return { [path]: { $gte: startOfDay(d) } };
  return null;
}

const NUMERIC_OPERATORS = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']);
const DATE_OPERATORS = new Set(['eq', 'before', 'after', 'on_or_before', 'on_or_after', 'lt', 'gt', 'lte', 'gte']);

function buildAdvancedFilterClause({ field, operator, value }) {
  if (!field || !operator) return null;

  const isCustom = field.startsWith('custom:');
  const key = isCustom ? field.slice(7) : field;
  const path = isCustom ? `customFields.${key}` : key;

  const emptyOps = ['empty', 'not_empty'];
  if (emptyOps.includes(operator)) {
    if (operator === 'empty') {
      return { $or: [{ [path]: null }, { [path]: '' }, { [path]: { $exists: false } }] };
    }
    return { [path]: { $exists: true, $nin: [null, ''] } };
  }

  if (value === undefined || value === null || value === '') return null;

  const strVal = String(value).trim();
  if (!strVal) return null;

  // Custom fields: require the field to exist and match exactly (never substring-match numbers)
  if (isCustom) {
    const numericOp =
      NUMERIC_OPERATORS.has(operator) || (operator === 'contains' && isNumericFilterValue(strVal));
    if (numericOp) {
      const op = operator === 'contains' ? 'eq' : operator;
      return buildCustomFieldNumericClause(path, op, strVal);
    }

    if (DATE_OPERATORS.has(operator)) {
      const dateClause = buildDateClause(path, operator, strVal);
      if (!dateClause) return null;
      return { $and: [customFieldPathExists(path), dateClause] };
    }

    if (operator === 'eq') {
      return { $and: [customFieldPathExists(path), { [path]: strVal }] };
    }
    if (operator === 'ne') {
      return { $and: [customFieldPathExists(path), { [path]: { $ne: strVal } }] };
    }
    if (operator === 'contains') {
      return {
        $and: [customFieldPathExists(path), { [path]: new RegExp(escapeRegex(strVal), 'i') }],
      };
    }
    if (operator === 'starts_with') {
      return {
        $and: [
          customFieldPathExists(path),
          { [path]: new RegExp(`^${escapeRegex(strVal)}`, 'i') },
        ],
      };
    }
    return null;
  }

  if (['locationId', 'departmentId', 'vendorId', 'assignedTo', 'groupId'].includes(key)) {
    if (!mongoose.Types.ObjectId.isValid(strVal)) return null;
    const oid = new mongoose.Types.ObjectId(strVal);
    if (operator === 'eq') return { [path]: oid };
    if (operator === 'ne') return { [path]: { $ne: oid } };
    return null;
  }

  if (['cost'].includes(key) && NUMERIC_OPERATORS.has(operator)) {
    return buildNumericClause(path, operator, strVal);
  }

  if (['purchaseDate', 'warrantyExpiry', 'amcExpiry', 'nextMaintenanceDate', 'createdAt', 'updatedAt'].includes(key)) {
    return buildDateClause(path, operator, strVal);
  }

  const re = new RegExp(escapeRegex(strVal), 'i');
  if (operator === 'contains') return { [path]: re };
  if (operator === 'eq') return { [path]: strVal };
  if (operator === 'ne') return { [path]: { $ne: strVal } };
  if (operator === 'starts_with') return { [path]: new RegExp(`^${escapeRegex(strVal)}`, 'i') };

  return null;
}

function parseLocationIds(query) {
  const ids = new Set();
  if (query.locationIds) {
    String(query.locationIds)
      .split(',')
      .map((s) => s.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .forEach((id) => ids.add(id));
  }
  if (query.locationId && mongoose.Types.ObjectId.isValid(query.locationId)) {
    ids.add(String(query.locationId));
  }
  return [...ids];
}

async function buildLocationFilter(organizationId, locationIds, includeChildren) {
  const oids = locationIds.map((id) => new mongoose.Types.ObjectId(id));
  if (!includeChildren) {
    return { locationId: { $in: oids } };
  }

  const allIds = new Set(locationIds.map(String));
  const selected = await Location.find({ _id: { $in: oids }, organizationId })
    .select('path name')
    .lean();

  for (const loc of selected) {
    allIds.add(String(loc._id));
    const prefix = loc.path || loc.name;
    if (!prefix) continue;
    const descendants = await Location.find({
      organizationId,
      path: new RegExp(`^${escapeRegex(prefix)}(/|$)`),
    })
      .select('_id')
      .lean();
    descendants.forEach((d) => allIds.add(String(d._id)));
  }

  return {
    locationId: {
      $in: [...allIds].map((id) => new mongoose.Types.ObjectId(id)),
    },
  };
}

export async function buildAssetListQuery(baseFilter, query) {
  const filter = { ...baseFilter };
  const {
    category,
    status,
    search,
    assignedTo,
    departmentId,
    filters: filtersRaw,
    locationIncludeChildren,
    groupId,
  } = query;

  if (category) filter.category = category;
  const locationIds = parseLocationIds(query);
  if (locationIds.length) {
    const includeChildren = locationIncludeChildren !== 'false';
    const locationClause = await buildLocationFilter(
      baseFilter.organizationId,
      locationIds,
      includeChildren
    );
    Object.assign(filter, locationClause);
  }
  if (status) filter.status = status;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (departmentId) filter.departmentId = departmentId;
  if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
    filter.groupId = new mongoose.Types.ObjectId(groupId);
  }

  const advanced = parseFilters(filtersRaw);
  const advancedClauses = advanced.map(buildAdvancedFilterClause).filter(Boolean);
  if (advancedClauses.length) {
    filter.$and = [...(filter.$and || []), ...advancedClauses];
  }

  if (search && String(search).trim()) {
    const term = String(search).trim();
    const re = new RegExp(escapeRegex(term), 'i');
    const searchOr = [
      { name: re },
      { assetId: re },
      { serialNumber: re },
      { model: re },
      { category: re },
      { assignedToName: re },
      { assignedToEmployeeCode: re },
      { status: re },
      { tags: re },
    ];
    if (filter.$or) {
      filter.$and = [...(filter.$and || []), { $or: filter.$or }, { $or: searchOr }];
      delete filter.$or;
    } else {
      filter.$or = searchOr;
    }
  }

  return filter;
}

export function resolveAssetSort(sort, order) {
  const sortKey = SORT_FIELDS.has(sort) ? sort : 'createdAt';
  const sortOrder = order === 'asc' ? 1 : -1;
  return { [sortKey]: sortOrder };
}

export { SORT_FIELDS };
