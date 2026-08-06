import mongoose from 'mongoose';
import {
  User,
  Organization,
  Asset,
  AssetLog,
  Issue,
  Location,
  Department,
  BusinessPartner,
  BusinessPartnerOrgConfig,
  BusinessPartnerDashboard,
  PartnerActivity,
  PartnerContract,
  PartnerDocument,
  PartnerLink,
  Invoice,
  Report,
  AuditLog,
  Notification,
  Otp,
  RateLimit,
} from '../models/index.js';

export async function deleteOrganizationCascade(organizationId) {
  const orgId =
    organizationId instanceof mongoose.Types.ObjectId
      ? organizationId
      : new mongoose.Types.ObjectId(organizationId);

  const orgUsers = await User.find({ organizationId: orgId }).select('_id email').lean();
  const userIds = orgUsers.map((u) => u._id);
  const userEmails = orgUsers.map((u) => u.email);

  const assets = await Asset.find({ organizationId: orgId }).select('_id').lean();
  const assetIds = assets.map((a) => a._id);

  if (assetIds.length) {
    await Promise.all([
      AssetLog.deleteMany({ assetId: { $in: assetIds } }),
      RateLimit.deleteMany({ assetId: { $in: assetIds } }),
    ]);
  }

  if (userIds.length) {
    await Notification.deleteMany({ userId: { $in: userIds } });
  }

  await Promise.all([
    Issue.deleteMany({ organizationId: orgId }),
    Asset.deleteMany({ organizationId: orgId }),
    Invoice.deleteMany({ organizationId: orgId }),
    BusinessPartner.deleteMany({ organizationId: orgId }),
    BusinessPartnerOrgConfig.deleteMany({ organizationId: orgId }),
    BusinessPartnerDashboard.deleteMany({ organizationId: orgId }),
    PartnerActivity.deleteMany({ organizationId: orgId }),
    PartnerContract.deleteMany({ organizationId: orgId }),
    PartnerDocument.deleteMany({ organizationId: orgId }),
    PartnerLink.deleteMany({ organizationId: orgId }),
    Report.deleteMany({ organizationId: orgId }),
    AuditLog.deleteMany({ organizationId: orgId }),
    Location.deleteMany({ organizationId: orgId }),
    Department.deleteMany({ organizationId: orgId }),
    User.deleteMany({ organizationId: orgId }),
  ]);

  if (userEmails.length) {
    await Otp.deleteMany({ email: { $in: userEmails } });
  }
  await Otp.deleteMany({ 'tempData.organizationId': orgId });

  await Organization.findByIdAndDelete(orgId);
}
