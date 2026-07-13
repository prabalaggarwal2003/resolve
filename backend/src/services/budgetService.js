import Budget from '../models/Budget.js';
import BudgetHistory from '../models/BudgetHistory.js';
import {
  ensureBudgetOrgConfig,
  validateBudgetCustomFields,
  validateBudgetDimensions,
  resolveBudgetStatus,
} from './budgetOrgConfigService.js';
import { countPendingProcurements } from './budgetRollupService.js';
import { diffFields, diffKeyedMap, resolveRefName, displayBasic } from './budgetChangeLog.js';
import { formatChangesSummary } from './assetLogService.js';

const REF_DIMENSION_FIELDS = new Set(['departmentId', 'groupId', 'locationId', 'vendorId', 'templateId']);

async function resolveDimensionValue(config, key, value) {
  if (value == null || value === '') return '—';
  if (REF_DIMENSION_FIELDS.has(key)) return resolveRefName(key, value);
  if (key === 'fundingSourceId') {
    return (config?.fundingSources || []).find((f) => f.id === value)?.name || String(value);
  }
  return displayBasic(value);
}

/** Build the field-level change log for a budget update. */
async function buildBudgetChanges(before, after, config) {
  const scalarChanges = await diffFields(before, after, [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'budgetTypeId', label: 'Budget type', type: 'option', options: config.budgetTypes },
    { key: 'financialYear', label: 'Financial year' },
    { key: 'periodLabel', label: 'Period' },
    { key: 'startDate', label: 'Start date' },
    { key: 'endDate', label: 'End date' },
    { key: 'allocatedAmount', label: 'Allocated amount' },
    { key: 'currency', label: 'Currency' },
    { key: 'status', label: 'Status', type: 'option', options: config.budgetStatuses },
    { key: 'budgetOwnerId', label: 'Budget owner', type: 'ref' },
    { key: 'description', label: 'Description' },
    { key: 'notes', label: 'Notes' },
  ]);

  const dimLabel = (key) => (config.enabledDimensions || []).find((d) => d.key === key)?.label || key;
  const dimensionChanges = await diffKeyedMap(
    before.dimensions,
    after.dimensions,
    'dimensions',
    dimLabel,
    (key, value) => resolveDimensionValue(config, key, value)
  );

  const fieldLabel = (key) => (config.customFields || []).find((f) => f.key === key)?.label || key;
  const customFieldChanges = await diffKeyedMap(
    before.customFields,
    after.customFields,
    'customFields',
    fieldLabel
  );

  return [...scalarChanges, ...dimensionChanges, ...customFieldChanges];
}

export function computeBudgetFinancials(budget) {
  const allocated = budget.allocatedAmount || 0;
  const planned = budget.plannedAmount || 0;
  const committed = budget.committedAmount || 0;
  const actual = budget.actualSpend || 0;
  const effectiveSpend = Math.max(actual, committed);
  const remaining = Math.max(0, allocated - effectiveSpend);
  const available = Math.max(0, allocated - planned);
  const utilizationPct = allocated > 0 ? Math.round((actual / allocated) * 1000) / 10 : 0;

  return {
    allocatedAmount: allocated,
    plannedAmount: planned,
    committedAmount: committed,
    actualSpend: actual,
    remainingAmount: remaining,
    availableBalance: available,
    utilizationPct,
  };
}

export function formatBudget(budget) {
  const plain = budget.toObject ? budget.toObject() : { ...budget };
  return {
    ...plain,
    ...computeBudgetFinancials(plain),
  };
}

async function logBudgetEvent({
  organizationId,
  budgetId,
  eventType,
  label,
  description = '',
  metadata = {},
  changes = [],
  entityLabel = '',
  user,
}) {
  await BudgetHistory.create({
    organizationId,
    entityType: 'budget',
    budgetId,
    entityLabel,
    eventType,
    label,
    description,
    changes,
    metadata,
    userId: user?._id,
    userName: user?.name || '',
  });
}

