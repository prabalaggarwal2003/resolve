'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  deleteDefinition,
  duplicateDefinition,
  fetchDefinitions,
  toggleFavourite,
  type ReportDefinition,
} from '@/lib/reportStudio';
import { canWrite } from '@/lib/permissions';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';

export default function SavedReportsPage() {
  const [items, setItems] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const canEdit = canWrite('reports');

  const load = () =>
    fetchDefinitions()
      .then((d) => setItems((d.definitions || []).filter((x) => x.kind === 'saved')))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const filtered = items.filter((i) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return i.name.toLowerCase().includes(s) || (i.description || '').toLowerCase().includes(s);
  });

  if (loading) return <LoadingSpinner message="Loading saved reports…" />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search saved reports…"
          className="flex-1 min-w-[200px] px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
        />
        <Link href="/dashboard/reports/builder" className={`${buttonClass} border-amber-500/40 text-amber-300 no-underline`}>
          New report
        </Link>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-xs text-gray-500">No saved reports yet.</p>}
        {filtered.map((item) => (
          <div key={item._id} className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3 flex flex-wrap items-center gap-2 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/reports/builder?id=${item._id}`} className="text-sm font-medium text-gray-100 hover:text-amber-200 no-underline truncate">
                  {item.name}
                </Link>
                <span className="text-[10px] uppercase text-gray-500">{item.kind}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{item.description || 'No description'}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={`${buttonClass} border-gray-700/60 text-amber-300`}
                onClick={async () => {
                  await toggleFavourite(item._id);
                  load();
                }}
              >
                ★
              </button>
              <Link href={`/dashboard/reports/builder?id=${item._id}`} className={`${buttonClass} border-gray-700/60 text-gray-300 no-underline`}>
                Edit
              </Link>
              {canEdit && (
                <>
                  <button
                    type="button"
                    className={`${buttonClass} border-gray-700/60 text-gray-300`}
                    onClick={async () => {
                      const copy = await duplicateDefinition(item._id);
                      window.location.href = `/dashboard/reports/builder?id=${copy._id}`;
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className={`${buttonClass} border-red-500/30 text-red-300`}
                    onClick={async () => {
                      if (!confirm(`Delete “${item.name}”?`)) return;
                      await deleteDefinition(item._id);
                      load();
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
