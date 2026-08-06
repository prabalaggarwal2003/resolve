'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fetchPartners, partnerAction, formatMoney, BusinessPartner } from '@/lib/businessPartners';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const btnPrimary =
  'px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-50';

export default function PartnerPerformancePage() {
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [kpis, setKpis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPartners()
      .then((list) => {
        setPartners(list);
        if (list[0]) setPartnerId(list[0]._id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadPerformance(id: string) {
    if (!id) return;
    setLoadingKpis(true);
    setError('');
    try {
      const data = await partnerAction(`/${id}/performance`, 'GET');
      setKpis(data.kpis || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load performance');
      setKpis([]);
    } finally {
      setLoadingKpis(false);
    }
  }

  useEffect(() => {
    if (partnerId) loadPerformance(partnerId);
  }, [partnerId]);

  if (loading) return <LoadingSpinner message="Loading partners..." />;

  const selected = partners.find((p) => p._id === partnerId);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Performance</h2>
        <p className="text-xs text-gray-500 mt-0.5">Select a partner to view KPI metrics</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end max-w-xl">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Partner</label>
          <select className={inputClass} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            {partners.map((p) => (
              <option key={p._id} value={p._id}>
                {p.partnerCode} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={btnPrimary} disabled={!partnerId || loadingKpis} onClick={() => loadPerformance(partnerId)}>
          {loadingKpis ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {loadingKpis ? (
        <LoadingSpinner message="Loading performance..." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {kpis.length === 0 && <p className="text-xs text-gray-500 col-span-full">No KPIs for this partner</p>}
          {kpis.map((kpi) => (
            <div key={kpi.key} className="px-3 py-2.5 rounded-xl border border-gray-700/50 bg-gray-900/40">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{kpi.label}</p>
              <p className="text-lg font-semibold text-blue-300 mt-1 tabular-nums">
                {kpi.available === false || kpi.value == null
                  ? '—'
                  : kpi.unit === 'currency'
                    ? formatMoney(Number(kpi.value), selected?.currency)
                    : `${kpi.value}${kpi.unit === 'percent' ? '%' : kpi.unit && kpi.unit !== 'count' && kpi.unit !== 'score' ? ` ${kpi.unit}` : ''}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