function buildBudgetQuery(organizationId, filters = {}) {
  const query = { organizationId };

  if (filters.budgetId) query._id = filters.budgetId;
  if (filters.status) query.status = filters.status;
  if (filters.budgetTypeId) query.budgetTypeId = filters.budgetTypeId;
  if (filters.financialYear) query.financialYear = filters.financialYear;
  if (filters.budgetOwnerId) query.budgetOwnerId = filters.budgetOwnerId;
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { code: { $regex: filters.search, $options: 'i' } },
      { financialYear: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const dimensionKeys = [
    'departmentId', 'groupId', 'category', 'templateId', 'locationId',
    'project', 'vendorId', 'costCenter', 'branch', 'campus', 'warehouse',
    'fundingSourceId', 'grant', 'businessUnit',
  ];
  for (const key of dimensionKeys) {
    if (filters[key]) {
      query[`dimensions.${key}`] = filters[key];
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    query.startDate = {};
    if (filters.dateFrom) query.startDate.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      if (!query.startDate) query.startDate = {};
      query.startDate.$lte = end;
    }
  }

  return query;
}

export async function listBudgets(organizationId, filters = {}) {
  const query = buildBudgetQuery(organizationId, filters);
  const budgets = await Budget.find(query)
    .populate('budgetOwnerId', 'name email')
    .populate('createdBy', 'name')
    .sort({ updatedAt: -1 })
    .lean();

  return budgets.map((b) => ({ ...b, ...computeBudgetFinancials(b) }));
}

export async function getBudgetById(organizationId, id) {
  const budget = await Budget.findOne({ _id: id, organizationId })
    .populate('budgetOwnerId', 'name email')
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name');

  if (!budget) return null;
  return formatBudget(budget);
}

export async function getBudgetHistory(organizationId, budgetId, limit = 50) {
  return BudgetHistory.find({ organizationId, budgetId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function listOrganizationBudgetHistory(organizationId, filters = {}, limit = 200) {
  const query = { organizationId };
  if (filters.budgetId) query.budgetId = filters.budgetId;
  if (filters.eventType) query.eventType = filters.eventType;
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  return BudgetHistory.find(query)
    .populate('budgetId', 'name code')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function createBudget(organizationId, user, body) {
  const config = await ensureBudgetOrgConfig(organizationId);

  const dimErrors = validateBudgetDimensions(config, body.dimensions);
  const fieldErrors = validateBudgetCustomFields(config, body.customFields);
  if (dimErrors.length || fieldErrors.length) {
    const err = new Error([...dimErrors, ...fieldErrors].join('; '));
    err.status = 400;
    throw err;
  }

  const status = body.status || resolveBudgetStatus(config, 'draft')?.id || 'draft';

  const budget = await Budget.create({
    organizationId,
    name: body.name?.trim(),
    code: body.code?.trim() || '',
    budgetTypeId: body.budgetTypeId || config.budgetTypes?.find((t) => t.isDefault)?.id || 'annual',
    financialYear: body.financialYear?.trim() || '',
    periodLabel: body.periodLabel?.trim() || '',
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    allocatedAmount: Number(body.allocatedAmount) || 0,
    currency: body.currency?.trim() || 'INR',
    budgetOwnerId: body.budgetOwnerId || user._id,
    description: body.description || '',
    status,
    notes: body.notes || '',
    dimensions: body.dimensions || {},
    customFields: body.customFields || {},
    createdBy: user._id,
    updatedBy: user._id,
  });

  await logBudgetEvent({
    organizationId,
    budgetId: budget._id,
    entityLabel: budget.name,
    eventType: 'budget_created',
    label: 'Budget created',
    description: `Budget "${budget.name}" created`,
    metadata: { allocatedAmount: budget.allocatedAmount },
    user,
  });

  return formatBudget(budget);
}

export async function updateBudget(organizationId, user, id, body) {
  const config = await ensureBudgetOrgConfig(organizationId);
  const budget = await Budget.findOne({ _id: id, organizationId });
  if (!budget) {
    const err = new Error('Budget not found');
    err.status = 404;
    throw err;
  }

  const before = budget.toObject();
  const prevAllocated = budget.allocatedAmount;
  const prevStatus = budget.status;

  if (body.dimensions) {
    const dimErrors = validateBudgetDimensions(config, body.dimensions);
    if (dimErrors.length) {
      const err = new Error(dimErrors.join('; '));
      err.status = 400;
      throw err;
    }
    budget.dimensions = body.dimensions;
  }
  if (body.customFields) {
    const fieldErrors = validateBudgetCustomFields(config, body.customFields);
    if (fieldErrors.length) {
      const err = new Error(fieldErrors.join('; '));
      err.status = 400;
      throw err;
    }
    budget.customFields = body.customFields;
  }

  const scalarFields = [
    'name', 'code', 'budgetTypeId', 'financialYear', 'periodLabel',
    'currency', 'description', 'notes', 'budgetOwnerId', 'status',
  ];
  for (const key of scalarFields) {
    if (body[key] !== undefined) budget[key] = body[key];
  }
  if (body.startDate !== undefined) budget.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) budget.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.allocatedAmount !== undefined) budget.allocatedAmount = Number(body.allocatedAmount) || 0;

  budget.updatedBy = user._id;
  await budget.save();

  const changes = await buildBudgetChanges(before, budget.toObject(), config);

  if (changes.length) {
    const allocationChanged = budget.allocatedAmount !== prevAllocated;
    const statusChanged = body.status && body.status !== prevStatus;

    let eventType = 'budget_updated';
    let label = 'Budget updated';
    if (allocationChanged) {
      eventType = budget.allocatedAmount > prevAllocated ? 'allocation_increased' : 'allocation_reduced';
      label = eventType === 'allocation_increased' ? 'Allocation increased' : 'Allocation reduced';
    } else if (statusChanged) {
      eventType = budget.status === 'closed' || budget.status === 'archived' ? 'budget_closed' : 'status_changed';
      label = 'Status changed';
    }

    const description = formatChangesSummary(
      changes.map((c) => ({ field: c.field, label: c.label, oldValue: c.from, newValue: c.to }))
    ) || label;

    await logBudgetEvent({
      organizationId,
      budgetId: budget._id,
      entityLabel: budget.name,
      eventType,
      label,
      description,
      changes,
      metadata: allocationChanged ? { from: prevAllocated, to: budget.allocatedAmount } : {},
      user,
    });
  }

  return { budget: formatBudget(budget), changes };
}

export async function deleteBudget(organizationId, id) {
  const budget = await Budget.findOneAndDelete({ _id: id, organizationId });
  if (!budget) {
    const err = new Error('Budget not found');
    err.status = 404;
    throw err;
  }
  await BudgetHistory.deleteMany({ budgetId: id });
  return budget;
}

export async function getBudgetSummary(organizationId) {
  const config = await ensureBudgetOrgConfig(organizationId);
  const budgets = await listBudgets(organizationId, {});
  const active = budgets.filter((b) => b.status === 'active');
  const totalAllocated = budgets.reduce((s, b) => s + (b.allocatedAmount || 0), 0);
  const totalSpend = budgets.reduce((s, b) => s + (b.actualSpend || 0), 0);
  const totalRemaining = budgets.reduce((s, b) => s + (b.remainingAmount || 0), 0);
  const utilizationPct = totalAllocated > 0 ? Math.round((totalSpend / totalAllocated) * 1000) / 10 : 0;

  const warnPct = config.settings?.warnThresholdPct ?? 80;
  const nearLimit = budgets.filter((b) => {
    const u = b.utilizationPct || 0;
    return u >= warnPct && u < 100;
  }).length;
  const exceeded = budgets.filter((b) => (b.utilizationPct || 0) >= 100).length;
  const pendingPurchaseRequests = await countPendingProcurements(organizationId);

  return {
    totalBudget: totalAllocated,
    totalSpend,
    remainingBudget: totalRemaining,
    utilizationPct,
    activeBudgets: active.length,
    totalBudgets: budgets.length,
    budgetsNearLimit: nearLimit,
    budgetsExceeded: exceeded,
    pendingPurchaseRequests,
  };
}
