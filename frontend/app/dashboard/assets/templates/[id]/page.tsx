'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite } from '@/lib/permissions';
import {
  DEFAULT_QR_SECTIONS,
  FIELD_TYPE_LABELS,
  QR_EXTRA_SECTIONS,
  SECTION_LABELS,
  TEMPLATE_EDITOR_FIELD_TYPES,
  fieldTypeNeedsOptions,
  groupFieldsBySection,
  normalizeQrSections,
  normalizeTemplateFieldSections,
  resolveTemplateFieldSection,
  type AssetTemplate,
  type TemplateField,
  type TemplateFieldType,
  type TemplateQrSections,
  type TemplateSection,
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

function newCustomField(section: TemplateSection = 'custom'): TemplateField {
  const key = `custom_${Date.now()}`;
  return {
    key,
    label: 'New field',
    type: 'text',
    required: false,
    order: 999,
    section,
    builtIn: false,
    qrVisible: true,
    reportVisible: true,
    readonly: true,
    options: [],
  };
}

const SECTION_ACCENT: Record<TemplateSection, string> = {
  basic: 'border-l-violet-500/50',
  assignment: 'border-l-blue-500/50',
  purchase: 'border-l-amber-500/50',
  custom: 'border-l-emerald-500/50',
};

const SECTION_TITLE: Record<TemplateSection, string> = {
  basic: 'text-violet-400/80',
  assignment: 'text-blue-400/80',
  purchase: 'text-amber-400/80',
  custom: 'text-emerald-400/80',
};

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
    qrSections: { ...DEFAULT_QR_SECTIONS } as TemplateQrSections,
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
          { key: 'name', label: 'Name', type: 'text', required: true, order: 0, section: 'basic', builtIn: true, qrVisible: true, options: [] },
          { key: 'model', label: 'Model', type: 'text', required: false, order: 1, section: 'basic', builtIn: true, qrVisible: true, options: [] },
          { key: 'serialNumber', label: 'Serial number', type: 'text', required: false, order: 2, section: 'basic', builtIn: true, qrVisible: true, options: [] },
          { key: 'status', label: 'Status', type: 'status', required: false, order: 3, section: 'basic', builtIn: true, qrVisible: true, options: [] },
          { key: 'tags', label: 'Tags', type: 'tags', required: false, order: 4, section: 'basic', builtIn: true, qrVisible: true, options: [] },
          { key: 'assignedToName', label: 'Assigned to', type: 'text', required: false, order: 5, section: 'assignment', builtIn: true, qrVisible: true, options: [] },
          { key: 'assignedToEmployeeCode', label: 'Employee code', type: 'text', required: false, order: 6, section: 'assignment', builtIn: true, qrVisible: true, options: [] },
          { key: 'locationId', label: 'Location', type: 'location', required: false, order: 7, section: 'assignment', builtIn: true, qrVisible: true, options: [] },
          { key: 'departmentId', label: 'Department', type: 'select', required: false, order: 8, section: 'assignment', builtIn: true, qrVisible: true, options: [] },
          { key: 'purchaseDate', label: 'Purchase date', type: 'date', required: false, order: 9, section: 'purchase', builtIn: true, qrVisible: true, options: [] },
          { key: 'warrantyExpiry', label: 'Warranty expiry', type: 'date', required: false, order: 10, section: 'purchase', builtIn: true, qrVisible: true, options: [] },
          { key: 'amcExpiry', label: 'AMC expiry', type: 'date', required: false, order: 11, section: 'purchase', builtIn: true, qrVisible: true, options: [] },
          { key: 'nextMaintenanceDate', label: 'Next maintenance', type: 'date', required: false, order: 12, section: 'purchase', builtIn: true, qrVisible: true, options: [] },
          { key: 'vendorId', label: 'Partner', type: 'select', required: false, order: 13, section: 'purchase', builtIn: true, qrVisible: true, options: [] },
          { key: 'relationshipTypeKey', label: 'Partner relationship', type: 'select', required: false, order: 14, section: 'purchase', builtIn: true, qrVisible: true, options: [] },
          { key: 'cost', label: 'Cost', type: 'number', required: false, order: 14, section: 'purchase', builtIn: true, qrVisible: false, options: [] },
        ],
        qrSections: { ...DEFAULT_QR_SECTIONS },
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
            fields: normalizeTemplateFieldSections(
              [...t.fields]
                .sort((a, b) => a.order - b.order)
                .map((f) => ({
                  ...f,
                  qrVisible: f.qrVisible !== false,
                  reportVisible: f.reportVisible !== false,
                  readonly: f.readonly !== false,
                }))
            ),
            qrSections: normalizeQrSections(t.qrSections),
            statuses: t.statuses || [],
            tagSuggestions: t.tagSuggestions || [],
          });
        } else setError(data.message || 'Not found');
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [params.id, isNew]);

  const sectionGroups = useMemo(() => groupFieldsBySection(form.fields), [form.fields]);

  const updateFieldByKey = (key: string, patch: Partial<TemplateField>) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => {
        if (f.key !== key) return f;
        const next = { ...f, ...patch };
        // Keep sections consistent with asset info page
        next.section = resolveTemplateFieldSection(next);
        return next;
      }),
    }));
  };

  const moveFieldInSection = (section: TemplateSection, localIndex: number, dir: -1 | 1) => {
    const group = sectionGroups.find((g) => g.section === section);
    if (!group) return;
    const nextLocal = localIndex + dir;
    if (nextLocal < 0 || nextLocal >= group.fields.length) return;

    const aKey = group.fields[localIndex].key;
    const bKey = group.fields[nextLocal].key;
    const fields = [...form.fields];
    const ai = fields.findIndex((f) => f.key === aKey);
    const bi = fields.findIndex((f) => f.key === bKey);
    if (ai < 0 || bi < 0) return;
    const aOrder = fields[ai].order;
    fields[ai] = { ...fields[ai], order: fields[bi].order };
    fields[bi] = { ...fields[bi], order: aOrder };
    setForm({ ...form, fields: fields.sort((x, y) => x.order - y.order) });
  };

  const removeFieldByKey = (key: string) => {
    const field = form.fields.find((f) => f.key === key);
    if (!field) return;
    if (field.builtIn && ['name', 'status'].includes(field.key)) {
      alert('Name and status cannot be removed');
      return;
    }
    setForm({ ...form, fields: form.fields.filter((f) => f.key !== key) });
  };

  const setQrSection = (key: keyof TemplateQrSections, value: boolean) => {
    setForm((prev) => ({
      ...prev,
      qrSections: { ...prev.qrSections, [key]: value },
    }));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    const token = localStorage.getItem('token');
    const url = isNew ? api('/api/asset-templates') : api(`/api/asset-templates/${params.id}`);
    const method = isNew ? 'POST' : 'PATCH';
    const fields = sectionGroups
      .flatMap((g) => g.fields)
      .map((f, i) => ({
        ...f,
        order: i,
        qrVisible: f.qrVisible !== false,
        reportVisible: f.reportVisible !== false,
        readonly: f.readonly !== false,
      }));

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, fields, qrSections: form.qrSections }),
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
      <p className="text-gray-500 text-sm mb-6">
        Fields are grouped like the asset info page. Use the QR toggles to control what appears when someone scans an asset with this template.
      </p>

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

      <div className="space-y-4 mb-4">
        {sectionGroups.map(({ section, fields }) => {
          const sectionOnQr = form.qrSections[section] !== false;
          return (
            <div
              key={section}
              className={`rounded-xl border border-gray-700/60 border-l-2 ${SECTION_ACCENT[section]} bg-gray-800/40 px-4 py-4`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-widest ${SECTION_TITLE[section]}`}>
                    {SECTION_LABELS[section]}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {fields.length} field{fields.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={sectionOnQr}
                      disabled={!canEdit}
                      onChange={(e) => setQrSection(section, e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    Show section on QR scan
                  </label>
                  {canEdit && section === 'custom' && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          fields: [...form.fields, newCustomField('custom')],
                        })
                      }
                      className={`${buttonClass} border-gray-600 text-gray-300`}
                    >
                      + Add field
                    </button>
                  )}
                </div>
              </div>

              {!sectionOnQr && (
                <p className="text-[11px] text-gray-600 mb-3">
                  This section is hidden on the QR page. Field-level toggles apply once the section is enabled.
                </p>
              )}

              <div className="space-y-2">
                {fields.length === 0 && (
                  <p className="text-xs text-gray-600 py-2">No fields in this section yet.</p>
                )}
                {fields.map((field, localIndex) => (
                  <div
                    key={`${field.key}-${localIndex}`}
                    className={`rounded-lg border border-gray-700/50 bg-gray-900/30 p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-end ${
                      sectionOnQr ? '' : 'opacity-60'
                    }`}
                  >
                    <div className="md:col-span-3">
                      <label className={labelClass}>Label</label>
                      <input
                        value={field.label}
                        disabled={!canEdit}
                        onChange={(e) => updateFieldByKey(field.key, { label: e.target.value })}
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
                            updateFieldByKey(field.key, {
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
                      <input
                        value={SECTION_LABELS[resolveTemplateFieldSection(field)]}
                        readOnly
                        className={`${inputClass} bg-gray-900/50 text-gray-500 cursor-not-allowed`}
                        title="Section matches the asset info page and cannot be changed"
                      />
                    </div>
                    <div className="md:col-span-3 flex flex-wrap items-center gap-3 pb-2">
                      <label className="flex items-center gap-1.5 text-xs text-gray-400">
                        <input
                          type="checkbox"
                          checked={field.required}
                          disabled={!canEdit}
                          onChange={(e) => updateFieldByKey(field.key, { required: e.target.checked })}
                        />
                        Required
                      </label>
                      <label
                        className={`flex items-center gap-1.5 text-xs ${
                          sectionOnQr ? 'text-emerald-300/90' : 'text-gray-600'
                        }`}
                        title={
                          sectionOnQr
                            ? 'Show this field when the QR code is scanned'
                            : 'Enable the section QR toggle first'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={field.qrVisible !== false}
                          disabled={!canEdit || !sectionOnQr}
                          onChange={(e) => updateFieldByKey(field.key, { qrVisible: e.target.checked })}
                        />
                        On QR
                      </label>
                      <label
                        className="flex items-center gap-1.5 text-xs text-sky-300/90"
                        title="Show this field on the public report page (asset context)"
                      >
                        <input
                          type="checkbox"
                          checked={field.reportVisible !== false}
                          disabled={!canEdit}
                          onChange={(e) => updateFieldByKey(field.key, { reportVisible: e.target.checked })}
                        />
                        On report
                      </label>
                      <label
                        className="flex items-center gap-1.5 text-xs text-gray-400"
                        title="Read-only on the report page (unchecked = reporter can fill)"
                      >
                        <input
                          type="checkbox"
                          checked={field.readonly !== false}
                          disabled={!canEdit || field.reportVisible === false}
                          onChange={(e) => updateFieldByKey(field.key, { readonly: e.target.checked })}
                        />
                        Read-only
                      </label>
                      {field.builtIn && <span className="text-[10px] text-gray-600">built-in</span>}
                    </div>
                    {canEdit && (
                      <div className="md:col-span-2 flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => moveFieldInSection(section, localIndex, -1)}
                          className={buttonClass}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFieldInSection(section, localIndex, 1)}
                          className={buttonClass}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFieldByKey(field.key)}
                          className={`${buttonClass} border-red-500/40 text-red-300`}
                        >
                          ✕
                        </button>
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
                        onChange={(options) => updateFieldByKey(field.key, { options })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-cyan-500/40 bg-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-cyan-400/80 uppercase tracking-widest mb-1">
          QR page extras
        </p>
        <p className="text-[11px] text-gray-500 mb-3">
          These blocks are not form fields — turn them on or off for every asset using this template.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QR_EXTRA_SECTIONS.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-2 rounded-lg border border-gray-700/50 bg-gray-900/30 px-3 py-2 text-sm text-gray-300"
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-600"
                checked={form.qrSections[item.key] !== false}
                disabled={!canEdit}
                onChange={(e) => setQrSection(item.key, e.target.checked)}
              />
              <span>
                <span className="font-medium text-gray-200">{item.label}</span>
                <span className="block text-[11px] text-gray-500">{item.hint}</span>
              </span>
            </label>
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
