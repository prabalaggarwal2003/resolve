'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite } from '@/lib/permissions';
import { formatOrgDateTime } from '@/lib/orgTimezone';
import {
  IMPORT_STEPS,
  type ColumnMapping,
  type DestinationField,
  type ImportCatalog,
  type ImportJob,
  type ImportRow,
  type ImportStepId,
  type SavedMapping,
  configureImportJob,
  downloadImportErrors,
  downloadResolveImportTemplate,
  executeImportJob,
  fetchImportCatalog,
  fetchImportHistory,
  fetchImportJob,
  fetchImportRows,
  fetchSavedMappings,
  saveImportMapping,
  saveImportProgress,
  saveJobMappings,
  selectImportSheet,
  uploadImportFile,
  validateImportJob,
} from '@/lib/assetImport';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';
const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

const DRAFT_KEY = 'resolve.assetImport.draft';
const RESUMABLE_STATUSES = new Set(['uploaded', 'configured', 'mapped', 'validated', 'importing', 'failed']);

function readDraft(): { jobId: string; step: ImportStepId } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { jobId?: string; step?: string };
    if (!parsed.jobId) return null;
    const step = (IMPORT_STEPS.find((s) => s.id === parsed.step)?.id || 'configure') as ImportStepId;
    return { jobId: parsed.jobId, step };
  } catch {
    return null;
  }
}

function writeDraft(jobId: string, step: ImportStepId) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ jobId, step }));
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DRAFT_KEY);
}

const VALUE_MAP_FIELDS = new Set(['status', 'category', 'condition']);

const DEFAULT_FIELD_SECTIONS = [
  { key: 'basic', label: 'Basic info' },
  { key: 'assignment', label: 'Assignment & location' },
  { key: 'purchase', label: 'Purchase & finance' },
  { key: 'custom', label: 'Additional details' },
];

function groupFieldsBySection(fields: DestinationField[], sections = DEFAULT_FIELD_SECTIONS) {
  const bySection = new Map<string, DestinationField[]>();
  for (const s of sections) bySection.set(s.key, []);
  for (const f of fields) {
    const key = bySection.has(f.section) ? f.section : 'custom';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(f);
  }
  return sections
    .map((s) => ({ ...s, fields: bySection.get(s.key) || [] }))
    .filter((s) => s.fields.length > 0);
}

