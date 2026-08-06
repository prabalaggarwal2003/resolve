import PartnerActivity from '../models/PartnerActivity.js';

export function serializePartnerActivity(activity) {
  if (!activity) return null;
  const partner = activity.partnerId && typeof activity.partnerId === 'object' ? activity.partnerId : null;
  const user = activity.userId && typeof activity.userId === 'object' ? activity.userId : null;
  const details = activity.details || {};
  const changes = Array.isArray(details.changes) ? details.changes : [];

  return {
    id: String(activity._id),
    _id: String(activity._id),
    type: activity.type,
    summary: activity.summary,
    details,
    changes,
    partnerId: partner?._id
      ? String(partner._id)
      : activity.partnerId
        ? String(activity.partnerId)
        : null,
    partnerName: partner?.name || details.partnerName || '',
    partnerCode: partner?.partnerCode || details.partnerCode || '',
    userId: user?._id ? String(user._id) : activity.userId ? String(activity.userId) : null,
    userName: user?.name || details.userName || 'System',
    userEmail: user?.email || '',
    createdAt: activity.createdAt,
  };
}

async function loadActivity(id) {
  return PartnerActivity.findById(id)
    .populate('partnerId', 'name partnerCode')
    .populate('userId', 'name email')
    .lean();
}

export async function recordPartnerActivity({
  organizationId,
  partnerId,
  userId,
  type = 'other',
  summary,
  details = {},
}) {
  try {
    if (!organizationId || !partnerId || !summary) return null;
    const created = await PartnerActivity.create({
      organizationId,
      partnerId,
      userId,
      type,
      summary,
      details,
    });
    const populated = await loadActivity(created._id);
    return serializePartnerActivity(populated || created.toObject());
  } catch (err) {
    console.error('Partner activity log failed:', err.message);
    return null;
  }
}

export async function listPartnerActivities(partnerId, organizationId, limit = 50) {
  const rows = await PartnerActivity.find({ partnerId, organizationId })
    .populate('partnerId', 'name partnerCode')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map(serializePartnerActivity);
}

export async function listOrgPartnerActivities(organizationId, limit = 100) {
  const rows = await PartnerActivity.find({ organizationId })
    .populate('partnerId', 'name partnerCode')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map(serializePartnerActivity);
}
