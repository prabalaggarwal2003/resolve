'use client';

import { formatCurrency } from '@/lib/depreciation';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#84cc16', '#ec4899'];

export function ChartPanel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 ${className}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
      {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

export function DonutChart({
  segments,
  size: sizeProp,
  containerWidth,
  containerHeight,
  centerLabel,
  centerValue,
  valueFormatter = (v: number) => String(v),
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  containerWidth?: number;
  containerHeight?: number;
  centerLabel?: string;
  centerValue?: string | number;
  valueFormatter?: (value: number) => string;
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const compact = (containerWidth ?? 999) < 220;
  const size = sizeProp ?? (() => {
    if (!containerWidth || !containerHeight) return 128;
    const budget = compact
      ? Math.min(containerWidth - 16, containerHeight - 24)
      : Math.min(containerWidth * 0.38, containerHeight - 16);
    return Math.max(48, Math.min(budget, 160));
  })();
  const strokeWidth = Math.max(8, Math.round(size * 0.11));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter((seg) => seg.value > 0);

  if (total === 0) {
    return <p className="text-xs text-gray-500 py-8 text-center">No data for current filters</p>;
  }

  let offset = 0;
  const centerFont = Math.max(10, Math.min(size * 0.14, 16));
  const labelFont = compact ? 10 : 12;

  return (
    <div className={`flex h-full min-h-0 ${compact ? 'flex-col items-center justify-center gap-2' : 'flex-row items-center gap-3'}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(55 65 81 / 0.6)" strokeWidth={strokeWidth} />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
            {centerValue !== undefined && (
              <p className="font-bold text-gray-100 leading-tight" style={{ fontSize: centerFont }}>{centerValue}</p>
            )}
            {centerLabel && (
              <p className="text-gray-500 uppercase tracking-wide mt-0.5" style={{ fontSize: Math.max(8, centerFont * 0.65) }}>{centerLabel}</p>
            )}
          </div>
        )}
      </div>
      <div className={`min-w-0 space-y-1 ${compact ? 'w-full max-h-[40%] overflow-y-auto' : 'flex-1'}`}>
        {visible.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5" style={{ fontSize: labelFont }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-400 truncate flex-1">{seg.label}</span>
            <span className="text-gray-200 font-medium tabular-nums shrink-0">{valueFormatter(seg.value)}</span>
            {!compact && (
              <span className="text-gray-600 tabular-nums w-8 text-right shrink-0">{((seg.value / total) * 100).toFixed(0)}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBars({
  items,
  valueFormatter = (v: number) => String(v),
  containerHeight,
  compact,
}: {
  items: Array<{ label: string; value: number; color: string; hint?: string }>;
  valueFormatter?: (value: number) => string;
  containerHeight?: number;
  compact?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  if (!items.length) {
    return <p className="text-xs text-gray-500 py-6 text-center">No data for current filters</p>;
  }

  const rowHeight = compact ? 26 : 32;
  const maxVisible = containerHeight
    ? Math.max(1, Math.floor((containerHeight - 4) / rowHeight))
    : items.length;
  const visible = items.slice(0, maxVisible);
  const fontSize = compact ? 10 : 12;
  const barHeight = compact ? 6 : 8;

  return (
    <div className="h-full min-h-0 flex flex-col justify-center gap-1.5 overflow-hidden">
      {visible.map((item) => (
        <div key={item.label} style={{ minHeight: rowHeight - 4 }}>
          <div className="flex justify-between items-baseline gap-1 mb-0.5" style={{ fontSize }}>
            <span className="text-gray-300 truncate">{item.label}</span>
            <span className="text-gray-400 shrink-0 tabular-nums">
              {valueFormatter(item.value)}
              {!compact && item.hint ? ` · ${item.hint}` : ''}
            </span>
          </div>
          <div className="bg-gray-900/60 rounded-full overflow-hidden" style={{ height: barHeight }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
      {items.length > maxVisible && (
        <p className="text-[10px] text-gray-600 text-center shrink-0">+{items.length - maxVisible} more</p>
      )}
    </div>
  );
}

export function ComparisonBars({
  original,
  current,
}: {
  original: number;
  current: number;
}) {
  const max = Math.max(original, current, 1);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-[10px] text-gray-500 uppercase mb-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-500/80" /> Original value</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/80" /> Current value</span>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Original value</span>
          <span className="tabular-nums">{formatCurrency(original)}</span>
        </div>
        <div className="h-8 bg-gray-900/60 rounded-lg overflow-hidden">
          <div className="h-full bg-gray-500/75 rounded-lg" style={{ width: `${(original / max) * 100}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Current value</span>
          <span className="tabular-nums">{formatCurrency(current)}</span>
        </div>
        <div className="h-8 bg-gray-900/60 rounded-lg overflow-hidden">
          <div className="h-full bg-emerald-500/80 rounded-lg" style={{ width: `${(current / max) * 100}%` }} />
        </div>
      </div>
      <p className="text-[11px] text-gray-500">
        Depreciated: {formatCurrency(Math.max(0, original - current))} ({original > 0 ? (((original - current) / original) * 100).toFixed(1) : 0}%)
      </p>
    </div>
  );
}

export function BookValueTrendChart({
  points,
  containerHeight,
}: {
  points: Array<{ year: number; purchase: number; book: number }>;
  containerHeight?: number;
}) {
  if (!points.length) {
    return <p className="text-xs text-gray-500 py-6 text-center">No purchase year data</p>;
  }

  const h = Math.max(80, Math.min(containerHeight ? containerHeight - 28 : 140, 220));
  const w = 320;
  const pad = { t: 12, r: 12, b: 24, l: 8 };
  const max = Math.max(...points.flatMap((p) => [p.purchase, p.book]), 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const toX = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * innerW;
  const toY = (v: number) => pad.t + innerH - (v / max) * innerH;

  const line = (key: 'purchase' | 'book') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p[key]).toFixed(1)}`).join(' ');

  const area = (key: 'book') => {
    const baseline = pad.t + innerH;
    const top = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p[key]).toFixed(1)}`).join(' ');
    const close = ` L ${toX(points.length - 1).toFixed(1)} ${baseline} L ${toX(0).toFixed(1)} ${baseline} Z`;
    return top + close;
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex gap-3 text-[9px] text-gray-500 uppercase mb-1 shrink-0">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-500" /> Purchase</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400" /> Book value</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full flex-1 min-h-0" preserveAspectRatio="xMidYMid meet">
        {[0, 0.5, 1].map((f) => {
          const y = pad.t + innerH * (1 - f);
          return <line key={f} x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="rgb(55 65 81 / 0.35)" strokeWidth="1" />;
        })}
        <path d={area('book')} fill="rgb(16 185 129 / 0.12)" stroke="none" />
        <path d={line('purchase')} fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={line('book')} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.year}>
            <circle cx={toX(i)} cy={toY(p.book)} r="3" fill="#34d399" />
            <text x={toX(i)} y={h - 6} textAnchor="middle" className="fill-gray-500" fontSize="9">{p.year}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function colorAt(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export type DepreciationChartMetrics = {
  totalPurchase: number;
  totalBook: number;
  totalDepreciation: number;
  depreciationPct: number;
  fullyDepreciatedCount: number;
  purchaseVsCurrent: { original: number; current: number };
  valueDistribution: Array<{ label: string; value: number; color: string }>;
  depreciationByGroup: Array<{ label: string; value: number; color: string }>;
  bookValueTrend: Array<{ year: number; purchase: number; book: number }>;
  nearEndOfLife: Array<{ label: string; value: number; color: string; hint: string }>;
  groupComparison: Array<{ label: string; original: number; current: number }>;
};

export function computeChartMetrics(assets: Array<{
  financial: { purchaseCost: number; currentBookValue: number; totalDepreciation: number };
  indicators: { fullyDepreciated: boolean; nearEndOfLife: boolean; replacementRecommended: boolean };
  operational: { estimatedRemainingUsefulLife: number };
  groupName?: string | null;
  purchaseYear?: number | null;
  name: string;
  assetIdString: string;
}>): DepreciationChartMetrics {
  const totalPurchase = assets.reduce((s, a) => s + (a.financial.purchaseCost || 0), 0);
  const totalBook = assets.reduce((s, a) => s + (a.financial.currentBookValue || 0), 0);
  const totalDepreciation = totalPurchase - totalBook;
  const depreciationPct = totalPurchase > 0 ? Math.round((totalDepreciation / totalPurchase) * 1000) / 10 : 0;
  const fullyDepreciatedCount = assets.filter((a) => a.indicators?.fullyDepreciated).length;

  const buckets = [
    { label: 'Under ₹10K', min: 0, max: 10000 },
    { label: '₹10K – ₹50K', min: 10000, max: 50000 },
    { label: '₹50K – ₹1L', min: 50000, max: 100000 },
    { label: '₹1L – ₹5L', min: 100000, max: 500000 },
    { label: 'Over ₹5L', min: 500000, max: Infinity },
  ];
  const bucketTotals = buckets.map((b, i) => ({
    label: b.label,
    value: assets
      .filter((a) => {
        const v = a.financial.currentBookValue || 0;
        return v >= b.min && v < b.max;
      })
      .reduce((s, a) => s + (a.financial.currentBookValue || 0), 0),
    color: colorAt(i),
  })).filter((b) => b.value > 0);

  const groupMap: Record<string, { purchase: number; book: number; depreciation: number }> = {};
  for (const a of assets) {
    const g = a.groupName || 'Ungrouped';
    if (!groupMap[g]) groupMap[g] = { purchase: 0, book: 0, depreciation: 0 };
    groupMap[g].purchase += a.financial.purchaseCost || 0;
    groupMap[g].book += a.financial.currentBookValue || 0;
    groupMap[g].depreciation += (a.financial.purchaseCost || 0) - (a.financial.currentBookValue || 0);
  }

  const depreciationByGroup = Object.entries(groupMap)
    .map(([label, v], i) => ({ label, value: Math.round(v.depreciation * 100) / 100, color: colorAt(i) }))
    .sort((a, b) => b.value - a.value);

  const groupComparison = Object.entries(groupMap)
    .map(([label, v]) => ({ label, original: v.purchase, current: v.book }))
    .sort((a, b) => b.original - a.original);

  const yearMap: Record<number, { purchase: number; book: number }> = {};
  for (const a of assets) {
    const y = a.purchaseYear;
    if (!y) continue;
    if (!yearMap[y]) yearMap[y] = { purchase: 0, book: 0 };
    yearMap[y].purchase += a.financial.purchaseCost || 0;
    yearMap[y].book += a.financial.currentBookValue || 0;
  }
  const bookValueTrend = Object.entries(yearMap)
    .map(([year, v]) => ({ year: Number(year), purchase: v.purchase, book: v.book }))
    .sort((a, b) => a.year - b.year);

  const nearEndOfLife = assets
    .filter((a) => a.indicators?.nearEndOfLife || a.indicators?.replacementRecommended)
    .sort((a, b) => a.operational.estimatedRemainingUsefulLife - b.operational.estimatedRemainingUsefulLife)
    .slice(0, 8)
    .map((a, i) => ({
      label: a.name || a.assetIdString,
      value: Math.max(0, a.operational.estimatedRemainingUsefulLife),
      color: colorAt(i + 2),
      hint: `${a.operational.estimatedRemainingUsefulLife}y left`,
    }));

  return {
    totalPurchase,
    totalBook,
    totalDepreciation,
    depreciationPct,
    fullyDepreciatedCount,
    purchaseVsCurrent: { original: totalPurchase, current: totalBook },
    valueDistribution: bucketTotals,
    depreciationByGroup,
    bookValueTrend,
    nearEndOfLife,
    groupComparison,
  };
}
