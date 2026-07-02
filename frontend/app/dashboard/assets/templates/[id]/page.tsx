'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite } from '@/lib/permissions';
import {
  FIELD_TYPE_LABELS,
  TEMPLATE_EDITOR_FIELD_TYPES,
  fieldTypeNeedsOptions,
  type AssetTemplate,
  type TemplateField,
  type TemplateFieldType,
} from '@/lib/assetTemplates';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function FieldOptionsEditor({
  options,
  disabled,
  onChange,
  label,
}: {
  options: string[];
  disabled?: boolean;
  onChange: (options: string[]) => void;
  label: string;
}) {
  const [draft, setDraft] = useState('');

  const addOption = (value: string) => {
    const v = value.trim();
    if (!v || options.includes(v)) return;
    onChange([...options, v]);
    setDraft('');
  };

  return (
    <div className="md:col-span-12">
      <label className={labelClass}>{label}</label>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {options.map((opt) => (
            <span
              key={opt}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-gray-700/60 text-gray-300"
            >
              {opt}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(options.filter((o) => o !== opt))}
                  className="text-red-400"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOption(draft);
              }
            }}
            placeholder="Option value"
            className={inputClass}
          />
          <button type="button" onClick={() => addOption(draft)} className={buttonClass}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function newCustomField(): TemplateField {
  const key = `custom_${Date.now()}`;
  return {
    key,
    label: 'New field',
    type: 'text',
    required: false,
    order: 999,
    section: 'custom',
    builtIn: false,
    options: [],
  };
}

export default function AssetTemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === 'new';
  const canEdit = canWrite('assets');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldTypes, setFieldTypes] = useState<TemplateFieldType[]>(TEMPLATE_EDITOR_FIELD_TYPES);
  const [form, setForm] = useState({
    name: '',
    description: '',
    fields: [] as TemplateField[],
    statuses: [] as string[],
    tagSuggestions: [] as string[],
  });
  const [newStatus, setNewStatus] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(api('/api/asset-templates/meta'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.fieldTypes) setFieldTypes(data.fieldTypes);
      })
      .catch(() => {});

    if (isNew) {
      setForm({
        name: '',
        description: '',
        fields: [
          { key: 'name', label: 'Name', type: 'text', required: true, order: 0, section: 'basic', builtIn: true, options: [] },
          { key: 'model', label: 'Model', type: 'text', required: false, order: 1, section: 'basic', builtIn: true, options: [] },
          { key: 'serialNumber', label: 'Serial number', type: 'text', required: false, order: 2, section: 'basic', builtIn: true, options: [] },
          { key: 'status', label: 'Status', type: 'status', required: false, order: 3, section: 'basic', builtIn: true, options: [] },
        ],
        statuses: ['available', 'in_use', 'under_maintenance', 'retired'],
        tagSuggestions: [],
      });
      return;
    }

    fetch(api(`/api/asset-templates/${params.id}`), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.template) {
          const t = data.template as AssetTemplate;
          setForm({
            name: t.name,
            description: t.description || '',
            fields: [...t.fields].sort((a, b) => a.order - b.order),
            statuses: t.statuses || [],
            tagSuggestions: t.tagSuggestions || [],
          });
        } else setError(data.message || 'Not found');
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [params.id, isNew]);

  const updateField = (index: number, patch: Partial<TemplateField>) => {
    setForm((prev) => {
      const fields = [...prev.fields];
      fields[index] = { ...fields[index], ...patch };
      return { ...prev, fields };
    });
  };

  const moveField = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= form.fields.length) return;
    const fields = [...form.fields];
    [fields[index], fields[next]] = [fields[next], fields[index]];
    fields.forEach((f, i) => { f.order = i; });
    setForm({ ...form, fields });
  };

  const removeField = (index: number) => {
    const field = form.fields[index];
    if (field.builtIn && ['name', 'status'].includes(field.key)) {
      alert('Name and status cannot be removed');
      return;
    }
    setForm({ ...form, fields: form.fields.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    const token = localStorage.getItem('token');
    const url = isNew ? api('/api/asset-templates') : api(`/api/asset-templates/${params.id}`);
    const method = isNew ? 'POST' : 'PATCH';
    const fields = form.fields.map((f, i) => ({ ...f, order: i }));

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');
      router.push('/dashboard/assets/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading template..." />;

  if (!canEdit && isNew) {
    return <p className="text-red-400 text-sm">You do not have permission to create templates.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/dashboard/assets/templates" className={`${buttonClass} inline-block mb-4 border-gray-700/60 text-gray-400 no-underline`}>
        ← Templates
      </Link>

      <h1 className="text-2xl font-bold text-gray-100 mb-1">{isNew ? 'New template' : `Edit: ${form.name}`}</h1>
      <p className="text-gray-500 text-sm mb-6">Configure fields for this asset type. Applies to future assets only.</p>

      {error && <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>}

      <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-4 mb-4 space-y-3">
        <div>
          <label className={labelClass}>Template name *</label>
          <input
            value={form.name}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            placeholder="e.g. Laptop"
          />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <input
            value={form.description}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest">Fields</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setForm({ ...form, fields: [...form.fields, newCustomField()] })}
              className={`${buttonClass} border-violet-500/40 text-violet-300`}
            >
              + Add field
            </button>
          )}
        </div>
        <div className="space-y-2">
          {form.fields.map((field, index) => (
            <div key={`${field.key}-${index}`} className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-3">
                <label className={labelClass}>Label</label>
                <input
                  value={field.label}
                  disabled={!canEdit}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Type</label>
                {field.builtIn ? (
                  <input
                    value={FIELD_TYPE_LABELS[field.type] || field.type}
                    readOnly
                    className={`${inputClass} bg-gray-900/50 text-gray-500 cursor-not-allowed`}
                  />
                ) : (
                  <select
                    value={field.type}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const type = e.target.value as TemplateFieldType;
                      updateField(index, {
                        type,
                        options: fieldTypeNeedsOptions(type) ? field.options || [] : [],
                      });
                    }}
                    className={inputClass}
                  >
                    {fieldTypes.map((t) => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Section</label>
                <select
                  value={field.section}
                  disabled={!canEdit}
                  onChange={(e) => updateField(index, { section: e.target.value as TemplateField['section'] })}
                  className={inputClass}
                >
                  <option value="basic">Basic</option>
                  <option value="assignment">Assignment</option>
                  <option value="purchase">Purchase</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-center gap-2 pb-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={!canEdit}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                  />
                  Required
                </label>
                {field.builtIn && <span className="text-[10px] text-gray-600">built-in</span>}
              </div>
              {canEdit && (
                <div className="md:col-span-3 flex gap-1 justify-end">
                  <button type="button" onClick={() => moveField(index, -1)} className={buttonClass}>↑</button>
                  <button type="button" onClick={() => moveField(index, 1)} className={buttonClass}>↓</button>
                  <button type="button" onClick={() => removeField(index)} className={`${buttonClass} border-red-500/40 text-red-300`}>✕</button>
                </div>
              )}
              {fieldTypeNeedsOptions(field.type) && (
                <FieldOptionsEditor
                  label={
                    field.type === 'checkbox'
                      ? 'Checkbox values'
                      : field.type === 'radio'
                      ? 'Radio button values'
                      : 'Dropdown options'
                  }
                  options={field.options || []}
                  disabled={!canEdit}
                  onChange={(options) => updateField(index, { options })}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-4">
          <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest mb-2">Custom statuses</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {form.statuses.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-gray-700/60 text-gray-300">
                {s.replace(/_/g, ' ')}
                {canEdit && (
                  <button type="button" onClick={() => setForm({ ...form, statuses: form.statuses.filter((x) => x !== s) })} className="text-red-400">×</button>
                )}
              </span>
            ))}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <input
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                placeholder="new_status"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newStatus || form.statuses.includes(newStatus)) return;
                  setForm({ ...form, statuses: [...form.statuses, newStatus] });
                  setNewStatus('');
                }}
                className={buttonClass}
              >
                Add
              </button>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-4">
          <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Tag suggestions</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {form.tagSuggestions.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-violet-500/30 text-violet-300">
                {t}
                {canEdit && (
                  <button type="button" onClick={() => setForm({ ...form, tagSuggestions: form.tagSuggestions.filter((x) => x !== t) })} className="text-red-400">×</button>
                )}
              </span>
            ))}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} className={inputClass} placeholder="Tag name" />
              <button
                type="button"
                onClick={() => {
                  const t = newTag.trim();
                  if (!t || form.tagSuggestions.includes(t)) return;
                  setForm({ ...form, tagSuggestions: [...form.tagSuggestions, t] });
                  setNewTag('');
                }}
                className={buttonClass}
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 disabled:opacity-50`}
        >
          {saving ? 'Saving…' : 'Save template'}
        </button>
      )}
    </div>
  );
}
