'use client';

import Link from 'next/link';
import { formatBudgetCurrency, type BudgetOrgConfig } from '@/lib/budgets';
import type { Procurement } from '@/lib/procurement';
import { formatOrgDate } from '@/lib/orgTimezone';

function formatDate(value?: string) {
  return formatOrgDate(value);
}

function Field({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</p>
      <p className={`text-sm break-words ${accent || 'text-gray-200'}`}>{value}</p>
    </div>
  );
}

function StatusPill({
  id,
  options,
}: {
  id: string;
  options?: { id: string; name: string; color?: string }[];
}) {
  const opt = options?.find((o) => o.id === id);
  const color = opt?.color || '#6b7280';
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0"
      style={{ color, backgroundColor: `${color}22`, borderColor: `${color}55` }}
    >
      {opt?.name || id}
    </span>
  );
}

function refName(val: unknown): string {
  if (!val) return '—';
  if (typeof val === 'object' && val !== null && 'name' in val) {
    return String((val as { name?: string }).name || '—');
  }
  return String(val);
}

function refId(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'object' && val !== null && '_id' in val) return String((val as { _id: string })._id);
  return String(val);
}

export default function ProcurementDetailFields({
  record,
  config,
}: {
  record: Procurement;
  config: BudgetOrgConfig | null;
}) {
  const currency =
    typeof record.budgetId === 'object' && record.budgetId?.currency
      ? record.budgetId.currency
      : 'INR';

  const fundingLabel =
    config?.fundingSources?.find((f) => f.id === record.fundingSourceId)?.name ||
    record.fundingSourceId ||
    '—';

  const dimensionEntries = Object.entries(record.dimensions || {}).filter(
    ([, v]) => v != null && v !== ''
  );
  const enabledDimensions = config?.enabledDimensions || [];
  const labeledDimensions = dimensionEntries.map(([key, value]) => ({
    key,
    label: enabledDimensions.find((d) => d.key === key)?.label || key,
    value: String(value),
  }));

  const customFields = config?.procurementCustomFields || [];
  const customEntries = customFields
    .map((f) => ({ key: f.key, label: f.label, value: record.customFields?.[f.key] }))
    .filter((e) => e.value != null && e.value !== '' && !(Array.isArray(e.value) && e.value.length === 0));

  const budgetId = refId(record.budgetId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-100 break-words">{record.purchaseId}</h2>
          {record.purchaseOrderNumber ? (
            <p className="text-xs text-gray-500 mt-0.5">PO: {record.purchaseOrderNumber}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          <StatusPill id={record.lifecycleStage} options={config?.procurementLifecycleStages} />
          <StatusPill id={record.paymentStatus} options={config?.procurementPaymentStatuses} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Vendor" value={refName(record.vendorId)} />
        <Field
          label="Budget"
          value={
            budgetId ? (
              <Link
                href={`/dashboard/budgets/${budgetId}`}
                className="text-blue-400 hover:underline no-underline"
                onClick={(e) => e.stopPropagation()}
              >
                {refName(record.budgetId)}
              </Link>
            ) : (
              '—'
            )
          }
        />
        <Field label="Department" value={refName(record.departmentId)} />
        <Field label="Purchase date" value={formatDate(record.purchaseDate)} />
        <Field label="Invoice" value={record.invoiceNumber || '—'} />
        <Field label="Funding source" value={fundingLabel} />
        <Field label="Cost center" value={record.costCenter || '—'} />
        <Field label="Project" value={record.project || '—'} />
        <Field label="Created" value={formatDate(record.createdAt)} />
        <Field label="Last updated" value={formatDate(record.updatedAt)} />
      </div>

      <div className="rounded-lg border border-gray-800/70 bg-gray-900/30 p-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Financials</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Amount" value={formatBudgetCurrency(record.amount, currency)} accent="text-gray-100 font-medium" />
          <Field label="Tax" value={formatBudgetCurrency(record.tax, currency)} />
          <Field label="Discount" value={formatBudgetCurrency(record.discount, currency)} />
          <Field label="Shipping" value={formatBudgetCurrency(record.shipping, currency)} />
          <Field
            label="Total cost"
            value={formatBudgetCurrency(record.totalCost, currency)}
            accent="text-emerald-300 font-medium"
          />
        </div>
      </div>

      {record.notes ? (
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Notes</p>
          <p className="text-sm text-gray-400 whitespace-pre-wrap break-words">{record.notes}</p>
        </div>
      ) : null}

      {labeledDimensions.length > 0 ? (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Dimensions</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {labeledDimensions.map((e) => (
              <Field key={e.key} label={e.label} value={e.value} />
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

      {record.attachments && record.attachments.length > 0 ? (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Attachments</p>
          <ul className="space-y-1">
            {record.attachments.map((a, i) => (
              <li key={`${a.url}-${i}`}>
                <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline">
                  {a.name || a.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {record.assetIds && record.assetIds.length > 0 ? (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Linked assets</p>
          <ul className="space-y-1.5">
            {record.assetIds.map((a) => (
              <li key={a._id}>
                <Link
                  href={`/dashboard/assets/${a._id}`}
                  className="text-sm text-blue-400 hover:underline no-underline"
                >
                  {a.assetId} — {a.name}
                </Link>
                {a.cost != null ? (
                  <span className="text-xs text-gray-500 ml-2">{formatBudgetCurrency(a.cost, currency)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
