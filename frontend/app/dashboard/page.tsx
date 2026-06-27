'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

type Overview = {
  kpis: {
    totalAssets: number;
    openIssues: number;
    inProgressIssues: number;
    resolvedToday: number;
    underMaintenance: number;
    totalPurchaseValue: number | null;
    currentBookValueSLM: number | null;
    depreciationEnabled: boolean;
  };
  actionRequired: Array<{ key: string; label: string; count: number; href: string }>;
  issueTrend: { labels: string[]; reported: number[]; resolved: number[] } | null;
  assetStatus: Array<{ key: string; label: string; value: number }> | null;
  latestIssues: Array<{
    _id: string;
    ticketId: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    reporterName: string;
    assetName: string;
  }>;
  assetValueSummary: {
    totalPurchaseValue: number;
    currentBookValueSLM: number | null;
    depreciationEnabled: boolean;
  } | null;
};

const STATUS_BADGE: Record<string, string> = {
  open: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  in_progress: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  completed: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  cancelled: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'text-red-300 bg-red-500/15 border-red-500/30',
  medium: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  low: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  available: '#10b981',
  in_use: '#3b82f6',
  under_maintenance: '#f59e0b',
  out_of_service: '#ef4444',
  retired: '#6b7280',
};

const STATUS_BUCKETS = [
  { key: 'available', label: 'Available', statuses: ['available', 'working'] },
  { key: 'in_use', label: 'In use', statuses: ['in_use'] },
  { key: 'under_maintenance', label: 'Under maintenance', statuses: ['under_maintenance', 'needs_repair'] },
  { key: 'out_of_service', label: 'Out of service', statuses: ['out_of_service'] },
  { key: 'retired', label: 'Retired', statuses: ['retired'] },
];

const ASSET_STATUS_KEYS = [
  'available',
  'working',
  'in_use',
  'under_maintenance',
  'needs_repair',
  'out_of_service',
  'retired',
] as const;

const KPI_META = [
  { key: 'totalAssets', label: 'Total assets', icon: '📦', accent: 'from-blue-600/30' },
  { key: 'openIssues', label: 'Open issues', icon: '🚨', accent: 'from-amber-600/30' },
  { key: 'inProgressIssues', label: 'In progress', icon: '🔄', accent: 'from-violet-600/30' },
  { key: 'resolvedToday', label: 'Resolved today', icon: '✅', accent: 'from-emerald-600/30' },
] as const;

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

async function fetchJson(token: string, path: string) {
  const res = await fetch(api(path), { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function buildIssueTrend(
  issues: Array<{ createdAt: string; status: string; resolvedAt?: string }>
): Overview['issueTrend'] {
  const days = 30;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const reportedMap = new Map<string, number>();
  const resolvedMap = new Map<string, number>();

  for (const issue of issues) {
    const created = new Date(issue.createdAt);
    if (created >= thirtyDaysAgo) {
      const key = created.toISOString().slice(0, 10);
      reportedMap.set(key, (reportedMap.get(key) || 0) + 1);
    }
    if (issue.status === 'completed' && issue.resolvedAt) {
      const resolvedDate = new Date(issue.resolvedAt);
      if (resolvedDate >= thirtyDaysAgo) {
        const key = resolvedDate.toISOString().slice(0, 10);
        resolvedMap.set(key, (resolvedMap.get(key) || 0) + 1);
      }
    }
  }

  const labels: string[] = [];
  const reported: number[] = [];
  const resolved: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    reported.push(reportedMap.get(key) || 0);
    resolved.push(resolvedMap.get(key) || 0);
  }

  const hasData = reported.some((n) => n > 0) || resolved.some((n) => n > 0);
  return hasData ? { labels, reported, resolved } : null;
}

function buildAssetStatusBuckets(statusCounts: Record<string, number>): Overview['assetStatus'] {
  const buckets = STATUS_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: bucket.statuses.reduce((sum, st) => sum + (statusCounts[st] || 0), 0),
  })).filter((b) => b.value > 0);
  return buckets.length > 0 ? buckets : null;
}

async function fetchAssetStatusCounts(token: string): Promise<Overview['assetStatus']> {
  const results = await Promise.all(
    ASSET_STATUS_KEYS.map(async (status) => {
      const { ok, data } = await fetchJson(token, `/api/assets?status=${status}&limit=1`);
      return { status, count: ok ? Number(data.total) || 0 : 0 };
    })
  );
  const statusCounts = Object.fromEntries(results.map((r) => [r.status, r.count]));
  return buildAssetStatusBuckets(statusCounts);
}

