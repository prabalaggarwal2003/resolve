'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite, canTicketAction } from '@/lib/permissions';
import { formatOrgDateTime } from '@/lib/orgTimezone';
import {
  addIssueComment,
  addInternalNote,
  addRelatedPerson,
  acknowledgeIssueReport,
  assignIssue,
  escalateIssue,
  fetchAssignees,
  fetchIssue,
  fetchRelatedPersonOptions,
  removeRelatedPerson,
  statusLabel,
  transitionIssue,
  updateIssue,
  updateIssueTags,
  type IssueActivity,
  type IssueOrgConfig,
  type IssueTicket,
  type RelatedPersonOption,
  type WorkflowTransition,
} from '@/lib/issues';

function badgeStyle(color?: string) {
  const c = color || '#6b7280';
  return {
    color: c,
    backgroundColor: `${c}22`,
    borderColor: `${c}55`,
  } as React.CSSProperties;
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium text-gray-200 mt-0.5 break-words">{value}</p>
    </div>
  );
}

function toDatetimeLocalValue(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mergeIssue(prev: IssueTicket | null, next: IssueTicket): IssueTicket {
  return {
    ...next,
    config: next.config || prev?.config,
    activities: next.activities || prev?.activities,
    allowedTransitions: next.allowedTransitions ?? prev?.allowedTransitions,
  };
}

function activityTitle(a: IssueActivity) {
  switch (a.type) {
    case 'created':
      return 'Ticket created';
    case 'status_changed':
      return `Status: ${a.from || '—'} → ${a.to || '—'}`;
    case 'resolution':
      return 'Resolved';
    case 'verification':
      return 'Verified';
    case 'reopened':
      return 'Reopened';
    case 'closed':
      return 'Closed';
    case 'priority_changed':
      return `Priority: ${a.from || '—'} → ${a.to || '—'}`;
    case 'severity_changed':
      return `Severity: ${a.from || '—'} → ${a.to || '—'}`;
    case 'report_merged':
      return a.reason?.startsWith('New report') ? a.reason : 'New report added';
    case 'field_updated': {
      const fields = (a.meta as { fields?: string[]; action?: string; cleared?: boolean } | undefined)?.fields;
      if (Array.isArray(fields) && fields.includes('report_acknowledged')) return 'Report acknowledged';
      if (Array.isArray(fields) && fields.includes('reporter_attention')) return 'Reporter requested attention';
      if (Array.isArray(fields) && fields.includes('dueAt')) {
        return (a.meta as { cleared?: boolean }).cleared ? 'Due date cleared' : 'Due date updated';
      }
      if (Array.isArray(fields) && fields.includes('tags')) return 'Tags updated';
      if (Array.isArray(fields) && fields.includes('relatedPersons')) {
        return (a.meta as { action?: string }).action === 'removed'
          ? 'Related contact removed'
          : 'Related contact added';
      }
      return 'Fields updated';
    }
    case 'assigned':
      return 'Assignment changed';
    case 'auto_assigned':
      return a.reason ? `Auto-assigned — ${a.reason}` : 'Auto-assigned';
    case 'escalated': {
      const level = (a.meta as { level?: number; settled?: boolean } | undefined)?.level;
      if ((a.meta as { settled?: boolean } | undefined)?.settled) {
        return level ? `Was escalated (level ${level})` : 'Was escalated';
      }
      const base = level ? `Escalated — Level ${level}` : 'Escalated';
      return a.reason ? `${base}: ${a.reason}` : base;
    }
    case 'comment':
      return 'Comment';
    case 'internal_note':
      return 'Internal note';
    default:
      return a.type.replace(/_/g, ' ');
  }
}

type AssigneeUser = { _id: string; name: string; email?: string; role?: string; kind: 'user' };
type AssigneeGroup = { _id: string; name: string; contactIds: string[]; kind: 'group' };
type AssigneeDepartment = {
  _id: string;
  name: string;
  locationPath?: string;
  kind: 'department';
};

export default function IssueDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const [issue, setIssue] = useState<IssueTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [selected, setSelected] = useState<WorkflowTransition | null>(null);
  const [reason, setReason] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [transitionError, setTransitionError] = useState('');
  const [assignError, setAssignError] = useState('');
  const [users, setUsers] = useState<AssigneeUser[]>([]);
  const [groups, setGroups] = useState<AssigneeGroup[]>([]);
  const [departments, setDepartments] = useState<AssigneeDepartment[]>([]);
  const [deptId, setDeptId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [personKey, setPersonKey] = useState(''); // `user:id`
  const [assigningDept, setAssigningDept] = useState(false);
  const [assigningTeam, setAssigningTeam] = useState(false);
  const [assigningPerson, setAssigningPerson] = useState(false);
  const [dueLocal, setDueLocal] = useState('');
  const [savingDue, setSavingDue] = useState(false);
  const [dueError, setDueError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [relatedOptions, setRelatedOptions] = useState<RelatedPersonOption[]>([]);
  const [relatedKey, setRelatedKey] = useState('');
  const [relatedRelation, setRelatedRelation] = useState('');
  const [savingRelated, setSavingRelated] = useState(false);
  const [relatedError, setRelatedError] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const [tagError, setTagError] = useState('');
  const [acknowledgingReportId, setAcknowledgingReportId] = useState('');
  const [reportError, setReportError] = useState('');
  const [savingPriority, setSavingPriority] = useState(false);
  const [savingSeverity, setSavingSeverity] = useState(false);
  const [prioSevError, setPrioSevError] = useState('');
  const [showEscalate, setShowEscalate] = useState(false);
  const [escReason, setEscReason] = useState('');
  const [escUserId, setEscUserId] = useState('');
  const [escTeamId, setEscTeamId] = useState('');
  const [escDeptId, setEscDeptId] = useState('');
  const [escBumpPriority, setEscBumpPriority] = useState(false);
  const [escPriorityId, setEscPriorityId] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalateError, setEscalateError] = useState('');

  const config = useMemo(() => {
    if (!issue?.config) return null;
    return {
      statuses: issue.config.statuses,
      priorities: issue.config.priorities,
      severities: issue.config.severities,
      issueTypes: issue.config.issueTypes,
      settings: {
        ticketPrefix: 'TKT',
        defaultPriorityId: 'medium',
        defaultSeverityId: 'medium',
        defaultIssueTypeId: 'incident',
        defaultWorkflowKey: 'default',
      },
    } as IssueOrgConfig;
  }, [issue]);

  const loadRelatedOptions = async (issueId: string) => {
    try {
      const data = await fetchRelatedPersonOptions(issueId);
      setRelatedOptions([...(data.contacts || []), ...(data.partnerContacts || [])]);
    } catch {
      setRelatedOptions([]);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchIssue(id);
      setIssue(data);
      setDueLocal(toDatetimeLocalValue(data.dueAt));
      setDeptId(data.assigneeDepartmentId?._id || '');
      setTeamId(data.assigneeGroupId?._id || '');
      const uid = data.assigneeUserId?._id || data.assignedTo?._id;
      setPersonKey(uid ? `user:${uid}` : '');
      await loadRelatedOptions(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!canTicketAction('assign') && !canWrite('issues')) return;
    fetchAssignees()
      .then((data) => {
        setUsers(data.users);
        setGroups(data.groups);
        setDepartments(data.departments || []);
      })
      .catch(() => {
        /* optional */
      });
  }, []);

  // Handler list is org users only — contacts are related persons
  const personOptions = useMemo(
    () =>
      users.map((u) => ({
        key: `user:${u._id}`,
        label: `${u.name}${u.role ? ` · ${u.role}` : ''}`,
      })),
    [users]
  );

  const applyIssue = (updated: IssueTicket) => {
    setIssue((prev) => mergeIssue(prev, updated));
  };

  const saveDepartment = async () => {
    if (!issue) return;
    setAssigningDept(true);
    setAssignError('');
    try {
      const updated = deptId
        ? await assignIssue(issue._id, { assigneeDepartmentId: deptId })
        : await assignIssue(issue._id, { clearDepartment: true });
      applyIssue(updated);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Department assign failed');
    } finally {
      setAssigningDept(false);
    }
  };

  const saveTeam = async () => {
    if (!issue) return;
    setAssigningTeam(true);
    setAssignError('');
    try {
      const updated = teamId
        ? await assignIssue(issue._id, { assigneeGroupId: teamId })
        : await assignIssue(issue._id, { clearTeam: true });
      applyIssue(updated);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Team assign failed');
    } finally {
      setAssigningTeam(false);
    }
  };

  const savePerson = async () => {
    if (!issue) return;
    setAssigningPerson(true);
    setAssignError('');
    try {
      let updated: IssueTicket;
      if (!personKey) {
        updated = await assignIssue(issue._id, { clearPerson: true });
      } else if (personKey.startsWith('user:')) {
        updated = await assignIssue(issue._id, { assigneeUserId: personKey.slice(5) });
      } else {
        setAssignError('Select an org user as handler');
        setAssigningPerson(false);
        return;
      }
      applyIssue(updated);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Person assign failed');
    } finally {
      setAssigningPerson(false);
    }
  };

  const clearAllAssignment = async () => {
    if (!issue) return;
    setAssigningDept(true);
    setAssigningTeam(true);
    setAssigningPerson(true);
    setAssignError('');
    try {
      const updated = await assignIssue(issue._id, { clear: true });
      applyIssue(updated);
      setDeptId('');
      setTeamId('');
      setPersonKey('');
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Unassign failed');
    } finally {
      setAssigningDept(false);
      setAssigningTeam(false);
      setAssigningPerson(false);
    }
  };

  const addRelated = async () => {
    if (!issue || !relatedKey || !relatedRelation.trim()) return;
    const opt = relatedOptions.find((o) => o.key === relatedKey);
    if (!opt) return;
    setSavingRelated(true);
    setRelatedError('');
    try {
      const body =
        opt.kind === 'contact'
          ? { kind: 'contact' as const, contactId: opt.contactId, relation: relatedRelation.trim() }
          : {
              kind: 'partnerContact' as const,
              partnerId: opt.partnerId,
              partnerContactId: opt.partnerContactId || undefined,
              usePrimary: Boolean(opt.isPrimary) || !opt.partnerContactId,
              relation: relatedRelation.trim(),
            };
      const updated = await addRelatedPerson(issue._id, body);
      applyIssue(updated);
      setRelatedKey('');
      setRelatedRelation('');
    } catch (err) {
      setRelatedError(err instanceof Error ? err.message : 'Failed to add contact person');
    } finally {
      setSavingRelated(false);
    }
  };

  const removeRelated = async (relatedPersonId: string) => {
    if (!issue) return;
    setSavingRelated(true);
    setRelatedError('');
    try {
      const updated = await removeRelatedPerson(issue._id, relatedPersonId);
      applyIssue(updated);
    } catch (err) {
      setRelatedError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setSavingRelated(false);
    }
  };

  const addTag = async () => {
    if (!issue || !tagInput.trim()) return;
    const next = [...new Set([...(issue.tags || []), tagInput.trim()])];
    setSavingTags(true);
    setTagError('');
    try {
      const updated = await updateIssueTags(issue._id, next);
      applyIssue(updated);
      setTagInput('');
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setSavingTags(false);
    }
  };

  const removeTag = async (tag: string) => {
    if (!issue) return;
    setSavingTags(true);
    setTagError('');
    try {
      const updated = await updateIssueTags(
        issue._id,
        (issue.tags || []).filter((t) => t !== tag)
      );
      applyIssue(updated);
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to remove tag');
    } finally {
      setSavingTags(false);
    }
  };

  const saveDue = async () => {
    if (!issue || !dueLocal) return;
    const parsed = new Date(dueLocal);
    if (Number.isNaN(parsed.getTime())) {
      setDueError('Select a valid date');
      return;
    }
    setSavingDue(true);
    setDueError('');
    try {
      await updateIssue(issue._id, { dueAt: parsed.toISOString() });
      const fresh = await fetchIssue(issue._id);
      applyIssue(fresh);
      setDueLocal(toDatetimeLocalValue(fresh.dueAt));
    } catch (err) {
      setDueError(err instanceof Error ? err.message : 'Failed to save due date');
    } finally {
      setSavingDue(false);
    }
  };

  const clearDue = async () => {
    if (!issue?.dueAt) return;
    setSavingDue(true);
    setDueError('');
    try {
      await updateIssue(issue._id, { dueAt: null });
      const reloaded = await fetchIssue(issue._id);
      applyIssue(reloaded);
      setDueLocal('');
    } catch (err) {
      setDueError(err instanceof Error ? err.message : 'Failed to clear');
    } finally {
      setSavingDue(false);
    }
  };

  const submitComment = async () => {
    if (!issue || !commentText.trim()) return;
    setSavingComment(true);
    setCommentError('');
    try {
      const updated = await addIssueComment(issue._id, commentText.trim());
      applyIssue(updated);
      setCommentText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSavingComment(false);
    }
  };

  const submitNote = async () => {
    if (!issue || !noteText.trim()) return;
    setSavingNote(true);
    setNoteError('');
    try {
      const updated = await addInternalNote(issue._id, noteText.trim());
      applyIssue(updated);
      setNoteText('');
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const acknowledgeReport = async (reportKey: string) => {
    if (!issue || !reportKey) return;
    setAcknowledgingReportId(reportKey);
    setReportError('');
    try {
      const updated = await acknowledgeIssueReport(issue._id, reportKey);
      applyIssue(updated);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to acknowledge');
    } finally {
      setAcknowledgingReportId('');
    }
  };

  const runTransition = async () => {
    if (!issue || !selected?.to) return;
    setTransitioning(true);
    setTransitionError('');
    try {
      const fields: { resolution?: { notes: string }; verification?: { notes: string } } = {};
      if (selected.requiredFields?.some((f) => f.startsWith('resolution'))) {
        fields.resolution = { notes: extraNotes || reason };
      }
      if (selected.requiredFields?.some((f) => f.startsWith('verification'))) {
        fields.verification = { notes: extraNotes || reason };
      }
      const updated = await transitionIssue(issue._id, {
        toStatus: selected.to,
        reason,
        fields,
      });
      applyIssue(updated);
      setSelected(null);
      setReason('');
      setExtraNotes('');
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading ticket..." />;
  }

  if (error || !issue) {
    return (
      <div className="space-y-3">
        <Link href="/dashboard/issues" className="text-xs text-blue-400 no-underline">
          ← Back to tickets
        </Link>
        <p className="text-sm text-red-400">{error || 'Ticket not found'}</p>
      </div>
    );
  }

  const sid = issue.statusId || issue.status;
  const statusOpt = config?.statuses?.find((s) => s.id === sid);
  const prio = issue.priorityId || issue.priority || 'medium';
  const prioOpt = config?.priorities?.find((p) => p.id === prio);
  const hasHandler = Boolean(issue.assigneeUserId?._id || issue.assignedTo?._id);
  const typeOpt = config?.issueTypes?.find((t) => t.id === (issue.issueTypeId || issue.category));
  const teamDisplay = issue.teamLabel || issue.assigneeGroupId?.name || 'Unassigned';
  const deptDisplay = issue.departmentLabel || issue.assigneeDepartmentId?.name || 'Unassigned';
  const personDisplay =
    issue.assigneeUserId?.name ||
    issue.assignedTo?.name ||
    issue.personLabel ||
    'Unassigned';
  const canAssign = canTicketAction('assign');
  const canEscalate = canTicketAction('escalate');
  const canComment = canTicketAction('comment');
  const canNote = canTicketAction('internal_note');
  const canTransition = canTicketAction('change_status') || canTicketAction('resolve') || canTicketAction('verify') || canTicketAction('close') || canTicketAction('reopen');
  const canDue = canTicketAction('change_status') || canAssign;
  const canTags = canTicketAction('change_status') || canAssign;
  const canChangePriority = canTicketAction('change_priority') || canTicketAction('escalate');
  const canChangeSeverity = canTicketAction('change_severity') || canTicketAction('change_priority');
  const escStatus = issue.escalation?.status;
  const isActiveEsc = escStatus === 'escalated' || escStatus === 'warned';
  const wasEscalated = escStatus === 'was_escalated';
  const closedish = ['resolved', 'verified', 'closed', 'cancelled', 'completed'];
  const canManualEscalate = canEscalate && !closedish.includes(sid);

  const submitManualEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !canEscalate) return;
    setEscalating(true);
    setEscalateError('');
    try {
      const updated = await escalateIssue(issue._id, {
        reason: escReason.trim(),
        assigneeUserId: escUserId,
        assigneeGroupId: escTeamId || null,
        assigneeDepartmentId: escDeptId || null,
        bumpPriorityId: escBumpPriority && escPriorityId ? escPriorityId : '',
      });
      applyIssue(updated);
      const reloaded = await fetchIssue(issue._id);
      applyIssue(reloaded);
      setShowEscalate(false);
      setEscReason('');
      setEscUserId('');
      setEscTeamId('');
      setEscDeptId('');
      setEscBumpPriority(false);
      setEscPriorityId('');
    } catch (err) {
      setEscalateError(err instanceof Error ? err.message : 'Escalation failed');
    } finally {
      setEscalating(false);
    }
  };
  const comments = (issue.activities || []).filter((a) => a.type === 'comment');
  const internalNotes = (issue.activities || []).filter((a) => a.type === 'internal_note');
  const timeline = (issue.activities || []).filter((a) => a.type !== 'comment' && a.type !== 'internal_note');
  const dueSelected = Boolean(dueLocal);
  const orgContactOpts = relatedOptions.filter((o) => o.kind === 'contact');
  const partnerContactOpts = relatedOptions.filter((o) => o.kind === 'partnerContact');
  const reportCount = issue.reportCount ?? issue.reports?.length ?? 0;
  const newReportCount =
    issue.newReportCount ??
    (issue.reports || []).filter((r) => !r.status || r.status === 'new').length;

  const savePriority = async (priorityId: string) => {
    if (!issue || !priorityId || priorityId === prio) return;
    if (priorityId === 'critical' && !canTicketAction('escalate') && !canTicketAction('change_priority')) {
      setPrioSevError('You do not have permission to set critical priority');
      return;
    }
    setSavingPriority(true);
    setPrioSevError('');
    try {
      const updated = await updateIssue(issue._id, { priorityId });
      applyIssue(updated);
      const reloaded = await fetchIssue(issue._id);
      applyIssue(reloaded);
    } catch (err) {
      setPrioSevError(err instanceof Error ? err.message : 'Failed to update priority');
    } finally {
      setSavingPriority(false);
    }
  };

  const saveSeverity = async (severityId: string) => {
    if (!issue || !severityId || severityId === (issue.severityId || '')) return;
    setSavingSeverity(true);
    setPrioSevError('');
    try {
      const updated = await updateIssue(issue._id, { severityId });
      applyIssue(updated);
      const reloaded = await fetchIssue(issue._id);
      applyIssue(reloaded);
    } catch (err) {
      setPrioSevError(err instanceof Error ? err.message : 'Failed to update severity');
    } finally {
      setSavingSeverity(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/issues" className="text-xs text-blue-400 hover:text-blue-300 no-underline">
          ← Back to tickets
        </Link>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/issues/automation"
            className="text-xs text-gray-500 hover:text-gray-300 no-underline"
          >
            Automation & Escalations
          </Link>
          <Link
            href="/dashboard/issues/settings"
            className="text-xs text-gray-500 hover:text-gray-300 no-underline"
          >
            Configuration
          </Link>
        </div>
      </div>

      {isActiveEsc && (
          <div
            className={`rounded-xl border px-4 py-3 ${
              escStatus === 'escalated'
                ? 'border-rose-700/50 bg-rose-950/30'
                : 'border-amber-700/40 bg-amber-950/20'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded border ${
                  escStatus === 'escalated'
                    ? 'border-rose-600/50 bg-rose-900/40 text-rose-200'
                    : 'border-amber-600/40 bg-amber-900/30 text-amber-200'
                }`}
              >
                <span aria-hidden>{escStatus === 'escalated' ? '🔴' : '⚠'}</span>
                {escStatus === 'escalated'
                  ? `Escalated — Level ${issue.escalation?.level || 1}`
                  : `SLA warning — Level ${issue.escalation?.level || 1}`}
              </span>
              {issue.sla?.breached && (
                <span className="text-[10px] uppercase tracking-wide text-rose-400/90">
                  SLA breached
                </span>
              )}
            </div>
            {issue.escalation?.lastReason && (
              <p className="text-sm text-gray-200 mt-2">
                Reason: {issue.escalation.lastReason}
              </p>
            )}
            {issue.escalation?.lastTargetLabel && (
              <p className="text-xs text-gray-400 mt-1">
                Escalated to: {issue.escalation.lastTargetLabel}
              </p>
            )}
            {issue.escalation?.lastFiredAt && (
              <p className="text-xs text-gray-500 mt-1">
                Time:{' '}
                {new Date(issue.escalation.lastFiredAt).toLocaleString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
        )}

      {wasEscalated && !isActiveEsc && (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border border-gray-600/50 bg-gray-800/60 text-gray-300">
            Was escalated
            {(issue.escalation?.level || 0) > 0 ? ` — Level ${issue.escalation?.level}` : ''}
          </span>
          {issue.escalation?.lastTargetLabel && (
            <p className="text-xs text-gray-500 mt-1.5">
              Previously escalated to: {issue.escalation.lastTargetLabel}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-mono text-gray-400">{issue.ticketId}</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded border" style={badgeStyle(statusOpt?.color)}>
                {statusLabel(config, sid)}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] rounded border" style={badgeStyle(prioOpt?.color)}>
                {prioOpt?.name || prio}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-100 mt-1">{issue.title}</h1>
            <p className="text-xs text-gray-500 mt-2">
              Assigned to {personDisplay}
              {teamDisplay !== 'Unassigned' ? ` · ${teamDisplay}` : ''}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {reportCount} Report{reportCount === 1 ? '' : 's'}
              {newReportCount > 0 ? (
                <span className="text-amber-300/90"> · {newReportCount} New</span>
              ) : null}
              {issue.slaLabel && issue.slaLabel !== '—' ? (
                <span className="text-gray-600"> · SLA {issue.slaLabel}</span>
              ) : null}
            </p>
            {issue.description && (
              <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{issue.description}</p>
            )}
            {(issue.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(issue.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-gray-700/60 bg-gray-800/50 text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {canTransition && (
        <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
            Transitions
          </p>
          <p className="text-[11px] text-gray-600 mb-2">
            Status changes only — team and person assignment are separate. Assigned requires a
            handler first.
          </p>
          {(issue.allowedTransitions || []).length === 0 ? (
            <p className="text-xs text-gray-600">No further transitions from this status.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(issue.allowedTransitions || [])
                .filter((t) => t?.to)
                .map((t) => {
                const toId = String(t.to);
                const toOpt = config?.statuses?.find((s) => s.id === toId);
                const needsHandler = toId === 'assigned' && !hasHandler;
                return (
                  <button
                    key={`${t.from || ''}-${toId}`}
                    type="button"
                    title={
                      needsHandler
                        ? 'Assign a handler before setting status to Assigned'
                        : undefined
                    }
                    disabled={needsHandler}
                    onClick={() => {
                      if (needsHandler) {
                        setTransitionError(
                          'Assign a handler before setting status to Assigned'
                        );
                        return;
                      }
                      setSelected(t);
                      setReason('');
                      setExtraNotes('');
                      setTransitionError('');
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed`}
                    style={badgeStyle(toOpt?.color)}
                  >
                    Move to {toOpt?.name || toId.replace(/_/g, ' ')}
                    {t.requireReason ? ' · reason required' : ''}
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="mt-3 pt-3 border-t border-gray-800/60 space-y-2">
              <p className="text-xs text-gray-300">
                Transition to{' '}
                <span className="font-semibold">
                  {config?.statuses?.find((s) => s.id === selected.to)?.name ||
                    String(selected.to || '').replace(/_/g, ' ') ||
                    '—'}
                </span>
              </p>
              {(selected.requireReason ||
                selected.requiredFields?.some((f) => f.startsWith('resolution')) ||
                selected.requiredFields?.some((f) => f.startsWith('verification'))) && (
                <textarea
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                  rows={3}
                  placeholder={
                    selected.requiredFields?.some((f) => f.startsWith('resolution'))
                      ? 'Resolution details (required)'
                      : selected.requiredFields?.some((f) => f.startsWith('verification'))
                        ? 'Verification notes (required)'
                        : 'Reason (required)'
                  }
                  value={selected.requiredFields?.length ? extraNotes || reason : reason}
                  onChange={(e) => {
                    if (selected.requiredFields?.length) {
                      setExtraNotes(e.target.value);
                      setReason(e.target.value);
                    } else {
                      setReason(e.target.value);
                    }
                  }}
                />
              )}
              {transitionError && <p className="text-[11px] text-red-400">{transitionError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={transitioning}
                  onClick={runTransition}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
                >
                  {transitioning ? 'Updating…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {canManualEscalate && (
        <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-400/80 mb-1">
                Escalation
              </p>
              <p className="text-[11px] text-gray-500">
                Manually escalate with a reason and reassign to a user (optional team/department).
              </p>
            </div>
            {!showEscalate && (
              <button
                type="button"
                onClick={() => {
                  setShowEscalate(true);
                  setEscalateError('');
                  setEscPriorityId(prio === 'critical' ? prio : 'critical');
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-600/50 bg-rose-900/30 text-rose-200"
              >
                Escalate ticket
              </button>
            )}
          </div>

          {showEscalate && (
            <form onSubmit={submitManualEscalate} className="mt-3 pt-3 border-t border-rose-900/40 space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Reason (required)
                </label>
                <textarea
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                  rows={3}
                  required
                  value={escReason}
                  onChange={(e) => setEscReason(e.target.value)}
                  placeholder="Why is this ticket being escalated?"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                    User (required)
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                    required
                    value={escUserId}
                    onChange={(e) => setEscUserId(e.target.value)}
                  >
                    <option value="">Select user…</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                        {u.email ? ` (${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Team (optional)
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                    value={escTeamId}
                    onChange={(e) => setEscTeamId(e.target.value)}
                  >
                    <option value="">—</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Department (optional)
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                    value={escDeptId}
                    onChange={(e) => setEscDeptId(e.target.value)}
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={escBumpPriority}
                  onChange={(e) => setEscBumpPriority(e.target.checked)}
                />
                Increase priority
              </label>
              {escBumpPriority && (
                <div className="max-w-xs">
                  <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                    New priority
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                    value={escPriorityId}
                    onChange={(e) => setEscPriorityId(e.target.value)}
                    required={escBumpPriority}
                  >
                    {(config?.priorities || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {escalateError && <p className="text-[11px] text-red-400">{escalateError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={escalating || !escReason.trim() || !escUserId}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-600/50 bg-rose-900/40 text-rose-100 disabled:opacity-50"
                >
                  {escalating ? 'Escalating…' : 'Confirm escalation'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEscalate(false)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <DetailTile label="Type" value={typeOpt?.name || issue.issueTypeId || issue.category || '—'} />
              {canChangePriority ? (
                <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Priority</p>
                  <select
                    className="mt-0.5 w-full text-xs bg-transparent text-gray-200 border-0 p-0 focus:ring-0"
                    value={prio}
                    disabled={savingPriority}
                    onChange={(e) => savePriority(e.target.value)}
                  >
                    {(config?.priorities || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    {!(config?.priorities || []).some((p) => p.id === prio) && (
                      <option value={prio}>{prioOpt?.name || prio}</option>
                    )}
                  </select>
                </div>
              ) : (
                <DetailTile label="Priority" value={prioOpt?.name || prio} />
              )}
              {canChangeSeverity ? (
                <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Severity</p>
                  <select
                    className="mt-0.5 w-full text-xs bg-transparent text-gray-200 border-0 p-0 focus:ring-0"
                    value={issue.severityId || ''}
                    disabled={savingSeverity}
                    onChange={(e) => saveSeverity(e.target.value)}
                  >
                    <option value="">—</option>
                    {(config?.severities || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <DetailTile
                  label="Severity"
                  value={
                    config?.severities?.find((s) => s.id === issue.severityId)?.name ||
                    issue.severityId ||
                    '—'
                  }
                />
              )}
              <DetailTile label="Department" value={deptDisplay} />
              <DetailTile label="Team" value={teamDisplay} />
              <DetailTile label="Handler" value={personDisplay} />
              <DetailTile label="Reporter" value={issue.reporterName || '—'} />
              <DetailTile label="Created" value={formatOrgDateTime(issue.createdAt)} />
              <DetailTile
                label="Due"
                value={issue.dueAt ? formatOrgDateTime(issue.dueAt) : 'Not set'}
              />
            </div>
            {prioSevError && <p className="text-[11px] text-red-400 mt-2">{prioSevError}</p>}
            {issue.customFields && Object.keys(issue.customFields).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800/60 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(issue.customFields).map(([key, val]) => (
                  <DetailTile
                    key={key}
                    label={key.replace(/_/g, ' ')}
                    value={Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                  />
                ))}
              </div>
            )}
          </div>

          {(issue.resolution?.notes ||
            issue.resolutionNotes ||
            issue.resolution?.resolvedAt ||
            issue.resolvedAt) && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/80 mb-1">
                Resolution
              </p>
              {(issue.resolution?.notes || issue.resolutionNotes) && (
                <p className="text-sm text-gray-200 whitespace-pre-wrap">
                  {issue.resolution?.notes || issue.resolutionNotes}
                </p>
              )}
              <p className="text-[11px] text-gray-500 mt-2">
                {issue.resolution?.resolvedBy?.name ||
                  issue.resolvedBy?.name ||
                  'Unknown user'}
                {(issue.resolution?.resolvedAt || issue.resolvedAt) && (
                  <>
                    {' · '}
                    {formatOrgDateTime(issue.resolution?.resolvedAt || issue.resolvedAt)}
                  </>
                )}
              </p>
            </div>
          )}

          {(issue.verification?.notes ||
            issue.verification?.verifiedAt ||
            issue.verification?.verifiedBy) && (
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-400/80 mb-1">
                Verification
              </p>
              {issue.verification?.notes && (
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{issue.verification.notes}</p>
              )}
              <p className="text-[11px] text-gray-500 mt-2">
                {issue.verification?.verifiedBy?.name || 'Unknown user'}
                {issue.verification?.verifiedAt && (
                  <>
                    {' · '}
                    {formatOrgDateTime(issue.verification.verifiedAt)}
                  </>
                )}
              </p>
            </div>
          )}

          {issue.reports && issue.reports.length > 0 && (
            <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  Reports ({issue.reports.length}
                  {newReportCount > 0 ? ` · ${newReportCount} new` : ''})
                </p>
              </div>
              {reportError && <p className="text-[11px] text-red-400 mb-2">{reportError}</p>}
              <div className="space-y-2">
                {issue.reports.map((r, i) => {
                  const key = r.reportId || r._id || String(i);
                  const isNew = !r.status || r.status === 'new';
                  return (
                    <div key={key} className="rounded-lg border border-gray-800/50 px-3 py-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {r.reportId && (
                              <span className="text-[11px] font-mono text-gray-500">{r.reportId}</span>
                            )}
                            {isNew ? (
                              <span className="px-1.5 py-0.5 text-[9px] rounded border border-amber-500/40 bg-amber-500/10 text-amber-200">
                                New
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[9px] rounded border border-gray-700/60 text-gray-500">
                                Acknowledged
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-300 font-medium mt-1">{r.reporterName}</p>
                          <p className="text-[11px] text-gray-500">
                            {[r.reporterEmail, r.reporterPhone].filter(Boolean).join(' · ')}
                            {r.createdAt ? ` · ${formatOrgDateTime(r.createdAt)}` : ''}
                          </p>
                        </div>
                        {isNew && canComment && (
                          <button
                            type="button"
                            disabled={acknowledgingReportId === key}
                            onClick={() => acknowledgeReport(r.reportId || r._id || '')}
                            className="text-[11px] px-2 py-1 rounded border border-gray-700/60 text-gray-300 hover:bg-gray-800/60 disabled:opacity-50"
                          >
                            {acknowledgingReportId === key ? '…' : 'Mark acknowledged'}
                          </button>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-[11px] text-gray-400 mt-2 whitespace-pre-wrap">{r.description}</p>
                      )}
                      {(r.followUps || []).length > 0 && (
                        <div className="mt-2 space-y-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-300/90">
                            Still a problem
                          </p>
                          {r.followUps!.map((f, fi) => (
                            <div key={f._id || fi} className="border-t border-amber-500/10 pt-1.5 first:border-0 first:pt-0">
                              <p className="text-[11px] text-gray-300 whitespace-pre-wrap">{f.note}</p>
                              {f.createdAt && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {formatOrgDateTime(f.createdAt)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {(r.photos || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {r.photos!.map((p, pi) => (
                            <a key={pi} href={p.url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.url}
                                alt=""
                                className="h-14 w-14 object-cover rounded border border-gray-700/60"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      {!isNew && r.acknowledgedAt && (
                        <p className="text-[10px] text-gray-600 mt-2">
                          Acknowledged
                          {r.acknowledgedBy?.name ? ` by ${r.acknowledgedBy.name}` : ''}
                          {' · '}
                          {formatOrgDateTime(r.acknowledgedAt)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Related contact persons
            </p>
            <p className="text-[11px] text-gray-600 mb-3">
              People linked to this ticket with a short note on how they relate (not the handler).
            </p>
            {(issue.relatedPersons || []).length === 0 ? (
              <p className="text-xs text-gray-600 mb-3">No related contacts yet.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {(issue.relatedPersons || []).map((rp) => (
                  <div
                    key={rp._id}
                    className="rounded-lg border border-gray-800/50 px-3 py-2 flex flex-wrap items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-gray-200 font-medium">
                        {rp.name}
                        <span className="ml-1.5 text-[10px] text-gray-500 font-normal">
                          {rp.kind === 'partnerContact' ? 'Partner contact' : 'Contact'}
                          {rp.company ? ` · ${rp.company}` : ''}
                          {rp.role ? ` · ${rp.role}` : ''}
                        </span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{rp.relation}</p>
                      {(rp.email || rp.phone) && (
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {[rp.email, rp.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    {canAssign && (
                      <button
                        type="button"
                        disabled={savingRelated}
                        onClick={() => removeRelated(rp._id)}
                        className="text-[11px] text-gray-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canAssign && (
              <div className="pt-2 border-t border-gray-800/60 space-y-2">
                <label className="block text-[10px] text-gray-500 uppercase tracking-wide">
                  Add contact person
                </label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                  value={relatedKey}
                  onChange={(e) => setRelatedKey(e.target.value)}
                >
                  <option value="">Select contact…</option>
                  {orgContactOpts.length > 0 && (
                    <optgroup label="Org contacts">
                      {orgContactOpts.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.name}
                          {o.role ? ` · ${o.role}` : ''}
                          {o.company ? ` · ${o.company}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {partnerContactOpts.length > 0 && (
                    <optgroup label="Asset partner contacts">
                      {partnerContactOpts.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.name}
                          {o.partnerName ? ` · ${o.partnerName}` : ''}
                          {o.role ? ` · ${o.role}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                  placeholder="How are they related? e.g. Vendor technician, Site contact"
                  value={relatedRelation}
                  onChange={(e) => setRelatedRelation(e.target.value)}
                />
                {relatedError && <p className="text-[11px] text-red-400">{relatedError}</p>}
                {relatedOptions.length === 0 && (
                  <p className="text-[11px] text-gray-600">
                    No org contacts or asset partner contacts available.{' '}
                    <Link href="/dashboard/issues/contacts" className="text-blue-400 no-underline">
                      Add contacts
                    </Link>
                  </p>
                )}
                <button
                  type="button"
                  disabled={savingRelated || !relatedKey || !relatedRelation.trim()}
                  onClick={addRelated}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
                >
                  {savingRelated ? 'Adding…' : 'Add related contact'}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
              Comments
            </p>
            {canComment && (
              <div className="mb-3 space-y-2">
                <textarea
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                  rows={3}
                  placeholder="Add a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                {commentError && <p className="text-[11px] text-red-400">{commentError}</p>}
                <button
                  type="button"
                  disabled={savingComment || !commentText.trim()}
                  onClick={submitComment}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
                >
                  {savingComment ? 'Posting…' : 'Post comment'}
                </button>
              </div>
            )}
            {comments.length === 0 ? (
              <p className="text-xs text-gray-600">No comments yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {comments.map((a) => (
                  <div key={a._id} className="rounded-lg border border-gray-800/50 px-3 py-2">
                    <p className="text-xs text-gray-200 whitespace-pre-wrap">{a.reason}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {a.actorName || a.actorUserId?.name || 'User'}
                      {' · '}
                      {formatOrgDateTime(a.at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80 mb-3">
              Internal notes
            </p>
            {canNote && (
              <div className="mb-3 space-y-2">
                <textarea
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                  rows={3}
                  placeholder="Add an internal note (staff only)…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                {noteError && <p className="text-[11px] text-red-400">{noteError}</p>}
                <button
                  type="button"
                  disabled={savingNote || !noteText.trim()}
                  onClick={submitNote}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-amber-500/40 bg-amber-600/20 text-amber-100 disabled:opacity-50"
                >
                  {savingNote ? 'Saving…' : 'Add note'}
                </button>
              </div>
            )}
            {internalNotes.length === 0 ? (
              <p className="text-xs text-gray-600">No internal notes yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {internalNotes.map((a) => (
                  <div key={a._id} className="rounded-lg border border-amber-500/20 px-3 py-2">
                    <p className="text-xs text-gray-200 whitespace-pre-wrap">{a.reason}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {a.actorName || a.actorUserId?.name || 'User'}
                      {' · '}
                      {formatOrgDateTime(a.at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
              Activity timeline
            </p>
            {timeline.length === 0 ? (
              <p className="text-xs text-gray-600">No activity yet.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto pr-1">
                <ol className="relative border-l border-gray-800 ml-2 space-y-3 py-1">
                  {timeline.map((a) => (
                    <li key={a._id} className="ml-4">
                      <div
                        className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border ${
                          a.type === 'escalated'
                            ? 'border-rose-500 bg-rose-600'
                            : a.type === 'auto_assigned'
                              ? 'border-blue-500 bg-blue-600'
                              : 'border-gray-700 bg-gray-800'
                        }`}
                      />
                      <p
                        className={`text-xs font-medium capitalize ${
                          a.type === 'escalated' ? 'text-rose-200' : 'text-gray-200'
                        }`}
                      >
                        {activityTitle(a)}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {a.actorName || a.actorUserId?.name || a.actorKind || 'System'}
                        {' · '}
                        {formatOrgDateTime(a.at)}
                      </p>
                      {a.to &&
                        (a.type === 'assigned' ||
                          a.type === 'auto_assigned' ||
                          a.type === 'escalated') && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{a.to}</p>
                        )}
                      {a.to &&
                        a.type === 'field_updated' &&
                        Array.isArray((a.meta as { fields?: string[] } | undefined)?.fields) &&
                        (a.meta as { fields: string[] }).fields.includes('relatedPersons') && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {a.to}
                            {a.reason ? ` — ${a.reason}` : ''}
                          </p>
                        )}
                      {a.reason &&
                        a.type !== 'comment' &&
                        a.type !== 'escalated' &&
                        !(
                          a.type === 'field_updated' &&
                          Array.isArray((a.meta as { fields?: string[] } | undefined)?.fields) &&
                          (a.meta as { fields: string[] }).fields.includes('relatedPersons')
                        ) && (
                        <p className="text-[11px] text-gray-400 mt-1">Reason: {a.reason}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Asset</p>
            {issue.assetId ? (
              <div className="space-y-2">
                <DetailTile label="Name" value={issue.assetId.name} />
                <DetailTile label="ID" value={issue.assetId.assetId} />
                <DetailTile label="Category" value={issue.assetId.category || '—'} />
                <DetailTile label="Status" value={issue.assetId.status || '—'} />
                <Link
                  href={`/dashboard/assets/${issue.assetId._id}`}
                  className="inline-block text-xs text-blue-400 hover:text-blue-300 no-underline mt-1"
                >
                  Open asset →
                </Link>
              </div>
            ) : (
              <p className="text-xs text-gray-600">No linked asset</p>
            )}
          </div>

          {canTags && (
            <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(issue.tags || []).length === 0 ? (
                  <p className="text-xs text-gray-600">No tags</p>
                ) : (
                  (issue.tags || []).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      disabled={savingTags}
                      onClick={() => removeTag(tag)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-gray-700/60 bg-gray-800/50 text-gray-300 hover:border-red-500/40 hover:text-red-300"
                      title="Remove tag"
                    >
                      {tag} ×
                    </button>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                  placeholder="Add tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={savingTags || !tagInput.trim()}
                  onClick={addTag}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {tagError && <p className="text-[11px] text-red-400 mt-1">{tagError}</p>}
            </div>
          )}

          {canDue && (
            <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                Due date / time
              </p>
              <input
                type="datetime-local"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 mb-2"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
              />
              {dueError && <p className="text-[11px] text-red-400 mb-2">{dueError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={savingDue || !dueSelected}
                  onClick={saveDue}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
                >
                  {savingDue ? 'Saving…' : 'Save due'}
                </button>
                <button
                  type="button"
                  disabled={savingDue || !issue.dueAt}
                  onClick={clearDue}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-400 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {canAssign && (
            <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                Assignment
              </p>
              <p className="text-[11px] text-gray-500 mb-3">
                Department comes from Locations → Departments. Team and handler can be set separately.
                Contacts belong in related contact persons.
              </p>

              <p className="text-[11px] text-gray-400 mb-1">
                Current department: <span className="text-gray-200">{deptDisplay}</span>
              </p>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                Department
              </label>
              <select
                className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 mb-2"
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
              >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                    {d.locationPath ? ` · ${d.locationPath}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={assigningDept}
                onClick={saveDepartment}
                className="mb-3 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
              >
                {assigningDept ? 'Saving…' : 'Save department'}
              </button>

              <p className="text-[11px] text-gray-400 mb-1">
                Current team: <span className="text-gray-200">{teamDisplay}</span>
              </p>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Team</label>
              <select
                className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 mb-2"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">No team</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={assigningTeam}
                onClick={saveTeam}
                className="mb-3 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
              >
                {assigningTeam ? 'Saving…' : 'Save team'}
              </button>

              <p className="text-[11px] text-gray-400 mb-1">
                Current handler: <span className="text-gray-200">{personDisplay}</span>
              </p>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                Handler (org user)
              </label>
              <select
                className="w-full px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 mb-2"
                value={personKey}
                onChange={(e) => setPersonKey(e.target.value)}
              >
                <option value="">No handler</option>
                {personOptions.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              {assignError && <p className="text-[11px] text-red-400 mb-2">{assignError}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={assigningPerson}
                  onClick={savePerson}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
                >
                  {assigningPerson ? 'Saving…' : 'Save handler'}
                </button>
                <button
                  type="button"
                  disabled={assigningDept || assigningTeam || assigningPerson}
                  onClick={clearAllAssignment}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-400"
                >
                  Clear all
                </button>
              </div>
              <Link
                href="/dashboard/locations"
                className="block mt-2 text-[11px] text-gray-500 hover:text-gray-300 no-underline"
              >
                Manage departments (Locations) →
              </Link>
              <Link
                href="/dashboard/issues/contacts"
                className="block mt-1 text-[11px] text-gray-500 hover:text-gray-300 no-underline"
              >
                Manage contacts & teams →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
