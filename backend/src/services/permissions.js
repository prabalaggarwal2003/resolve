/**
 * Role-based permissions.
 * super_admin  — full access via permission resolver
 * custom roles — per-tab read/write from OrgRole
 * legacy admin/manager — mapped in permissionResolver until migrated
 */

import {
  canReadTab,
  canWriteTab,
  isSuperAdmin,
} from './permissionResolver.js';

const SUPER_ADMIN_ONLY = ['super_admin'];
const EDIT_ROLES       = ['super_admin', 'admin'];
const VIEW_ALL_ROLES   = ['super_admin', 'admin'];
const REPORT_ONLY      = [];

function perms(user, req) {
  return req?.userPermissions ?? user?._permissions ?? null;
}

export function canEdit(user, tab = 'assets', req = null) {
  if (isSuperAdmin(user)) return true;
  const permissions = perms(user, req);
  if (permissions) return canWriteTab(permissions, tab);
  return EDIT_ROLES.includes(user?.role);
}

export function canReadTabAccess(user, tab, req = null) {
  if (isSuperAdmin(user)) return true;
  const permissions = perms(user, req);
  if (permissions) return canReadTab(permissions, tab);
  return legacyCanRead(user, tab);
}

export function canWriteTabAccess(user, tab, req = null) {
  if (isSuperAdmin(user)) return true;
  const permissions = perms(user, req);
  if (permissions) return canWriteTab(permissions, tab);
  return legacyCanWrite(user, tab);
}

function legacyCanRead(user, tab) {
  if (tab === 'assets' || tab === 'issues') {
    return EDIT_ROLES.includes(user?.role) || user?.role === 'manager';
  }
  if (tab === 'organization' || tab === 'subscriptions') {
    return user?.role === 'super_admin';
  }
  if (tab === 'roles') return EDIT_ROLES.includes(user?.role);
  if (tab === 'reports') return ['super_admin', 'admin', 'manager'].includes(user?.role);
  if (tab === 'locations' || tab === 'vendors') return EDIT_ROLES.includes(user?.role);
  if (tab === 'audit' || tab === 'kpis' || tab === 'depreciation') {
    return EDIT_ROLES.includes(user?.role);
  }
  return EDIT_ROLES.includes(user?.role);
}

function legacyCanWrite(user, tab) {
  if (tab === 'subscriptions') return user?.role === 'super_admin';
  if (tab === 'roles') return user?.role === 'super_admin';
  if (tab === 'organization') return user?.role === 'super_admin';
  if (tab === 'reports') return user?.role === 'manager' || EDIT_ROLES.includes(user?.role);
  return EDIT_ROLES.includes(user?.role);
}

export function canViewAll(user, req = null) {
  return isOrgWideAdmin(user);
}

export function canRead(user, tab, req = null) {
  return canReadTabAccess(user, tab, req);
}

export function canWrite(user, tab, req = null) {
  return canWriteTabAccess(user, tab, req);
}

export function canManageUsers(user, req = null) {
  if (isSuperAdmin(user)) return true;
  return canWriteTabAccess(user, 'roles', req);
}

export function canReadRoles(user, req = null) {
  if (isSuperAdmin(user)) return true;
  return canReadTabAccess(user, 'roles', req);
}

export function canReportOnly(user) {
  return REPORT_ONLY.includes(user?.role);
}

export function isManager(user) {
  return user?.role === 'manager';
}

// Legacy helpers kept for backward compat
export function isHod(user)           { return user?.role === 'hod'; }
export function isLabTechnician(user) { return user?.role === 'lab_technician'; }

/** super_admin and legacy admin see all departments */
export function isOrgWideAdmin(user) {
  return isSuperAdmin(user) || user?.role === 'admin';
}

/**
 * When set, user only sees assets/issues for this department.
 * No department on user = org-wide access (within tab permissions).
 */
export function getDepartmentScopeId(user) {
  if (!user?.departmentId || isOrgWideAdmin(user)) return null;
  if (canReportOnly(user)) return null;
  if (isLabTechnician(user) && user.assignedLocationIds?.length) return null;
  return user.departmentId?._id ?? user.departmentId;
}

/**
 * Build asset list filter for the logged-in user.
 * No department → all org assets (within tab permissions).
 * Department set → only that department's assets.
 */
export function assetFilterForUser(user) {
  if (!user) return null;
  if (!user.organizationId) return { _id: { $exists: false } };

  const base = { organizationId: user.organizationId };

  if (isOrgWideAdmin(user)) return base;

  if (canReportOnly(user)) {
    return { ...base, assignedTo: user._id };
  }

  if (isLabTechnician(user) && user.assignedLocationIds?.length) {
    return { ...base, locationId: { $in: user.assignedLocationIds } };
  }

  const deptScope = getDepartmentScopeId(user);
  if (deptScope) {
    return { ...base, departmentId: deptScope };
  }

  return base;
}

/**
 * Check if a user can view a specific asset (used in GET /assets/:id).
 */
export function canViewAsset(user, asset) {
  if (!user || !asset) return false;

  const aOrg = asset.organizationId?._id?.toString?.() ?? asset.organizationId?.toString?.();
  if (user.organizationId && aOrg && aOrg !== user.organizationId.toString()) return false;

  if (isOrgWideAdmin(user)) return true;

  if (canReportOnly(user)) {
    const assignId = asset.assignedTo?._id?.toString?.() ?? asset.assignedTo?.toString?.();
    return assignId === user._id?.toString?.();
  }

  if (isLabTechnician(user) && user.assignedLocationIds?.length && asset.locationId) {
    const locId = asset.locationId?._id?.toString?.() ?? asset.locationId?.toString?.();
    return user.assignedLocationIds.some((id) => id?.toString?.() === locId);
  }

  const deptScope = getDepartmentScopeId(user);
  if (deptScope) {
    const deptId = asset.departmentId?._id?.toString?.() ?? asset.departmentId?.toString?.();
    return deptId === deptScope?.toString?.();
  }

  return true;
}

/**
 * Build issue list filter for the logged-in user.
 * Pass assetIds when user is scoped to department or location.
 */
export function issueFilterForUser(user, assetIds) {
  if (!user) return null;
  if (!user.organizationId) return { _id: { $exists: false } };

  const base = { organizationId: user.organizationId };

  if (isOrgWideAdmin(user)) return base;

  if (canReportOnly(user)) {
    return { ...base, $or: [{ reportedBy: user._id }, { reporterEmail: user.email?.toLowerCase() }] };
  }

  if (isLabTechnician(user) && assetIds?.length) {
    return { ...base, assetId: { $in: assetIds } };
  }

  const deptScope = getDepartmentScopeId(user);
  if (deptScope) {
    if (assetIds?.length) {
      return { ...base, assetId: { $in: assetIds } };
    }
    return { ...base, assetId: { $in: [] } };
  }

  return base;
}

export async function resolveScopedAssetIds(user) {
  const { Asset } = await import('../models/index.js');
  const filter = assetFilterForUser(user);
  if (!filter) return [];
  const assets = await Asset.find(filter).select('_id').lean();
  return assets.map((a) => a._id);
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