async function loadDashboard(token: string): Promise<Overview> {
  const [summaryRes, latestIssuesRes, trendIssuesRes, subRes, maintenanceRes] = await Promise.all([
    fetchJson(token, '/api/dashboard/summary'),
    fetchJson(token, '/api/issues?limit=10'),
    fetchJson(token, '/api/issues?limit=300'),
    fetchJson(token, '/api/payments/subscription-status'),
    fetchJson(token, '/api/asset-health/maintenance'),
  ]);

  if (!summaryRes.ok) {
    throw new Error(summaryRes.data.message || 'Failed to load dashboard');
  }

  const summary = summaryRes.data;
  const tier = subRes.ok && !subRes.data.isExpired ? subRes.data.tier : 'free';
  const depreciationEnabled = tier === 'pro' || tier === 'premium';

  let totalPurchaseValue: number | null = null;
  let currentBookValueSLM: number | null = null;
  let assetStatus: Overview['assetStatus'] = null;
  let expiredWarrantyCount = 0;

  if (depreciationEnabled) {
    const [kpisRes, depRes] = await Promise.all([
      fetchJson(token, '/api/kpis'),
      fetchJson(token, '/api/depreciation/summary'),
    ]);

    if (kpisRes.ok && kpisRes.data.status) {
      const statusCounts = Object.fromEntries(
        Object.entries(kpisRes.data.status as Record<string, { count: number }>).map(([k, v]) => [
          k,
          v.count,
        ])
      );
      assetStatus = buildAssetStatusBuckets(statusCounts);
      expiredWarrantyCount = kpisRes.data.warranty?.expired?.count ?? 0;
    }

    if (depRes.ok && depRes.data.summary) {
      const s = depRes.data.summary;
      if (s.totalPurchaseValue > 0) {
        totalPurchaseValue = s.totalPurchaseValue;
        currentBookValueSLM = s.currentBookValueSLM ?? null;
      }
    }
  }

  if (!assetStatus) {
    assetStatus = await fetchAssetStatusCounts(token);
  }

  const trendIssues = trendIssuesRes.ok ? trendIssuesRes.data.issues || [] : [];
  const issueTrend = buildIssueTrend(trendIssues);

  const latestIssues = (latestIssuesRes.ok ? latestIssuesRes.data.issues || [] : []).map(
    (issue: {
      _id: string;
      ticketId: string;
      title: string;
      status: string;
      priority?: string;
      createdAt: string;
      reporterName?: string;
      assetId?: { name?: string };
    }) => ({
      _id: issue._id,
      ticketId: issue.ticketId,
      title: issue.title,
      status: issue.status,
      priority: issue.priority || 'medium',
      createdAt: issue.createdAt,
      reporterName: issue.reporterName || '—',
      assetName: issue.assetId?.name || '—',
    })
  );

  const actionRequired: Overview['actionRequired'] = [];
  const maintenanceAssets = maintenanceRes.ok ? maintenanceRes.data.assets || [] : [];
  const overdueCount = maintenanceAssets.filter((a: { isOverdue?: boolean }) => a.isOverdue).length;
  if (overdueCount > 0) {
    actionRequired.push({
      key: 'overdue_maintenance',
      label: 'Overdue maintenance',
      count: overdueCount,
      href: '/dashboard/maintenance',
    });
  }
  if (expiredWarrantyCount > 0) {
    actionRequired.push({
      key: 'expired_warranties',
      label: 'Expired warranties',
      count: expiredWarrantyCount,
      href: '/dashboard/assets',
    });
  }

  const hasFinancial = totalPurchaseValue != null && totalPurchaseValue > 0;

  return {
    kpis: {
      totalAssets: summary.totalAssets ?? 0,
      openIssues: summary.openIssues ?? 0,
      inProgressIssues: summary.inProgressIssues ?? 0,
      resolvedToday: summary.completedToday ?? 0,
      underMaintenance: summary.underMaintenance ?? 0,
      totalPurchaseValue: hasFinancial ? totalPurchaseValue : null,
      currentBookValueSLM:
        depreciationEnabled && hasFinancial ? currentBookValueSLM : null,
      depreciationEnabled,
    },
    actionRequired,
    issueTrend,
    assetStatus,
    latestIssues,
    assetValueSummary:
      depreciationEnabled && hasFinancial && currentBookValueSLM != null
        ? {
            totalPurchaseValue: totalPurchaseValue!,
            currentBookValueSLM,
            depreciationEnabled: true,
          }
        : null,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-gray-700/50 bg-gray-900/40 px-2 py-1.5`}>
      <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${accent} to-transparent`} />
      <div className="relative flex items-center gap-1.5">
        <span className="text-sm leading-none">{icon}</span>
        <div className="min-w-0">
          <p className="text-[8px] text-gray-500 uppercase tracking-wide truncate">{label}</p>
          <p className="text-sm font-bold text-gray-100 tabular-nums leading-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LineChart({
  labels,
  reported,
  resolved,
}: {
  labels: string[];
  reported: number[];
  resolved: number[];
}) {
  const w = 280;
  const h = 72;
  const pad = { t: 4, r: 6, b: 14, l: 22 };
  const max = Math.max(...reported, ...resolved, 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const toX = (i: number) => pad.l + (i / Math.max(labels.length - 1, 1)) * innerW;
  const toY = (v: number) => pad.t + innerH - (v / max) * innerH;

  const line = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + innerH * (1 - f);
        return (
          <line key={f} x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="rgb(55 65 81 / 0.4)" strokeWidth="1" />
        );
      })}
      <path d={line(reported)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <path d={line(resolved)} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
      {labels.map((lbl, i) =>
        i % 6 === 0 ? (
          <text key={lbl} x={toX(i)} y={h - 4} textAnchor="middle" className="fill-gray-600" fontSize="7">
            {lbl}
          </text>
        ) : null
      )}
    </svg>
  );
}

