import type {
  PartnerDataContext,
  PartnerFilterFieldKey,
  PartnerMetricKey,
  PartnerWidget,
  PartnerWidgetFilters,
} from './partnerDashboardWidgets';
import {
  PARTNER_METRIC_OPTIONS,
  PARTNER_WIDGET_FILTER_CATALOG,
  PARTNER_WIDGET_LIBRARY,
  computePartnerWidgetData,
} from './partnerDashboardWidgets';
import type { KpiDataContext, KpiWidget, KpiWidgetResult } from './kpiWidgets';

/** Partner metrics unique from asset/budget ids (purchase_value collides — requires dataSource). */
export const PARTNER_UNIQUE_METRIC_IDS = new Set([
  'total_partners',
  'active_partners',
  'inactive_partners',
  'blacklisted_partners',
  'pending_partners',
  'contracts_expiring',
  'pending_payments',
  'linked_assets',
]);

export const PARTNER_LIST_QUICK_IDS = new Set(
  PARTNER_METRIC_OPTIONS.filter((m) => m.kind === 'list').map((m) => m.key)
);

export const PARTNER_KPI_METRIC_OPTIONS = PARTNER_METRIC_OPTIONS.filter((m) => m.kind === 'metric').map((m) => ({
  id: m.key as string,
  label: m.label,
  category: 'Partners',
}));

export const PARTNER_QUICK_OPTIONS = PARTNER_METRIC_OPTIONS.filter((m) => m.kind === 'list').map((m) => ({
  id: m.key as string,
  label: m.label,
}));

/** Remapped for KPI/Home widget library (Partial<KpiWidget>). */
export const PARTNER_KPI_WIDGET_LIBRARY = PARTNER_WIDGET_LIBRARY.map((cat) => ({
  category: cat.category,
  items: cat.items.map((item) => {
    const isList = item.kind === 'list';
    const colSpan = 'colSpan' in item ? item.colSpan : undefined;
    const rowSpan = 'rowSpan' in item ? item.rowSpan : undefined;
    return {
      title: item.title,
      widget: {
        dataSource: 'partner' as const,
        kind: isList ? ('quick' as const) : ('metric' as const),
        metric: isList ? undefined : item.metric,
        quickType: isList ? item.metric : undefined,
        chartType: isList ? undefined : ('kpi' as const),
        colSpan,
        rowSpan,
        partnerFilters: {},
        partnerFilterFields: [] as PartnerFilterFieldKey[],
      },
    };
  }),
}));

export function isPartnerWidget(
  widget: Pick<KpiWidget, 'metric' | 'quickType' | 'dataSource'>
): boolean {
  if (widget.dataSource === 'partner') return true;
  if (widget.dataSource === 'asset' || widget.dataSource === 'budget') return false;
  if (widget.quickType && PARTNER_LIST_QUICK_IDS.has(widget.quickType as PartnerMetricKey)) return true;
  if (widget.metric && PARTNER_UNIQUE_METRIC_IDS.has(widget.metric)) return true;
  return false;
}

export function withPartnerFilterDefaults<
  T extends Pick<KpiWidget, 'metric' | 'quickType' | 'dataSource' | 'partnerFilters' | 'partnerFilterFields'>,
>(widget: T): T {
  if (!isPartnerWidget(widget)) return widget;
  return {
    ...widget,
    dataSource: 'partner',
    partnerFilters: widget.partnerFilters ?? {},
    partnerFilterFields: widget.partnerFilterFields ?? [],
  };
}

export function kpiWidgetToPartnerWidget(widget: KpiWidget): PartnerWidget {
  const listQuick =
    widget.kind === 'quick' &&
    widget.quickType &&
    PARTNER_LIST_QUICK_IDS.has(widget.quickType as PartnerMetricKey);
  const metric = (listQuick ? widget.quickType : widget.metric || 'total_partners') as PartnerMetricKey;
  return {
    id: widget.id,
    title: widget.title,
    kind: listQuick ? 'list' : 'metric',
    metric,
    filters: (widget.partnerFilters ?? {}) as PartnerWidgetFilters,
    filterFields: (widget.partnerFilterFields ?? []) as PartnerFilterFieldKey[],
    order: widget.order,
    colSpan: widget.colSpan ?? 1,
    rowSpan: widget.rowSpan ?? 1,
    sizeLocked: widget.sizeLocked,
  };
}

export function computeKpiPartnerWidgetData(ctx: KpiDataContext, widget: KpiWidget): KpiWidgetResult | null {
  if (!isPartnerWidget(widget) || !ctx.partners) return null;
  const result = computePartnerWidgetData(ctx.partners, kpiWidgetToPartnerWidget(widget));
  if (result.type === 'list') {
    return {
      points: [],
      listRows: result.items.map((item) => ({
        primary: item.primary,
        secondary: item.secondary,
        meta: item.href,
      })),
    };
  }
  return {
    kpiValue: String(result.value),
    kpiHint: result.sub,
    points: [],
  };
}

export {
  PARTNER_WIDGET_FILTER_CATALOG as PARTNER_FILTER_CATALOG,
  PARTNER_METRIC_OPTIONS,
  PARTNER_WIDGET_LIBRARY,
};

export type { PartnerDataContext, PartnerFilterFieldKey, PartnerWidgetFilters };
