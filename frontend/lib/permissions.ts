export type PermissionLevel = 'read' | 'write' | null;

export type PermissionTabMode = 'readWrite' | 'visibleOnly' | 'readOnly' | 'empty';

export type PermissionsMap = Record<string, PermissionLevel>;

export const PERMISSION_TABS = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', section: 'Core', mode: 'empty' as PermissionTabMode },
  { key: 'assets', label: 'Assets', path: '/dashboard/assets', section: 'Core', mode: 'readWrite' as PermissionTabMode },
  { key: 'issues', label: 'Issues', path: '/dashboard/issues', section: 'Core', mode: 'readWrite' as PermissionTabMode },
  { key: 'locations', label: 'Locations', path: '/dashboard/locations', section: 'Manage', mode: 'readWrite' as PermissionTabMode },
  { key: 'maintenance', label: 'Maintenance', path: '/dashboard/maintenance', section: 'Manage', mode: 'readWrite' as PermissionTabMode },
  { key: 'assetHealth', label: 'Asset Health', path: '/dashboard/asset-health', section: 'Analytics', mode: 'readWrite' as PermissionTabMode },
  { key: 'reports', label: 'Reports', path: '/dashboard/reports', section: 'Manage', mode: 'readWrite' as PermissionTabMode },
  { key: 'kpis', label: 'KPIs & Metrics', path: '/dashboard/kpis', section: 'Analytics', mode: 'visibleOnly' as PermissionTabMode },
  { key: 'depreciation', label: 'Depreciation', path: '/dashboard/depreciation', section: 'Analytics', mode: 'readWrite' as PermissionTabMode },
  { key: 'budgets', label: 'Budgets & Procurement', path: '/dashboard/budgets', section: 'Analytics', mode: 'readWrite' as PermissionTabMode },
  { key: 'insights', label: 'Insights', path: '/dashboard/insights', section: 'Analytics', mode: 'readWrite' as PermissionTabMode },
  { key: 'roles', label: 'Users & Roles', path: '/dashboard/roles', section: 'Admin', mode: 'readWrite' as PermissionTabMode },
  { key: 'vendors', label: 'Vendors', path: '/dashboard/vendors', section: 'Admin', mode: 'readWrite' as PermissionTabMode },
  { key: 'audit', label: 'Audit Logs', path: '/dashboard/audit', section: 'Admin', mode: 'visibleOnly' as PermissionTabMode },
  { key: 'organization', label: 'Organization', path: '/dashboard/organization', section: 'Admin', mode: 'readWrite' as PermissionTabMode },
  { key: 'subscriptions', label: 'Subscriptions', path: '/dashboard/subscriptions', section: 'Settings', mode: 'readOnly' as PermissionTabMode },
] as const;

export const PROFILE_TAB = { key: 'profile', label: 'Profile', path: '/dashboard/profile' };

export type PermissionTabKey = (typeof PERMISSION_TABS)[number]['key'];

export const TAB_MODES: Record<PermissionTabKey, PermissionTabMode> = Object.fromEntries(
  PERMISSION_TABS.map((t) => [t.key, t.mode])
) as Record<PermissionTabKey, PermissionTabMode>;

export const LEGACY_ROLE_PERMISSIONS: Record<string, PermissionsMap> = {
  admin: {
    dashboard: 'read',
    assets: 'write',
    issues: 'write',
    locations: 'write',
    maintenance: 'write',
    assetHealth: 'read',
    reports: 'read',
    kpis: 'read',
    depreciation: 'write',
    budgets: 'read',
    insights: 'read',
    roles: 'read',
    vendors: 'read',
    audit: 'read',
    organization: null,
    subscriptions: 'read',
  },
  manager: {
    dashboard: 'read',
    assets: 'write',
    issues: 'read',
    locations: null,
    maintenance: 'write',
    assetHealth: null,
    reports: 'write',
    kpis: null,
    depreciation: null,
    budgets: null,
    roles: null,
    vendors: null,
    audit: null,
    organization: null,
    subscriptions: null,
  },
};

export function emptyPermissions(): PermissionsMap {
  return Object.fromEntries(PERMISSION_TABS.map((t) => [t.key, null]));
}

export function hasGrantedPermissions(permissions: PermissionsMap): boolean {
  return Object.values(permissions).some((level) => level === 'read' || level === 'write');
}

export function resolvePermissions(user: {
  role?: string;
  isSuperAdmin?: boolean;
  permissions?: PermissionsMap;
} | null): PermissionsMap {
  if (!user) return emptyPermissions();
  if (user.isSuperAdmin || user.role === 'super_admin') {
    return Object.fromEntries(PERMISSION_TABS.map((t) => [t.key, 'write' as PermissionLevel]));
  }
  if (user.permissions) {
    const merged = { ...emptyPermissions(), ...user.permissions };
    if (hasGrantedPermissions(merged)) return merged;
  }
  if (user.role && LEGACY_ROLE_PERMISSIONS[user.role]) {
    return { ...emptyPermissions(), ...LEGACY_ROLE_PERMISSIONS[user.role] };
  }
  return emptyPermissions();
}

export function canReadTab(permissions: PermissionsMap, tab: PermissionTabKey): boolean {
  const level = permissions[tab];
  return level === 'read' || level === 'write';
}

export function canWriteTab(permissions: PermissionsMap, tab: PermissionTabKey): boolean {
  if (TAB_MODES[tab] === 'readOnly' || TAB_MODES[tab] === 'visibleOnly' || TAB_MODES[tab] === 'empty') {
    return false;
  }
  return permissions[tab] === 'write';
}

export function getStoredUser(): {
  role?: string;
  isSuperAdmin?: boolean;
  permissions?: PermissionsMap;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return null;
  }
}

export function isSuperAdminUser(): boolean {
  const user = getStoredUser();
  return Boolean(user?.isSuperAdmin || user?.role === 'super_admin');
}

export function canRead(tab: PermissionTabKey): boolean {
  if (isSuperAdminUser()) return true;
  const user = getStoredUser();
  return canReadTab(resolvePermissions(user), tab);
}

export function canWrite(tab: PermissionTabKey): boolean {
  if (isSuperAdminUser()) return true;
  const user = getStoredUser();
  return canWriteTab(resolvePermissions(user), tab);
}

export function canManageUsers(): boolean {
  return isSuperAdminUser() || canWrite('roles');
}

export function canViewProfile(): boolean {
  return true;
}

export function refreshStoredUser(user: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new Event('user-updated'));
}
