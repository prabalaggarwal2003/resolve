'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { partnerAction } from '@/lib/businessPartners';

const thClass = 'px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500';
const tdClass = 'px-3 py-2 text-xs text-gray-300';

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PartnerContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    partnerAction('/contracts', 'GET')
      .then((data) => setContracts(data.contracts || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading contracts..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Contracts</h2>
        <p className="text-xs text-gray-500 mt-0.5">{contracts.length} contracts</p>
      </div>
      <div className="rounded-xl border border-gray-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Partner</th>
              <th className={thClass}>Number</th>
              <th className={thClass}>Title</th>
              <th className={thClass}>Start</th>
              <th className={thClass}>End</th>
              <th className={thClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {contracts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-500">
                  No contracts found
                </td>
              </tr>
            )}
            {contracts.map((c) => (
              <tr key={c._id} className="hover:bg-gray-800/40">
                <td className={tdClass}>
                  {c.partnerId?._id ? (
                    <Link href={`/dashboard/partners/${c.partnerId._id}`} className="text-blue-300 no-underline">
                      {c.partnerId.name || c.partnerId.partnerCode}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={tdClass}>{c.contractNumber}</td>
                <td className={tdClass}>{c.title || '—'}</td>
                <td className={tdClass}>{formatDate(c.startDate)}</td>
                <td className={tdClass}>{formatDate(c.endDate)}</td>
                <td className={tdClass}>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
