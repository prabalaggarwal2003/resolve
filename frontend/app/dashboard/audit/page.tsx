'use client';

import { useEffect, useState } from 'react';

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

const RESOURCE_LABELS: Record<string, string> = {
  asset: 'Asset',
  issue: 'Issue',
  user: 'User',
  organization: 'Org',
  location: 'Location',
  department: 'Department',
  authentication: 'Auth',
  vendor: 'Vendor',
  invoice: 'Invoice',
  report: 'Report',
  maintenance: 'Maintenance',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  assigned: 'Assigned',
  unassigned: 'Unassigned',
  status_changed: 'Status Changed',
  role_changed: 'Role Changed',
  activated: 'Activated',
  deactivated: 'Deactivated',
  login_success: 'Login',
  login_failed: 'Login Failed',
  logout: 'Logout',
  generated: 'Generated',
  downloaded: 'Downloaded',
  maintenance_started: 'Maint. Started',
  maintenance_completed: 'Maint. Completed',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-400',
  high: 'text-amber-400',
  critical: 'text-red-400',
};

const ACTION_COLORS: Record<string, string> = {
  created: 'text-green-400',
  deleted: 'text-red-400',
  updated: 'text-blue-400',
  status_changed: 'text-amber-400',
  generated: 'text-purple-400',
  maintenance_started: 'text-orange-400',
  maintenance_completed: 'text-green-400',
  login_success: 'text-gray-400',
  login_failed: 'text-red-400',
};

const RESOURCE_ICONS: Record<string, string> = {
  asset: '📦',
  issue: '🔴',
  user: '👤',
  organization: '🏢',
  location: '📍',
  department: '🏛️',
  authentication: '🔐',
  vendor: '🏪',
  invoice: '🧾',
  report: '📊',
  maintenance: '🔧',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const resourceIcon = RESOURCE_ICONS[log.resource] || '📄';
  const resourceLabel = RESOURCE_LABELS[log.resource] || log.resource;
  const actionLabel = ACTION_LABELS[log.action] || log.action;
  const actionColor = ACTION_COLORS[log.action] || 'text-gray-300';
  const severityColor = SEVERITY_COLORS[log.severity] || 'text-gray-500';

  return (
    <tr className="border-t border-gray-800/60 hover:bg-gray-800/30 transition-colors">
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
        {new Date(log.createdAt).toLocaleDateString()}{' '}
        <span className="text-gray-700">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-xs font-medium text-gray-300">{log.userId?.name || 'System'}</span>
        <span className="ml-1 text-xs text-gray-600">({log.userId?.role || '—'})</span>
      </td>
      <td className="px-3 py-2">
        <span className={`text-xs font-semibold ${actionColor}`}>{actionLabel}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-xs text-gray-500">{resourceIcon} {resourceLabel}</span>
        {log.resourceName && (
          <span className="ml-1 text-xs text-gray-400 font-medium">"{log.resourceName}"</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate" title={log.description}>
        {log.description || '—'}
      </td>
      <td className="px-3 py-2">
        <span className={`text-xs font-medium ${severityColor}`}>{log.severity}</span>
      </td>
    </tr>
  );
}

function StatsCard({ title, value, icon, color = 'bg-gray-900' }: {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
}) {
  return (
    <div className={`${color} p-4 rounded-lg border`}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-xl font-bold text-gray-400">{value}</p>
        </div>
      </div>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Audit Logs</h1>
          <p className="text-gray-400 mt-1">
            Track all system activities and changes for compliance and security
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => exportLogs('csv')}
            disabled={exporting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            {exporting ? 'Exporting...' : '📊 Export CSV'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard title="Total Logs" value={stats.totalLogs} icon="📊" />
          <StatsCard
            title="Most Active Resource"
            value={stats.resourceStats[0] ? RESOURCE_LABELS[stats.resourceStats[0]._id] || stats.resourceStats[0]._id : 'None'}
            icon="🎯"
            color="bg-blue-900/20 border-blue-200"
          />
          <StatsCard
            title="Common Action"
            value={stats.actionStats[0] ? ACTION_LABELS[stats.actionStats[0]._id] || stats.actionStats[0]._id : 'None'}
            icon="⚡"
            color="bg-amber-50 border-amber-200"
          />
          <StatsCard
            title="Top User"
            value={stats.topUsers[0] ? stats.topUsers[0].user.name : 'None'}
            icon="👤"
            color="bg-green-900/20 border-green-800"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-300">Filters:</span>
          <button
            onClick={clearFilters}
            className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Resource</label>
            <select
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-md text-sm focus:ring-2 focus:ring-gray-600 focus:border-blue-500"
            >
              <option value="">All Resources</option>
              {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-md text-sm focus:ring-2 focus:ring-gray-600 focus:border-blue-500"
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-md text-sm focus:ring-2 focus:ring-gray-600 focus:border-blue-500"
            >
              <option value="">All Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-md text-sm focus:ring-2 focus:ring-gray-600 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-md text-sm focus:ring-2 focus:ring-gray-600 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full px-3 py-2 border border-gray-700 rounded-md text-sm focus:ring-2 focus:ring-gray-600 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Loading audit logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-100 mb-2">No audit logs found</h3>
          <p className="text-gray-400">No activity matches your current filters.</p>
        </div>
      ) : (
        <>
          {/* Results Info */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} logs
            </p>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-gray-900/40 rounded-lg border border-gray-700/60 overflow-hidden mb-6">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-950 text-left">
                  <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">Resource</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
                  <th className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">Level</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <AuditLogRow key={log._id} log={log} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm border border-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900"
              >
                Previous
              </button>

              <span className="px-3 py-2 text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm border border-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
