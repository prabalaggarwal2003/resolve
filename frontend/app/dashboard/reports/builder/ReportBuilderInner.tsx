'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite } from '@/lib/permissions';
import FilterValueSearch from '@/components/reports/FilterValueSearch';
import ReportChartPreview from '@/components/reports/ReportChartPreview';
import {
  downloadTextFile,
  emptyReportConfig,
  exportReport,
  fetchDefinition,
  fetchQuickReport,
  fetchReportCatalog,
  runReport,
  sanitizeReportConfig,
  saveDefinition,
  updateDefinition,
  type CatalogField,
  type CatalogSource,
  type ReportCatalog,
  type ReportConfig,
  type ReportRunResult,
} from '@/lib/reportStudio';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';
const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/40';

const STEPS = [
  'Sources',
  'Fields',
  'Filters',
  'Grouping',
  'Sorting',
  'Calculations',
  'Visualization',
  'Formatting',
  'Export',
] as const;

const EMPTY_OPS = new Set(['is_empty', 'is_not_empty']);

function fieldId(source: string, key: string) {
  return `${source}.${key}`;
}

function availableFields(catalog: ReportCatalog | null, dataSources: string[]): CatalogField[] {
  if (!catalog) return [];
  const set = new Set(dataSources);
  return catalog.sources.filter((s) => set.has(s.key)).flatMap((s) => s.fields);
}

