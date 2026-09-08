import {
  Issue,
  IssueAutomationRule,
  Asset,
  Notification,
} from '../models/index.js';
import { assignTicket } from './issueAssignmentService.js';
import { OPEN_STATUS_IDS } from '../constants/issueDefaults.js';

const DEFAULT_SLA_HOURS = {
  critical: 4,
  high: 8,
  medium: 24,
  low: 72,
};

function idStr(v) {
  if (!v) return '';
  if (typeof v === 'object' && v._id) return String(v._id);
  return String(v);
}

function listHas(list, value) {
  if (!Array.isArray(list) || list.length === 0) return true; // empty = any
  if (!value) return false;
  const v = String(value);
  return list.some((x) => String(x) === v);
}

/**
 * Does rule.match apply to this ticket + asset context?
 */
export function ruleMatchesContext(match, ctx) {
  const m = match || {};
  if (!listHas(m.assetCategories, ctx.assetCategory)) return false;
  if (!listHas(m.issueTypeIds, ctx.issueTypeId)) return false;
  if (!listHas(m.priorityIds, ctx.priorityId)) return false;
  if (!listHas(m.locationIds, ctx.locationId)) return false;
  if (!listHas(m.departmentIds, ctx.departmentId)) return false;
  return true;
}

export function buildTicketContext(issue, asset) {
  return {
    assetCategory: asset?.category || '',
    issueTypeId: issue.issueTypeId || issue.category || '',
    priorityId: issue.priorityId || issue.priority || '',
    locationId: idStr(issue.locationId || asset?.locationId),
    departmentId: idStr(asset?.departmentId),
  };
}

export function computeSlaDueDates(priorityId, slaResolutionHours) {
  const hours =
    typeof slaResolutionHours === 'number' && slaResolutionHours > 0
      ? slaResolutionHours
      : DEFAULT_SLA_HOURS[priorityId] || DEFAULT_SLA_HOURS.medium;
  const now = Date.now();
  const resolutionDueAt = new Date(now + hours * 3600 * 1000);
  const responseDueAt = new Date(now + Math.min(hours, 4) * 3600 * 1000);
  return { responseDueAt, resolutionDueAt, hours };
}

/**
 * Apply first matching auto-assign rule after ticket create.
 * User on the rule is compulsory.
 */
export async function applyAutoAssignOnCreate(issueDoc, asset) {
  const orgId = issueDoc.organizationId;
  const rules = await IssueAutomationRule.find({
    organizationId: orgId,
    enabled: true,
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  if (!rules.length) {
    // Still set default SLA so escalation % works
    const sla = computeSlaDueDates(issueDoc.priorityId || issueDoc.priority);
    await Issue.updateOne(
      { _id: issueDoc._id },
      {
        $set: {
          'sla.responseDueAt': sla.responseDueAt,
          'sla.resolutionDueAt': sla.resolutionDueAt,
          dueAt: issueDoc.dueAt || sla.resolutionDueAt,
        },
      }
    );
    return { matched: false, issue: issueDoc };
  }

  let assetDoc = asset;
  if (!assetDoc && issueDoc.assetId) {
    assetDoc = await Asset.findById(issueDoc.assetId)
      .select('category locationId departmentId name assetId')
      .lean();
  }

  const ctx = buildTicketContext(issueDoc, assetDoc);
  const rule = rules.find((r) => ruleMatchesContext(r.match, ctx) && r.assign?.assigneeUserId);

  const slaHours = rule?.slaResolutionHours;
  const sla = computeSlaDueDates(issueDoc.priorityId || issueDoc.priority, slaHours);
  await Issue.updateOne(
    { _id: issueDoc._id },
    {
      $set: {
        'sla.responseDueAt': sla.responseDueAt,
        'sla.resolutionDueAt': sla.resolutionDueAt,
        dueAt: issueDoc.dueAt || sla.resolutionDueAt,
      },
    }
  );

  if (!rule) return { matched: false, issue: issueDoc };

  const fresh = await Issue.findById(issueDoc._id).lean();
  const updated = await assignTicket({
    issue: fresh,
    user: null,
    actorKind: 'system',
    actorName: 'Auto-assignment',
    activityType: 'auto_assigned',
    assigneeUserId: rule.assign.assigneeUserId,
    assigneeGroupId: rule.assign.assigneeGroupId || undefined,
    assigneeDepartmentId: rule.assign.assigneeDepartmentId || undefined,
    reason: `Matched rule: ${rule.name}`,
    activityMeta: { automationRuleId: rule._id, ruleName: rule.name },
  });

  // Notify assigned user
  try {
    await Notification.create({
      userId: rule.assign.assigneeUserId,
      type: 'issue_assigned',
      title: 'Ticket auto-assigned to you',
      body: `${fresh.ticketId} — ${fresh.title || 'New ticket'}`,
      link: `/dashboard/issues/${fresh._id}`,
      metadata: { issueId: fresh._id, ruleId: rule._id },
    });
  } catch {
    /* best-effort */
  }

  return { matched: true, rule, issue: updated };
}

export async function listAutomationRules(organizationId) {
  return IssueAutomationRule.find({ organizationId })
    .populate('assign.assigneeUserId', 'name email')
    .populate('assign.assigneeGroupId', 'name')
    .populate('assign.assigneeDepartmentId', 'name')
    .populate('match.locationIds', 'name path')
    .populate('match.departmentIds', 'name')
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
}

export function validateAutomationRulePayload(body) {
  if (!body?.name?.trim()) return { ok: false, message: 'Rule name is required' };
  if (!body?.assign?.assigneeUserId) {
    return { ok: false, message: 'Assigned user is required' };
  }
  return {
    ok: true,
    data: {
      name: String(body.name).trim(),
      enabled: body.enabled !== false,
      sortOrder: Number(body.sortOrder) || 0,
      match: {
        assetCategories: Array.isArray(body.match?.assetCategories)
          ? body.match.assetCategories.map(String).filter(Boolean)
          : [],
        issueTypeIds: Array.isArray(body.match?.issueTypeIds)
          ? body.match.issueTypeIds.map(String).filter(Boolean)
          : [],
        priorityIds: Array.isArray(body.match?.priorityIds)
          ? body.match.priorityIds.map(String).filter(Boolean)
          : [],
        locationIds: Array.isArray(body.match?.locationIds)
          ? body.match.locationIds.filter(Boolean)
          : [],
        departmentIds: Array.isArray(body.match?.departmentIds)
          ? body.match.departmentIds.filter(Boolean)
          : [],
      },
      assign: {
        assigneeUserId: body.assign.assigneeUserId,
        assigneeGroupId: body.assign.assigneeGroupId || null,
        assigneeDepartmentId: body.assign.assigneeDepartmentId || null,
      },
      slaResolutionHours:
        body.slaResolutionHours != null && body.slaResolutionHours !== ''
          ? Number(body.slaResolutionHours)
          : undefined,
    },
  };
}

export { OPEN_STATUS_IDS, DEFAULT_SLA_HOURS };
