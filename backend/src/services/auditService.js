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

  // Authentication
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout'
};

export const AUDIT_RESOURCES = {
  ASSET: 'asset',
  ISSUE: 'issue',
  USER: 'user',
  ORGANIZATION: 'organization',
  LOCATION: 'location',
  DEPARTMENT: 'department',
  AUTH: 'authentication'
};

export const AUDIT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

