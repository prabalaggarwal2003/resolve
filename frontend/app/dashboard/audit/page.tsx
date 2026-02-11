'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  organization: 'Organization',
  location: 'Location',
  department: 'Department',
  authentication: 'Authentication'
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
  login_success: 'Login Success',
  login_failed: 'Login Failed',
  logout: 'Logout'
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800'
};

const RESOURCE_ICONS: Record<string, string> = {
  asset: '🏷️',
  issue: '🔴',
  user: '👤',
  organization: '🏢',
  location: '📍',
  department: '🏛️',
  authentication: '🔐'
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function AuditLogCard({ log }: { log: AuditLog }) {
  const resourceIcon = RESOURCE_ICONS[log.resource] || '📄';
  const resourceLabel = RESOURCE_LABELS[log.resource] || log.resource;
  const actionLabel = ACTION_LABELS[log.action] || log.action;
  const severityColor = SEVERITY_COLORS[log.severity] || 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">
          {resourceIcon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {log.userId?.name || 'Unknown User'} {actionLabel.toLowerCase()} {resourceLabel.toLowerCase()}
                {log.resourceName && <span className="font-semibold"> "{log.resourceName}"</span>}
              </p>
              {log.description && (
                <p className="text-sm text-gray-600 mt-1">{log.description}</p>
              )}
            </div>

            <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColor}`}>
              {log.severity}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>👤 {log.userId?.role || 'Unknown'}</span>
              {log.ipAddress && <span>🌐 {log.ipAddress}</span>}
            </div>
            <span>{formatRelativeTime(log.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon, color = 'bg-gray-50' }: {
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
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">
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
            color="bg-blue-50 border-blue-200"
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
            color="bg-green-50 border-green-200"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700">Filters:</span>
          <button
            onClick={clearFilters}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Resource</label>
            <select
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Resources</option>
              {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Loading audit logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs found</h3>
          <p className="text-gray-600">No activity matches your current filters.</p>
        </div>
      ) : (
        <>
          {/* Results Info */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} logs
            </p>
          </div>

          {/* Audit Logs List */}
          <div className="space-y-3 mb-6">
            {logs.map((log) => (
              <AuditLogCard key={log._id} log={log} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>

              <span className="px-3 py-2 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
