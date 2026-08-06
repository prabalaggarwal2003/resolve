import { Invoice, Procurement } from '../models/index.js';
import BusinessPartner from '../models/BusinessPartner.js';
import PartnerContract from '../models/PartnerContract.js';
import { partnerLinkQuery } from './businessPartnerService.js';

function ratingOf(partner) {
  if (partner?.averageRating != null) return Number(partner.averageRating);
  const custom = partner?.customFields || {};
  const candidate = custom.rating ?? custom.average_rating ?? custom.averageRating;
  const value = Number(candidate);
  return Number.isFinite(value) ? value : null;
}

/**
 * Compute the values backing the configured performance KPIs.
 * KPIs without a data source yet return `value: null` so the UI can show them as unavailable.
 */
export async function computePartnerPerformance(partnerId, organizationId, kpiDefs = []) {
  const [partner, invoiceStats, purchaseCount, contracts] = await Promise.all([
    BusinessPartner.findOne({ _id: partnerId, organizationId }).lean(),
    Invoice.aggregate([
      { $match: partnerLinkQuery(partnerId, organizationId) },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$totalAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]),
    Procurement.countDocuments(partnerLinkQuery(partnerId, organizationId)),
    PartnerContract.find({ partnerId, organizationId }).select('status renewalDate').lean(),
  ]);

  const invoices = invoiceStats[0] || {};
  const renewals = contracts.filter(
    (c) => c.status === 'Renewed' || (c.renewalDate && new Date(c.renewalDate) <= new Date())
  ).length;

  const computed = {
    total_spend: invoices.totalSpend || 0,
    repeat_purchases: (invoices.invoiceCount || 0) + purchaseCount,
    contract_renewals: renewals,
    average_rating: ratingOf(partner),
  };

  return kpiDefs
    .filter((kpi) => kpi.enabled !== false)
    .map((kpi) => ({
      key: kpi.key,
      label: kpi.label,
      description: kpi.description || '',
      unit: kpi.unit || 'count',
      higherIsBetter: Boolean(kpi.higherIsBetter),
      value: computed[kpi.key] ?? null,
      available: computed[kpi.key] != null,
    }));
}
