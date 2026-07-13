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

export const COMBINED_METRIC_OPTIONS = [...METRIC_OPTIONS, ...BUDGET_METRIC_OPTIONS];

export const COMBINED_QUICK_WIDGET_OPTIONS = [...QUICK_WIDGET_OPTIONS, ...BUDGET_QUICK_OPTIONS];

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
];
