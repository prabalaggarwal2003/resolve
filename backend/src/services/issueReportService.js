import crypto from 'crypto';
import { Issue } from '../models/index.js';

/**
 * Human report ID: RPT-YYYY-NNNN (org-scoped sequential).
 */
export async function generateReportId(organizationId) {
  const year = new Date().getFullYear();
  const prefix = `RPT-${year}-`;
  // Scan recent tickets for highest RPT id in reports (bounded)
  const issues = await Issue.find({
    organizationId,
    'reports.reportId': new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  })
    .select('reports.reportId')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  let next = 1;
  for (const issue of issues) {
    for (const r of issue.reports || []) {
      if (!r.reportId?.startsWith(prefix)) continue;
      const num = parseInt(r.reportId.slice(prefix.length), 10);
      if (!Number.isNaN(num) && num >= next) next = num + 1;
    }
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/** Unguessable public tracking token. */
export function generateTrackingToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Build a report subdocument for push onto an Issue.
 */
export async function buildReportEntry({
  organizationId,
  reporterName,
  reporterEmail,
  reporterPhone,
  description,
  photos,
  customFields,
}) {
  const [reportId, trackingToken] = await Promise.all([
    generateReportId(organizationId),
    Promise.resolve(generateTrackingToken()),
  ]);

  return {
    reportId,
    trackingToken,
    reporterName: String(reporterName || '').trim(),
    reporterEmail: String(reporterEmail || '').trim().toLowerCase(),
    reporterPhone: reporterPhone ? String(reporterPhone).trim() : undefined,
    description: String(description || '').trim(),
    photos: Array.isArray(photos) ? photos.filter((p) => p?.url).map((p) => ({ url: p.url })) : [],
    customFields: customFields && typeof customFields === 'object' ? customFields : {},
    status: 'new',
    acknowledgedAt: null,
    acknowledgedBy: null,
  };
}

export function publicReportProgress(ticketStatusId) {
  const status = String(ticketStatusId || 'new');
  const stages = [
    { id: 'reported', label: 'Reported' },
    { id: 'assigned', label: 'Assigned' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'closed', label: 'Closed' },
  ];

  let current = 'reported';
  if (['assigned', 'triaged'].includes(status)) current = 'assigned';
  else if (['in_progress', 'waiting'].includes(status)) current = 'in_progress';
  else if (status === 'resolved' || status === 'verified') current = 'resolved';
  else if (['closed', 'cancelled'].includes(status)) current = 'closed';
  else if (status === 'new' || status === 'open') current = 'reported';

  const awaitingVerification = status === 'resolved'; // resolved but not yet verified/closed
  const currentIndex = stages.findIndex((s) => s.id === current);

  return {
    stages,
    current,
    currentIndex,
    awaitingVerification,
    statusLabel:
      status === 'verified'
        ? 'Verified'
        : awaitingVerification
          ? 'Awaiting verification'
          : stages[currentIndex]?.label || status.replace(/_/g, ' '),
  };
}
