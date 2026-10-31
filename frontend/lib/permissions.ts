export type PermissionLevel = 'read' | 'write' | null;

export type PermissionTabMode = 'readWrite' | 'visibleOnly' | 'readOnly' | 'empty';

export type TicketActionsMap = Record<string, boolean>;

export type PermissionsMap = Record<string, PermissionLevel | TicketActionsMap | undefined> & {
  ticketActions?: TicketActionsMap;
};

export const TICKET_ACTIONS = [
  { key: 'view', label: 'View tickets', description: 'See tickets in the list and detail views' },
  { key: 'create', label: 'Create tickets', description: 'Create new tickets from the dashboard' },
  { key: 'comment', label: 'Comment', description: 'Add public comments on tickets' },
  { key: 'internal_note', label: 'Add internal notes', description: 'Add staff-only internal notes' },
  { key: 'assign', label: 'Assign / reassign', description: 'Assign department, team, or handler' },
  { key: 'change_priority', label: 'Change priority', description: 'Change ticket priority' },
  { key: 'change_severity', label: 'Change severity', description: 'Change ticket severity' },
  { key: 'change_status', label: 'Change status', description: 'Move tickets along general workflow steps' },
  { key: 'resolve', label: 'Resolve', description: 'Mark tickets as resolved' },
  { key: 'verify', label: 'Verify', description: 'Verify a resolved ticket' },
  { key: 'close', label: 'Close', description: 'Close tickets' },
  { key: 'reopen', label: 'Reopen', description: 'Reopen closed, verified, or resolved tickets' },
  { key: 'escalate', label: 'Escalate', description: 'Manually escalate tickets (reason, reassign, optional priority bump)' },
  { key: 'manage_config', label: 'Manage ticket configuration', description: 'Edit statuses, types, workflow, automation & escalations' },
] as const;

export type TicketActionKey = (typeof TICKET_ACTIONS)[number]['key'];

export function emptyTicketActions(): TicketActionsMap {
  return Object.fromEntries(TICKET_ACTIONS.map((a) => [a.key, false]));
}

export function fullTicketActions(): TicketActionsMap {
  return Object.fromEntries(TICKET_ACTIONS.map((a) => [a.key, true]));
}

export function resolveTicketActions(permissions: PermissionsMap | null | undefined): TicketActionsMap {
  if (!permissions) return emptyTicketActions();
  const issuesLevel = permissions.issues as PermissionLevel;
  const raw = permissions.ticketActions;
  const hasExplicit =
    raw &&
    typeof raw === 'object' &&
    TICKET_ACTIONS.some((a) => typeof (raw as TicketActionsMap)[a.key] === 'boolean');

  if (hasExplicit) {
    const actions = emptyTicketActions();
    for (const a of TICKET_ACTIONS) {
      if (typeof (raw as TicketActionsMap)[a.key] === 'boolean') {
        actions[a.key] = Boolean((raw as TicketActionsMap)[a.key]);
      }
    }
    if (issuesLevel !== 'read' && issuesLevel !== 'write') return emptyTicketActions();
    if (issuesLevel === 'read') {
      const viewOnly = emptyTicketActions();
      viewOnly.view = actions.view !== false;
      return viewOnly;
    }
    actions.view = true;
    return actions;
  }

  if (issuesLevel === 'write') return fullTicketActions();
  if (issuesLevel === 'read') {
    const viewOnly = emptyTicketActions();
    viewOnly.view = true;
    return viewOnly;
  }
  return emptyTicketActions();
}

