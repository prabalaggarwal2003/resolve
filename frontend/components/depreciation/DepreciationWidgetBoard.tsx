'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssetDepreciationMetrics, DepreciationPolicy } from '@/lib/depreciation';
import {
  WIDGET_ROW_HEIGHT_PX,
  computeWidgetData,
  newWidget,
  reorderWidgets,
  suggestWidgetSize,
  type DepreciationDashboardLayout,
  type DepreciationWidget,
} from '@/lib/depreciationWidgets';
import DepreciationWidgetContent from '@/components/depreciation/DepreciationWidgetContent';
import DepreciationWidgetEditor from '@/components/depreciation/DepreciationWidgetEditor';
import DepreciationWidgetFilters from '@/components/depreciation/DepreciationWidgetFilters';
import DepreciationWidgetResizeHandle from '@/components/depreciation/DepreciationWidgetResizeHandle';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function DepreciationWidgetBoard({
  assets,
  layout,
  onLayoutChange,
  configureMode,
  groups,
  templates,
  departments,
  locations,
  vendors,
  policies,
  categories,
  saving,
  statusOptions,
}: {
  assets: AssetDepreciationMetrics[];
  layout: DepreciationDashboardLayout;
  onLayoutChange: (layout: DepreciationDashboardLayout | ((prev: DepreciationDashboardLayout) => DepreciationDashboardLayout)) => void;
  configureMode: boolean;
  groups: { _id: string; name: string }[];
  templates: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  policies: DepreciationPolicy[];
  categories: string[];
  saving?: boolean;
  statusOptions: string[];
}) {
  const [editing, setEditing] = useState<DepreciationWidget | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const autoSizeKeyRef = useRef('');

  const widgets = useMemo(() => [...layout.widgets].sort((a, b) => a.order - b.order), [layout.widgets]);

  const updateWidget = (id: string, patch: Partial<DepreciationWidget>) => {
    onLayoutChange((prev) => ({
      ...prev,
      widgets: [...prev.widgets]
        .sort((a, b) => a.order - b.order)
        .map((w) => {
          if (w.id !== id) return w;
          const next = { ...w, ...patch };
          return { ...next, filters: next.filters ?? {}, filterFields: next.filterFields ?? [] };
        })
        .map((w, i) => ({ ...w, order: i })),
    }));
  };

  const updateWidgets = (next: DepreciationWidget[]) => {
    onLayoutChange((prev) => ({ ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) }));
  };

  const autoSizeSignature = useMemo(
    () => widgets
      .map((w) => `${w.id}:${w.sizeLocked ? 1 : 0}:${w.chartType}:${w.metric}:${w.groupBy}:${(w.filterFields ?? []).join(',')}:${JSON.stringify(w.filters ?? {})}`)
      .join('|'),
    [widgets]
  );

  useEffect(() => {
    const signature = `${assets.length}:${autoSizeSignature}`;
    if (signature === autoSizeKeyRef.current) return;
    autoSizeKeyRef.current = signature;

    onLayoutChange((prev) => {
      let changed = false;
      const next = [...prev.widgets]
        .sort((a, b) => a.order - b.order)
        .map((w) => {
          if (w.sizeLocked) return w;
          const result = computeWidgetData(assets, w);
          const { colSpan, rowSpan } = suggestWidgetSize(w, result);
          if (w.colSpan === colSpan && w.rowSpan === rowSpan) return w;
          changed = true;
          return { ...w, colSpan, rowSpan };
        });
      if (!changed) return prev;
      return { ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) };
    });
  }, [assets, autoSizeSignature, onLayoutChange]);

  const effectiveSize = (widget: DepreciationWidget) => {
    const result = computeWidgetData(assets, widget);
    if (widget.sizeLocked && widget.colSpan && widget.rowSpan) {
      return { colSpan: widget.colSpan, rowSpan: widget.rowSpan };
    }
    return suggestWidgetSize(widget, result);
  };

  const handleSaveWidget = (w: DepreciationWidget) => {
    const exists = widgets.some((x) => x.id === w.id);
    if (exists) {
      updateWidgets(widgets.map((x) => (x.id === w.id ? { ...w, sizeLocked: false } : x)));
    } else {
      const result = computeWidgetData(assets, w);
      const size = suggestWidgetSize(w, result);
      updateWidgets([...widgets, { ...w, ...size, sizeLocked: false, order: widgets.length }]);
    }
    setEditing(null);
  };

  return (
    <>
      {configureMode && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg border border-violet-500/30 bg-violet-950/20">
          <span className="text-xs text-violet-300">Configure mode — drag ⠿ to reorder, corner to resize</span>
          {saving && <span className="text-[10px] text-gray-500">Saving…</span>}
          <button
            type="button"
            onClick={() => setEditing(newWidget({ order: widgets.length }))}
            className={`${buttonClass} border-emerald-500/40 text-emerald-300 ml-auto`}
          >
            + Add widget
          </button>
        </div>
      )}

      <div
        data-widget-grid
        className="grid grid-cols-1 lg:grid-cols-12 gap-4"
        style={{ gridAutoRows: `${WIDGET_ROW_HEIGHT_PX}px` }}
      >
        {widgets.map((widget) => {
          const size = effectiveSize(widget);
          return (
            <div
              key={widget.id}
              onDragOver={(e) => configureMode && e.preventDefault()}
              onDrop={() => {
                if (dragId && dragId !== widget.id) {
                  updateWidgets(reorderWidgets(widgets, dragId, widget.id));
                  setDragId(null);
                }
              }}
              className={`relative rounded-xl border bg-gray-800/40 p-3 flex flex-col min-h-0 overflow-hidden ${
                dragId === widget.id ? 'border-violet-500/50 opacity-60' : 'border-gray-700/60'
              }`}
              style={{ gridColumn: `span ${size.colSpan}`, gridRow: `span ${size.rowSpan}` }}
            >
              <div className="flex items-start justify-between gap-2 mb-1 shrink-0 relative z-20">
                <div className="flex items-start gap-1 min-w-0">
                  {configureMode && (
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', widget.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(widget.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      className="text-gray-600 cursor-grab shrink-0"
                    >
                      ⠿
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide truncate">{widget.title}</p>
                    <p className="text-[10px] text-gray-600">
                      {widget.metric.replace(/_/g, ' ')}
                      {widget.groupBy ? ` · by ${widget.groupBy.replace(/_/g, ' ')}` : ''}
                      {' · '}{widget.chartType.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                {configureMode && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const s = suggestWidgetSize(widget, computeWidgetData(assets, widget));
                        updateWidget(widget.id, { ...s, sizeLocked: false });
                      }}
                      className={`${buttonClass} border-gray-700/60 text-gray-500`}
                    >
                      Auto
                    </button>
                    <button type="button" onClick={() => setEditing(widget)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Edit</button>
                    <button
                      type="button"
                      onClick={() => updateWidgets([...widgets, newWidget({
                        ...widget,
                        id: crypto.randomUUID(),
                        title: `${widget.title} (copy)`,
                        order: widgets.length,
                        filterFields: [...(widget.filterFields ?? [])],
                        filters: { ...widget.filters },
                      })])}
                      className={`${buttonClass} border-gray-700/60 text-gray-400`}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => confirm('Remove widget?') && updateWidgets(widgets.filter((w) => w.id !== widget.id))}
                      className={`${buttonClass} border-red-500/30 text-red-400`}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <DepreciationWidgetFilters
                widget={widget}
                onChange={(patch) => updateWidget(widget.id, patch)}
                groups={groups}
                templates={templates}
                departments={departments}
                locations={locations}
                vendors={vendors}
                policies={policies}
                categories={categories}
                statusOptions={statusOptions}
              />

              <DepreciationWidgetContent widget={widget} assets={assets} />

              <DepreciationWidgetResizeHandle
                colSpan={size.colSpan}
                rowSpan={size.rowSpan}
                onResize={(next) => updateWidget(widget.id, next)}
              />
            </div>
          );
        })}
      </div>

      {!widgets.length && (
        <div className="text-center py-12 rounded-xl border border-dashed border-gray-700/60">
          <p className="text-sm text-gray-500">No widgets yet</p>
          {configureMode && (
            <button type="button" onClick={() => setEditing(newWidget())} className={`${buttonClass} border-emerald-500/40 text-emerald-300 mt-3`}>
              Add your first widget
            </button>
          )}
        </div>
      )}

      {editing && (
        <DepreciationWidgetEditor
          widget={editing}
          onSave={handleSaveWidget}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}
