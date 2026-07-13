'use client';

import { useEffect, useState } from 'react';
import {
  CHART_TYPE_OPTIONS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  QUICK_WIDGET_OPTIONS,
  WIDGET_LIBRARY,
  newBudgetWidget,
  type BudgetChartType,
  type BudgetGroupBy,
  type BudgetMetric,
  type BudgetQuickType,
  type BudgetWidget,
} from '@/lib/budgetWidgets';

const inputClass = 'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const labelClass = 'text-[10px] text-gray-500 uppercase block mb-0.5';

export default function BudgetWidgetEditor({
  widget,
  onSave,
  onCancel,
}: {
  widget: BudgetWidget;
  onSave: (w: BudgetWidget) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<BudgetWidget>(widget);
  const [tab, setTab] = useState<'config' | 'library'>('config');

  useEffect(() => setForm(widget), [widget]);

  const chartMeta = CHART_TYPE_OPTIONS.find((c) => c.id === form.chartType);
  const needsGroupBy = form.kind === 'metric' && chartMeta?.needsGroupBy !== false && form.chartType !== 'kpi';

  const applyLibraryItem = (partial: Partial<BudgetWidget>, title: string) => {
    setForm(newBudgetWidget({ ...partial, id: form.id, title, order: form.order, colSpan: form.colSpan, rowSpan: form.rowSpan }));
    setTab('config');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setTab('config')} className={`px-3 py-1 text-xs rounded-lg border ${tab === 'config' ? 'border-violet-500/50 text-violet-300' : 'border-gray-700/60 text-gray-500'}`}>Configure</button>
          <button type="button" onClick={() => setTab('library')} className={`px-3 py-1 text-xs rounded-lg border ${tab === 'library' ? 'border-violet-500/50 text-violet-300' : 'border-gray-700/60 text-gray-500'}`}>Widget library</button>
        </div>

        {tab === 'library' ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {WIDGET_LIBRARY.map((cat) => (
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
                <label className={labelClass}>Quick widget</label>
                <select className={inputClass} value={form.quickType || ''} onChange={(e) => setForm((f) => ({ ...f, quickType: e.target.value as BudgetQuickType }))}>
                  <option value="">Select…</option>
                  {QUICK_WIDGET_OPTIONS.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Metric</label>
                    <select className={inputClass} value={form.metric || ''} onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as BudgetMetric }))}>
                      {METRIC_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Chart type</label>
                    <select className={inputClass} value={form.chartType || 'kpi'} onChange={(e) => setForm((f) => ({ ...f, chartType: e.target.value as BudgetChartType }))}>
                      {CHART_TYPE_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                {needsGroupBy && (
                  <div>
                    <label className={labelClass}>Group by</label>
                    <select className={inputClass} value={form.groupBy || ''} onChange={(e) => setForm((f) => ({ ...f, groupBy: (e.target.value || null) as BudgetGroupBy }))}>
                      <option value="">Auto</option>
                      {GROUP_BY_OPTIONS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Time range</label>
                <select className={inputClass} value={form.timeRange || ''} onChange={(e) => setForm((f) => ({ ...f, timeRange: e.target.value || undefined }))}>
                  <option value="">All time</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
              </div>
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
