'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_COLORS,
  AUDIT_RESOURCE_ICONS,
  AUDIT_RESOURCE_LABELS,
} from '@/lib/auditLabels';

type FieldChange = {
  field: string;
  label: string;
  oldValue?: string;
  newValue?: string;
  from?: string;
  to?: string;
};

type AuditLog = {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  action: string;
  resource: string;
  resourceId: string;
  resourceName?: string;
  description?: string;
  details?: {
    fileName?: string;
    fieldChanges?: FieldChange[];
    summary?: string;
    changes?: Record<string, { old: unknown; new: unknown }>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress?: string;
  createdAt: string;
};

type AuditStats = {
  totalLogs: number;
  resourceStats: Array<{ _id: string; count: number }>;
  actionStats: Array<{ _id: string; count: number }>;
  severityStats: Array<{ _id: string; count: number }>;
  topUsers: Array<{ _id: string; count: number; user: { name: string; email: string; role: string } }>;
};

const RESOURCE_LABELS = AUDIT_RESOURCE_LABELS;
const ACTION_LABELS = AUDIT_ACTION_LABELS;
const RESOURCE_ICONS = AUDIT_RESOURCE_ICONS;
const ACTION_COLORS = AUDIT_ACTION_COLORS;

const SEVERITY_BADGE: Record<string, string> = {
  low: 'text-gray-300 bg-gray-500/15 border-gray-500/30',
  medium: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  high: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  critical: 'text-red-300 bg-red-500/15 border-red-500/30',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const inputClass = 'w-full px-3 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-300 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

function formatAuditDetails(log: AuditLog): string {
  if (log.action === 'downloaded' && log.details?.fileName) {
    return `Downloaded ${log.details.fileName}`;
  }

  const fieldChanges = log.details?.fieldChanges;
  if (Array.isArray(fieldChanges) && fieldChanges.length > 0) {
    return fieldChanges
      .map((c) => {
        if (c.field === 'password') return 'Password changed';
        if (c.label === 'Created') return `Created: ${c.newValue}`;
        const oldValue = c.oldValue ?? c.from ?? '—';
        const newValue = c.newValue ?? c.to ?? '—';
        return `${c.label}: ${oldValue} → ${newValue}`;
      })
      .join(' · ');
  }

  if (log.details?.summary) return log.details.summary;
  return log.description || '—';
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const resourceIcon = RESOURCE_ICONS[log.resource] || '📄';
  const resourceLabel = RESOURCE_LABELS[log.resource] || log.resource;
  const actionLabel = ACTION_LABELS[log.action] || log.action;
  const actionColor = ACTION_COLORS[log.action] || 'text-gray-300';
  const detailsText = formatAuditDetails(log);

  return (
    <tr className="hover:bg-gray-800/40 transition-colors">
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
        {new Date(log.createdAt).toLocaleDateString()}{' '}
        <span className="text-gray-600">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-xs font-medium text-gray-200">{log.userId?.name || 'System'}</span>
        <span className="ml-1 text-[11px] text-gray-500">({log.userId?.role || '—'})</span>
      </td>
      <td className="px-3 py-2">
        <span className={`text-xs font-semibold ${actionColor}`}>{actionLabel}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-xs text-gray-500">{resourceIcon} {resourceLabel}</span>
        {log.resourceName && (
          <span className="ml-1 text-xs text-gray-400 font-medium">&ldquo;{log.resourceName}&rdquo;</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-md">
        <span className="line-clamp-2" title={detailsText}>
          {detailsText}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-md border ${SEVERITY_BADGE[log.severity] || SEVERITY_BADGE.low}`}>
          {log.severity}
        </span>
      </td>
    </tr>
  );
}

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 truncate ${accent}`}>{value}</p>
    </div>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [severity, setSeverity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchLogs = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });

      if (resource) params.set('resource', resource);
      if (action) params.set('action', action);
      if (severity) params.set('severity', severity);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);

      const res = await fetch(api(`/api/audit-logs?${params}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.pages);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(api(`/api/audit-logs/stats?${params}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, resource, action, severity, startDate, endDate, search]);

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [resource, action, severity, startDate, endDate, search]);

  const exportLogs = async (format: 'csv' | 'json' = 'csv') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setExporting(true);
      const params = new URLSearchParams({ format });

      if (resource) params.set('resource', resource);
      if (action) params.set('action', action);
      if (severity) params.set('severity', severity);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);

      const res = await fetch(api(`/api/audit-logs/export?${params}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        setError(data.message || 'Export failed');
      }
    } catch (err) {
      setError('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setResource('');
    setAction('');
    setSeverity('');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Audit Logs</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Track system activity and changes for compliance, security, and troubleshooting.
          </p>
        </div>
        <button
          onClick={() => exportLogs('csv')}
          disabled={exporting}
          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 hover:border-teal-400/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {stats && (
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
          <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryCard label="Total logs" value={stats.totalLogs} accent="text-blue-300" />
            <SummaryCard
              label="Top resource"
              value={stats.resourceStats[0] ? RESOURCE_LABELS[stats.resourceStats[0]._id] || stats.resourceStats[0]._id : '—'}
              accent="text-violet-300"
            />
            <SummaryCard
              label="Top action"
              value={stats.actionStats[0] ? ACTION_LABELS[stats.actionStats[0]._id] || stats.actionStats[0]._id : '—'}
              accent="text-amber-300"
            />
            <SummaryCard
              label="Most active user"
              value={stats.topUsers[0]?.user.name || '—'}
              accent="text-emerald-300"
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gradient-to-r from-violet-950/15 to-gray-800/40 px-4 py-3 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest">Filters</p>
          <button
            onClick={clearFilters}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
          >
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
          <div>
            <label className={labelClass}>Resource</label>
            <select value={resource} onChange={(e) => setResource(e.target.value)} className={inputClass}>
              <option value="">All resources</option>
              {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={inputClass}>
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
              <option value="">All levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs…"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading audit logs..." />
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-violet-500/20 bg-violet-950/10 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-300 mb-1">No audit logs found</p>
          <p className="text-xs text-gray-500">No activity matches your current filters.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-700/60 overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/80 border-b border-gray-700/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Time</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">User</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Action</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Resource</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Details</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/40">
                  {logs.map((log) => (
                    <AuditLogRow key={log._id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500">
                {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-700/60 bg-gray-800/60 text-gray-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
                >
                  Prev
                </button>
                <span className="px-2 text-xs text-gray-500">{page}/{totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-700/60 bg-gray-800/60 text-gray-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
