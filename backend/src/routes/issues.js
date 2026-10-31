import express from 'express';
import { Issue, Notification, User, Asset } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { requireTabRead, requireTabWrite, requireTicketAction } from '../middleware/tabPermissions.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import {
  canPerformTicketAction,
  getUserTicketActions,
  isOrgWideAdmin,
  isHod,
  isLabTechnician,
  canReportOnly,
  getDepartmentScopeId,
  resolveScopedAssetIds,
  assignIssueToUsers,
} from '../services/permissions.js';
import { generateTicketId } from '../services/ticketId.js';
import { getDeviceFingerprint, canReport, recordReportAttempt } from '../utils/rateLimiter.js';
import {
  getIssueOrgConfig,
  updateIssueOrgConfig,
  ensureIssueOrgConfig,
} from '../services/issueOrgConfigService.js';
import {
  getDefaultWorkflow,
  getEffectiveTransitions,
  transitionTicket,
  normalizeStatusId,
  listWorkflows,
  ensureDefaultWorkflow,
  syncWorkflowWithStatuses,
} from '../services/issueWorkflowService.js';
import { listIssueActivities, recordIssueActivity } from '../services/issueActivityService.js';
import { migrateOrganizationIssues } from '../services/issueMigrationService.js';
import { mapLegacyCategoryToTypeId } from '../constants/issueDefaults.js';
import { assignTicket } from '../services/issueAssignmentService.js';
import {
  listRelatedPersonOptions,
  addRelatedPerson,
  removeRelatedPerson,
  updateIssueTags,
} from '../services/issueRelatedPersonService.js';
import issueContactsRouter from './issueContacts.js';
import issueAutomationRouter from './issueAutomation.js';
import employeeImportRouter from './employeeImport.js';
import { applyAutoAssignOnCreate } from '../services/issueAutomationService.js';

const router = express.Router();

router.use(protect);
router.use('/employees/import', employeeImportRouter);
router.use(issueContactsRouter);
router.use(issueAutomationRouter);

function formatAssignedToList(assignedTo) {
  if (!assignedTo) return [];
  if (Array.isArray(assignedTo)) {
    return assignedTo.map((person) => ({
      name: person.name,
      email: person.email,
      role: person.role,
      displayText: `${person.name} (${person.role})`,
    }));
  }
  return [
    {
      name: assignedTo.name,
      email: assignedTo.email,
      role: assignedTo.role,
      displayText: `${assignedTo.name} (${assignedTo.role})`,
    },
  ];
}

