'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  HEALTH_CHART_TYPE_OPTIONS,
  HEALTH_GROUP_BY_OPTIONS,
  HEALTH_METRIC_OPTIONS,
  HEALTH_QUICK_OPTIONS,
  HEALTH_WIDGET_LIBRARY,
  chartTypesForHealthMetric,
  newHealthWidget,
  type HealthChartType,
  type HealthGroupBy,
  type HealthMetric,
  type HealthQuickType,
  type HealthWidget,
} from '@/lib/assetHealthWidgets';

const inputClass = 'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const labelClass = 'text-[10px] text-gray-500 uppercase block mb-0.5';

export default function AssetHealthWidgetEditor({
  widget,
  onSave,
  onCancel,
}: {
  widget: HealthWidget;
  onSave: (w: HealthWidget) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<HealthWidget>(widget);
  const [tab, setTab] = useState<'config' | 'library'>('config');

  useEffect(() => setForm(widget), [widget]);

  const allowedCharts = useMemo(
    () => chartTypesForHealthMetric(form.metric, form.kind),
    [form.metric, form.kind]
  );

  const chartMeta = HEALTH_CHART_TYPE_OPTIONS.find((c) => c.id === form.chartType);
  const needsGroupBy = form.kind === 'metric'
    && chartMeta?.needsGroupBy !== false
    && form.chartType !== 'kpi'
    && form.chartType !== 'gauge'
    && form.metric !== 'health_trend';

  const applyLibraryItem = (partial: Partial<HealthWidget>, title: string) => {
    setForm(newHealthWidget({ ...partial, id: form.id, title, order: form.order, colSpan: form.colSpan, rowSpan: form.rowSpan }));
    setTab('config');
  };

  const metricCategories = useMemo(() => {
    const cats = new Map<string, typeof HEALTH_METRIC_OPTIONS>();
    for (const m of HEALTH_METRIC_OPTIONS) {
      if (!cats.has(m.category)) cats.set(m.category, []);
      cats.get(m.category)!.push(m);
    }
    return Array.from(cats.entries());
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Add health widget</h2>
        <p className="text-xs text-gray-500 mb-4">Pick a metric and visualization, or choose from the library.</p>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setTab('config')} className={`px-3 py-1 text-xs rounded-lg border ${tab === 'config' ? 'border-violet-500/50 text-violet-300' : 'border-gray-700/60 text-gray-500'}`}>Configure</button>
          <button type="button" onClick={() => setTab('library')} className={`px-3 py-1 text-xs rounded-lg border ${tab === 'library' ? 'border-violet-500/50 text-violet-300' : 'border-gray-700/60 text-gray-500'}`}>Widget library</button>
        </div>

        {tab === 'library' ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {HEALTH_WIDGET_LIBRARY.map((cat) => (
              <div key={cat.category}>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{cat.category}</p>
                <div className="grid grid-cols-2 gap-2">
                  {cat.items.map((item) => (
                    <button key={item.title} type="button" onClick={() => applyLibraryItem(item.widget, item.title)} className="text-left px-3 py-2 rounded-lg border border-gray-700/60 hover:border-violet-500/40 text-xs text-gray-300">
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Title</label>
              <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Widget type</label>
              <select className={inputClass} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as 'metric' | 'quick' }))}>
                <option value="metric">Metric / chart</option>
                <option value="quick">Quick list</option>
              </select>
            </div>

            {form.kind === 'quick' ? (
              <div>
                <label className={labelClass}>List widget</label>
                <select className={inputClass} value={form.quickType || ''} onChange={(e) => setForm((f) => ({ ...f, quickType: e.target.value as HealthQuickType }))}>
                  <option value="">Select…</option>
                  {HEALTH_QUICK_OPTIONS.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Health metric</label>
                  <select
                    className={inputClass}
                    value={form.metric || ''}
                    onChange={(e) => {
                      const metric = e.target.value as HealthMetric;
                      const charts = chartTypesForHealthMetric(metric, 'metric');
                      setForm((f) => ({
                        ...f,
                        metric,
                        chartType: charts.includes(f.chartType || 'kpi') ? f.chartType : charts[0],
                      }));
                    }}
                  >
                    {metricCategories.map(([cat, items]) => (
                      <optgroup key={cat} label={cat}>
                        {items.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Visualization</label>
                    <select
                      className={inputClass}
                      value={form.chartType || 'kpi'}
                      onChange={(e) => setForm((f) => ({ ...f, chartType: e.target.value as HealthChartType }))}
                    >
                      {HEALTH_CHART_TYPE_OPTIONS.filter((c) => allowedCharts.includes(c.id)).map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  {needsGroupBy && (
                    <div>
                      <label className={labelClass}>Group by</label>
                      <select className={inputClass} value={form.groupBy || 'group'} onChange={(e) => setForm((f) => ({ ...f, groupBy: (e.target.value || null) as HealthGroupBy }))}>
                        {HEALTH_GROUP_BY_OPTIONS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Sort</label>
                <select className={inputClass} value={form.sortOrder || 'desc'} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value as 'asc' | 'desc' }))}>
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Limit</label>
                <select className={inputClass} value={form.limit || 10} onChange={(e) => setForm((f) => ({ ...f, limit: Number(e.target.value) }))}>
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={15}>Top 15</option>
                  <option value={20}>Top 20</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-gray-600">Add per-widget filters on the card after saving.</p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg border border-gray-700/60 text-gray-400">Cancel</button>
          <button type="button" onClick={() => onSave(form)} className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Save widget</button>
        </div>
      </div>
    </div>
  );
}