function DonutChart({ segments }: { segments: Array<{ key: string; label: string; value: number }> }) {
  const size = 72;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let offset = 0;

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(55 65 81 / 0.5)" strokeWidth={stroke} />
          {segments.map((seg) => {
            const dash = (seg.value / total) * c;
            const el = (
              <circle
                key={seg.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={STATUS_COLORS[seg.key] || '#6b7280'}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-100 tabular-nums">{total}</span>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 min-w-0 mt-6">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[seg.key] }} />
            <span className="text-gray-500 truncate flex-1">{seg.label}</span>
            <span className="text-gray-300 font-medium tabular-nums">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  accent,
  children,
  className = '',
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-gray-700/60 border-l-2 ${accent} bg-gray-800/40 px-2.5 py-2 flex flex-col min-h-0 ${className}`}>
      <p className="text-[12px] font-semibold uppercase tracking-widest text-gray-500 mb-1 shrink-0">{title}</p>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u.role === 'manager') setIsManager(true);
      if (u.name) setUserName(u.name);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    loadDashboard(token)
      .then(setData)
      .catch((err: Error) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-red-400 text-sm">{error || 'Unable to load dashboard'}</p>;
  }

  const { kpis, actionRequired, issueTrend, assetStatus, latestIssues } = data;

  const kpiCards = [...KPI_META];
  const valueKpi =
    kpis.depreciationEnabled && kpis.currentBookValueSLM != null
      ? { icon: '💰', label: 'Book value (SLM)', value: formatCurrency(kpis.currentBookValueSLM) }
      : kpis.totalPurchaseValue != null
      ? { icon: '💰', label: 'Purchase value', value: formatCurrency(kpis.totalPurchaseValue) }
      : null;

  const displayIssues = latestIssues.slice(0, 10);
  const hasCharts = Boolean(issueTrend || assetStatus);

  return (
    <div className="max-md:h-auto md:h-[calc(100dvh-8.5rem)] max-w-7xl mx-auto w-full flex flex-col gap-2 text-sm">
      <div className="shrink-0">
        <h1 className="text-[20px] font-bold text-gray-100 leading-tight mb-2">
          {getGreeting()}, {getFirstName(userName)}
        </h1>
        <p className="text-[14px] text-gray-500 mt-0.5 mb-2">Here&apos;s what&apos;s happening across your organization</p>
      </div>

      {/* KPI row */}
      <div
        className={`shrink-0 grid gap-2 ${
          valueKpi ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {kpiCards.map((meta) => (
          <KpiCard
            key={meta.key}
            icon={meta.icon}
            label={meta.label}
            value={kpis[meta.key]}
            accent={meta.accent}
          />
        ))}
        {valueKpi && (
          <KpiCard icon={valueKpi.icon} label={valueKpi.label} value={valueKpi.value} accent="from-teal-600/30" />
        )}
      </div>

      {/* Action required */}
      {actionRequired.length > 0 && (
        <div className="shrink-0 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 my-2">
          <span className="text-[12px] font-semibold text-red-400 uppercase tracking-wide">⚠️  Action required</span>
          {actionRequired.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="text-xs text-red-200 hover:text-red-100 no-underline flex items-center gap-1.5"
            >
              <span className="font-semibold tabular-nums">{item.count}</span>
              <span className="text-red-300/80">{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Charts row + latest issues */}
      <div className="flex flex-col gap-2 md:flex-1 md:min-h-0">
        {hasCharts && (
          <div
            className={`shrink-0 grid gap-2 ${
              issueTrend && assetStatus ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {issueTrend && (
              <Panel title="📈 Issue trend" accent="border-l-amber-500/50" className="overflow-hidden">
                <div className="flex gap-2 mb-0.5 text-[10px]">
                  <span className="flex items-center gap-1 text-gray-500">
                    <span className="w-2.5 h-0.5 bg-amber-400 rounded" /> Reported
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <span className="w-2.5 h-0.5 bg-emerald-400 rounded" /> Resolved
                  </span>
                </div>
                <LineChart labels={issueTrend.labels} reported={issueTrend.reported} resolved={issueTrend.resolved} />
              </Panel>
            )}
            {assetStatus && (
              <Panel title="🥧 Asset status" accent="border-l-blue-500/50" className="overflow-hidden">
                <DonutChart segments={assetStatus} />
              </Panel>
            )}
          </div>
        )}

        <Panel
          title="📋 Latest issues"
          accent="border-l-violet-500/50"
          className="overflow-hidden mt-2 md:flex-1 md:min-h-0"
        >
          {displayIssues.length === 0 ? (
            <p className="text-[10px] text-gray-500">No issues yet.</p>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col h-full">
              <div className="shrink-0 grid grid-cols-[1fr_0.65fr_0.45fr_0.5fr_0.6fr] gap-1 text-[12px] text-gray-600 uppercase tracking-wide border-b border-gray-700/30 pb-1">
                <span>Asset</span>
                <span>Reporter</span>
                <span>Priority</span>
                <span>Status</span>
                <span className="text-right">When</span>
              </div>
              <div className="overflow-y-auto my-2 -mr-1 pr-1 max-md:max-h-[15rem] md:flex-1 md:min-h-0">
                {displayIssues.map((issue) => {
                  const rowClass =
                    'grid grid-cols-[1fr_0.65fr_0.45fr_0.5fr_0.6fr] gap-1 text-[12px] items-center py-1.5 shrink-0 border-b border-gray-700/20 last:border-b-0';
                  const row = (
                    <>
                      <span className="truncate text-gray-300">{issue.assetName}</span>
                      <span className="truncate text-gray-500">{issue.reporterName}</span>
                      <span
                        className={`w-fit px-1 py-0.5 text-[8px] rounded border capitalize ${
                          PRIORITY_BADGE[issue.priority] || PRIORITY_BADGE.medium
                        }`}
                      >
                        {issue.priority}
                      </span>
                      <span
                        className={`w-fit px-1 py-0.5 text-[8px] rounded border capitalize ${
                          STATUS_BADGE[issue.status] || STATUS_BADGE.cancelled
                        }`}
                      >
                        {issue.status.replace('_', ' ')}
                      </span>
                      <span className="text-right text-gray-600 tabular-nums text-[9px]">
                        {new Date(issue.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </>
                  );
                  return isManager ? (
                    <div key={issue._id} className={rowClass}>
                      {row}
                    </div>
                  ) : (
                    <Link
                      key={issue._id}
                      href={`/dashboard/issues/${issue._id}`}
                      className={`${rowClass} no-underline hover:bg-gray-800/30 rounded`}
                    >
                      {row}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      </div>
      <div>
        <p className="text-[18px] text-gray-600 text-center -mb-12 pt-7">
          Manage smarter. Track better. Resolve faster.
        </p>
      </div>
    </div>
    
  );
}
