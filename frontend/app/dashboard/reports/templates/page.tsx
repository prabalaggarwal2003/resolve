'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  deleteDefinition,
  duplicateDefinition,
  fetchDefinitions,
  type ReportDefinition,
} from '@/lib/reportStudio';
import { canWrite } from '@/lib/permissions';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';

export default function TemplatesPage() {
  const [orgTemplates, setOrgTemplates] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canEdit = canWrite('reports');

  const load = async () => {
    try {
      const defs = await fetchDefinitions('template');
      setOrgTemplates(defs.definitions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading templates…" />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>}

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Saved templates</h2>
          <p className="text-xs text-gray-500 mt-0.5">Organization templates saved from Report Studio.</p>
        </div>
        {canEdit && (
          <Link href="/dashboard/reports/builder" className={`${buttonClass} border-gray-700/60 text-gray-300 no-underline`}>
            Create in builder
          </Link>
        )}
      </div>

      {orgTemplates.length === 0 ? (
        <p className="text-xs text-gray-500">No organization templates saved yet.</p>
      ) : (
        <div className="space-y-2">
          {orgTemplates.map((t) => (
            <div key={t._id} className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3 flex flex-wrap justify-between gap-2">
              <div>
                <Link href={`/dashboard/reports/builder?id=${t._id}`} className="text-sm font-medium text-gray-100 no-underline hover:text-amber-200">
                  {t.name}
                </Link>
                <p className="text-[11px] text-gray-500">{t.description || '—'}</p>
              </div>
              <div className="flex gap-1.5">
                <Link href={`/dashboard/reports/builder?id=${t._id}`} className={`${buttonClass} border-gray-700/60 text-gray-300 no-underline`}>
                  Edit
                </Link>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      className={`${buttonClass} border-gray-700/60 text-gray-300`}
                      onClick={async () => {
                        const copy = await duplicateDefinition(t._id, 'saved');
                        window.location.href = `/dashboard/reports/builder?id=${copy._id}`;
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className={`${buttonClass} border-red-500/30 text-red-300`}
                      onClick={async () => {
                        if (!confirm(`Delete template “${t.name}”?`)) return;
                        await deleteDefinition(t._id);
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
      )}
    </div>
  );
}
