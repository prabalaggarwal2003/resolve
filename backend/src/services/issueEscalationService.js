import {
  Issue,
  IssueEscalationRule,
  Asset,
  Notification,
  User,
  ContactGroup,
} from '../models/index.js';
import { assignTicket } from './issueAssignmentService.js';
import { recordIssueActivity } from './issueActivityService.js';
import { ruleMatchesContext, buildTicketContext } from './issueAutomationService.js';
import { OPEN_STATUS_IDS, CLOSED_STATUS_IDS } from '../constants/issueDefaults.js';

function idStr(v) {
  if (!v) return '';
  if (typeof v === 'object' && v._id) return String(v._id);
  return String(v);
}

const TRIGGER_KINDS = ['sla_pct', 'sla_breached', 'unresolved_hours'];

/** Prefer triggers[]; fall back to legacy single trigger. */
export function normalizeTriggers(rule) {
  if (Array.isArray(rule?.triggers) && rule.triggers.length) {
    return rule.triggers.filter((t) => t && TRIGGER_KINDS.includes(t.kind));
  }
  if (rule?.trigger?.kind && TRIGGER_KINDS.includes(rule.trigger.kind)) {
    return [rule.trigger];
  }
  return [];
}

export function describeTrigger(t) {
  if (!t?.kind) return 'Unknown trigger';
  if (t.kind === 'sla_pct') return `Resolution SLA reached ${t.slaPct || 80}%`;
  if (t.kind === 'sla_breached') return 'Resolution SLA breached';
  if (t.kind === 'unresolved_hours') return `Unresolved for ${t.unresolvedHours} hours`;
  return t.kind;
}

function triggerReason(rule, issue, now = Date.now()) {
  const triggers = normalizeTriggers(rule);
  if (!triggers.length) return rule.name || 'Escalation triggered';
  const matched = triggers.filter((t) => evalOneTrigger(t, issue, now));
  const parts = (matched.length ? matched : triggers).map(describeTrigger);
  if (parts.length === 1) return parts[0];
  const joiner = rule.triggerLogic === 'and' ? ' AND ' : ' OR ';
  return parts.join(joiner);
}

function slaProgress(issue, now = Date.now()) {
  const due = issue.sla?.resolutionDueAt || issue.dueAt;
  if (!due) return null;
  const created = new Date(issue.createdAt).getTime();
  const dueMs = new Date(due).getTime();
  if (!created || !dueMs || dueMs <= created) return null;
  const elapsed = now - created;
  const window = dueMs - created;
  const pct = (elapsed / window) * 100;
  const breached = now >= dueMs || Boolean(issue.sla?.breached);
  return { pct, breached, dueMs };
}

function evalOneTrigger(t, issue, now = Date.now()) {
  const kind = t?.kind;
  const progress = slaProgress(issue, now);

  if (kind === 'sla_pct') {
    if (!progress) return false;
    const threshold = Number(t.slaPct) || 80;
    return progress.pct >= threshold && !progress.breached;
  }
  if (kind === 'sla_breached') {
    if (progress) return progress.breached;
    const due = issue.sla?.resolutionDueAt || issue.dueAt;
    return due ? now >= new Date(due).getTime() : false;
  }
  if (kind === 'unresolved_hours') {
    const hours = Number(t.unresolvedHours) || 0;
    if (hours <= 0) return false;
    const ageMs = now - new Date(issue.createdAt).getTime();
    return ageMs >= hours * 3600 * 1000;
  }
  return false;
}

function shouldFireTrigger(rule, issue, now = Date.now()) {
  const triggers = normalizeTriggers(rule);
  if (!triggers.length) return false;
  const results = triggers.map((t) => evalOneTrigger(t, issue, now));
  if (rule.triggerLogic === 'and') return results.every(Boolean);
  return results.some(Boolean);
}

function ruleIncludesBreach(rule) {
  return normalizeTriggers(rule).some((t) => t.kind === 'sla_breached');
}

