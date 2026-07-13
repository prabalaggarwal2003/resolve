/** Nav tabs that super admins can grant per custom role. */
export const PERMISSION_TABS = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', section: 'Core', mode: 'empty' },
  { key: 'assets', label: 'Assets', path: '/dashboard/assets', section: 'Core', mode: 'readWrite' },
  { key: 'issues', label: 'Issues', path: '/dashboard/issues', section: 'Core', mode: 'readWrite' },
  { key: 'locations', label: 'Locations', path: '/dashboard/locations', section: 'Manage', mode: 'readWrite' },
  { key: 'maintenance', label: 'Maintenance', path: '/dashboard/maintenance', section: 'Manage', mode: 'readWrite' },
  { key: 'assetHealth', label: 'Asset Health', path: '/dashboard/asset-health', section: 'Analytics', mode: 'readWrite' },
  { key: 'reports', label: 'Reports', path: '/dashboard/reports', section: 'Manage', mode: 'readWrite' },
  { key: 'kpis', label: 'KPIs & Metrics', path: '/dashboard/kpis', section: 'Analytics', mode: 'visibleOnly' },
  { key: 'depreciation', label: 'Depreciation', path: '/dashboard/depreciation', section: 'Analytics', mode: 'readWrite' },
  { key: 'budgets', label: 'Budgets & Procurement', path: '/dashboard/budgets', section: 'Analytics', mode: 'readWrite' },
  { key: 'insights', label: 'Insights', path: '/dashboard/insights', section: 'Analytics', mode: 'readWrite' },
  { key: 'roles', label: 'Users & Roles', path: '/dashboard/roles', section: 'Admin', mode: 'readWrite' },
  { key: 'vendors', label: 'Vendors', path: '/dashboard/vendors', section: 'Admin', mode: 'readWrite' },
  { key: 'audit', label: 'Audit Logs', path: '/dashboard/audit', section: 'Admin', mode: 'visibleOnly' },
  { key: 'organization', label: 'Organization', path: '/dashboard/organization', section: 'Admin', mode: 'readWrite' },
  { key: 'subscriptions', label: 'Subscriptions', path: '/dashboard/subscriptions', section: 'Settings', mode: 'readOnly' },
];

/** Profile is always available to logged-in users — not configurable per role. */
export const PROFILE_TAB = { key: 'profile', label: 'Profile', path: '/dashboard/profile' };

export const PERMISSION_TAB_KEYS = PERMISSION_TABS.map((t) => t.key);

export const TAB_MODES = Object.fromEntries(PERMISSION_TABS.map((t) => [t.key, t.mode]));

export const PERMISSION_LEVELS = ['read', 'write'];

export function emptyPermissions() {
  return Object.fromEntries(PERMISSION_TAB_KEYS.map((k) => [k, null]));
}

export function fullWritePermissions() {
  return Object.fromEntries(PERMISSION_TAB_KEYS.map((k) => [k, 'write']));
}

/** Legacy predefined roles until users are migrated to custom roles. */
export const LEGACY_ROLE_PERMISSIONS = {
  admin: {
    dashboard: 'read',
    assets: 'write',
    issues: 'write',
    locations: 'write',
    maintenance: 'write',
    assetHealth: 'read',
    reports: 'read',
    kpis: 'read',
    depreciation: 'read',
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

export function sanitizePermissions(input) {
  const out = emptyPermissions();
  if (!input || typeof input !== 'object') return out;
  for (const key of PERMISSION_TAB_KEYS) {
    let level = input[key];
    if (level !== 'read' && level !== 'write') continue;
    const mode = TAB_MODES[key];
    if (mode === 'visibleOnly' || mode === 'empty') {
      out[key] = 'read';
    } else if (mode === 'readOnly') {
      out[key] = 'read';
    } else {
      out[key] = level;
    }
  }
  return out;
}

export function compactPermissions(input) {
  const full = sanitizePermissions(input);
  return Object.fromEntries(
    Object.entries(full).filter(([, level]) => level === 'read' || level === 'write')
  );
}

export function hasGrantedPermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') return false;
  return Object.values(permissions).some((level) => level === 'read' || level === 'write');
}

export function validatePermissionsPayload(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'Permissions object is required' };
  }
  for (const [key, level] of Object.entries(input)) {
    if (!PERMISSION_TAB_KEYS.includes(key)) {
      return { ok: false, message: `Unknown permission tab: ${key}` };
    }
    if (level !== null && level !== 'read' && level !== 'write') {
      return { ok: false, message: `Invalid permission level for ${key}` };
    }
    const mode = TAB_MODES[key];
    if (level === 'write' && (mode === 'visibleOnly' || mode === 'empty' || mode === 'readOnly')) {
      return { ok: false, message: `${key} does not support write permission` };
    }
  }
  return { ok: true, permissions: sanitizePermissions(input) };
}
