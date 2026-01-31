import { AuditLog } from '../models/index.js';

export async function logAudit(userId, action, resource, resourceId, details = {}) {
  try {
    await AuditLog.create({ userId, action, resource, resourceId, details });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
