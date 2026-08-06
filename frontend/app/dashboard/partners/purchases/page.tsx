'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiUrl, authHeaders } from '@/lib/api';
import { formatMoney } from '@/lib/businessPartners';

const thClass = 'px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500';
const tdClass = 'px-3 py-2 text-xs text-gray-300';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PartnerPurchasesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(apiUrl('/procurement?limit=200'), { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load purchases');
        setRows(data.procurements || data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading purchases..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Purchases</h2>
        <p className="text-xs text-gray-500 mt-0.5">{rows.length} procurement records</p>
      </div>
      <div className="rounded-xl border border-gray-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Vendor / Partner</th>
              <th className={thClass}>Title / Ref</th>
              <th className={thClass}>Date</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-500">
                  No purchases found
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const partnerId = p.businessPartnerId?._id || p.businessPartnerId || p.vendorId?._id || p.vendorId;
              const partnerName =
                p.businessPartnerId?.name || p.vendorId?.name || p.vendorName || p.partnerName || '—';
              return (
                <tr key={p._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>
                    {partnerId ? (
                      <Link href={`/dashboard/partners/${partnerId}`} className="text-blue-300 no-underline">
                        {partnerName}
                      </Link>
                    ) : (
                      partnerName
                    )}
                  </td>
                  <td className={tdClass}>{p.title || p.poNumber || p._id}</td>
                  <td className={tdClass}>{formatDate(p.purchaseDate || p.createdAt)}</td>
                  <td className={tdClass}>{p.status || '—'}</td>
                  <td className={`${tdClass} text-right`}>
                    {formatMoney(Number(p.amount || p.totalAmount || 0))}
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
