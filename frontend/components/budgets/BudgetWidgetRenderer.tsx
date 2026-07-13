'use client';

import type { ContainerSize } from '@/hooks/useContainerSize';
import type { BudgetWidget, BudgetWidgetResult } from '@/lib/budgetWidgets';
import { computeBudgetWidgetData, formatBudgetMetric } from '@/lib/budgetWidgets';
import { DonutChart, GaugeChart, HorizontalBars, ProgressRing } from '@/components/kpis/KpiCharts';
import { BookValueTrendChart } from '@/components/depreciation/DepreciationCharts';

export default function BudgetWidgetRenderer({
  widget,
  result,
  containerSize,
}: {
  widget: BudgetWidget;
  result: BudgetWidgetResult;
  containerSize: ContainerSize;
}) {
  const { width, height } = containerSize;
  const compact = width < 200 || height < 120;
  const metric = widget.metric || 'total_allocated';
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
        valueFormatter={(v) => formatBudgetMetric(metric, v)}
      />
    );
  }

  if (chartType === 'stacked_bar' && result.points.length) {
    const rowH = compact ? 28 : 34;
    const maxItems = Math.max(1, Math.floor(height / rowH));
    const points = result.points.slice(0, maxItems);
    const fontSize = compact ? 10 : 12;
    const barH = compact ? 6 : 10;
    return (
      <div className="h-full min-h-0 flex flex-col justify-center gap-1.5 overflow-hidden">
        {points.map((p) => {
          const planned = p.stack?.Planned ?? 0;
          const actual = p.stack?.Actual ?? p.value;
          const total = planned + actual || 1;
          return (
            <div key={p.label}>
              <div className="flex justify-between text-gray-400 mb-0.5" style={{ fontSize }}>
                <span className="truncate">{p.label}</span>
                <span className="tabular-nums shrink-0 ml-1">{formatBudgetMetric(metric, actual)}</span>
              </div>
              <div className="rounded-full overflow-hidden flex bg-gray-900/60" style={{ height: barH }}>
                <div className="h-full bg-blue-500/70" style={{ width: `${(planned / total) * 100}%` }} />
                <div className="h-full bg-emerald-500/80" style={{ width: `${(actual / total) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if ((chartType === 'line' || chartType === 'area') && result.points.length) {
    return (
      <BookValueTrendChart
        points={result.points.map((p) => ({
          year: Number(p.label.replace(/\D/g, '').slice(0, 4)) || 0,
          purchase: p.stack?.Planned ?? p.value,
          book: p.stack?.Actual ?? p.value,
        }))}
        containerHeight={height}
      />
    );
  }

  if (chartType === 'bar' && result.points.length) {
    const max = Math.max(...result.points.map((p) => p.value), 1);
    const labelH = compact ? 12 : 16;
    const barAreaH = Math.max(40, height - labelH - 8);
    const maxBars = Math.max(2, Math.floor(width / (compact ? 20 : 28)));
    const points = result.points.slice(0, maxBars);
    const labelSize = compact ? 7 : 8;
    return (
      <div className="flex items-end gap-0.5 h-full min-h-0 pt-1">
        {points.map((p) => (
          <div key={p.label} className="flex-1 flex flex-col items-center gap-0.5 min-w-0 h-full">
            <div className="w-full flex items-end justify-center flex-1 min-h-0" style={{ maxHeight: barAreaH }}>
              <div
                className="w-full max-w-[24px] rounded-t"
                style={{ height: `${(p.value / max) * 100}%`, backgroundColor: p.color || '#3b82f6', minHeight: p.value > 0 ? 3 : 0 }}
                title={`${p.label}: ${formatBudgetMetric(metric, p.value)}`}
              />
            </div>
            <span className="text-gray-500 truncate w-full text-center leading-none" style={{ fontSize: labelSize, height: labelH }}>
              {p.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (chartType === 'horizontal_bar' && result.points.length) {
    return (
      <HorizontalBars
        items={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#3b82f6', hint: p.hint }))}
        valueFormatter={(v) => formatBudgetMetric(metric, v)}
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
      valueFormatter={(v) => formatBudgetMetric(metric, v)}
      containerHeight={height}
      compact={compact}
    />
  );
}

export function buildBudgetWidgetResult(ctx: Parameters<typeof computeBudgetWidgetData>[0], widget: BudgetWidget) {
  return computeBudgetWidgetData(ctx, widget);
}
