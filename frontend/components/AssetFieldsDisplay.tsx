'use client';

import type { ReactNode } from 'react';
import {
  getAssetDisplayFields,
  getFieldRawValue,
  groupDisplayFieldsBySection,
  SECTION_LABELS,
  type AssetFieldDef,
  type DisplaySection,
} from '@/lib/assetFieldDisplay';
import { breadcrumbForNode } from '@/lib/locations';

const STATUS_BADGE: Record<string, string> = {
  available: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  in_use: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  under_maintenance: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  retired: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
  working: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  needs_repair: 'text-red-300 bg-red-500/15 border-red-500/30',
  out_of_service: 'text-red-300 bg-red-500/15 border-red-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_use: 'In use',
  under_maintenance: 'Under maintenance',
  retired: 'Retired',
  working: 'Working',
  needs_repair: 'Needs repair',
  out_of_service: 'Out of service',
};

const SECTION_ACCENT: Record<DisplaySection, { border: string; title: string }> = {
  basic: { border: 'border-l-violet-500/50', title: 'text-violet-400/80' },
  assignment: { border: 'border-l-amber-500/50', title: 'text-amber-400/80' },
  purchase: { border: 'border-l-emerald-500/50', title: 'text-emerald-400/80' },
  health: { border: 'border-l-rose-500/50', title: 'text-rose-400/80' },
  custom: { border: 'border-l-blue-500/50', title: 'text-blue-400/80' },
  system: { border: 'border-l-gray-500/50', title: 'text-gray-400/80' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(val: string): string {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(val: string): string {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

function formatFieldValue(field: AssetFieldDef, raw: unknown, asset: Record<string, unknown>): ReactNode {
  if (field.kind === 'status') {
    const s = String(raw || asset.status || '');
    if (!s) return '—';
    return (
      <span
        className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize ${
          STATUS_BADGE[s] || STATUS_BADGE.retired
        }`}
      >
        {STATUS_LABELS[s] || s.replace(/_/g, ' ')}
      </span>
    );
  }

  if (field.kind === 'tags') {
    const tags = Array.isArray(raw) ? raw.map(String) : [];
    if (!tags.length) return '—';
    return (
      <span className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <span
            key={t}
            className="px-1.5 py-0.5 text-[10px] rounded border border-violet-500/30 bg-violet-500/10 text-violet-300"
          >
            {t}
          </span>
        ))}
      </span>
    );
  }

  if (field.kind === 'location') {
    const loc = asset.locationId as { path?: string; name?: string } | undefined;
    return breadcrumbForNode(loc);
  }

  if (field.kind === 'group') {
    const g = asset.groupId as { name?: string } | undefined;
    return g?.name || '—';
  }

  if (field.kind === 'department') {
    const d = asset.departmentId as { name?: string } | undefined;
    return d?.name || '—';
  }

  if (field.kind === 'vendor') {
    const v = asset.vendorId as { vendorId?: string; name?: string } | undefined;
    if (v?.name) return `${v.vendorId ? `${v.vendorId} — ` : ''}${v.name}`;
    return '—';
  }

  if (field.kind === 'user') {
    const u = asset.assignedTo as { name?: string; email?: string } | undefined;
    if (u?.name) return u.email ? `${u.name} (${u.email})` : u.name;
    return '—';
  }

  if (field.kind === 'currency') {
    if (isEmpty(raw)) return '—';
    const n = Number(raw);
    return Number.isNaN(n) ? String(raw) : formatCurrency(n);
  }

  if (field.kind === 'number') {
    if (isEmpty(raw)) return '—';
    const n = Number(raw);
    return Number.isNaN(n) ? String(raw) : String(n);
  }

  if (field.kind === 'date') {
    return isEmpty(raw) ? '—' : formatDate(String(raw));
  }

  if (field.kind === 'datetime') {
    return isEmpty(raw) ? '—' : formatDateTime(String(raw));
  }

  if (Array.isArray(raw)) {
    return raw.length ? raw.map(String).join(', ') : '—';
  }

  if (typeof raw === 'object' && raw !== null) return '—';
  return isEmpty(raw) ? '—' : String(raw);
}

function DetailTile({
  label,
  value,
  accent,
  badge,
  wide,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  badge?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 min-w-0 ${
        wide ? 'sm:col-span-2 lg:col-span-2' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
        {badge}
      </div>
      <div className={`text-xs font-medium mt-0.5 break-words ${accent || 'text-gray-200'}`}>{value}</div>
    </div>
  );
}

export default function AssetFieldsDisplay({
  asset,
  warrantyAccent,
  warrantyBadge,
}: {
  asset: Record<string, unknown>;
  warrantyAccent?: string;
  warrantyBadge?: ReactNode;
}) {
  const fields = getAssetDisplayFields(asset);
  const groups = groupDisplayFieldsBySection(fields);

  return (
    <>
      {groups.map(({ section, fields: sectionFields }) => {
        const accent = SECTION_ACCENT[section];
        return (
          <div
            key={section}
            className={`rounded-xl border border-gray-700/60 border-l-2 ${accent.border} bg-gray-800/40 px-4 py-4 mb-4`}
          >
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${accent.title}`}>
              {SECTION_LABELS[section]}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {sectionFields.map((field) => {
                const raw = getFieldRawValue(asset, field);
                const isWarranty = field.key === 'warrantyExpiry';
                return (
                  <DetailTile
                    key={field.key}
                    label={field.label}
                    value={formatFieldValue(field, raw, asset)}
                    wide={field.wide}
                    accent={isWarranty ? warrantyAccent : undefined}
                    badge={isWarranty ? warrantyBadge : undefined}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