function inCooldown(issue, rule, now = Date.now()) {
  const hist = issue.escalation?.history || [];
  const last = [...hist].reverse().find((h) => idStr(h.ruleId) === idStr(rule._id));
  if (!last?.at) {
    // also check lastRuleId
    if (idStr(issue.escalation?.lastRuleId) === idStr(rule._id) && issue.escalation?.lastFiredAt) {
      const cool = (Number(rule.cooldownMinutes) || 60) * 60 * 1000;
      return now - new Date(issue.escalation.lastFiredAt).getTime() < cool;
    }
    return false;
  }
  const cool = (Number(rule.cooldownMinutes) || 60) * 60 * 1000;
  return now - new Date(last.at).getTime() < cool;
}

async function collectNotifyUserIds(rule, issue) {
  const ids = new Set();
  if (rule.actions?.notifyAssignee) {
    const uid = issue.assigneeUserId || issue.assignedTo;
    if (uid) ids.add(idStr(uid));
  }
  for (const u of rule.actions?.notifyUserIds || []) {
    ids.add(idStr(u));
  }
  if (rule.actions?.notifyGroupId) {
    // Groups are contact groups — notify org users is preferred; skip contacts
    // Optionally notify nothing from group of contacts
  }
  if (rule.actions?.reassign?.assigneeUserId) {
    ids.add(idStr(rule.actions.reassign.assigneeUserId));
  }
  return [...ids].filter(Boolean);
}

async function buildTargetLabel(rule) {
  const parts = [];
  const re = rule.actions?.reassign;
  if (re?.assigneeUserId) {
    const u = await User.findById(re.assigneeUserId).select('name').lean();
    if (u?.name) parts.push(u.name);
  }
  if (re?.assigneeGroupId) {
    const g = await ContactGroup.findById(re.assigneeGroupId).select('name').lean();
    if (g?.name) parts.push(`Team: ${g.name}`);
  }
  if (re?.assigneeDepartmentId) {
    const { Department } = await import('../models/index.js');
    const d = await Department.findById(re.assigneeDepartmentId).select('name').lean();
    if (d?.name) parts.push(`Dept: ${d.name}`);
  }
  if (!parts.length && (rule.actions?.notifyUserIds || []).length) {
    parts.push('Configured recipients');
  }
  if (!parts.length && rule.actions?.notifyAssignee) {
    parts.push('Assigned handler');
  }
  return parts.join(' · ') || 'Configured recipients';
}

/**
 * Apply one escalation rule to a ticket.
 */
export async function applyEscalationRule(issue, rule) {
  const reason = triggerReason(rule, issue);
  const targetLabel = await buildTargetLabel(rule);
  const nextLevel = (issue.escalation?.level || 0) + 1;
  const isBreach = ruleIncludesBreach(rule);
  const status = isBreach || rule.actions?.reassign?.assigneeUserId ? 'escalated' : 'warned';

  const reUserId = rule.actions?.reassign?.assigneeUserId || null;
  const update = {
    'escalation.level': nextLevel,
    'escalation.status': status,
    'escalation.lastRuleId': rule._id,
    'escalation.lastFiredAt': new Date(),
    'escalation.lastReason': reason,
    'escalation.lastTargetLabel': targetLabel,
    'escalation.lastTargetUserId': reUserId || null,
  };

  if (isBreach) {
    update['sla.breached'] = true;
  }

  if (rule.actions?.bumpPriorityId) {
    update.priorityId = rule.actions.bumpPriorityId;
    update.priority = rule.actions.bumpPriorityId;
  }

  await Issue.updateOne(
    { _id: issue._id },
    {
      $set: update,
      $addToSet: { 'escalation.firedRuleIds': rule._id },
      $push: {
        'escalation.history': {
          ruleId: rule._id,
          level: nextLevel,
          reason,
          targetLabel,
          targetUserId: reUserId || undefined,
          source: 'rule',
          at: new Date(),
        },
      },
    }
  );

  await recordIssueActivity({
    issueId: issue._id,
    organizationId: issue.organizationId,
    type: 'escalated',
    actorKind: 'system',
    actorName: 'Escalation',
    reason,
    to: targetLabel,
    meta: {
      escalationRuleId: rule._id,
      ruleName: rule.name,
      level: nextLevel,
      trigger: normalizeTriggers(rule)[0]?.kind,
      triggers: normalizeTriggers(rule).map((t) => t.kind),
      triggerLogic: rule.triggerLogic === 'and' ? 'and' : 'or',
      targetLabel,
    },
  });

  if (rule.actions?.bumpPriorityId && rule.actions.bumpPriorityId !== (issue.priorityId || issue.priority)) {
    await recordIssueActivity({
      issueId: issue._id,
      organizationId: issue.organizationId,
      type: 'priority_changed',
      actorKind: 'system',
      actorName: 'Escalation',
      from: issue.priorityId || issue.priority || '',
      to: rule.actions.bumpPriorityId,
      reason: `Escalation: ${rule.name}`,
      meta: { escalationRuleId: rule._id },
    });
  }

  const re = rule.actions?.reassign;
  if (re?.assigneeUserId) {
    const fresh = await Issue.findById(issue._id).lean();
    await assignTicket({
      issue: fresh,
      user: null,
      actorKind: 'system',
      actorName: 'Escalation',
      activityType: 'assigned',
      assigneeUserId: re.assigneeUserId,
      assigneeGroupId: re.assigneeGroupId || undefined,
      assigneeDepartmentId: re.assigneeDepartmentId || undefined,
      reason: `Escalated: ${reason}`,
      activityMeta: { escalationRuleId: rule._id, ruleName: rule.name },
    });
  }

  const notifyIds = await collectNotifyUserIds(rule, issue);
  if (notifyIds.length) {
    await Notification.insertMany(
      notifyIds.map((userId) => ({
        userId,
        type: 'issue_escalated',
        title: status === 'escalated' ? 'Ticket escalated' : 'Ticket SLA warning',
        body: `${issue.ticketId} — ${reason}`,
        link: `/dashboard/issues/${issue._id}`,
        metadata: { issueId: issue._id, ruleId: rule._id, level: nextLevel },
      }))
    );
  }

  return { level: nextLevel, reason, targetLabel, status };
}

