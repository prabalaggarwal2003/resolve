'use client';

import { useEffect, useMemo, useState } from 'react';
import { UpgradePrompt } from '@/lib/subscriptionUtils';
import LoadingSpinner from '@/components/LoadingSpinner';

interface StatusEntry {
  count: number;
  value: number;
  percentage: number;
}

interface KPIData {
  overview: {
    totalAssets: number;
    totalValue: number;
    averageValue: number;
    maxValue: number;
    minValue: number;
  };
  status: Record<string, StatusEntry>;
  utilization: {
    assigned: { count: number; percentage: number };
    unassigned: { count: number; percentage: number };
    utilizationRate: number;
  };
  warranty: {
    active: { count: number; percentage: number };
    expired: { count: number; percentage: number };
    none: { count: number; percentage: number };
  };
  condition: Record<string, number>;
  issues: {
    open: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    total: number;
    openPercentage: number;
    resolutionRate: number;
  };
  categories: Array<{ name: string; count: number; value: number; percentage: number }>;
  ageDistribution: Array<{ range: string; count: number; percentage: number }>;
  locations: Array<{ name: string; count: number; percentage: number }>;
  departments: Array<{ name: string; count: number; percentage: number }>;
}

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_use: 'In use',
  working: 'Working',
  under_maintenance: 'Under maintenance',
  needs_repair: 'Needs repair',
  out_of_service: 'Out of service',
  retired: 'Retired',
};

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
  under_maintenance: 'Under maintenance',
};

