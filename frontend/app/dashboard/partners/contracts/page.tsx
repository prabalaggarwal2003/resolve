'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fetchPartners, partnerAction } from '@/lib/businessPartners';
import { formatOrgDate } from '@/lib/orgTimezone';

const thClass = 'px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500';
const tdClass = 'px-3 py-2 text-xs text-gray-300';
const inputClass =
  'px-2.5 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 min-w-[140px]';
const labelClass = 'text-[9px] text-gray-600 uppercase tracking-wide block mb-0.5';
const btnGhost =
  'px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 transition-colors';

const CONTRACT_STATUSES = ['Draft', 'Active', 'Expired', 'Renewed', 'Cancelled'];

function formatDate(value?: string) {
  return formatOrgDate(value);
}

export default function PartnerContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [partners, setPartners] = useState<{ _id: string; name: string; partnerCode?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    partnerId: '',
    search: '',
    expiring: '',
  });

  useEffect(() => {
    Promise.all([partnerAction('/contracts', 'GET'), fetchPartners().catch(() => [])])
      .then(([data, partnerList]) => {
        setContracts(data.contracts || []);
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
    const now = Date.now();
    const horizonDays = filters.expiring ? Number(filters.expiring) : 0;
    const horizon = horizonDays ? now + horizonDays * 86400000 : 0;
    const q = filters.search.trim().toLowerCase();

    return contracts.filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      const pid = c.partnerId?._id || c.partnerId;
      if (filters.partnerId && String(pid) !== filters.partnerId) return false;
      if (horizonDays) {
        if (!c.endDate) return false;
        if (['Cancelled', 'Expired'].includes(c.status)) return false;
        const end = new Date(c.endDate).getTime();
        if (end < now || end > horizon) return false;
      }
      if (q) {
        const hay = `${c.contractNumber || ''} ${c.title || ''} ${c.notes || ''} ${c.partnerId?.name || ''} ${c.partnerId?.partnerCode || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contracts, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (loading) return <LoadingSpinner message="Loading contracts..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">All Contracts</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {filtered.length} of {contracts.length} contracts
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
              {CONTRACT_STATUSES.map((s) => (
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
            <label className={labelClass}>Expiring within</label>
            <select
              className={inputClass}
              value={filters.expiring}
              onChange={(e) => setFilters({ ...filters, expiring: e.target.value })}
            >
              <option value="">Any time</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Search</label>
            <input
              className={`${inputClass} min-w-[180px]`}
              placeholder="Number, title, notes…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <button
            type="button"
            className={`${btnGhost} disabled:opacity-40`}
            disabled={!activeFilterCount}
            onClick={() => setFilters({ status: '', partnerId: '', search: '', expiring: '' })}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/60 overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Partner</th>
              <th className={thClass}>Number</th>
              <th className={thClass}>Title</th>
              <th className={thClass}>Start</th>
              <th className={thClass}>End</th>
              <th className={thClass}>Renewal</th>
              <th className={thClass}>Reminder</th>
              <th className={thClass}>Auto</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Notes</th>
              <th className={thClass}>Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-xs text-gray-500">
                  No contracts found
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const partnerId = c.partnerId?._id || c.partnerId;
              return (
                <tr key={c._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>
                    {partnerId ? (
                      <Link href={`/dashboard/partners/${partnerId}`} className="text-blue-300 no-underline">
                        {c.partnerId?.name || c.partnerId?.partnerCode || 'Partner'}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={tdClass}>
                    {partnerId ? (
                      <Link
                        href={`/dashboard/partners/${partnerId}?contractId=${c._id}`}
                        className="text-blue-300 no-underline font-mono"
                      >
                        {c.contractNumber}
                      </Link>
                    ) : (
                      c.contractNumber
                    )}
                  </td>
                  <td className={tdClass}>{c.title || '—'}</td>
                  <td className={tdClass}>{formatDate(c.startDate)}</td>
                  <td className={tdClass}>{formatDate(c.endDate)}</td>
                  <td className={tdClass}>{formatDate(c.renewalDate)}</td>
                  <td className={tdClass}>{c.reminderDays != null ? `${c.reminderDays}d` : '—'}</td>
                  <td className={tdClass}>{c.autoRenewal ? 'Yes' : '—'}</td>
                  <td className={tdClass}>{c.status}</td>
                  <td className={`${tdClass} max-w-[12rem] whitespace-normal break-words`}>{c.notes || '—'}</td>
                  <td className={tdClass}>
                    {partnerId ? (
                      <Link
                        href={`/dashboard/partners/${partnerId}?contractId=${c._id}`}
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
