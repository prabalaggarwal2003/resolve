'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fetchPartners, partnerAction, BusinessPartner } from '@/lib/businessPartners';

const thClass = 'px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500';
const tdClass = 'px-3 py-2 text-xs text-gray-300';

export default function PartnerAssetsPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([partnerAction('/links?resourceType=asset', 'GET'), fetchPartners()])
      .then(([linkData, partnerList]) => {
        setLinks(linkData.links || []);
        setPartners(partnerList);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading partner assets..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  const withAssets = partners.filter((p) => (p.assetCount || 0) > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Partner assets</h2>
        <p className="text-xs text-gray-500 mt-0.5">Asset links and partners with linked assets</p>
      </div>

      <section className="rounded-xl border border-gray-700/60 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700/60 bg-gray-900/50">
          <h3 className="text-sm font-semibold text-gray-200">Asset links</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Partner</th>
              <th className={thClass}>Relationship</th>
              <th className={thClass}>Asset ID</th>
              <th className={thClass}>Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {links.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-500">
                  No asset links
                </td>
              </tr>
            )}
            {links.map((l) => (
              <tr key={l._id} className="hover:bg-gray-800/40">
                <td className={tdClass}>
                  {l.partnerId?._id ? (
                    <Link href={`/dashboard/partners/${l.partnerId._id}`} className="text-blue-300 no-underline">
                      {l.partnerId.name || l.partnerId.partnerCode}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={tdClass}>{l.relationshipTypeKey}</td>
                <td className={tdClass}>
                  <Link href={`/dashboard/assets/${l.resourceId}`} className="text-blue-300 no-underline font-mono">
                    {String(l.resourceId)}
                  </Link>
                </td>
                <td className={tdClass}>{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-gray-700/60 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700/60 bg-gray-900/50">
          <h3 className="text-sm font-semibold text-gray-200">Partners by asset count</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 border-b border-gray-700/60">
            <tr>
              <th className={thClass}>Code</th>
              <th className={thClass}>Name</th>
              <th className={`${thClass} text-right`}>Assets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {withAssets.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-500">
                  No partners with assets
                </td>
              </tr>
            )}
            {withAssets
              .slice()
              .sort((a, b) => (b.assetCount || 0) - (a.assetCount || 0))
              .map((p) => (
                <tr key={p._id} className="hover:bg-gray-800/40">
                  <td className={`${tdClass} font-mono text-gray-400`}>{p.partnerCode}</td>
                  <td className={tdClass}>
                    <Link href={`/dashboard/partners/${p._id}`} className="text-blue-300 no-underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-right text-blue-300`}>{p.assetCount || 0}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
