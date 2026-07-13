'use client';

import type { ContainerSize } from '@/hooks/useContainerSize';
import type { HealthWidget, HealthWidgetResult } from '@/lib/assetHealthWidgets';
import { DonutChart, GaugeChart, HorizontalBars } from '@/components/kpis/KpiCharts';

function HealthTrendChart({
  points,
  width,
  height,
}: {
  points: Array<{ label: string; value: number }>;
  width: number;
  height: number;
}) {
  if (!points.length) {
    return <p className="text-xs text-gray-500 text-center py-4">No trend data yet — snapshots are recorded daily when you view this dashboard</p>;
  }

  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const w = Math.max(width - padL - padR, 40);
  const h = Math.max(height - padT - padB, 40);
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padL + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
    const y = padT + h - ((p.value - min) / range) * (h - 4);
    return { x, y, ...p };
  });

  return (
    <div className="h-full w-full min-h-0 flex flex-col">
      <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(width, 120)} ${Math.max(height, 80)}`} preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + h - t * (h - 4);
          const val = Math.round(min + t * range);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={padL + w} y2={y} stroke="rgb(55 65 81 / 0.35)" strokeWidth="1" />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#6b7280">{val}</text>
            </g>
          );
        })}
        {coords.length > 1 && (
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          />
        )}
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={points.length === 1 ? 5 : 3.5} fill="#3b82f6" />
            <text x={c.x} y={padT + h + 14} textAnchor="middle" fontSize="8" fill="#9ca3af">{c.label}</text>
          </g>
        ))}
      </svg>
      {points.length < 2 && (
        <p className="text-[10px] text-gray-600 text-center mt-1">Current score — trend line appears after more daily snapshots</p>
      )}
    </div>
  );
}

export default function AssetHealthWidgetRenderer({
  widget,
  result,
  containerSize,
}: {
  widget: HealthWidget;
  result: HealthWidgetResult;
  containerSize: ContainerSize;
}) {
  const { width, height } = containerSize;
  const metric = widget.metric || 'avg_health_score';
  const chartType = widget.chartType || 'kpi';

  if (widget.kind === 'quick' && result.listRows) {
    return (
      <div className="h-full min-h-0 overflow-y-auto space-y-1.5">
        {result.listRows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-[11px] border-b border-gray-700/30 pb-1">
            <div className="min-w-0">
              <p className="text-gray-200 truncate">{row.primary}</p>
              {row.secondary && <p className="text-gray-500 truncate text-[10px]">{row.secondary}</p>}
            </div>
            {row.meta && <span className="text-gray-400 shrink-0 text-[10px]">{row.meta}</span>}
          </div>
        ))}
        {!result.listRows.length && <p className="text-xs text-gray-500 text-center py-4">No data</p>}
      </div>
    );
  }

  if (metric === 'health_trend' && chartType === 'line') {
    return <HealthTrendChart points={result.linePoints || []} width={width} height={height} />;
  }

  if (chartType === 'kpi') {
    const fontSize = Math.max(16, Math.min(height * 0.42, 36));
    return (
      <div className="flex flex-col justify-center items-center h-full text-center">
        <p className="font-bold text-gray-100 tabular-nums" style={{ fontSize }}>{result.kpiValue ?? '—'}</p>
        {result.kpiHint && <p className="text-[10px] text-gray-500 mt-1 px-2">{result.kpiHint}</p>}
      </div>
    );
  }

  if (chartType === 'gauge' && result.gaugeValue != null) {
    return <GaugeChart value={result.gaugeValue} max={result.gaugeMax || 100} label={result.kpiValue} size={Math.min(width, height) - 16} />;
  }

  if (chartType === 'table' && result.tableRows?.length) {
    return (
      <div className="h-full overflow-y-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-gray-500 border-b border-gray-700/50"><th className="text-left py-1">Date</th><th className="text-right py-1">Avg score</th></tr></thead>
          <tbody className="divide-y divide-gray-700/30">
            {result.tableRows.map((r) => (
              <tr key={r.label}><td className="py-1 text-gray-300 truncate">{r.label}</td><td className="py-1 text-right text-gray-200">{r.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (chartType === 'donut' && result.points.length) {
    return (
      <DonutChart
        segments={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#6b7280' }))}
        containerWidth={width}
        containerHeight={height}
        valueFormatter={(v) => String(v)}
      />
    );
  }

  if ((chartType === 'horizontal_bar' || chartType === 'bar') && result.points.length) {
    return (
      <HorizontalBars
        items={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#3b82f6', hint: p.hint }))}
        valueFormatter={(v) => String(v)}
        containerHeight={height}
        compact={width < 200}
      />
    );
  }

  return <p className="text-xs text-gray-500 h-full flex items-center justify-center">No data</p>;
}
