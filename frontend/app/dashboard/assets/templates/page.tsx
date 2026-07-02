'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import TemplateGroupBoard from '@/components/templates/TemplateGroupBoard';
import { canWrite } from '@/lib/permissions';
import { api, authHeaders, type TemplateGroupBoardData } from '@/lib/assetGroups';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function AssetTemplatesPage() {
  const [board, setBoard] = useState<TemplateGroupBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canEdit = canWrite('assets');

  const fetchBoard = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(api('/api/asset-groups/board'), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.groups) setBoard(data);
        else setError(data.message || 'Failed to load templates');
      })
      .catch(() => setError('Failed to load templates'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBoard();
  }, []);

  if (loading) return <LoadingSpinner message="Loading templates..." />;

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/dashboard/assets" className={`${buttonClass} inline-block mb-4 border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 no-underline`}>
        ← Back to assets
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Asset templates</h1>
          <p className="text-gray-400 mt-1 text-sm max-w-2xl">
            Organize templates into groups (IT, Infra, Consumables). Drag templates from Available into a group.
            Assets inherit the group from the template used at creation.
          </p>
        </div>
        {canEdit && (
          <Link
            href="/dashboard/assets/templates/new"
            className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 no-underline`}
          >
            + New template
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {board && (
        <TemplateGroupBoard initial={board} canEdit={canEdit} onBoardChange={setBoard} />
      )}
    </div>
  );
}
