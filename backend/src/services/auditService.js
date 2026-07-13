import { AuditLog } from '../models/index.js';

export async function logAudit(userId, action, resource, resourceId, options = {}) {
  try {
    const {
      resourceName,
      description,
      details = {},
      ipAddress,
      userAgent,
      severity = 'low',
      organizationId
    } = options;

    await AuditLog.create({
      userId,
      organizationId,
      action,
      resource,
      resourceId,
      resourceName,
      description,
      details,
      ipAddress,
      userAgent,
      severity
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

// Helper function to extract request metadata
export function getRequestMetadata(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    organizationId: req.user?.organizationId
  };
}

// Pre-defined audit actions with descriptions
export const AUDIT_ACTIONS = {
  // Assets
  ASSET_CREATED: 'created',
  ASSET_UPDATED: 'updated',
  ASSET_DELETED: 'deleted',
  ASSET_ASSIGNED: 'assigned',
  ASSET_UNASSIGNED: 'unassigned',
  ASSET_NOTE_ADDED: 'note_added',

  // Issues
  ISSUE_CREATED: 'created',
  ISSUE_UPDATED: 'updated',
  ISSUE_STATUS_CHANGED: 'status_changed',
  ISSUE_DELETED: 'deleted',

  // Users
  USER_CREATED: 'created',
  USER_UPDATED: 'updated',
  USER_DELETED: 'deleted',
  USER_ROLE_CHANGED: 'role_changed',
  USER_ACTIVATED: 'activated',
  USER_DEACTIVATED: 'deactivated',

  // Organization
  ORG_UPDATED: 'updated',
  ORG_SETTINGS_CHANGED: 'settings_changed',

  // Locations
  LOCATION_CREATED: 'created',
  LOCATION_UPDATED: 'updated',
  LOCATION_DELETED: 'deleted',

  // Departments
  DEPARTMENT_CREATED: 'created',
  DEPARTMENT_UPDATED: 'updated',
  DEPARTMENT_DELETED: 'deleted',

  // Vendors
  VENDOR_CREATED: 'created',
  VENDOR_UPDATED: 'updated',
  VENDOR_DELETED: 'deleted',

  // Invoices
  INVOICE_CREATED: 'created',
  INVOICE_UPDATED: 'updated',
  INVOICE_DELETED: 'deleted',

  // Authentication
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_CHANGED: 'password_changed',
  TWO_FACTOR_ENABLED: '2fa_enabled',
  TWO_FACTOR_DISABLED: '2fa_disabled',
  RECOVERY_CODES_REGENERATED: 'recovery_codes_regenerated',

  // Reports
  REPORT_GENERATED: 'generated',
  REPORT_DOWNLOADED: 'downloaded',

  // Maintenance
  MAINTENANCE_STARTED: 'maintenance_started',
  MAINTENANCE_COMPLETED: 'maintenance_completed',

  // Budgets
  BUDGET_CREATED: 'created',
  BUDGET_UPDATED: 'updated',
  BUDGET_DELETED: 'deleted',
  BUDGET_CONFIG_UPDATED: 'settings_changed',

  // Procurement
  PROCUREMENT_CREATED: 'created',
  PROCUREMENT_UPDATED: 'updated',
  PROCUREMENT_DELETED: 'deleted',
  PROCUREMENT_LINKED: 'linked',
  PROCUREMENT_CONFIG_UPDATED: 'settings_changed',

  // Insights
  INSIGHT_CONFIG_UPDATED: 'settings_changed',
  INSIGHT_RULE_CREATED: 'created',
  INSIGHT_RULE_UPDATED: 'updated',
  INSIGHT_RULE_DELETED: 'deleted',
  INSIGHT_RULE_RESET: 'reset',

  // Asset health
  ASSET_HEALTH_CONFIG_UPDATED: 'settings_changed',
  ASSET_HEALTH_PROFILE_CREATED: 'created',
  ASSET_HEALTH_PROFILE_UPDATED: 'updated',
  ASSET_HEALTH_PROFILE_DELETED: 'deleted',
  ASSET_HEALTH_DASHBOARD_CREATED: 'created',
  ASSET_HEALTH_DASHBOARD_UPDATED: 'updated',
  ASSET_HEALTH_DASHBOARD_DELETED: 'deleted',
  ASSET_HEALTH_DASHBOARD_DUPLICATED: 'duplicated',
  ASSET_HEALTH_RULE_RESET: 'reset',
  HEALTH_CHECK_RUN: 'health_check_run',
};

export const AUDIT_RESOURCES = {
  ASSET: 'asset',
  ISSUE: 'issue',
  USER: 'user',
  ORGANIZATION: 'organization',
  LOCATION: 'location',
  DEPARTMENT: 'department',
  VENDOR: 'vendor',
  INVOICE: 'invoice',
  AUTH: 'authentication',
  PROFILE: 'profile',
  REPORT: 'report',
  MAINTENANCE: 'maintenance',
  AUDIT: 'audit',
  BUDGET: 'budget',
  PROCUREMENT: 'procurement',
  INSIGHT: 'insight',
  ASSET_HEALTH: 'asset_health',
};

export const AUDIT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export async function logFileDownload(userId, req, { fileName, resource, resourceId, resourceName }) {
  if (!fileName) return;

  await logAudit(userId, AUDIT_ACTIONS.REPORT_DOWNLOADED, resource, resourceId || req.user?.organizationId, {
    resourceName: resourceName || fileName,
    description: `Downloaded ${fileName}`,
    details: { fileName },
    severity: AUDIT_SEVERITY.LOW,
    ...getRequestMetadata(req),
  });
}

