import { OrgRole } from '../models/index.js';
import {
  PERMISSION_TAB_KEYS,
  LEGACY_ROLE_PERMISSIONS,
  TAB_MODES,
  fullWritePermissions,
  emptyPermissions,
} from '../constants/permissionTabs.js';

export function isSuperAdmin(user) {
  return user?.role === 'super_admin';
}

export function tabAccessLevel(permissions, tab) {
  const level = permissions?.[tab];
  return level === 'read' || level === 'write' ? level : null;
}

export function canReadTab(permissions, tab) {
  const level = tabAccessLevel(permissions, tab);
  return level === 'read' || level === 'write';
}

export function canWriteTab(permissions, tab) {
  const mode = TAB_MODES[tab];
  if (mode === 'visibleOnly' || mode === 'empty' || mode === 'readOnly') return false;
  return tabAccessLevel(permissions, tab) === 'write';
}

function normalizePermissions(raw) {
  const out = emptyPermissions();
  if (!raw) return out;
  let source = raw;
  if (raw instanceof Map) {
    source = Object.fromEntries(raw.entries());
  } else if (typeof raw === 'object' && raw !== null && typeof raw.toObject === 'function') {
    source = raw.toObject();
  }
  for (const key of PERMISSION_TAB_KEYS) {
    const level = source[key];
    if (level === 'read' || level === 'write') out[key] = level;
  }
  return out;
}

function hasGrantedPermissions(permissions) {
  return Object.values(permissions).some((level) => level === 'read' || level === 'write');
}

async function loadOrgRolePermissions(user) {
  const roleRef = user.customRoleId;
  if (!roleRef) return null;

  const roleId = roleRef?._id?.toString?.() ?? roleRef?.toString?.();
  if (!roleId) return null;

  const orgRole = await OrgRole.findById(roleId).select('permissions isActive organizationId').lean();
  if (!orgRole || orgRole.isActive === false) return null;
  if (
    user.organizationId &&
    orgRole.organizationId?.toString() !== user.organizationId?.toString?.()
  ) {
    return null;
  }
  return normalizePermissions(orgRole.permissions);
}

export async function resolveUserPermissions(user) {
  if (!user) return emptyPermissions();
  if (isSuperAdmin(user)) return fullWritePermissions();

  if (user.customRoleId || user.role === 'custom') {
    const fromRole = await loadOrgRolePermissions(user);
    if (fromRole && hasGrantedPermissions(fromRole)) return fromRole;
  }

  if (LEGACY_ROLE_PERMISSIONS[user.role]) {
    return normalizePermissions(LEGACY_ROLE_PERMISSIONS[user.role]);
  }

  return emptyPermissions();
}

export async function attachPermissions(userDoc) {
  const permissions = await resolveUserPermissions(userDoc);
  return { permissions, isSuperAdmin: isSuperAdmin(userDoc) };
}
