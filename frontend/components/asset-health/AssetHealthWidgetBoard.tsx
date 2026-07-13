'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HEALTH_ROW_HEIGHT_PX,
  computeHealthWidgetData,
  newHealthWidget,
  reorderHealthWidgets,
  suggestHealthWidgetSize,
  type HealthDashboardLayout,
  type HealthDataContext,
  type HealthWidget,
} from '@/lib/assetHealthWidgets';
import AssetHealthWidgetContent from './AssetHealthWidgetContent';
import AssetHealthWidgetEditor from './AssetHealthWidgetEditor';
import AssetHealthWidgetFilters from './AssetHealthWidgetFilters';
import AssetHealthWidgetResizeHandle from './AssetHealthWidgetResizeHandle';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function AssetHealthWidgetBoard({
  ctx,
  layout,
  onLayoutChange,
  configureMode,
  groups,
  departments,
  locations,
  categories,
  statusOptions,
  saving,
}: {
  ctx: HealthDataContext;
  layout: HealthDashboardLayout;
  onLayoutChange: (layout: HealthDashboardLayout | ((prev: HealthDashboardLayout) => HealthDashboardLayout)) => void;
  configureMode: boolean;
  groups: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  categories: string[];
  statusOptions: string[];
  saving?: boolean;
}) {
  const [editing, setEditing] = useState<HealthWidget | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const autoSizeKeyRef = useRef('');

  const widgets = useMemo(() => [...layout.widgets].sort((a, b) => a.order - b.order), [layout.widgets]);

  const updateWidget = (id: string, patch: Partial<HealthWidget>) => {
    onLayoutChange((prev) => ({
      ...prev,
      widgets: [...prev.widgets].sort((a, b) => a.order - b.order).map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch };
        return { ...next, filters: next.filters ?? {}, filterFields: next.filterFields ?? [] };
      }).map((w, i) => ({ ...w, order: i })),
    }));
  };

  const updateWidgets = (next: HealthWidget[]) => {
    onLayoutChange((prev) => ({ ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) }));
  };

  const autoSizeSignature = useMemo(
    () => widgets.map((w) => `${w.id}:${w.sizeLocked ? 1 : 0}:${w.kind}:${w.metric}:${w.quickType}:${(w.filterFields ?? []).join(',')}:${JSON.stringify(w.filters ?? {})}`).join('|'),
    [widgets]
  );

  useEffect(() => {
    const signature = `${ctx.assets.length}:${autoSizeSignature}`;
    if (signature === autoSizeKeyRef.current) return;
    autoSizeKeyRef.current = signature;
    onLayoutChange((prev) => {
      let changed = false;
      const next = [...prev.widgets].sort((a, b) => a.order - b.order).map((w) => {
        if (w.sizeLocked) return w;
        const result = computeHealthWidgetData(ctx, w);
        const { colSpan, rowSpan } = suggestHealthWidgetSize(w, result);
        if (w.colSpan === colSpan && w.rowSpan === rowSpan) return w;
        changed = true;
        return { ...w, colSpan, rowSpan };
      });
      if (!changed) return prev;
      return { ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) };
    });
  }, [ctx, autoSizeSignature, onLayoutChange]);

  const effectiveSize = (widget: HealthWidget) => {
    const result = computeHealthWidgetData(ctx, widget);
    if (widget.sizeLocked && widget.colSpan && widget.rowSpan) {
      return { colSpan: widget.colSpan, rowSpan: widget.rowSpan };
    }
    return suggestHealthWidgetSize(widget, result);
  };

  return (
    <>
      {configureMode && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg border border-violet-500/30 bg-violet-950/20">
          <span className="text-xs text-violet-300">Configure mode — drag ⠿ to reorder, corner to resize</span>
          {saving && <span className="text-[10px] text-gray-500">Saving…</span>}
          <button
            type="button"
            onClick={() => setEditing(newHealthWidget({ order: widgets.length }))}
            className={`${buttonClass} border-emerald-500/40 text-emerald-300 ml-auto`}
          >
            + Add widget
          </button>
        </div>
      )}

      <div data-health-widget-grid className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ gridAutoRows: `${HEALTH_ROW_HEIGHT_PX}px` }}>
        {widgets.map((widget) => {
          const size = effectiveSize(widget);
          return (
            <div
              key={widget.id}
              onDragOver={(e) => configureMode && e.preventDefault()}
              onDrop={() => {
                if (dragId && dragId !== widget.id) {
                  updateWidgets(reorderHealthWidgets(widgets, dragId, widget.id));
                  setDragId(null);
                }
              }}
              className={`relative rounded-xl border bg-gray-800/40 p-3 flex flex-col min-h-0 overflow-hidden ${dragId === widget.id ? 'border-violet-500/50 opacity-60' : 'border-gray-700/60'}`}
              style={{ gridColumn: `span ${size.colSpan}`, gridRow: `span ${size.rowSpan}` }}
            >
              <div className="flex items-start justify-between gap-2 mb-1 shrink-0 relative z-20">
                <div className="flex items-start gap-1 min-w-0">
                  {configureMode && (
                    <span
                      draggable
                      onDragStart={() => setDragId(widget.id)}
                      onDragEnd={() => setDragId(null)}
                      className="text-gray-600 cursor-grab shrink-0"
                    >
                      ⠿
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide truncate">{widget.title}</p>
                    <p className="text-[10px] text-gray-600">
                      {widget.kind === 'quick'
                        ? widget.quickType?.replace(/_/g, ' ')
                        : `${widget.metric?.replace(/_/g, ' ')} · ${widget.chartType?.replace(/_/g, ' ')}`}
                    </p>
                  </div>
                </div>
                {configureMode && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateWidget(widget.id, { ...suggestHealthWidgetSize(widget, computeHealthWidgetData(ctx, widget)), sizeLocked: false })}
                      className={`${buttonClass} border-gray-700/60 text-gray-500`}
                    >
                      Auto
                    </button>
                    <button type="button" onClick={() => setEditing(widget)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Edit</button>
                    <button
                      type="button"
                      onClick={() => updateWidgets([...widgets, newHealthWidget({ ...widget, id: crypto.randomUUID(), title: `${widget.title} (copy)`, order: widgets.length })])}
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
              <AssetHealthWidgetFilters
                widget={widget}
                onChange={(p) => updateWidget(widget.id, p)}
                groups={groups}
                departments={departments}
                locations={locations}
                categories={categories}
                statusOptions={statusOptions}
              />
              <AssetHealthWidgetContent widget={widget} ctx={ctx} />
              <AssetHealthWidgetResizeHandle
                colSpan={size.colSpan}
                rowSpan={size.rowSpan}
                onResize={(n) => updateWidget(widget.id, n)}
              />
            </div>
          );
        })}
      </div>

      {!widgets.length && (
        <div className="text-center py-12 rounded-xl border border-dashed border-gray-700/60">
          <p className="text-sm text-gray-500">No widgets yet</p>
          {configureMode && (
            <button type="button" onClick={() => setEditing(newHealthWidget())} className={`${buttonClass} border-emerald-500/40 text-emerald-300 mt-3`}>
              Add your first widget
            </button>
          )}
        </div>
      )}

      {editing && (
        <AssetHealthWidgetEditor
          widget={editing}
          onSave={(w) => {
            const exists = widgets.some((x) => x.id === w.id);
            if (exists) updateWidgets(widgets.map((x) => (x.id === w.id ? w : x)));
            else updateWidgets([...widgets, { ...w, order: widgets.length }]);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}
