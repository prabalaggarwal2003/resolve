'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUDGET_ROW_HEIGHT_PX,
  computeBudgetWidgetData,
  newBudgetWidget,
  reorderBudgetWidgets,
  suggestBudgetWidgetSize,
  type BudgetDashboardLayout,
  type BudgetDataContext,
  type BudgetWidget,
} from '@/lib/budgetWidgets';
import BudgetWidgetContent from '@/components/budgets/BudgetWidgetContent';
import BudgetWidgetEditor from '@/components/budgets/BudgetWidgetEditor';
import BudgetWidgetFilters from '@/components/budgets/BudgetWidgetFilters';
import BudgetWidgetResizeHandle from '@/components/budgets/BudgetWidgetResizeHandle';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function BudgetWidgetBoard({
  ctx,
  layout,
  onLayoutChange,
  configureMode,
  departments,
  locations,
  users,
  budgetTypes,
  budgetStatuses,
  financialYears,
  fundingSources = [],
  budgets = [],
  vendors = [],
  projects = [],
  costCenters = [],
  categories = [],
  lifecycleStages = [],
  paymentStatuses = [],
  saving,
}: {
  ctx: BudgetDataContext;
  layout: BudgetDashboardLayout;
  onLayoutChange: (layout: BudgetDashboardLayout | ((prev: BudgetDashboardLayout) => BudgetDashboardLayout)) => void;
  configureMode: boolean;
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  users: { _id: string; name: string }[];
  budgetTypes: { id: string; name: string }[];
  budgetStatuses: { id: string; name: string }[];
  financialYears: string[];
  fundingSources?: { id: string; name: string }[];
  budgets?: { _id: string; name: string }[];
  vendors?: { _id: string; name: string }[];
  projects?: string[];
  costCenters?: string[];
  categories?: string[];
  lifecycleStages?: { id: string; name: string }[];
  paymentStatuses?: { id: string; name: string }[];
  saving?: boolean;
}) {
  const [editing, setEditing] = useState<BudgetWidget | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const autoSizeKeyRef = useRef('');

  const widgets = useMemo(
    () => [...layout.widgets].filter((w) => !w.hidden).sort((a, b) => a.order - b.order),
    [layout.widgets]
  );

  const updateWidget = (id: string, patch: Partial<BudgetWidget>) => {
    onLayoutChange((prev) => ({
      ...prev,
      widgets: [...prev.widgets].sort((a, b) => a.order - b.order).map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch };
        return { ...next, filters: next.filters ?? {}, filterFields: next.filterFields ?? [] };
      }).map((w, i) => ({ ...w, order: i })),
    }));
  };

  const updateWidgets = (next: BudgetWidget[]) => {
    onLayoutChange((prev) => ({ ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) }));
  };

  const autoSizeSignature = useMemo(
    () => widgets.map((w) => `${w.id}:${w.sizeLocked ? 1 : 0}:${w.kind}:${w.metric}:${w.quickType}:${(w.filterFields ?? []).join(',')}:${JSON.stringify(w.filters ?? {})}`).join('|'),
    [widgets]
  );

  useEffect(() => {
    const signature = `${ctx.budgets.length}:${autoSizeSignature}`;
    if (signature === autoSizeKeyRef.current) return;
    autoSizeKeyRef.current = signature;
    onLayoutChange((prev) => {
      let changed = false;
      const next = [...prev.widgets].sort((a, b) => a.order - b.order).map((w) => {
        if (w.sizeLocked || w.hidden) return w;
        const result = computeBudgetWidgetData(ctx, w);
        const { colSpan, rowSpan } = suggestBudgetWidgetSize(w, result);
        if (w.colSpan === colSpan && w.rowSpan === rowSpan) return w;
        changed = true;
        return { ...w, colSpan, rowSpan };
      });
      if (!changed) return prev;
      return { ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) };
    });
  }, [ctx, autoSizeSignature, onLayoutChange]);

  const effectiveSize = (widget: BudgetWidget) => {
    const result = computeBudgetWidgetData(ctx, widget);
    if (widget.sizeLocked && widget.colSpan && widget.rowSpan) return { colSpan: widget.colSpan, rowSpan: widget.rowSpan };
    return suggestBudgetWidgetSize(widget, result);
  };

  return (
    <>
      {configureMode && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg border border-violet-500/30 bg-violet-950/20">
          <span className="text-xs text-violet-300">Configure mode — drag ⠿ to reorder · drag corner to resize anytime</span>
          {saving && <span className="text-[10px] text-gray-500">Saving…</span>}
          <button type="button" onClick={() => setEditing(newBudgetWidget({ order: widgets.length }))} className={`${buttonClass} border-emerald-500/40 text-emerald-300 ml-auto`}>+ Add widget</button>
        </div>
      )}

      <div data-widget-grid className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ gridAutoRows: `${BUDGET_ROW_HEIGHT_PX}px` }}>
        {widgets.map((widget) => {
          const size = effectiveSize(widget);
          return (
            <div
              key={widget.id}
              onDragOver={(e) => configureMode && e.preventDefault()}
              onDrop={() => { if (dragId && dragId !== widget.id) { updateWidgets(reorderBudgetWidgets(widgets, dragId, widget.id)); setDragId(null); } }}
              className={`relative rounded-xl border bg-gray-800/40 p-3 flex flex-col min-h-0 overflow-hidden ${dragId === widget.id ? 'border-violet-500/50 opacity-60' : 'border-gray-700/60'}`}
              style={{ gridColumn: `span ${size.colSpan}`, gridRow: `span ${size.rowSpan}` }}
            >
              <div className="flex items-start justify-between gap-2 mb-1 shrink-0 relative z-20">
                <div className="flex items-start gap-1 min-w-0">
                  {configureMode && (
                    <span draggable onDragStart={() => setDragId(widget.id)} onDragEnd={() => setDragId(null)} className="text-gray-600 cursor-grab shrink-0">⠿</span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide truncate">{widget.title}</p>
                    <p className="text-[10px] text-gray-600">{widget.kind === 'quick' ? widget.quickType?.replace(/_/g, ' ') : `${widget.metric?.replace(/_/g, ' ')} · ${widget.chartType?.replace(/_/g, ' ')}`}</p>
                  </div>
                </div>
                {configureMode && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => updateWidget(widget.id, { ...suggestBudgetWidgetSize(widget, computeBudgetWidgetData(ctx, widget)), sizeLocked: false })} className={`${buttonClass} border-gray-700/60 text-gray-500`}>Auto</button>
                    <button type="button" onClick={() => updateWidget(widget.id, { hidden: true })} className={`${buttonClass} border-gray-700/60 text-gray-500`}>Hide</button>
                    <button type="button" onClick={() => setEditing(widget)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Edit</button>
                    <button type="button" onClick={() => updateWidgets([...widgets, newBudgetWidget({ ...widget, id: crypto.randomUUID(), title: `${widget.title} (copy)`, order: widgets.length })])} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Copy</button>
                    <button type="button" onClick={() => confirm('Remove widget?') && updateWidgets(widgets.filter((w) => w.id !== widget.id))} className={`${buttonClass} border-red-500/30 text-red-400`}>×</button>
                  </div>
                )}
              </div>
              <BudgetWidgetFilters widget={widget} onChange={(p) => updateWidget(widget.id, p)} departments={departments} locations={locations} users={users} budgetTypes={budgetTypes} budgetStatuses={budgetStatuses} financialYears={financialYears} fundingSources={fundingSources} budgets={budgets} vendors={vendors} projects={projects} costCenters={costCenters} categories={categories} lifecycleStages={lifecycleStages} paymentStatuses={paymentStatuses} />
              <BudgetWidgetContent widget={widget} ctx={ctx} />
              <BudgetWidgetResizeHandle colSpan={size.colSpan} rowSpan={size.rowSpan} onResize={(n) => updateWidget(widget.id, n)} />
            </div>
          );
        })}
      </div>

      {!widgets.length && (
        <div className="text-center py-12 rounded-xl border border-dashed border-gray-700/60">
          <p className="text-gray-500 text-sm mb-2">No widgets yet</p>
          {configureMode && <button type="button" onClick={() => setEditing(newBudgetWidget({ order: 0 }))} className="text-sm text-blue-400 hover:underline">Add your first widget</button>}
        </div>
      )}

      {editing && <BudgetWidgetEditor widget={editing} onSave={(w) => { const exists = widgets.some((x) => x.id === w.id); if (exists) updateWidget(w.id, w); else updateWidgets([...widgets, w]); setEditing(null); }} onCancel={() => setEditing(null)} />}
    </>
  );
}
