import { Department, OrgRole, Organization } from '../models/index.js';
import { attachPermissions } from './permissionResolver.js';
import { getOrganizationSubscriptionStatus } from './organizationSubscriptionService.js';

export async function buildAuthUserPayload(user) {
  const lean = user?.toObject ? user.toObject() : user;
  if (!lean) return null;

  let departmentName = null;
  if (lean.departmentId) {
    const dept = await Department.findById(lean.departmentId).select('name').lean();
    departmentName = dept?.name ?? null;
  }

  let customRoleName = null;
  if (lean.customRoleId) {
    const roleId = lean.customRoleId?._id ?? lean.customRoleId;
    const orgRole = await OrgRole.findById(roleId).select('name').lean();
    customRoleName = orgRole?.name ?? null;
  }

  const { permissions, isSuperAdmin } = await attachPermissions(lean);

  let subscription = getOrganizationSubscriptionStatus(null);
  if (lean.organizationId) {
    const org = await Organization.findById(lean.organizationId)
      .select('subscriptionTier subscriptionPlan subscriptionEndDate subscriptionStartDate razorpaySubscriptionId')
      .lean();
    subscription = getOrganizationSubscriptionStatus(org);
  }

  return {
    id: lean._id,
    email: lean.email,
    name: lean.name,
    role: lean.role,
    organizationId: lean.organizationId,
    departmentId: lean.departmentId ?? null,
    departmentName,
    customRoleId: lean.customRoleId?._id ?? lean.customRoleId ?? null,
    customRoleName,
    permissions,
    isSuperAdmin,
    subscription: {
      tier: subscription.tier,
      plan: subscription.plan,
      isExpired: subscription.isExpired,
    },
  };
}
