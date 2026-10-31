import { Issue } from '../models/index.js';
import { ensureIssueOrgConfig } from './issueOrgConfigService.js';

/**
 * Generate next ticket ID: {PREFIX}-{YYYY}-{NNN} (e.g. TKT-2026-001).
 * Org-configurable prefix via IssueOrgConfig.settings.ticketPrefix.
 * Historical ISS-* IDs are left untouched.
 */
export async function generateTicketId(organizationId) {
  let prefixBase = 'TKT';
  if (organizationId) {
    try {
      const config = await ensureIssueOrgConfig(organizationId);
      prefixBase = String(config.settings?.ticketPrefix || 'TKT')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12) || 'TKT';
    } catch {
      prefixBase = 'TKT';
    }
  }

  const year = new Date().getFullYear();
  const prefix = `${prefixBase}-${year}-`;
  const last = await Issue.findOne({ ticketId: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    .sort({ ticketId: -1 })
    .select('ticketId')
    .lean();

  let next = 1;
  if (last?.ticketId) {
    const num = parseInt(last.ticketId.slice(prefix.length), 10);
    if (!Number.isNaN(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(3, '0')}`;
}
