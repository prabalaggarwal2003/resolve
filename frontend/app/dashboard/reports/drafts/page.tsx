'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  deleteDefinition,
  fetchDefinitions,
  type ReportDefinition,
} from '@/lib/reportStudio';
import { canWrite } from '@/lib/permissions';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';

export default function DraftsPage() {
  const [items, setItems] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canEdit = canWrite('reports');

  const load = () =>
    fetchDefinitions('draft')
      .then((d) => setItems(d.definitions || []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading drafts…" />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>}
      <p className="text-xs text-gray-500">
        Drafts auto-save while you work in the builder. Continue editing anytime, or delete drafts you no longer need.
      </p>
      <div className="space-y-2">
        {items.length === 0 && (
          <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-8 text-center">
            <p className="text-sm text-gray-300">No drafts</p>
            <Link href="/dashboard/reports/builder" className={`${buttonClass} inline-block mt-3 border-amber-500/40 text-amber-300 no-underline`}>
              Start a report
            </Link>
          </div>
        )}
        {items.map((item) => (
          <div
            key={item._id}
            className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">{item.name || 'Untitled draft'}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleString('en-IN') : '—'}
                {item.description ? ` · ${item.description}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={`/dashboard/reports/builder?id=${item._id}`}
                className={`${buttonClass} border-amber-500/40 bg-amber-500/10 text-amber-300 no-underline`}
              >
                Continue
              </Link>
              {canEdit && (
                <button
                  type="button"
                  className={`${buttonClass} border-red-500/30 text-red-300`}
                  onClick={async () => {
                    if (!confirm(`Delete draft “${item.name}”?`)) return;
                    await deleteDefinition(item._id);
                    load();
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
