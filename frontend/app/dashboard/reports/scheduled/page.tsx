'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  createSchedule,
  deleteSchedule,
  fetchDefinitions,
  fetchSchedules,
  updateSchedule,
} from '@/lib/reportStudio';
import { canWrite } from '@/lib/permissions';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';
const inputClass = 'px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';

export default function ScheduledReportsPage() {
  const [schedules, setSchedules] = useState<Record<string, unknown>[]>([]);
  const [reports, setReports] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportId, setReportId] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const canEdit = canWrite('reports');

  const load = async () => {
    try {
      const [s, d] = await Promise.all([fetchSchedules(), fetchDefinitions('saved')]);
      setSchedules(s.schedules || []);
      setReports((d.definitions || []).map((x) => ({ _id: x._id, name: x.name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingSpinner message="Loading schedules…" />;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>}

      {canEdit && (
        <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3 flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Report</label>
            <select className={inputClass} value={reportId} onChange={(e) => setReportId(e.target.value)}>
              <option value="">Select saved report…</option>
              {reports.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Frequency</label>
            <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <button
            type="button"
            disabled={!reportId}
            className={`${buttonClass} border-amber-500/40 text-amber-300 disabled:opacity-40`}
            onClick={async () => {
              try {
                await createSchedule({
                  reportId,
                  frequency,
                  name: `${reports.find((r) => r._id === reportId)?.name || 'Report'} schedule`,
                  dayOfWeek: 1,
                  exportFormat: 'csv',
                });
                setReportId('');
                load();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create');
              }
            }}
          >
            Add schedule
          </button>
          {reports.length === 0 && (
            <p className="w-full text-xs text-gray-500">
              Save a report first from the{' '}
              <Link href="/dashboard/reports/builder" className="text-amber-300 no-underline">
                builder
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        {schedules.length === 0 && <p className="text-xs text-gray-500">No schedules yet.</p>}
        {schedules.map((s) => {
          const id = String(s._id);
          const report = s.reportId as { name?: string } | undefined;
          return (
            <div key={id} className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3 flex flex-wrap justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-100">{String(s.name)}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {report?.name || 'Report'} · {String(s.frequency)} · {String(s.exportFormat || 'csv').toUpperCase()} ·{' '}
                  {s.enabled ? 'Enabled' : 'Disabled'}
                  {s.lastStatus ? ` · last: ${String(s.lastStatus)}` : ''}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={`${buttonClass} border-gray-700/60 text-gray-300`}
                    onClick={async () => {
                      await updateSchedule(id, { enabled: !s.enabled });
                      load();
                    }}
                  >
                    {s.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    className={`${buttonClass} border-red-500/30 text-red-300`}
                    onClick={async () => {
                      if (!confirm('Delete this schedule?')) return;
                      await deleteSchedule(id);
                      load();
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
