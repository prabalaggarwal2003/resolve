import Budget from '../models/Budget.js';
import BudgetHistory from '../models/BudgetHistory.js';
import Procurement from '../models/Procurement.js';
import Asset from '../models/Asset.js';
import { ensureBudgetOrgConfig } from './budgetOrgConfigService.js';
import { DEFAULT_PROCUREMENT_LIFECYCLE_STAGES } from '../constants/budgetDefaults.js';

function stageBuckets(stages) {
  const list = stages?.length ? stages : DEFAULT_PROCUREMENT_LIFECYCLE_STAGES;
  return {
    planned: list.filter((s) => s.bucket === 'planned').map((s) => s.id),
    committed: list.filter((s) => s.bucket === 'committed').map((s) => s.id),
    actual: list.filter((s) => s.bucket === 'actual').map((s) => s.id),
    cancelled: list.filter((s) => s.bucket === 'cancelled').map((s) => s.id),
  };
}

function formatMoney(n, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  } catch {
    return String(n ?? 0);
  }
}

function buildRollupChanges(prev, next, currency = 'INR') {
  const fields = [
    { key: 'plannedAmount', label: 'Planned amount' },
    { key: 'committedAmount', label: 'Committed amount' },
    { key: 'actualSpend', label: 'Actual spend' },
  ];
  const changes = [];
  for (const f of fields) {
    const from = Number(prev[f.key]) || 0;
    const to = Number(next[f.key]) || 0;
    if (from === to) continue;
    changes.push({
      field: f.key,
      label: f.label,
      from: formatMoney(from, currency),
      to: formatMoney(to, currency),
    });
  }
  return changes;
}

export async function recalculateBudgetRollups(organizationId, budgetId, user = null, context = {}) {
  if (!budgetId) return null;

  const config = await ensureBudgetOrgConfig(organizationId);
  const budget = await Budget.findOne({ _id: budgetId, organizationId });
  if (!budget) return null;

  const buckets = stageBuckets(config.procurementLifecycleStages);
  const cancelled = new Set(buckets.cancelled);

  const procurements = await Procurement.find({
    organizationId,
    budgetId,
    lifecycleStage: { $nin: Array.from(cancelled) },
  }).lean();

  let plannedAmount = 0;
  let committedAmount = 0;
  let actualFromProcurement = 0;

  const actualStageProcIds = new Set();

  for (const proc of procurements) {
    const cost = proc.totalCost || 0;
    if (buckets.planned.includes(proc.lifecycleStage)) plannedAmount += cost;
    if (buckets.committed.includes(proc.lifecycleStage)) committedAmount += cost;
    if (buckets.actual.includes(proc.lifecycleStage)) {
      actualFromProcurement += cost;
      actualStageProcIds.add(String(proc._id));
    }
  }

  let actualFromAssets = 0;
  if (config.settings?.autoUpdateOnAssetCreate !== false) {
    const assets = await Asset.find({ organizationId, budgetId }).select('cost procurementId').lean();
    for (const asset of assets) {
      if (!asset.cost) continue;
      if (asset.procurementId && actualStageProcIds.has(String(asset.procurementId))) continue;
      actualFromAssets += asset.cost;
    }
  }

  const actualSpend = actualFromProcurement + actualFromAssets;

  const prev = {
    plannedAmount: budget.plannedAmount || 0,
    committedAmount: budget.committedAmount || 0,
    actualSpend: budget.actualSpend || 0,
  };
  const next = { plannedAmount, committedAmount, actualSpend };

  budget.plannedAmount = plannedAmount;
  budget.committedAmount = committedAmount;
  budget.actualSpend = actualSpend;
  await budget.save();

  const changes = buildRollupChanges(prev, next, budget.currency || 'INR');
  if (!changes.length) return budget;

  const triggerLabel = context.triggerLabel
    || (context.procurementId ? 'after purchase change' : context.assetId ? 'after asset change' : 'automatically');

  await BudgetHistory.create({
    organizationId,
    entityType: 'budget',
    budgetId,
    entityLabel: budget.name,
    eventType: 'budget_updated',
    label: 'Financial totals updated',
    description: changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join('; '),
    changes,
    metadata: {
      source: 'rollup',
      trigger: triggerLabel,
      prev,
      next,
      procurementId: context.procurementId || null,
      assetId: context.assetId || null,
    },
    userId: user?._id || null,
    userName: user?.name || 'System',
  });

  return budget;
}

export async function recalculateBudgetsForProcurement(organizationId, procurement, user = null) {
  if (procurement?.budgetId) {
    await recalculateBudgetRollups(organizationId, procurement.budgetId, user, {
      triggerLabel: procurement.purchaseId
        ? `after purchase ${procurement.purchaseId}`
        : 'after purchase change',
      procurementId: procurement._id,
    });
  }
}

export async function recalculateBudgetsForAsset(organizationId, asset, prevAsset = null, user = null) {
  const budgetIds = new Set();
  if (asset?.budgetId) budgetIds.add(String(asset.budgetId));
  if (prevAsset?.budgetId) budgetIds.add(String(prevAsset.budgetId));

  for (const budgetId of budgetIds) {
    await recalculateBudgetRollups(organizationId, budgetId, user, {
      triggerLabel: asset?.assetId ? `after asset ${asset.assetId}` : 'after asset change',
      assetId: asset?._id || prevAsset?._id || null,
    });
  }
}

export async function countPendingProcurements(organizationId) {
  const config = await ensureBudgetOrgConfig(organizationId);
  const buckets = stageBuckets(config.procurementLifecycleStages);
  const pendingStages = [...buckets.planned, ...buckets.committed].filter(
    (s) => !buckets.cancelled.includes(s)
  );
  if (!pendingStages.length) return 0;

  return Procurement.countDocuments({
    organizationId,
    lifecycleStage: { $in: pendingStages },
  });
}