function isActiveEscalation(esc) {
  if (!esc) return false;
  if (esc.status === 'escalated' || esc.status === 'warned') return true;
  return (esc.level || 0) > 0 && esc.status !== 'was_escalated' && esc.status !== 'none';
}

/**
 * When a ticket is resolved/closed/verified, clear the active escalation badge
 * and mark the ticket as "was escalated" if it had been escalated.
 */
export async function settleEscalationOnClose(issue, { user = null } = {}) {
  if (!issue?._id) return null;
  const esc = issue.escalation || {};
  if (!isActiveEscalation(esc)) return null;

  const level = esc.level || 0;
  const reason = `Escalation cleared after ticket settled (was level ${level})`;
  const targetLabel = esc.lastTargetLabel || '';

  await Issue.updateOne(
    { _id: issue._id },
    {
      $set: {
        'escalation.status': 'was_escalated',
        'escalation.lastReason': reason,
        'escalation.lastFiredAt': new Date(),
      },
      $push: {
        'escalation.history': {
          level,
          reason,
          targetLabel,
          source: 'settled',
          actorUserId: user?._id || undefined,
          actorName: user?.name || '',
          at: new Date(),
        },
      },
    }
  );

  await recordIssueActivity({
    issueId: issue._id,
    organizationId: issue.organizationId,
    type: 'escalated',
    actorUserId: user?._id,
    actorName: user?.name || 'System',
    actorKind: user?._id ? 'user' : 'system',
    reason,
    to: 'Was escalated',
    meta: {
      settled: true,
      previousStatus: esc.status,
      level,
      targetLabel,
    },
  });

  return { status: 'was_escalated', level };
}

/**
 * Staff-driven manual escalation: reason + assignee user required.
 */
