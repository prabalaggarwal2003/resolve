'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import FilterValueSearch from '@/components/reports/FilterValueSearch';
import {
  createSchedule,
  downloadTextFile,
  emptyReportConfig,
  exportReport,
  fetchQuickReport,
  fetchQuickReports,
  runReport,
  saveDefinition,
  saveQuickAs,
  updateDefinition,
  type ReportConfig,
  type ReportFilterCondition,
  type ReportRunResult,
} from '@/lib/reportStudio';
import { canWrite } from '@/lib/permissions';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';

type PreviewState = {
  name: string;
  key: string;
  config: ReportConfig;
  result: ReportRunResult;
};

const FILTERABLE_KEYS = new Set([
  'status',
  'category',
  'condition',
  'locationName',
  'departmentName',
  'vendorName',
  'assignedToName',
  'role',
  'action',
  'resource',
  'severity',
  'name',
  'assetId',
]);

export default function QuickReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<{ key: string; name: string; category: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('All');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [extraFilters, setExtraFilters] = useState<ReportFilterCondition[]>([]);
  const [busy, setBusy] = useState('');
  const canEdit = canWrite('reports');

  useEffect(() => {
    fetchQuickReports()
      .then((d) => setReports(d.reports || []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(reports.map((r) => r.category)))],
    [reports]
  );

  const filtered = category === 'All' ? reports : reports.filter((r) => r.category === category);

  const filterFields = useMemo(() => {
    if (!preview) return [];
    return (preview.config.fields || []).filter((f) => FILTERABLE_KEYS.has(f.key) || f.key.startsWith('custom.'));
  }, [preview]);

  const mergedConfig = (base: ReportConfig, extras: ReportFilterCondition[]): ReportConfig => {
    const existing = base.filters?.conditions || [];
    const activeExtras = extras.filter((c) => c.field && String(c.value ?? '').trim());
    return {
      ...base,
      filters: {
        logic: 'and',
        conditions: [...existing, ...activeExtras],
        groups: base.filters?.groups || [],
      },
    };
  };

  const openPreview = async (key: string) => {
    setBusy(key);
    setError('');
    try {
      const preset = await fetchQuickReport(key);
      const config = { ...emptyReportConfig(preset.config.primarySource), ...preset.config };
      const seedFilters: ReportFilterCondition[] = (config.fields || [])
        .filter((f) => FILTERABLE_KEYS.has(f.key))
        .slice(0, 4)
        .map((f) => ({
          source: f.source || config.primarySource,
          field: f.key,
          op: 'search',
          value: '',
        }));
      setExtraFilters(seedFilters);
      const result = await runReport(mergedConfig(config, seedFilters), { page: 1, limit: 25 });
      setPreview({ name: preset.name, key: preset.key, config, result });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run report');
    } finally {
      setBusy('');
    }
  };

  const applyFilters = async () => {
    if (!preview) return;
    setBusy('filter');
    setError('');
    try {
      const result = await runReport(mergedConfig(preview.config, extraFilters), { page: 1, limit: 25 });
      setPreview({ ...preview, result });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Filter failed');
    } finally {
      setBusy('');
    }
  };

  const doExport = async (format: string) => {
    if (!preview) return;
    setBusy('export');
    try {
      const out = await exportReport({
        config: mergedConfig(preview.config, extraFilters),
        format,
        reportName: preview.name,
      });
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

  const saveAs = async (kind: 'saved' | 'template') => {
    if (!preview || !canEdit) return;
    setBusy('save');
    try {
      const doc = await saveQuickAs(preview.key, kind);
      if (extraFilters.some((f) => String(f.value ?? '').trim())) {
        await updateDefinition(doc._id, { config: mergedConfig(preview.config, extraFilters) });
      }
      router.push(kind === 'template' ? '/dashboard/reports/templates' : `/dashboard/reports/builder?id=${doc._id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy('');
    }
  };

  const schedule = async () => {
    if (!preview || !canEdit) return;
    setBusy('schedule');
    try {
      const saved = await saveDefinition({
        name: preview.name,
        description: `From quick report ${preview.key}`,
        kind: 'saved',
        category: reports.find((r) => r.key === preview.key)?.category || '',
        quickKey: preview.key,
        config: mergedConfig(preview.config, extraFilters),
      });
      await createSchedule({
        reportId: saved._id,
        name: `${preview.name} weekly`,
        frequency: 'weekly',
        dayOfWeek: 1,
        exportFormat: 'csv',
      });
      router.push('/dashboard/reports/scheduled');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Schedule failed');
    } finally {
      setBusy('');
    }
  };

  if (loading) return <LoadingSpinner message="Loading quick reports…" />;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`${buttonClass} ${
              category === c
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                : 'bg-gray-800/40 text-gray-400 border-gray-700/60'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((r) => (
          <div key={r.key} className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-amber-400/70">{r.category}</p>
            <h3 className="text-sm font-semibold text-gray-100 mt-0.5">{r.name}</h3>
            <p className="text-xs text-gray-500 mt-1 min-h-[2.5rem]">{r.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button
                type="button"
                disabled={busy === r.key}
                onClick={() => openPreview(r.key)}
                className={`${buttonClass} border-amber-500/40 bg-amber-500/10 text-amber-300`}
              >
                {busy === r.key ? 'Running…' : 'Run'}
              </button>
              <Link
                href={`/dashboard/reports/builder?quick=${r.key}`}
                className={`${buttonClass} border-gray-700/60 text-gray-300 no-underline`}
              >
                Customize
              </Link>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-700/60 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-100">{preview.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{preview.result.total} records</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
                Close
              </button>
            </div>

            {filterFields.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-800 space-y-2 bg-gray-950/40">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Filters</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {extraFilters.map((f, i) => {
                    const meta = filterFields.find((x) => x.key === f.field);
                    return (
                      <div key={`${f.field}-${i}`} className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500">{meta?.label || f.field}</label>
                        <FilterValueSearch
                          source={f.source || preview.config.primarySource}
                          field={f.field}
                          value={String(f.value ?? '')}
                          onChange={(value) =>
                            setExtraFilters((prev) => prev.map((x, idx) => (idx === i ? { ...x, value } : x)))
                          }
                          placeholder={`Search ${meta?.label || f.field}…`}
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={applyFilters}
                  disabled={busy === 'filter'}
                  className={`${buttonClass} border-amber-500/40 text-amber-300`}
                >
                  {busy === 'filter' ? 'Applying…' : 'Apply filters'}
                </button>
              </div>
            )}

            <div className="px-5 py-3 flex flex-wrap gap-1.5 border-b border-gray-800">
              <button type="button" onClick={() => doExport('csv')} className={`${buttonClass} border-emerald-500/40 text-emerald-300`}>
                Export CSV
              </button>
              <button type="button" onClick={() => doExport('json')} className={`${buttonClass} border-blue-500/40 text-blue-300`}>
                Export JSON
              </button>
              <button type="button" onClick={() => doExport('pdf')} className={`${buttonClass} border-violet-500/40 text-violet-300`}>
                Export PDF
              </button>
              {canEdit && (
                <>
                  <button type="button" onClick={() => saveAs('saved')} className={`${buttonClass} border-amber-500/40 text-amber-300`}>
                    Save
                  </button>
                  <button type="button" onClick={() => saveAs('template')} className={`${buttonClass} border-gray-700/60 text-gray-300`}>
                    Save as template
                  </button>
                  <button type="button" onClick={schedule} className={`${buttonClass} border-gray-700/60 text-gray-300`}>
                    Schedule
                  </button>
                </>
              )}
              <Link
                href={`/dashboard/reports/builder?quick=${preview.key}`}
                className={`${buttonClass} border-gray-700/60 text-gray-300 no-underline`}
              >
                Open in builder
              </Link>
            </div>
            <div className="overflow-auto p-4">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    {preview.result.columns.map((c) => (
                      <th key={c.key} className="px-2 py-1.5 font-medium whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-800/60 text-gray-300">
                      {preview.result.columns.map((c) => (
                        <td key={c.key} className="px-2 py-1.5 whitespace-nowrap max-w-[220px] truncate">
                          {String(row[c.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
