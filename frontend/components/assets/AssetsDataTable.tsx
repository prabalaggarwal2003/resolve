'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  COLUMN_DEFS,
  STATUS_BADGE,
  STATUS_LABELS,
  type ColumnId,
} from '@/lib/assetsTableConfig';
import { breadcrumbForNode } from '@/lib/locations';

export type AssetRow = {
  _id: string;
  assetId: string;
  name: string;
  category: string;
  status: string;
  model?: string;
  serialNumber?: string;
  cost?: number;
  purchaseDate?: string;
  createdAt?: string;
  updatedAt?: string;
  warrantyExpiry?: string;
  tags?: string[];
  assignedToName?: string;
  assignedToEmployeeCode?: string;
  relationshipTypeKey?: string;
  partnerRelationships?: {
    partnerId?: { name?: string; partnerCode?: string; vendorId?: string } | string;
    relationshipTypeKey?: string;
    notes?: string;
  }[];
  locationId?: { name: string; path?: string };
  groupId?: { name: string };
  departmentId?: { name: string };
  assignedTo?: { name: string };
  vendorId?: { name: string; vendorId?: string; partnerCode?: string };
  partnerId?: { name: string; vendorId?: string; partnerCode?: string };
};

const buttonClass = 'px-2 py-0.5 text-[11px] font-medium rounded border transition-colors';

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(n?: number) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function partnerLabel(asset: AssetRow) {
  const rels = Array.isArray(asset.partnerRelationships) ? asset.partnerRelationships : [];
  if (rels.length) {
    const names = rels
      .map((r) => {
        const p = r.partnerId;
        if (!p || typeof p === 'string') return '';
        const code = p.partnerCode || p.vendorId;
        return p.name ? (code ? `${code} — ${p.name}` : p.name) : '';
      })
      .filter(Boolean);
    const unique = Array.from(new Set(names));
    if (!unique.length) return '—';
    if (unique.length === 1) return unique[0];
    return `${unique[0]} (+${unique.length - 1})`;
  }
  const p = asset.partnerId || asset.vendorId;
  if (!p?.name) return '—';
  const code = p.partnerCode || p.vendorId;
  return code ? `${code} — ${p.name}` : p.name;
}

function relationshipLabel(asset: AssetRow, relationshipTypeLabels?: Record<string, string>) {
  const rels = Array.isArray(asset.partnerRelationships) ? asset.partnerRelationships : [];
  const keys = (
    rels.length
      ? rels.map((r) => r.relationshipTypeKey).filter(Boolean)
      : asset.relationshipTypeKey
      ? [asset.relationshipTypeKey]
      : []
  ) as string[];
  if (!keys.length) return '—';
  const labels = Array.from(new Set(keys)).map(
    (key) => relationshipTypeLabels?.[key] || key.replace(/_/g, ' ')
  );
  if (labels.length <= 2) return labels.join('; ');
  return `${labels.slice(0, 2).join('; ')} (+${labels.length - 2})`;
}

function cellValue(
  asset: AssetRow,
  col: ColumnId,
  relationshipTypeLabels?: Record<string, string>
): ReactNode {
  switch (col) {
    case 'assetId':
      return (
        <Link href={`/dashboard/assets/${asset._id}`} className="font-mono text-blue-300 hover:text-blue-200">
          {asset.assetId}
        </Link>
      );
    case 'name':
      return <span className="text-gray-200">{asset.name}</span>;
    case 'category':
      return asset.category || '—';
    case 'assetGroup':
      return asset.groupId?.name || '—';
    case 'status':
      return (
        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize ${STATUS_BADGE[asset.status] || STATUS_BADGE.retired}`}>
          {STATUS_LABELS[asset.status] || asset.status?.replace(/_/g, ' ') || '—'}
        </span>
      );
    case 'location':
      return breadcrumbForNode(asset.locationId);
    case 'assignedTo':
      return asset.assignedToName || asset.assignedTo?.name || '—';
    case 'partner':
      return partnerLabel(asset);
    case 'relationshipType':
      return relationshipLabel(asset, relationshipTypeLabels);
    case 'model':
      return asset.model || '—';
    case 'serialNumber':
      return asset.serialNumber || '—';
    case 'department':
      return asset.departmentId?.name || '—';
    case 'cost':
      return formatCurrency(asset.cost);
    case 'purchaseDate':
      return formatDate(asset.purchaseDate);
    case 'createdAt':
      return formatDate(asset.createdAt);
    case 'warrantyExpiry':
      return formatDate(asset.warrantyExpiry);
    case 'updatedAt':
      return formatDate(asset.updatedAt);
    case 'employeeCode':
      return asset.assignedToEmployeeCode || '—';
    case 'tags':
      return asset.tags?.length ? (
        <span className="text-violet-300/90">{asset.tags.join(', ')}</span>
      ) : (
        '—'
      );
    default:
      return '—';
  }
}

export default function AssetsDataTable({
  assets,
  visibleColumns,
  canEdit,
  relationshipTypeLabels,
}: {
  assets: AssetRow[];
  visibleColumns: ColumnId[];
  canEdit: boolean;
  relationshipTypeLabels?: Record<string, string>;
}) {
  const thClass = 'px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap';
  const tdClass = 'px-3 py-2 text-xs text-gray-300 border-t border-gray-700/40';

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="bg-gray-900/50">
          <tr>
            {visibleColumns.map((col) => (
              <th key={col} className={thClass}>
                {COLUMN_DEFS[col].label}
              </th>
            ))}
            <th className={`${thClass} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset._id} className="hover:bg-gray-900/30 transition-colors">
              {visibleColumns.map((col) => {
                const value = cellValue(asset, col, relationshipTypeLabels);
                return (
                  <td
                    key={col}
                    className={`${tdClass} max-w-[220px] truncate`}
                    title={typeof value === 'string' ? value : undefined}
                  >
                    {value}
                  </td>
                );
              })}
              <td className={`${tdClass} text-right whitespace-nowrap`}>
                <div className="inline-flex gap-1">
                  <Link
                    href={`/dashboard/assets/${asset._id}`}
                    className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 no-underline`}
                  >
                    View
                  </Link>
                  {canEdit && (
                    <Link
                      href={`/dashboard/assets/${asset._id}/edit`}
                      className={`${buttonClass} border-gray-700/60 text-gray-400 hover:text-gray-200 no-underline`}
                    >
                      Edit
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
