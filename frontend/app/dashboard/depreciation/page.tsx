'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { UpgradePrompt } from '@/lib/subscriptionUtils';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface SLMMetrics {
  purchaseCost: number;
  residualValue: number;
  usefulLife: number;
  annualDepreciation: number;
  currentBookValue: number;
  totalDepreciation: number;
  depreciationPercentage: number;
}

interface WDVMetrics {
  purchaseCost: number;
  depreciationRate: number;
  currentBookValue: number;
  totalDepreciation: number;
  depreciationPercentage: number;
}

interface OperationalMetrics {
  healthScore: number;
  healthLabel: string;
  replacementPriority: string;
  replacementLabel: string;
  replacementEmoji: string;
  replacementDescription: string;
  estimatedRemainingUsefulLife: number;
  issueCount: number;
  openIssueCount: number;
  maintenanceCount: number;
  warrantyActive: boolean;
  warrantyExpiringSoon: boolean;
}

interface AssetMetrics {
  assetId: string;
  assetIdString: string;
  name: string;
  category: string;
  purchaseDate?: string;
  ageYears: number;
  slm: SLMMetrics;
  wdv: WDVMetrics;
  operational: OperationalMetrics;
}

interface DashboardSummary {
  totalAssets: number;
  totalPurchaseValue: number;
  currentBookValueSLM: number;
  currentBookValueWDV: number;
  averageAssetHealth: number;
  assetsNeedingReplacement: number;
  assetsUnderWarranty: number;
  warrantiesExpiringSoon: number;
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function healthColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 75) return 'text-blue-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    low: 'bg-green-900/30 text-green-400 border-green-800/40',
    medium: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40',
    high: 'bg-orange-900/30 text-orange-400 border-orange-800/40',
    critical: 'bg-red-900/30 text-red-400 border-red-800/40',
  };
  return map[priority] || map.medium;
}

const CATEGORY_USEFUL_LIFE: Record<string, number> = {
  Projector: 5, Whiteboard: 10, Desktop: 4, Laptop: 3, AC: 8,
  Furniture: 10, 'Lab Equipment': 7, Printer: 5, Other: 5,
};

const EMPTY_SLM: SLMMetrics = {
  purchaseCost: 0,
  residualValue: 0,
  usefulLife: 5,
  annualDepreciation: 0,
  currentBookValue: 0,
  totalDepreciation: 0,
  depreciationPercentage: 0,
};

const EMPTY_WDV: WDVMetrics = {
  purchaseCost: 0,
  depreciationRate: 0.2,
  currentBookValue: 0,
  totalDepreciation: 0,
  depreciationPercentage: 0,
};

