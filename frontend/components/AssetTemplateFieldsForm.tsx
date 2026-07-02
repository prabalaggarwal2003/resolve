'use client';

import { useState } from 'react';
import LocationTreePicker from '@/components/LocationTreePicker';
import type { LocationTreeNode } from '@/lib/locations';
import {
  groupFieldsBySection,
  SECTION_LABELS,
  type AssetTemplate,
  type TemplateField,
} from '@/lib/assetTemplates';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const chipButtonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function TagsInput({
  label,
  required,
  tags,
  onChange,
  tagSuggestions,
}: {
  label: string;
  required?: boolean;
  tags: string[];
  onChange: (tags: string[]) => void;
  tagSuggestions: string[];
}) {
  const [draft, setDraft] = useState('');

  const addTag = (name: string) => {
    const t = name.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setDraft('');
  };

  return (
    <div className="sm:col-span-2">
      <label className={labelClass}>
        {label}
        {required ? ' *' : ''}
      </label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-violet-500/30 bg-violet-500/10 text-violet-300"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="text-violet-400/80 hover:text-red-300"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(draft);
            }
          }}
          placeholder="Enter tag name"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => addTag(draft)}
          className={`${chipButtonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 shrink-0`}
        >
          Add
        </button>
      </div>
      {tagSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-wide w-full">Suggestions</span>
          {tagSuggestions
            .filter((s) => !tags.includes(s))
            .map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className={`${chipButtonClass} border-gray-700/60 text-gray-500 hover:text-gray-300`}
              >
                + {tag}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

type FormValues = Record<string, string | string[]>;
type SetFormValues = (next: FormValues | ((prev: FormValues) => FormValues)) => void;

function FieldWrap({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  );
}

function renderField(
  field: TemplateField,
  values: FormValues,
  setValues: SetFormValues,
  extras: {
    locationTree: LocationTreeNode[];
    departments: { _id: string; name: string }[];
    vendors: { _id: string; vendorId: string; name: string }[];
    statuses: string[];
    tagSuggestions: string[];
  }
) {
  const val = values[field.key];
  const set = (v: string | string[]) => setValues((prev) => ({ ...prev, [field.key]: v }));

  if (field.type === 'location') {
    return (
      <div className="md:col-span-2">
        <LocationTreePicker
          tree={extras.locationTree}
          value={String(val || '')}
          onChange={(id) => set(id)}
          required={field.required}
        />
      </div>
    );
  }

  if (field.type === 'status') {
    const statuses = extras.statuses;
    return (
      <div className="sm:col-span-2">
        <label className={labelClass}>Status{field.required ? ' *' : ''}</label>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                val === s
                  ? 'text-blue-300 bg-blue-500/15 border-blue-500/30'
                  : 'border-gray-700/60 bg-gray-800/40 text-gray-500 hover:text-gray-300'
              }`}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'tags') {
    const tags = Array.isArray(val) ? val : val ? [String(val)] : [];
    return (
      <TagsInput
        label={field.label}
        required={field.required}
        tags={tags}
        onChange={(next) => set(next)}
        tagSuggestions={extras.tagSuggestions}
      />
    );
  }

  if (field.type === 'checkbox') {
    const selected = Array.isArray(val) ? val : val ? [String(val)] : [];
    const toggle = (opt: string) => {
      const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt];
      set(next);
    };
    return (
      <FieldWrap label={field.label} required={field.required}>
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/40"
              />
              {opt}
            </label>
          ))}
        </div>
      </FieldWrap>
    );
  }

  if (field.type === 'radio') {
    return (
      <FieldWrap label={field.label} required={field.required}>
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="radio"
                name={field.key}
                checked={val === opt}
                onChange={() => set(opt)}
                className="border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/40"
              />
              {opt}
            </label>
          ))}
        </div>
      </FieldWrap>
    );
  }

  if (field.key === 'departmentId') {
    return (
      <FieldWrap label={field.label} required={field.required}>
        <select
          value={String(val || '')}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
          required={field.required}
        >
          <option value="">No department</option>
          {extras.departments.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
      </FieldWrap>
    );
  }

  if (field.key === 'vendorId') {
    return (
      <FieldWrap label={field.label} required={field.required}>
        <select
          value={String(val || '')}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
        >
          <option value="">No vendor</option>
          {extras.vendors.map((v) => (
            <option key={v._id} value={v._id}>{v.vendorId} — {v.name}</option>
          ))}
        </select>
      </FieldWrap>
    );
  }

  if (field.type === 'select') {
    return (
      <FieldWrap label={field.label} required={field.required}>
        <select
          value={String(val || '')}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
          required={field.required}
        >
          <option value="">Select…</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </FieldWrap>
    );
  }

  if (field.type === 'textarea') {
    return (
      <FieldWrap label={field.label} required={field.required}>
        <textarea
          value={String(val || '')}
          onChange={(e) => set(e.target.value)}
          rows={3}
          className={inputClass}
          required={field.required}
        />
      </FieldWrap>
    );
  }

  if (field.type === 'date') {
    return (
      <FieldWrap label={field.label} required={field.required}>
        <input
          type="date"
          value={String(val || '')}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
          required={field.required}
        />
      </FieldWrap>
    );
  }

  if (field.type === 'number') {
    return (
      <FieldWrap label={field.label} required={field.required}>
        <input
          type="number"
          value={String(val ?? '')}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
          required={field.required}
        />
      </FieldWrap>
    );
  }

  return (
    <FieldWrap label={field.label} required={field.required}>
      <input
        type="text"
        value={String(val || '')}
        onChange={(e) => set(e.target.value)}
        className={inputClass}
        required={field.required}
      />
    </FieldWrap>
  );
}

export default function AssetTemplateFieldsForm({
  template,
  values,
  setValues,
  locationTree,
  departments,
  vendors,
}: {
  template: AssetTemplate;
  values: FormValues;
  setValues: SetFormValues;
  locationTree: LocationTreeNode[];
  departments: { _id: string; name: string }[];
  vendors: { _id: string; vendorId: string; name: string }[];
}) {
  const groups = groupFieldsBySection(template.fields);
  const extras = {
    locationTree,
    departments,
    vendors,
    statuses: template.statuses,
    tagSuggestions: template.tagSuggestions,
  };

  const accent: Record<string, { border: string; title: string }> = {
    basic: { border: 'border-l-violet-500/50', title: 'text-violet-400/80' },
    assignment: { border: 'border-l-amber-500/50', title: 'text-amber-400/80' },
    purchase: { border: 'border-l-emerald-500/50', title: 'text-emerald-400/80' },
    custom: { border: 'border-l-blue-500/50', title: 'text-blue-400/80' },
  };

  return (
    <>
      {groups.map(({ section, fields }) => (
        <div
          key={section}
          className={`rounded-xl border border-gray-700/60 border-l-2 ${accent[section]?.border || accent.basic.border} bg-gray-800/40 px-4 py-4 mb-4`}
        >
          <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${accent[section]?.title || accent.basic.title}`}>
            {SECTION_LABELS[section] || section}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((field) => (
              <div
                key={field.key}
                className={
                  field.type === 'status' || field.type === 'tags' || field.type === 'checkbox' || field.type === 'location'
                    ? 'md:col-span-2'
                    : ''
                }
              >
                {renderField(field, values, setValues, extras)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function buildAssetPayloadFromTemplate(
  template: AssetTemplate,
  values: FormValues,
  extras: { assetId: string; templateId: string }
) {
  const customFields: Record<string, unknown> = {};
  const body: Record<string, unknown> = {
    assetId: extras.assetId,
    templateId: extras.templateId,
    category: template.name,
    status: values.status || 'available',
  };
  if (template.groupId) body.groupId = template.groupId;

  const tags = values.tags;
  if (Array.isArray(tags) && tags.length) body.tags = tags;

  for (const field of template.fields) {
    const raw = values[field.key];
    if (raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0)) continue;
    if (field.builtIn) {
      if (field.key === 'cost') body.cost = Number(raw);
      else if (field.key === 'locationId' || field.key === 'departmentId' || field.key === 'vendorId') {
        body[field.key] = raw || undefined;
      } else body[field.key] = raw;
    } else if (field.type === 'number') {
      customFields[field.key] = Number(raw);
    } else {
      customFields[field.key] = raw;
    }
  }

  if (Object.keys(customFields).length) body.customFields = customFields;
  return body;
}

function refId(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && '_id' in val) return String((val as { _id: string })._id);
  return '';
}

function dateStr(val: unknown): string {
  if (!val) return '';
  const s = String(val);
  return s.includes('T') ? s.slice(0, 10) : s;
}

/** Map an asset API response into template field values for edit forms */
export function assetToFieldValues(
  asset: Record<string, unknown>,
  template: AssetTemplate
): FormValues {
  const values: FormValues = {};
  const customFields = (asset.customFields as Record<string, unknown>) || {};

  for (const field of template.fields) {
    if (field.key === 'tags') {
      values.tags = Array.isArray(asset.tags) ? [...(asset.tags as string[])] : [];
      continue;
    }
    if (field.builtIn) {
      if (field.key === 'locationId') values.locationId = refId(asset.locationId);
      else if (field.key === 'departmentId') values.departmentId = refId(asset.departmentId);
      else if (field.key === 'vendorId') values.vendorId = refId(asset.vendorId);
      else if (field.key === 'assignedToName') {
        values.assignedToName = String(
          asset.assignedToName || (asset.assignedTo as { name?: string } | undefined)?.name || ''
        );
      } else if (field.type === 'date') {
        values[field.key] = dateStr(asset[field.key]);
      } else if (field.key === 'cost') {
        values.cost = asset.cost != null ? String(asset.cost) : '';
      } else {
        const raw = asset[field.key];
        values[field.key] = raw != null ? String(raw) : '';
      }
    } else {
      const raw = customFields[field.key];
      if (field.type === 'checkbox') {
        values[field.key] = Array.isArray(raw) ? raw.map(String) : raw != null && raw !== '' ? [String(raw)] : [];
      } else if (field.type === 'number') {
        values[field.key] = raw != null && raw !== '' ? String(raw) : '';
      } else {
        values[field.key] = raw != null ? String(raw) : '';
      }
    }
  }

  if (!values.status) {
    values.status = String(asset.status || template.statuses?.[0] || 'available');
  }

  return values;
}

/** Build PATCH body from template field values (includes cleared tags/custom fields) */
export function buildAssetPatchFromTemplate(template: AssetTemplate, values: FormValues) {
  const customFields: Record<string, unknown> = {};
  const body: Record<string, unknown> = {
    category: template.name,
    status: values.status || 'available',
    tags: Array.isArray(values.tags) ? values.tags : [],
  };
  if (template._id && template._id !== 'fallback') {
    body.templateId = template._id;
  }
  if (template.groupId) body.groupId = template.groupId;

  for (const field of template.fields) {
    if (field.key === 'tags') continue;
    const raw = values[field.key];

    if (field.builtIn) {
      if (field.key === 'cost') {
        body.cost = raw === '' || raw === undefined ? null : Number(raw);
      } else if (field.key === 'locationId' || field.key === 'departmentId' || field.key === 'vendorId') {
        body[field.key] = raw || null;
      } else if (field.type === 'date') {
        body[field.key] = raw || null;
      } else if (field.key === 'assignedToName' || field.key === 'assignedToEmployeeCode') {
        body[field.key] = typeof raw === 'string' ? raw.trim() || null : null;
      } else {
        body[field.key] = raw ?? '';
      }
    } else if (raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
      customFields[field.key] = field.type === 'checkbox' ? [] : null;
    } else if (field.type === 'number') {
      customFields[field.key] = Number(raw);
    } else {
      customFields[field.key] = raw;
    }
  }

  body.customFields = customFields;
  return body;
}
