'use client';

import type { ContainerSize } from '@/hooks/useContainerSize';
import type { KpiDataContext, KpiWidget, KpiWidgetResult } from '@/lib/kpiWidgets';
import { computeKpiWidgetData, formatKpiAggregate } from '@/lib/kpiWidgets';
import { DonutChart, GaugeChart, HorizontalBars, ProgressRing } from '@/components/kpis/KpiCharts';

function formatVal(metric: string, n: number) {
  return formatKpiAggregate(metric as never, n);
}

export default function KpiWidgetRenderer({
  widget,
  result,
  containerSize,
}: {
  widget: KpiWidget;
  result: KpiWidgetResult;
  containerSize: ContainerSize;
}) {
  const { width, height } = containerSize;
  const compact = width < 200 || height < 120;

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

  const chartType = widget.chartType || 'kpi';
  const metric = widget.metric || 'asset_count';

  if (chartType === 'kpi') {
    const fontSize = Math.max(16, Math.min(height * 0.42, 36));
    return (
      <div className="flex flex-col justify-center items-center h-full text-center">
        <p className="font-bold text-gray-100 tabular-nums" style={{ fontSize }}>{result.kpiValue ?? '—'}</p>
        {result.kpiHint && <p className="text-xs text-gray-500 mt-1">{result.kpiHint}</p>}
      </div>
    );
  }

  if (chartType === 'gauge' && result.gaugeValue != null) {
    return <GaugeChart value={result.gaugeValue} max={result.gaugeMax || 100} label={result.kpiValue} size={Math.min(width, height) - 16} />;
  }

  if (chartType === 'progress_ring' && result.gaugeValue != null) {
    return <ProgressRing value={result.gaugeValue} max={result.gaugeMax || 100} label={result.kpiValue} size={Math.min(width, height) - 16} />;
  }

  if (chartType === 'table' && result.tableRows) {
    return (
      <div className="h-full overflow-y-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-gray-500 border-b border-gray-700/50"><th className="text-left py-1">Group</th><th className="text-right py-1">Value</th></tr></thead>
          <tbody className="divide-y divide-gray-700/30">
            {result.tableRows.map((r) => (
              <tr key={r.label}><td className="py-1 text-gray-300 truncate">{r.label}</td><td className="py-1 text-right text-gray-200">{r.value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if ((chartType === 'donut' || chartType === 'pie') && result.points.length) {
    return (
      <DonutChart
        segments={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#6b7280' }))}
        containerWidth={width}
        containerHeight={height}
        valueFormatter={(v) => formatVal(metric, v)}
      />
    );
  }

  if ((chartType === 'horizontal_bar' || chartType === 'bar') && result.points.length) {
    return (
      <HorizontalBars
        items={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#3b82f6', hint: p.hint }))}
        valueFormatter={(v) => formatVal(metric, v)}
        containerHeight={height}
        compact={compact}
      />
    );
  }

  if (!result.points.length) {
    return <p className="text-xs text-gray-500 h-full flex items-center justify-center">No data</p>;
  }

  return (
    <HorizontalBars
      items={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#3b82f6', hint: p.hint }))}
      valueFormatter={(v) => formatVal(metric, v)}
      containerHeight={height}
      compact={compact}
    />
  );
}

export function buildKpiWidgetResult(ctx: KpiDataContext, widget: KpiWidget): KpiWidgetResult {
  return computeKpiWidgetData(ctx, widget);
}
