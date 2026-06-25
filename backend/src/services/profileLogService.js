import { formatChangesSummary } from './assetLogService.js';
import {
  logAudit,
  getRequestMetadata,
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  AUDIT_SEVERITY,
} from './auditService.js';

const FIELD_LABELS = {
  name: 'Name',
  phone: 'Phone',
  jobTitle: 'Job title',
  timeZone: 'Time zone',
};

function formatDisplayValue(value) {
  if (value == null || value === '') return '—';
  return String(value);
}

function valuesEqual(oldVal, newVal) {
  const oldNorm = oldVal == null || oldVal === '' ? '' : String(oldVal).trim();
  const newNorm = newVal == null || newVal === '' ? '' : String(newVal).trim();
  return oldNorm === newNorm;
}

export function buildProfileEditChanges(prev, patchBody) {
  const changes = [];

  for (const [key, newVal] of Object.entries(patchBody)) {
    const label = FIELD_LABELS[key];
    if (!label) continue;

    const oldVal = prev[key];
    if (valuesEqual(oldVal, newVal)) continue;

    changes.push({
      field: key,
      label,
      oldValue: formatDisplayValue(oldVal),
      newValue: formatDisplayValue(newVal),
    });
  }

  if (changes.length === 0) return null;

  return {
    fieldChanges: changes,
    summary: formatChangesSummary(changes),
  };
}

function profileAuditBase(user) {
  return {
    resourceName: user.name,
    resourceId: user._id,
  };
}

export async function logProfileUpdated(userId, req, user, pendingEditLog) {
  if (!pendingEditLog?.fieldChanges?.length) return;

  await logAudit(userId, AUDIT_ACTIONS.USER_UPDATED, AUDIT_RESOURCES.PROFILE, user._id, {
    ...profileAuditBase(user),
    description: pendingEditLog.summary,
    details: {
      fieldChanges: pendingEditLog.fieldChanges,
      summary: pendingEditLog.summary,
    },
    severity: AUDIT_SEVERITY.LOW,
    ...getRequestMetadata(req),
  });
}

export async function logPasswordChanged(userId, req, user) {
  const summary = 'Password changed';
  await logAudit(userId, AUDIT_ACTIONS.PASSWORD_CHANGED, AUDIT_RESOURCES.PROFILE, user._id, {
    ...profileAuditBase(user),
    description: summary,
    details: {
      fieldChanges: [{ field: 'password', label: 'Password', oldValue: '—', newValue: 'Changed' }],
      summary,
    },
    severity: AUDIT_SEVERITY.MEDIUM,
    ...getRequestMetadata(req),
  });
}

export async function logTwoFactorEnabled(userId, req, user) {
  const fieldChanges = [
    {
      field: 'twoFactorEnabled',
      label: 'Two-factor authentication',
      oldValue: 'Disabled',
      newValue: 'Enabled',
    },
  ];

  await logAudit(userId, AUDIT_ACTIONS.TWO_FACTOR_ENABLED, AUDIT_RESOURCES.PROFILE, user._id, {
    ...profileAuditBase(user),
    description: 'Two-factor authentication enabled',
    details: {
      fieldChanges,
      summary: formatChangesSummary(fieldChanges),
    },
    severity: AUDIT_SEVERITY.MEDIUM,
    ...getRequestMetadata(req),
  });
}

export async function logTwoFactorDisabled(userId, req, user) {
  const fieldChanges = [
    {
      field: 'twoFactorEnabled',
      label: 'Two-factor authentication',
      oldValue: 'Enabled',
      newValue: 'Disabled',
    },
  ];

  await logAudit(userId, AUDIT_ACTIONS.TWO_FACTOR_DISABLED, AUDIT_RESOURCES.PROFILE, user._id, {
    ...profileAuditBase(user),
    description: 'Two-factor authentication disabled',
    details: {
      fieldChanges,
      summary: formatChangesSummary(fieldChanges),
    },
    severity: AUDIT_SEVERITY.MEDIUM,
    ...getRequestMetadata(req),
  });
}

export async function logRecoveryCodesRegenerated(userId, req, user) {
  const fieldChanges = [
    {
      field: 'recoveryCodes',
      label: 'Recovery codes',
      oldValue: 'Previous set',
      newValue: 'Regenerated',
    },
  ];

  await logAudit(userId, AUDIT_ACTIONS.RECOVERY_CODES_REGENERATED, AUDIT_RESOURCES.PROFILE, user._id, {
    ...profileAuditBase(user),
    description: 'Recovery codes regenerated',
    details: {
      fieldChanges,
      summary: 'Recovery codes regenerated',
    },
    severity: AUDIT_SEVERITY.MEDIUM,
    ...getRequestMetadata(req),
  });
}
