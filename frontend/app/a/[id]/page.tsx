'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Asset = {
  _id: string;
  assetId: string;
  name: string;
  model?: string;
  category: string;
  serialNumber?: string;
  status: string;
  purchaseDate?: string;
  vendor?: string;
  cost?: number;
  warrantyExpiry?: string;
  amcExpiry?: string;
  nextMaintenanceDate?: string;
  locationId?: { name: string; path?: string };
  departmentId?: { name: string };
  photos?: { url: string; caption?: string }[];
  documents?: { url: string; name: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  working: 'Working',
  under_maintenance: 'Under maintenance',
  needs_repair: 'Needs repair',
  out_of_service: 'Out of service',
};

const STATUS_CLASSES: Record<string, string> = {
  working: 'bg-green-100 text-green-800',
  under_maintenance: 'bg-amber-100 text-amber-800',
  needs_repair: 'bg-red-100 text-red-800',
  out_of_service: 'bg-slate-200 text-slate-600',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function PublicAssetPage() {
  const params = useParams();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) {
      setLoading(false);
      setError('Invalid link');
      return;
    }
    fetch(api(`/api/public/assets/${params.id}`))
      .then((res) => res.json())
      .then((data) => {
        if (data.message && data.message === 'Asset not found') {
          setError('Asset not found');
          return;
        }
        setAsset(data);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (error || !asset) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-600 mb-4">{error || 'Asset not found'}</p>
        <Link href="/" className="text-primary font-medium hover:underline">
          Go to Resolve
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-8 max-w-lg mx-auto">
      {/* Header — mobile-friendly */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
        <h1 className="text-xl font-bold text-slate-900 mb-1">{asset.name}</h1>
        <p className="text-slate-600 text-sm mb-2">
          {asset.assetId} · {asset.category}
        </p>
        <span
          className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${STATUS_CLASSES[asset.status] ?? 'bg-slate-100 text-slate-700'}`}
        >
          {STATUS_LABELS[asset.status] ?? asset.status}
        </span>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Details
        </h2>
        <dl className="space-y-2 text-sm">
          {asset.purchaseDate && (
            <div>
              <dt className="text-slate-500">Purchase date</dt>
              <dd className="font-medium">
                {new Date(asset.purchaseDate).toLocaleDateString()}
              </dd>
            </div>
          )}
          {asset.cost && (
            <div>
              <dt className="text-slate-500">Cost</dt>
              <dd className="font-medium">
                {asset.cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </dd>
            </div>
          )}
          {asset.vendor && (
            <div>
              <dt className="text-slate-500">Vendor</dt>
              <dd className="font-medium">{asset.vendor}</dd>
            </div>
          )}
          {asset.locationId?.path && (
            <div>
              <dt className="text-slate-500">Location</dt>
              <dd className="font-medium">{asset.locationId.path}</dd>
            </div>
          )}
          {asset.model && (
            <div>
              <dt className="text-slate-500">Model</dt>
              <dd className="font-medium">{asset.model}</dd>
            </div>
          )}
          {asset.serialNumber && (
            <div>
              <dt className="text-slate-500">Serial</dt>
              <dd className="font-medium">{asset.serialNumber}</dd>
            </div>
          )}
          {asset.warrantyExpiry && (
            <div>
              <dt className="text-slate-500">Warranty expires</dt>
              <dd className="font-medium">
                {new Date(asset.warrantyExpiry).toLocaleDateString()}
              </dd>
            </div>
          )}
          {asset.amcExpiry && (
            <div>
              <dt className="text-slate-500">AMC expires</dt>
              <dd className="font-medium">
                {new Date(asset.amcExpiry).toLocaleDateString()}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Report issue — prominent for scan flow */}
      <Link
        href={`/report?assetId=${asset._id}&assetName=${encodeURIComponent(asset.name)}`}
        className="block w-full py-4 bg-primary text-white text-center font-semibold rounded-xl hover:bg-primary-hover shadow-sm"
      >
        Report an issue
      </Link>

      <p className="mt-4 text-center text-slate-500 text-sm">
        <Link href="/" className="text-primary hover:underline">
          Resolve
        </Link>
        {' · Asset management'}
      </p>
    </main>
  );
}
