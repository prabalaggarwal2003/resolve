'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite } from '@/lib/permissions';
import {
  createEmployee,
  deactivateEmployee,
  downloadEmployeeTemplate,
  executeEmployeeImportJob,
  fetchEmployeeImportRows,
  fetchEmployees,
  saveEmployeeMappings,
  updateEmployee,
  uploadEmployeeImport,
  validateEmployeeImport,
  type DestinationField,
  type Employee,
  type EmployeeImportJob,
} from '@/lib/employeeImport';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

type Tab = 'roster' | 'import';
type ImportStep = 'upload' | 'map' | 'validate' | 'done';

const emptyDraft = () => ({
  employeeId: '',
  name: '',
  email: '',
  phone: '',
  department: '',
  team: '',
});

export default function EmployeesPage() {
  const writable = canWrite('issues');
  const [tab, setTab] = useState<Tab>('roster');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [job, setJob] = useState<EmployeeImportJob | null>(null);
  const [fields, setFields] = useState<DestinationField[]>([]);
  const [mappings, setMappings] = useState<NonNullable<EmployeeImportJob['columnMappings']>>([]);
  const [dupHandling, setDupHandling] = useState('update');
  const [autoGenerateIds, setAutoGenerateIds] = useState(true);
  const [rowsPreview, setRowsPreview] = useState<
    {
      rowIndex: number;
      status: string;
      mapped?: Record<string, string>;
      issues?: { level?: string; severity?: string; message: string }[];
    }[]
  >([]);
  const [busy, setBusy] = useState(false);

  const load = async (query = q) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchEmployees({ q: query || undefined, active: 'true' });
      setEmployees(data.employees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writable) return;
    setMessage('');
    setError('');
    try {
      if (editingId) {
        await updateEmployee(editingId, draft);
        setMessage('Employee updated');
      } else {
        await createEmployee(draft);
        setMessage('Employee added');
      }
      setDraft(emptyDraft());
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp._id);
    setDraft({
      employeeId: emp.employeeId || '',
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || '',
      team: emp.team || '',
    });
  };

  const onUpload = async (file: File | null) => {
    if (!file || !writable) return;
    setBusy(true);
    setError('');
    try {
      const data = await uploadEmployeeImport(file);
      setJob(data.job);
      setFields(data.catalog?.destinationFields || []);
      setMappings(data.suggestedMappings || data.job.columnMappings || []);
      setImportStep('map');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onValidate = async () => {
    if (!job || !writable) return;
    setBusy(true);
    setError('');
    try {
      await saveEmployeeMappings(job._id, {
        columnMappings: mappings,
        duplicateHandling: dupHandling,
        autoGenerateEmployeeIds: autoGenerateIds,
      });
      const data = await validateEmployeeImport(job._id);
      setJob(data.job);
      const rows = await fetchEmployeeImportRows(job._id, 40);
      setRowsPreview(rows.rows || []);
      setImportStep('validate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setBusy(false);
    }
  };

  const onExecute = async () => {
    if (!job || !writable) return;
    setBusy(true);
    setError('');
    try {
      const data = await executeEmployeeImportJob(job._id);
      setJob(data.job);
      setImportStep('done');
      setMessage(
        `Import complete: ${data.result?.created || 0} created, ${data.result?.updated || 0} updated, ${data.result?.skipped || 0} skipped`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const blob = await downloadEmployeeTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resolve-employees-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  if (loading && tab === 'roster') return <LoadingSpinner message="Loading employees..." />;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/dashboard/issues" className="text-xs text-blue-400 no-underline">
            ← Tickets
          </Link>
          <h1 className="text-2xl font-bold text-gray-100 mt-1">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">
            Org employee roster for public report verification. Separate from Users &amp; Roles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/issues/contacts"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
          >
            Contacts
          </Link>
          <Link
            href="/dashboard/issues/automation"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
          >
            Automation
          </Link>
        </div>
      </div>

      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'roster' as const, label: 'Roster' },
            { id: 'import' as const, label: 'Import CSV / Excel' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              tab === t.id
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : 'border-gray-700/60 text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'roster' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-xs`}
              placeholder="Search name, ID, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load(q);
              }}
            />
            <button
              type="button"
              onClick={() => load(q)}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-700/60 text-gray-300"
            >
              Search
            </button>
          </div>

          {writable && (
            <form
              onSubmit={saveManual}
              className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 space-y-3"
            >
              <p className="text-sm font-medium text-gray-200">
                {editingId ? 'Edit employee' : 'Add employee'}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['employeeId', 'Employee ID *'],
                    ['name', 'Name *'],
                    ['email', 'Email *'],
                    ['phone', 'Phone'],
                    ['department', 'Department'],
                    ['team', 'Team'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    <input
                      className={inputClass}
                      required={key === 'employeeId' || key === 'name' || key === 'email'}
                      type={key === 'email' ? 'email' : 'text'}
                      value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200"
                >
                  {editingId ? 'Save' : 'Add'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setDraft(emptyDraft());
                    }}
                    className="px-3 py-1.5 text-xs text-gray-400"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="rounded-xl border border-gray-800/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60 text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">ID</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Dept / Team</th>
                  {writable && <th className="text-right px-3 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-600 text-xs">
                      No employees yet. Import a CSV/Excel or add manually.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp._id} className="border-t border-gray-800/60">
                      <td className="px-3 py-2 font-mono text-xs text-gray-300">{emp.employeeId}</td>
                      <td className="px-3 py-2 text-gray-200">{emp.name}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{emp.email}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {[emp.department, emp.team].filter(Boolean).join(' · ') || '—'}
                      </td>
                      {writable && (
                        <td className="px-3 py-2 text-right space-x-2">
                          <button
                            type="button"
                            className="text-xs text-blue-400"
                            onClick={() => startEdit(emp)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-400"
                            onClick={async () => {
                              if (!confirm('Deactivate this employee?')) return;
                              await deactivateEmployee(emp._id);
                              await load();
                            }}
                          >
                            Deactivate
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'import' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
            {(['upload', 'map', 'validate', 'done'] as ImportStep[]).map((s) => (
              <span
                key={s}
                className={`px-2 py-0.5 rounded border ${
                  importStep === s
                    ? 'border-blue-500/40 text-blue-200'
                    : 'border-gray-800 text-gray-600'
                }`}
              >
                {s}
              </span>
            ))}
          </div>

          {importStep === 'upload' && (
            <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 space-y-3">
              <p className="text-sm text-gray-300">
                Upload a CSV or Excel file with name, email, and optional employee ID, phone,
                department, and team. Missing employee IDs can be auto-generated during mapping.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-xs text-blue-400 hover:underline"
              >
                Download template CSV
              </button>
              {writable ? (
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  disabled={busy}
                  onChange={(e) => onUpload(e.target.files?.[0] || null)}
                  className="block text-xs text-gray-400"
                />
              ) : (
                <p className="text-xs text-gray-600">You need write access to import.</p>
              )}
            </div>
          )}

          {importStep === 'map' && job && (
            <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 space-y-3">
              <p className="text-sm text-gray-200">
                Map columns from <span className="font-mono text-xs">{job.fileName}</span> (
                {job.rowCount} rows)
              </p>
              <div className="space-y-2">
                {(mappings || []).map((m, idx) => (
                  <div key={m.sourceColumn} className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-gray-400 w-40 truncate">{m.sourceColumn}</span>
                    <select
                      className={`${inputClass} max-w-xs text-xs`}
                      value={m.ignored ? '' : m.targetField || ''}
                      onChange={(e) => {
                        const next = [...mappings];
                        const val = e.target.value;
                        next[idx] = {
                          ...next[idx],
                          targetField: val,
                          ignored: !val,
                          suggested: false,
                        };
                        setMappings(next);
                      }}
                    >
                      <option value="">— Ignore —</option>
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="max-w-xs">
                <label className={labelClass}>If employee ID already exists</label>
                <select
                  className={inputClass}
                  value={dupHandling}
                  onChange={(e) => setDupHandling(e.target.value)}
                >
                  <option value="update">Update existing</option>
                  <option value="skip">Skip</option>
                  <option value="stop">Stop (error)</option>
                </select>
              </div>
              <label className="flex items-start gap-2 cursor-pointer max-w-lg">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={autoGenerateIds}
                  onChange={(e) => setAutoGenerateIds(e.target.checked)}
                />
                <span className="text-xs text-gray-300">
                  Auto-generate missing employee IDs as{' '}
                  <span className="font-mono text-gray-400">ORG-DEPT-0001</span> (uses org name +
                  department, or team / EMP if no department). Sequence continues on later imports.
                </span>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={onValidate}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
              >
                {busy ? 'Validating…' : 'Validate'}
              </button>
            </div>
          )}

          {importStep === 'validate' && job && (
            <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 space-y-3">
              <p className="text-sm text-gray-200">
                Valid: {job.validationSummary?.valid ?? 0} · Warnings:{' '}
                {job.validationSummary?.warnings ?? 0} · Errors:{' '}
                {job.validationSummary?.errors ?? 0}
              </p>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {rowsPreview.map((r) => (
                  <div
                    key={r.rowIndex}
                    className="text-[11px] text-gray-400 border-b border-gray-800/40 py-1"
                  >
                    Row {r.rowIndex + 1}: {r.status}
                    {r.mapped?.employeeId ? ` · ${r.mapped.employeeId}` : ''}
                    {r.mapped?.name ? ` · ${r.mapped.name}` : ''}
                    {(r.issues || [])
                      .filter((i) => (i.level || i.severity) === 'error')
                      .map((i) => (
                        <span key={i.message} className="text-red-400">
                          {' '}
                          — {i.message}
                        </span>
                      ))}
                    {(r.issues || [])
                      .filter((i) => (i.level || i.severity) === 'warning')
                      .slice(0, 1)
                      .map((i) => (
                        <span key={i.message} className="text-amber-400/90">
                          {' '}
                          — {i.message}
                        </span>
                      ))}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || (job.validationSummary?.errors || 0) > 0 && (job.validationSummary?.valid || 0) === 0}
                  onClick={onExecute}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/40 bg-emerald-600/20 text-emerald-200 disabled:opacity-50"
                >
                  {busy ? 'Importing…' : 'Import employees'}
                </button>
                <button
                  type="button"
                  onClick={() => setImportStep('map')}
                  className="px-3 py-1.5 text-xs text-gray-400"
                >
                  Back to mapping
                </button>
              </div>
            </div>
          )}

          {importStep === 'done' && job && (
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-2">
              <p className="text-sm text-emerald-200">Import finished</p>
              <p className="text-xs text-gray-400">
                Created {job.result?.created ?? 0}, updated {job.result?.updated ?? 0}, skipped{' '}
                {job.result?.skipped ?? 0}, failed {job.result?.failed ?? 0}
              </p>
              <button
                type="button"
                onClick={() => {
                  setImportStep('upload');
                  setJob(null);
                  setTab('roster');
                }}
                className="text-xs text-blue-400"
              >
                View roster
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
