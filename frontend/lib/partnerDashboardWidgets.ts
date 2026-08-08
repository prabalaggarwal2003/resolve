import { formatMoney } from './businessPartners';
import { formatOrgDateTime } from './orgTimezone';

export type PartnerFilterFieldKey = 'status' | 'partnerTypeKey' | 'categoryKey' | 'tag' | 'search';

export type PartnerWidgetFilters = Partial<Record<PartnerFilterFieldKey, string>>;

export type PartnerMetricKey =
  | 'total_partners'
  | 'active_partners'
  | 'inactive_partners'
  | 'blacklisted_partners'
  | 'pending_partners'
  | 'contracts_expiring'
  | 'pending_payments'
  | 'purchase_value'
  | 'linked_assets'
  | 'recent_activity'
  | 'top_performers';

export type PartnerWidget = {
  id: string;
  title: string;
  kind: 'metric' | 'list' | 'quick';
  metric: PartnerMetricKey | string;
  filters: PartnerWidgetFilters;
  filterFields: PartnerFilterFieldKey[];
  order: number;
  colSpan: number;
  rowSpan: number;
  hidden?: boolean;
  sizeLocked?: boolean;
};

export type PartnerDashboardLayout = {
  version: number;
  widgets: PartnerWidget[];
};

export type PartnerDashboard = {
  _id: string;
  name: string;
  description?: string;
  scope: 'personal' | 'organization';
  ownerId?: string;
  autoRefresh?: 'manual' | '1m' | '5m' | '15m';
  layout: PartnerDashboardLayout;
  allowedRoleIds?: string[];
};

export type PartnerRow = {
  id: string;
  name: string;
  partnerCode: string;
  status: string;
  partnerTypeKey: string;
  categoryKey: string;
  tags: string[];
  currency?: string;
  totalSpend: number;
  paidAmount: number;
  pendingPayment: number;
  invoiceCount: number;
  assetCount: number;
};

export type PartnerContractRow = {
  id: string;
  partnerId: string | null;
  contractNumber: string;
  title: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  renewalDate?: string | null;
};

export type PartnerDataContext = {
  partners: PartnerRow[];
  contracts: PartnerContractRow[];
  recentActivity: any[];
  topPartners: Array<{
    id: string;
    name: string;
    partnerCode?: string;
    status?: string;
    totalSpend?: number;
    invoiceCount?: number;
  }>;
  expiryWindowDays?: number;
};

export const PARTNER_ROW_HEIGHT_PX = 88;
export const PARTNER_GRID_COLS = 4;
export const PARTNER_MIN_COL_SPAN = 1;
export const PARTNER_MAX_COL_SPAN = 4;
export const PARTNER_MIN_ROW_SPAN = 1;
export const PARTNER_MAX_ROW_SPAN = 6;

export function clampPartnerSpan(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export const PARTNER_AUTO_REFRESH_OPTIONS = [
  { id: 'manual' as const, label: 'Manual', ms: 0 },
  { id: '1m' as const, label: '1 min', ms: 60_000 },
  { id: '5m' as const, label: '5 min', ms: 300_000 },
  { id: '15m' as const, label: '15 min', ms: 900_000 },
];

export const PARTNER_WIDGET_FILTER_CATALOG: { key: PartnerFilterFieldKey; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'partnerTypeKey', label: 'Partner type' },
  { key: 'categoryKey', label: 'Category' },
  { key: 'tag', label: 'Tag' },
  { key: 'search', label: 'Search' },
];

export const PARTNER_METRIC_OPTIONS: { key: PartnerMetricKey; label: string; kind: 'metric' | 'list' }[] = [
  { key: 'total_partners', label: 'Total Partners', kind: 'metric' },
  { key: 'active_partners', label: 'Active Partners', kind: 'metric' },
  { key: 'inactive_partners', label: 'Inactive Partners', kind: 'metric' },
  { key: 'blacklisted_partners', label: 'Blacklisted Partners', kind: 'metric' },
  { key: 'pending_partners', label: 'Pending Partners', kind: 'metric' },
  { key: 'contracts_expiring', label: 'Contracts Expiring', kind: 'metric' },
  { key: 'pending_payments', label: 'Pending Payments', kind: 'metric' },
  { key: 'purchase_value', label: 'Purchase Value', kind: 'metric' },
  { key: 'linked_assets', label: 'Assets Linked', kind: 'metric' },
  { key: 'recent_activity', label: 'Recent Activity', kind: 'list' },
  { key: 'top_performers', label: 'Top Partners by Spend', kind: 'list' },
];

