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

export default function PartnerInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(apiUrl('/invoices'), { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load invoices');
        setInvoices(Array.isArray(data) ? data : data.invoices || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading invoices..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Invoices</h2>
        <p className="text-xs text-gray-500 mt-0.5">{invoices.length} invoices</p>
      </div>
      <div className="rounded-xl border border-gray-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Invoice #</th>
              <th className={thClass}>Partner / Vendor</th>
              <th className={thClass}>Date</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={`${thClass} text-right`}>Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-500">
                  No invoices found
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const partnerId =
                inv.businessPartnerId?._id || inv.businessPartnerId || inv.vendorId?._id || inv.vendorId;
              const partnerName =
                inv.businessPartnerId?.name || inv.vendorId?.name || inv.vendorName || '—';
              return (
                <tr key={inv._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>{inv.invoiceNumber}</td>
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
                  <td className={tdClass}>{inv.status || '—'}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(inv.totalAmount || 0)}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(inv.paidAmount || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