function formatSlaRemaining(issue) {
  const due = issue.sla?.resolutionDueAt || issue.dueAt;
  if (!due) return '—';
  const ms = new Date(due).getTime() - Date.now();
  if (Number.isNaN(ms)) return '—';
  if (ms < 0) return issue.sla?.breached ? 'Breached' : 'Overdue';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatIssue(issue) {
  const user = issue.assigneeUserId || issue.assignedTo;
  const group = issue.assigneeGroupId;
  const dept = issue.assigneeDepartmentId;
  const personName = user?.name || '';
  const teamName = group?.name || '';
  const deptName = dept?.name || '';
  const parts = [];
  if (deptName) parts.push(`Dept: ${deptName}`);
  if (teamName) parts.push(`Team: ${teamName}`);
  if (personName) parts.push(personName);
  const reports = issue.reports || [];
  const newReportCount = reports.filter((r) => !r.status || r.status === 'new').length;
  const safeReports = reports.map((r) => {
    const { trackingToken, ...rest } = r;
    return rest;
  });
  return {
    ...issue,
    reports: safeReports,
    statusId: issue.statusId || issue.status,
    priorityId: issue.priorityId || issue.priority,
    assetLinkText: issue.assetId?.assetId || 'Unknown',
    assignedToList: formatAssignedToList(issue.assignedTo || issue.assigneeUserId),
    departmentLabel: deptName || 'Unassigned',
    teamLabel: teamName || 'Unassigned',
    personLabel: personName || 'Unassigned',
    assigneeLabel: parts.length ? parts.join(' · ') : 'Unassigned',
    categoryLabel: `Type: ${issue.issueTypeId || issue.category || 'Not specified'}`,
    reportCount: reports.length,
    newReportCount,
    slaLabel: formatSlaRemaining(issue),
  };
}

async function issueDetailPayload(organizationId, issue, user = null, req = null) {
  const activities = await listIssueActivities(issue._id);
  const config = await getIssueOrgConfig(organizationId);
  const { edges } = await getEffectiveTransitions(
    organizationId,
    issue.statusId || issue.status,
    user,
    req
  );
  return {
    ...formatIssue(issue),
    activities,
    allowedTransitions: edges,
    ticketActions: user ? getUserTicketActions(user, req) : undefined,
    config: {
      statuses: config.statuses,
      priorities: config.priorities,
      severities: config.severities,
      issueTypes: config.issueTypes,
      settings: config.settings,
    },
  };
}

async function assertIssueAccess(req, issue) {
  if (issue.organizationId?.toString() !== req.user.organizationId?.toString()) {
    return { ok: false, status: 403, message: 'You do not have access to this issue' };
  }
  if (isOrgWideAdmin(req.user)) return { ok: true };

  const userId = req.user._id?.toString?.();
  const isAssignee =
    issue.assignedTo?._id?.toString?.() === userId ||
    issue.assignedTo?.toString?.() === userId ||
    issue.assigneeUserId?._id?.toString?.() === userId ||
    issue.assigneeUserId?.toString?.() === userId;
  if (isAssignee) return { ok: true };

  const deptScope = getDepartmentScopeId(req.user);
  const issueDeptId =
    issue.assigneeDepartmentId?._id?.toString?.() ?? issue.assigneeDepartmentId?.toString?.();
  if (deptScope && issueDeptId && issueDeptId === deptScope?.toString?.()) {
    return { ok: true };
  }

  if (deptScope) {
    const assetDeptId =
      issue.assetId?.departmentId?._id?.toString?.() ?? issue.assetId?.departmentId?.toString?.();
    if (assetDeptId !== deptScope?.toString?.()) {
      return { ok: false, status: 403, message: 'You do not have access to this issue' };
    }
  } else if (isLabTechnician(req.user) && req.user.assignedLocationIds?.length) {
    const assetLocId =
      issue.assetId?.locationId?._id?.toString?.() ?? issue.assetId?.locationId?.toString?.();
    if (!req.user.assignedLocationIds.some((id) => id?.toString() === assetLocId)) {
      return { ok: false, status: 403, message: 'You do not have access to this issue' };
    }
  } else if (canReportOnly(req.user)) {
    const isReporter =
      issue.reportedBy?.toString() === req.user._id?.toString() ||
      issue.reporterEmail?.toLowerCase() === req.user.email?.toLowerCase();
    if (!isReporter) {
      return { ok: false, status: 403, message: 'You do not have access to this issue' };
    }
  }
  return { ok: true };
}

/** GET /api/issues/config */
router.get('/config', requireTabRead('issues'), async (req, res) => {
  try {
    const config = await getIssueOrgConfig(req.user.organizationId);
    const workflows = await listWorkflows(req.user.organizationId);
    res.json({ config, workflows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** PUT /api/issues/config */
router.put('/config', requireTabRead('issues'), requireTicketAction('manage_config'), async (req, res) => {
  try {
    const config = await updateIssueOrgConfig(req.user.organizationId, req.user._id, req.body);
    if (req.body.statuses) {
      try {
        await syncWorkflowWithStatuses(req.user.organizationId, config.statuses, req.user._id);
      } catch (syncErr) {
        console.warn('[issues] Failed to sync workflow with statuses:', syncErr.message);
      }
    }
    await logAudit(req.user._id, AUDIT_ACTIONS.ISSUE_STATUS_CHANGED, AUDIT_RESOURCES.ISSUE, req.user.organizationId, {
      resourceName: 'Issues module settings',
      description: 'Updated issues organization configuration',
      details: { settings: config.settings },
      severity: 'low',
      ...getRequestMetadata(req),
    });
    const workflows = await listWorkflows(req.user.organizationId);
    res.json({ config, workflows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/issues/migrate — ensure defaults + migrate legacy statuses for this org */
router.post('/migrate', requireTabWrite('issues'), async (req, res) => {
  try {
    const result = await migrateOrganizationIssues(req.user.organizationId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * List issues.
 * Query: assetId, status, issueTypeId, priorityId, severityId,
 *        departmentId, teamId, handlerId, unassigned,
 *        escalationStatus, escalationLevel, escalatedTo,
 *        hasNewReports, q, scope=my|all, myReports,
 *        sort=createdAt|updatedAt|dueAt|priority|ticketId|reports|newReports|title,
 *        order=asc|desc, page, limit
 */
router.get('/', requireTabRead('issues'), async (req, res) => {
  try {
    await ensureIssueOrgConfig(req.user.organizationId);
    await ensureDefaultWorkflow(req.user.organizationId);
    // Lazy migrate a batch when listing (idempotent)
    await migrateOrganizationIssues(req.user.organizationId);

    const {
      assetId,
      status,
      issueTypeId,
      priorityId,
      severityId,
      departmentId,
      teamId,
      handlerId,
      unassigned,
      escalationStatus,
      escalationLevel,
      escalatedTo,
      hasNewReports,
      q,
      scope,
      myReports,
      sort = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 50,
    } = req.query;

    const andClauses = [];
    const filter = { organizationId: req.user.organizationId };

    if (assetId) filter.assetId = assetId;
    if (status) {
      const statusId = normalizeStatusId(status);
      andClauses.push({ $or: [{ statusId }, { status: statusId }, { status }] });
    }
    if (issueTypeId) {
      andClauses.push({ $or: [{ issueTypeId }, { category: issueTypeId }] });
    }
    if (priorityId) {
      andClauses.push({ $or: [{ priorityId }, { priority: priorityId }] });
    }
    if (severityId) filter.severityId = severityId;
    if (departmentId) filter.assigneeDepartmentId = departmentId;
    if (teamId) filter.assigneeGroupId = teamId;
    if (handlerId) {
      andClauses.push({
        $or: [{ assigneeUserId: handlerId }, { assignedTo: handlerId }],
      });
    }
    if (unassigned === 'true' || unassigned === true) {
      andClauses.push({
        $and: [
          { $or: [{ assigneeUserId: null }, { assigneeUserId: { $exists: false } }] },
          { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] },
        ],
      });
    }
    if (escalationStatus) {
      const escStatus = String(escalationStatus).trim();
      if (escStatus === 'none') {
        andClauses.push({
          $or: [
            { 'escalation.status': 'none' },
            { 'escalation.status': { $exists: false } },
            { escalation: { $exists: false } },
          ],
        });
      } else if (['warned', 'escalated', 'was_escalated'].includes(escStatus)) {
        filter['escalation.status'] = escStatus;
      }
    }
    if (escalationLevel !== undefined && escalationLevel !== '' && escalationLevel !== null) {
      const levelNum = Number(escalationLevel);
      if (!Number.isNaN(levelNum) && levelNum >= 0) {
        filter['escalation.level'] = levelNum;
      }
    }
    if (escalatedTo) {
      const targetId = String(escalatedTo).trim();
      andClauses.push({
        $or: [
          { 'escalation.lastTargetUserId': targetId },
          { 'escalation.history.targetUserId': targetId },
          {
            $and: [
              { 'escalation.status': { $in: ['escalated', 'was_escalated', 'warned'] } },
              { $or: [{ assigneeUserId: targetId }, { assignedTo: targetId }] },
            ],
          },
        ],
      });
    }
    if (hasNewReports === 'true' || hasNewReports === true) {
      andClauses.push({
        reports: { $elemMatch: { $or: [{ status: 'new' }, { status: { $exists: false } }] } },
      });
    }
    if (q && String(q).trim()) {
      const term = String(q).trim();
      const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andClauses.push({
        $or: [
          { ticketId: rx },
          { title: rx },
          { description: rx },
          { reporterName: rx },
          { reporterEmail: rx },
        ],
      });
    }

    if (scope === 'my') {
      andClauses.push({
        $or: [
          { assignedTo: req.user._id },
          { assigneeUserId: req.user._id },
          { reportedBy: req.user._id },
        ],
      });
    } else if (myReports === 'true' || myReports === true) {
      andClauses.push({
        $or: [
          { reportedBy: req.user._id },
          { reporterEmail: req.user.email?.toLowerCase() },
        ],
      });
    } else {
      const deptScope = getDepartmentScopeId(req.user);
      const locationScoped = isLabTechnician(req.user) && req.user.assignedLocationIds?.length;
      if (deptScope || locationScoped) {
        const scopedIds = await resolveScopedAssetIds(req.user);
        andClauses.push({
          $or: [
            { assetId: { $in: scopedIds } },
            { assignedTo: req.user._id },
            { assigneeUserId: req.user._id },
            ...(deptScope ? [{ assigneeDepartmentId: deptScope }] : []),
          ],
        });
      }
    }

    if (andClauses.length) filter.$and = andClauses;

    const sortKey = String(sort || 'createdAt');
    const sortDir = String(order).toLowerCase() === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const needsReportSort = sortKey === 'reports' || sortKey === 'newReports' || sortKey === 'priority';

    let issues;
    let total;

    if (needsReportSort) {
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            _reportCount: { $size: { $ifNull: ['$reports', []] } },
            _newReportCount: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$reports', []] },
                  as: 'r',
                  cond: {
                    $or: [
                      { $eq: ['$$r.status', 'new'] },
                      { $eq: [{ $ifNull: ['$$r.status', 'new'] }, 'new'] },
                    ],
                  },
                },
              },
            },
            _priorityRank: {
              $switch: {
                branches: [
                  { case: { $in: [{ $ifNull: ['$priorityId', '$priority'] }, ['critical']] }, then: 4 },
                  { case: { $in: [{ $ifNull: ['$priorityId', '$priority'] }, ['high']] }, then: 3 },
                  { case: { $in: [{ $ifNull: ['$priorityId', '$priority'] }, ['medium']] }, then: 2 },
                  { case: { $in: [{ $ifNull: ['$priorityId', '$priority'] }, ['low']] }, then: 1 },
                ],
                default: 0,
              },
            },
          },
        },
      ];

      let sortSpec;
      if (sortKey === 'reports') sortSpec = { _reportCount: sortDir, createdAt: -1 };
      else if (sortKey === 'newReports') sortSpec = { _newReportCount: sortDir, createdAt: -1 };
      else sortSpec = { _priorityRank: sortDir, createdAt: -1 };

      pipeline.push({ $sort: sortSpec });
      const counted = await Issue.aggregate([...pipeline, { $count: 'total' }]);
      total = counted[0]?.total || 0;
      const rows = await Issue.aggregate([...pipeline, { $skip: skip }, { $limit: lim }]);
      const ids = rows.map((r) => r._id);
      const populated = await Issue.find({ _id: { $in: ids } })
        .populate({
          path: 'assetId',
          select: 'name assetId category departmentId locationId assignedTo status',
          populate: { path: 'assignedTo', select: 'name email' },
        })
        .populate('assignedTo', 'name email role')
        .populate('assigneeUserId', 'name email role')
        .populate('assigneeContactId', 'name email phone company role')
        .populate('assigneeGroupId', 'name description')
        .populate({
          path: 'assigneeDepartmentId',
          select: 'name locationId',
          populate: { path: 'locationId', select: 'name path type' },
        })
        .lean();
      const byId = new Map(populated.map((i) => [String(i._id), i]));
      issues = ids.map((id) => byId.get(String(id))).filter(Boolean);
    } else {
      const sortSpec = {};
      if (sortKey === 'updatedAt') sortSpec.updatedAt = sortDir;
      else if (sortKey === 'dueAt') sortSpec.dueAt = sortDir;
      else if (sortKey === 'ticketId') sortSpec.ticketId = sortDir;
      else if (sortKey === 'title') sortSpec.title = sortDir;
      else if (sortKey === 'status') sortSpec.statusId = sortDir;
      else sortSpec.createdAt = sortDir;

      [issues, total] = await Promise.all([
        Issue.find(filter)
          .populate({
            path: 'assetId',
            select: 'name assetId category departmentId locationId assignedTo status',
            populate: { path: 'assignedTo', select: 'name email' },
          })
          .populate('assignedTo', 'name email role')
          .populate('assigneeUserId', 'name email role')
          .populate('assigneeContactId', 'name email phone company role')
          .populate('assigneeGroupId', 'name description')
          .populate({
            path: 'assigneeDepartmentId',
            select: 'name locationId',
            populate: { path: 'locationId', select: 'name path type' },
          })
          .sort(sortSpec)
          .skip(skip)
          .limit(lim)
          .lean(),
        Issue.countDocuments(filter),
      ]);
    }

    res.json({
      issues: issues.map(formatIssue),
      total,
      page: Number(page),
      limit: lim,
      sort: sortKey,
      order: sortDir === 1 ? 'asc' : 'desc',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Get one issue + activities + allowed transitions */
router.get('/:id', requireTabRead('issues'), async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate({
        path: 'assetId',
        select: 'name assetId category locationId assignedTo departmentId status partnerId partnerRelationships',
        populate: [
          { path: 'assignedTo', select: 'name email' },
          { path: 'locationId', select: 'name path' },
          { path: 'partnerId', select: 'name partnerCode' },
          { path: 'partnerRelationships.partnerId', select: 'name partnerCode' },
        ],
      })
      .populate('assignedTo', 'name email role')
      .populate('assigneeUserId', 'name email role')
      .populate('assigneeContactId', 'name email phone company role')
      .populate('assigneeGroupId', 'name description contactIds')
      .populate({
        path: 'assigneeDepartmentId',
        select: 'name locationId',
        populate: { path: 'locationId', select: 'name path type' },
      })
      .populate('relatedPersons.contactId', 'name email phone company role')
      .populate('relatedPersons.partnerId', 'name partnerCode')
      .populate('relatedPersons.addedBy', 'name email')
      .populate('resolution.resolvedBy', 'name email')
      .populate('verification.verifiedBy', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('reports.acknowledgedBy', 'name email')
      .populate('locationId', 'name path')
      .lean();

    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    const access = await assertIssueAccess(req, issue);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    res.json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Acknowledge a report under a ticket */
router.post(
  '/:id/reports/:reportId/acknowledge',
  requireTabRead('issues'),
  requireTicketAction('comment'),
  async (req, res) => {
    try {
      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to update this issue' });
      }

      const reportKey = String(req.params.reportId || '').trim();
      const report = (prev.reports || []).find(
        (r) => r.reportId === reportKey || String(r._id) === reportKey
      );
      if (!report) return res.status(404).json({ message: 'Report not found' });

      const match =
        report.reportId === reportKey
          ? { _id: prev._id, 'reports.reportId': reportKey }
          : { _id: prev._id, 'reports._id': report._id };

      await Issue.updateOne(match, {
        $set: {
          'reports.$.status': 'acknowledged',
          'reports.$.acknowledgedAt': new Date(),
          'reports.$.acknowledgedBy': req.user._id,
        },
      });

      await recordIssueActivity({
        issueId: prev._id,
        organizationId: prev.organizationId,
        type: 'field_updated',
        actorUserId: req.user._id,
        actorName: req.user.name || '',
        actorKind: 'user',
        reason: `Acknowledged report ${report.reportId || reportKey}`,
        meta: {
          fields: ['report_acknowledged'],
          reportId: report.reportId,
        },
      });

      const issue = await Issue.findById(prev._id)
        .populate({
          path: 'assetId',
          select: 'name assetId category locationId assignedTo departmentId status',
          populate: { path: 'assignedTo', select: 'name email' },
        })
        .populate('assignedTo', 'name email role')
        .populate('assigneeUserId', 'name email role')
        .populate('assigneeContactId', 'name email phone company role')
        .populate('assigneeGroupId', 'name description')
        .populate({
          path: 'assigneeDepartmentId',
          select: 'name locationId',
          populate: { path: 'locationId', select: 'name path type' },
        })
        .populate('reports.acknowledgedBy', 'name email')
        .populate('resolution.resolvedBy', 'name email')
        .populate('verification.verifiedBy', 'name email')
        .lean();

      res.json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

/** Assign to user, contact, or group */
router.post(
  '/:id/assign',
  requireTabRead('issues'),
  requireTicketAction('assign'),
  async (req, res) => {
    try {
      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to update this issue' });
      }

      const issue = await assignTicket({
        issue: prev,
        user: req.user,
        assigneeUserId: req.body.assigneeUserId,
        assigneeContactId: req.body.assigneeContactId,
        assigneeGroupId: req.body.assigneeGroupId,
        assigneeDepartmentId: req.body.assigneeDepartmentId,
        reason: req.body.reason || '',
        clear: Boolean(req.body.clear),
        clearTeam: Boolean(req.body.clearTeam),
        clearPerson: Boolean(req.body.clearPerson),
        clearDepartment: Boolean(req.body.clearDepartment),
      });

      res.json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

/** Manual escalation — reason + user required; optional team/dept/priority bump */
router.post(
  '/:id/escalate',
  requireTabRead('issues'),
  requireTicketAction('escalate'),
  async (req, res) => {
    try {
      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to escalate this issue' });
      }

      const closedish = ['resolved', 'verified', 'closed', 'cancelled', 'completed'];
      const st = prev.statusId || prev.status;
      if (closedish.includes(st)) {
        return res.status(400).json({ message: 'Cannot escalate a resolved or closed ticket' });
      }

      const { manualEscalateTicket } = await import('../services/issueEscalationService.js');
      const issue = await manualEscalateTicket({
        issue: prev,
        user: req.user,
        reason: req.body.reason,
        assigneeUserId: req.body.assigneeUserId,
        assigneeGroupId: req.body.assigneeGroupId || null,
        assigneeDepartmentId: req.body.assigneeDepartmentId || null,
        bumpPriorityId: req.body.bumpPriorityId || '',
      });

      res.json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

/** Add a comment on a ticket (logged in activity with actor + timestamp) */
router.post(
  '/:id/comments',
  requireTabRead('issues'),
  requireTicketAction('comment'),
  async (req, res) => {
    try {
      const text = String(req.body.body || req.body.text || req.body.comment || '').trim();
      if (!text) return res.status(400).json({ message: 'Comment text is required' });

      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to comment on this issue' });
      }

      await recordIssueActivity({
        issueId: prev._id,
        organizationId: prev.organizationId,
        type: 'comment',
        actorUserId: req.user._id,
        actorName: req.user.name || '',
        actorKind: 'user',
        reason: text,
      });

      const issue = await Issue.findById(prev._id)
        .populate({
          path: 'assetId',
          select: 'name assetId category locationId assignedTo departmentId status',
          populate: { path: 'assignedTo', select: 'name email' },
        })
        .populate('assignedTo', 'name email role')
        .populate('assigneeUserId', 'name email role')
        .populate('assigneeContactId', 'name email phone company role')
        .populate('assigneeGroupId', 'name description')
        .populate({
          path: 'assigneeDepartmentId',
          select: 'name locationId',
          populate: { path: 'locationId', select: 'name path type' },
        })
        .lean();

      res.status(201).json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

/** Add an internal note (staff-only) */
router.post(
  '/:id/internal-notes',
  requireTabRead('issues'),
  requireTicketAction('internal_note'),
  async (req, res) => {
    try {
      const text = String(req.body.body || req.body.text || req.body.note || '').trim();
      if (!text) return res.status(400).json({ message: 'Internal note text is required' });

      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to update this issue' });
      }

      await recordIssueActivity({
        issueId: prev._id,
        organizationId: prev.organizationId,
        type: 'internal_note',
        actorUserId: req.user._id,
        actorName: req.user.name || '',
        actorKind: 'user',
        reason: text,
      });

      const issue = await Issue.findById(prev._id).lean();
      res.status(201).json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

/** Related contact person options (org contacts + asset partner contacts) */
router.get('/:id/related-person-options', requireTabRead('issues'), async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id).lean();
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    if (issue.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ message: 'You do not have access to this issue' });
    }
    const options = await listRelatedPersonOptions(issue);
    res.json(options);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Add related contact person */
router.post(
  '/:id/related-persons',
  requireTabRead('issues'),
  requireTicketAction('assign'),
  async (req, res) => {
    try {
      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to update this issue' });
      }
      const issue = await addRelatedPerson({ issue: prev, user: req.user, payload: req.body });
      res.status(201).json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

/** Remove related contact person */
router.delete(
  '/:id/related-persons/:relatedPersonId',
  requireTabRead('issues'),
  requireTicketAction('assign'),
  async (req, res) => {
    try {
      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to update this issue' });
      }
      const issue = await removeRelatedPerson({
        issue: prev,
        user: req.user,
        relatedPersonId: req.params.relatedPersonId,
      });
      res.json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

/** Replace ticket tags */
router.put(
  '/:id/tags',
  requireTabRead('issues'),
  requireTicketAction('change_status'),
  async (req, res) => {
    try {
      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to update this issue' });
      }
      const issue = await updateIssueTags({
        issue: prev,
        user: req.user,
        tags: req.body.tags,
      });
      res.json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

/** Transition status — only allowed path to change status */
router.post(
  '/:id/transition',
  requireTabRead('issues'),
  async (req, res) => {
    try {
      const { toStatus, reason, fields, attachment } = req.body;
      if (!toStatus) return res.status(400).json({ message: 'toStatus is required' });

      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to update this issue' });
      }

      const issue = await transitionTicket({
        issue: prev,
        toStatus,
        user: req.user,
        reason,
        fields,
        attachment,
        req,
      });

      await logAudit(req.user._id, AUDIT_ACTIONS.ISSUE_STATUS_CHANGED, AUDIT_RESOURCES.ISSUE, issue._id, {
        resourceName: `${issue.ticketId} - ${issue.title}`,
        description: `Changed issue status from "${prev.statusId || prev.status}" to "${toStatus}"`,
        details: {
          ticketId: issue.ticketId,
          oldStatus: prev.statusId || prev.status,
          newStatus: toStatus,
          reason: reason || '',
        },
        severity: toStatus === 'resolved' || toStatus === 'closed' ? 'medium' : 'low',
        ...getRequestMetadata(req),
      });

      const managers = await User.find({
        role: { $in: ['super_admin', 'admin', 'manager', 'principal'] },
        isActive: true,
        organizationId: issue.organizationId,
      })
        .limit(50)
        .select('_id')
        .lean();

      const notif = {
        type: toStatus === 'resolved' || toStatus === 'closed' ? 'report_resolved' : 'report_updated',
        title: toStatus === 'resolved' || toStatus === 'closed' ? 'Ticket resolved' : 'Ticket updated',
        body: `${issue.ticketId} → ${String(toStatus).replace(/_/g, ' ')}`,
        link: `/dashboard/issues/${issue._id}`,
        metadata: { issueId: issue._id },
      };
      if (managers.length) {
        await Notification.insertMany(managers.map((u) => ({ ...notif, userId: u._id })));
      }

      res.json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ message: err.message });
    }
  }
);

/**
 * PATCH safe fields only (not status).
 */
router.patch(
  '/:id',
  requireTabRead('issues'),
  async (req, res) => {
    try {
      const prev = await Issue.findById(req.params.id).lean();
      if (!prev) return res.status(404).json({ message: 'Issue not found' });
      if (prev.organizationId?.toString() !== req.user.organizationId?.toString()) {
        return res.status(403).json({ message: 'You do not have permission to update this issue' });
      }

      if (req.body.status || req.body.statusId) {
        return res.status(400).json({
          message: 'Status changes must use POST /api/issues/:id/transition',
        });
      }

      const changingPriority =
        req.body.priority !== undefined || req.body.priorityId !== undefined;
      if (changingPriority) {
        const nextPrio = req.body.priorityId || req.body.priority;
        if (nextPrio === 'critical' && !canPerformTicketAction(req.user, 'escalate', req)) {
          if (!canPerformTicketAction(req.user, 'change_priority', req)) {
            return res.status(403).json({ message: 'You do not have permission to change priority' });
          }
          // escalate preferred for critical; allow change_priority as fallback
        } else if (!canPerformTicketAction(req.user, 'change_priority', req)) {
          return res.status(403).json({ message: 'You do not have permission to change priority' });
        }
      }

      const changingSeverity = req.body.severityId !== undefined;
      if (changingSeverity && !canPerformTicketAction(req.user, 'change_severity', req)) {
        // Backward compatible: change_priority also allows severity if severity action unset on old roles
        if (!canPerformTicketAction(req.user, 'change_priority', req)) {
          return res.status(403).json({ message: 'You do not have permission to change severity' });
        }
      }

      const otherKeys = ['title', 'description', 'issueTypeId', 'customFields', 'dueAt', 'tags'];
      const changingOther = otherKeys.some((k) => req.body[k] !== undefined);
      if (
        changingOther &&
        !canPerformTicketAction(req.user, 'change_status', req) &&
        !changingPriority &&
        !changingSeverity
      ) {
        // allow due/tags with change_status OR assign-like edit; use change_status as general edit
        if (!canPerformTicketAction(req.user, 'assign', req)) {
          return res.status(403).json({ message: 'You do not have permission to update this ticket' });
        }
      }

      const allowed = ['title', 'description', 'priority', 'priorityId', 'severityId', 'issueTypeId', 'customFields', 'dueAt', 'tags'];
      const update = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) update[key] = req.body[key];
      }
      if (!Object.keys(update).length) {
        return res.status(400).json({ message: 'No updatable fields provided' });
      }
      if (Object.prototype.hasOwnProperty.call(update, 'tags')) {
        if (!Array.isArray(update.tags)) {
          return res.status(400).json({ message: 'tags must be an array of strings' });
        }
        update.tags = [
          ...new Set(
            update.tags
              .map((t) => String(t || '').trim())
              .filter(Boolean)
              .map((t) => t.slice(0, 48))
          ),
        ].slice(0, 30);
      }
      if (Object.prototype.hasOwnProperty.call(update, 'dueAt')) {
        if (update.dueAt === '' || update.dueAt === null) {
          update.dueAt = null;
        } else {
          const parsed = new Date(update.dueAt);
          if (Number.isNaN(parsed.getTime())) {
            return res.status(400).json({ message: 'Invalid due date' });
          }
          update.dueAt = parsed;
        }
      }
      if (update.priorityId && !update.priority) update.priority = update.priorityId;
      if (update.priority && !update.priorityId) update.priorityId = update.priority;

      const issue = await Issue.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
        .populate({
          path: 'assetId',
          select: 'name assetId category locationId assignedTo departmentId status',
          populate: { path: 'assignedTo', select: 'name email' },
        })
        .populate('assignedTo', 'name email role')
        .populate('assigneeUserId', 'name email role')
        .populate('assigneeContactId', 'name email phone company role')
        .populate('assigneeGroupId', 'name description')
      .populate({
        path: 'assigneeDepartmentId',
        select: 'name locationId',
        populate: { path: 'locationId', select: 'name path type' },
      })
        .lean();

      if (Object.prototype.hasOwnProperty.call(update, 'dueAt')) {
        const prevDue = prev.dueAt ? new Date(prev.dueAt).getTime() : null;
        const nextDue = update.dueAt ? new Date(update.dueAt).getTime() : null;
        if (nextDue && nextDue !== prevDue) {
          await recordIssueActivity({
            issueId: issue._id,
            organizationId: issue.organizationId,
            type: 'field_updated',
            actorUserId: req.user._id,
            actorName: req.user.name || '',
            from: prev.dueAt ? String(prev.dueAt) : '',
            to: String(update.dueAt),
            meta: { fields: ['dueAt'] },
          });
        } else if (!nextDue && prevDue) {
          await recordIssueActivity({
            issueId: issue._id,
            organizationId: issue.organizationId,
            type: 'field_updated',
            actorUserId: req.user._id,
            actorName: req.user.name || '',
            from: String(prev.dueAt),
            to: '',
            meta: { fields: ['dueAt'], cleared: true },
          });
        }
      }
      if (update.priorityId && update.priorityId !== (prev.priorityId || prev.priority)) {
        await recordIssueActivity({
          issueId: issue._id,
          organizationId: issue.organizationId,
          type: 'priority_changed',
          actorUserId: req.user._id,
          actorName: req.user.name || '',
          from: prev.priorityId || prev.priority,
          to: update.priorityId,
        });
      }
      if (update.severityId && update.severityId !== prev.severityId) {
        await recordIssueActivity({
          issueId: issue._id,
          organizationId: issue.organizationId,
          type: 'severity_changed',
          actorUserId: req.user._id,
          actorName: req.user.name || '',
          from: prev.severityId || '',
          to: update.severityId,
        });
      }
      const loggedSpecial =
        Object.prototype.hasOwnProperty.call(update, 'dueAt') ||
        (update.priorityId && update.priorityId !== (prev.priorityId || prev.priority)) ||
        (update.severityId && update.severityId !== prev.severityId);
      if (!loggedSpecial && Object.keys(update).length) {
        await recordIssueActivity({
          issueId: issue._id,
          organizationId: issue.organizationId,
          type: 'field_updated',
          actorUserId: req.user._id,
          actorName: req.user.name || '',
          meta: { fields: Object.keys(update) },
        });
      }

      res.json(await issueDetailPayload(req.user.organizationId, issue, req.user, req));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

/** Create ticket (staff) */
router.post('/', requireTabRead('issues'), requireTicketAction('create'), async (req, res) => {
  try {
    const { assetId, title, description, category, issueTypeId, priority, priorityId, severityId, photos } =
      req.body;

    if (!assetId || !title) {
      return res.status(400).json({ message: 'Asset ID and title are required' });
    }

    const deviceId = getDeviceFingerprint(req);
    const rateLimitCheck = await canReport(deviceId, assetId);
    if (!rateLimitCheck.canReport) {
      return res.status(429).json({
        message: `You can report again after ${rateLimitCheck.timeRemaining} minutes`,
        nextReportAt: rateLimitCheck.nextReportAt,
        timeRemaining: rateLimitCheck.timeRemaining,
      });
    }

    const asset = await Asset.findById(assetId)
      .select('departmentId organizationId status condition maintenanceReason assetId name locationId')
      .lean();
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    if (asset.organizationId?.toString() !== req.user.organizationId?.toString()) {
      return res.status(403).json({ message: 'You can only report issues for assets in your organization' });
    }
    if (asset.status === 'under_maintenance') {
      return res.status(400).json({
        message: 'Cannot report issues for this asset - currently under maintenance',
        canReport: false,
      });
    }

    const config = await ensureIssueOrgConfig(asset.organizationId);
    const workflow = await ensureDefaultWorkflow(asset.organizationId);
    const typeId = issueTypeId || mapLegacyCategoryToTypeId(category) || config.settings.defaultIssueTypeId;
    const prio = priorityId || priority || config.settings.defaultPriorityId || 'medium';
    const sev = severityId || config.settings.defaultSeverityId || 'medium';
    const initialStatus =
      config.statuses?.find((s) => s.isDefault)?.id ||
      workflow.stages?.[0] ||
      'new';

    const ticketId = await generateTicketId(asset.organizationId);
    const issue = await Issue.create({
      ticketId,
      assetId,
      organizationId: asset.organizationId,
      title,
      description,
      category: category || typeId,
      issueTypeId: typeId,
      status: initialStatus,
      statusId: initialStatus,
      priority: prio,
      priorityId: prio,
      severityId: sev,
      workflowId: workflow._id,
      workflowKey: workflow.key,
      photos: photos || [],
      reportedBy: req.user._id,
      reporterName: req.user.name,
      reporterEmail: req.user.email,
      reporterPhone: req.user.phone,
      locationId: asset.locationId,
    });

    await recordIssueActivity({
      issueId: issue._id,
      organizationId: asset.organizationId,
      type: 'created',
      actorUserId: req.user._id,
      actorName: req.user.name || '',
      actorKind: 'user',
      to: initialStatus,
      meta: { ticketId, issueTypeId: typeId },
    });

    // Rule-based auto-assignment (user required on matching rule)
    try {
      await applyAutoAssignOnCreate(issue, asset);
    } catch (err) {
      console.error('Auto-assign failed:', err.message);
    }

    await recordReportAttempt(deviceId, assetId, req);

    await logAudit(req.user._id, AUDIT_ACTIONS.ISSUE_CREATED, AUDIT_RESOURCES.ISSUE, issue._id, {
      resourceName: `${ticketId} - ${title}`,
      description: `Created issue "${title}" for asset ${asset?.assetId || assetId}`,
      details: { ticketId, assetId, title, issueTypeId: typeId, priority: prio },
      severity: prio === 'high' || prio === 'critical' ? 'high' : 'medium',
      ...getRequestMetadata(req),
    });

    const populated = await Issue.findById(issue._id)
      .populate({
        path: 'assetId',
        select: 'name assetId category departmentId locationId assignedTo status',
        populate: { path: 'assignedTo', select: 'name email' },
      })
      .populate('assignedTo', 'name email role')
      .populate('assigneeUserId', 'name email role')
      .lean();

    res.status(201).json(formatIssue(populated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
