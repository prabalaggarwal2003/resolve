'use client';

import { useEffect, useState } from 'react';
import {
  CHART_TYPE_OPTIONS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  type DepreciationWidget,
  type WidgetChartType,
  type WidgetGroupBy,
  type WidgetMetric,
} from '@/lib/depreciationWidgets';

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const labelClass = 'text-[10px] text-gray-500 uppercase block mb-0.5';

export default function DepreciationWidgetEditor({
  widget,
  onSave,
  onCancel,
}: {
  widget: DepreciationWidget;
  onSave: (w: DepreciationWidget) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<DepreciationWidget>(widget);

  useEffect(() => {
    setForm(widget);
  }, [widget]);

  const chartMeta = CHART_TYPE_OPTIONS.find((c) => c.id === form.chartType);
  const needsGroupBy = chartMeta?.needsGroupBy !== false && form.chartType !== 'kpi';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-100 mb-4">Configure widget</p>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Title</label>
            <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Metric</label>
              <select
                className={inputClass}
                value={form.metric}
                onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as WidgetMetric }))}
              >
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Chart type</label>
              <select
                className={inputClass}
                value={form.chartType}
                onChange={(e) => {
                  const chartType = e.target.value as WidgetChartType;
                  setForm((f) => ({
                    ...f,
                    chartType,
                    groupBy: chartType === 'kpi' ? null : f.groupBy || 'group',
                  }));
                }}
              >
                {CHART_TYPE_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {needsGroupBy && (
            <div>
              <label className={labelClass}>Group by</label>
              <select
                className={inputClass}
                value={form.groupBy || ''}
                onChange={(e) => setForm((f) => ({ ...f, groupBy: (e.target.value || null) as WidgetGroupBy }))}
              >
                <option value="">Auto</option>
                {GROUP_BY_OPTIONS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
                <option value="asset">Individual asset</option>
              </select>
            </div>
          )}

          <p className="text-[11px] text-gray-600 pt-1">
            Add filters on the widget card. Drag the corner handle to resize, or use Auto to fit to data.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg border border-gray-700/60 text-gray-400">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          >
            Save widget
          </button>
        </div>
      </div>
    </div>
  );
}
