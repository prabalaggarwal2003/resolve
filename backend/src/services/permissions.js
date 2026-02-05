/**
 * Role-based permissions. All users are added via school/college email.
 * - super_admin: full access (first signup)
 * - principal: view everything, no edit
 * - hod: view assets and issues of their department only
 * - teacher / student: report only (use /report)
 * - lab_technician: view assets of their assigned lab(s) only
 */

const EDIT_ROLES = ['super_admin', 'admin', 'manager'];
const VIEW_ALL_ROLES = ['super_admin', 'principal'];
const REPORT_ONLY_ROLES = ['teacher', 'student'];

export function canEdit(user) {
  if (!user?.role) return false;
  return EDIT_ROLES.includes(user.role);
}

export function canViewAll(user) {
  if (!user?.role) return false;
  return VIEW_ALL_ROLES.includes(user.role);
}

export function canReportOnly(user) {
  if (!user?.role) return false;
  return REPORT_ONLY_ROLES.includes(user.role);
}

export function isHod(user) {
  return user?.role === 'hod';
}

export function isLabTechnician(user) {
  return user?.role === 'lab_technician';
}

export function canManageUsers(user) {
  return user?.role === 'super_admin' || user?.role === 'admin';
}

/** Apply asset list filter by role (principal = all assets, hod = departmentId, lab_technician = locationId in assignedLocationIds) */
export function assetFilterForUser(user) {
  if (!user) return null;
  // If user has no organization yet, return a filter that matches nothing
  if (!user.organizationId) return { _id: { $exists: false } };
  const base = { organizationId: user.organizationId };
  
  // ROLE-BASED ACCESS DISABLED - Only organization filtering active
  // if (canViewAll(user)) return base;
  // if (isHod(user) && user.departmentId) {
  //   return { ...base, departmentId: user.departmentId };
  // }
  // if (isLabTechnician(user) && user.assignedLocationIds?.length) {
  //   return { ...base, locationId: { $in: user.assignedLocationIds } };
  // }
  // if (canReportOnly(user)) return { ...base, assignedTo: user._id };
  
  return base; // All users in organization can see all assets
}

/** Check if user can view a specific asset. */
export function canViewAsset(user, asset) {
  if (!user || !asset) return false;
  // Enforce organization scoping
  if (user.organizationId && asset.organizationId) {
    const aOrg = asset.organizationId?._id?.toString?.() ?? asset.organizationId?.toString?.();
    if (aOrg !== user.organizationId?.toString?.()) return false;
  }
  if (canViewAll(user)) return true;
  if (isHod(user) && asset.departmentId) {
    const deptId = asset.departmentId?._id?.toString?.() ?? asset.departmentId?.toString?.();
    return deptId === user.departmentId?.toString?.();
  }
  if (isLabTechnician(user) && user.assignedLocationIds?.length && asset.locationId) {
    const locId = asset.locationId?._id?.toString?.() ?? asset.locationId?.toString?.();
    return user.assignedLocationIds.some((id) => id?.toString?.() === locId);
  }
  if (canReportOnly(user) && asset.assignedTo) {
    const assignId = asset.assignedTo?._id?.toString?.() ?? asset.assignedTo?.toString?.();
    return assignId === user._id?.toString?.();
  }
  return false;
}

/** Apply issue list filter by role. For principal = all issues, HOD/lab_technician we need asset IDs - pass assetIds from caller. */
export function issueFilterForUser(user, assetIds) {
  if (!user) return null;
  if (!user.organizationId) return { _id: { $exists: false } };
  const base = { organizationId: user.organizationId };
  
  // ROLE-BASED ACCESS DISABLED - Only organization filtering active
  // if (canViewAll(user)) return base;
  // if (isHod(user) && assetIds?.length) {
  //   return { ...base, assetId: { $in: assetIds } };
  // }
  // if (isLabTechnician(user) && assetIds?.length) {
  //   return { ...base, assetId: { $in: assetIds } };
  // }
  // if (canReportOnly(user)) {
  //   return { ...base, $or: [{ reportedBy: user._id }, { reporterEmail: user.email?.toLowerCase() }] };
  // }
  
  return base; // All users in organization can see all issues
}

/** Get lab technicians for a department based on asset locations */
export async function getLabTechniciansForDepartment(departmentId, organizationId) {
  const { Asset, User } = await import('../models/index.js');
  const assets = await Asset.find({ departmentId, organizationId }).select('locationId').lean();
  const locationIds = [...new Set(assets.map(a => a.locationId?.toString()).filter(Boolean))];
  if (locationIds.length === 0) return [];
  return await User.find({ 
    role: 'lab_technician', 
    assignedLocationIds: { $in: locationIds },
    organizationId, // Only get lab technicians from the same organization
    isActive: true 
  }).select('_id name email').lean();
}

/** Assign issue to superadmin and corresponding lab technician */
export async function assignIssueToUsers(issueId, departmentId, organizationId) {
  const { Issue, User, Notification } = await import('../models/index.js');
  
  // Get superadmin
  const superadmin = await User.findOne({ role: 'super_admin', isActive: true, organizationId }).select('_id').lean();
  
  // Get lab technicians for the department
  const labTechnicians = await getLabTechniciansForDepartment(departmentId, organizationId);
  
  const assignedUsers = [];
  if (superadmin) assignedUsers.push(superadmin._id);
  assignedUsers.push(...labTechnicians.map(t => t._id));
  
  if (assignedUsers.length > 0) {
    await Issue.findByIdAndUpdate(issueId, { 
      assignedTo: assignedUsers.length === 1 ? assignedUsers[0] : assignedUsers[0], // Assign to first user (superadmin if exists)
      assignedAt: new Date()
    });
    
    // Create notifications
    const notifications = assignedUsers.map(userId => ({
      type: 'issue_assigned',
      title: 'New Issue Assigned',
      body: `A new issue has been assigned to you`,
      link: `/dashboard/issues/${issueId}`,
      userId,
      metadata: { issueId }
    }));
    
    await Notification.insertMany(notifications);
  }
  
  return assignedUsers;
}
