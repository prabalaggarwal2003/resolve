'use client';

import { useEffect, useState } from 'react';
import { fetchBudgetConfig, fetchBudgets, type Budget, type BudgetOrgConfig } from '@/lib/budgets';
import { fetchProcurements, type Procurement } from '@/lib/procurement';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

export type AssetProcurementValues = {
  budgetId: string;
  procurementId: string;
  fundingSourceId: string;
  costCenter: string;
  purchaseOrderNumber: string;
  invoiceNumber: string;
};

export const EMPTY_ASSET_PROCUREMENT: AssetProcurementValues = {
  budgetId: '',
  procurementId: '',
  fundingSourceId: '',
  costCenter: '',
  purchaseOrderNumber: '',
  invoiceNumber: '',
};

function refId(val: unknown) {
  if (!val) return '';
  if (typeof val === 'object' && val !== null && '_id' in val) return String((val as { _id: string })._id);
  return String(val);
}

type Props = {
  values: AssetProcurementValues;
  onChange: (values: AssetProcurementValues) => void;
  /** When procurement is selected, optionally sync vendor/cost fields upstream */
  onProcurementSelect?: (proc: Procurement | null) => void;
};

export default function AssetProcurementFields({ values, onChange, onProcurementSelect }: Props) {
  const [config, setConfig] = useState<BudgetOrgConfig | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchBudgetConfig().catch(() => null),
      fetchBudgets().catch(() => []),
      fetchProcurements().catch(() => []),
    ]).then(([cfg, bList, pList]) => {
      if (cfg) setConfig(cfg);
      setBudgets(bList);
      setProcurements(pList);
      setLoaded(true);
    });
  }, []);

  const filteredProcurements = values.budgetId
    ? procurements.filter((p) => refId(p.budgetId) === values.budgetId)
    : procurements;

  const set = (patch: Partial<AssetProcurementValues>) => onChange({ ...values, ...patch });

  const handleProcurementChange = (procurementId: string) => {
    const next = { ...values, procurementId };
    if (!procurementId) {
      onChange(next);
      onProcurementSelect?.(null);
      return;
    }
    const proc = procurements.find((p) => p._id === procurementId);
    if (proc) {
      onChange({
        ...next,
        budgetId: refId(proc.budgetId) || next.budgetId,
        fundingSourceId: proc.fundingSourceId || next.fundingSourceId,
        costCenter: proc.costCenter || next.costCenter,
        purchaseOrderNumber: proc.purchaseOrderNumber || next.purchaseOrderNumber,
        invoiceNumber: proc.invoiceNumber || next.invoiceNumber,
      });
      onProcurementSelect?.(proc);
    } else {
      onChange(next);
    }
  };

  if (!loaded) return null;

  return (
    <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-4 mb-4">
      <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-widest mb-3">
        Budget & procurement traceability
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Budget</label>
          <select
            className={inputClass}
            value={values.budgetId}
            onChange={(e) => set({ budgetId: e.target.value, procurementId: '' })}
          >
            <option value="">— None —</option>
            {budgets.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}{b.code ? ` (${b.code})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Procurement record</label>
          <select
            className={inputClass}
            value={values.procurementId}
            onChange={(e) => handleProcurementChange(e.target.value)}
          >
            <option value="">— None —</option>
            {filteredProcurements.map((p) => (
              <option key={p._id} value={p._id}>
                {p.purchaseId}
                {p.purchaseOrderNumber ? ` · PO ${p.purchaseOrderNumber}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Funding source</label>
          <select
            className={inputClass}
            value={values.fundingSourceId}
            onChange={(e) => set({ fundingSourceId: e.target.value })}
          >
            <option value="">— None —</option>
            {(config?.fundingSources || []).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Cost center</label>
          <input
            className={inputClass}
            value={values.costCenter}
            onChange={(e) => set({ costCenter: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Purchase order</label>
          <input
            className={inputClass}
            value={values.purchaseOrderNumber}
            onChange={(e) => set({ purchaseOrderNumber: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Invoice number</label>
          <input
            className={inputClass}
            value={values.invoiceNumber}
            onChange={(e) => set({ invoiceNumber: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function assetProcurementPayload(values: AssetProcurementValues) {
  const payload: Record<string, string | undefined> = {};
  if (values.budgetId) payload.budgetId = values.budgetId;
  if (values.procurementId) payload.procurementId = values.procurementId;
  if (values.fundingSourceId) payload.fundingSourceId = values.fundingSourceId;
  if (values.costCenter.trim()) payload.costCenter = values.costCenter.trim();
  if (values.purchaseOrderNumber.trim()) payload.purchaseOrderNumber = values.purchaseOrderNumber.trim();
  if (values.invoiceNumber.trim()) payload.invoiceNumber = values.invoiceNumber.trim();
  return payload;
}

export function assetProcurementFromRecord(asset: Record<string, unknown>): AssetProcurementValues {
  return {
    budgetId: refId(asset.budgetId),
    procurementId: refId(asset.procurementId),
    fundingSourceId: String(asset.fundingSourceId || ''),
    costCenter: String(asset.costCenter || ''),
    purchaseOrderNumber: String(asset.purchaseOrderNumber || ''),
    invoiceNumber: String(asset.invoiceNumber || ''),
  };
}
