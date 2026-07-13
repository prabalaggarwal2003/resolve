'use client';

import { useEffect, useState } from 'react';
import {
  CHART_METRIC_OPTIONS,
  KPI_METRIC_OPTIONS,
  isCustomHomeWidget,
  newHomeWidget,
  type HomeWidget,
} from '@/lib/homeDashboardWidgets';
import {
  BUDGET_GROUP_BY_OPTIONS,
  BUDGET_METRIC_OPTIONS,
  BUDGET_QUICK_OPTIONS,
  isBudgetWidget,
  withBudgetFilterDefaults,
} from '@/lib/kpiBudgetBridge';
import { COMBINED_GROUP_BY_OPTIONS } from '@/lib/kpiWidgetCatalog';
import {
  CHART_TYPE_OPTIONS,
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  QUICK_WIDGET_OPTIONS,
  type KpiChartType,
  type KpiGroupBy,
  type KpiMetric,
  type KpiQuickType,
} from '@/lib/kpiWidgets';

const inputClass = 'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const labelClass = 'text-[10px] text-gray-500 uppercase block mb-0.5';

function CustomWidgetForm({
  form,
  setForm,
}: {
  form: HomeWidget;
  setForm: React.Dispatch<React.SetStateAction<HomeWidget>>;
}) {
  const usesBudget = isBudgetWidget({ metric: form.metric, quickType: form.quickType });
  const groupOptions = usesBudget ? COMBINED_GROUP_BY_OPTIONS : GROUP_BY_OPTIONS;
  const chartMeta = CHART_TYPE_OPTIONS.find((c) => c.id === form.chartType);
  const needsGroupBy = form.kind === 'metric' && chartMeta?.needsGroupBy !== false && form.chartType !== 'kpi';

  const patchForm = (patch: Partial<HomeWidget>) => {
    setForm((prev) => withBudgetFilterDefaults({ ...prev, ...patch }));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Title</label>
        <input className={inputClass} value={form.title} onChange={(e) => patchForm({ title: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>Widget type</label>
        <select
          className={inputClass}
          value={form.kind}
          onChange={(e) => patchForm({ kind: e.target.value as 'metric' | 'quick' })}
        >
          <option value="metric">Metric / chart</option>
          <option value="quick">Quick list widget</option>
        </select>
      </div>
      {form.kind === 'quick' ? (
        <div>
          <label className={labelClass}>Quick widget</label>
          <select
            className={inputClass}
            value={form.quickType || ''}
            onChange={(e) => patchForm({ quickType: e.target.value })}
          >
            <option value="">Select…</option>
            <optgroup label="Assets">
              {QUICK_WIDGET_OPTIONS.map((q) => (
                <option key={q.id} value={q.id}>{q.label}</option>
              ))}
            </optgroup>
            <optgroup label="Budget & procurement">
              {BUDGET_QUICK_OPTIONS.map((q) => (
                <option key={q.id} value={q.id}>{q.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Metric</label>
              <select
                className={inputClass}
                value={form.metric || ''}
                onChange={(e) => patchForm({ metric: e.target.value })}
              >
                <option value="">Select…</option>
                <optgroup label="Assets">
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Budget & procurement">
                  {BUDGET_METRIC_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className={labelClass}>Chart type</label>
              <select
                className={inputClass}
                value={form.chartType || 'kpi'}
                onChange={(e) => patchForm({ chartType: e.target.value as KpiChartType })}
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
                onChange={(e) => patchForm({ groupBy: (e.target.value || null) as KpiGroupBy })}
              >
                <option value="">Auto</option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
                {usesBudget && BUDGET_GROUP_BY_OPTIONS.filter((g) => !groupOptions.some((x) => x.id === g.id)).map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Time range</label>
          <select
            className={inputClass}
            value={form.timeRange || ''}
            onChange={(e) => patchForm({ timeRange: e.target.value || undefined })}
          >
            <option value="">All time</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Sort</label>
          <select
            className={inputClass}
            value={form.sortOrder || 'desc'}
            onChange={(e) => patchForm({ sortOrder: e.target.value as 'asc' | 'desc' })}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Limit</label>
          <select
            className={inputClass}
            value={form.limit || 10}
            onChange={(e) => patchForm({ limit: Number(e.target.value) })}
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={15}>Top 15</option>
            <option value={20}>Top 20</option>
          </select>
        </div>
      </div>
      <p className="text-[11px] text-gray-600">Add filters on the widget card after saving.</p>
    </div>
  );
}

function BuiltinWidgetForm({
  form,
  setForm,
}: {
  form: HomeWidget;
  setForm: React.Dispatch<React.SetStateAction<HomeWidget>>;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Title</label>
        <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </div>
      {form.kind === 'kpi' && (
        <div>
          <label className={labelClass}>Metric</label>
          <select
            className={inputClass}
            value={form.metric || 'total_assets'}
            onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as HomeWidget['metric'] }))}
          >
            {KPI_METRIC_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      {form.kind === 'chart' && (
        <>
          <div>
            <label className={labelClass}>Distribution</label>
            <select
              className={inputClass}
              value={form.metric || 'by_group'}
              onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as HomeWidget['metric'] }))}
            >
              {CHART_METRIC_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Chart type</label>
            <select
              className={inputClass}
              value={form.chartType || 'horizontal_bar'}
              onChange={(e) => setForm((f) => ({ ...f, chartType: e.target.value as 'donut' | 'horizontal_bar' }))}
            >
              <option value="horizontal_bar">Horizontal bar</option>
              <option value="donut">Donut</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

export default function HomeWidgetEditor({
  widget,
  onSave,
  onCancel,
}: {
  widget: HomeWidget;
  onSave: (w: HomeWidget) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<HomeWidget>(widget);
  const isCustom = isCustomHomeWidget(widget) || isCustomHomeWidget(form);

  useEffect(() => setForm(widget), [widget]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-200 mb-4">
          {isCustom ? 'Configure widget' : 'Edit widget'}
        </h3>
        {isCustom ? (
          <CustomWidgetForm form={form} setForm={setForm} />
        ) : (
          <BuiltinWidgetForm form={form} setForm={setForm} />
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg border border-gray-700/60 text-gray-400">Cancel</button>
          <button
            type="button"
            onClick={() => onSave(withBudgetFilterDefaults(form))}
            className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          >
            Save widget
          </button>
        </div>
      </div>
    </div>
  );
}
