'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DepreciationSummary {
  totalAssets: number;
  totalOriginalValue: number;
  totalCurrentValue: number;
  totalDepreciation: number;
  averageDepreciationPercentage: number;
}

interface AssetDepreciation {
  assetId: string;
  assetIdString: string;
  name: string;
  category: string;
  originalCost: number;
  currentValue: number;
  depreciation: number;
  depreciationPercentage: number;
  breakdown: {
    ageDeduction: number;
    warrantyDeduction: number;
    maintenanceDeduction: number;
    issuesDeduction: number;
    statusDeduction: number;
    conditionDeduction: number;
  };
  factors: {
    age: number;
    warrantyExpired: boolean;
    maintenanceCount: number;
    issueCount: number;
    status: string;
    condition: string;
  };
}

interface CategoryDepreciation {
  category: string;
  count: number;
  originalValue: number;
  currentValue: number;
  depreciation: number;
  depreciationPercentage: number;
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function getDepreciationColor(percentage: number): string {
  if (percentage < 20) return 'text-green-600';
  if (percentage < 40) return 'text-blue-600';
  if (percentage < 60) return 'text-yellow-600';
  if (percentage < 80) return 'text-orange-600';
  return 'text-red-600';
}

export default function DepreciationPage() {
  const [summary, setSummary] = useState<DepreciationSummary | null>(null);
  const [assets, setAssets] = useState<AssetDepreciation[]>([]);
  const [categories, setCategories] = useState<CategoryDepreciation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'assets' | 'categories'>('assets');
  const [sortBy, setSortBy] = useState<'depreciation' | 'percentage' | 'value'>('depreciation');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    fetchDepreciationData();
  }, []);

  const fetchDepreciationData = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    try {
      const [summaryRes, categoryRes] = await Promise.all([
        fetch(api('/api/depreciation/summary'), {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(api('/api/depreciation/by-category'), {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const summaryData = await summaryRes.json();
      const categoryData = await categoryRes.json();

      if (summaryRes.ok && summaryData.summary) {
        setSummary(summaryData.summary);
        setAssets(summaryData.assets || []);
      } else {
        setError('Failed to load depreciation data');
      }

      if (categoryRes.ok && categoryData.categories) {
        setCategories(categoryData.categories);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const sortedAssets = [...assets]
    .filter(a => !filterCategory || a.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'depreciation') return b.depreciation - a.depreciation;
      if (sortBy === 'percentage') return b.depreciationPercentage - a.depreciationPercentage;
      return b.currentValue - a.currentValue;
    });

  const uniqueCategories = Array.from(new Set(assets.map(a => a.category).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Calculating depreciation...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">💰 Asset Depreciation</h1>
        <p className="text-gray-600 mt-1">
          Track asset value depreciation based on age, condition, and maintenance history
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Total Original Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalOriginalValue)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Current Value</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCurrentValue)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Total Depreciation</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDepreciation)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Avg. Depreciation</p>
            <p className={`text-2xl font-bold ${getDepreciationColor(summary.averageDepreciationPercentage)}`}>
              {summary.averageDepreciationPercentage.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('assets')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'assets'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          By Assets ({assets.length})
        </button>
        <button
          onClick={() => setView('categories')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'categories'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          By Category ({categories.length})
        </button>
      </div>

      {/* Assets View */}
      {view === 'assets' && (
        <>
          {/* Filters and Sort */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="depreciation">Sort by Depreciation Amount</option>
              <option value="percentage">Sort by Depreciation %</option>
              <option value="value">Sort by Current Value</option>
            </select>
          </div>

          {/* Assets Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Original</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Depreciation</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedAssets.map((asset) => (
                    <tr key={asset.assetId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{asset.name}</div>
                          <div className="text-sm text-gray-500">{asset.assetIdString}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{asset.category}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(asset.originalCost)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                        {formatCurrency(asset.currentValue)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                        {formatCurrency(asset.depreciation)}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-bold ${getDepreciationColor(asset.depreciationPercentage)}`}>
                        {asset.depreciationPercentage.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DepreciationDetailsModal asset={asset} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Categories View */}
      {view === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.category} className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="font-bold text-lg text-gray-900 mb-3">{cat.category}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Assets:</span>
                  <span className="font-medium">{cat.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Value:</span>
                  <span className="font-medium">{formatCurrency(cat.originalValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Value:</span>
                  <span className="font-medium text-green-600">{formatCurrency(cat.currentValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Depreciation:</span>
                  <span className="font-medium text-red-600">{formatCurrency(cat.depreciation)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Depreciation %:</span>
                  <span className={`font-bold ${getDepreciationColor(cat.depreciationPercentage)}`}>
                    {cat.depreciationPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DepreciationDetailsModal({ asset }: { asset: AssetDepreciation }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
      >
        View
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{asset.name}</h3>
                <p className="text-sm text-gray-600">{asset.assetIdString}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Value Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Original Cost</p>
                  <p className="text-lg font-bold">{formatCurrency(asset.originalCost)}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Current Value</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(asset.currentValue)}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Depreciation</p>
                  <p className="text-lg font-bold text-red-600">{asset.depreciationPercentage.toFixed(1)}%</p>
                </div>
              </div>

              {/* Breakdown */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Depreciation Breakdown</h4>
                <div className="space-y-2">
                  <BreakdownItem label="Age Deduction" amount={asset.breakdown.ageDeduction} factor={`${asset.factors.age} years`} />
                  <BreakdownItem label="Warranty Deduction" amount={asset.breakdown.warrantyDeduction} factor={asset.factors.warrantyExpired ? 'Expired' : 'Valid'} />
                  <BreakdownItem label="Maintenance Deduction" amount={asset.breakdown.maintenanceDeduction} factor={`${asset.factors.maintenanceCount} times`} />
                  <BreakdownItem label="Issues Deduction" amount={asset.breakdown.issuesDeduction} factor={`${asset.factors.issueCount} reports`} />
                  <BreakdownItem label="Status Deduction" amount={asset.breakdown.statusDeduction} factor={asset.factors.status} />
                  <BreakdownItem label="Condition Deduction" amount={asset.breakdown.conditionDeduction} factor={asset.factors.condition} />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Link
                  href={`/dashboard/assets/${asset.assetId}`}
                  className="text-blue-600 hover:underline text-sm font-medium"
                >
                  View Asset Details →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BreakdownItem({ label, amount, factor }: { label: string; amount: number; factor: string }) {
  if (amount === 0) return null;

  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <div>
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className="text-xs text-gray-500 ml-2">({factor})</span>
      </div>
      <span className="text-sm font-semibold text-red-600">-{formatCurrency(amount)}</span>
    </div>
  );
}

