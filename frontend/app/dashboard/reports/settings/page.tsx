'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fetchReportSettings, updateReportSettings } from '@/lib/reportStudio';
import { canWrite } from '@/lib/permissions';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';
const inputClass = 'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

export default function ReportSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const canEdit = canWrite('reports');

  useEffect(() => {
    fetchReportSettings()
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading settings…" />;
  if (!settings) {
    return <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error || 'No settings'}</div>;
  }

  const branding = (settings.branding as Record<string, string>) || {};

  const setField = (key: string, value: unknown) => setSettings((s) => ({ ...(s || {}), [key]: value }));

  return (
    <div className="max-w-2xl space-y-4">
      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>}
      {saved && <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-3 text-sm text-emerald-300">{saved}</div>}

      <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-4 space-y-3">
        <div>
          <label className={labelClass}>Default export format</label>
          <select
            className={inputClass}
            disabled={!canEdit}
            value={String(settings.defaultExportFormat || 'csv')}
            onChange={(e) => setField('defaultExportFormat', e.target.value)}
          >
            {['csv', 'json', 'pdf', 'xlsx', 'docx'].map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Timezone</label>
          <input
            className={inputClass}
            disabled={!canEdit}
            value={String(settings.timezone || '')}
            onChange={(e) => setField('timezone', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input
            className={inputClass}
            disabled={!canEdit}
            value={String(settings.currency || '')}
            onChange={(e) => setField('currency', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Default filename format</label>
          <input
            className={inputClass}
            disabled={!canEdit}
            value={String(settings.defaultFilenameFormat || '')}
            onChange={(e) => setField('defaultFilenameFormat', e.target.value)}
            placeholder="{reportName}_{date}"
          />
        </div>
        <div>
          <label className={labelClass}>Retention (days)</label>
          <input
            type="number"
            className={inputClass}
            disabled={!canEdit}
            value={Number(settings.retentionDays || 90)}
            onChange={(e) => setField('retentionDays', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Branding</p>
        <div>
          <label className={labelClass}>Company name</label>
          <input
            className={inputClass}
            disabled={!canEdit}
            value={branding.companyName || ''}
            onChange={(e) => setField('branding', { ...branding, companyName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Logo URL</label>
          <input
            className={inputClass}
            disabled={!canEdit}
            value={branding.logoUrl || ''}
            onChange={(e) => setField('branding', { ...branding, logoUrl: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Primary color</label>
          <input
            className={inputClass}
            disabled={!canEdit}
            value={branding.primaryColor || '#f59e0b'}
            onChange={(e) => setField('branding', { ...branding, primaryColor: e.target.value })}
          />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Report access follows the existing Reports tab permissions (read / write). Custom roles are managed under Users &amp; Roles.
      </p>

      {canEdit && (
        <button
          type="button"
          disabled={saving}
          className={`${buttonClass} border-amber-500/40 bg-amber-500/10 text-amber-300`}
          onClick={async () => {
            setSaving(true);
            setSaved('');
            setError('');
            try {
              const updated = await updateReportSettings({
                defaultExportFormat: settings.defaultExportFormat,
                timezone: settings.timezone,
                currency: settings.currency,
                defaultFilenameFormat: settings.defaultFilenameFormat,
                retentionDays: settings.retentionDays,
                branding: settings.branding,
              });
              setSettings(updated);
              setSaved('Settings saved');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Save failed');
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      )}
    </div>
  );
}
