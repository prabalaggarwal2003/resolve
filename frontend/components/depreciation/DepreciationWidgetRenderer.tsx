'use client';

import type { ContainerSize } from '@/hooks/useContainerSize';
import type { DepreciationWidget, WidgetResult } from '@/lib/depreciationWidgets';
import { formatWidgetValue } from '@/lib/depreciationWidgets';
import {
  BookValueTrendChart,
  DonutChart,
  HorizontalBars,
} from '@/components/depreciation/DepreciationCharts';
import { formatCurrency } from '@/lib/depreciation';

export default function DepreciationWidgetRenderer({
  widget,
  result,
  containerSize,
}: {
  widget: DepreciationWidget;
  result: WidgetResult;
  containerSize: ContainerSize;
}) {
  const { chartType, metric } = widget;
  const { width, height } = containerSize;
  const compact = width < 200 || height < 120;

  if (chartType === 'kpi') {
    const fontSize = Math.max(16, Math.min(height * 0.42, 36));
    const hintSize = Math.max(10, Math.min(fontSize * 0.45, 14));
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-0 text-center">
        <p className="font-bold text-gray-100 tabular-nums leading-none" style={{ fontSize }}>
          {result.kpiValue ?? '—'}
        </p>
        {result.kpiHint && (
          <p className="text-gray-500 mt-1" style={{ fontSize: hintSize }}>{result.kpiHint}</p>
        )}
      </div>
    );
  }

  if (chartType === 'table' && result.tableRows) {
    const rowH = compact ? 24 : 28;
    const maxRows = Math.max(2, Math.floor((height - 28) / rowH));
    const rows = result.tableRows.slice(0, maxRows);
    const fontSize = compact ? 10 : 12;
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        <table className="w-full" style={{ fontSize }}>
          <thead className="shrink-0">
            <tr className="text-gray-500 border-b border-gray-700/50">
              <th className="text-left py-1 font-medium">Group</th>
              <th className="text-right py-1 font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-1 text-gray-300 truncate max-w-0">{row.label}</td>
                <td className="py-1 text-right text-gray-200 tabular-nums whitespace-nowrap">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.tableRows.length > maxRows && (
          <p className="text-[10px] text-gray-600 text-center mt-1 shrink-0">
            +{result.tableRows.length - maxRows} more rows
          </p>
        )}
      </div>
    );
  }

  if (result.comparison && chartType === 'donut') {
    return (
      <DonutChart
        segments={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#6b7280' }))}
        centerValue={formatCurrency(result.comparison.original)}
        centerLabel="purchase"
        valueFormatter={formatCurrency}
        containerWidth={width}
        containerHeight={height}
      />
    );
  }

  if ((chartType === 'donut' || chartType === 'pie') && result.points.length) {
    return (
      <DonutChart
        segments={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#6b7280' }))}
        valueFormatter={(v) => formatWidgetValue(v, metric)}
        containerWidth={width}
        containerHeight={height}
      />
    );
  }

  if (chartType === 'horizontal_bar' && result.points.length) {
    return (
      <HorizontalBars
        items={result.points.map((p) => ({
          label: p.label,
          value: p.value,
          color: p.color || '#3b82f6',
          hint: p.hint,
        }))}
        valueFormatter={(v) => formatWidgetValue(v, metric)}
        containerHeight={height}
        compact={compact}
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
          const book = p.stack?.['Book value'] ?? 0;
          const dep = p.stack?.Depreciation ?? 0;
          const total = book + dep || 1;
          return (
            <div key={p.label}>
              <div className="flex justify-between text-gray-400 mb-0.5" style={{ fontSize }}>
                <span className="truncate">{p.label}</span>
                <span className="tabular-nums shrink-0 ml-1">{formatCurrency(total)}</span>
              </div>
              <div className="rounded-full overflow-hidden flex bg-gray-900/60" style={{ height: barH }}>
                <div className="h-full bg-emerald-500/80" style={{ width: `${(book / total) * 100}%` }} />
                <div className="h-full bg-red-500/70" style={{ width: `${(dep / total) * 100}%` }} />
              </div>
            </div>
          );
        })}
        {result.points.length > maxItems && (
          <p className="text-[10px] text-gray-600 text-center">+{result.points.length - maxItems} more</p>
        )}
      </div>
    );
  }

  if ((chartType === 'line' || chartType === 'area') && widget.groupBy === 'purchase_year') {
    return (
      <BookValueTrendChart
        points={result.points.map((p) => ({
          year: Number(p.label) || 0,
          purchase: p.stack?.Purchase ?? p.value,
          book: p.stack?.['Book value'] ?? p.value,
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
                style={{
                  height: `${(p.value / max) * 100}%`,
                  backgroundColor: p.color || '#3b82f6',
                  minHeight: p.value > 0 ? 3 : 0,
                }}
                title={`${p.label}: ${formatWidgetValue(p.value, metric)}`}
              />
            </div>
            <span
              className="text-gray-500 truncate w-full text-center leading-none"
              style={{ fontSize: labelSize, height: labelH }}
            >
              {p.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (!result.points.length) {
    return <p className="text-xs text-gray-500 h-full flex items-center justify-center">No data for current filters</p>;
  }

  return (
    <HorizontalBars
      items={result.points.map((p) => ({ label: p.label, value: p.value, color: p.color || '#3b82f6', hint: p.hint }))}
      valueFormatter={(v) => formatWidgetValue(v, metric)}
      containerHeight={height}
      compact={compact}
    />
  );
}
