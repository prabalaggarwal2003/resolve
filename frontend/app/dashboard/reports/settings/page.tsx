'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fetchReportSettings, updateReportSettings } from '@/lib/reportStudio';
import { canWrite } from '@/lib/permissions';

const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';
const inputClass = 'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

type Formatting = {
  header?: string;
  footer?: string;
  watermark?: string;
  orientation?: string;
  paperSize?: string;
};

type Branding = {
  companyName?: string;
  logoData?: string;
};

const EMPTY_FORMATTING: Formatting = {
  header: '',
  footer: '',
  watermark: '',
  orientation: 'landscape',
  paperSize: 'a4',
};

export default function ReportSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const canEdit = canWrite('reports');

  useEffect(() => {
    fetchReportSettings()
      .then((reportSettings) => setSettings(reportSettings))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading settings…" />;
  if (!settings) {
    return <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error || 'No settings'}</div>;
  }

  const branding = (settings.branding as Branding) || {};
  const formatting = {
    ...EMPTY_FORMATTING,
    ...((settings.defaultFormatting as Formatting) || {}),
  };

  const setField = (key: string, value: unknown) => setSettings((s) => ({ ...(s || {}), [key]: value }));

  const setFormatting = (key: keyof Formatting, value: string) => {
    setField('defaultFormatting', { ...formatting, [key]: value });
  };

  const onLogoFile = (file: File | null) => {
    if (!file) {
      setField('branding', { ...branding, logoData: '' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG or JPEG).');
      return;
    }
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setError('Use PNG or JPEG for the report logo (required for PDF export).');
      return;
    }
    if (file.size > 500_000) {
      setError('Logo must be under 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError('');
      setField('branding', { ...branding, logoData: String(reader.result || '') });
    };
    reader.onerror = () => setError('Failed to read logo file');
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-2xl space-y-4">
      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>}
      {saved && <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-3 text-sm text-emerald-300">{saved}</div>}

      <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Default report formatting</p>
        <p className="text-[11px] text-gray-500">
          Applied when generating new reports. Override any of these in the builder Formatting step for a specific report.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Header</label>
            <input
              className={inputClass}
              disabled={!canEdit}
              value={formatting.header || ''}
              onChange={(e) => setFormatting('header', e.target.value)}
              placeholder="Report header text"
            />
          </div>
          <div>
            <label className={labelClass}>Footer</label>
            <input
              className={inputClass}
              disabled={!canEdit}
              value={formatting.footer || ''}
              onChange={(e) => setFormatting('footer', e.target.value)}
              placeholder="Report footer text"
            />
          </div>
          <div>
            <label className={labelClass}>Watermark</label>
            <input
              className={inputClass}
              disabled={!canEdit}
              value={formatting.watermark || ''}
              onChange={(e) => setFormatting('watermark', e.target.value)}
              placeholder="Optional watermark"
            />
          </div>
          <div>
            <label className={labelClass}>Orientation</label>
            <select
              className={inputClass}
              disabled={!canEdit}
              value={formatting.orientation || 'landscape'}
              onChange={(e) => setFormatting('orientation', e.target.value)}
            >
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Paper size</label>
            <select
              className={inputClass}
              disabled={!canEdit}
              value={formatting.paperSize || 'a4'}
              onChange={(e) => setFormatting('paperSize', e.target.value)}
            >
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
              <option value="a3">A3</option>
            </select>
          </div>
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
          <label className={labelClass}>Report logo</label>
          {branding.logoData ? (
            <div className="mb-2 flex items-center gap-3">
              {/* Logo preview */}
              <img src={branding.logoData} alt="Report logo" className="h-10 max-w-[140px] object-contain rounded border border-gray-700/60 bg-gray-900/50 p-1" />
              {canEdit && (
                <button
                  type="button"
                  className={`${buttonClass} border-gray-600 text-gray-300`}
                  onClick={() => setField('branding', { ...branding, logoData: '' })}
                >
                  Remove
                </button>
              )}
            </div>
          ) : null}
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={!canEdit}
            className="block w-full text-xs text-gray-400 file:mr-3 file:rounded-lg file:border file:border-gray-600 file:bg-gray-800 file:px-2.5 file:py-1.5 file:text-xs file:text-gray-200"
            onChange={(e) => onLogoFile(e.target.files?.[0] || null)}
          />
          <p className="text-[10px] text-gray-500 mt-1">PNG or JPEG · max 500KB. Shown on PDF exports.</p>
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
                defaultFilenameFormat: settings.defaultFilenameFormat,
                defaultFormatting: formatting,
                branding: {
                  companyName: branding.companyName || '',
                  logoData: branding.logoData || '',
                },
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
