'use client';

import { useMemo, useState } from 'react';
import type { TemplateField, TemplateFieldType } from '@/lib/assetTemplates';

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2 py-1 text-xs font-medium rounded-lg border transition-colors';

export type FieldOverride = {
  hidden?: boolean;
  qrVisible?: boolean;
  reportVisible?: boolean;
  required?: boolean;
  readonly?: boolean;
  order?: number;
  label?: string;
};

export type AssetFieldConfig = {
  overrides: Record<string, FieldOverride>;
  extraFields: TemplateField[];
  order: string[];
};

type Row = TemplateField & {
  source: 'template' | 'asset';
  hidden?: boolean;
};

function slugKey(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) || `field_${Date.now()}`
  );
}

function buildRows(templateFields: TemplateField[], config: AssetFieldConfig): Row[] {
  const overrides = config.overrides || {};
  const rows: Row[] = [];
  const seen = new Set<string>();

  for (const f of [...templateFields].sort((a, b) => a.order - b.order)) {
    const ov = overrides[f.key] || {};
    rows.push({
      ...f,
      label: ov.label?.trim() || f.label,
      required: ov.required !== undefined ? ov.required : f.required,
      order: typeof ov.order === 'number' ? ov.order : f.order,
      qrVisible: ov.qrVisible !== undefined ? ov.qrVisible : f.qrVisible !== false,
      reportVisible: ov.reportVisible !== undefined ? ov.reportVisible : f.reportVisible !== false,
      readonly: ov.readonly !== undefined ? ov.readonly : f.readonly !== false,
      hidden: ov.hidden === true,
      source: 'template',
    });
    seen.add(f.key);
  }

  for (const f of config.extraFields || []) {
    if (seen.has(f.key)) continue;
    const ov = overrides[f.key] || {};
    rows.push({
      ...f,
      section: 'custom',
      builtIn: false,
      label: ov.label?.trim() || f.label,
      required: ov.required !== undefined ? ov.required : f.required,
      order: typeof ov.order === 'number' ? ov.order : f.order,
      qrVisible: ov.qrVisible !== undefined ? ov.qrVisible : f.qrVisible !== false,
      reportVisible: ov.reportVisible !== undefined ? ov.reportVisible : f.reportVisible !== false,
      readonly: ov.readonly !== undefined ? ov.readonly : f.readonly !== false,
      hidden: ov.hidden === true,
      source: 'asset',
    });
    seen.add(f.key);
  }

  if (config.order?.length) {
    const rank = new Map(config.order.map((k, i) => [k, i]));
    rows.sort((a, b) => {
      const ra = rank.has(a.key) ? (rank.get(a.key) as number) : 10000 + a.order;
      const rb = rank.has(b.key) ? (rank.get(b.key) as number) : 10000 + b.order;
      return ra - rb || a.order - b.order;
    });
  } else {
    rows.sort((a, b) => a.order - b.order);
  }
  return rows;
}

function rowsToConfig(templateFields: TemplateField[], rows: Row[]): AssetFieldConfig {
  const templateKeys = new Set(templateFields.map((f) => f.key));
  const overrides: Record<string, FieldOverride> = {};
  const extraFields: TemplateField[] = [];
  const order: string[] = [];

  rows.forEach((row, index) => {
    order.push(row.key);
    if (row.source === 'asset' || !templateKeys.has(row.key)) {
      if (!row.hidden) {
        extraFields.push({
          key: row.key,
          label: row.label,
          type: row.type,
          required: Boolean(row.required),
          order: index,
          section: 'custom',
          builtIn: false,
          qrVisible: row.qrVisible !== false,
          reportVisible: row.reportVisible !== false,
          readonly: row.readonly !== false,
          options: row.options || [],
        });
      }
      return;
    }

    const base = templateFields.find((f) => f.key === row.key)!;
    const ov: FieldOverride = {};
    if (row.hidden) ov.hidden = true;
    if ((row.qrVisible !== false) !== (base.qrVisible !== false)) ov.qrVisible = row.qrVisible !== false;
    if ((row.reportVisible !== false) !== (base.reportVisible !== false)) {
      ov.reportVisible = row.reportVisible !== false;
    }
    if ((row.readonly !== false) !== (base.readonly !== false)) ov.readonly = row.readonly !== false;
    if (Boolean(row.required) !== Boolean(base.required)) ov.required = Boolean(row.required);
    if (row.label.trim() !== base.label.trim()) ov.label = row.label.trim();
    if (Object.keys(ov).length) overrides[row.key] = ov;
  });

  return { overrides, extraFields, order };
}

