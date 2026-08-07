'use client';

import { useEffect, useState } from 'react';
import {
  newPartnerWidget,
  PARTNER_METRIC_OPTIONS,
  PARTNER_WIDGET_LIBRARY,
  type PartnerMetricKey,
  type PartnerWidget,
} from '@/lib/partnerDashboardWidgets';

const inputClass = 'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const labelClass = 'text-[10px] text-gray-500 uppercase block mb-0.5';

export default function PartnerWidgetEditor({
  widget,
  onSave,
  onCancel,
}: {
  widget: PartnerWidget;
  onSave: (w: PartnerWidget) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PartnerWidget>(widget);
  const [tab, setTab] = useState<'config' | 'library'>('config');

  useEffect(() => setForm(widget), [widget]);

  const applyLibraryItem = (item: {
    title: string;
    metric: PartnerMetricKey;
    kind: 'metric' | 'list';
    colSpan?: number;
    rowSpan?: number;
  }) => {
    setForm(
      newPartnerWidget({
        ...form,
        title: item.title,
        metric: item.metric,
        kind: item.kind,
        colSpan: item.colSpan,
        rowSpan: item.rowSpan,
      })
    );
    setTab('config');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab('config')}
            className={`px-3 py-1 text-xs rounded-lg border ${tab === 'config' ? 'border-violet-500/50 text-violet-300' : 'border-gray-700/60 text-gray-500'}`}
          >
            Configure
          </button>
          <button
            type="button"
            onClick={() => setTab('library')}
            className={`px-3 py-1 text-xs rounded-lg border ${tab === 'library' ? 'border-violet-500/50 text-violet-300' : 'border-gray-700/60 text-gray-500'}`}
          >
            Widget library
          </button>
        </div>

        {tab === 'library' ? (
          <div className="space-y-4">
            {PARTNER_WIDGET_LIBRARY.map((cat) => (
              <div key={cat.category}>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">{cat.category}</p>
                <div className="grid grid-cols-2 gap-2">
                  {cat.items.map((item) => (
                    <button
                      key={item.metric}
                      type="button"
                      onClick={() => applyLibraryItem(item)}
                      className="text-left px-3 py-2 rounded-lg border border-gray-700/60 hover:border-violet-500/40 text-xs text-gray-300"
                    >
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
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Metric</label>
              <select
                className={inputClass}
                value={form.metric}
                onChange={(e) => {
                  const metric = e.target.value as PartnerMetricKey;
                  const meta = PARTNER_METRIC_OPTIONS.find((m) => m.key === metric);
                  setForm({
                    ...form,
                    metric,
                    kind: meta?.kind || 'metric',
                    title: form.title || meta?.label || form.title,
                    colSpan: meta?.kind === 'list' ? Math.max(form.colSpan, 2) : form.colSpan,
                    rowSpan: meta?.kind === 'list' ? Math.max(form.rowSpan, 2) : form.rowSpan,
                  });
                }}
              >
                {PARTNER_METRIC_OPTIONS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Columns</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  className={inputClass}
                  value={form.colSpan}
                  onChange={(e) => setForm({ ...form, colSpan: Number(e.target.value) || 1, sizeLocked: true })}
                />
              </div>
              <div>
                <label className={labelClass}>Rows</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  className={inputClass}
                  value={form.rowSpan}
                  onChange={(e) => setForm({ ...form, rowSpan: Number(e.target.value) || 1, sizeLocked: true })}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-700/60 text-gray-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="px-3 py-1.5 text-xs rounded-lg border border-violet-500/40 text-violet-300 bg-violet-500/10"
          >
            Save widget
          </button>
        </div>
      </div>
    </div>
  );
}
