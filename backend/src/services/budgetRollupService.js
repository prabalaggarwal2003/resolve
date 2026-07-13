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

export async function recalculateBudgetRollups(organizationId, budgetId, user = null) {
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

  budget.plannedAmount = plannedAmount;
  budget.committedAmount = committedAmount;
  budget.actualSpend = actualSpend;
  await budget.save();

  const changed =
    prev.plannedAmount !== plannedAmount ||
    prev.committedAmount !== committedAmount ||
    prev.actualSpend !== actualSpend;

  if (changed && user) {
    await BudgetHistory.create({
      organizationId,
      budgetId,
      eventType: 'budget_updated',
      label: 'Budget rollups recalculated',
      description: `Planned ${plannedAmount}, committed ${committedAmount}, actual ${actualSpend}`,
      metadata: { prev, next: { plannedAmount, committedAmount, actualSpend } },
      userId: user._id,
      userName: user.name || '',
    });
  }

  return budget;
}

export async function recalculateBudgetsForProcurement(organizationId, procurement, user = null) {
  if (procurement?.budgetId) {
    await recalculateBudgetRollups(organizationId, procurement.budgetId, user);
  }
}

export async function recalculateBudgetsForAsset(organizationId, asset, prevAsset = null, user = null) {
  const budgetIds = new Set();
  if (asset?.budgetId) budgetIds.add(String(asset.budgetId));
  if (prevAsset?.budgetId) budgetIds.add(String(prevAsset.budgetId));

  for (const budgetId of budgetIds) {
    await recalculateBudgetRollups(organizationId, budgetId, user);
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
