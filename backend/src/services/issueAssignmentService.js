import { Issue, ContactGroup, User, Department } from '../models/index.js';
import { recordIssueActivity } from './issueActivityService.js';

function idOf(v) {
  if (!v) return '';
  if (typeof v === 'object' && v._id) return String(v._id);
  return String(v);
}

/**
 * Assign handling dept, team, and/or person independently.
 * - Department (assigneeDepartmentId): org dept from locations/departments
 * - Team (assigneeGroupId): contact group / handling team
 * - Person (assigneeUserId): org user who handles the issue
 */
export async function assignTicket({
  issue,
  user,
  assigneeUserId,
  assigneeContactId,
  assigneeGroupId,
  assigneeDepartmentId,
  reason = '',
  clear = false,
  clearTeam = false,
  clearPerson = false,
  clearDepartment = false,
  actorKind = 'user',
  actorName = '',
  activityType = 'assigned',
  activityMeta = {},
}) {
  if (assigneeContactId) {
    const err = new Error(
      'Contacts cannot be assignees. Add them as related contact persons on the ticket instead.'
    );
    err.status = 400;
    throw err;
  }

  if (actorKind === 'user' && !user?._id) {
    const err = new Error('Actor user is required');
    err.status = 400;
    throw err;
  }

  const orgId = issue.organizationId?.toString();

  let nextUserId = issue.assigneeUserId || issue.assignedTo || null;
  let nextGroupId = issue.assigneeGroupId || null;
  let nextDeptId = issue.assigneeDepartmentId || null;

  if (clear) {
    nextUserId = null;
    nextGroupId = null;
    nextDeptId = null;
  } else {
    if (clearDepartment || assigneeDepartmentId === null) nextDeptId = null;
    else if (assigneeDepartmentId !== undefined && assigneeDepartmentId) nextDeptId = assigneeDepartmentId;

    if (clearTeam || assigneeGroupId === null) nextGroupId = null;
    else if (assigneeGroupId !== undefined && assigneeGroupId) nextGroupId = assigneeGroupId;

    if (clearPerson) {
      nextUserId = null;
    } else if (assigneeUserId !== undefined) {
      nextUserId = assigneeUserId || null;
    }
  }

  const update = {
    assignedTo: null,
    assigneeUserId: null,
    assigneeContactId: null,
    assigneeGroupId: null,
    assigneeDepartmentId: null,
    assignedAt: null,
  };

  let deptLabel = '';
  let teamLabel = '';
  let personLabel = '';

  if (nextDeptId) {
    const d = await Department.findOne({
      _id: nextDeptId,
      organizationId: orgId,
    })
      .select('name locationId')
      .populate('locationId', 'name path')
      .lean();
    if (!d) {
      const err = new Error('Department not found');
      err.status = 404;
      throw err;
    }
    update.assigneeDepartmentId = d._id;
    deptLabel = d.name;
  }

  if (nextGroupId) {
    const g = await ContactGroup.findOne({
      _id: nextGroupId,
      organizationId: orgId,
      isActive: true,
    })
      .select('name')
      .lean();
    if (!g) {
      const err = new Error('Team not found or inactive');
      err.status = 404;
      throw err;
    }
    update.assigneeGroupId = g._id;
    teamLabel = g.name;
  }

  if (nextUserId) {
    const u = await User.findOne({
      _id: nextUserId,
      organizationId: orgId,
      isActive: true,
    })
      .select('name email role')
      .lean();
    if (!u) {
      const err = new Error('User not found in this organization');
      err.status = 404;
      throw err;
    }
    update.assignedTo = u._id;
    update.assigneeUserId = u._id;
    personLabel = u.name;
  }

  const statusId = issue.statusId || issue.status;
  if (statusId === 'assigned' && !update.assigneeUserId) {
    const err = new Error(
      'Cannot remove the handler while status is Assigned. Change the status first, or assign another handler.'
    );
    err.status = 400;
    throw err;
  }

  if (update.assigneeUserId || update.assigneeGroupId || update.assigneeDepartmentId) {
    update.assignedAt = new Date();
  }

  const sameUser = idOf(update.assigneeUserId) === idOf(issue.assigneeUserId || issue.assignedTo);
  const sameGroup = idOf(update.assigneeGroupId) === idOf(issue.assigneeGroupId);
  const sameDept = idOf(update.assigneeDepartmentId) === idOf(issue.assigneeDepartmentId);
  const hadContact = Boolean(issue.assigneeContactId);
  if (sameUser && sameGroup && sameDept && !hadContact) {
    return Issue.findById(issue._id)
    .populate('assignedTo', 'name email role')
    .populate('assigneeUserId', 'name email role')
    .populate('assigneeContactId', 'name email phone company role')
    .populate('assigneeGroupId', 'name description contactIds')
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

  const fromLabel =
    [
      issue.assigneeDepartmentId ? 'dept' : null,
      issue.assigneeGroupId ? 'team' : null,
      issue.assigneeUserId || issue.assignedTo ? 'user' : null,
      issue.assigneeContactId ? 'contact' : null,
    ]
      .filter(Boolean)
      .join('+') || 'unassigned';

  const toParts = [];
  if (deptLabel) toParts.push(`dept: ${deptLabel}`);
  if (teamLabel) toParts.push(`team: ${teamLabel}`);
  if (personLabel) toParts.push(personLabel);
  const toLabel = toParts.join(' · ') || 'Unassigned';

  const doc = await Issue.findByIdAndUpdate(issue._id, { $set: update }, { new: true })
    .populate('assignedTo', 'name email role')
    .populate('assigneeUserId', 'name email role')
    .populate('assigneeContactId', 'name email phone company role')
    .populate('assigneeGroupId', 'name description contactIds')
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

  await recordIssueActivity({
    issueId: issue._id,
    organizationId: issue.organizationId,
    type: activityType,
    actorUserId: user?._id,
    actorName: actorName || user?.name || (actorKind === 'system' ? 'Automation' : ''),
    actorKind: actorKind === 'system' ? 'system' : 'user',
    from: fromLabel,
    to: toLabel,
    reason: String(reason || '').trim(),
    meta: {
      assigneeUserId: update.assigneeUserId,
      assigneeGroupId: update.assigneeGroupId,
      assigneeDepartmentId: update.assigneeDepartmentId,
      ...activityMeta,
    },
  });

  return doc;
}

/**
 * List assignable org users, teams, and departments.
 */
export async function listAssignablePeople(organizationId) {
  const [users, groups, departments] = await Promise.all([
    User.find({ organizationId, isActive: true })
      .select('_id name email role customRoleId')
      .populate('customRoleId', 'name')
      .sort({ name: 1 })
      .lean(),
    ContactGroup.find({ organizationId, isActive: true })
      .select('_id name description contactIds')
      .sort({ name: 1 })
      .lean(),
    Department.find({ organizationId })
      .select('_id name description locationId')
      .populate('locationId', 'name path type')
      .sort({ name: 1 })
      .lean(),
  ]);

  return {
    users: users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.customRoleId?.name || u.role,
      kind: 'user',
    })),
    contacts: [],
    unteamedContacts: [],
    groups: groups.map((g) => ({
      _id: g._id,
      name: g.name,
      description: g.description,
      contactIds: (g.contactIds || []).map(String),
      kind: 'group',
    })),
    departments: departments.map((d) => ({
      _id: d._id,
      name: d.name,
      description: d.description || '',
      locationPath: d.locationId?.path || d.locationId?.name || '',
      locationId: d.locationId?._id || d.locationId || null,
      kind: 'department',
    })),
  };
}
