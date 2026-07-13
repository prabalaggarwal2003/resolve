import type {
  BudgetDataContext,
  BudgetFilterFieldKey,
  BudgetMetric,
  BudgetQuickType,
  BudgetWidget,
  BudgetWidgetFilters,
} from './budgetWidgets';
import {
  METRIC_OPTIONS as BUDGET_METRIC_OPTIONS,
  GROUP_BY_OPTIONS as BUDGET_GROUP_BY_OPTIONS,
  QUICK_WIDGET_OPTIONS as BUDGET_QUICK_OPTIONS,
  WIDGET_LIBRARY as BUDGET_WIDGET_LIBRARY,
  WIDGET_FILTER_CATALOG as BUDGET_FILTER_CATALOG,
  computeBudgetWidgetData,
} from './budgetWidgets';
import type { KpiDataContext, KpiWidget, KpiWidgetResult } from './kpiWidgets';

export const BUDGET_METRIC_IDS = new Set(BUDGET_METRIC_OPTIONS.map((m) => m.id));
export const BUDGET_QUICK_IDS = new Set(BUDGET_QUICK_OPTIONS.map((q) => q.id));

export function isBudgetWidget(widget: Pick<KpiWidget, 'metric' | 'quickType'>): boolean {
  if (widget.metric && BUDGET_METRIC_IDS.has(widget.metric as BudgetMetric)) return true;
  if (widget.quickType && BUDGET_QUICK_IDS.has(widget.quickType as BudgetQuickType)) return true;
  return false;
}

export function withBudgetFilterDefaults<T extends Pick<KpiWidget, 'metric' | 'quickType' | 'budgetFilters' | 'budgetFilterFields'>>(widget: T): T {
  if (!isBudgetWidget(widget)) return widget;
  return {
    ...widget,
    budgetFilters: widget.budgetFilters ?? {},
    budgetFilterFields: widget.budgetFilterFields ?? [],
  };
}

export function kpiWidgetToBudgetWidget(widget: KpiWidget): BudgetWidget {
  return {
    id: widget.id,
    title: widget.title,
    kind: widget.kind,
    metric: widget.metric as BudgetMetric | undefined,
    groupBy: widget.groupBy as BudgetWidget['groupBy'],
    chartType: widget.chartType as BudgetWidget['chartType'],
    quickType: widget.quickType as BudgetQuickType | undefined,
    filters: (widget.budgetFilters ?? {}) as BudgetWidgetFilters,
    filterFields: (widget.budgetFilterFields ?? []) as BudgetFilterFieldKey[],
    timeRange: widget.timeRange,
    sortOrder: widget.sortOrder,
    limit: widget.limit,
    order: widget.order,
    colSpan: widget.colSpan,
    rowSpan: widget.rowSpan,
    sizeLocked: widget.sizeLocked,
  };
}

export function computeKpiBudgetWidgetData(ctx: KpiDataContext, widget: KpiWidget): KpiWidgetResult | null {
  if (!isBudgetWidget(widget) || !ctx.budget) return null;
  return computeBudgetWidgetData(ctx.budget, kpiWidgetToBudgetWidget(widget));
}

export {
  BUDGET_METRIC_OPTIONS,
  BUDGET_GROUP_BY_OPTIONS,
  BUDGET_QUICK_OPTIONS,
  BUDGET_WIDGET_LIBRARY,
  BUDGET_FILTER_CATALOG,
};

export type { BudgetDataContext };
