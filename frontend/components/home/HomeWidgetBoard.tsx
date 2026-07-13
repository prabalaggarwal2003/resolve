'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HOME_ROW_HEIGHT_PX,
  getHomeWidgetSizing,
  homeWidgetAsKpi,
  newHomeWidget,
  reorderHomeWidgets,
  type HomeDashboardLayout,
  type HomeDataContext,
  type HomeWidget,
} from '@/lib/homeDashboardWidgets';
import HomeWidgetContent from '@/components/home/HomeWidgetContent';
import HomeWidgetEditor from '@/components/home/HomeWidgetEditor';
import HomeWidgetFilters from '@/components/home/HomeWidgetFilters';
import BudgetWidgetFilters from '@/components/budgets/BudgetWidgetFilters';
import { isBudgetWidget, kpiWidgetToBudgetWidget } from '@/lib/kpiBudgetBridge';
import HomeWidgetResizeHandle from '@/components/home/HomeWidgetResizeHandle';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function HomeWidgetBoard({
  ctx,
  layout,
  onLayoutChange,
  configureMode,
  groups,
  templates,
  departments,
  locations,
  vendors,
  categories,
  users,
  saving,
  statusOptions,
}: {
  ctx: HomeDataContext;
  layout: HomeDashboardLayout;
  onLayoutChange: (layout: HomeDashboardLayout | ((prev: HomeDashboardLayout) => HomeDashboardLayout)) => void;
  configureMode: boolean;
  groups: { _id: string; name: string }[];
  templates: { _id: string; name: string }[];
  departments: { _id: string; name: string }[];
  locations: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  categories: string[];
  users: { _id: string; name: string }[];
  saving?: boolean;
  statusOptions: string[];
}) {
  const [editing, setEditing] = useState<HomeWidget | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const autoSizeKeyRef = useRef('');

  const budgetLookups = useMemo(() => {
    const b = ctx.budget;
    const lookups = b?.lookups;
    return {
      budgets: lookups?.budgets || (b?.budgets || []).map((x) => ({ _id: x.id, name: x.name })),
      vendors: lookups?.vendors || [],
      projects: lookups?.projects || [],
      costCenters: lookups?.costCenters || [],
      categories: lookups?.categories || [],
      lifecycleStages: lookups?.lifecycleStages || [],
      paymentStatuses: lookups?.paymentStatuses || [],
      budgetTypes: lookups?.budgetTypes || [],
      budgetStatuses: lookups?.budgetStatuses || [],
      fundingSources: lookups?.fundingSources || [],
      departments: lookups?.departments || [],
      locations: lookups?.locations || [],
      users: lookups?.users || [],
      financialYears: Array.from(new Set((b?.budgets || []).map((x) => x.financialYear).filter(Boolean))).sort().reverse(),
    };
  }, [ctx.budget]);

  const widgets = useMemo(() => [...layout.widgets].sort((a, b) => a.order - b.order), [layout.widgets]);
  const visibleWidgets = useMemo(() => widgets.filter((w) => w.visible !== false), [widgets]);
  const hiddenWidgets = useMemo(() => widgets.filter((w) => w.visible === false), [widgets]);

  const updateWidget = (id: string, patch: Partial<HomeWidget>) => {
    onLayoutChange((prev) => ({
      ...prev,
      widgets: [...prev.widgets].sort((a, b) => a.order - b.order).map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch };
        return { ...next, filters: next.filters ?? {}, filterFields: next.filterFields ?? [], budgetFilters: next.budgetFilters ?? {}, budgetFilterFields: next.budgetFilterFields ?? [] };
      }).map((w, i) => ({ ...w, order: i })),
    }));
  };

  const updateWidgets = (next: HomeWidget[]) => {
    onLayoutChange((prev) => ({ ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) }));
  };

  const autoSizeSignature = useMemo(
    () => widgets.map((w) => `${w.id}:${w.sizeLocked ? 1 : 0}:${w.kind}:${w.metric}:${(w.filterFields ?? []).join(',')}:${JSON.stringify(w.filters ?? {})}`).join('|'),
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
        const { colSpan, rowSpan } = getHomeWidgetSizing(ctx, w);
        if (w.colSpan === colSpan && w.rowSpan === rowSpan) return w;
        changed = true;
        return { ...w, colSpan, rowSpan };
      });
      if (!changed) return prev;
      return { ...prev, widgets: next.map((w, i) => ({ ...w, order: i })) };
    });
  }, [ctx, autoSizeSignature, onLayoutChange]);

  const effectiveSize = (widget: HomeWidget) => {
    if (widget.sizeLocked && widget.colSpan && widget.rowSpan) {
      return { colSpan: widget.colSpan, rowSpan: widget.rowSpan };
    }
    return getHomeWidgetSizing(ctx, widget);
  };

  const kindLabel = (widget: HomeWidget) => {
    if (widget.kind === 'metric') {
      const chart = widget.chartType?.replace(/_/g, ' ') || 'chart';
      return `${widget.metric?.replace(/_/g, ' ') || 'metric'} · ${chart}`;
    }
    if (widget.kind === 'quick') return widget.quickType?.replace(/_/g, ' ') || 'quick list';
    if (widget.kind === 'kpi' || widget.kind === 'chart') return widget.metric?.replace(/_/g, ' ') || widget.kind;
    return widget.kind.replace(/_/g, ' ');
  };

  return (
    <>
      {configureMode && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-lg border border-violet-500/30 bg-violet-950/20">
          <span className="text-xs text-violet-300">Configure mode — drag ⠿ to reorder, corner to resize</span>
          {saving && <span className="text-[10px] text-gray-500">Saving…</span>}
          <button type="button" onClick={() => setEditing(newHomeWidget({ order: widgets.length }))} className={`${buttonClass} border-emerald-500/40 text-emerald-300 ml-auto`}>+ Add widget</button>
        </div>
      )}

      <div data-widget-grid className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ gridAutoRows: `${HOME_ROW_HEIGHT_PX}px` }}>
        {visibleWidgets.map((widget) => {
          const size = effectiveSize(widget);
          return (
            <div
              key={widget.id}
              onDragOver={(e) => configureMode && e.preventDefault()}
              onDrop={() => { if (dragId && dragId !== widget.id) { updateWidgets(reorderHomeWidgets(widgets, dragId, widget.id)); setDragId(null); } }}
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
                    <p className="text-[10px] text-gray-600">{kindLabel(widget)}</p>
                  </div>
                </div>
                {configureMode && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => { const s = getHomeWidgetSizing(ctx, widget); updateWidget(widget.id, { ...s, sizeLocked: false }); }} className={`${buttonClass} border-gray-700/60 text-gray-500`}>Auto</button>
                    <button type="button" onClick={() => setEditing(widget)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Edit</button>
                    <button type="button" onClick={() => updateWidgets([...widgets, newHomeWidget({ ...widget, id: crypto.randomUUID(), title: `${widget.title} (copy)`, order: widgets.length })])} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Copy</button>
                    <button type="button" onClick={() => updateWidget(widget.id, { visible: false })} className={`${buttonClass} border-gray-700/60 text-gray-400`}>Hide</button>
                    <button type="button" onClick={() => confirm('Remove widget?') && updateWidgets(widgets.filter((w) => w.id !== widget.id))} className={`${buttonClass} border-red-500/30 text-red-400`}>×</button>
                  </div>
                )}
              </div>
              {isBudgetWidget(homeWidgetAsKpi(widget)) ? (
                <BudgetWidgetFilters
                  widget={kpiWidgetToBudgetWidget(homeWidgetAsKpi(widget))}
                  onChange={(p) => updateWidget(widget.id, { budgetFilters: p.filters, budgetFilterFields: p.filterFields })}
                  departments={budgetLookups.departments}
                  locations={budgetLookups.locations}
                  users={budgetLookups.users}
                  budgetTypes={budgetLookups.budgetTypes}
                  budgetStatuses={budgetLookups.budgetStatuses}
                  financialYears={budgetLookups.financialYears}
                  fundingSources={budgetLookups.fundingSources}
                  budgets={budgetLookups.budgets}
                  vendors={budgetLookups.vendors}
                  projects={budgetLookups.projects}
                  costCenters={budgetLookups.costCenters}
                  categories={budgetLookups.categories}
                  lifecycleStages={budgetLookups.lifecycleStages}
                  paymentStatuses={budgetLookups.paymentStatuses}
                />
              ) : (
                <HomeWidgetFilters widget={widget} onChange={(p) => updateWidget(widget.id, p)} groups={groups} templates={templates} departments={departments} locations={locations} vendors={vendors} categories={categories} users={users} statusOptions={statusOptions} />
              )}
              <HomeWidgetContent widget={widget} ctx={ctx} />
              <HomeWidgetResizeHandle colSpan={size.colSpan} rowSpan={size.rowSpan} onResize={(n) => updateWidget(widget.id, n)} />
            </div>
          );
        })}
      </div>

      {!visibleWidgets.length && (
        <div className="text-center py-12 rounded-xl border border-dashed border-gray-700/60">
          <p className="text-sm text-gray-500">No widgets visible</p>
          {configureMode && <button type="button" onClick={() => setEditing(newHomeWidget())} className={`${buttonClass} border-emerald-500/40 text-emerald-300 mt-3`}>Add your first widget</button>}
        </div>
      )}

      {configureMode && hiddenWidgets.length > 0 && (
        <div className="mt-3 rounded-lg border border-gray-700/50 bg-gray-900/30 p-3">
          <p className="text-[10px] text-gray-500 uppercase mb-2">Hidden widgets</p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgets.map((w) => (
              <button key={w.id} type="button" onClick={() => updateWidget(w.id, { visible: true })} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
                Show {w.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <HomeWidgetEditor
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
