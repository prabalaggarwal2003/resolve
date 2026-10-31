import IssueWorkflow from '../models/IssueWorkflow.js';
import Issue from '../models/Issue.js';
import { DEFAULT_WORKFLOW, LEGACY_STATUS_MAP, CLOSED_STATUS_IDS } from '../constants/issueDefaults.js';
import { ensureIssueOrgConfig, getIssueOrgConfig } from './issueOrgConfigService.js';
import { recordIssueActivity } from './issueActivityService.js';
import { ticketActionForTransition } from '../constants/ticketPermissions.js';
import { canPerformTicketAction } from './permissions.js';
import { settleEscalationOnClose } from './issueEscalationService.js';

function getNested(obj, path) {
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function idOf(v) {
  if (!v) return '';
  if (typeof v === 'object' && v._id) return String(v._id);
  return String(v);
}

export async function ensureDefaultWorkflow(organizationId, userId = null) {
  let workflow = await IssueWorkflow.findOne({ organizationId, key: DEFAULT_WORKFLOW.key });
  if (!workflow) {
    workflow = await IssueWorkflow.create({
      organizationId,
      key: DEFAULT_WORKFLOW.key,
      name: DEFAULT_WORKFLOW.name,
      description: DEFAULT_WORKFLOW.description,
      isDefault: true,
      stages: DEFAULT_WORKFLOW.stages,
      transitions: DEFAULT_WORKFLOW.transitions,
      updatedBy: userId,
    });
  }
  return workflow;
}

/**
 * Ensure custom org statuses are reachable in the default workflow and listed as stages.
 * Built-in statuses keep their existing transitions; new custom ones get enter/leave edges.
 */
export async function syncWorkflowWithStatuses(organizationId, statuses = [], userId = null) {
  const workflow = await ensureDefaultWorkflow(organizationId, userId);
  const statusIds = (statuses || []).map((s) => s.id).filter(Boolean);
  if (!statusIds.length) return workflow;

  const builtin = new Set(DEFAULT_WORKFLOW.stages || []);
  const closed = new Set((statuses || []).filter((s) => s.isClosed).map((s) => s.id));

  workflow.stages = statusIds;

  const existing = new Set(
    (workflow.transitions || []).map((t) => {
      const plain = t?.toObject ? t.toObject() : t;
      return `${plain.from}->${plain.to}`;
    })
  );

  const openHubs = ['new', 'triaged', 'assigned', 'in_progress', 'waiting'].filter((id) =>
    statusIds.includes(id)
  );
  const leaveTargets = [
    { to: 'in_progress', requireReason: false },
    { to: 'waiting', requireReason: true },
    { to: 'resolved', requireReason: true, requiredFields: ['resolution.notes'] },
    { to: 'cancelled', requireReason: true },
  ].filter((t) => statusIds.includes(t.to));

  const additions = [];
  for (const sid of statusIds) {
    if (builtin.has(sid) || closed.has(sid)) continue;

    for (const from of openHubs) {
      if (from === sid) continue;
      const key = `${from}->${sid}`;
      if (existing.has(key)) continue;
      additions.push({ from, to: sid, requireReason: false, requiredFields: [] });
      existing.add(key);
    }

    for (const leave of leaveTargets) {
      if (leave.to === sid) continue;
      const key = `${sid}->${leave.to}`;
      if (existing.has(key)) continue;
      additions.push({
        from: sid,
        to: leave.to,
        requireReason: Boolean(leave.requireReason),
        requiredFields: leave.requiredFields || [],
      });
      existing.add(key);
    }
  }

  if (additions.length) {
    workflow.transitions = [...(workflow.transitions || []), ...additions];
  }
  if (userId) workflow.updatedBy = userId;
  await workflow.save();
  return workflow;
}

export async function getDefaultWorkflow(organizationId) {
  await ensureIssueOrgConfig(organizationId);
  return ensureDefaultWorkflow(organizationId);
}

export async function listWorkflows(organizationId) {
  await ensureDefaultWorkflow(organizationId);
  return IssueWorkflow.find({ organizationId }).sort({ isDefault: -1, name: 1 }).lean();
}

export function normalizeStatusId(status) {
  if (!status) return 'new';
  if (LEGACY_STATUS_MAP[status]) return LEGACY_STATUS_MAP[status];
  return status;
}

export function getAllowedTransitions(workflow, fromStatus) {
  const from = normalizeStatusId(fromStatus);
  return (workflow.transitions || [])
    .map((t) => {
      const plain = t?.toObject ? t.toObject() : t;
      return {
        from: plain?.from,
        to: plain?.to,
        requireReason: Boolean(plain?.requireReason),
        requiredFields: Array.isArray(plain?.requiredFields) ? [...plain.requiredFields] : [],
        requireAttachment: Boolean(plain?.requireAttachment),
        requireApproval: Boolean(plain?.requireApproval),
        allowedRoles: Array.isArray(plain?.allowedRoles) ? [...plain.allowedRoles] : [],
      };
    })
    .filter((t) => t.from === from && t.to);
}

/**
 * Apply org verification settings to the transition list.
 * - requireVerificationBeforeClose ON: resolved → verified (not closed)
 * - OFF: resolved → closed (skip verified)
 */
export function applyVerificationSettings(edges, fromStatus, settings = {}) {
  const from = normalizeStatusId(fromStatus);
  const requireVerify = settings.requireVerificationBeforeClose !== false;
  let list = (edges || [])
    .map((e) => ({
      from: e?.from,
      to: e?.to,
      requireReason: Boolean(e?.requireReason),
      requiredFields: Array.isArray(e?.requiredFields) ? [...e.requiredFields] : [],
      requireAttachment: Boolean(e?.requireAttachment),
      requireApproval: Boolean(e?.requireApproval),
      allowedRoles: Array.isArray(e?.allowedRoles) ? [...e.allowedRoles] : [],
    }))
    .filter((e) => e.from && e.to);

  if (from === 'resolved') {
    if (requireVerify) {
      list = list.filter((e) => e.to !== 'closed');
      if (!list.some((e) => e.to === 'verified')) {
        list.push({
          from: 'resolved',
          to: 'verified',
          requireReason: false,
          requiredFields: ['verification.notes'],
          requireAttachment: false,
          requireApproval: false,
          allowedRoles: [],
        });
      }
    } else {
      list = list.filter((e) => e.to !== 'verified');
      if (!list.some((e) => e.to === 'closed')) {
        list.push({
          from: 'resolved',
          to: 'closed',
          requireReason: false,
          requiredFields: [],
          requireAttachment: false,
          requireApproval: false,
          allowedRoles: [],
        });
      }
    }
  }

  return list;
}

export function filterTransitionsByPermission(edges, user, req = null) {
  return (edges || []).filter((edge) => {
    const action = ticketActionForTransition(edge.from, edge.to);
    return canPerformTicketAction(user, action, req);
  });
}

export async function getEffectiveTransitions(organizationId, fromStatus, user = null, req = null) {
  const [workflow, config] = await Promise.all([
    getDefaultWorkflow(organizationId),
    getIssueOrgConfig(organizationId),
  ]);
  const settings = config?.settings || {};
  let edges = getAllowedTransitions(workflow, fromStatus);
  edges = applyVerificationSettings(edges, fromStatus, settings);
  if (user) edges = filterTransitionsByPermission(edges, user, req);
  return { workflow, settings, edges };
}

/**
 * Validate and apply a workflow status transition. Appends immutable activity.
 */
export async function transitionTicket({
  issue,
  toStatus,
  user,
  reason = '',
  fields = {},
  attachment = null,
  req = null,
}) {
  const organizationId = issue.organizationId;
  const workflow =
    (issue.workflowId && (await IssueWorkflow.findById(issue.workflowId))) ||
    (await getDefaultWorkflow(organizationId));

  if (!workflow) {
    const err = new Error('No workflow configured for this organization');
    err.status = 400;
    throw err;
  }

  const config = await getIssueOrgConfig(organizationId);
  const settings = config?.settings || {};

  const fromStatus = normalizeStatusId(issue.statusId || issue.status);
  const to = normalizeStatusId(toStatus);

  if (fromStatus === to) {
    const err = new Error('Ticket is already in that status');
    err.status = 400;
    throw err;
  }

  // Assigned status requires a handler (org user)
  if (to === 'assigned') {
    const handlerId = idOf(issue.assigneeUserId) || idOf(issue.assignedTo);
    if (!handlerId) {
      const err = new Error(
        'Cannot set status to Assigned until a handler is assigned to this ticket'
      );
      err.status = 400;
      throw err;
    }
  }

  let edges = getAllowedTransitions(workflow, fromStatus);
  edges = applyVerificationSettings(edges, fromStatus, settings);
  const edge = edges.find((t) => t.from === fromStatus && t.to === to);
  if (!edge) {
    const err = new Error(`Transition from "${fromStatus}" to "${to}" is not allowed`);
    err.status = 400;
    throw err;
  }

  // Permission-based gate (no hardcoded Manager/Technician roles)
  const requiredAction = ticketActionForTransition(fromStatus, to);
  if (!canPerformTicketAction(user, requiredAction, req)) {
    const err = new Error(
      `You do not have permission to ${requiredAction.replace(/_/g, ' ')} on tickets`
    );
    err.status = 403;
    throw err;
  }

  // Optional extra restriction from workflow edge (permission/role keys if configured)
  if (edge.allowedRoles?.length) {
    const roleOk =
      edge.allowedRoles.includes(user.role) ||
      user.role === 'super_admin' ||
      canPerformTicketAction(user, requiredAction, req);
    // Prefer ticket permissions: only enforce allowedRoles if user lacks the ticket action
    // (kept for backward compatibility with edges that list permission keys)
    if (!roleOk && !edge.allowedRoles.includes(requiredAction)) {
      const err = new Error('Your permissions cannot perform this transition');
      err.status = 403;
      throw err;
    }
  }

  if (edge.requireReason && !String(reason || '').trim()) {
    const err = new Error('A reason is required for this transition');
    err.status = 400;
    throw err;
  }

  const mergedFields = {
    resolution: { ...(issue.resolution || {}), ...(fields?.resolution || {}) },
    verification: { ...(issue.verification || {}), ...(fields?.verification || {}) },
    ...fields,
  };

  for (const fieldPath of edge.requiredFields || []) {
    const value = getNested(mergedFields, fieldPath);
    if (value == null || (typeof value === 'string' && !value.trim())) {
      const err = new Error(`Field "${fieldPath}" is required for this transition`);
      err.status = 400;
      throw err;
    }
  }

  if (to === 'verified' && settings.preventSelfVerification !== false) {
    const resolvedBy = issue.resolution?.resolvedBy || issue.resolvedBy;
    if (resolvedBy && idOf(resolvedBy) === idOf(user._id)) {
      const err = new Error(
        'You cannot verify a ticket you resolved. Self-verification is disabled for this organization.'
      );
      err.status = 403;
      throw err;
    }
  }

  if (edge.requireAttachment) {
    const hasAttachment =
      attachment?.url ||
      (issue.attachments && issue.attachments.length > 0) ||
      (issue.photos && issue.photos.length > 0);
    if (!hasAttachment) {
      const err = new Error('An attachment is required for this transition');
      err.status = 400;
      throw err;
    }
  }

  if (edge.requireApproval && !fields?.approvalGranted) {
    const err = new Error('Approval is required for this transition');
    err.status = 400;
    throw err;
  }

  const doc = await Issue.findById(issue._id);
  if (!doc) {
    const err = new Error('Issue not found');
    err.status = 404;
    throw err;
  }

  doc.status = to;
  doc.statusId = to;
  doc.workflowId = workflow._id;
  doc.workflowKey = workflow.key;

  if (to === 'resolved' || (edge.requiredFields || []).some((f) => f.startsWith('resolution'))) {
    const notes = mergedFields.resolution?.notes || reason;
    doc.resolution = {
      notes,
      resolvedAt: new Date(),
      resolvedBy: user._id,
    };
    doc.resolvedAt = doc.resolution.resolvedAt;
    doc.resolvedBy = user._id;
    doc.resolutionNotes = notes;
  }

  if (to === 'verified' || (edge.requiredFields || []).some((f) => f.startsWith('verification'))) {
    doc.verification = {
      notes: mergedFields.verification?.notes || reason || '',
      verifiedAt: new Date(),
      verifiedBy: user._id,
    };
  }

  if (attachment?.url) {
    doc.attachments = doc.attachments || [];
    doc.attachments.push({
      url: attachment.url,
      name: attachment.name || '',
      uploadedAt: new Date(),
      uploadedBy: user._id,
    });
  }

  await doc.save();

  let activityType = 'status_changed';
  if (to === 'closed') activityType = 'closed';
  else if (
    ['closed', 'cancelled', 'resolved', 'verified'].includes(fromStatus) &&
    ['in_progress', 'new', 'assigned', 'triaged'].includes(to)
  ) {
    activityType = 'reopened';
  } else if (to === 'resolved') activityType = 'resolution';
  else if (to === 'verified') activityType = 'verification';

  await recordIssueActivity({
    issueId: doc._id,
    organizationId,
    type: activityType,
    actorUserId: user._id,
    actorName: user.name || '',
    actorKind: 'user',
    from: fromStatus,
    to,
    reason: String(reason || '').trim(),
    meta: {
      workflowKey: workflow.key,
      action: requiredAction,
      requireVerificationBeforeClose: settings.requireVerificationBeforeClose !== false,
    },
  });

  // Clear active escalation badge → "was escalated" when work settles
  if (CLOSED_STATUS_IDS.includes(to)) {
    try {
      await settleEscalationOnClose(doc.toObject ? doc.toObject() : doc, { user });
    } catch (err) {
      console.error('settleEscalationOnClose failed:', err.message);
    }
  }

  return Issue.findById(doc._id)
    .populate({
      path: 'assetId',
      select: 'name assetId category locationId assignedTo departmentId status',
      populate: { path: 'assignedTo', select: 'name email' },
    })
    .populate('assignedTo', 'name email role')
    .populate('assigneeUserId', 'name email role')
    .populate('resolution.resolvedBy', 'name email')
    .populate('verification.verifiedBy', 'name email')
    .populate('resolvedBy', 'name email')
    .populate('locationId', 'name path')
    .lean();
}
