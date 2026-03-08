/**
 * Role-based permissions.
 * super_admin  — full access, only one who can manage users
 * admin        — manage assets/issues/locations, no user management
 * manager      — view + manage assets & issues in their department only
 * reporter     — report issues only, view their assigned assets only
 */

const SUPER_ADMIN_ONLY = ['super_admin'];
const EDIT_ROLES       = ['super_admin', 'admin'];
const VIEW_ALL_ROLES   = ['super_admin', 'admin'];
const REPORT_ONLY      = [];

export function canEdit(user) {
  return EDIT_ROLES.includes(user?.role);
}

export function canViewAll(user) {
  return VIEW_ALL_ROLES.includes(user?.role);
}

export function canReportOnly(user) {
  return REPORT_ONLY.includes(user?.role);
}

export function canManageUsers(user) {
  return SUPER_ADMIN_ONLY.includes(user?.role);
}

export function isManager(user) {
  return user?.role === 'manager';
}

// Legacy helpers kept for backward compat
export function isHod(user)           { return user?.role === 'hod'; }
export function isLabTechnician(user) { return user?.role === 'lab_technician'; }

/**
 * Build asset list filter for the logged-in user.
 * super_admin / admin  → all assets in their org
 * manager              → only assets in their department
 * reporter             → only assets assigned to them
 */
export function assetFilterForUser(user) {
  if (!user) return null;
  if (!user.organizationId) return { _id: { $exists: false } };

  const base = { organizationId: user.organizationId };

  if (canViewAll(user)) return base;

  if (isManager(user) && user.departmentId) {
    return { ...base, departmentId: user.departmentId };
  }

  if (canReportOnly(user)) {
    return { ...base, assignedTo: user._id };
  }

  // legacy roles
  if (isHod(user) && user.departmentId)
    return { ...base, departmentId: user.departmentId };
  if (isLabTechnician(user) && user.assignedLocationIds?.length)
    return { ...base, locationId: { $in: user.assignedLocationIds } };

  return base;
}

/**
 * Check if a user can view a specific asset (used in GET /assets/:id).
 */
export function canViewAsset(user, asset) {
  if (!user || !asset) return false;

  // Always enforce org boundary
  const aOrg = asset.organizationId?._id?.toString?.() ?? asset.organizationId?.toString?.();
  if (user.organizationId && aOrg && aOrg !== user.organizationId.toString()) return false;

  if (canViewAll(user)) return true;

  if (isManager(user) && user.departmentId) {
    const deptId = asset.departmentId?._id?.toString?.() ?? asset.departmentId?.toString?.();
    return deptId === user.departmentId?.toString?.();
  }

  if (canReportOnly(user)) {
    const assignId = asset.assignedTo?._id?.toString?.() ?? asset.assignedTo?.toString?.();
    return assignId === user._id?.toString?.();
  }

  // legacy
  if (isHod(user) && asset.departmentId) {
    const deptId = asset.departmentId?._id?.toString?.() ?? asset.departmentId?.toString?.();
    return deptId === user.departmentId?.toString?.();
  }
  if (isLabTechnician(user) && user.assignedLocationIds?.length && asset.locationId) {
    const locId = asset.locationId?._id?.toString?.() ?? asset.locationId?.toString?.();
    return user.assignedLocationIds.some((id) => id?.toString?.() === locId);
  }

  return false;
}

/**
 * Build issue list filter for the logged-in user.
 */
export function issueFilterForUser(user, assetIds) {
  if (!user) return null;
  if (!user.organizationId) return { _id: { $exists: false } };

  const base = { organizationId: user.organizationId };

  if (canViewAll(user)) return base;

  if (isManager(user) && assetIds?.length)
    return { ...base, assetId: { $in: assetIds } };

  if (canReportOnly(user))
    return { ...base, $or: [{ reportedBy: user._id }, { reporterEmail: user.email?.toLowerCase() }] };

  // legacy
  if ((isHod(user) || isLabTechnician(user)) && assetIds?.length)
    return { ...base, assetId: { $in: assetIds } };

  return base;
}

// Keep existing helpers below
export async function getLabTechniciansForDepartment(departmentId, organizationId) {
  const { Asset, User } = await import('../models/index.js');
  const assets = await Asset.find({ departmentId, organizationId }).select('locationId').lean();
  const locationIds = [...new Set(assets.map(a => a.locationId?.toString()).filter(Boolean))];
  if (locationIds.length === 0) return [];
  return await User.find({ role: 'lab_technician', assignedLocationIds: { $in: locationIds }, organizationId, isActive: true }).select('_id name email').lean();
}

export async function assignIssueToUsers(issueId, departmentId, organizationId) {
  const { Issue, User, Notification } = await import('../models/index.js');
  const superadmin = await User.findOne({ role: 'super_admin', isActive: true, organizationId }).select('_id').lean();
  const labTechnicians = await getLabTechniciansForDepartment(departmentId, organizationId);
  const assignedUsers = [];
  if (superadmin) assignedUsers.push(superadmin._id);
  assignedUsers.push(...labTechnicians.map(t => t._id));
  if (assignedUsers.length > 0) {
    await Issue.findByIdAndUpdate(issueId, { assignedTo: assignedUsers[0], assignedAt: new Date() });
    const notifications = assignedUsers.map(userId => ({
      type: 'issue_assigned', title: 'New Issue Assigned',
      body: 'A new issue has been assigned to you',
      link: `/dashboard/issues/${issueId}`, userId, metadata: { issueId }
    }));
    await Notification.insertMany(notifications);
  }
  return assignedUsers;
}
