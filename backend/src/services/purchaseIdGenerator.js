import Procurement from '../models/Procurement.js';

export async function generatePurchaseId(organizationId) {
  const latest = await Procurement.findOne({ organizationId })
    .sort({ createdAt: -1 })
    .select('purchaseId')
    .lean();

  let nextNumber = 1;
  if (latest?.purchaseId) {
    const match = latest.purchaseId.match(/PUR-(\d+)/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }

  const purchaseId = `PUR-${String(nextNumber).padStart(3, '0')}`;
  const existing = await Procurement.findOne({ organizationId, purchaseId });
  if (existing) return generatePurchaseId(organizationId);
  return purchaseId;
}
