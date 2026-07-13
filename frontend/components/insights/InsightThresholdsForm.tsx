'use client';

import type { InsightThresholds, InsightOrgConfig } from '@/lib/insights';
import { THRESHOLD_FIELDS } from '@/lib/insights';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';

export default function InsightThresholdsForm({
  config,
  onChange,
  onSave,
  saving,
}: {
  config: InsightOrgConfig;
  onChange: (patch: Partial<InsightOrgConfig>) => void;
  onSave: () => void;
  saving?: boolean;
}) {
  const setThreshold = (key: string, value: string) => {
    const num = Number(value);
    onChange({
      thresholds: {
        ...config.thresholds,
        [key]: Number.isNaN(num) ? 0 : num,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Organization thresholds</h2>
        <p className="text-xs text-gray-500">
          These values feed built-in insight rules. Rules with linked thresholds update automatically when you save.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {THRESHOLD_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
              {field.label}
            </label>
            <input
              type="number"
              className={inputClass}
              value={config.thresholds[field.key] ?? ''}
              onChange={(e) => setThreshold(field.key, e.target.value)}
            />
            {field.hint ? <p className="text-[10px] text-gray-600 mt-0.5">{field.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Dashboard notifications</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={config.notifications.showOnDashboard}
              onChange={(e) =>
                onChange({ notifications: { ...config.notifications, showOnDashboard: e.target.checked } })
              }
              className="rounded border-gray-600"
            />
            Show insights on Insights dashboard
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={config.notifications.showInApp}
              onChange={(e) =>
                onChange({ notifications: { ...config.notifications, showInApp: e.target.checked } })
              }
              className="rounded border-gray-600"
            />
            Enable in-app notifications (future)
          </label>
          <div className="max-w-[200px]">
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Max dashboard items</label>
            <input
              type="number"
              className={inputClass}
              value={config.notifications.maxDashboardItems}
              onChange={(e) =>
                onChange({
                  notifications: {
                    ...config.notifications,
                    maxDashboardItems: Number(e.target.value) || 20,
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save thresholds'}
      </button>
    </div>
  );
}
