import Budget from '../models/Budget.js';
import Procurement from '../models/Procurement.js';
import Department from '../models/Department.js';
import Location from '../models/Location.js';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import { ensureBudgetOrgConfig } from './budgetOrgConfigService.js';
import { computeBudgetFinancials } from './budgetService.js';

function monthKey(date) {
  if (!date) return 'Unknown';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quarterKey(date) {
  if (!date) return 'Unknown';
  const d = new Date(date);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()} Q${q}`;
}

function applyBudgetFilters(budgets, filters = {}) {
  return budgets.filter((b) => {
    if (filters.budgetId && String(b._id) !== filters.budgetId) return false;
    if (filters.status && b.status !== filters.status) return false;
    if (filters.budgetTypeId && b.budgetTypeId !== filters.budgetTypeId) return false;
    if (filters.financialYear && b.financialYear !== filters.financialYear) return false;
    if (filters.budgetOwnerId && String(b.budgetOwnerId?._id || b.budgetOwnerId || '') !== filters.budgetOwnerId) return false;
    const dims = b.dimensions || {};
    if (filters.departmentId && String(dims.departmentId || '') !== filters.departmentId) return false;
    if (filters.locationId && String(dims.locationId || '') !== filters.locationId) return false;
    if (filters.fundingSourceId && String(dims.fundingSourceId || '') !== filters.fundingSourceId) return false;
    if (filters.vendorId && String(dims.vendorId || '') !== filters.vendorId) return false;
    if (filters.project && (dims.project || '') !== filters.project) return false;
    if (filters.costCenter && (dims.costCenter || '') !== filters.costCenter) return false;
    if (filters.category && (dims.category || '') !== filters.category) return false;
    if (filters.dateFrom && b.startDate && new Date(b.startDate) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && b.endDate) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(b.endDate) > end) return false;
    }
    return true;
  });
}

function addMonths(monthStr, n) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeSpendForecast(monthlySpend) {
  const rows = monthlySpend.filter((m) => m.month !== 'Unknown');
  if (rows.length < 2) {
    const last = rows[rows.length - 1];
    return {
      trendDirection: 'flat',
      monthlySlope: 0,
      projectedNextMonth: last?.actual || 0,
      projectedQuarterSpend: 0,
      forecastMonths: [],
    };
  }
  const actuals = rows.map((r, i) => ({ x: i, y: r.actual }));
  const n = actuals.length;
  const sumX = actuals.reduce((s, p) => s + p.x, 0);
  const sumY = actuals.reduce((s, p) => s + p.y, 0);
  const sumXY = actuals.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = actuals.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const lastMonth = rows[rows.length - 1].month;
  const forecastMonths = [];
  for (let i = 1; i <= 3; i++) {
    const x = n - 1 + i;
    forecastMonths.push({
      month: addMonths(lastMonth, i),
      planned: 0,
      actual: Math.max(0, Math.round(slope * x + intercept)),
      committed: 0,
      forecast: true,
    });
  }
  const projectedNextMonth = forecastMonths[0]?.actual || 0;
  const projectedQuarterSpend = forecastMonths.reduce((s, f) => s + f.actual, 0);
  const trendDirection = slope > 100 ? 'up' : slope < -100 ? 'down' : 'flat';
  return {
    trendDirection,
    monthlySlope: Math.round(slope),
    projectedNextMonth,
    projectedQuarterSpend,
    forecastMonths,
  };
}

function filterProcurements(procurements, filters = {}, budgetIds = null) {
  return procurements.filter((p) => {
    if (budgetIds && p.budgetId && !budgetIds.has(String(p.budgetId))) return false;
    if (filters.budgetId && String(p.budgetId || '') !== filters.budgetId) return false;
    if (filters.vendorId && String(p.vendorId || '') !== filters.vendorId) return false;
    if (filters.fundingSourceId && (p.fundingSourceId || '') !== filters.fundingSourceId) return false;
    if (filters.project && (p.project || '') !== filters.project) return false;
    if (filters.costCenter && (p.costCenter || '') !== filters.costCenter) return false;
    if (filters.category && (p.category || '') !== filters.category) return false;
    if (filters.lifecycleStage && p.lifecycleStage !== filters.lifecycleStage) return false;
    if (filters.paymentStatus && p.paymentStatus !== filters.paymentStatus) return false;
    if (filters.dateFrom && p.purchaseDate && new Date(p.purchaseDate) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && p.purchaseDate) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(p.purchaseDate) > end) return false;
    }
    return true;
  });
}

function isCommittedStage(stage) {
  return ['approved', 'ordered'].includes(stage);
}

function isReceivedStage(stage) {
  return ['received', 'assets_created'].includes(stage);
}

function isUnpaidStatus(status) {
  return ['unpaid', 'partial', 'overdue'].includes(status);
}

export async function getBudgetAnalyticsSummary(organizationId, filters = {}) {
  const config = await ensureBudgetOrgConfig(organizationId);

  const [rawBudgets, procurements, departments, locations, users, vendors] = await Promise.all([
    Budget.find({ organizationId })
      .populate('budgetOwnerId', 'name')
      .lean(),
    Procurement.find({ organizationId })
      .populate('vendorId', 'name')
      .populate('budgetId', 'name')
      .lean(),
    Department.find({ organizationId }).select('name').lean(),
    Location.find({ organizationId }).select('name').lean(),
    User.find({ organizationId }).select('name').lean(),
    Vendor.find({ organizationId }).select('name vendorId').lean(),
  ]);

  const deptMap = Object.fromEntries(departments.map((d) => [String(d._id), d.name]));
  const locMap = Object.fromEntries(locations.map((l) => [String(l._id), l.name]));
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u.name]));
  const vendorMap = Object.fromEntries(vendors.map((v) => [String(v._id), v.name]));
  const typeMap = Object.fromEntries((config.budgetTypes || []).map((t) => [t.id, t.name]));
  const statusMap = Object.fromEntries((config.budgetStatuses || []).map((s) => [s.id, s.name]));
  const fundingMap = Object.fromEntries((config.fundingSources || []).map((f) => [f.id, f.name]));
  const stageMap = Object.fromEntries((config.procurementLifecycleStages || []).map((s) => [s.id, s.name]));
  const paymentMap = Object.fromEntries((config.procurementPaymentStatuses || []).map((s) => [s.id, s.name]));

  const budgetCategoryMap = Object.fromEntries(
    rawBudgets.map((b) => [String(b._id), (b.dimensions || {}).category || ''])
  );

  const budgets = applyBudgetFilters(
    rawBudgets.map((b) => {
      const fin = computeBudgetFinancials(b);
      const dims = b.dimensions || {};
      return {
        id: String(b._id),
        name: b.name,
        code: b.code || '',
        status: b.status,
        statusLabel: statusMap[b.status] || b.status,
        budgetTypeId: b.budgetTypeId,
        budgetTypeLabel: typeMap[b.budgetTypeId] || b.budgetTypeId,
        financialYear: b.financialYear || '',
        currency: b.currency || 'INR',
        budgetOwnerId: b.budgetOwnerId?._id ? String(b.budgetOwnerId._id) : null,
        budgetOwnerName: b.budgetOwnerId?.name || userMap[String(b.budgetOwnerId)] || '',
        departmentId: dims.departmentId ? String(dims.departmentId) : '',
        departmentLabel: deptMap[dims.departmentId] || dims.departmentId || 'Unassigned',
        locationId: dims.locationId ? String(dims.locationId) : '',
        locationLabel: locMap[dims.locationId] || dims.locationId || 'Unassigned',
        fundingSourceId: dims.fundingSourceId || '',
        fundingSourceLabel: fundingMap[dims.fundingSourceId] || dims.fundingSourceId || 'Unassigned',
        project: dims.project || b.periodLabel || '',
        costCenter: dims.costCenter || '',
        category: dims.category || '',
        allocatedAmount: fin.allocatedAmount,
        plannedAmount: fin.plannedAmount,
        committedAmount: fin.committedAmount,
        actualSpend: fin.actualSpend,
        remainingAmount: fin.remainingAmount,
        availableBalance: fin.availableBalance,
        utilizationPct: fin.utilizationPct,
        isOverBudget: fin.utilizationPct >= 100,
        isNearLimit: fin.utilizationPct >= (config.settings?.warnThresholdPct ?? 80) && fin.utilizationPct < 100,
        startDate: b.startDate,
        endDate: b.endDate,
      };
    }),
    filters
  );

  const budgetIds = new Set(budgets.map((b) => b.id));
  const filteredProcurements = filterProcurements(
    procurements
      .filter((p) => !p.budgetId || budgetIds.has(String(p.budgetId?._id || p.budgetId)))
      .map((p) => {
        const bid = p.budgetId?._id ? String(p.budgetId._id) : (p.budgetId ? String(p.budgetId) : null);
        return {
          id: String(p._id),
          purchaseId: p.purchaseId,
          budgetId: bid,
          budgetName: p.budgetId?.name || '',
          vendorId: p.vendorId?._id ? String(p.vendorId._id) : null,
          vendorLabel: p.vendorId?.name || vendorMap[String(p.vendorId)] || 'Unassigned',
          departmentId: p.departmentId ? String(p.departmentId) : '',
          totalCost: p.totalCost || 0,
          lifecycleStage: p.lifecycleStage,
          lifecycleStageLabel: stageMap[p.lifecycleStage] || p.lifecycleStage,
          paymentStatus: p.paymentStatus,
          paymentStatusLabel: paymentMap[p.paymentStatus] || p.paymentStatus,
          purchaseDate: p.purchaseDate,
          month: monthKey(p.purchaseDate),
          quarter: quarterKey(p.purchaseDate),
          fundingSourceId: p.fundingSourceId || '',
          fundingSourceLabel: fundingMap[p.fundingSourceId] || p.fundingSourceId || 'Unassigned',
          project: p.project || '',
          costCenter: p.costCenter || '',
          category: bid ? (budgetCategoryMap[bid] || '') : '',
        };
      }),
    filters,
    budgetIds
  );

  const totalAllocated = budgets.reduce((s, b) => s + b.allocatedAmount, 0);
  const totalPlanned = budgets.reduce((s, b) => s + b.plannedAmount, 0);
  const totalCommitted = budgets.reduce((s, b) => s + b.committedAmount, 0);
  const totalActual = budgets.reduce((s, b) => s + b.actualSpend, 0);
  const totalRemaining = budgets.reduce((s, b) => s + b.remainingAmount, 0);
  const utilizationPct = totalAllocated > 0 ? Math.round((totalActual / totalAllocated) * 1000) / 10 : 0;

  const monthlyMap = {};
  for (const p of filteredProcurements) {
    const key = p.month;
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, planned: 0, actual: 0, committed: 0 };
    monthlyMap[key].planned += p.totalCost;
    if (['approved', 'ordered'].includes(p.lifecycleStage)) monthlyMap[key].committed += p.totalCost;
    if (['received', 'assets_created'].includes(p.lifecycleStage)) monthlyMap[key].actual += p.totalCost;
  }
  const monthlySpend = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
  const forecast = computeSpendForecast(monthlySpend);
  const monthlySpendWithForecast = [...monthlySpend, ...forecast.forecastMonths];

  const quarterlyMap = {};
  for (const p of filteredProcurements) {
    const key = p.quarter;
    if (!quarterlyMap[key]) quarterlyMap[key] = { quarter: key, planned: 0, actual: 0, committed: 0 };
    quarterlyMap[key].planned += p.totalCost;
    if (['approved', 'ordered'].includes(p.lifecycleStage)) quarterlyMap[key].committed += p.totalCost;
    if (['received', 'assets_created'].includes(p.lifecycleStage)) quarterlyMap[key].actual += p.totalCost;
  }
  const quarterlySpend = Object.values(quarterlyMap).sort((a, b) => a.quarter.localeCompare(b.quarter));

  const procurementCount = filteredProcurements.length;
  const totalProcurementAmount = filteredProcurements.reduce((s, p) => s + p.totalCost, 0);
  const committedProcurementAmount = filteredProcurements
    .filter((p) => isCommittedStage(p.lifecycleStage))
    .reduce((s, p) => s + p.totalCost, 0);
  const receivedProcurementAmount = filteredProcurements
    .filter((p) => isReceivedStage(p.lifecycleStage))
    .reduce((s, p) => s + p.totalCost, 0);
  const unpaidProcurementAmount = filteredProcurements
    .filter((p) => isUnpaidStatus(p.paymentStatus))
    .reduce((s, p) => s + p.totalCost, 0);
  const overduePaymentCount = filteredProcurements.filter((p) => p.paymentStatus === 'overdue').length;
  const pendingPurchaseRequests = filteredProcurements.filter(
    (p) => !isReceivedStage(p.lifecycleStage) && p.lifecycleStage !== 'cancelled'
  ).length;

  const uniqueValues = (values) => Array.from(new Set(values.filter(Boolean))).sort();

  return {
    budgets,
    procurements: filteredProcurements,
    monthlySpend,
    monthlySpendWithForecast,
    quarterlySpend,
    forecast,
    totals: {
      budgetCount: budgets.length,
      activeBudgets: budgets.filter((b) => b.status === 'active').length,
      totalAllocated,
      totalPlanned,
      totalCommitted,
      totalActual,
      totalRemaining,
      utilizationPct,
      budgetsNearLimit: budgets.filter((b) => b.isNearLimit).length,
      budgetsExceeded: budgets.filter((b) => b.isOverBudget).length,
      pendingPurchaseRequests,
      procurementCount,
      totalProcurementAmount,
      committedProcurementAmount,
      receivedProcurementAmount,
      unpaidProcurementAmount,
      overduePaymentCount,
    },
    quick: {
      budgetsNearLimit: budgets
        .filter((b) => b.isNearLimit || b.isOverBudget)
        .sort((a, b) => b.utilizationPct - a.utilizationPct)
        .slice(0, 10)
        .map((b) => ({
          id: b.id,
          name: b.name,
          utilizationPct: b.utilizationPct,
          remainingAmount: b.remainingAmount,
          status: b.statusLabel,
        })),
      budgetsExceeded: budgets
        .filter((b) => b.isOverBudget)
        .sort((a, b) => b.utilizationPct - a.utilizationPct)
        .slice(0, 10)
        .map((b) => ({
          id: b.id,
          name: b.name,
          utilizationPct: b.utilizationPct,
          remainingAmount: b.remainingAmount,
        })),
      pendingProcurements: filteredProcurements
        .filter((p) => !isReceivedStage(p.lifecycleStage) && p.lifecycleStage !== 'cancelled')
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          purchaseId: p.purchaseId,
          totalCost: p.totalCost,
          vendorLabel: p.vendorLabel,
          lifecycleStage: p.lifecycleStage,
        })),
      recentProcurements: [...filteredProcurements]
        .sort((a, b) => new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0))
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          purchaseId: p.purchaseId,
          totalCost: p.totalCost,
          vendorLabel: p.vendorLabel,
          lifecycleStageLabel: p.lifecycleStageLabel,
        })),
      overduePayments: filteredProcurements
        .filter((p) => p.paymentStatus === 'overdue')
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          purchaseId: p.purchaseId,
          totalCost: p.totalCost,
          vendorLabel: p.vendorLabel,
          paymentStatusLabel: p.paymentStatusLabel,
        })),
      topVendors: Object.entries(
        filteredProcurements.reduce((acc, p) => {
          const k = p.vendorLabel;
          acc[k] = (acc[k] || 0) + p.totalCost;
          return acc;
        }, {})
      )
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      topDepartments: Object.entries(
        budgets.reduce((acc, b) => {
          const k = b.departmentLabel;
          acc[k] = (acc[k] || 0) + b.actualSpend;
          return acc;
        }, {})
      )
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    },
    lookups: {
      budgetTypes: config.budgetTypes || [],
      budgetStatuses: config.budgetStatuses || [],
      fundingSources: config.fundingSources || [],
      lifecycleStages: config.procurementLifecycleStages || [],
      paymentStatuses: config.procurementPaymentStatuses || [],
      departments: departments.map((d) => ({ _id: String(d._id), name: d.name })),
      locations: locations.map((l) => ({ _id: String(l._id), name: l.name })),
      users: users.map((u) => ({ _id: String(u._id), name: u.name })),
      vendors: vendors.map((v) => ({ _id: String(v._id), name: v.name })),
      budgets: budgets.map((b) => ({ _id: b.id, name: b.name })),
      projects: uniqueValues(budgets.map((b) => b.project).concat(filteredProcurements.map((p) => p.project))),
      costCenters: uniqueValues(budgets.map((b) => b.costCenter).concat(filteredProcurements.map((p) => p.costCenter))),
      categories: uniqueValues(budgets.map((b) => b.category)),
    },
  };
}