export async function manualEscalateTicket({
  issue,
  user,
  reason,
  assigneeUserId,
  assigneeGroupId = null,
  assigneeDepartmentId = null,
  bumpPriorityId = '',
}) {
  const why = String(reason || '').trim();
  if (!why) {
    const err = new Error('Escalation reason is required');
    err.status = 400;
    throw err;
  }
  if (!assigneeUserId) {
    const err = new Error('Escalation user is required');
    err.status = 400;
    throw err;
  }

  const nextLevel = (issue.escalation?.level || 0) + 1;
  const targetLabel = await buildTargetLabel({
    actions: {
      reassign: { assigneeUserId, assigneeGroupId, assigneeDepartmentId },
    },
  });

  const update = {
    'escalation.level': nextLevel,
    'escalation.status': 'escalated',
    'escalation.lastRuleId': null,
    'escalation.lastFiredAt': new Date(),
    'escalation.lastReason': why,
    'escalation.lastTargetLabel': targetLabel,
    'escalation.lastTargetUserId': assigneeUserId || null,
  };

  if (bumpPriorityId) {
    update.priorityId = bumpPriorityId;
    update.priority = bumpPriorityId;
  }

  await Issue.updateOne(
    { _id: issue._id },
    {
      $set: update,
      $push: {
        'escalation.history': {
          level: nextLevel,
          reason: why,
          targetLabel,
          targetUserId: assigneeUserId || undefined,
          source: 'manual',
          actorUserId: user._id,
          actorName: user.name || '',
          at: new Date(),
        },
      },
    }
  );

  await recordIssueActivity({
    issueId: issue._id,
    organizationId: issue.organizationId,
    type: 'escalated',
    actorUserId: user._id,
    actorName: user.name || '',
    actorKind: 'user',
    reason: why,
    to: targetLabel,
    meta: {
      source: 'manual',
      level: nextLevel,
      targetLabel,
      bumpPriorityId: bumpPriorityId || undefined,
      assigneeUserId,
      assigneeGroupId: assigneeGroupId || undefined,
      assigneeDepartmentId: assigneeDepartmentId || undefined,
    },
  });

  if (bumpPriorityId && bumpPriorityId !== (issue.priorityId || issue.priority)) {
    await recordIssueActivity({
      issueId: issue._id,
      organizationId: issue.organizationId,
      type: 'priority_changed',
      actorUserId: user._id,
      actorName: user.name || '',
      actorKind: 'user',
      from: issue.priorityId || issue.priority || '',
      to: bumpPriorityId,
      reason: `Manual escalation: ${why}`,
      meta: { source: 'manual_escalation' },
    });
  }

  const fresh = await Issue.findById(issue._id).lean();
  await assignTicket({
    issue: fresh,
    user,
    actorKind: 'user',
    actorName: user.name || '',
    activityType: 'assigned',
    assigneeUserId,
    assigneeGroupId: assigneeGroupId || undefined,
    assigneeDepartmentId: assigneeDepartmentId || undefined,
    reason: `Manual escalation: ${why}`,
    activityMeta: { source: 'manual_escalation', level: nextLevel },
  });

  try {
    await Notification.create({
      userId: assigneeUserId,
      type: 'issue_escalated',
      title: 'Ticket escalated to you',
      body: `${fresh.ticketId || issue.ticketId} — ${why}`,
      link: `/dashboard/issues/${issue._id}`,
      metadata: { issueId: issue._id, level: nextLevel, source: 'manual' },
    });
  } catch {
    /* best-effort */
  }

  return Issue.findById(issue._id)
    .populate('assignedTo', 'name email role')
    .populate('assigneeUserId', 'name email role')
    .populate('assigneeGroupId', 'name description')
    .populate({
      path: 'assigneeDepartmentId',
      select: 'name locationId',
      populate: { path: 'locationId', select: 'name path type' },
    })
    .populate({
      path: 'assetId',
      select: 'name assetId category locationId assignedTo departmentId status',
      populate: { path: 'assignedTo', select: 'name email' },
    })
    .populate('resolution.resolvedBy', 'name email')
    .populate('verification.verifiedBy', 'name email')
    .populate('resolvedBy', 'name email')
    .populate('locationId', 'name path')
    .lean();
}

/**
 * Evaluate open tickets for an org (or all orgs).
 */
