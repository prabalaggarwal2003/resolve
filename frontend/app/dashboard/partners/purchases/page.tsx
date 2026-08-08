'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiUrl, authHeaders } from '@/lib/api';
import { fetchPartners, formatMoney } from '@/lib/businessPartners';
import { formatOrgDate } from '@/lib/orgTimezone';

const thClass = 'px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500';
const tdClass = 'px-3 py-2 text-xs text-gray-300';
const inputClass =
  'px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 min-w-[140px]';
const labelClass = 'text-[9px] text-gray-600 uppercase tracking-wide block mb-0.5';
const btnGhost =
  'px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 transition-colors';

function formatDate(value?: string) {
  return formatOrgDate(value);
}

function partnerRef(row: any) {
  const partner = row.partnerId || row.vendorId;
  const id = partner?._id || (typeof partner === 'string' ? partner : null);
  const name = partner?.name || row.vendorName || row.partnerName || '—';
  return { id: id ? String(id) : null, name };
}

export default function PartnerPurchasesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [partners, setPartners] = useState<{ _id: string; name: string; partnerCode?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    lifecycleStage: '',
    paymentStatus: '',
    partnerId: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/procurement?limit=500'), { headers: authHeaders() }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load purchases');
        return data.procurements || data || [];
      }),
      fetchPartners().catch(() => []),
    ])
      .then(([list, partnerList]) => {
        setRows(Array.isArray(list) ? list : []);
        setPartners(
          (partnerList || []).map((p: any) => ({
            _id: p._id,
            name: p.name,
            partnerCode: p.partnerCode,
          }))
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const lifecycleOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.lifecycleStage).filter(Boolean))).sort(),
    [rows]
  );
  const paymentOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.paymentStatus).filter(Boolean))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : 0;
    const to = filters.dateTo ? new Date(filters.dateTo).getTime() + 86400000 - 1 : 0;

    return rows.filter((p) => {
      if (filters.lifecycleStage && p.lifecycleStage !== filters.lifecycleStage) return false;
      if (filters.paymentStatus && p.paymentStatus !== filters.paymentStatus) return false;
      const { id, name } = partnerRef(p);
      if (filters.partnerId && id !== filters.partnerId) return false;
      if (from || to) {
        const t = p.purchaseDate ? new Date(p.purchaseDate).getTime() : 0;
        if (from && (!t || t < from)) return false;
        if (to && (!t || t > to)) return false;
      }
      if (q) {
        const hay = `${p.purchaseId || ''} ${p.purchaseOrderNumber || ''} ${p.invoiceNumber || ''} ${p.notes || ''} ${name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (loading) return <LoadingSpinner message="Loading purchases..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">All Purchases</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {filtered.length} of {rows.length} procurement records
        </p>
      </div>

      <div className="rounded-xl border border-gray-700/60 bg-gray-900/30 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>Lifecycle</label>
            <select
              className={inputClass}
              value={filters.lifecycleStage}
              onChange={(e) => setFilters({ ...filters, lifecycleStage: e.target.value })}
            >
              <option value="">All</option>
              {lifecycleOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Payment</label>
            <select
              className={inputClass}
              value={filters.paymentStatus}
              onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
            >
              <option value="">All</option>
              {paymentOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Partner</label>
            <select
              className={inputClass}
              value={filters.partnerId}
              onChange={(e) => setFilters({ ...filters, partnerId: e.target.value })}
            >
              <option value="">All</option>
              {partners.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                  {p.partnerCode ? ` (${p.partnerCode})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>From</label>
            <input
              type="date"
              className={inputClass}
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>To</label>
            <input
              type="date"
              className={inputClass}
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Search</label>
            <input
              className={`${inputClass} min-w-[180px]`}
              placeholder="Purchase ID, PO, invoice…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <button
            type="button"
            className={`${btnGhost} disabled:opacity-40`}
            disabled={!activeFilterCount}
            onClick={() =>
              setFilters({
                lifecycleStage: '',
                paymentStatus: '',
                partnerId: '',
                search: '',
                dateFrom: '',
                dateTo: '',
              })
            }
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/60 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Purchase ID</th>
              <th className={thClass}>Partner</th>
              <th className={thClass}>PO #</th>
              <th className={thClass}>Invoice #</th>
              <th className={thClass}>Date</th>
              <th className={thClass}>Lifecycle</th>
              <th className={thClass}>Payment</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} text-right`}>Tax</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={thClass}>Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-xs text-gray-500">
                  No purchases found
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const { id: partnerId, name: partnerName } = partnerRef(p);
              return (
                <tr key={p._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>
                    <Link
                      href={`/dashboard/budgets/procurement?id=${p._id}`}
                      className="text-blue-300 no-underline font-mono"
                    >
                      {p.purchaseId || String(p._id).slice(-6)}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    {partnerId ? (
                      <Link href={`/dashboard/partners/${partnerId}`} className="text-blue-300 no-underline">
                        {partnerName}
                      </Link>
                    ) : (
                      partnerName
                    )}
                  </td>
                  <td className={tdClass}>{p.purchaseOrderNumber || '—'}</td>
                  <td className={tdClass}>{p.invoiceNumber || '—'}</td>
                  <td className={tdClass}>{formatDate(p.purchaseDate || p.createdAt)}</td>
                  <td className={tdClass}>{p.lifecycleStage || p.status || '—'}</td>
                  <td className={tdClass}>{p.paymentStatus || '—'}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(Number(p.amount || 0))}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(Number(p.tax || 0))}</td>
                  <td className={`${tdClass} text-right`}>
                    {formatMoney(Number(p.totalCost ?? p.totalAmount ?? p.amount ?? 0))}
                  </td>
                  <td className={tdClass}>
                    <Link
                      href={`/dashboard/budgets/procurement?id=${p._id}`}
                      className="text-blue-300 no-underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
