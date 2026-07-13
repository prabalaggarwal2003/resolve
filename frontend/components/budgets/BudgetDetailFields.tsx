'use client';

import { formatBudgetCurrency, type Budget, type BudgetOrgConfig } from '@/lib/budgets';

export type BudgetRefData = {
  departments?: { _id: string; name: string }[];
  groups?: { _id: string; name: string }[];
  locations?: { _id: string; name: string }[];
  vendors?: { _id: string; name: string }[];
  templates?: { _id: string; name: string }[];
  users?: { _id: string; name: string }[];
};

const REF_DIMENSION_SOURCE: Record<string, keyof BudgetRefData> = {
  departmentId: 'departments',
  groupId: 'groups',
  locationId: 'locations',
  vendorId: 'vendors',
  templateId: 'templates',
};

function formatDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function ownerName(owner: Budget['budgetOwnerId']) {
  if (!owner) return '—';
  if (typeof owner === 'object') return owner.name || '—';
  return String(owner);
}

function UtilizationBar({ pct, warn = 80 }: { pct: number; warn?: number }) {
  const color = pct >= 100 ? 'bg-red-500' : pct >= warn ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-12 text-right">{pct}%</span>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</p>
      <p className={`text-sm break-words ${accent || 'text-gray-200'}`}>{value}</p>
    </div>
  );
}

export default function BudgetDetailFields({
  budget,
  config,
  refData,
}: {
  budget: Budget;
  config: BudgetOrgConfig | null;
  refData?: BudgetRefData;
}) {
  const statusOpt = config?.budgetStatuses?.find((s) => s.id === budget.status);
  const typeLabel = config?.budgetTypes?.find((t) => t.id === budget.budgetTypeId)?.name || budget.budgetTypeId;
  const warnPct = config?.settings?.warnThresholdPct ?? 80;

  const resolveDimension = (key: string, value: string) => {
    if (value == null || value === '') return '—';
    const source = REF_DIMENSION_SOURCE[key];
    if (source) {
      const list = (refData?.[source] || []) as { _id: string; name: string }[];
      return list.find((x) => x._id === value)?.name || value;
    }
    if (key === 'fundingSourceId') {
      return config?.fundingSources?.find((f) => f.id === value)?.name || value;
    }
    return value;
  };

  const enabledDimensions = (config?.enabledDimensions || []).filter((d) => d.enabled);
  const dimensionEntries = enabledDimensions
    .map((d) => ({ key: d.key, label: d.label, value: budget.dimensions?.[d.key] }))
    .filter((e) => e.value != null && e.value !== '');

  const customFields = config?.customFields || [];
  const customEntries = customFields
    .map((f) => ({ key: f.key, label: f.label, value: budget.customFields?.[f.key] }))
    .filter((e) => e.value != null && e.value !== '' && !(Array.isArray(e.value) && e.value.length === 0));

  const currency = budget.currency;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-100 break-words">{budget.name}</h2>
          {budget.code ? <p className="text-xs text-gray-500 mt-0.5">{budget.code}</p> : null}
        </div>
        {statusOpt ? (
          <span
            className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0"
            style={{
              color: statusOpt.color || '#9ca3af',
              backgroundColor: `${statusOpt.color || '#6b7280'}22`,
              borderColor: `${statusOpt.color || '#6b7280'}55`,
            }}
          >
            {statusOpt.name}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[11px] border border-gray-700/60 text-gray-300 shrink-0">
            {budget.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Type" value={typeLabel} />
        <Field label="Financial year" value={budget.financialYear || '—'} />
        <Field label="Period" value={budget.periodLabel || '—'} />
        <Field label="Start date" value={formatDate(budget.startDate)} />
        <Field label="End date" value={formatDate(budget.endDate)} />
        <Field label="Owner" value={ownerName(budget.budgetOwnerId)} />
        <Field label="Currency" value={currency} />
        <Field label="Created" value={formatDate(budget.createdAt)} />
        <Field label="Last updated" value={formatDate(budget.updatedAt)} />
      </div>

      <div className="rounded-lg border border-gray-800/70 bg-gray-900/30 p-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Financials</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Allocated" value={formatBudgetCurrency(budget.allocatedAmount, currency)} accent="text-gray-100 font-medium" />
          <Field label="Planned" value={formatBudgetCurrency(budget.plannedAmount, currency)} />
          <Field label="Committed" value={formatBudgetCurrency(budget.committedAmount, currency)} />
          <Field label="Actual spend" value={formatBudgetCurrency(budget.actualSpend, currency)} accent="text-amber-300 font-medium" />
          <Field label="Remaining" value={formatBudgetCurrency(budget.remainingAmount, currency)} accent="text-emerald-300 font-medium" />
          <Field label="Available" value={formatBudgetCurrency(budget.availableBalance, currency)} />
        </div>
        <div className="mt-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Utilization</p>
          <UtilizationBar pct={budget.utilizationPct} warn={warnPct} />
        </div>
      </div>

      {budget.description ? (
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Description</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{budget.description}</p>
        </div>
      ) : null}

      {budget.notes ? (
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Notes</p>
          <p className="text-sm text-gray-400 whitespace-pre-wrap break-words">{budget.notes}</p>
        </div>
      ) : null}

      {dimensionEntries.length > 0 ? (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Dimensions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {dimensionEntries.map((e) => (
              <Field key={e.key} label={e.label} value={resolveDimension(e.key, String(e.value))} />
            ))}
          </div>
        </div>
      ) : null}

      {customEntries.length > 0 ? (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Custom fields</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {customEntries.map((e) => (
              <Field
                key={e.key}
                label={e.label}
                value={Array.isArray(e.value) ? e.value.join(', ') : String(e.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
