'use client';

import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import InsightsModuleNav from '@/components/insights/InsightsModuleNav';
import InsightThresholdsForm from '@/components/insights/InsightThresholdsForm';
import { canWrite } from '@/lib/permissions';
import {
  UpgradePrompt,
  canAccessFeature,
  fetchOrgSubscription,
  getStoredSubscription,
} from '@/lib/subscriptionUtils';
import {
  api,
  fetchInsightConfig,
  updateInsightConfig,
  type InsightOrgConfig,
} from '@/lib/insights';

export default function InsightThresholdsPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [config, setConfig] = useState<InsightOrgConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasAccess = canAccessFeature(tier, 'insights') && !isExpired;
  const canEdit = canWrite('insights');

  useEffect(() => {
    fetchOrgSubscription(api).then((sub) => {
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await fetchInsightConfig();
      setConfig(cfg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    load();
  }, [hasAccess, load]);

  const handleSave = async () => {
    if (!config || !canEdit) return;
    setSaving(true);
    try {
      const saved = await updateInsightConfig(config);
      setConfig(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <UpgradePrompt feature="Insights" />
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 py-5 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Thresholds</h1>
        <p className="text-sm text-gray-500 mt-0.5">Organization-wide values that power built-in insight rules</p>
      </div>

      <InsightsModuleNav />

      {error && <div className="text-sm text-red-300">{error}</div>}

      {loading || !config ? (
        <LoadingSpinner message="Loading thresholds…" />
      ) : (
        <InsightThresholdsForm
          config={config}
          onChange={(patch) => setConfig((c) => (c ? { ...c, ...patch, thresholds: patch.thresholds ?? c.thresholds, notifications: patch.notifications ?? c.notifications } : c))}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {!canEdit && (
        <p className="text-xs text-gray-600">You have read-only access. Contact an admin to change thresholds.</p>
      )}
    </div>
  );
}