const EMPTY_OPERATIONAL: OperationalMetrics = {
  healthScore: 70,
  healthLabel: 'Good',
  replacementPriority: 'low',
  replacementLabel: 'Low',
  replacementEmoji: '🟢',
  replacementDescription: 'Healthy',
  estimatedRemainingUsefulLife: 0,
  issueCount: 0,
  openIssueCount: 0,
  maintenanceCount: 0,
  warrantyActive: false,
  warrantyExpiringSoon: false,
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function healthLabelFromScore(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'Poor';
}

function healthFromCondition(condition?: string): number {
  const map: Record<string, number> = {
    excellent: 95, good: 82, fair: 65, poor: 45, critical: 25, under_maintenance: 40,
  };
  return map[condition || 'good'] ?? 70;
}

/** Normalize API payload — supports new metrics shape and legacy depreciation fields */
function normalizeAssetMetrics(raw: Record<string, unknown> | null | undefined): AssetMetrics {
  const r = asObject(raw);
  const rawSlm = asObject(r.slm) as Partial<SLMMetrics>;
  const rawWdv = asObject(r.wdv) as Partial<WDVMetrics>;
  const rawOp = asObject(r.operational) as Partial<OperationalMetrics>;
  const factors = asObject(r.factors);

  const category = String(r.category || 'Other');
  const usefulLife = CATEGORY_USEFUL_LIFE[category] ?? 5;
  const cost = Number(rawSlm.purchaseCost ?? rawWdv.purchaseCost ?? r.originalCost ?? r.cost ?? 0) || 0;
  const currentValue = Number(
    rawSlm.currentBookValue ?? rawWdv.currentBookValue ?? r.currentValue ?? r.currentBookValue ?? cost
  ) || 0;
  const depPct = Number(
    rawSlm.depreciationPercentage ?? rawWdv.depreciationPercentage ?? r.depreciationPercentage ?? 0
  ) || (cost > 0 ? ((cost - currentValue) / cost) * 100 : 0);
  const ageYears = Number(r.ageYears ?? factors.age ?? 0) || 0;
  const issueCount = Number(rawOp.issueCount ?? factors.issueCount ?? 0) || 0;
  const openIssueCount = Number(rawOp.openIssueCount ?? 0) || 0;
  const maintenanceCount = Number(rawOp.maintenanceCount ?? factors.maintenanceCount ?? 0) || 0;
  const healthScore = Number(
    rawOp.healthScore ?? healthFromCondition(String(factors.condition ?? r.condition ?? 'good'))
  ) || 0;
  const replacementPriority = String(
    rawOp.replacementPriority ?? (healthScore < 50 ? 'high' : healthScore < 75 ? 'medium' : 'low')
  );

  const slm: SLMMetrics = {
    ...EMPTY_SLM,
    ...rawSlm,
    purchaseCost: Number(rawSlm.purchaseCost ?? cost) || 0,
    residualValue: Number(rawSlm.residualValue ?? round2(cost * 0.075)) || 0,
    usefulLife: Number(rawSlm.usefulLife ?? usefulLife) || usefulLife,
    annualDepreciation: Number(
      rawSlm.annualDepreciation ?? (usefulLife > 0 ? round2((cost - cost * 0.075) / usefulLife) : 0)
    ) || 0,
    currentBookValue: Number(rawSlm.currentBookValue ?? currentValue) || 0,
    totalDepreciation: Number(rawSlm.totalDepreciation ?? round2(cost - currentValue)) || 0,
    depreciationPercentage: Number(rawSlm.depreciationPercentage ?? round2(depPct)) || 0,
  };

  const wdv: WDVMetrics = {
    ...EMPTY_WDV,
    ...rawWdv,
    purchaseCost: Number(rawWdv.purchaseCost ?? cost) || 0,
    depreciationRate: Number(rawWdv.depreciationRate ?? 0.2) || 0.2,
    currentBookValue: Number(rawWdv.currentBookValue ?? currentValue) || 0,
    totalDepreciation: Number(rawWdv.totalDepreciation ?? round2(cost - currentValue)) || 0,
    depreciationPercentage: Number(rawWdv.depreciationPercentage ?? round2(depPct)) || 0,
  };

  const operational: OperationalMetrics = {
    ...EMPTY_OPERATIONAL,
    ...rawOp,
    healthScore,
    healthLabel: String(rawOp.healthLabel ?? healthLabelFromScore(healthScore)),
    replacementPriority,
    replacementLabel: String(
      rawOp.replacementLabel ?? (healthScore < 50 ? 'High' : healthScore < 75 ? 'Medium' : 'Low')
    ),
    replacementEmoji: String(
      rawOp.replacementEmoji ?? (healthScore < 50 ? '🟠' : healthScore < 75 ? '🟡' : '🟢')
    ),
    replacementDescription: String(
      rawOp.replacementDescription ?? (healthScore < 50 ? 'Replace Soon' : healthScore < 75 ? 'Monitor' : 'Healthy')
    ),
    estimatedRemainingUsefulLife: Number(
      rawOp.estimatedRemainingUsefulLife ?? Math.max(0, round2(usefulLife - ageYears))
    ) || 0,
    issueCount,
    openIssueCount,
    maintenanceCount,
    warrantyActive: Boolean(rawOp.warrantyActive ?? factors.warrantyExpired === false),
    warrantyExpiringSoon: Boolean(rawOp.warrantyExpiringSoon ?? false),
  };

  const assetId = String(r.assetId ?? r._id ?? '');

  return {
    assetId,
    assetIdString: String(r.assetIdString ?? assetId),
    name: String(r.name ?? 'Unnamed asset'),
    category,
    purchaseDate: r.purchaseDate as string | undefined,
    ageYears,
    slm,
    wdv,
    operational,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeSummary(raw: Record<string, unknown>): DashboardSummary {
  return {
    totalAssets: Number(raw.totalAssets ?? 0),
    totalPurchaseValue: Number(raw.totalPurchaseValue ?? raw.totalOriginalValue ?? 0),
    currentBookValueSLM: Number(raw.currentBookValueSLM ?? raw.totalCurrentValue ?? 0),
    currentBookValueWDV: Number(raw.currentBookValueWDV ?? raw.totalCurrentValue ?? 0),
    averageAssetHealth: Number(raw.averageAssetHealth ?? 0),
    assetsNeedingReplacement: Number(raw.assetsNeedingReplacement ?? 0),
    assetsUnderWarranty: Number(raw.assetsUnderWarranty ?? 0),
    warrantiesExpiringSoon: Number(raw.warrantiesExpiringSoon ?? 0),
  };
}

export default function DepreciationPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [assets, setAssets] = useState<AssetMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [section, setSection] = useState<'financial' | 'operational'>('financial');
  const [filterCategory, setFilterCategory] = useState('');
  const [assetsPage, setAssetsPage] = useState(1);
  const ASSETS_PER_PAGE = 10;
  const [tier, setTier] = useState<string>('free');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        setError('Not authenticated');
        return;
      }

      try {
        const subRes = await fetch(api('/api/payments/subscription-status'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const subData = await subRes.json();
        if (subRes.ok) {
          setTier(subData.tier);
          setIsExpired(subData.isExpired || false);
          if (subData.tier === 'free' || subData.isExpired) {
            setLoading(false);
            return;
          }
        }
      } catch (_) {}

      await fetchData(token);
    };

    init();
  }, []);

  const fetchData = async (token?: string) => {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }
    try {
      const res = await fetch(api('/api/depreciation/summary'), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(normalizeSummary(data.summary));
        setAssets(
          (data.assets || [])
            .map((a: Record<string, unknown>) => normalizeAssetMetrics(a))
            .filter((a: AssetMetrics) => a.assetId)
        );
      } else {
        setError('Failed to load metrics');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = assets.filter((a) => !filterCategory || a.category === filterCategory);
  const totalPages = Math.ceil(filtered.length / ASSETS_PER_PAGE);
  const paginated = filtered.slice((assetsPage - 1) * ASSETS_PER_PAGE, assetsPage * ASSETS_PER_PAGE);
  const categories = Array.from(new Set(assets.map((a) => a.category).filter(Boolean)));

  if (loading) return <LoadingSpinner message="Loading asset metrics..." />;

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (tier === 'free' || isExpired) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Asset Financial & Operational Metrics</h1>
        {isExpired && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-medium">Your subscription has expired</p>
            <p className="text-red-300 text-sm mt-1">Renew to access depreciation and health analytics</p>
          </div>
        )}
        <UpgradePrompt feature="Financial & Operational Metrics" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Financial & Operational Metrics</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Book value (SLM & WDV), asset health scores, and replacement priorities for your organization.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Total Purchase Value" value={formatCurrency(summary.totalPurchaseValue)} />
          <SummaryCard label="Book Value (SLM)" value={formatCurrency(summary.currentBookValueSLM)} accent="text-blue-400" />
          <SummaryCard label="Book Value (WDV)" value={formatCurrency(summary.currentBookValueWDV)} accent="text-violet-400" />
          <SummaryCard label="Avg. Asset Health" value={`${summary.averageAssetHealth}%`} accent={healthColor(summary.averageAssetHealth)} />
          <SummaryCard label="Need Replacement" value={String(summary.assetsNeedingReplacement)} accent="text-orange-400" />
          <SummaryCard label="Under Warranty" value={String(summary.assetsUnderWarranty)} accent="text-green-400" />
          <SummaryCard label="Warranty Expiring" value={String(summary.warrantiesExpiringSoon)} accent="text-amber-400" />
          <SummaryCard label="Total Assets" value={String(summary.totalAssets)} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSection('financial')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            section === 'financial'
              ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60'
          }`}
        >
          Financial Metrics
        </button>
        <button
          onClick={() => setSection('operational')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            section === 'operational'
              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
              : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60'
          }`}
        >
          Operational Metrics
        </button>
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setAssetsPage(1); }}
          className="ml-auto px-3 py-1.5 text-xs border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-300"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {section === 'financial' ? (
        <div className="rounded-xl border border-gray-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 border-b border-gray-700/60">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Asset</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Cost</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-blue-400/80">SLM Book</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-blue-400/80">SLM Dep %</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-violet-400/80">WDV Book</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-violet-400/80">WDV Dep %</th>
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {paginated.map((a) => (
                  <tr key={a.assetId} className="hover:bg-gray-800/40">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-200">{a.name}</p>
                      <p className="text-[11px] text-gray-500">{a.assetIdString} · {a.category}</p>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {a.slm.purchaseCost > 0 ? formatCurrency(a.slm.purchaseCost) : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-300">{formatCurrency(a.slm.currentBookValue)}</td>
                    <td className="px-3 py-2 text-right text-blue-400/80">{a.slm.depreciationPercentage}%</td>
                    <td className="px-3 py-2 text-right text-violet-300">{formatCurrency(a.wdv.currentBookValue)}</td>
                    <td className="px-3 py-2 text-right text-violet-400/80">{a.wdv.depreciationPercentage}%</td>
                    <td className="px-3 py-2 text-center">
                      <MetricsModal asset={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 border-b border-gray-700/60">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Asset</th>
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Health</th>
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Priority</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Issues</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Maint.</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Est. Life</th>
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {paginated.map((a) => (
                  <tr key={a.assetId} className="hover:bg-gray-800/40">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-200">{a.name}</p>
                      <p className="text-[11px] text-gray-500">{a.assetIdString} · {a.ageYears}y old</p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-semibold ${healthColor(a.operational.healthScore)}`}>
                        {a.operational.healthScore}%
                      </span>
                      <p className="text-[10px] text-gray-500">{a.operational.healthLabel}</p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${priorityBadge(a.operational.replacementPriority)}`}>
                        {a.operational.replacementEmoji} {a.operational.replacementLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {a.operational.openIssueCount}/{a.operational.issueCount}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">{a.operational.maintenanceCount}</td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {a.operational.estimatedRemainingUsefulLife > 0
                        ? `${a.operational.estimatedRemainingUsefulLife}y`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <MetricsModal asset={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            {(assetsPage - 1) * ASSETS_PER_PAGE + 1}–{Math.min(assetsPage * ASSETS_PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-1.5">
            <button onClick={() => setAssetsPage((p) => Math.max(1, p - 1))} disabled={assetsPage === 1}
              className="px-2.5 py-1 text-xs border border-gray-700/60 rounded-lg text-gray-400 disabled:opacity-40">Prev</button>
            <span className="px-2 text-xs text-gray-500">{assetsPage}/{totalPages}</span>
            <button onClick={() => setAssetsPage((p) => Math.min(totalPages, p + 1))} disabled={assetsPage === totalPages}
              className="px-2.5 py-1 text-xs border border-gray-700/60 rounded-lg text-gray-400 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs text-gray-500">
        <div className="rounded-xl border border-gray-700/40 bg-gray-800/30 p-4">
          <p className="font-semibold text-gray-400 mb-2">SLM (Straight Line)</p>
          <p>Annual Depreciation = (Cost − Residual Value) ÷ Useful Life</p>
          <p className="mt-1">Residual value is 5–10% of purchase cost (category-based).</p>
        </div>
        <div className="rounded-xl border border-gray-700/40 bg-gray-800/30 p-4">
          <p className="font-semibold text-gray-400 mb-2">WDV (Written Down Value)</p>
          <p>Current Value = Previous Year&apos;s Value × (1 − Depreciation Rate)</p>
          <p className="mt-1">Applied yearly from purchase date using category WDV rates.</p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-3 py-2.5 rounded-xl border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}

function MetricsModal({ asset }: { asset: AssetMetrics }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const modal = open && mounted ? createPortal(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]" onClick={() => setOpen(false)}>
      <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-100">{asset.name}</h3>
            <p className="text-sm text-gray-500">{asset.assetIdString} · {asset.category}</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-200 text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <section>
            <h4 className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Book Value — SLM</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MetricRow label="Purchase Cost" value={asset.slm.purchaseCost > 0 ? formatCurrency(asset.slm.purchaseCost) : 'Not set — add cost on asset'} />
              <MetricRow label="Purchase Date" value={formatDate(asset.purchaseDate)} />
              <MetricRow label="Useful Life" value={`${asset.slm.usefulLife} years`} />
              <MetricRow label="Residual Value" value={formatCurrency(asset.slm.residualValue)} />
              <MetricRow label="Annual Depreciation" value={formatCurrency(asset.slm.annualDepreciation)} />
              <MetricRow label="Current Book Value" value={formatCurrency(asset.slm.currentBookValue)} accent="text-blue-300" />
              <MetricRow label="Total Depreciation" value={formatCurrency(asset.slm.totalDepreciation)} accent="text-red-400" />
              <MetricRow label="Depreciation %" value={`${asset.slm.depreciationPercentage}%`} />
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-2">Book Value — WDV</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MetricRow label="Purchase Cost" value={formatCurrency(asset.wdv.purchaseCost)} />
              <MetricRow label="Depreciation Rate" value={`${(asset.wdv.depreciationRate * 100).toFixed(0)}% / year`} />
              <MetricRow label="Current Book Value" value={formatCurrency(asset.wdv.currentBookValue)} accent="text-violet-300" />
              <MetricRow label="Total Depreciation" value={formatCurrency(asset.wdv.totalDepreciation)} accent="text-red-400" />
              <MetricRow label="Depreciation %" value={`${asset.wdv.depreciationPercentage}%`} />
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold text-emerald-400/80 uppercase tracking-widest mb-2">Operational</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MetricRow label="Health Score" value={`${asset.operational.healthScore}% (${asset.operational.healthLabel})`} accent={healthColor(asset.operational.healthScore)} />
              <MetricRow label="Replacement Priority" value={`${asset.operational.replacementEmoji} ${asset.operational.replacementLabel} — ${asset.operational.replacementDescription}`} />
              <MetricRow label="Est. Remaining Life" value={asset.operational.estimatedRemainingUsefulLife > 0 ? `${asset.operational.estimatedRemainingUsefulLife} years` : '—'} />
              <MetricRow label="Issues (open/total)" value={`${asset.operational.openIssueCount} / ${asset.operational.issueCount}`} />
              <MetricRow label="Maintenance cycles" value={String(asset.operational.maintenanceCount)} />
              <MetricRow label="Warranty" value={asset.operational.warrantyActive ? (asset.operational.warrantyExpiringSoon ? 'Expiring soon' : 'Active') : 'Expired / none'} />
            </div>
          </section>

          <Link href={`/dashboard/assets/${asset.assetId}`} className="text-blue-400 hover:underline text-sm">
            View asset details →
          </Link>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-2 py-0.5 text-[11px] border border-gray-600/60 rounded-md text-gray-400 hover:text-gray-200">
        View
      </button>
      {modal}
    </>
  );
}

function MetricRow({ label, value, accent = 'text-gray-200' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg bg-gray-900/40 border border-gray-700/30">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`text-xs font-medium ${accent}`}>{value}</p>
    </div>
  );
}
