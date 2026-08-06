'use client';

import LoadingSpinner from '@/components/LoadingSpinner';
import PartnerActivityList from '@/components/partners/PartnerActivityList';
import { fetchPartnerSummary, formatMoney, fetchPartnerDashboards, savePartnerDashboard } from '@/lib/businessPartners';
import { canWrite } from '@/lib/permissions';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function Card({ label, value, accent = 'text-gray-100' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="px-3 py-2.5 rounded-xl border border-gray-700/50 bg-gray-900/40">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold mt-1 tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

type PartnerSummary = {
  totals?: number;
  active?: number;
  inactive?: number;
  contractsExpiring?: number;
  pendingPayments?: number;
  purchaseValue?: number;
  linkedAssets?: number;
  recentActivity?: any[];
  topPartners?: {
    id: string;
    name: string;
    partnerCode?: string;
    totalSpend?: number;
  }[];
};

export default function PartnersDashboardPage() {
  const [summary, setSummary] = useState<PartnerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canEdit = canWrite('businessPartners');

  useEffect(() => {
    fetchPartnerSummary()
      .then(async (s) => {
        setSummary(s);
        const dashboards = await fetchPartnerDashboards().catch(() => []);
        if (!dashboards.length && canEdit) {
          await savePartnerDashboard(null, { name: 'Partners Overview', scope: 'organization' }).catch(() => null);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [canEdit]);

  if (loading) return <LoadingSpinner message="Loading partners dashboard..." />;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Total Partners" value={summary.totals ?? 0} accent="text-blue-300" />
        <Card label="Active" value={summary.active ?? 0} accent="text-emerald-300" />
        <Card label="Inactive" value={summary.inactive ?? 0} accent="text-gray-300" />
        <Card label="Contracts Expiring" value={summary.contractsExpiring ?? 0} accent="text-amber-300" />
        <Card label="Pending Payments" value={formatMoney(summary.pendingPayments ?? 0)} accent="text-rose-300" />
        <Card label="Purchase Value" value={formatMoney(summary.purchaseValue ?? 0)} accent="text-violet-300" />
        <Card label="Assets Linked" value={summary.linkedAssets ?? 0} accent="text-cyan-300" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Recent Activity</h2>
          <PartnerActivityList activities={summary.recentActivity || []} showPartner maxHeightClass="max-h-72 overflow-y-auto" />
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Top Partners by Spend</h2>
          <ul className="space-y-2">
            {(summary.topPartners || []).length === 0 && (
              <li className="text-xs text-gray-500">No spend data yet</li>
            )}
            {(summary.topPartners || []).map((t) => (
              <li key={t.id} className="flex justify-between text-xs text-gray-300">
                <Link href={`/dashboard/partners/${t.id}`} className="text-blue-300 no-underline">
                  {t.name}
                  {t.partnerCode ? (
                    <span className="text-gray-500 font-mono ml-1">{t.partnerCode}</span>
                  ) : null}
                </Link>
                <span className="tabular-nums text-gray-400">{formatMoney(t.totalSpend ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
