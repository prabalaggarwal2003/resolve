'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatOrgDate } from '@/lib/orgTimezone';
import {
  fetchAssignees,
  fetchIssueConfig,
  fetchIssues,
  statusLabel,
  type IssueOrgConfig,
  type IssueTicket,
} from '@/lib/issues';

function badgeStyle(color?: string) {
  const c = color || '#6b7280';
  return {
    color: c,
    backgroundColor: `${c}22`,
    borderColor: `${c}55`,
  } as React.CSSProperties;
}

const selectClass =
  'px-2 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-300 focus:ring-1 focus:ring-blue-500/40 max-w-[11rem]';
const inputClass =
  'px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500/40 min-w-[10rem]';

type SortKey =
  | 'createdAt'
  | 'updatedAt'
  | 'dueAt'
  | 'priority'
  | 'ticketId'
  | 'title'
  | 'status'
  | 'reports'
  | 'newReports';

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'createdAt', label: 'Created' },
  { id: 'updatedAt', label: 'Updated' },
  { id: 'dueAt', label: 'Due date' },
  { id: 'priority', label: 'Priority' },
  { id: 'reports', label: 'Reports' },
  { id: 'newReports', label: 'New reports' },
  { id: 'ticketId', label: 'Ticket ID' },
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
];

function SortHeader({
  label,
  column,
  sort,
  order,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: SortKey;
  order: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const active = sort === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`font-medium uppercase tracking-wide hover:text-gray-300 ${
        active ? 'text-blue-300' : 'text-gray-500'
      }`}
    >
      {label}
      {active ? (order === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

export default function IssuesPage() {
  const [scope, setScope] = useState<'my' | 'all'>('all');
  const [status, setStatus] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [severityId, setSeverityId] = useState('');
  const [issueTypeId, setIssueTypeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [handlerId, setHandlerId] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [escalationStatus, setEscalationStatus] = useState('');
  const [escalationLevel, setEscalationLevel] = useState('');
  const [escalatedTo, setEscalatedTo] = useState('');
  const [hasNewReports, setHasNewReports] = useState(false);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [sort, setSort] = useState<SortKey>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const [issues, setIssues] = useState<IssueTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [config, setConfig] = useState<IssueOrgConfig | null>(null);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ _id: string; name: string }[]>([]);
  const [handlers, setHandlers] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    fetchAssignees()
      .then((data) => {
        setDepartments((data.departments || []).map((d) => ({ _id: d._id, name: d.name })));
        setTeams((data.groups || []).map((g) => ({ _id: g._id, name: g.name })));
        setHandlers((data.users || []).map((u) => ({ _id: u._id, name: u.name })));
      })
      .catch(() => {
        /* filters still work without option lists */
      });
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cfg, list] = await Promise.all([
        fetchIssueConfig(),
        fetchIssues({
          scope,
          status: status || undefined,
          priorityId: priorityId || undefined,
          severityId: severityId || undefined,
          issueTypeId: issueTypeId || undefined,
          departmentId: departmentId || undefined,
          teamId: teamId || undefined,
          handlerId: unassigned ? undefined : handlerId || undefined,
          unassigned: unassigned ? 'true' : undefined,
          escalationStatus: escalationStatus || undefined,
          escalationLevel: escalationLevel || undefined,
          escalatedTo: escalatedTo || undefined,
          hasNewReports: hasNewReports ? 'true' : undefined,
          q: qDebounced || undefined,
          sort,
          order,
          page,
          limit: PAGE_SIZE,
        }),
      ]);
      setConfig(cfg.config);
      setIssues(list.issues);
      setTotal(list.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scope,
    status,
    priorityId,
    severityId,
    issueTypeId,
    departmentId,
    teamId,
    handlerId,
    unassigned,
    escalationStatus,
    escalationLevel,
    escalatedTo,
    hasNewReports,
    qDebounced,
    sort,
    order,
    page,
  ]);

  // Reset to first page when filters/sort change
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scope,
    status,
    priorityId,
    severityId,
    issueTypeId,
    departmentId,
    teamId,
    handlerId,
    unassigned,
    escalationStatus,
    escalationLevel,
    escalatedTo,
    hasNewReports,
    qDebounced,
    sort,
    order,
  ]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (status) n += 1;
    if (priorityId) n += 1;
    if (severityId) n += 1;
    if (issueTypeId) n += 1;
    if (departmentId) n += 1;
    if (teamId) n += 1;
    if (handlerId || unassigned) n += 1;
    if (escalationStatus) n += 1;
    if (escalationLevel) n += 1;
    if (escalatedTo) n += 1;
    if (hasNewReports) n += 1;
    if (qDebounced) n += 1;
    return n;
  }, [
    status,
    priorityId,
    severityId,
    issueTypeId,
    departmentId,
    teamId,
    handlerId,
    unassigned,
    escalationStatus,
    escalationLevel,
    escalatedTo,
    hasNewReports,
    qDebounced,
  ]);

  const clearFilters = () => {
    setStatus('');
    setPriorityId('');
    setSeverityId('');
    setIssueTypeId('');
    setDepartmentId('');
    setTeamId('');
    setHandlerId('');
    setUnassigned(false);
    setEscalationStatus('');
    setEscalationLevel('');
    setEscalatedTo('');
    setHasNewReports(false);
    setQ('');
    setQDebounced('');
  };

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setOrder(key === 'dueAt' || key === 'title' || key === 'ticketId' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Workflow-driven issue tickets for your organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/issues/employees"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 hover:bg-gray-800/60 no-underline"
          >
            Employees
          </Link>
          <Link
            href="/dashboard/issues/contacts"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 hover:bg-gray-800/60 no-underline"
          >
            Contacts
          </Link>
          <Link
            href="/dashboard/issues/automation"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 hover:bg-gray-800/60 no-underline"
          >
            Automation & Escalations
          </Link>
          <Link
            href="/dashboard/issues/settings"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 hover:bg-gray-800/60 no-underline"
          >
            Configuration
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: 'All Tickets' },
            { id: 'my', label: 'My Tickets' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScope(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              scope === tab.id
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : 'border-gray-700/60 text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-3 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={inputClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ticket, title, reporter…"
          />
          <select
            className={selectClass}
            value={issueTypeId}
            onChange={(e) => setIssueTypeId(e.target.value)}
          >
            <option value="">All types</option>
            {(config?.issueTypes || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={priorityId}
            onChange={(e) => setPriorityId(e.target.value)}
          >
            <option value="">All priorities</option>
            {(config?.priorities || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={severityId}
            onChange={(e) => setSeverityId(e.target.value)}
          >
            <option value="">All severities</option>
            {(config?.severities || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className={selectClass} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={unassigned ? '__unassigned__' : handlerId}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__unassigned__') {
                setUnassigned(true);
                setHandlerId('');
              } else {
                setUnassigned(false);
                setHandlerId(v);
              }
            }}
          >
            <option value="">All handlers</option>
            <option value="__unassigned__">Unassigned</option>
            {handlers.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={escalationStatus}
            onChange={(e) => setEscalationStatus(e.target.value)}
          >
            <option value="">All escalation</option>
            <option value="none">Not escalated</option>
            <option value="warned">Warned</option>
            <option value="escalated">Escalated</option>
            <option value="was_escalated">Was escalated</option>
          </select>
          <select
            className={selectClass}
            value={escalationLevel}
            onChange={(e) => setEscalationLevel(e.target.value)}
          >
            <option value="">All levels</option>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <option key={lvl} value={String(lvl)}>
                Level {lvl}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={escalatedTo}
            onChange={(e) => setEscalatedTo(e.target.value)}
          >
            <option value="">Escalated to anyone</option>
            {handlers.map((h) => (
              <option key={`esc-${h._id}`} value={h._id}>
                Escalated to {h.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 px-1">
            <input
              type="checkbox"
              checked={hasNewReports}
              onChange={(e) => setHasNewReports(e.target.checked)}
            />
            New reports
          </label>
          <select
            className={selectClass}
            value={`${sort}:${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
              setSort(s);
              setOrder(o);
            }}
          >
            {SORT_OPTIONS.flatMap((opt) => [
              <option key={`${opt.id}:desc`} value={`${opt.id}:desc`}>
                Sort: {opt.label} ↓
              </option>,
              <option key={`${opt.id}:asc`} value={`${opt.id}:asc`}>
                Sort: {opt.label} ↑
              </option>,
            ])}
          </select>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700/60 text-gray-400 hover:text-gray-200"
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatus('')}
            className={`px-2.5 py-1 text-xs rounded-lg border ${
              !status
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : 'border-gray-700/60 text-gray-400'
            }`}
          >
            All statuses ({total})
          </button>
          {(config?.statuses || []).map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.id}
              onClick={() => setStatus(s.id === status ? '' : s.id)}
              className={`px-2.5 py-1 text-xs rounded-lg border ${
                status === s.id ? 'ring-1 ring-blue-400/40' : ''
              }`}
              style={badgeStyle(s.color)}
            >
              {s.name || s.id}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading tickets..." />
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : issues.length === 0 ? (
        <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-10 text-center text-sm text-gray-500">
          No tickets match this view.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800/60">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-900/80 text-[10px]">
              <tr>
                <th className="px-3 py-2">
                  <SortHeader label="Ticket" column="ticketId" sort={sort} order={order} onSort={toggleSort} />
                </th>
                <th className="px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Asset</th>
                <th className="px-3 py-2">
                  <SortHeader label="Issue" column="title" sort={sort} order={order} onSort={toggleSort} />
                </th>
                <th className="px-3 py-2">
                  <SortHeader label="Status" column="status" sort={sort} order={order} onSort={toggleSort} />
                </th>
                <th className="px-3 py-2">
                  <SortHeader label="Priority" column="priority" sort={sort} order={order} onSort={toggleSort} />
                </th>
                <th className="px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Dept</th>
                <th className="px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Team</th>
                <th className="px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Handler</th>
                <th className="px-3 py-2">
                  <SortHeader label="Reports" column="reports" sort={sort} order={order} onSort={toggleSort} />
                </th>
                <th className="px-3 py-2">
                  <SortHeader label="SLA" column="dueAt" sort={sort} order={order} onSort={toggleSort} />
                </th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => {
                const sid = issue.statusId || issue.status;
                const statusOpt = config?.statuses?.find((s) => s.id === sid);
                const prio = issue.priorityId || issue.priority || '';
                const prioOpt = config?.priorities?.find((p) => p.id === prio);
                const reportCount = issue.reportCount ?? issue.reports?.length ?? 0;
                const newCount =
                  issue.newReportCount ??
                  (issue.reports || []).filter((r) => !r.status || r.status === 'new').length;
                const reportsLabel =
                  reportCount === 0
                    ? '—'
                    : newCount > 0
                      ? `${reportCount} (${newCount} new)`
                      : String(reportCount);
                return (
                  <tr key={issue._id} className="border-t border-gray-800/60 hover:bg-gray-900/40">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/dashboard/issues/${issue._id}`}
                        className="font-mono text-gray-300 hover:text-blue-300 no-underline"
                      >
                        {issue.ticketId}
                      </Link>
                      <p className="text-[10px] text-gray-600 mt-0.5">{formatOrgDate(issue.createdAt)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 max-w-[9rem] truncate">
                      {issue.assetId?.assetId || '—'}
                      {issue.assetId?.name ? (
                        <span className="block text-[10px] text-gray-600 truncate">{issue.assetId.name}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-gray-200 max-w-[14rem]">
                      <Link
                        href={`/dashboard/issues/${issue._id}`}
                        className="text-gray-100 hover:text-blue-300 no-underline line-clamp-2"
                      >
                        {issue.title}
                      </Link>
                      {issue.issueTypeId && (
                        <p className="text-[10px] text-gray-600 mt-0.5 capitalize">
                          {(config?.issueTypes || []).find((t) => t.id === issue.issueTypeId)?.name ||
                            issue.issueTypeId}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className="px-1.5 py-0.5 text-[10px] rounded border capitalize"
                          style={badgeStyle(statusOpt?.color)}
                        >
                          {statusLabel(config, sid)}
                        </span>
                        {issue.escalation?.status === 'escalated' ? (
                          <span className="px-1.5 py-0.5 text-[10px] rounded border border-rose-700/50 bg-rose-950/40 text-rose-200">
                            🔴 L{issue.escalation?.level || 1}
                          </span>
                        ) : issue.escalation?.status === 'warned' ? (
                          <span className="px-1.5 py-0.5 text-[10px] rounded border border-amber-700/40 text-amber-200">
                            SLA warn
                          </span>
                        ) : issue.escalation?.status === 'was_escalated' ? (
                          <span className="px-1.5 py-0.5 text-[10px] rounded border border-gray-600/50 bg-gray-800/50 text-gray-400">
                            Was escalated
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {prio ? (
                        <span
                          className="px-1.5 py-0.5 text-[10px] rounded border capitalize"
                          style={badgeStyle(prioOpt?.color)}
                        >
                          {prioOpt?.name || prio}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap max-w-[8rem] truncate">
                      {issue.assigneeDepartmentId?.name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap max-w-[8rem] truncate">
                      {issue.assigneeGroupId?.name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap max-w-[8rem] truncate">
                      {(issue.assignedTo || issue.assigneeUserId)?.name || 'Unassigned'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">
                      {reportsLabel}
                      {newCount > 0 ? <span className="text-amber-300/80"> </span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{issue.slaLabel || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3 py-2 border-t border-gray-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-gray-700/60 text-gray-400 hover:text-gray-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-gray-400">
                Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(total / PAGE_SIZE) || loading || total === 0}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded-lg border border-gray-700/60 text-gray-400 hover:text-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
