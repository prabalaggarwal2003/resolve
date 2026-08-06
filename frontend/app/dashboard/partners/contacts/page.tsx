'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { partnerAction } from '@/lib/businessPartners';

const thClass = 'px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500';
const tdClass = 'px-3 py-2 text-xs text-gray-300';

export default function PartnerContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    partnerAction('/contacts', 'GET')
      .then((data) => setContacts(data.contacts || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading contacts..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Contacts</h2>
        <p className="text-xs text-gray-500 mt-0.5">{contacts.length} contacts across all partners</p>
      </div>
      <div className="rounded-xl border border-gray-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Partner</th>
              <th className={thClass}>Name</th>
              <th className={thClass}>Role</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Phone</th>
              <th className={thClass}>Primary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {contacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-500">
                  No contacts found
                </td>
              </tr>
            )}
            {contacts.map((c, i) => (
              <tr key={`${c.partnerId}-${c._id || i}`} className="hover:bg-gray-800/40">
                <td className={tdClass}>
                  <Link href={`/dashboard/partners/${c.partnerId}`} className="text-blue-300 no-underline">
                    {c.partnerName || c.partnerCode}
                  </Link>
                </td>
                <td className={tdClass}>{c.name}</td>
                <td className={tdClass}>{c.role || '—'}</td>
                <td className={tdClass}>{c.email || '—'}</td>
                <td className={tdClass}>{c.phone || c.mobile || '—'}</td>
                <td className={tdClass}>{c.isPrimary ? 'Yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
