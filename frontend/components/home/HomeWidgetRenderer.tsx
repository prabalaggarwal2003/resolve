'use client';

import Link from 'next/link';
import type { ContainerSize } from '@/hooks/useContainerSize';
import type { HomeWidget, HomeWidgetResult } from '@/lib/homeDashboardWidgets';
import { formatINR } from '@/lib/homeDashboardWidgets';
import { DonutChart, HorizontalBars } from '@/components/kpis/KpiCharts';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function LimitBar({ label, count, limit }: { label: string; count: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const over = limit > 0 && count >= limit;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className={over ? 'text-amber-400' : 'text-gray-400'}>{count} / {limit || '∞'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-700/60 overflow-hidden">
        <div className={`h-full rounded-full ${over ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function HomeWidgetRenderer({
  widget,
  result,
  containerSize,
}: {
  widget: HomeWidget;
  result: HomeWidgetResult;
  containerSize: ContainerSize;
}) {
  const { width, height } = containerSize;
  const compact = width < 200 || height < 120;

  if (widget.kind === 'kpi') {
    const fontSize = Math.max(16, Math.min(height * 0.42, 36));
    return (
      <div className="flex flex-col justify-center items-center h-full text-center">
        <p className="font-bold text-gray-100 tabular-nums" style={{ fontSize }}>{result.kpiValue ?? '—'}</p>
        {result.kpiHint && <p className="text-xs text-gray-500 mt-1">{result.kpiHint}</p>}
      </div>
    );
  }

  if (widget.kind === 'attention') {
    const items = result.attentionItems || [];
    return (
      <div className="h-full min-h-0 overflow-y-auto space-y-1.5">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className="flex items-center justify-between gap-2 text-[11px] border-b border-gray-700/30 pb-1.5 hover:bg-gray-700/20 rounded px-1 -mx-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm shrink-0">{item.icon}</span>
              <span className="text-gray-200 truncate">{item.label}</span>
            </div>
            <span className="text-amber-300 font-semibold tabular-nums shrink-0">{item.count}</span>
          </Link>
        ))}
        {!items.length && <p className="text-xs text-gray-500 text-center py-4">Nothing needs attention</p>}
      </div>
    );
  }

  if (widget.kind === 'activity') {
    const items = result.activityItems || [];
    return (
      <div className="h-full min-h-0 overflow-y-auto space-y-2">
        {items.map((item, i) => (
          <div key={i} className="border-b border-gray-700/30 pb-1.5">
            <div className="flex justify-between gap-2">
              <p className="text-[11px] font-medium text-gray-200">{item.label}</p>
              <span className="text-[9px] text-gray-500 shrink-0">{formatTime(item.at)}</span>
            </div>
            <p className="text-[10px] text-gray-400 truncate">{item.description}</p>
            {item.userName && <p className="text-[9px] text-gray-600">{item.userName}</p>}
          </div>
        ))}
        {!items.length && <p className="text-xs text-gray-500 text-center py-4">No recent activity</p>}
      </div>
    );
  }

  if (widget.kind === 'chart' && result.points?.length) {
    const chartType = widget.chartType || 'horizontal_bar';
    if (chartType === 'donut') {
      return (
        <DonutChart
          segments={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#6b7280' }))}
          containerWidth={width}
          containerHeight={height}
          valueFormatter={(v) => String(v)}
        />
      );
    }
    return (
      <HorizontalBars
        items={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#3b82f6', hint: p.hint }))}
        valueFormatter={(v) => String(v)}
        containerHeight={height}
        compact={compact}
      />
    );
  }

  if (widget.kind === 'warranty_overview' && result.warranty) {
    const { active, expiring, expired } = result.warranty;
    return (
      <div className="grid grid-cols-3 gap-2 h-full items-center">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2 py-2 text-center">
          <p className="text-[9px] text-emerald-400 uppercase">Active</p>
          <p className="text-lg font-bold text-emerald-200 tabular-nums">{active}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-2 py-2 text-center">
          <p className="text-[9px] text-amber-400 uppercase">Expiring</p>
          <p className="text-lg font-bold text-amber-200 tabular-nums">{expiring}</p>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-2 py-2 text-center">
          <p className="text-[9px] text-red-400 uppercase">Expired</p>
          <p className="text-lg font-bold text-red-200 tabular-nums">{expired}</p>
        </div>
      </div>
    );
  }

  if (widget.kind === 'notifications') {
    const items = result.notifications || [];
    return (
      <div className="h-full min-h-0 overflow-y-auto space-y-1.5">
        {items.map((n, i) => (
          <Link key={i} href={n.href} className="block rounded-lg border border-amber-500/20 bg-amber-950/15 px-2 py-1.5 text-[11px] text-amber-200 hover:bg-amber-950/30">
            {n.message}
          </Link>
        ))}
        {!items.length && <p className="text-xs text-gray-500 text-center py-4">No notifications</p>}
      </div>
    );
  }

  if (widget.kind === 'financial') {
    const fin = result.financial;
    if (!fin?.enabled) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center px-2">
          <p className="text-xs text-gray-500">Financial metrics require Pro or Premium</p>
          <Link href="/dashboard/subscriptions" className="text-[11px] text-violet-400 mt-2 hover:underline">Upgrade plan</Link>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-2 h-full justify-center">
        <div className="flex justify-between text-[11px] border-b border-gray-700/30 pb-1">
          <span className="text-gray-500">Purchase value</span>
          <span className="text-gray-200 font-medium tabular-nums">{formatINR(fin.purchaseValue)}</span>
        </div>
        <div className="flex justify-between text-[11px] border-b border-gray-700/30 pb-1">
          <span className="text-gray-500">Book value</span>
          <span className="text-gray-200 font-medium tabular-nums">{formatINR(fin.bookValue)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-500">Depreciation</span>
          <span className="text-gray-200 font-medium tabular-nums">{formatINR(fin.depreciation)}</span>
        </div>
      </div>
    );
  }

  if (widget.kind === 'latest_assets') {
    const items = result.latestAssets || [];
    return (
      <div className="h-full min-h-0 overflow-y-auto space-y-1.5">
        {items.map((a) => (
          <Link key={a.id} href={`/dashboard/assets/${a.id}`} className="flex items-center justify-between gap-2 text-[11px] border-b border-gray-700/30 pb-1 hover:bg-gray-700/20 rounded px-1 -mx-1">
            <div className="min-w-0">
              <p className="text-gray-200 truncate">{a.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{a.assetIdString} · {a.category}</p>
            </div>
            <span className="text-[9px] text-gray-600 shrink-0">{formatTime(a.createdAt)}</span>
          </Link>
        ))}
        {!items.length && <p className="text-xs text-gray-500 text-center py-4">No assets</p>}
      </div>
    );
  }

  if (widget.kind === 'performance' && result.performance) {
    const { avgResolutionHours, utilizationPct, avgHealthScore } = result.performance;
    return (
      <div className="grid grid-cols-3 gap-2 h-full items-center">
        <div className="text-center px-1">
          <p className="text-[9px] text-gray-500 uppercase">Avg resolution</p>
          <p className="text-lg font-bold text-gray-100 tabular-nums">{avgResolutionHours}h</p>
        </div>
        <div className="text-center px-1">
          <p className="text-[9px] text-gray-500 uppercase">Utilization</p>
          <p className="text-lg font-bold text-gray-100 tabular-nums">{utilizationPct}%</p>
        </div>
        <div className="text-center px-1">
          <p className="text-[9px] text-gray-500 uppercase">Avg health</p>
          <p className="text-lg font-bold text-gray-100 tabular-nums">{avgHealthScore}</p>
        </div>
      </div>
    );
  }

  if (widget.kind === 'system_status' && result.system) {
    const sys = result.system;
    return (
      <div className="h-full flex flex-col justify-center gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 uppercase">Plan tier</span>
          <span className="text-sm font-semibold text-violet-300 capitalize">{sys.tier}</span>
        </div>
        <LimitBar label="Assets" count={sys.assetCount} limit={sys.assetLimit} />
        <LimitBar label="Users" count={sys.userCount} limit={sys.userLimit} />
        {sys.daysRemaining != null && sys.tier !== 'free' && (
          <p className="text-[10px] text-gray-500 text-center">
            {sys.isExpired ? 'Subscription expired' : `${sys.daysRemaining} days remaining`}
          </p>
        )}
      </div>
    );
  }

  return <p className="text-xs text-gray-500 h-full flex items-center justify-center">No data</p>;
}