export const PERMISSION_TABS = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', section: 'Core', mode: 'empty' as PermissionTabMode },
  { key: 'assets', label: 'Assets', path: '/dashboard/assets', section: 'Core', mode: 'readWrite' as PermissionTabMode },
  { key: 'issues', label: 'Issues', path: '/dashboard/issues', section: 'Core', mode: 'readWrite' as PermissionTabMode },
  { key: 'locations', label: 'Locations', path: '/dashboard/locations', section: 'Manage', mode: 'readWrite' as PermissionTabMode },
  { key: 'maintenance', label: 'Maintenance', path: '/dashboard/maintenance', section: 'Manage', mode: 'readWrite' as PermissionTabMode },
  { key: 'reports', label: 'Report Studio', path: '/dashboard/reports', section: 'Manage', mode: 'readWrite' as PermissionTabMode },
  { key: 'kpis', label: 'KPIs & Metrics', path: '/dashboard/kpis', section: 'Analytics', mode: 'visibleOnly' as PermissionTabMode },
  { key: 'depreciation', label: 'Depreciation', path: '/dashboard/depreciation', section: 'Analytics', mode: 'readWrite' as PermissionTabMode },
  { key: 'budgets', label: 'Budgets & Procurement', path: '/dashboard/budgets/analytics', section: 'Analytics', mode: 'readWrite' as PermissionTabMode },
  { key: 'insights', label: 'Insights', path: '/dashboard/insights', section: 'Analytics', mode: 'readWrite' as PermissionTabMode },
  { key: 'roles', label: 'Users & Roles', path: '/dashboard/roles', section: 'Admin', mode: 'readWrite' as PermissionTabMode },
  { key: 'businessPartners', label: 'Business Partners', path: '/dashboard/partners', section: 'Admin', mode: 'readWrite' as PermissionTabMode },
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
    reports: 'read',
    kpis: 'read',
    depreciation: 'write',
    budgets: 'read',
    insights: 'read',
    roles: 'read',
    businessPartners: 'read',
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
    reports: 'write',
    kpis: null,
    depreciation: null,
    budgets: null,
    roles: null,
    businessPartners: null,
    audit: null,
    organization: null,
    subscriptions: null,
  },
};

export function emptyPermissions(): PermissionsMap {
  return Object.fromEntries(PERMISSION_TABS.map((t) => [t.key, null]));
}

/** Drop legacy keys (e.g. profile, vendors) when loading/saving role permissions. */
export function normalizeRolePermissions(input?: PermissionsMap | Record<string, unknown> | null): PermissionsMap {
  const out = emptyPermissions();
  if (!input || typeof input !== 'object') return out;
  const bridged = { ...input } as Record<string, unknown>;
  if (bridged.vendors && !bridged.businessPartners) {
    bridged.businessPartners = bridged.vendors;
  }
  for (const tab of PERMISSION_TABS) {
    const level = bridged[tab.key];
    if (level === 'read' || level === 'write') {
      const mode = TAB_MODES[tab.key];
      out[tab.key] =
        mode === 'visibleOnly' || mode === 'empty' || mode === 'readOnly' ? 'read' : level;
    }
  }
  if (bridged.ticketActions && typeof bridged.ticketActions === 'object') {
    out.ticketActions = { ...(bridged.ticketActions as TicketActionsMap) };
  }
  return out;
}

export function hasGrantedPermissions(permissions: PermissionsMap): boolean {
  return Object.entries(permissions).some(
    ([key, level]) => key !== 'ticketActions' && (level === 'read' || level === 'write')
  );
}

export function resolvePermissions(user: {
  role?: string;
  isSuperAdmin?: boolean;
  permissions?: PermissionsMap;
} | null): PermissionsMap {
  if (!user) return emptyPermissions();
  if (user.isSuperAdmin || user.role === 'super_admin') {
    const full = Object.fromEntries(PERMISSION_TABS.map((t) => [t.key, 'write' as PermissionLevel])) as PermissionsMap;
    full.ticketActions = fullTicketActions();
    return full;
  }
  if (user.permissions) {
    const merged = { ...emptyPermissions(), ...user.permissions } as PermissionsMap;
    if ((merged as Record<string, unknown>).vendors && !merged.businessPartners) {
      merged.businessPartners = (merged as Record<string, unknown>).vendors as PermissionLevel;
    }
    merged.ticketActions = resolveTicketActions(merged);
    if (hasGrantedPermissions(merged)) return merged;
  }
  if (user.role && LEGACY_ROLE_PERMISSIONS[user.role]) {
    const merged = { ...emptyPermissions(), ...LEGACY_ROLE_PERMISSIONS[user.role] } as PermissionsMap;
    merged.ticketActions = resolveTicketActions(merged);
    return merged;
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

export function canTicketAction(action: TicketActionKey | string): boolean {
  if (isSuperAdminUser()) return true;
  const user = getStoredUser();
  const perms = resolvePermissions(user);
  return Boolean(resolveTicketActions(perms)[action]);
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
