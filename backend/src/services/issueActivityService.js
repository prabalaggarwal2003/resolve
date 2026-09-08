import IssueActivity from '../models/IssueActivity.js';

/**
 * Append an immutable activity entry for a ticket.
 */
export async function recordIssueActivity({
  issueId,
  organizationId,
  type,
  actorUserId = null,
  actorName = '',
  actorKind = 'user',
  from = '',
  to = '',
  reason = '',
  meta = {},
  at = new Date(),
}) {
  return IssueActivity.create({
    issueId,
    organizationId,
    type,
    actorUserId,
    actorName,
    actorKind,
    from,
    to,
    reason,
    meta,
    at,
  });
}

export async function listIssueActivities(issueId, { limit = 200 } = {}) {
  return IssueActivity.find({ issueId })
    .sort({ at: -1 })
    .limit(limit)
    .populate('actorUserId', 'name email')
    .lean();
}
