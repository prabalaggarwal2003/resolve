import Organization from '../models/Organization.js';
import Contact from '../models/Contact.js';
import IssueOrgConfig from '../models/IssueOrgConfig.js';
import { ensureIssueOrgConfig } from './issueOrgConfigService.js';

/**
 * Build a short uppercase alphanumeric slug from free text.
 */
export function slugPart(value, maxLen = 6) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, maxLen);
  return cleaned || '';
}

/**
 * Prefix for auto employee IDs: {ORG}-{DEPT|TEAM|EMP}
 * e.g. ACME-ENG, RESOLVE-EMP
 */
export function buildEmployeeIdPrefix(orgName, { department = '', team = '' } = {}) {
  const org =
    slugPart(orgName, 8) ||
    slugPart(
      String(orgName || '')
        .split(/\s+/)
        .map((w) => w[0])
        .join(''),
      6
    ) ||
    'ORG';
  const mid = slugPart(department, 6) || slugPart(team, 6) || 'EMP';
  return `${org}-${mid}`;
}

function padSeq(n) {
  return String(Math.max(1, Number(n) || 1)).padStart(4, '0');
}

/**
 * Highest trailing numeric sequence among existing employee IDs for the org.
 */
async function maxExistingEmployeeSeq(organizationId) {
  const rows = await Contact.find({
    organizationId,
    kind: 'employee',
    employeeId: { $exists: true, $nin: [null, ''] },
  })
    .select('employeeId')
    .lean();

  let max = 0;
  for (const row of rows) {
    const id = String(row.employeeId || '');
    const m = id.match(/(\d+)\s*$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

/**
 * Ensure stored counter is at least one past the highest existing employee ID number.
 */
async function syncEmployeeIdSeqFloor(organizationId) {
  await ensureIssueOrgConfig(organizationId);
  const fromExisting = (await maxExistingEmployeeSeq(organizationId)) + 1;
  await IssueOrgConfig.updateOne(
    {
      organizationId,
      $or: [
        { 'settings.employeeIdAutoSeq': { $exists: false } },
        { 'settings.employeeIdAutoSeq': null },
        { 'settings.employeeIdAutoSeq': { $lt: fromExisting } },
      ],
    },
    { $set: { 'settings.employeeIdAutoSeq': fromExisting } }
  );
}

/**
 * Next sequence number for the org (does not increment).
 */
export async function peekNextEmployeeIdSeq(organizationId) {
  await syncEmployeeIdSeqFloor(organizationId);
  const config = await IssueOrgConfig.findOne({ organizationId }).select('settings').lean();
  return Math.max(1, Number(config?.settings?.employeeIdAutoSeq) || 1);
}

/**
 * Atomically reserve `count` sequence numbers and return the starting number.
 * Persists settings.employeeIdAutoSeq so later imports continue (never restart at 1).
 */
export async function reserveEmployeeIdSeq(organizationId, count = 1) {
  const n = Math.max(1, Number(count) || 1);
  await syncEmployeeIdSeqFloor(organizationId);

  const updated = await IssueOrgConfig.findOneAndUpdate(
    { organizationId },
    { $inc: { 'settings.employeeIdAutoSeq': n } },
    { new: false }
  ).select('settings');

  const start = Math.max(1, Number(updated?.settings?.employeeIdAutoSeq) || 1);
  return start;
}

/**
 * Resolve org display name for prefixing.
 */
export async function getOrgNameForEmployeeIds(organizationId) {
  const org = await Organization.findById(organizationId).select('name orgId').lean();
  return org?.name || org?.orgId || 'ORG';
}

/**
 * Build one employee ID: {ORG}-{DEPT|TEAM|EMP}-{NNNN}
 */
export function formatEmployeeId(orgName, extras, seq) {
  return `${buildEmployeeIdPrefix(orgName, extras)}-${padSeq(seq)}`;
}

/**
 * Allocate sequential employee IDs for a list of row contexts.
 * contexts: [{ department, team }, ...]
 * Returns array of generated IDs in the same order.
 */
export async function allocateEmployeeIds(organizationId, contexts = []) {
  if (!contexts.length) return [];
  const orgName = await getOrgNameForEmployeeIds(organizationId);
  const start = await reserveEmployeeIdSeq(organizationId, contexts.length);
  return contexts.map((ctx, i) =>
    formatEmployeeId(orgName, { department: ctx?.department, team: ctx?.team }, start + i)
  );
}