function Stepper({ step }: { step: ImportStepId }) {
  const idx = IMPORT_STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="flex flex-wrap gap-1.5 mb-6">
      {IMPORT_STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li
            key={s.id}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
              active
                ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                : done
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-gray-700/50 text-gray-500'
            }`}
          >
            <span className="tabular-nums mr-1">{i + 1}.</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

export default function AssetImportPage() {
  const canImport = canWrite('assets');
  const [step, setStep] = useState<ImportStepId>('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<ImportCatalog | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [valueMappings, setValueMappings] = useState<Record<string, Record<string, string>>>({});
  const [transforms, setTransforms] = useState<Record<string, Record<string, string>>>({});
  const [relationshipRules, setRelationshipRules] = useState<
    Record<string, { mode: string; matches: Record<string, string> }>
  >({});
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'create_new' | 'stop'>('skip');
  const [suggestedSaved, setSuggestedSaved] = useState<SavedMapping | null>(null);
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [mappingName, setMappingName] = useState('');
  const [validationPreview, setValidationPreview] = useState<ImportRow[]>([]);
  const [errorRows, setErrorRows] = useState<ImportRow[]>([]);
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const HISTORY_PAGE_SIZE = 10;
  const [importResult, setImportResult] = useState<ImportJob['result'] | null>(null);
  const [failedImportRows, setFailedImportRows] = useState<ImportRow[]>([]);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  const fieldsByKey = useMemo(() => {
    const m = new Map<string, DestinationField>();
    for (const f of catalog?.destinationFields || []) m.set(f.key, f);
    return m;
  }, [catalog]);

  const fieldSections = useMemo(
    () => groupFieldsBySection(catalog?.destinationFields || [], catalog?.sections || DEFAULT_FIELD_SECTIONS),
    [catalog]
  );

  const goToStep = useCallback(
    async (next: ImportStepId, jobId?: string) => {
      setStep(next);
      const id = jobId || (job ? job.id || String(job._id) : '');
      if (!id || next === 'upload') {
        if (next === 'upload') clearDraft();
        return;
      }
      writeDraft(id, next);
      try {
        await saveImportProgress(id, next, duplicateHandling);
      } catch {
        /* local draft still kept */
      }
    },
    [job, duplicateHandling]
  );

  const loadHistory = useCallback(async (page = 1) => {
    const hist = await fetchImportHistory({ page, limit: HISTORY_PAGE_SIZE });
    setHistory(hist.jobs || []);
    setHistoryTotal(hist.total || 0);
    setHistoryPage(hist.page || page);
    setHistoryTotalPages(hist.totalPages || 1);
  }, []);

  const loadBootstrap = useCallback(async () => {
    const [{ templates: tpls, catalog: cat }, saved] = await Promise.all([
      fetchImportCatalog(),
      fetchSavedMappings(),
    ]);
    setCatalog(cat);
    setSavedMappings(saved.mappings || []);
    await loadHistory(1);
    const def = tpls.find((t) => t.isDefault) || tpls[0];
    if (def) setTemplateId(def._id);
  }, [loadHistory]);

  useEffect(() => {
    if (!canImport) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await loadBootstrap();
        const draft = readDraft();
        if (!draft?.jobId || cancelled) return;
        const data = await fetchImportJob(draft.jobId);
        const j = data.job;
        if (!j || !RESUMABLE_STATUSES.has(j.status) || cancelled) {
          clearDraft();
          return;
        }
        setJob(j);
        if (data.catalog) setCatalog(data.catalog);
        setColumnMappings(j.columnMappings || []);
        setValueMappings((j.valueMappings as typeof valueMappings) || {});
        setTransforms((j.transforms as typeof transforms) || {});
        setRelationshipRules((j.relationshipRules as typeof relationshipRules) || {});
        setDuplicateHandling((j.duplicateHandling as typeof duplicateHandling) || 'skip');
        if (j.templateId) setTemplateId(String(j.templateId));
        const resumeStep = (IMPORT_STEPS.find((s) => s.id === (j.wizardStep || draft.step))?.id ||
          draft.step ||
          'configure') as ImportStepId;
        setStep(resumeStep === 'upload' ? 'configure' : resumeStep);
        writeDraft(j.id || String(j._id), resumeStep === 'upload' ? 'configure' : resumeStep);
        if (resumeStep === 'validate' || resumeStep === 'preview') {
          try {
            const rows = await fetchImportRows(j.id || String(j._id), { page: 1, limit: 40 });
            if (resumeStep === 'preview') setPreviewRows(rows.rows || []);
            else setValidationPreview(rows.rows || []);
          } catch {
            /* optional */
          }
        }
      } catch {
        clearDraft();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canImport, loadBootstrap]);

  if (!canImport) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-red-300">You do not have permission to import assets.</p>
        <Link href="/dashboard/assets" className="text-sm text-blue-300 mt-3 inline-block">
          ← Back to assets
        </Link>
      </div>
    );
  }

  if (restoring) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <LoadingSpinner message="Restoring import progress…" />
      </div>
    );
  }

  async function onUpload(file: File) {
    setBusy(true);
    setError('');
    try {
      const data = await uploadImportFile(file);
      setJob(data.job);
      writeDraft(data.job.id || String(data.job._id), 'configure');
      setStep('configure');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSelectSheet(sheetName: string) {
    if (!job) return;
    setBusy(true);
    setError('');
    try {
      const data = await selectImportSheet(job.id || String(job._id), sheetName);
      setJob(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to switch sheet');
    } finally {
      setBusy(false);
    }
  }

  async function onConfigure() {
    if (!job) return;
    setBusy(true);
    setError('');
    try {
      const data = await configureImportJob(job.id || String(job._id), {
        // Category mapping (step 4) chooses / creates templates per row — no forced template here
        duplicateHandling,
        wizardStep: 'map',
      });
      setJob(data.job);
      setCatalog(data.catalog);
      setColumnMappings(data.job.columnMappings?.length ? data.job.columnMappings : data.suggestedMappings);
      setSuggestedSaved(data.suggestedSavedMapping);
      // Default: create missing locations/partners/departments
      setRelationshipRules((prev) => ({
        locationId: { mode: 'create', matches: {} },
        departmentId: { mode: 'create', matches: {} },
        groupId: { mode: 'create', matches: {} },
        vendorId: { mode: 'create', matches: {} },
        ...prev,
      }));
      await goToStep('map', data.job.id || String(data.job._id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Configure failed');
    } finally {
      setBusy(false);
    }
  }

  function applySavedMapping(m: SavedMapping) {
    setColumnMappings(m.columnMappings || []);
    setValueMappings(m.valueMappings || {});
    setTransforms(m.transforms || {});
    setRelationshipRules((m.relationshipRules as typeof relationshipRules) || {});
    setDuplicateHandling((m.duplicateHandling as typeof duplicateHandling) || 'skip');
    if (m.templateId) setTemplateId(String(m.templateId));
    setSuggestedSaved(null);
  }

  async function persistMappings(overrides?: {
    valueMappings?: typeof valueMappings;
    relationshipRules?: typeof relationshipRules;
    wizardStep?: ImportStepId;
  }) {
    if (!job) return;
    await saveJobMappings(job.id || String(job._id), {
      columnMappings,
      valueMappings: overrides?.valueMappings ?? valueMappings,
      transforms,
      relationshipRules: overrides?.relationshipRules ?? relationshipRules,
      duplicateHandling,
      wizardStep: overrides?.wizardStep,
    });
  }

  /** Resolve displayed matches into persisted maps so validate sees the same choices as the UI. */
  function syncValueAndRelationshipMaps() {
    const nextValues: typeof valueMappings = { ...valueMappings };
    const categories = catalog?.entities.categories || [];

    for (const m of columnMappings) {
      if (m.ignored || !VALUE_MAP_FIELDS.has(m.targetField)) continue;
      const field = fieldsByKey.get(m.targetField);
      const options =
        m.targetField === 'category'
          ? categories
          : field?.options?.length
            ? field.options
            : m.targetField === 'status'
              ? catalog?.entities.statuses || []
              : field?.options || [];
      const map = { ...(nextValues[m.targetField] || {}) };
      for (const v of distinctRelValues(m.targetField)) {
        if (map[v]) continue;
        const matched = options.find((o) => String(o).toLowerCase() === v.toLowerCase());
        if (matched != null) map[v] = matched;
        else if (m.targetField === 'category') map[v] = v; // create new category/template from sheet value
      }
      nextValues[m.targetField] = map;
    }

    const nextRel: typeof relationshipRules = { ...relationshipRules };
    for (const fieldKey of ['locationId', 'departmentId', 'groupId', 'vendorId'] as const) {
      if (!columnMappings.some((m) => !m.ignored && m.targetField === fieldKey)) continue;
      const entities =
        fieldKey === 'locationId'
          ? catalog?.entities.locations || []
          : fieldKey === 'departmentId'
            ? catalog?.entities.departments || []
            : fieldKey === 'groupId'
              ? catalog?.entities.groups || []
              : catalog?.entities.partners || [];
      const rule = { mode: nextRel[fieldKey]?.mode || 'create', matches: { ...(nextRel[fieldKey]?.matches || {}) } };
      for (const v of distinctRelValues(fieldKey)) {
        if (rule.matches[v]) continue;
        const found = entities.find(
          (e) =>
            e.name.toLowerCase() === v.toLowerCase() ||
            ('code' in e && String((e as { code?: string }).code || '').toLowerCase() === v.toLowerCase()) ||
            ('key' in e && String((e as { key?: string }).key || '').toLowerCase() === v.toLowerCase())
        );
        if (found) rule.matches[v] = found.id;
      }
      nextRel[fieldKey] = rule;
    }

    setValueMappings(nextValues);
    setRelationshipRules(nextRel);
    return { valueMappings: nextValues, relationshipRules: nextRel };
  }

  async function goValues() {
    setBusy(true);
    setError('');
    try {
      await persistMappings({ wizardStep: 'values' });
      await goToStep('values');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save mappings');
    } finally {
      setBusy(false);
    }
  }

  async function runValidate() {
    if (!job) return;
    setBusy(true);
    setError('');
    try {
      const synced = syncValueAndRelationshipMaps();
      await persistMappings({ ...synced, wizardStep: 'validate' });
      const data = await validateImportJob(job.id || String(job._id));
      setJob(data.job);
      setValidationPreview(data.previewRows);
      setErrorRows(data.errorRows);
      await goToStep('validate');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setBusy(false);
    }
  }

  async function goPreview() {
    if (!job) return;
    setBusy(true);
    try {
      const data = await fetchImportRows(job.id || String(job._id), { page: 1, limit: 40 });
      setPreviewRows(data.rows);
      await goToStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load preview');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!job) return;
    if (!window.confirm('Import valid rows into Resolve? This cannot be undone automatically.')) return;
    setBusy(true);
    setError('');
    try {
      const data = await executeImportJob(job.id || String(job._id));
      setJob(data.job);
      setImportResult(data.result);
      setFailedImportRows(data.failedRows || []);
      await goToStep('import');
      clearDraft();
      await loadHistory(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveMappingConfig() {
    if (!mappingName.trim()) {
      setError('Enter a name for the saved mapping.');
      return;
    }
    setBusy(true);
    try {
      await saveImportMapping({
        name: mappingName.trim(),
        templateId,
        sourceHeaders: (job?.headers || []).map((h) => h.key),
        columnMappings,
        valueMappings,
        transforms,
        relationshipRules,
        duplicateHandling,
      });
      const saved = await fetchSavedMappings();
      setSavedMappings(saved.mappings || []);
      setMappingName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save mapping');
    } finally {
      setBusy(false);
    }
  }

  function updateMapping(sourceColumn: string, patch: Partial<ColumnMapping>) {
    setColumnMappings((prev) =>
      prev.map((m) => (m.sourceColumn === sourceColumn ? { ...m, ...patch, suggested: false } : m))
    );
  }

  function onDropField(targetField: string) {
    if (!dragSource) return;
    setColumnMappings((prev) => {
      const cleared = prev.map((m) =>
        m.targetField === targetField ? { ...m, targetField: '', suggested: false } : m
      );
      return cleared.map((m) =>
        m.sourceColumn === dragSource
          ? { ...m, targetField, ignored: false, suggested: false }
          : m
      );
    });
    setDragSource(null);
  }

  const distinctRelValues = (fieldKey: string) => {
    const col = columnMappings.find((m) => !m.ignored && m.targetField === fieldKey);
    if (!col || !job?.previewRows) return [] as string[];
    const set = new Set<string>();
    for (const row of job.previewRows) {
      const v = String(row[col.sourceColumn] || '').trim();
      if (v) set.add(v);
    }
    // Also scan first raw headers samples
    const header = job.headers?.find((h) => h.key === col.sourceColumn);
    for (const s of header?.sampleValues || []) if (s.trim()) set.add(s.trim());
    return Array.from(set).slice(0, 40);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/assets" className="text-xs text-gray-500 hover:text-gray-300">
            ← Assets
          </Link>
          <h1 className="text-2xl font-bold text-gray-100 mt-1">Import Assets</h1>
          <p className="text-sm text-gray-400 mt-1">
            Upload an existing Excel/CSV inventory, map columns to Resolve fields, validate, then import.
          </p>
        </div>
        <button
          type="button"
          className={`${buttonClass} border-emerald-500/40 text-emerald-300`}
          onClick={() => downloadResolveImportTemplate(templateId || undefined).catch((e) => setError(e.message))}
        >
          Download Resolve template
        </button>
      </div>

      <Stepper step={step} />

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-200">
          {error}
        </div>
      )}

      {busy && (
        <div className="mb-4">
          <LoadingSpinner message="Working…" />
        </div>
      )}

      {/* UPLOAD */}
      {step === 'upload' && (
        <section className="rounded-xl border border-gray-700/60 bg-gray-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">1. Upload CSV or Excel</h2>
          <p className="text-xs text-gray-500">
            Nothing is imported yet. We only read headers and a preview so you can map columns.
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className={inputClass}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          {historyTotal > 0 && (
            <div className="pt-4 border-t border-gray-700/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Recent imports</p>
                <p className="text-[11px] text-gray-500 tabular-nums">
                  {historyTotal} total
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-700/50">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-800/60 text-gray-500">
                    <tr>
                      <th className="px-2.5 py-2 text-left font-medium">File</th>
                      <th className="px-2.5 py-2 text-left font-medium">Status</th>
                      <th className="px-2.5 py-2 text-right font-medium">Created</th>
                      <th className="px-2.5 py-2 text-right font-medium">Updated</th>
                      <th className="px-2.5 py-2 text-right font-medium">Skipped</th>
                      <th className="px-2.5 py-2 text-right font-medium">Failed</th>
                      <th className="px-2.5 py-2 text-left font-medium">By</th>
                      <th className="px-2.5 py-2 text-left font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id || h._id} className="border-t border-gray-800/80">
                        <td className="px-2.5 py-2 text-gray-200 max-w-[12rem] truncate" title={h.fileName}>
                          {h.fileName}
                        </td>
                        <td className="px-2.5 py-2">
                          <span
                            className={`capitalize ${
                              h.status === 'completed'
                                ? 'text-emerald-300'
                                : h.status === 'failed'
                                  ? 'text-red-300'
                                  : 'text-gray-400'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-emerald-300/90">
                          {h.result?.created ?? '—'}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-blue-300/90">
                          {h.result?.updated ?? '—'}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-amber-300/90">
                          {h.result?.skipped ?? '—'}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-red-300/90">
                          {h.result?.failed ?? '—'}
                        </td>
                        <td className="px-2.5 py-2 text-gray-400 truncate max-w-[8rem]">
                          {h.createdBy?.name || h.createdBy?.email || '—'}
                        </td>
                        <td className="px-2.5 py-2 text-gray-500 whitespace-nowrap">
                          {h.createdAt ? formatOrgDateTime(h.createdAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {historyTotalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                  <span className="tabular-nums">
                    Page {historyPage} of {historyTotalPages}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className={`${buttonClass} border-gray-700 text-gray-400 disabled:opacity-40`}
                      disabled={historyPage <= 1 || busy}
                      onClick={() => void loadHistory(historyPage - 1)}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className={`${buttonClass} border-gray-700 text-gray-400 disabled:opacity-40`}
                      disabled={historyPage >= historyTotalPages || busy}
                      onClick={() => void loadHistory(historyPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* CONFIGURE */}
      {step === 'configure' && job && (
        <section className="rounded-xl border border-gray-700/60 bg-gray-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">2. Configure</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-950/40">
              <p className="text-gray-500">File</p>
              <p className="text-gray-200 mt-0.5">{job.fileName}</p>
            </div>
            <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-950/40">
              <p className="text-gray-500">Rows</p>
              <p className="text-gray-200 mt-0.5 tabular-nums">{job.rowCount}</p>
            </div>
            <div className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-950/40">
              <p className="text-gray-500">Columns</p>
              <p className="text-gray-200 mt-0.5 tabular-nums">{job.headers?.length || 0}</p>
            </div>
          </div>

          {job.sheetNames?.length > 1 && (
            <div>
              <label className={labelClass}>Worksheet</label>
              <select
                className={inputClass}
                value={job.sheetName}
                onChange={(e) => void onSelectSheet(e.target.value)}
              >
                {job.sheetNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>If Asset ID already exists</label>
            <select
              className={inputClass}
              value={duplicateHandling}
              onChange={(e) => setDuplicateHandling(e.target.value as typeof duplicateHandling)}
            >
              <option value="skip">Skip (safe default)</option>
              <option value="update">Update existing asset</option>
              <option value="create_new">Fail row (do not overwrite)</option>
              <option value="stop">Stop import on first duplicate</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-700/50">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-800/60 text-gray-500">
                <tr>
                  {(job.headers || []).map((h) => (
                    <th key={h.key} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                      {h.label}
                      <span className="block text-[9px] text-gray-600 normal-case">{h.detectedType}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(job.previewRows || []).slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-gray-800">
                    {(job.headers || []).map((h) => (
                      <td key={h.key} className="px-2 py-1 text-gray-300 max-w-[12rem] truncate whitespace-nowrap">
                        {row[h.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${buttonClass} border-gray-600 text-gray-300`} onClick={() => void goToStep('upload')}>
              Back
            </button>
            <button
              type="button"
              className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300`}
              onClick={() => void onConfigure()}
              disabled={busy}
            >
              Continue to mapping
            </button>
          </div>
        </section>
      )}

      {/* MAP */}
      {step === 'map' && job && catalog && (
        <section className="rounded-xl border border-gray-700/60 bg-gray-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">3. Map columns</h2>
          <p className="text-xs text-gray-500">
            Map each spreadsheet column to any Resolve field. Fields are grouped by section — not limited to one asset
            category. Drag a source column onto a field chip, or pick from the dropdown.
          </p>

          {suggestedSaved && (
            <div className="px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2">
              <span>
                Saved mapping <strong>{suggestedSaved.name}</strong> matches these columns.
              </span>
              <button
                type="button"
                className={`${buttonClass} border-amber-500/40 text-amber-200`}
                onClick={() => applySavedMapping(suggestedSaved)}
              >
                Apply saved mapping
              </button>
            </div>
          )}

          {savedMappings.length > 0 && (
            <div>
              <label className={labelClass}>Or pick a saved mapping</label>
              <select
                className={inputClass}
                defaultValue=""
                onChange={(e) => {
                  const m = savedMappings.find((x) => x.id === e.target.value);
                  if (m) applySavedMapping(m);
                }}
              >
                <option value="">—</option>
                {savedMappings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-3 max-h-64 overflow-y-auto rounded-lg border border-gray-700/40 bg-gray-950/30 p-3">
            {fieldSections.map((section) => (
              <div key={section.key}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{section.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {section.fields.map((f) => (
                    <span
                      key={f.key}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropField(f.key)}
                      className="px-2 py-1 rounded border border-dashed border-gray-600 text-[10px] text-gray-400"
                      title={f.required ? 'Required' : f.label}
                    >
                      {f.label}
                      {f.required ? ' *' : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {columnMappings.map((m) => {
              const header = job.headers?.find((h) => h.key === m.sourceColumn);
              return (
                <div
                  key={m.sourceColumn}
                  className={`grid md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center px-3 py-2 rounded-lg border ${
                    m.suggested ? 'border-blue-500/30 bg-blue-500/5' : 'border-gray-700/50 bg-gray-950/30'
                  }`}
                >
                  <div
                    draggable
                    onDragStart={() => setDragSource(m.sourceColumn)}
                    className="text-xs text-gray-200 cursor-grab"
                  >
                    <p className="font-medium">{m.sourceColumn}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {(header?.sampleValues || []).slice(0, 3).join(' · ') || '—'}
                    </p>
                    {m.suggested && <p className="text-[10px] text-blue-300 mt-0.5">Suggested — please confirm</p>}
                  </div>
                  <span className="text-gray-600 text-center hidden md:block">→</span>
                  <select
                    className={inputClass}
                    value={m.ignored ? '__ignore__' : m.createCustomField ? '__custom__' : m.targetField || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__ignore__') {
                        updateMapping(m.sourceColumn, { ignored: true, targetField: '', createCustomField: false });
                      } else if (v === '__custom__') {
                        const key =
                          m.sourceColumn
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '_')
                            .replace(/^_|_$/g, '')
                            .slice(0, 40) || 'custom_field';
                        updateMapping(m.sourceColumn, {
                          ignored: false,
                          createCustomField: true,
                          targetField: key,
                          customField: { key, label: m.sourceColumn, type: 'text', section: 'custom' },
                        });
                      } else {
                        updateMapping(m.sourceColumn, {
                          ignored: false,
                          createCustomField: false,
                          targetField: v,
                        });
                      }
                    }}
                  >
                    <option value="">— Select field —</option>
                    <option value="__ignore__">Ignore column</option>
                    <option value="__custom__">Create custom field</option>
                    {fieldSections.map((section) => (
                      <optgroup key={section.key} label={section.label}>
                        {section.fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? ' *' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`${buttonClass} border-gray-700 text-gray-500`}
                    onClick={() => updateMapping(m.sourceColumn, { ignored: true, targetField: '' })}
                  >
                    Ignore
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 items-end border-t border-gray-700/50 pt-3">
            <div className="flex-1 min-w-[12rem]">
              <label className={labelClass}>Save this mapping as</label>
              <input
                className={inputClass}
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder='e.g. "ABC Factory Asset Excel Format"'
              />
            </div>
            <button type="button" className={`${buttonClass} border-violet-500/40 text-violet-300`} onClick={() => void saveMappingConfig()}>
              Save mapping
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${buttonClass} border-gray-600 text-gray-300`} onClick={() => void goToStep('configure')}>
              Back
            </button>
            <button
              type="button"
              className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300`}
              onClick={() => void goValues()}
              disabled={busy}
            >
              Continue to value mapping
            </button>
          </div>
        </section>
      )}

      {/* VALUES */}
      {step === 'values' && catalog && (
        <section className="rounded-xl border border-gray-700/60 bg-gray-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">4. Map values & relationships</h2>
          <p className="text-xs text-gray-500">
            Convert imported labels (e.g. Operational → Working) and decide what to do when a partner or location is missing.
          </p>

          {columnMappings
            .filter((m) => !m.ignored && VALUE_MAP_FIELDS.has(m.targetField))
            .map((m) => {
              const field = fieldsByKey.get(m.targetField);
              const map = valueMappings[m.targetField] || {};
              const values = distinctRelValues(m.targetField);
              const isCategory = m.targetField === 'category';
              const options = isCategory
                ? catalog.entities.categories || field?.options || []
                : field?.options?.length
                  ? field.options
                  : m.targetField === 'status'
                    ? catalog.entities.statuses || []
                    : field?.options || [];
              return (
                <div key={m.targetField} className="space-y-2">
                  <p className="text-xs font-medium text-gray-300">{field?.label || m.targetField}</p>
                  {isCategory && (
                    <p className="text-[11px] text-gray-500">
                      Options are existing asset templates. Pick one, or create a new template from the sheet value
                      (you can assign its group later under Asset templates).
                    </p>
                  )}
                  {values.length === 0 && <p className="text-[11px] text-gray-600">No sample values in preview.</p>}
                  {values.map((v) => {
                    const matched = options.find((o) => String(o).toLowerCase() === v.toLowerCase());
                    const selected = map[v] || (matched != null ? matched : isCategory ? v : '');
                    const isNew = !matched;
                    return (
                      <div key={v} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs">
                        <div className="truncate">
                          <span className="text-gray-400">{v}</span>
                          {matched ? (
                            <span className="ml-2 text-emerald-400">✓ Template</span>
                          ) : isCategory ? (
                            <span className="ml-2 text-amber-400">New template</span>
                          ) : null}
                        </div>
                        <span className="text-gray-600">→</span>
                        <select
                          className={inputClass}
                          value={selected}
                          onChange={(e) =>
                            setValueMappings((prev) => ({
                              ...prev,
                              [m.targetField]: { ...(prev[m.targetField] || {}), [v]: e.target.value },
                            }))
                          }
                        >
                          {!isCategory && <option value="">Keep as-is / suggest later</option>}
                          {isCategory && isNew && (
                            <option value={v}>Create new template: {v}</option>
                          )}
                          {isCategory && !isNew && <option value={matched!}>Use template: {matched}</option>}
                          {options.map((opt) => (
                            <option key={opt} value={opt}>
                              {String(opt).replace(/_/g, ' ')}
                            </option>
                          ))}
                          {isCategory && !isNew && (
                            <option value={v}>Keep sheet value: {v}</option>
                          )}
                        </select>
                      </div>
                    );
                  })}
                </div>
              );
            })}

          {(['locationId', 'departmentId', 'groupId', 'vendorId'] as const).map((fieldKey) => {
            if (!columnMappings.some((m) => !m.ignored && m.targetField === fieldKey)) return null;
            const label =
              fieldKey === 'locationId'
                ? 'Location'
                : fieldKey === 'departmentId'
                  ? 'Department'
                  : fieldKey === 'groupId'
                    ? 'Asset group'
                    : 'Business Partner';
            const entities =
              fieldKey === 'locationId'
                ? catalog.entities.locations
                : fieldKey === 'departmentId'
                  ? catalog.entities.departments
                  : fieldKey === 'groupId'
                    ? catalog.entities.groups || []
                    : catalog.entities.partners;
            const rule = relationshipRules[fieldKey] || { mode: 'create', matches: {} };
            const values = distinctRelValues(fieldKey);
            return (
              <div key={fieldKey} className="space-y-2 border-t border-gray-700/40 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-300">{label} matching</p>
                  <select
                    className={`${inputClass} max-w-xs`}
                    value={rule.mode}
                    onChange={(e) =>
                      setRelationshipRules((prev) => ({
                        ...prev,
                        [fieldKey]: { ...rule, mode: e.target.value },
                      }))
                    }
                  >
                    <option value="create">Create missing entities</option>
                    <option value="match">Require match (or decide per value)</option>
                    <option value="blank">Leave blank if missing</option>
                    <option value="skip_row">Skip row if missing</option>
                  </select>
                </div>
                {values.map((v) => {
                  const found = entities.find(
                    (e) =>
                      e.name.toLowerCase() === v.toLowerCase() ||
                      ('code' in e &&
                        String((e as { code?: string }).code || '').toLowerCase() === v.toLowerCase()) ||
                      ('key' in e && String((e as { key?: string }).key || '').toLowerCase() === v.toLowerCase())
                  );
                  return (
                    <div key={v} className="grid md:grid-cols-[1fr_1fr] gap-2 text-xs items-center">
                      <div>
                        <span className="text-gray-300">{v}</span>
                        {found ? (
                          <span className="ml-2 text-emerald-400">✓ Existing found</span>
                        ) : (
                          <span className="ml-2 text-amber-400">⚠ Not found</span>
                        )}
                      </div>
                      <select
                        className={inputClass}
                        value={rule.matches?.[v] || (found ? found.id : '')}
                        onChange={(e) =>
                          setRelationshipRules((prev) => ({
                            ...prev,
                            [fieldKey]: {
                              ...rule,
                              matches: { ...(rule.matches || {}), [v]: e.target.value },
                            },
                          }))
                        }
                      >
                        <option value="">Use rule default</option>
                        <option value="__blank__">Leave blank</option>
                        <option value="__create__">Create new</option>
                        {entities.map((e) => (
                          <option key={e.id} value={e.id}>
                            Match: {e.name}
                            {'key' in e && (e as { key?: string }).key
                              ? ` (${(e as { key?: string }).key})`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="space-y-2 border-t border-gray-700/40 pt-3">
            <p className="text-xs font-medium text-gray-300">Date / number transforms</p>
            {columnMappings
              .filter((m) => !m.ignored && (fieldsByKey.get(m.targetField)?.type === 'date' || m.targetField === 'cost'))
              .map((m) => (
                <div key={m.targetField} className="grid sm:grid-cols-3 gap-2 items-center text-xs">
                  <span className="text-gray-400">{fieldsByKey.get(m.targetField)?.label || m.targetField}</span>
                  {m.targetField !== 'cost' ? (
                    <select
                      className={inputClass}
                      value={transforms[m.targetField]?.dateFormat || 'DMY'}
                      onChange={(e) =>
                        setTransforms((prev) => ({
                          ...prev,
                          [m.targetField]: { ...(prev[m.targetField] || {}), dateFormat: e.target.value },
                        }))
                      }
                    >
                      <option value="DMY">Dates as DD/MM/YYYY</option>
                      <option value="MDY">Dates as MM/DD/YYYY</option>
                    </select>
                  ) : (
                    <span className="text-gray-600">Currency symbols & commas stripped automatically</span>
                  )}
                  <select
                    className={inputClass}
                    value={transforms[m.targetField]?.case || ''}
                    onChange={(e) =>
                      setTransforms((prev) => ({
                        ...prev,
                        [m.targetField]: { ...(prev[m.targetField] || {}), case: e.target.value },
                      }))
                    }
                  >
                    <option value="">No case change</option>
                    <option value="upper">UPPERCASE</option>
                    <option value="lower">lowercase</option>
                    <option value="title">Title Case</option>
                  </select>
                </div>
              ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${buttonClass} border-gray-600 text-gray-300`} onClick={() => void goToStep('map')}>
              Back
            </button>
            <button
              type="button"
              className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300`}
              onClick={() => void runValidate()}
              disabled={busy}
            >
              Validate import
            </button>
          </div>
        </section>
      )}

      {/* VALIDATE */}
      {step === 'validate' && job && (
        <section className="rounded-xl border border-gray-700/60 bg-gray-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">5. Validation</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="px-3 py-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <p className="text-[10px] text-emerald-400/80 uppercase">Valid rows</p>
              <p className="text-2xl font-bold text-emerald-200 tabular-nums">{job.validationSummary?.valid ?? 0}</p>
            </div>
            <div className="px-3 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
              <p className="text-[10px] text-amber-400/80 uppercase">Warnings</p>
              <p className="text-2xl font-bold text-amber-200 tabular-nums">{job.validationSummary?.warnings ?? 0}</p>
            </div>
            <div className="px-3 py-3 rounded-lg border border-red-500/30 bg-red-500/10">
              <p className="text-[10px] text-red-400/80 uppercase">Errors</p>
              <p className="text-2xl font-bold text-red-200 tabular-nums">{job.validationSummary?.errors ?? 0}</p>
            </div>
          </div>

          {errorRows.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <p className="text-xs text-gray-400">Error details (first {errorRows.length})</p>
              {errorRows.map((r) => (
                <div key={r.id} className="px-3 py-2 rounded border border-red-500/20 bg-red-500/5 text-xs">
                  <p className="text-red-200 font-medium">Row {r.rowIndex + 1}</p>
                  <ul className="mt-1 text-red-300/90 list-disc pl-4">
                    {r.issues
                      .filter((i) => i.severity === 'error')
                      .map((i, idx) => (
                        <li key={idx}>
                          {i.field ? `${i.field}: ` : ''}
                          {i.message}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${buttonClass} border-gray-600 text-gray-300`} onClick={() => void goToStep('values')}>
              Back
            </button>
            <button
              type="button"
              className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300`}
              onClick={() => void goPreview()}
              disabled={busy || (job.validationSummary?.valid || 0) === 0}
            >
              Preview valid rows
            </button>
          </div>
        </section>
      )}

      {/* PREVIEW */}
      {step === 'preview' && (
        <section className="rounded-xl border border-gray-700/60 bg-gray-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">6. Preview</h2>
          <p className="text-xs text-gray-500">How Resolve will store the data. Review carefully, then confirm import.</p>
          <div className="overflow-x-auto rounded-lg border border-gray-700/50">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-800/60 text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 text-left">Row</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                  <th className="px-2 py-1.5 text-left">Asset ID</th>
                  <th className="px-2 py-1.5 text-left">Name</th>
                  <th className="px-2 py-1.5 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t border-gray-800 ${
                      r.status === 'error'
                        ? 'bg-red-500/5'
                        : r.status === 'warning'
                          ? 'bg-amber-500/5'
                          : 'bg-emerald-500/5'
                    }`}
                  >
                    <td className="px-2 py-1.5 text-gray-400 align-top whitespace-nowrap">{r.rowIndex + 1}</td>
                    <td className="px-2 py-1.5 capitalize text-gray-300 align-top whitespace-nowrap">{r.status}</td>
                    <td className="px-2 py-1.5 text-gray-200 align-top whitespace-nowrap">{String(r.mapped?.assetId ?? '')}</td>
                    <td className="px-2 py-1.5 text-gray-200 align-top">{String(r.mapped?.name ?? '')}</td>
                    <td className="px-2 py-1.5 text-gray-400 align-top min-w-[14rem] max-w-xl whitespace-normal break-words leading-relaxed">
                      {(r.issues || []).length
                        ? (r.issues || []).map((i) => i.message).join(' · ')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${buttonClass} border-gray-600 text-gray-300`} onClick={() => void goToStep('validate')}>
              Back
            </button>
            <button
              type="button"
              className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300`}
              onClick={() => void runImport()}
              disabled={busy}
            >
              Confirm & import
            </button>
          </div>
        </section>
      )}

      {/* SUMMARY */}
      {step === 'import' && (
        <section className="rounded-xl border border-gray-700/60 bg-gray-900/40 p-5 space-y-4">
          <h2
            className={`text-sm font-semibold ${
              (importResult?.created || 0) + (importResult?.updated || 0) > 0
                ? 'text-emerald-300'
                : 'text-amber-300'
            }`}
          >
            {(importResult?.created || 0) + (importResult?.updated || 0) > 0
              ? 'Import complete'
              : 'Import finished — no new assets added'}
          </h2>
          <div className="grid sm:grid-cols-4 gap-3">
            {(
              [
                ['Created', importResult?.created ?? 0, 'text-emerald-300'],
                ['Updated', importResult?.updated ?? 0, 'text-blue-300'],
                ['Skipped', importResult?.skipped ?? 0, 'text-amber-300'],
                ['Failed', importResult?.failed ?? 0, 'text-red-300'],
              ] as const
            ).map(([label, value, accent]) => (
              <div key={label} className="px-3 py-3 rounded-lg border border-gray-700/50 bg-gray-950/40">
                <p className="text-[10px] text-gray-500 uppercase">{label}</p>
                <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
              </div>
            ))}
          </div>
          {(importResult?.skipped || 0) > 0 && (importResult?.created || 0) === 0 && (
            <p className="text-xs text-amber-200/90">
              Rows were skipped because those Asset IDs already exist. Choose “Update existing asset” on step 2, or use
              new Asset IDs in the file.
            </p>
          )}
          {(importResult?.failed || 0) > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-red-200/90">
                Some rows failed during create. Review the list below or download the full error report.
              </p>
              {failedImportRows.length > 0 && (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-red-500/30 bg-red-500/5 divide-y divide-red-500/10">
                  {failedImportRows.map((r) => (
                    <div key={r.id} className="px-3 py-2 text-xs">
                      <p className="text-red-200 font-medium">
                        Row {r.rowIndex + 1}
                        {r.mapped?.assetId != null ? ` · ${String(r.mapped.assetId)}` : ''}
                        {r.mapped?.name != null ? ` · ${String(r.mapped.name)}` : ''}
                      </p>
                      <ul className="mt-1 text-red-300/90 list-disc pl-4 space-y-0.5">
                        {(r.issues || [])
                          .filter((i) => i.severity === 'error' || !i.severity)
                          .map((i, idx) => (
                            <li key={idx} className="whitespace-normal break-words">
                              {i.field ? `${i.field}: ` : ''}
                              {i.message}
                            </li>
                          ))}
                        {(r.issues || []).filter((i) => i.severity === 'error' || !i.severity).length === 0 &&
                          (r.issues || []).map((i, idx) => (
                            <li key={idx} className="whitespace-normal break-words">
                              {i.field ? `${i.field}: ` : ''}
                              {i.message}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {job && (importResult?.failed || 0) + (job.validationSummary?.errors || 0) > 0 && (
              <button
                type="button"
                className={`${buttonClass} border-red-500/40 text-red-300`}
                onClick={() => downloadImportErrors(job.id || String(job._id)).catch((e) => setError(e.message))}
              >
                Download error report
              </button>
            )}
            <Link href="/dashboard/assets" className={`${buttonClass} border-blue-500/40 text-blue-300 no-underline`}>
              View assets
            </Link>
            <button
              type="button"
              className={`${buttonClass} border-gray-600 text-gray-300`}
              onClick={() => {
                clearDraft();
                setJob(null);
                setImportResult(null);
                setFailedImportRows([]);
                setColumnMappings([]);
                setValueMappings({});
                setTransforms({});
                setRelationshipRules({});
                setValidationPreview([]);
                setErrorRows([]);
                setPreviewRows([]);
                setStep('upload');
              }}
            >
              Import another file
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
