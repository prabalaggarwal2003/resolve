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

const INVOICE_STATUSES = ['Pending', 'Paid', 'Overdue', 'Cancelled'];

function formatDate(value?: string) {
  return formatOrgDate(value);
}

function partnerRef(inv: any) {
  const partner = inv.partnerId || inv.vendorId;
  const id = partner?._id || (typeof partner === 'string' ? partner : null) || inv.partnerId || inv.vendorId;
  const name = partner?.name || inv.vendorName || '—';
  const code = partner?.partnerCode || partner?.vendorId || '';
  return { id: id ? String(id) : null, name, code };
}

export default function PartnerInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [partners, setPartners] = useState<{ _id: string; name: string; partnerCode?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    partnerId: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/invoices'), { headers: authHeaders() }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load invoices');
        return Array.isArray(data) ? data : data.invoices || [];
      }),
      fetchPartners().catch(() => []),
    ])
      .then(([list, partnerList]) => {
        setInvoices(list);
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

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : 0;
    const to = filters.dateTo ? new Date(filters.dateTo).getTime() + 86400000 - 1 : 0;

    return invoices.filter((inv) => {
      if (filters.status && inv.status !== filters.status) return false;
      const { id, name, code } = partnerRef(inv);
      if (filters.partnerId && id !== filters.partnerId) return false;
      if (from || to) {
        const t = inv.purchaseDate ? new Date(inv.purchaseDate).getTime() : 0;
        if (from && (!t || t < from)) return false;
        if (to && (!t || t > to)) return false;
      }
      if (q) {
        const hay = `${inv.invoiceNumber || ''} ${inv.notes || ''} ${name} ${code} ${inv.paymentMethod || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (loading) return <LoadingSpinner message="Loading invoices..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">All Invoices</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {filtered.length} of {invoices.length} invoices
        </p>
      </div>

      <div className="rounded-xl border border-gray-700/60 bg-gray-900/30 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All</option>
              {INVOICE_STATUSES.map((s) => (
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
              placeholder="Invoice #, notes, partner…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <button
            type="button"
            className={`${btnGhost} disabled:opacity-40`}
            disabled={!activeFilterCount}
            onClick={() => setFilters({ status: '', partnerId: '', search: '', dateFrom: '', dateTo: '' })}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/60 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Invoice #</th>
              <th className={thClass}>Partner</th>
              <th className={thClass}>Date</th>
              <th className={thClass}>Due</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Method</th>
              <th className={thClass}>Currency</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={`${thClass} text-right`}>Paid</th>
              <th className={`${thClass} text-right`}>Balance</th>
              <th className={thClass}>Notes</th>
              <th className={thClass}>Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-xs text-gray-500">
                  No invoices found
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const { id: partnerId, name: partnerName } = partnerRef(inv);
              const currency = inv.currency || 'INR';
              const balance = Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
              return (
                <tr key={inv._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>
                    {partnerId ? (
                      <Link
                        href={`/dashboard/partners/${partnerId}?invoiceId=${inv._id}`}
                        className="text-blue-300 no-underline font-mono"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    ) : (
                      inv.invoiceNumber
                    )}
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
                  <td className={tdClass}>{formatDate(inv.purchaseDate)}</td>
                  <td className={tdClass}>{formatDate(inv.dueDate)}</td>
                  <td className={tdClass}>{inv.status || '—'}</td>
                  <td className={tdClass}>{inv.paymentMethod || '—'}</td>
                  <td className={tdClass}>{currency}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(inv.totalAmount || 0, currency)}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(inv.paidAmount || 0, currency)}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(balance, currency)}</td>
                  <td className={`${tdClass} max-w-[10rem] whitespace-normal break-words`}>{inv.notes || '—'}</td>
                  <td className={tdClass}>
                    {partnerId ? (
                      <Link
                        href={`/dashboard/partners/${partnerId}?invoiceId=${inv._id}`}
                        className="text-blue-300 no-underline"
                      >
                        View
                      </Link>
                    ) : (
                      '—'
                    )}
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
