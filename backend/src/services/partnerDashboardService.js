import { Asset, Invoice } from '../models/index.js';
import BusinessPartner from '../models/BusinessPartner.js';
import PartnerContract from '../models/PartnerContract.js';
import { listOrgPartnerActivities } from './partnerActivityService.js';

const EXPIRY_WINDOW_DAYS = 30;

function buildPartnerQuery(organizationId, filters = {}) {
  const query = { organizationId };
  if (filters.partnerId) query._id = filters.partnerId;
  if (filters.status) query.status = String(filters.status);
  if (filters.partnerTypeKey) query.partnerTypeKey = String(filters.partnerTypeKey);
  if (filters.categoryKey) query.categoryKey = String(filters.categoryKey);
  if (filters.tag) query.tags = String(filters.tag);
  if (filters.search) {
    const q = String(filters.search).trim();
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { partnerCode: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
  }
  return query;
}

function partnerLinkMatch(partnerIds, organizationId) {
  if (!partnerIds.length) {
    return { organizationId, _id: { $in: [] } };
  }
  return {
    organizationId,
    $or: [{ partnerId: { $in: partnerIds } }, { vendorId: { $in: partnerIds } }],
  };
}

/**
 * Dashboard context for Business Partners.
 * Page filters narrow the partner set; widgets can further filter client-side.
 */
export async function getPartnerDashboardSummary(organizationId, pageFilters = {}) {
  const now = new Date();
  const horizon = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 86400000);
  const partnerQuery = buildPartnerQuery(organizationId, pageFilters);

  const partners = await BusinessPartner.find(partnerQuery)
    .select('name partnerCode status partnerTypeKey categoryKey tags currency')
    .sort({ name: 1 })
    .lean();

  const partnerIds = partners.map((p) => p._id);
  const partnerIdSet = new Set(partnerIds.map(String));

  const [contracts, invoiceRows, assetRows, recentActivity] = await Promise.all([
    PartnerContract.find({
      organizationId,
      ...(partnerIds.length ? { partnerId: { $in: partnerIds } } : { partnerId: { $in: [] } }),
    })
      .select('partnerId contractNumber title status startDate endDate renewalDate')
      .lean(),
    Invoice.aggregate([
      { $match: partnerLinkMatch(partnerIds, organizationId) },
      {
        $group: {
          _id: { $ifNull: ['$partnerId', '$vendorId'] },
          totalSpend: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]),
    Asset.aggregate([
      { $match: partnerLinkMatch(partnerIds, organizationId) },
      {
        $group: {
          _id: { $ifNull: ['$partnerId', '$vendorId'] },
          assetCount: { $sum: 1 },
        },
      },
    ]),
    listOrgPartnerActivities(organizationId, 25),
  ]);

  const spendByPartner = new Map(
    invoiceRows.filter((r) => r._id).map((r) => [String(r._id), r])
  );
  const assetsByPartner = new Map(
    assetRows.filter((r) => r._id).map((r) => [String(r._id), r.assetCount || 0])
  );

  const partnerRows = partners.map((p) => {
    const id = String(p._id);
    const spend = spendByPartner.get(id) || {};
    return {
      id,
      name: p.name,
      partnerCode: p.partnerCode || '',
      status: p.status || '',
      partnerTypeKey: p.partnerTypeKey || '',
      categoryKey: p.categoryKey || p.category || '',
      tags: p.tags || [],
      currency: p.currency || 'INR',
      totalSpend: spend.totalSpend || 0,
      paidAmount: spend.paidAmount || 0,
      pendingPayment: (spend.totalSpend || 0) - (spend.paidAmount || 0),
      invoiceCount: spend.invoiceCount || 0,
      assetCount: assetsByPartner.get(id) || 0,
    };
  });

  const contractRows = contracts.map((c) => ({
    id: String(c._id),
    partnerId: c.partnerId ? String(c.partnerId) : null,
    contractNumber: c.contractNumber || '',
    title: c.title || '',
    status: c.status || '',
    startDate: c.startDate || null,
    endDate: c.endDate || null,
    renewalDate: c.renewalDate || null,
  }));

  const filteredActivity = (recentActivity || []).filter(
    (a) => !partnerIds.length || !a.partnerId || partnerIdSet.has(String(a.partnerId))
  );

  const totals = partnerRows.length;
  const active = partnerRows.filter((p) => p.status === 'Active').length;
  const inactive = partnerRows.filter((p) => p.status === 'Inactive').length;
  const blacklisted = partnerRows.filter((p) => p.status === 'Blacklisted').length;
  const pending = partnerRows.filter((p) => p.status === 'Pending').length;
  const purchaseValue = partnerRows.reduce((sum, p) => sum + (p.totalSpend || 0), 0);
  const pendingPayments = partnerRows.reduce((sum, p) => sum + (p.pendingPayment || 0), 0);
  const linkedAssets = partnerRows.reduce((sum, p) => sum + (p.assetCount || 0), 0);
  const contractsExpiring = contractRows.filter((c) => {
    if (!c.endDate) return false;
    if (['Cancelled', 'Expired'].includes(c.status)) return false;
    const end = new Date(c.endDate);
    return end >= now && end <= horizon;
  }).length;

  const topPartners = [...partnerRows]
    .sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      partnerCode: p.partnerCode,
      status: p.status,
      totalSpend: p.totalSpend,
      invoiceCount: p.invoiceCount,
    }));

  return {
    partners: partnerRows,
    contracts: contractRows,
    recentActivity: filteredActivity.slice(0, 15),
    topPartners,
    totals,
    active,
    inactive,
    blacklisted,
    pending,
    contractsExpiring,
    pendingPayments,
    purchaseValue,
    linkedAssets,
    metrics: {
      total_partners: totals,
      active_partners: active,
      inactive_partners: inactive,
      blacklisted_partners: blacklisted,
      pending_partners: pending,
      contracts_expiring: contractsExpiring,
      pending_payments: pendingPayments,
      purchase_value: purchaseValue,
      linked_assets: linkedAssets,
    },
    expiryWindowDays: EXPIRY_WINDOW_DAYS,
  };
}
