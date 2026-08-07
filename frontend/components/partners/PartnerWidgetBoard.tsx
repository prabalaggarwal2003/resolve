'use client';

import { useMemo, useState } from 'react';
import {
  computePartnerWidgetData,
  newPartnerWidget,
  PARTNER_MAX_COL_SPAN,
  PARTNER_ROW_HEIGHT_PX,
  reorderPartnerWidgets,
  suggestPartnerWidgetSize,
  type PartnerDashboardLayout,
  type PartnerDataContext,
  type PartnerWidget,
} from '@/lib/partnerDashboardWidgets';
import PartnerWidgetContent from '@/components/partners/PartnerWidgetContent';
import PartnerWidgetEditor from '@/components/partners/PartnerWidgetEditor';
import PartnerWidgetFilters from '@/components/partners/PartnerWidgetFilters';
import PartnerWidgetResizeHandle from '@/components/partners/PartnerWidgetResizeHandle';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function PartnerWidgetBoard({
  ctx,
  layout,
  onLayoutChange,
  configureMode,
  statuses,
  partnerTypes,
  categories,
  tags = [],
  saving,
}: {
  ctx: PartnerDataContext;
  layout: PartnerDashboardLayout;
  onLayoutChange: (
    layout: PartnerDashboardLayout | ((prev: PartnerDashboardLayout) => PartnerDashboardLayout)
  ) => void;
  configureMode: boolean;
  statuses: { id: string; name: string }[];
  partnerTypes: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  tags?: string[];
  saving?: boolean;
}) {
  const [editing, setEditing] = useState<PartnerWidget | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const widgets = useMemo(
    () => [...layout.widgets].filter((w) => !w.hidden).sort((a, b) => a.order - b.order),
    [layout.widgets]
  );

  const updateWidget = (id: string, patch: Partial<PartnerWidget>) => {
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

  const updateWidgets = (next: PartnerWidget[]) => {
    onLayoutChange((prev) => ({ ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) }));
  };

  const effectiveSize = (widget: PartnerWidget) => {
    const result = computePartnerWidgetData(ctx, widget);
    if (widget.sizeLocked && widget.colSpan && widget.rowSpan) {
      return {
        colSpan: Math.min(widget.colSpan, PARTNER_MAX_COL_SPAN),
        rowSpan: widget.rowSpan,
      };
    }
    return suggestPartnerWidgetSize(widget, result);
  };

  return (
    <>
      {configureMode && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg border border-violet-500/30 bg-violet-950/20">
          <span className="text-xs text-violet-300">
            Configure mode — drag ⠿ to reorder · drag corner to resize anytime
          </span>
          {saving && <span className="text-[10px] text-gray-500">Saving…</span>}
          <button
            type="button"
            onClick={() => setEditing(newPartnerWidget({ order: widgets.length }))}
            className={`${buttonClass} border-emerald-500/40 text-emerald-300 ml-auto`}
          >
            + Add widget
          </button>
        </div>
      )}

      <div
        data-widget-grid
        className="grid grid-cols-1 lg:grid-cols-4 gap-3"
        style={{ gridAutoRows: `${PARTNER_ROW_HEIGHT_PX}px` }}
      >
        {widgets.map((widget) => {
          const size = effectiveSize(widget);
          return (
            <div
              key={widget.id}
              onDragOver={(e) => configureMode && e.preventDefault()}
              onDrop={() => {
                if (dragId && dragId !== widget.id) {
                  updateWidgets(reorderPartnerWidgets(widgets, dragId, widget.id));
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
                      onDragStart={() => setDragId(widget.id)}
                      onDragEnd={() => setDragId(null)}
                      className="text-gray-600 cursor-grab shrink-0"
                    >
                      ⠿
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide truncate">
                      {widget.title}
                    </p>
                    <p className="text-[10px] text-gray-600">{String(widget.metric).replace(/_/g, ' ')}</p>
                  </div>
                </div>
                {configureMode && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        updateWidget(widget.id, {
                          ...suggestPartnerWidgetSize(widget, computePartnerWidgetData(ctx, widget)),
                          sizeLocked: false,
                        })
                      }
                      className={`${buttonClass} border-gray-700/60 text-gray-500`}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(widget)}
                      className={`${buttonClass} border-gray-700/60 text-gray-400`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateWidgets([
                          ...widgets,
                          newPartnerWidget({
                            ...widget,
                            id: crypto.randomUUID(),
                            title: `${widget.title} (copy)`,
                            order: widgets.length,
                          }),
                        ])
                      }
                      className={`${buttonClass} border-gray-700/60 text-gray-400`}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirm('Remove widget?') && updateWidgets(widgets.filter((w) => w.id !== widget.id))
                      }
                      className={`${buttonClass} border-red-500/30 text-red-400`}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <PartnerWidgetFilters
                widget={widget}
                onChange={(p) => updateWidget(widget.id, p)}
                statuses={statuses}
                partnerTypes={partnerTypes}
                categories={categories}
                tags={tags}
              />
              <PartnerWidgetContent widget={widget} ctx={ctx} />
              <PartnerWidgetResizeHandle
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
          <p className="text-gray-500 text-sm mb-2">No widgets yet</p>
          {configureMode && (
            <button
              type="button"
              onClick={() => setEditing(newPartnerWidget({ order: 0 }))}
              className="text-sm text-blue-400 hover:underline"
            >
              Add your first widget
            </button>
          )}
        </div>
      )}

      {editing && (
        <PartnerWidgetEditor
          widget={editing}
          onSave={(w) => {
            const exists = widgets.some((x) => x.id === w.id);
            if (exists) updateWidget(w.id, w);
            else updateWidgets([...widgets, w]);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}
