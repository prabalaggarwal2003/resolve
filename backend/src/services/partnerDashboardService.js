import { Asset, Invoice } from '../models/index.js';
import BusinessPartner from '../models/BusinessPartner.js';
import PartnerContract from '../models/PartnerContract.js';
import { listOrgPartnerActivities } from './partnerActivityService.js';

const EXPIRY_WINDOW_DAYS = 30;

export async function getPartnerDashboardSummary(organizationId) {
  const now = new Date();
  const horizon = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 86400000);

  const [
    totals,
    active,
    inactive,
    contractsExpiring,
    invoiceTotals,
    linkedAssets,
    recentActivity,
    topSpend,
  ] = await Promise.all([
    BusinessPartner.countDocuments({ organizationId }),
    BusinessPartner.countDocuments({ organizationId, status: 'Active' }),
    BusinessPartner.countDocuments({ organizationId, status: { $ne: 'Active' } }),
    PartnerContract.countDocuments({
      organizationId,
      endDate: { $gte: now, $lte: horizon },
      status: { $nin: ['Cancelled', 'Expired'] },
    }),
    Invoice.aggregate([
      { $match: { organizationId } },
      {
        $group: {
          _id: null,
          purchaseValue: { $sum: '$totalAmount' },
          paidValue: { $sum: '$paidAmount' },
        },
      },
    ]),
    Asset.countDocuments({
      organizationId,
      $or: [{ partnerId: { $ne: null } }, { vendorId: { $ne: null } }],
    }),
    listOrgPartnerActivities(organizationId, 10),
    Invoice.aggregate([
      { $match: { organizationId } },
      {
        $group: {
          _id: { $ifNull: ['$partnerId', '$vendorId'] },
          totalSpend: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const spendTotals = invoiceTotals[0] || {};
  const topPartnerIds = topSpend.map((row) => row._id).filter(Boolean);
  const topPartnerDocs = await BusinessPartner.find({
    _id: { $in: topPartnerIds },
    organizationId,
  })
    .select('name partnerCode status')
    .lean();
  const partnerMap = new Map(topPartnerDocs.map((p) => [String(p._id), p]));

  return {
    totals,
    active,
    inactive,
    contractsExpiring,
    pendingPayments: (spendTotals.purchaseValue || 0) - (spendTotals.paidValue || 0),
    purchaseValue: spendTotals.purchaseValue || 0,
    linkedAssets,
    recentActivity,
    topPartners: topSpend
      .filter((row) => row._id && partnerMap.has(String(row._id)))
      .map((row) => {
        const partner = partnerMap.get(String(row._id));
        return {
          id: String(row._id),
          name: partner.name,
          partnerCode: partner.partnerCode,
          status: partner.status,
          totalSpend: row.totalSpend || 0,
          invoiceCount: row.invoiceCount || 0,
        };
      }),
  };
}