export const PARTNER_WIDGET_LIBRARY = [
  {
    category: 'Status KPIs',
    items: [
      { title: 'Total Partners', metric: 'total_partners' as PartnerMetricKey, kind: 'metric' as const },
      { title: 'Active Partners', metric: 'active_partners' as PartnerMetricKey, kind: 'metric' as const },
      { title: 'Blacklisted Partners', metric: 'blacklisted_partners' as PartnerMetricKey, kind: 'metric' as const },
      { title: 'Inactive Partners', metric: 'inactive_partners' as PartnerMetricKey, kind: 'metric' as const },
      { title: 'Pending Partners', metric: 'pending_partners' as PartnerMetricKey, kind: 'metric' as const },
    ],
  },
  {
    category: 'Spend & Assets',
    items: [
      { title: 'Pending Payments', metric: 'pending_payments' as PartnerMetricKey, kind: 'metric' as const },
      { title: 'Purchase Value', metric: 'purchase_value' as PartnerMetricKey, kind: 'metric' as const },
      { title: 'Assets Linked', metric: 'linked_assets' as PartnerMetricKey, kind: 'metric' as const },
      { title: 'Contracts Expiring', metric: 'contracts_expiring' as PartnerMetricKey, kind: 'metric' as const },
    ],
  },
  {
    category: 'Lists',
    items: [
      { title: 'Recent Activity', metric: 'recent_activity' as PartnerMetricKey, kind: 'list' as const, colSpan: 2, rowSpan: 2 },
      { title: 'Top Partners', metric: 'top_performers' as PartnerMetricKey, kind: 'list' as const, colSpan: 2, rowSpan: 2 },
    ],
  },
];

export function getDefaultPartnerDashboardLayout(): PartnerDashboardLayout {
  return {
    version: 1,
    widgets: [
      newPartnerWidget({ id: 'w1', title: 'Total Partners', metric: 'total_partners', order: 0 }),
      newPartnerWidget({ id: 'w2', title: 'Active Partners', metric: 'active_partners', order: 1 }),
      newPartnerWidget({ id: 'w3', title: 'Blacklisted', metric: 'blacklisted_partners', order: 2 }),
      newPartnerWidget({ id: 'w4', title: 'Inactive', metric: 'inactive_partners', order: 3 }),
      newPartnerWidget({ id: 'w5', title: 'Pending Payments', metric: 'pending_payments', order: 4 }),
      newPartnerWidget({ id: 'w6', title: 'Purchase Value', metric: 'purchase_value', order: 5 }),
      newPartnerWidget({ id: 'w7', title: 'Contracts Expiring', metric: 'contracts_expiring', order: 6 }),
      newPartnerWidget({ id: 'w8', title: 'Assets Linked', metric: 'linked_assets', order: 7 }),
      newPartnerWidget({
        id: 'w9',
        title: 'Recent Activity',
        kind: 'list',
        metric: 'recent_activity',
        order: 8,
        colSpan: 2,
        rowSpan: 2,
      }),
      newPartnerWidget({
        id: 'w10',
        title: 'Top Partners',
        kind: 'list',
        metric: 'top_performers',
        order: 9,
        colSpan: 2,
        rowSpan: 2,
      }),
    ],
  };
}

export function newPartnerWidget(partial: Partial<PartnerWidget> & { title?: string } = {}): PartnerWidget {
  const metric = (partial.metric || 'total_partners') as PartnerMetricKey;
  const meta = PARTNER_METRIC_OPTIONS.find((m) => m.key === metric);
  return {
    id: partial.id || crypto.randomUUID(),
    title: partial.title || meta?.label || 'Widget',
    kind: partial.kind || meta?.kind || 'metric',
    metric,
    filters: partial.filters || {},
    filterFields: partial.filterFields || [],
    order: partial.order ?? 0,
    colSpan: partial.colSpan ?? (meta?.kind === 'list' ? 2 : 1),
    rowSpan: partial.rowSpan ?? (meta?.kind === 'list' ? 2 : 1),
    hidden: partial.hidden ?? false,
    sizeLocked: partial.sizeLocked ?? false,
  };
}

export function mergePartnerLayout(layout?: Partial<PartnerDashboardLayout> | null): PartnerDashboardLayout {
  const widgets = Array.isArray(layout?.widgets)
    ? layout!.widgets.map((w, i) =>
        newPartnerWidget({
          ...w,
          filters: w.filters || {},
          filterFields: w.filterFields || [],
          order: w.order ?? i,
        })
      )
    : getDefaultPartnerDashboardLayout().widgets;
  return { version: layout?.version || 1, widgets };
}

export function reorderPartnerWidgets(widgets: PartnerWidget[], dragId: string, dropId: string) {
  const list = [...widgets].sort((a, b) => a.order - b.order);
  const from = list.findIndex((w) => w.id === dragId);
  const to = list.findIndex((w) => w.id === dropId);
  if (from < 0 || to < 0 || from === to) return list;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return list.map((w, i) => ({ ...w, order: i }));
}