export async function evaluateEscalations({ organizationId = null, limit = 200 } = {}) {
  const openFilter = {
    $or: [{ statusId: { $in: OPEN_STATUS_IDS } }, { status: { $in: OPEN_STATUS_IDS } }],
  };
  if (organizationId) openFilter.organizationId = organizationId;

  const issues = await Issue.find(openFilter)
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();

  let fired = 0;
  const now = Date.now();

  // Cache rules per org
  const rulesByOrg = new Map();

  for (const issue of issues) {
    const orgId = idStr(issue.organizationId);
    if (!rulesByOrg.has(orgId)) {
      const rules = await IssueEscalationRule.find({
        organizationId: issue.organizationId,
        enabled: true,
      })
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean();
      rulesByOrg.set(orgId, rules);
    }
    const rules = rulesByOrg.get(orgId) || [];
    if (!rules.length) continue;

    let asset = null;
    if (issue.assetId) {
      asset = await Asset.findById(issue.assetId)
        .select('category locationId departmentId')
        .lean();
    }
    const ctx = buildTicketContext(issue, asset);

    for (const rule of rules) {
      if (!ruleMatchesContext(rule.match, ctx)) continue;
      if (!shouldFireTrigger(rule, issue, now)) continue;
      if (inCooldown(issue, rule, now)) continue;

      // Already fired this exact rule once without cooldown bypass for one-shot?
      // Cooldown handles repeats; allow re-fire after cooldown.

      await applyEscalationRule(issue, rule);
      fired += 1;
      // Refresh issue snapshot for subsequent rules in same tick
      const refreshed = await Issue.findById(issue._id).lean();
      Object.assign(issue, refreshed);
    }
  }

  return { checked: issues.length, fired };
}

export async function listEscalationRules(organizationId) {
  return IssueEscalationRule.find({ organizationId })
    .populate('actions.notifyUserIds', 'name email')
    .populate('actions.reassign.assigneeUserId', 'name email')
    .populate('actions.reassign.assigneeGroupId', 'name')
    .populate('actions.reassign.assigneeDepartmentId', 'name')
    .populate('match.locationIds', 'name path')
    .populate('match.departmentIds', 'name')
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
}

export function validateEscalationRulePayload(body) {
  if (!body?.name?.trim()) return { ok: false, message: 'Rule name is required' };

  let rawTriggers = [];
  if (Array.isArray(body.triggers) && body.triggers.length) {
    rawTriggers = body.triggers;
  } else if (body.trigger?.kind) {
    rawTriggers = [body.trigger];
  }
  if (!rawTriggers.length) {
    return { ok: false, message: 'At least one trigger is required' };
  }

  const triggers = [];
  for (let i = 0; i < rawTriggers.length; i += 1) {
    const t = rawTriggers[i];
    const kind = t?.kind;
    if (!TRIGGER_KINDS.includes(kind)) {
      return { ok: false, message: `Invalid trigger kind at position ${i + 1}` };
    }
    if (kind === 'sla_pct' && !(Number(t.slaPct) > 0)) {
      return { ok: false, message: `SLA percentage is required for trigger ${i + 1}` };
    }
    if (kind === 'unresolved_hours' && !(Number(t.unresolvedHours) > 0)) {
      return { ok: false, message: `Unresolved hours is required for trigger ${i + 1}` };
    }
    triggers.push({
      kind,
      slaPct: kind === 'sla_pct' ? Number(t.slaPct) : undefined,
      unresolvedHours: kind === 'unresolved_hours' ? Number(t.unresolvedHours) : undefined,
    });
  }

  const triggerLogic = body.triggerLogic === 'and' ? 'and' : 'or';

  const re = body.actions?.reassign;
  if (re && (re.assigneeGroupId || re.assigneeDepartmentId || re.assigneeUserId)) {
    if (!re.assigneeUserId) {
      return { ok: false, message: 'Reassign user is required when escalating to a person/team/dept' };
    }
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
        locationIds: Array.isArray(body.match?.locationIds) ? body.match.locationIds.filter(Boolean) : [],
        departmentIds: Array.isArray(body.match?.departmentIds)
          ? body.match.departmentIds.filter(Boolean)
          : [],
      },
      triggerLogic,
      triggers,
      // Keep primary trigger in sync for older readers
      trigger: triggers[0],
      actions: {
        notifyAssignee: body.actions?.notifyAssignee !== false,
        notifyUserIds: Array.isArray(body.actions?.notifyUserIds)
          ? body.actions.notifyUserIds.filter(Boolean)
          : [],
        notifyGroupId: body.actions?.notifyGroupId || null,
        bumpPriorityId: body.actions?.bumpPriorityId ? String(body.actions.bumpPriorityId) : '',
        reassign: {
          assigneeUserId: body.actions?.reassign?.assigneeUserId || null,
          assigneeGroupId: body.actions?.reassign?.assigneeGroupId || null,
          assigneeDepartmentId: body.actions?.reassign?.assigneeDepartmentId || null,
        },
      },
      cooldownMinutes: Math.max(5, Number(body.cooldownMinutes) || 60),
    },
  };
}