export default function ReportBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const quickParam = searchParams.get('quick');
  const canEdit = canWrite('reports');

  const [catalog, setCatalog] = useState<ReportCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('Untitled report');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<ReportConfig>(() => emptyReportConfig());
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [definitionKind, setDefinitionKind] = useState<'saved' | 'template' | 'draft' | 'quick'>('draft');
  const [fieldSearch, setFieldSearch] = useState('');
  const [preview, setPreview] = useState<ReportRunResult | null>(null);
  const [busy, setBusy] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [ready, setReady] = useState(false);

  const skipAutosave = useRef(true);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const cat = await fetchReportCatalog();
        if (cancelled) return;
        setCatalog(cat);

        if (idParam) {
          const def = await fetchDefinition(idParam);
          if (cancelled) return;
          setDefinitionId(def._id);
          setDefinitionKind(def.kind);
          setName(def.name || 'Untitled report');
          setDescription(def.description || '');
          const restored = sanitizeReportConfig({
            ...emptyReportConfig(),
            ...def.config,
            formatting: { ...(cat.defaultFormatting || {}), ...(def.config.formatting || {}) },
          });
          setConfig(restored);
          const savedStep = Number(def.config?.exportOptions?.builderStep);
          if (Number.isFinite(savedStep) && savedStep >= 0 && savedStep <= 8) {
            setStep(savedStep);
          }
        } else if (quickParam) {
          const preset = await fetchQuickReport(quickParam);
          if (cancelled) return;
          setName(preset.name);
          setDescription(preset.description || '');
          setConfig({
            ...emptyReportConfig(),
            ...preset.config,
            formatting: { ...(cat.defaultFormatting || {}), ...(preset.config.formatting || {}) },
          });
        } else {
          setConfig({
            ...emptyReportConfig(),
            formatting: { ...(cat.defaultFormatting || {}) },
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load report builder');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
          // Allow autosave after initial hydration settles
          setTimeout(() => {
            skipAutosave.current = false;
          }, 500);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idParam, quickParam]);

  // Autosave draft on every change (short debounce) so Drafts always has latest progress
  useEffect(() => {
    if (!ready || skipAutosave.current || !canEdit) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      try {
        const configWithUi = sanitizeReportConfig({
          ...config,
          exportOptions: {
            ...(config.exportOptions || {}),
            builderStep: step,
          },
        });
        // Preserve saved/template kinds; new/in-progress work stays as draft
        const kindToSave =
          definitionKind === 'template'
            ? 'template'
            : definitionKind === 'saved'
              ? 'saved'
              : 'draft';

        if (definitionId) {
          await updateDefinition(definitionId, {
            name: name || 'Untitled draft',
            description,
            config: configWithUi,
            kind: kindToSave,
            autosave: true,
          });
          setDraftNote(kindToSave === 'draft' ? 'Draft saved' : 'Progress saved');
        } else {
          const created = await saveDefinition({
            name: name || 'Untitled draft',
            description,
            config: configWithUi,
            kind: 'draft',
            autosave: true,
          });
          setDefinitionId(created._id);
          setDefinitionKind('draft');
          skipAutosave.current = true;
          router.replace(`/dashboard/reports/builder?id=${created._id}`);
          setTimeout(() => {
            skipAutosave.current = false;
          }, 800);
          setDraftNote('Draft created — available in Drafts');
        }
        setTimeout(() => setDraftNote(''), 2500);
      } catch {
        // silent autosave
      }
    }, 700);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [name, description, config, step, definitionId, definitionKind, ready, canEdit, router]);

  const fields = useMemo(() => availableFields(catalog, config.dataSources), [catalog, config.dataSources]);

  const filteredCatalogFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        f.source.toLowerCase().includes(q)
    );
  }, [fields, fieldSearch]);

  const selectedFieldKeys = useMemo(
    () => new Set(config.fields.map((f) => fieldId(f.source, f.key))),
    [config.fields]
  );

  const patchConfig = useCallback((patch: Partial<ReportConfig> | ((prev: ReportConfig) => ReportConfig)) => {
    setConfig((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }));
  }, []);

  const toggleSource = (key: string) => {
    patchConfig((prev) => {
      const has = prev.dataSources.includes(key);
      let dataSources = has ? prev.dataSources.filter((k) => k !== key) : [...prev.dataSources, key];
      if (dataSources.length === 0) dataSources = [key];
      let primarySource = prev.primarySource;
      if (!dataSources.includes(primarySource)) primarySource = dataSources[0];
      const fieldsNext = prev.fields.filter((f) => dataSources.includes(f.source));
      return { ...prev, dataSources, primarySource, fields: fieldsNext };
    });
  };

  const toggleField = (field: CatalogField) => {
    const id = fieldId(field.source, field.key);
    patchConfig((prev) => {
      if (prev.fields.some((f) => fieldId(f.source, f.key) === id)) {
        return { ...prev, fields: prev.fields.filter((f) => fieldId(f.source, f.key) !== id) };
      }
      return {
        ...prev,
        fields: [
          ...prev.fields,
          { source: field.source, key: field.key, label: field.label, order: prev.fields.length, pinned: false },
        ],
      };
    });
  };

  const moveField = (index: number, dir: -1 | 1) => {
    patchConfig((prev) => {
      const next = [...prev.fields];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...prev, fields: next.map((f, i) => ({ ...f, order: i })) };
    });
  };

  const togglePin = (index: number) => {
    patchConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, pinned: !f.pinned } : f)),
    }));
  };

  const addFilter = () => {
    const first = fields[0];
    patchConfig((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        conditions: [
          ...prev.filters.conditions,
          {
            source: first?.source || prev.primarySource,
            field: first?.key || '',
            op: 'search',
            value: '',
          },
        ],
      },
    }));
  };

  const updateFilter = (index: number, patch: Record<string, unknown>) => {
    patchConfig((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        conditions: prev.filters.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
      },
    }));
  };

  const removeFilter = (index: number) => {
    patchConfig((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        conditions: prev.filters.conditions.filter((_, i) => i !== index),
      },
    }));
  };

  const runPreview = async () => {
    setBusy('preview');
    setError('');
    try {
      const result = await runReport(config, { page: 1, limit: 50, reportId: definitionId || undefined });
      setPreview(result);
      setStep(8);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy('');
    }
  };

  const doExport = async (format: string) => {
    setBusy(`export-${format}`);
    setError('');
    try {
      const out = await exportReport({
        config,
        format,
        reportName: name || 'Report',
        reportId: definitionId || undefined,
      });
      if (format === 'print') {
        // Open printable PDF in a new window (also records the export audit)
        const blob =
          out.download.encoding === 'base64'
            ? (() => {
                const binary = atob(out.download.content);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                return new Blob([bytes], { type: out.download.contentType || 'application/pdf' });
              })()
            : new Blob([out.download.content], { type: out.download.contentType || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
          win.addEventListener('load', () => {
            try {
              win.print();
            } catch {
              /* ignore */
            }
          });
        } else {
          downloadTextFile(
            out.download.fileName,
            out.download.content,
            out.download.contentType,
            out.download.encoding
          );
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      downloadTextFile(
        out.download.fileName,
        out.download.content,
        out.download.contentType,
        out.download.encoding
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy('');
    }
  };

  const save = async (kind: 'saved' | 'template' | 'draft') => {
    if (!canEdit) return;
    setBusy(`save-${kind}`);
    setError('');
    try {
      const payload = sanitizeReportConfig({
        ...config,
        exportOptions: {
          ...(config.exportOptions || {}),
          builderStep: step,
        },
      });
      if (definitionId) {
        const updated = await updateDefinition(definitionId, {
          name,
          description,
          config: payload,
          kind,
          ...(kind === 'template' ? { scope: 'organization', published: true } : {}),
        });
        setDefinitionId(updated._id);
        setDefinitionKind(updated.kind);
        setConfig(sanitizeReportConfig(updated.config));
        setDraftNote(kind === 'draft' ? 'Draft saved' : 'Saved');
      } else {
        const created = await saveDefinition({
          name,
          description,
          config: payload,
          kind,
          ...(kind === 'template' ? { scope: 'organization', published: true } : {}),
        });
        setDefinitionId(created._id);
        setDefinitionKind(created.kind);
        setConfig(sanitizeReportConfig(created.config));
        router.replace(`/dashboard/reports/builder?id=${created._id}`);
        setDraftNote('Saved');
      }
      setTimeout(() => setDraftNote(''), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy('');
    }
  };

  const formatting = (config.formatting || {}) as Record<string, string>;
  const setFormatting = (key: string, value: string) => {
    patchConfig((prev) => ({
      ...prev,
      formatting: { ...(prev.formatting || {}), [key]: value },
    }));
  };

  const refreshChartPreview = async (nextConfig?: ReportConfig) => {
    const cfg = nextConfig || config;
    if (!cfg.fields.length) {
      setPreview(null);
      return;
    }
    try {
      const result = await runReport(cfg, { page: 1, limit: 50, reportId: definitionId || undefined });
      setPreview(result);
    } catch {
      /* ignore live chart errors */
    }
  };

  if (loading) return <LoadingSpinner message="Loading report builder…" />;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Report name"
            className={`${inputClass} text-base font-semibold`}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className={inputClass}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {draftNote && <span className="text-[11px] text-emerald-400/80">{draftNote}</span>}
          <button
            type="button"
            disabled={!!busy}
            onClick={runPreview}
            className={`${buttonClass} border-amber-500/40 bg-amber-500/10 text-amber-300`}
          >
            {busy === 'preview' ? 'Running…' : 'Preview'}
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => save('saved')}
                className={`${buttonClass} border-emerald-500/40 text-emerald-300`}
              >
                {busy === 'save-saved' ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => save('template')}
                className={`${buttonClass} border-gray-700/60 text-gray-300`}
              >
                {busy === 'save-template' ? 'Saving…' : 'Save template'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`${buttonClass} ${
              step === i
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                : 'bg-gray-800/40 text-gray-400 border-gray-700/60'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 min-h-[280px]">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Data sources</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(catalog?.sources || []).map((s: CatalogSource) => {
                  const on = config.dataSources.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleSource(s.key)}
                      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                        on
                          ? 'border-amber-500/40 bg-amber-500/10'
                          : 'border-gray-700/60 bg-gray-900/40 hover:border-gray-600'
                      }`}
                    >
                      <p className={`text-sm font-medium ${on ? 'text-amber-200' : 'text-gray-200'}`}>{s.label}</p>
                      {s.description && <p className="text-[11px] text-gray-500 mt-0.5">{s.description}</p>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-400 mb-1">Primary source</label>
              <select
                className={inputClass}
                value={config.primarySource}
                onChange={(e) => patchConfig({ primarySource: e.target.value })}
              >
                {config.dataSources.map((k) => {
                  const src = catalog?.sources.find((s) => s.key === k);
                  return (
                    <option key={k} value={k}>
                      {src?.label || k}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <input
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Search fields…"
                className={`${inputClass} mb-2`}
              />
              <div className="max-h-72 overflow-auto space-y-1 pr-1">
                {filteredCatalogFields.map((f) => {
                  const id = fieldId(f.source, f.key);
                  const on = selectedFieldKeys.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleField(f)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                        on
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                          : 'border-gray-700/50 bg-gray-900/30 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <span className="font-medium">{f.label}</span>
                      <span className="text-gray-500 ml-1.5">
                        {f.source}
                        {f.custom ? ' · custom' : ''}
                      </span>
                    </button>
                  );
                })}
                {filteredCatalogFields.length === 0 && (
                  <p className="text-xs text-gray-500">No fields match. Select sources first.</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Selected ({config.fields.length})</p>
              <div className="space-y-1 max-h-72 overflow-auto">
                {config.fields.map((f, i) => (
                  <div
                    key={fieldId(f.source, f.key)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-700/50 bg-gray-900/40 px-2 py-1.5"
                  >
                    <span className="flex-1 min-w-0 text-xs text-gray-200 truncate">
                      {f.label || f.key}
                      <span className="text-gray-500 ml-1">{f.source}</span>
                      {f.pinned ? <span className="text-amber-400/80 ml-1 text-[10px]">pinned</span> : null}
                    </span>
                    <button type="button" className={`${buttonClass} border-gray-700/60 text-gray-400`} onClick={() => moveField(i, -1)} disabled={i === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className={`${buttonClass} border-gray-700/60 text-gray-400`}
                      onClick={() => moveField(i, 1)}
                      disabled={i === config.fields.length - 1}
                    >
                      ↓
                    </button>
                    <button type="button" className={`${buttonClass} border-gray-700/60 text-gray-400`} onClick={() => togglePin(i)}>
                      Pin
                    </button>
                    <button
                      type="button"
                      className={`${buttonClass} border-red-500/30 text-red-300`}
                      onClick={() =>
                        patchConfig((prev) => ({
                          ...prev,
                          fields: prev.fields.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {config.fields.length === 0 && <p className="text-xs text-gray-500">Select fields from the catalog.</p>}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-gray-400">
              Type to search existing values for the selected field — matching is case-insensitive and forgiving of spelling.
              Default operator is <span className="text-amber-300">Search (fuzzy)</span>.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">Match</span>
              {(['and', 'or'] as const).map((logic) => (
                <button
                  key={logic}
                  type="button"
                  onClick={() => patchConfig((prev) => ({ ...prev, filters: { ...prev.filters, logic } }))}
                  className={`${buttonClass} uppercase ${
                    config.filters.logic === logic
                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                      : 'border-gray-700/60 text-gray-400'
                  }`}
                >
                  {logic === 'and' ? 'All conditions' : 'Any condition'}
                </button>
              ))}
              <button type="button" onClick={addFilter} className={`${buttonClass} border-amber-500/40 text-amber-300 ml-auto`}>
                + Add filter
              </button>
            </div>
            <div className="space-y-2">
              {config.filters.conditions.map((cond, i) => {
                const hideValue = EMPTY_OPS.has(String(cond.op));
                const isBetween = cond.op === 'between';
                const showSearch = !hideValue && !isBetween && !['gt', 'gte', 'lt', 'lte'].includes(String(cond.op));
                const quickOps = [
                  { key: 'search', label: 'Search' },
                  { key: 'eq', label: 'Equals' },
                  { key: 'contains', label: 'Contains' },
                  { key: 'is_empty', label: 'Empty' },
                  { key: 'is_not_empty', label: 'Not empty' },
                ];
                return (
                  <div key={i} className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-3 space-y-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        className={`${inputClass} w-auto min-w-[160px]`}
                        value={cond.source && cond.field ? fieldId(cond.source, cond.field) : fieldId(cond.source || '', cond.field)}
                        onChange={(e) => {
                          const [source, ...rest] = e.target.value.split('.');
                          const key = rest.join('.');
                          updateFilter(i, { source, field: key, value: '' });
                        }}
                      >
                        {fields.map((f) => (
                          <option key={fieldId(f.source, f.key)} value={fieldId(f.source, f.key)}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-1">
                        {quickOps.map((op) => (
                          <button
                            key={op.key}
                            type="button"
                            onClick={() => updateFilter(i, { op: op.key })}
                            className={`${buttonClass} ${
                              cond.op === op.key
                                ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                                : 'border-gray-700/60 text-gray-400'
                            }`}
                          >
                            {op.label}
                          </button>
                        ))}
                        <select
                          className={`${inputClass} w-auto min-w-[110px]`}
                          value={cond.op}
                          onChange={(e) => updateFilter(i, { op: e.target.value })}
                          title="More operators"
                        >
                          {(catalog?.operators || []).map((op) => (
                            <option key={op.key} value={op.key}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="button" onClick={() => removeFilter(i)} className={`${buttonClass} border-red-500/30 text-red-300 ml-auto`}>
                        Remove
                      </button>
                    </div>
                    {!hideValue && (
                      <div className="flex flex-wrap gap-2 items-center">
                        {showSearch ? (
                          <FilterValueSearch
                            source={cond.source || config.primarySource}
                            field={cond.field}
                            value={cond.value == null ? '' : String(cond.value)}
                            onChange={(value) => updateFilter(i, { value })}
                          />
                        ) : (
                          <input
                            className={`${inputClass} flex-1 min-w-[120px]`}
                            value={cond.value == null ? '' : String(cond.value)}
                            onChange={(e) => updateFilter(i, { value: e.target.value })}
                            placeholder="Value"
                          />
                        )}
                        {isBetween && (
                          <input
                            className={`${inputClass} flex-1 min-w-[100px]`}
                            value={cond.valueTo == null ? '' : String(cond.valueTo)}
                            onChange={(e) => updateFilter(i, { valueTo: e.target.value })}
                            placeholder="To"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {config.filters.conditions.length === 0 && (
                <p className="text-xs text-gray-500">No filters — all rows from the primary source will be included.</p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Group by levels</p>
              <button
                type="button"
                className={`${buttonClass} border-amber-500/40 text-amber-300`}
                onClick={() => {
                  const f = fields.find((x) => x.groupable !== false) || fields[0];
                  if (!f) return;
                  patchConfig((prev) => ({
                    ...prev,
                    groupBy: [...prev.groupBy, { source: f.source, key: f.key }],
                  }));
                }}
              >
                + Add level
              </button>
            </div>
            {config.groupBy.map((g, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center">
                <select
                  className={`${inputClass} w-auto min-w-[180px]`}
                  value={fieldId(g.source, g.key)}
                  onChange={(e) => {
                    const [source, ...rest] = e.target.value.split('.');
                    const key = rest.join('.');
                    patchConfig((prev) => ({
                      ...prev,
                      groupBy: prev.groupBy.map((x, j) => (j === i ? { source, key } : x)),
                    }));
                  }}
                >
                  {fields.map((f) => (
                    <option key={fieldId(f.source, f.key)} value={fieldId(f.source, f.key)}>
                      {f.label} ({f.source})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${buttonClass} border-red-500/30 text-red-300`}
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      groupBy: prev.groupBy.filter((_, j) => j !== i),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {config.groupBy.length === 0 && <p className="text-xs text-gray-500">No grouping — flat row list.</p>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Sort levels</p>
              <button
                type="button"
                className={`${buttonClass} border-amber-500/40 text-amber-300`}
                onClick={() => {
                  const f = fields[0];
                  if (!f) return;
                  patchConfig((prev) => ({
                    ...prev,
                    sort: [...prev.sort, { source: f.source, key: f.key, dir: 'asc' }],
                  }));
                }}
              >
                + Add sort
              </button>
            </div>
            {config.sort.map((s, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center">
                <select
                  className={`${inputClass} w-auto min-w-[180px]`}
                  value={fieldId(s.source, s.key)}
                  onChange={(e) => {
                    const [source, ...rest] = e.target.value.split('.');
                    const key = rest.join('.');
                    patchConfig((prev) => ({
                      ...prev,
                      sort: prev.sort.map((x, j) => (j === i ? { ...x, source, key } : x)),
                    }));
                  }}
                >
                  {fields.map((f) => (
                    <option key={fieldId(f.source, f.key)} value={fieldId(f.source, f.key)}>
                      {f.label} ({f.source})
                    </option>
                  ))}
                </select>
                <select
                  className={`${inputClass} w-auto`}
                  value={s.dir}
                  onChange={(e) =>
                    patchConfig((prev) => ({
                      ...prev,
                      sort: prev.sort.map((x, j) =>
                        j === i ? { ...x, dir: e.target.value as 'asc' | 'desc' } : x
                      ),
                    }))
                  }
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <button
                  type="button"
                  className={`${buttonClass} border-red-500/30 text-red-300`}
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      sort: prev.sort.filter((_, j) => j !== i),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {config.sort.length === 0 && <p className="text-xs text-gray-500">No sort — default order.</p>}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Click a calculation type to add it, then pick the field. Results show as KPI cards in preview/export.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(catalog?.calculations || []).map((calc) => (
                <button
                  key={calc.key}
                  type="button"
                  className={`${buttonClass} border-amber-500/40 text-amber-300`}
                  onClick={() => {
                    const needsNumber = ['sum', 'avg', 'min', 'max', 'median', 'running_total'].includes(calc.key);
                    const f =
                      (needsNumber ? fields.find((x) => x.aggregatable || x.type === 'number') : null) ||
                      fields[0];
                    if (!f) return;
                    patchConfig((prev) => ({
                      ...prev,
                      calculations: [
                        ...prev.calculations,
                        {
                          id: `c${Date.now()}_${calc.key}`,
                          type: calc.key,
                          field: f.key,
                          source: f.source,
                          label: `${calc.label} of ${f.label}`,
                        },
                      ],
                    }));
                  }}
                >
                  + {calc.label}
                </button>
              ))}
            </div>
            {config.calculations.map((c, i) => (
              <div key={c.id} className="flex flex-wrap gap-2 items-center rounded-lg border border-gray-700/50 bg-gray-900/30 p-2">
                <select
                  className={`${inputClass} w-auto`}
                  value={c.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    const typeLabel = catalog?.calculations?.find((x) => x.key === type)?.label || type;
                    const fieldLabel = fields.find((f) => f.key === c.field)?.label || c.field;
                    patchConfig((prev) => ({
                      ...prev,
                      calculations: prev.calculations.map((x, j) =>
                        j === i ? { ...x, type, label: `${typeLabel} of ${fieldLabel}` } : x
                      ),
                    }));
                  }}
                >
                  {(catalog?.calculations || []).map((calc) => (
                    <option key={calc.key} value={calc.key}>
                      {calc.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">of</span>
                <select
                  className={`${inputClass} w-auto min-w-[160px]`}
                  value={c.source && c.field ? fieldId(c.source, c.field) : c.field}
                  onChange={(e) => {
                    const [source, ...rest] = e.target.value.split('.');
                    const key = rest.join('.');
                    const typeLabel = catalog?.calculations?.find((x) => x.key === c.type)?.label || c.type;
                    const fieldLabel = fields.find((f) => f.key === key)?.label || key;
                    patchConfig((prev) => ({
                      ...prev,
                      calculations: prev.calculations.map((x, j) =>
                        j === i ? { ...x, source, field: key, label: `${typeLabel} of ${fieldLabel}` } : x
                      ),
                    }));
                  }}
                >
                  {fields.map((f) => (
                    <option key={fieldId(f.source, f.key)} value={fieldId(f.source, f.key)}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <input
                  className={`${inputClass} w-auto min-w-[100px] flex-1`}
                  value={c.label || ''}
                  onChange={(e) =>
                    patchConfig((prev) => ({
                      ...prev,
                      calculations: prev.calculations.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x
                      ),
                    }))
                  }
                  placeholder="Label"
                />
                <button
                  type="button"
                  className={`${buttonClass} border-red-500/30 text-red-300`}
                  onClick={() =>
                    patchConfig((prev) => ({
                      ...prev,
                      calculations: prev.calculations.filter((_, j) => j !== i),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {config.calculations.length === 0 && (
              <p className="text-xs text-gray-500">No calculations yet — click a type above to add one.</p>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Choose how results are shown. The preview below updates to the selected chart type.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {(catalog?.visualizations || []).map((v) => {
                const on = config.visualization?.type === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={async () => {
                      const next = {
                        ...config,
                        visualization: { type: v.key, options: {} },
                      };
                      patchConfig({ visualization: { type: v.key, options: {} } });
                      await refreshChartPreview(next);
                    }}
                    className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                      on
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                        : 'border-gray-700/60 bg-gray-900/40 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <p className="text-sm font-medium">{v.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{v.key}</p>
                  </button>
                );
              })}
            </div>
            <ReportChartPreview
              chart={preview?.chart}
              visualization={config.visualization?.type}
              emptyHint={
                config.fields.length
                  ? 'Loading chart data… click the visualization again or run Preview on the Export step.'
                  : 'Select fields first, then pick a visualization to preview the chart.'
              }
            />
          </div>
        )}

        {step === 7 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            <p className="sm:col-span-2 text-[11px] text-gray-500">
              Prefills from Report Studio settings. Change any field here for this report only.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Header</label>
              <input
                className={inputClass}
                value={formatting.header || ''}
                onChange={(e) => setFormatting('header', e.target.value)}
                placeholder="Report header text"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Footer</label>
              <input
                className={inputClass}
                value={formatting.footer || ''}
                onChange={(e) => setFormatting('footer', e.target.value)}
                placeholder="Report footer text"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Watermark</label>
              <input
                className={inputClass}
                value={formatting.watermark || ''}
                onChange={(e) => setFormatting('watermark', e.target.value)}
                placeholder="Optional watermark"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Orientation</label>
              <select
                className={inputClass}
                value={formatting.orientation || 'landscape'}
                onChange={(e) => setFormatting('orientation', e.target.value)}
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Paper size</label>
              <select
                className={inputClass}
                value={formatting.paperSize || 'a4'}
                onChange={(e) => setFormatting('paperSize', e.target.value)}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
                <option value="a3">A3</option>
              </select>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-3 relative overflow-hidden min-h-[88px]">
              {(formatting.watermark || '') && (
                <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-600/20 -rotate-12 select-none">
                  {formatting.watermark}
                </p>
              )}
              <p className="text-[10px] uppercase text-gray-500">PDF preview chrome</p>
              <p className="text-xs text-gray-200 mt-1">{formatting.header || 'Header (empty)'}</p>
              <p className="text-[11px] text-gray-500 mt-3">{formatting.footer || 'Footer (empty)'}</p>
              <p className="text-[10px] text-gray-600 mt-2">Applied when you export PDF.</p>
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {['csv', 'json', 'pdf', 'xlsx', 'docx', 'print'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  disabled={!!busy}
                  onClick={() => doExport(fmt)}
                  className={`${buttonClass} border-gray-700/60 text-gray-300 uppercase`}
                >
                  {busy === `export-${fmt}` ? '…' : fmt}
                </button>
              ))}
              <button
                type="button"
                disabled={!!busy}
                onClick={runPreview}
                className={`${buttonClass} border-amber-500/40 text-amber-300`}
              >
                {busy === 'preview' ? 'Running…' : 'Refresh preview'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              CSV, XLSX, and DOCX export raw tabular data only — charts, visuals, header, footer, and watermark are not included. Export or print PDF to include those.
            </p>

            {preview?.aggregates && preview.aggregates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {preview.aggregates.map((a) => (
                  <div key={a.id} className="rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-2 min-w-[100px]">
                    <p className="text-[10px] uppercase text-gray-500">{a.label}</p>
                    <p className="text-sm font-semibold text-amber-200 tabular-nums">{String(a.value ?? '—')}</p>
                  </div>
                ))}
              </div>
            )}

            <ReportChartPreview
              chart={preview?.chart}
              visualization={config.visualization?.type || preview?.visualization}
            />

            {preview ? (
              (config.visualization?.type === 'table' || !config.visualization?.type || config.visualization?.type === 'pivot') && (
              <div className="overflow-auto max-h-80 rounded-lg border border-gray-700/50">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800 bg-gray-900/60">
                      {preview.columns.map((c) => (
                        <th key={c.key} className="px-2 py-1.5 font-medium whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-800/60 text-gray-300">
                        {preview.columns.map((c) => (
                          <td key={c.key} className="px-2 py-1.5 whitespace-nowrap max-w-[220px] truncate">
                            {String(row[c.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-2 py-1.5 text-[10px] text-gray-500 border-t border-gray-800">
                  Showing {preview.rows.length} of {preview.total} records
                </p>
              </div>
              )
            ) : (
              <p className="text-xs text-gray-500">Run Preview to see results and export.</p>
            )}

            {preview && config.visualization?.type && !['table', 'pivot'].includes(config.visualization.type) && (
              <details className="rounded-lg border border-gray-800 bg-gray-900/20">
                <summary className="px-3 py-2 text-xs text-gray-400 cursor-pointer">Show data table</summary>
                <div className="overflow-auto max-h-60 border-t border-gray-800">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-800 bg-gray-900/60">
                        {preview.columns.map((c) => (
                          <th key={c.key} className="px-2 py-1.5 font-medium whitespace-nowrap">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-800/60 text-gray-300">
                          {preview.columns.map((c) => (
                            <td key={c.key} className="px-2 py-1.5 whitespace-nowrap max-w-[220px] truncate">
                              {String(row[c.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`${buttonClass} border-gray-700/60 text-gray-300 disabled:opacity-40`}
        >
          Back
        </button>
        <span className="text-[11px] text-gray-500">
          Step {step + 1} of {STEPS.length}
        </span>
        <button
          type="button"
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          className={`${buttonClass} border-amber-500/40 text-amber-300 disabled:opacity-40`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