export function applyPartnerWidgetFilters(partners: PartnerRow[], filters?: PartnerWidgetFilters) {
  if (!filters) return partners;
  return partners.filter((p) => {
    if (filters.status && p.status !== filters.status) return false;
    if (filters.partnerTypeKey && p.partnerTypeKey !== filters.partnerTypeKey) return false;
    if (filters.categoryKey && p.categoryKey !== filters.categoryKey) return false;
    if (filters.tag && !(p.tags || []).includes(filters.tag)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${p.name} ${p.partnerCode}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function isContractExpiring(c: PartnerContractRow, windowDays = 30) {
  if (!c.endDate) return false;
  if (['Cancelled', 'Expired'].includes(c.status)) return false;
  const now = Date.now();
  const end = new Date(c.endDate).getTime();
  const horizon = now + windowDays * 86400000;
  return end >= now && end <= horizon;
}

export type PartnerWidgetResult =
  | { type: 'metric'; value: number | string; accent?: string; sub?: string }
  | { type: 'list'; items: Array<{ id: string; primary: string; secondary?: string; href?: string }> };

export function computePartnerWidgetData(ctx: PartnerDataContext, widget: PartnerWidget): PartnerWidgetResult {
  const partners = applyPartnerWidgetFilters(ctx.partners || [], widget.filters);
  const partnerIds = new Set(partners.map((p) => p.id));
  const contracts = (ctx.contracts || []).filter((c) => c.partnerId && partnerIds.has(c.partnerId));
  const windowDays = ctx.expiryWindowDays ?? 30;
  const metric = widget.metric;

  switch (metric) {
    case 'total_partners':
      return { type: 'metric', value: partners.length, accent: 'text-gray-100' };
    case 'active_partners':
      return {
        type: 'metric',
        value: partners.filter((p) => p.status === 'Active').length,
        accent: 'text-emerald-300',
      };
    case 'inactive_partners':
      return {
        type: 'metric',
        value: partners.filter((p) => p.status === 'Inactive').length,
        accent: 'text-gray-300',
      };
    case 'blacklisted_partners':
      return {
        type: 'metric',
        value: partners.filter((p) => p.status === 'Blacklisted').length,
        accent: 'text-red-300',
      };
    case 'pending_partners':
      return {
        type: 'metric',
        value: partners.filter((p) => p.status === 'Pending').length,
        accent: 'text-amber-300',
      };
    case 'contracts_expiring':
      return {
        type: 'metric',
        value: contracts.filter((c) => isContractExpiring(c, windowDays)).length,
        accent: 'text-amber-300',
        sub: `Next ${windowDays} days`,
      };
    case 'pending_payments': {
      const amount = partners.reduce((s, p) => s + (p.pendingPayment || 0), 0);
      return { type: 'metric', value: formatMoney(amount), accent: 'text-rose-300' };
    }
    case 'purchase_value': {
      const amount = partners.reduce((s, p) => s + (p.totalSpend || 0), 0);
      return { type: 'metric', value: formatMoney(amount), accent: 'text-violet-300' };
    }
    case 'linked_assets':
      return {
        type: 'metric',
        value: partners.reduce((s, p) => s + (p.assetCount || 0), 0),
        accent: 'text-cyan-300',
      };
    case 'recent_activity': {
      const items = (ctx.recentActivity || [])
        .filter((a) => !a.partnerId || partnerIds.has(String(a.partnerId)))
        .slice(0, 8)
        .map((a) => ({
          id: a.id || a._id,
          primary: a.summary || 'Activity',
          secondary: [a.partnerName, a.userName, a.createdAt ? formatOrgDateTime(a.createdAt) : '']
            .filter(Boolean)
            .join(' · '),
          href: a.partnerId ? `/dashboard/partners/${a.partnerId}` : undefined,
        }));
      return { type: 'list', items };
    }
    case 'top_performers': {
      const items = [...partners]
        .sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0))
        .slice(0, 8)
        .map((p) => ({
          id: p.id,
          primary: p.name,
          secondary: `${p.partnerCode || ''} · ${formatMoney(p.totalSpend || 0)}`.trim(),
          href: `/dashboard/partners/${p.id}`,
        }));
      return { type: 'list', items };
    }
    default:
      return { type: 'metric', value: '—', accent: 'text-gray-400' };
  }
}

export function suggestPartnerWidgetSize(widget: PartnerWidget, result: PartnerWidgetResult) {
  if (widget.sizeLocked && widget.colSpan && widget.rowSpan) {
    return {
      colSpan: clampPartnerSpan(widget.colSpan, PARTNER_MIN_COL_SPAN, PARTNER_MAX_COL_SPAN),
      rowSpan: clampPartnerSpan(widget.rowSpan, PARTNER_MIN_ROW_SPAN, PARTNER_MAX_ROW_SPAN),
    };
  }
  if (result.type === 'list') {
    return {
      colSpan: clampPartnerSpan(Math.max(widget.colSpan || 2, 2), PARTNER_MIN_COL_SPAN, PARTNER_MAX_COL_SPAN),
      rowSpan: clampPartnerSpan(Math.max(widget.rowSpan || 2, 2), PARTNER_MIN_ROW_SPAN, PARTNER_MAX_ROW_SPAN),
    };
  }
  return {
    colSpan: clampPartnerSpan(widget.colSpan || 1, PARTNER_MIN_COL_SPAN, PARTNER_MAX_COL_SPAN),
    rowSpan: clampPartnerSpan(widget.rowSpan || 1, PARTNER_MIN_ROW_SPAN, PARTNER_MAX_ROW_SPAN),
  };
}

export function partnerFiltersToQuery(filters: PartnerWidgetFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}
