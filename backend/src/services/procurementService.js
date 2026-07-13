import Procurement from '../models/Procurement.js';
import BudgetHistory from '../models/BudgetHistory.js';
import Asset from '../models/Asset.js';
import { generatePurchaseId } from './purchaseIdGenerator.js';
import {
  ensureBudgetOrgConfig,
  validateBudgetDimensions,
} from './budgetOrgConfigService.js';
import {
  recalculateBudgetsForProcurement,
  recalculateBudgetRollups,
} from './budgetRollupService.js';
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

/** Build the field-level change log for a procurement update. */
async function buildProcurementChanges(before, after, config) {
  const scalarChanges = await diffFields(before, after, [
    { key: 'purchaseOrderNumber', label: 'PO number' },
    { key: 'invoiceNumber', label: 'Invoice number' },
    { key: 'vendorId', label: 'Vendor', type: 'ref' },
    { key: 'purchaseDate', label: 'Purchase date' },
    { key: 'budgetId', label: 'Budget', type: 'ref' },
    { key: 'departmentId', label: 'Department', type: 'ref' },
    { key: 'amount', label: 'Amount' },
    { key: 'tax', label: 'Tax' },
    { key: 'discount', label: 'Discount' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'lifecycleStage', label: 'Lifecycle stage', type: 'option', options: config.procurementLifecycleStages },
    { key: 'paymentStatus', label: 'Payment status', type: 'option', options: config.procurementPaymentStatuses },
    { key: 'fundingSourceId', label: 'Funding source', type: 'option', options: config.fundingSources },
    { key: 'costCenter', label: 'Cost center' },
    { key: 'project', label: 'Project' },
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

  const fieldLabel = (key) => (config.procurementCustomFields || []).find((f) => f.key === key)?.label || key;
  const customFieldChanges = await diffKeyedMap(
    before.customFields,
    after.customFields,
    'customFields',
    fieldLabel
  );

  return [...scalarChanges, ...dimensionChanges, ...customFieldChanges];
}

async function logProcurementEvent({
  organizationId,
  procurement,
  eventType,
  label,
  description = '',
  changes = [],
  metadata = {},
  user,
}) {
  await BudgetHistory.create({
    organizationId,
    entityType: 'procurement',
    procurementId: procurement._id,
    budgetId: procurement.budgetId || null,
    entityLabel: procurement.purchaseId,
    eventType,
    label,
    description,
    changes,
    metadata,
    userId: user?._id,
    userName: user?.name || '',
  });
}

function computeTotalCost(body) {
  const amount = Number(body.amount) || 0;
  const tax = Number(body.tax) || 0;
  const discount = Number(body.discount) || 0;
  const shipping = Number(body.shipping) || 0;
  return Math.max(0, amount + tax - discount + shipping);
}

function validateProcurementCustomFields(config, customFields = {}) {
  const errors = [];
  for (const field of config.procurementCustomFields || []) {
    if (!field.required) continue;
    const val = customFields[field.key];
    if (val == null || val === '') errors.push(`${field.label} is required`);
  }
  return errors;
}

function resolveDefaultLifecycle(config) {
  const stages = config.procurementLifecycleStages || [];
  return stages.find((s) => s.isDefault)?.id || stages[0]?.id || 'planned';
}

function resolveDefaultPayment(config) {
  const statuses = config.procurementPaymentStatuses || [];
  return statuses.find((s) => s.isDefault)?.id || statuses[0]?.id || 'unpaid';
}

async function logBudgetPurchaseEvent({
  organizationId,
  budgetId,
  eventType,
  label,
  description,
  metadata,
  user,
}) {
  if (!budgetId) return;
  await BudgetHistory.create({
    organizationId,
    budgetId,
    eventType,
    label,
    description,
    metadata,
    userId: user?._id,
    userName: user?.name || '',
  });
}

function buildProcurementQuery(organizationId, filters = {}) {
  const query = { organizationId };
  if (filters.budgetId) query.budgetId = filters.budgetId;
  if (filters.vendorId) query.vendorId = filters.vendorId;
  if (filters.departmentId) query.departmentId = filters.departmentId;
  if (filters.lifecycleStage) query.lifecycleStage = filters.lifecycleStage;
  if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
  if (filters.fundingSourceId) query.fundingSourceId = filters.fundingSourceId;
  if (filters.project) query.project = filters.project;
  if (filters.costCenter) query.costCenter = filters.costCenter;
  if (filters.search) {
    query.$or = [
      { purchaseId: { $regex: filters.search, $options: 'i' } },
      { purchaseOrderNumber: { $regex: filters.search, $options: 'i' } },
      { invoiceNumber: { $regex: filters.search, $options: 'i' } },
      { notes: { $regex: filters.search, $options: 'i' } },
    ];
  }
  if (filters.dateFrom || filters.dateTo) {
    query.purchaseDate = {};
    if (filters.dateFrom) query.purchaseDate.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      query.purchaseDate.$lte = end;
    }
  }
  return query;
}

export function formatProcurement(doc) {
  const plain = doc.toObject ? doc.toObject() : { ...doc };
  return {
    ...plain,
    totalCost: plain.totalCost ?? computeTotalCost(plain),
  };
}

export async function listProcurements(organizationId, filters = {}) {
  const query = buildProcurementQuery(organizationId, filters);
  const items = await Procurement.find(query)
    .populate('vendorId', 'name vendorId')
    .populate('budgetId', 'name code currency')
    .populate('departmentId', 'name')
    .populate('createdBy', 'name')
    .sort({ updatedAt: -1 })
    .lean();

  return items.map((p) => ({ ...p, totalCost: p.totalCost ?? computeTotalCost(p) }));
}

export async function getProcurementById(organizationId, id) {
  const item = await Procurement.findOne({ _id: id, organizationId })
    .populate('vendorId', 'name vendorId email phone')
    .populate('budgetId', 'name code currency allocatedAmount')
    .populate('departmentId', 'name')
    .populate('assetIds', 'assetId name cost status')
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name');

  if (!item) return null;
  return formatProcurement(item);
}

export async function createProcurement(organizationId, user, body) {
  const config = await ensureBudgetOrgConfig(organizationId);

  const dimErrors = validateBudgetDimensions(config, body.dimensions);
  const fieldErrors = validateProcurementCustomFields(config, body.customFields);
  if (dimErrors.length || fieldErrors.length) {
    const err = new Error([...dimErrors, ...fieldErrors].join('; '));
    err.status = 400;
    throw err;
  }

  const purchaseId = await generatePurchaseId(organizationId);
  const lifecycleStage = body.lifecycleStage || resolveDefaultLifecycle(config);
  const paymentStatus = body.paymentStatus || resolveDefaultPayment(config);

  const procurement = await Procurement.create({
    organizationId,
    purchaseId,
    purchaseOrderNumber: body.purchaseOrderNumber?.trim() || '',
    invoiceNumber: body.invoiceNumber?.trim() || '',
    vendorId: body.vendorId || null,
    purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
    budgetId: body.budgetId || null,
    departmentId: body.departmentId || null,
    amount: Number(body.amount) || 0,
    tax: Number(body.tax) || 0,
    discount: Number(body.discount) || 0,
    shipping: Number(body.shipping) || 0,
    lifecycleStage,
    paymentStatus,
    fundingSourceId: body.fundingSourceId || '',
    costCenter: body.costCenter?.trim() || '',
    project: body.project?.trim() || '',
    dimensions: body.dimensions || {},
    customFields: body.customFields || {},
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    notes: body.notes || '',
    assetIds: [],
    createdBy: user._id,
    updatedBy: user._id,
  });

  await logProcurementEvent({
    organizationId,
    procurement,
    eventType: 'procurement_created',
    label: 'Purchase created',
    description: `Procurement ${procurement.purchaseId} created`,
    metadata: { totalCost: procurement.totalCost },
    user,
  });

  if (procurement.budgetId) {
    await logBudgetPurchaseEvent({
      organizationId,
      budgetId: procurement.budgetId,
      eventType: 'purchase_linked',
      label: 'Purchase linked',
      description: `Procurement ${procurement.purchaseId} linked`,
      metadata: { procurementId: procurement._id, totalCost: procurement.totalCost },
      user,
    });
    await recalculateBudgetsForProcurement(organizationId, procurement, user);
  }

  return formatProcurement(procurement);
}

export async function updateProcurement(organizationId, user, id, body) {
  const config = await ensureBudgetOrgConfig(organizationId);
  const procurement = await Procurement.findOne({ _id: id, organizationId });
  if (!procurement) {
    const err = new Error('Procurement record not found');
    err.status = 404;
    throw err;
  }

  const before = procurement.toObject();
  const prevBudgetId = procurement.budgetId ? String(procurement.budgetId) : null;
  const prevStage = procurement.lifecycleStage;

  if (body.dimensions) {
    const dimErrors = validateBudgetDimensions(config, body.dimensions);
    if (dimErrors.length) {
      const err = new Error(dimErrors.join('; '));
      err.status = 400;
      throw err;
    }
    procurement.dimensions = body.dimensions;
  }
  if (body.customFields) {
    const fieldErrors = validateProcurementCustomFields(config, body.customFields);
    if (fieldErrors.length) {
      const err = new Error(fieldErrors.join('; '));
      err.status = 400;
      throw err;
    }
    procurement.customFields = body.customFields;
  }

  const scalarFields = [
    'purchaseOrderNumber', 'invoiceNumber', 'vendorId', 'budgetId', 'departmentId',
    'lifecycleStage', 'paymentStatus', 'fundingSourceId', 'costCenter', 'project', 'notes',
  ];
  for (const key of scalarFields) {
    if (body[key] !== undefined) procurement[key] = body[key] || (key.endsWith('Id') ? null : '');
  }

  if (body.purchaseDate !== undefined) {
    procurement.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null;
  }
  if (body.amount !== undefined) procurement.amount = Number(body.amount) || 0;
  if (body.tax !== undefined) procurement.tax = Number(body.tax) || 0;
  if (body.discount !== undefined) procurement.discount = Number(body.discount) || 0;
  if (body.shipping !== undefined) procurement.shipping = Number(body.shipping) || 0;
  if (body.attachments !== undefined) procurement.attachments = body.attachments;

  procurement.updatedBy = user._id;
  await procurement.save();

  const changes = await buildProcurementChanges(before, procurement.toObject(), config);
  if (changes.length) {
    const description = formatChangesSummary(
      changes.map((c) => ({ field: c.field, label: c.label, oldValue: c.from, newValue: c.to }))
    ) || 'Purchase updated';
    await logProcurementEvent({
      organizationId,
      procurement,
      eventType: 'procurement_updated',
      label: 'Purchase updated',
      description,
      changes,
      user,
    });
  }

  const newBudgetId = procurement.budgetId ? String(procurement.budgetId) : null;

  if (newBudgetId && newBudgetId !== prevBudgetId) {
    await logBudgetPurchaseEvent({
      organizationId,
      budgetId: procurement.budgetId,
      eventType: 'purchase_linked',
      label: 'Purchase linked',
      description: `Procurement ${procurement.purchaseId} linked`,
      metadata: { procurementId: procurement._id },
      user,
    });
  }

  if (prevBudgetId && prevBudgetId !== newBudgetId) {
    await logBudgetPurchaseEvent({
      organizationId,
      budgetId: prevBudgetId,
      eventType: 'purchase_cancelled',
      label: 'Purchase unlinked',
      description: `Procurement ${procurement.purchaseId} removed from budget`,
      metadata: { procurementId: procurement._id },
      user,
    });
    await recalculateBudgetRollups(organizationId, prevBudgetId, user);
  }

  if (body.lifecycleStage && body.lifecycleStage !== prevStage) {
    if (body.lifecycleStage === 'cancelled') {
      await logBudgetPurchaseEvent({
        organizationId,
        budgetId: procurement.budgetId,
        eventType: 'purchase_cancelled',
        label: 'Purchase cancelled',
        description: `Procurement ${procurement.purchaseId} cancelled`,
        metadata: { from: prevStage, to: body.lifecycleStage },
        user,
      });
    }
  }

  await recalculateBudgetsForProcurement(organizationId, procurement, user);
  if (prevBudgetId && prevBudgetId !== newBudgetId) {
    await recalculateBudgetRollups(organizationId, prevBudgetId, user);
  }

  return { procurement: formatProcurement(procurement), changes };
}

export async function deleteProcurement(organizationId, user, id) {
  const procurement = await Procurement.findOne({ _id: id, organizationId });
  if (!procurement) {
    const err = new Error('Procurement record not found');
    err.status = 404;
    throw err;
  }

  const budgetId = procurement.budgetId;

  await Asset.updateMany(
    { organizationId, procurementId: procurement._id },
    { $unset: { procurementId: 1 } }
  );

  await procurement.deleteOne();

  await logProcurementEvent({
    organizationId,
    procurement,
    eventType: 'procurement_deleted',
    label: 'Purchase deleted',
    description: `Procurement ${procurement.purchaseId} deleted`,
    metadata: { totalCost: procurement.totalCost },
    user,
  });

  if (budgetId) {
    await logBudgetPurchaseEvent({
      organizationId,
      budgetId,
      eventType: 'purchase_cancelled',
      label: 'Purchase deleted',
      description: `Procurement ${procurement.purchaseId} deleted`,
      metadata: { procurementId: procurement._id },
      user,
    });
    await recalculateBudgetRollups(organizationId, budgetId, user);
  }

  return procurement;
}

export async function linkAssetToProcurement(organizationId, user, procurementId, assetId) {
  const procurement = await Procurement.findOne({ _id: procurementId, organizationId });
  if (!procurement) {
    const err = new Error('Procurement record not found');
    err.status = 404;
    throw err;
  }

  const asset = await Asset.findOne({ _id: assetId, organizationId });
  if (!asset) {
    const err = new Error('Asset not found');
    err.status = 404;
    throw err;
  }

  const updates = { procurementId: procurement._id, updatedBy: user._id };
  if (procurement.budgetId) updates.budgetId = procurement.budgetId;
  if (procurement.vendorId) updates.vendorId = procurement.vendorId;
  if (procurement.purchaseOrderNumber) updates.purchaseOrderNumber = procurement.purchaseOrderNumber;
  if (procurement.invoiceNumber) updates.invoiceNumber = procurement.invoiceNumber;
  if (procurement.fundingSourceId) updates.fundingSourceId = procurement.fundingSourceId;
  if (procurement.costCenter) updates.costCenter = procurement.costCenter;
  if (procurement.purchaseDate && !asset.purchaseDate) updates.purchaseDate = procurement.purchaseDate;

  await Asset.updateOne({ _id: asset._id }, updates);

  if (!procurement.assetIds.some((id) => String(id) === String(asset._id))) {
    procurement.assetIds.push(asset._id);
  }

  const config = await ensureBudgetOrgConfig(organizationId);
  const assetsCreatedStage = config.procurementLifecycleStages?.find((s) => s.id === 'assets_created');
  if (assetsCreatedStage && procurement.lifecycleStage !== 'cancelled') {
    procurement.lifecycleStage = 'assets_created';
  }

  procurement.updatedBy = user._id;
  await procurement.save();

  await recalculateBudgetsForProcurement(organizationId, procurement, user);

  return getProcurementById(organizationId, procurementId);
}

export async function getProcurementSummary(organizationId) {
  const config = await ensureBudgetOrgConfig(organizationId);
  const buckets = {
    planned: (config.procurementLifecycleStages || []).filter((s) => s.bucket === 'planned').map((s) => s.id),
    committed: (config.procurementLifecycleStages || []).filter((s) => s.bucket === 'committed').map((s) => s.id),
    actual: (config.procurementLifecycleStages || []).filter((s) => s.bucket === 'actual').map((s) => s.id),
  };

  const all = await Procurement.find({ organizationId }).select('totalCost lifecycleStage amount tax discount shipping').lean();
  const withCost = all.map((p) => ({ ...p, totalCost: p.totalCost ?? computeTotalCost(p) }));

  const sumBucket = (ids) =>
    withCost.filter((p) => ids.includes(p.lifecycleStage)).reduce((s, p) => s + (p.totalCost || 0), 0);

  return {
    totalRecords: all.length,
    plannedSpend: sumBucket(buckets.planned),
    committedSpend: sumBucket(buckets.committed),
    actualSpend: sumBucket(buckets.actual),
    pendingCount: withCost.filter(
      (p) => buckets.planned.includes(p.lifecycleStage) || buckets.committed.includes(p.lifecycleStage)
    ).length,
  };
}