export function emptyFieldConfig(): AssetFieldConfig {
  return { overrides: {}, extraFields: [], order: [] };
}

export function parseFieldConfig(raw: unknown): AssetFieldConfig {
  if (!raw || typeof raw !== 'object') return emptyFieldConfig();
  const obj = raw as Record<string, unknown>;
  return {
    overrides:
      obj.overrides && typeof obj.overrides === 'object' && !Array.isArray(obj.overrides)
        ? (obj.overrides as Record<string, FieldOverride>)
        : {},
    extraFields: Array.isArray(obj.extraFields) ? (obj.extraFields as TemplateField[]) : [],
    order: Array.isArray(obj.order) ? obj.order.map(String) : [],
  };
}

type Props = {
  templateFields: TemplateField[];
  value: AssetFieldConfig;
  onChange: (next: AssetFieldConfig) => void;
  disabled?: boolean;
};

export default function AssetPublicFieldConfigEditor({
  templateFields,
  value,
  onChange,
  disabled,
}: Props) {
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<TemplateFieldType>('text');

  const rows = useMemo(() => buildRows(templateFields, value), [templateFields, value]);

  const commit = (nextRows: Row[]) => {
    onChange(rowsToConfig(templateFields, nextRows));
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    commit(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...rows];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    commit(next);
  };

  const addExtra = () => {
    const label = newLabel.trim() || 'Extra field';
    const key = slugKey(label);
    if (rows.some((r) => r.key === key)) return;
    commit([
      ...rows,
      {
        key,
        label,
        type: newType,
        required: false,
        order: rows.length,
        section: 'custom',
        builtIn: false,
        qrVisible: true,
        reportVisible: true,
        readonly: true,
        options: [],
        source: 'asset',
      },
    ]);
    setNewLabel('');
  };

  const resetToTemplate = () => {
    onChange(emptyFieldConfig());
  };

  return (
    <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-sky-500/40 bg-gray-800/40 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs font-semibold text-sky-400/80 uppercase tracking-widest">
            QR & report fields
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Inherits the template. Override visibility, order, or add fields for this asset only.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={resetToTemplate}
          className={`${buttonClass} border-gray-700/60 text-gray-400 hover:text-gray-200`}
        >
          Reset to template
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className={`rounded-lg border px-3 py-2 ${
              row.hidden
                ? 'border-gray-800/60 bg-gray-950/40 opacity-60'
                : 'border-gray-700/50 bg-gray-900/30'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">
                  {row.label}
                  <span className="ml-1.5 text-[10px] text-gray-600 font-normal">
                    {row.source === 'asset' ? 'asset-only' : 'template'} · {row.key}
                  </span>
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => move(index, -1)}
                  className={buttonClass}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => move(index, 1)}
                  className={buttonClass}
                >
                  ↓
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <input
                  type="checkbox"
                  checked={!row.hidden}
                  disabled={disabled}
                  onChange={(e) => updateRow(row.key, { hidden: !e.target.checked })}
                />
                Include
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                <input
                  type="checkbox"
                  checked={row.qrVisible !== false}
                  disabled={disabled || row.hidden}
                  onChange={(e) => updateRow(row.key, { qrVisible: e.target.checked })}
                />
                On QR
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-sky-300/80">
                <input
                  type="checkbox"
                  checked={row.reportVisible !== false}
                  disabled={disabled || row.hidden}
                  onChange={(e) => updateRow(row.key, { reportVisible: e.target.checked })}
                />
                On report
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <input
                  type="checkbox"
                  checked={row.readonly !== false}
                  disabled={disabled || row.hidden || row.reportVisible === false}
                  onChange={(e) => updateRow(row.key, { readonly: e.target.checked })}
                />
                Read-only
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <input
                  type="checkbox"
                  checked={Boolean(row.required)}
                  disabled={disabled || row.hidden || row.readonly !== false}
                  onChange={(e) => updateRow(row.key, { required: e.target.checked })}
                />
                Required
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800/80 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div>
          <label className={labelClass}>Add field for this asset</label>
          <input
            className={inputClass}
            value={newLabel}
            disabled={disabled}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. GPU"
          />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select
            className={inputClass}
            value={newType}
            disabled={disabled}
            onChange={(e) => setNewType(e.target.value as TemplateFieldType)}
          >
            {['text', 'number', 'date', 'textarea', 'select'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={disabled || !newLabel.trim()}
          onClick={addExtra}
          className={`${buttonClass} border-sky-500/40 bg-sky-500/10 text-sky-200 py-1.5`}
        >
          Add
        </button>
      </div>
    </div>
  );
}
