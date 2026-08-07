import {
  GROUP_BY_OPTIONS,
  METRIC_OPTIONS,
  QUICK_WIDGET_OPTIONS,
  WIDGET_LIBRARY,
} from './kpiWidgets';
import {
  BUDGET_GROUP_BY_OPTIONS,
  BUDGET_METRIC_OPTIONS,
  BUDGET_QUICK_OPTIONS,
  BUDGET_WIDGET_LIBRARY,
} from './kpiBudgetBridge';
import {
  PARTNER_KPI_METRIC_OPTIONS,
  PARTNER_KPI_WIDGET_LIBRARY,
  PARTNER_QUICK_OPTIONS,
} from './kpiPartnerBridge';

export const COMBINED_METRIC_OPTIONS = [
  ...METRIC_OPTIONS,
  ...BUDGET_METRIC_OPTIONS,
  ...PARTNER_KPI_METRIC_OPTIONS,
];

export const COMBINED_QUICK_WIDGET_OPTIONS = [
  ...QUICK_WIDGET_OPTIONS,
  ...BUDGET_QUICK_OPTIONS,
  ...PARTNER_QUICK_OPTIONS,
];

export const COMBINED_GROUP_BY_OPTIONS = (() => {
  const seen = new Set<string>();
  const merged: { id: string; label: string }[] = [];
  for (const g of [...GROUP_BY_OPTIONS, ...BUDGET_GROUP_BY_OPTIONS]) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    merged.push(g);
  }
  return merged;
})();

export const COMBINED_WIDGET_LIBRARY = [
  ...WIDGET_LIBRARY,
  ...BUDGET_WIDGET_LIBRARY.map((cat) => ({
    category: `Budget · ${cat.category}`,
    items: cat.items,
  })),
  ...PARTNER_KPI_WIDGET_LIBRARY.map((cat) => ({
    category: `Partners · ${cat.category}`,
    items: cat.items,
  })),
];