const CHART_COLORS = {
  emerald: '#34d399',
  blue: '#60a5fa',
  amber: '#fbbf24',
  red: '#f87171',
  violet: '#a78bfa',
  gray: '#6b7280',
  teal: '#2dd4bf',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusCount(status: KPIData['status'], key: string): number {
  return status[key]?.count ?? 0;
}

function deriveMetrics(kpis: KPIData) {
  const activeIssues = kpis.issues.open + kpis.issues.in_progress;
  const assetsInMaintenance =
    statusCount(kpis.status, 'under_maintenance') +
    statusCount(kpis.status, 'needs_repair') +
    statusCount(kpis.status, 'out_of_service');
  const operationalAssets =
    statusCount(kpis.status, 'available') +
    statusCount(kpis.status, 'in_use') +
    statusCount(kpis.status, 'working');

  return { activeIssues, assetsInMaintenance, operationalAssets };
}

function DonutChart({
  segments,
  size = 132,
  centerLabel,
  centerValue,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((seg) => seg.value > 0);

  if (total === 0) {
    return <p className="text-xs text-gray-500 py-6 text-center">No data yet</p>;
  }

  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(55 65 81 / 0.6)"
            strokeWidth={strokeWidth}
          />
          {visible.map((seg) => {
            const dash = (seg.value / total) * circumference;
            const circle = (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            {centerValue !== undefined && (
              <p className="text-lg font-bold text-gray-100 leading-none">{centerValue}</p>
            )}
            {centerLabel && (
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{centerLabel}</p>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {visible.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-400 truncate flex-1">{seg.label}</span>
            <span className="text-gray-200 font-medium tabular-nums">{seg.value}</span>
            <span className="text-gray-600 tabular-nums w-10 text-right">
              {((seg.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({
  items,
  valueFormatter = (v: number) => String(v),
}: {
  items: Array<{ label: string; value: number; color: string; hint?: string }>;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between items-baseline gap-2 text-xs mb-1">
            <span className="text-gray-300 truncate">{item.label}</span>
            <span className="text-gray-400 shrink-0 tabular-nums">
              {valueFormatter(item.value)}
              {item.hint ? ` · ${item.hint}` : ''}
            </span>
          </div>
          <div className="h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent = 'text-gray-100',
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  accentClass,
  titleClass,
  children,
  className = 'mb-4',
}: {
  title: string;
  subtitle?: string;
  accentClass: string;
  titleClass: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-700/60 border-l-2 ${accentClass} bg-gray-800/40 px-4 py-4 ${className}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest ${titleClass}`}>{title}</p>
      {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

export default function KPIPage() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'overview' | 'detailed'>('overview');
  const [tier, setTier] = useState<string>('free');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const init = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        setLoading(false);
        setError('Not authenticated');
        return;
      }

      try {
        const subRes = await fetch(api('/api/payments/subscription-status'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const subData = await subRes.json();
        if (subRes.ok) {
          setTier(subData.tier);
          setIsExpired(subData.isExpired || false);
          if (subData.tier === 'free' || subData.isExpired) {
            setLoading(false);
            return;
          }
        }
      } catch (_) {}

      await fetchKPIs(token);
    };

    init();
  }, []);

  const fetchKPIs = async (token?: string) => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!authToken) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    try {
      const res = await fetch(api('/api/kpis'), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setKpis(data);
      } else {
        setError(data.message || 'Failed to load KPIs');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => (kpis ? deriveMetrics(kpis) : null), [kpis]);

  const statusChartSegments = useMemo(() => {
    if (!kpis) return [];
    return [
      {
        label: 'Operational',
        value: metrics!.operationalAssets,
        color: CHART_COLORS.emerald,
      },
      {
        label: 'Needs attention',
        value: metrics!.assetsInMaintenance,
        color: CHART_COLORS.amber,
      },
      {
        label: 'Retired',
        value: statusCount(kpis.status, 'retired'),
        color: CHART_COLORS.gray,
      },
    ];
  }, [kpis, metrics]);

  const issueChartSegments = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: 'Open', value: kpis.issues.open, color: CHART_COLORS.amber },
      { label: 'In progress', value: kpis.issues.in_progress, color: CHART_COLORS.blue },
      { label: 'Completed', value: kpis.issues.completed, color: CHART_COLORS.emerald },
      { label: 'Cancelled', value: kpis.issues.cancelled, color: CHART_COLORS.gray },
    ];
  }, [kpis]);

  const statusBreakdown = useMemo(() => {
    if (!kpis) return [];
    return Object.entries(kpis.status)
      .filter(([, data]) => data.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, data], idx) => ({
        label: STATUS_LABELS[key] || key.replace(/_/g, ' '),
        value: data.count,
        hint: `${data.percentage.toFixed(1)}%`,
        color: [CHART_COLORS.blue, CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.violet, CHART_COLORS.red, CHART_COLORS.teal, CHART_COLORS.gray][idx % 7],
      }));
  }, [kpis]);

  const conditionBreakdown = useMemo(() => {
    if (!kpis) return [];
    const order = ['excellent', 'good', 'fair', 'poor', 'critical', 'under_maintenance'];
    const colors = [CHART_COLORS.emerald, CHART_COLORS.teal, CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.violet];
    return order
      .filter((key) => (kpis.condition[key] ?? 0) > 0)
      .map((key, idx) => ({
        label: CONDITION_LABELS[key] || key,
        value: kpis.condition[key],
        color: colors[idx % colors.length],
      }));
  }, [kpis]);

  const showConditionSection = conditionBreakdown.length > 1;

  if (loading) {
    return <LoadingSpinner message="Loading KPIs..." />;
  }

  if (tier === 'free' || isExpired) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">KPIs & Metrics</h1>
        {isExpired && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-medium">Your subscription has expired</p>
            <p className="text-red-300 text-sm mt-1">Renew your subscription to access KPIs and metrics</p>
          </div>
        )}
        <UpgradePrompt feature={isExpired ? 'KPIs & Metrics (Renew subscription to unlock)' : 'KPIs & Metrics Dashboard'} />
      </div>
    );
  }

  if (error || !kpis || !metrics) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400">{error || 'No data available'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">KPIs & Metrics</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Quick health check for your asset portfolio — overview first, then drill into details.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setView('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            view === 'overview'
              ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60 hover:text-gray-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setView('detailed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            view === 'detailed'
              ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60 hover:text-gray-200'
          }`}
        >
          Detailed analytics
        </button>
      </div>

      {view === 'overview' && (
        <>
          <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
            <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-3">At a glance</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <SummaryCard
                label="Total assets"
                value={kpis.overview.totalAssets}
                hint={`${formatCurrency(kpis.overview.totalValue)} portfolio`}
                accent="text-blue-300"
              />
              <SummaryCard
                label="Active issues"
                value={metrics.activeIssues}
                hint={metrics.activeIssues > 0 ? 'Open or in progress' : 'Nothing pending'}
                accent={metrics.activeIssues > 0 ? 'text-amber-300' : 'text-emerald-300'}
              />
              <SummaryCard
                label="Assets needing attention"
                value={metrics.assetsInMaintenance}
                hint="Maintenance, repair, or offline"
                accent={metrics.assetsInMaintenance > 0 ? 'text-red-300' : 'text-emerald-300'}
              />
              <SummaryCard
                label="Assigned"
                value={`${kpis.utilization.utilizationRate.toFixed(0)}%`}
                hint={`${kpis.utilization.assigned.count} of ${kpis.overview.totalAssets} assets`}
                accent="text-violet-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <Section
              title="Asset status"
              subtitle="Grouped by operational health"
              accentClass="border-l-emerald-500/50"
              titleClass="text-emerald-400/80"
              className="mb-0"
            >
              <DonutChart
                segments={statusChartSegments}
                centerValue={kpis.overview.totalAssets}
                centerLabel="assets"
              />
            </Section>

            <Section
              title="Issue pipeline"
              subtitle="Current maintenance tickets"
              accentClass="border-l-amber-500/50"
              titleClass="text-amber-400/80"
              className="mb-0"
            >
              <DonutChart
                segments={issueChartSegments}
                centerValue={kpis.issues.total}
                centerLabel="issues"
              />
            </Section>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-3 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Unassigned assets</p>
              <p className={`text-base font-semibold mt-0.5 tabular-nums ${kpis.utilization.unassigned.count > 0 ? 'text-amber-300' : 'text-gray-300'}`}>
                {kpis.utilization.unassigned.count}
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">Not linked to a user</p>
            </div>
            <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-3 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Expired warranty</p>
              <p className={`text-base font-semibold mt-0.5 tabular-nums ${kpis.warranty.expired.count > 0 ? 'text-red-300' : 'text-gray-300'}`}>
                {kpis.warranty.expired.count}
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">May need renewal or review</p>
            </div>
            <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-3 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Resolution rate</p>
              <p className="text-base font-semibold mt-0.5 tabular-nums text-violet-300">
                {kpis.issues.resolutionRate.toFixed(0)}%
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {kpis.issues.completed} of {kpis.issues.total} issues closed
              </p>
            </div>
          </div>

          {kpis.categories.length > 0 && (
            <Section
              title="Top categories"
              subtitle="By asset count"
              accentClass="border-l-blue-500/50"
              titleClass="text-blue-400/80"
              className="mb-0"
            >
              <HorizontalBars
                items={kpis.categories.slice(0, 5).map((cat, idx) => ({
                  label: cat.name,
                  value: cat.count,
                  hint: `${cat.percentage.toFixed(0)}%`,
                  color: [CHART_COLORS.blue, CHART_COLORS.violet, CHART_COLORS.teal, CHART_COLORS.emerald, CHART_COLORS.amber][idx % 5],
                }))}
              />
            </Section>
          )}
        </>
      )}

      {view === 'detailed' && (
        <>
          <Section
            title="Portfolio value"
            subtitle="Financial summary across all assets"
            accentClass="border-l-blue-500/50"
            titleClass="text-blue-400/80"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <SummaryCard label="Total value" value={formatCurrency(kpis.overview.totalValue)} accent="text-blue-300" />
              <SummaryCard label="Average asset cost" value={formatCurrency(kpis.overview.averageValue)} accent="text-violet-300" />
              <SummaryCard
                label="Unassigned assets"
                value={kpis.utilization.unassigned.count}
                hint={`${kpis.utilization.unassigned.percentage.toFixed(1)}% of fleet`}
                accent="text-amber-300"
              />
            </div>
          </Section>

          <div className={`grid grid-cols-1 ${showConditionSection ? 'lg:grid-cols-2' : ''} gap-3 mb-4`}>
            <Section
              title="Status breakdown"
              subtitle="Every asset status in your inventory"
              accentClass="border-l-violet-500/50"
              titleClass="text-violet-400/80"
              className="mb-0"
            >
              <HorizontalBars items={statusBreakdown} />
            </Section>

            {showConditionSection && (
              <Section
                title="Estimated condition"
                subtitle="From status, open/past issues, age, and warranty — not the Asset Health tab"
                accentClass="border-l-emerald-500/50"
                titleClass="text-emerald-400/80"
                className="mb-0"
              >
                <HorizontalBars items={conditionBreakdown} />
              </Section>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <Section
              title="Warranty coverage"
              accentClass="border-l-amber-500/50"
              titleClass="text-amber-400/80"
              className="mb-0"
            >
              <HorizontalBars
                items={[
                  { label: 'Active', value: kpis.warranty.active.count, hint: `${kpis.warranty.active.percentage.toFixed(0)}%`, color: CHART_COLORS.emerald },
                  { label: 'Expired', value: kpis.warranty.expired.count, hint: `${kpis.warranty.expired.percentage.toFixed(0)}%`, color: CHART_COLORS.red },
                  { label: 'Not recorded', value: kpis.warranty.none.count, hint: `${kpis.warranty.none.percentage.toFixed(0)}%`, color: CHART_COLORS.gray },
                ]}
              />
            </Section>

            <Section
              title="Asset age"
              subtitle="Based on purchase date"
              accentClass="border-l-teal-500/50"
              titleClass="text-teal-400/80"
              className="mb-0"
            >
              {kpis.ageDistribution.length > 0 ? (
                <HorizontalBars
                  items={kpis.ageDistribution.map((age, idx) => ({
                    label: age.range,
                    value: age.count,
                    hint: `${age.percentage.toFixed(0)}%`,
                    color: [CHART_COLORS.teal, CHART_COLORS.blue, CHART_COLORS.violet, CHART_COLORS.amber, CHART_COLORS.red][idx % 5],
                  }))}
                />
              ) : (
                <p className="text-xs text-gray-500">Add purchase dates to see age distribution</p>
              )}
            </Section>
          </div>

          <Section
            title="Issue history"
            subtitle="All maintenance tickets linked to your assets"
            accentClass="border-l-red-500/50"
            titleClass="text-red-400/80"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
              <DonutChart segments={issueChartSegments} centerValue={metrics.activeIssues} centerLabel="active" />
              <div className="grid grid-cols-2 gap-2">
                <SummaryCard label="Open" value={kpis.issues.open} accent="text-amber-300" />
                <SummaryCard label="In progress" value={kpis.issues.in_progress} accent="text-blue-300" />
                <SummaryCard label="Completed" value={kpis.issues.completed} accent="text-emerald-300" />
                <SummaryCard label="Cancelled" value={kpis.issues.cancelled} accent="text-gray-400" />
              </div>
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <Section
              title="By location"
              subtitle="Where assets are deployed"
              accentClass="border-l-blue-500/50"
              titleClass="text-blue-400/80"
              className="mb-0"
            >
              {kpis.locations.length > 0 ? (
                <HorizontalBars
                  items={kpis.locations.slice(0, 8).map((loc, idx) => ({
                    label: loc.name,
                    value: loc.count,
                    hint: `${loc.percentage.toFixed(0)}%`,
                    color: [CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.violet, CHART_COLORS.emerald][idx % 4],
                  }))}
                />
              ) : (
                <p className="text-xs text-gray-500">No location assignments yet</p>
              )}
            </Section>

            <Section
              title="By department"
              subtitle="Ownership across teams"
              accentClass="border-l-violet-500/50"
              titleClass="text-violet-400/80"
              className="mb-0"
            >
              {kpis.departments.length > 0 ? (
                <HorizontalBars
                  items={kpis.departments.slice(0, 8).map((dept, idx) => ({
                    label: dept.name,
                    value: dept.count,
                    hint: `${dept.percentage.toFixed(0)}%`,
                    color: [CHART_COLORS.violet, CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.emerald][idx % 4],
                  }))}
                />
              ) : (
                <p className="text-xs text-gray-500">No department assignments yet</p>
              )}
            </Section>
          </div>

          {kpis.categories.length > 0 && (
            <Section
              title="Categories"
              subtitle="Count and value by asset type"
              accentClass="border-l-blue-500/50"
              titleClass="text-blue-400/80"
              className="mb-0"
            >
              <div className="space-y-2">
                {kpis.categories.map((cat, idx) => (
                  <div key={cat.name} className="px-2 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-200 truncate">{cat.name}</p>
                        <p className="text-[11px] text-gray-500">{formatCurrency(cat.value)} total value</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-blue-300 tabular-nums">{cat.count}</p>
                        <p className="text-[11px] text-gray-500">{cat.percentage.toFixed(1)}% of assets</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: [CHART_COLORS.blue, CHART_COLORS.violet, CHART_COLORS.teal, CHART_COLORS.emerald, CHART_COLORS.amber][idx % 5],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
