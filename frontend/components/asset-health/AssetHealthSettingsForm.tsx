'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchHealthConfig,
  previewHealthScore,
  updateHealthConfig,
  factorLabel,
  getAllFactorKeys,
  isCustomFactor,
  CUSTOM_FACTOR_SOURCES,
  DEFAULT_CUSTOM_FACTOR_BANDS,
  type HealthOrgConfig,
  type HealthFactorSource,
} from '@/lib/assetHealth';
import AssetHealthThresholdsEditor, {
  type HealthThresholds,
  type CustomFactorMeta,
} from './AssetHealthThresholdsEditor';
import AssetHealthProfilesPanel from './AssetHealthProfilesPanel';

const inputClass = 'w-full px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-900/60 text-gray-200';
const buttonClass = 'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors';

function slugifyKey(label: string) {
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return `custom_${base || 'factor'}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function AssetHealthSettingsForm({
  groups = [],
}: {
  groups?: { _id: string; name: string }[];
}) {
  const [config, setConfig] = useState<HealthOrgConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [newFactorName, setNewFactorName] = useState('');
  const [newFactorSource, setNewFactorSource] = useState<HealthFactorSource>(CUSTOM_FACTOR_SOURCES[0].key);

  const load = async () => {
    setLoading(true);
    try {
      const c = await fetchHealthConfig();
      setConfig(c);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const factorKeys = useMemo(() => (config ? getAllFactorKeys(config.factors) : []), [config]);

  const customFactorMeta: CustomFactorMeta[] = useMemo(() => {
    if (!config) return [];
    return factorKeys
      .filter((k) => isCustomFactor(config.factors[k]))
      .map((k) => {
        const def = config.factors[k];
        const source = CUSTOM_FACTOR_SOURCES.find((s) => s.key === def.source);
        return { key: k, label: def.label || 'Custom factor', unit: source?.unit || '' };
      });
  }, [config, factorKeys]);

  const totalWeight = config
    ? factorKeys
        .filter((k) => config.factors[k]?.enabled)
        .reduce((s, k) => s + (config.factors[k]?.weight || 0), 0)
    : 0;

  const toggleFactor = (key: string) => {
    if (!config) return;
    setConfig({
      ...config,
      factors: {
        ...config.factors,
        [key]: { ...config.factors[key], enabled: !config.factors[key]?.enabled },
      },
    });
  };

  const setWeight = (key: string, weight: number) => {
    if (!config) return;
    setConfig({
      ...config,
      factors: {
        ...config.factors,
        [key]: { ...config.factors[key], weight: Math.max(0, Math.min(100, weight)) },
      },
    });
  };

  const setCustomLabel = (key: string, label: string) => {
    if (!config) return;
    setConfig({
      ...config,
      factors: { ...config.factors, [key]: { ...config.factors[key], label } },
    });
  };

  const setCustomSource = (key: string, source: HealthFactorSource) => {
    if (!config) return;
    setConfig({
      ...config,
      factors: { ...config.factors, [key]: { ...config.factors[key], source } },
    });
  };

  const addCustomFactor = () => {
    if (!config) return;
    const label = newFactorName.trim();
    if (!label) {
      setMessage('Enter a name for the custom factor');
      return;
    }
    const key = slugifyKey(label);
    setConfig({
      ...config,
      factors: {
        ...config.factors,
        [key]: { enabled: true, weight: 0, custom: true, label, source: newFactorSource },
      },
      thresholds: {
        ...(config.thresholds as HealthThresholds),
        [key]: DEFAULT_CUSTOM_FACTOR_BANDS.map((b) => ({ ...b })),
      } as unknown as Record<string, unknown>,
    });
    setNewFactorName('');
    setMessage('Custom factor added — set its weight (total must be 100%) and thresholds below.');
  };

  const removeCustomFactor = (key: string) => {
    if (!config) return;
    const factors = { ...config.factors };
    delete factors[key];
    const thresholds = { ...(config.thresholds as Record<string, unknown>) };
    delete thresholds[key];
    setConfig({ ...config, factors, thresholds });
  };

  const toggleRule = (ruleKey: string) => {
    if (!config) return;
    setConfig({
      ...config,
      automationRules: config.automationRules.map((r) =>
        r.ruleKey === ruleKey ? { ...r, enabled: !r.enabled } : r
      ),
    });
  };

  const handleSave = async () => {
    if (!config) return;
    if (totalWeight !== 100) {
      setMessage(`Weights must total 100% (currently ${totalWeight}%)`);
      return;
    }
    const emptyCustom = customFactorMeta.find((c) => {
      const bands = (config.thresholds as HealthThresholds)[c.key];
      return !Array.isArray(bands) || bands.length === 0;
    });
    if (emptyCustom) {
      setMessage(`Add at least one score range for "${emptyCustom.label}"`);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const saved = await updateHealthConfig({
        factors: config.factors,
        thresholds: config.thresholds,
        healthLevels: config.healthLevels,
        automationRules: config.automationRules,
        autoUpdateCondition: config.autoUpdateCondition,
        defaultNewAssetCondition: config.defaultNewAssetCondition,
      });
      setConfig(saved);
      setMessage('Settings saved');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!config) return;
    try {
      const result = await previewHealthScore({
        factors: config.factors,
        thresholds: config.thresholds,
        healthLevels: config.healthLevels,
        sampleAsset: {
          ageYears: 4,
          condition: 'good',
          openIssueCount: 2,
          issueCount: 3,
          maintenanceCount: 1,
          warrantyExpiry: new Date(Date.now() + 45 * 86400000).toISOString(),
          daysSinceLastAudit: 60,
          status: 'in_use',
        },
      });
      setPreview(result as Record<string, unknown>);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Preview failed');
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading settings…</p>;
  if (!config) return <p className="text-sm text-red-400">{message || 'Config unavailable'}</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-100">Health Score Factors</h2>
        <p className="text-xs text-gray-500">Enable factors and set weights (enabled weights must total 100%).</p>
        <div className="space-y-2">
          {factorKeys.map((key) => {
            const f = config.factors[key] || { enabled: true, weight: 0 };
            const custom = isCustomFactor(f);
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 py-1">
                <label className="flex items-center gap-2 text-sm text-gray-300 min-w-[150px]">
                  <input type="checkbox" checked={f.enabled !== false} onChange={() => toggleFactor(key)} />
                  {custom ? (
                    <input
                      type="text"
                      value={f.label || ''}
                      onChange={(e) => setCustomLabel(key, e.target.value)}
                      className={`${inputClass} w-32`}
                    />
                  ) : (
                    factorLabel(key, config.factors)
                  )}
                </label>
                {custom && (
                  <select
                    value={f.source}
                    onChange={(e) => setCustomSource(key, e.target.value as HealthFactorSource)}
                    className={`${inputClass} w-44`}
                    title="Metric this factor is scored from"
                  >
                    {CUSTOM_FACTOR_SOURCES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                )}
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={f.enabled === false}
                  value={f.weight || 0}
                  onChange={(e) => setWeight(key, Number(e.target.value))}
                  className={`${inputClass} w-20`}
                />
                <span className="text-xs text-gray-500">%</span>
                {custom && (
                  <button
                    type="button"
                    onClick={() => removeCustomFactor(key)}
                    className={`${buttonClass} border-red-900/50 text-red-400 ml-auto`}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className={`text-xs ${totalWeight === 100 ? 'text-green-500' : 'text-amber-400'}`}>
          Total: {totalWeight}% {totalWeight !== 100 && '(must be 100%)'}
        </p>

        <div className="border-t border-gray-700/40 pt-3 space-y-2">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Add custom factor</h3>
          <p className="text-xs text-gray-500">
            Create your own factor and score it from an asset metric — thresholds are configured below.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Factor name</label>
              <input
                className={inputClass}
                placeholder="e.g. Usage intensity"
                value={newFactorName}
                onChange={(e) => setNewFactorName(e.target.value)}
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block text-[10px] text-gray-500 mb-0.5">Scored from</label>
              <select
                className={inputClass}
                value={newFactorSource}
                onChange={(e) => setNewFactorSource(e.target.value as HealthFactorSource)}
              >
                {CUSTOM_FACTOR_SOURCES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={addCustomFactor} className={`${buttonClass} border-violet-500/40 text-violet-300 hover:bg-violet-500/10`}>
              + Add factor
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-100">Factor Thresholds</h2>
        <p className="text-xs text-gray-500">
          Configure score bands for each factor. Changes apply on the next health calculation.
        </p>
        <AssetHealthThresholdsEditor
          thresholds={(config.thresholds || {}) as HealthThresholds}
          healthLevels={config.healthLevels || []}
          customFactors={customFactorMeta}
          onThresholdsChange={(thresholds) => setConfig({ ...config, thresholds: thresholds as unknown as Record<string, unknown> })}
          onHealthLevelsChange={(healthLevels) => setConfig({ ...config, healthLevels })}
        />
      </section>

      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-100">New Asset Defaults</h2>
        <select
          className={inputClass}
          value={config.defaultNewAssetCondition}
          onChange={(e) => setConfig({ ...config, defaultNewAssetCondition: e.target.value as 'excellent' | 'good' })}
        >
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={config.autoUpdateCondition}
            onChange={(e) => setConfig({ ...config, autoUpdateCondition: e.target.checked })}
          />
          Automatically update asset condition from health score
        </label>
      </section>

      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-100">Automation Rules</h2>
        <p className="text-xs text-gray-500">Enable or disable rules that adjust condition and maintenance status.</p>
        <div className="space-y-2">
          {config.automationRules.map((rule) => (
            <label key={String(rule.ruleKey)} className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={rule.enabled !== false}
                onChange={() => toggleRule(String(rule.ruleKey))}
              />
              <span>
                <span className="font-medium">{String(rule.name || '')}</span>
                {Boolean(rule.description) && (
                  <span className="block text-xs text-gray-500">{String(rule.description)}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-100">Score Preview</h2>
        <p className="text-xs text-gray-500">Sample asset: 4 years old, good condition, 2 open issues.</p>
        <button type="button" onClick={handlePreview} className={`${buttonClass} border-gray-600 text-gray-200 hover:bg-gray-800`}>
          Preview score
        </button>
        {preview && (
          <div className="rounded-lg bg-gray-900/60 p-3 text-sm text-gray-200">
            <p className="text-2xl font-bold">
              {String(preview.healthScore ?? '')}{' '}
              <span className="text-base font-normal text-gray-400">{String(preview.healthLabel ?? '')}</span>
            </p>
            {preview.breakdown && typeof preview.breakdown === 'object' ? (
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-400">
                {Object.entries(preview.breakdown as Record<string, { score: number; contribution: number; label?: string }>).map(([k, v]) => (
                  <span key={k}>{v.label || factorLabel(k, config.factors)}: {v.score} (→ {v.contribution})</span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <div className="flex gap-2 items-center">
        <button type="button" onClick={handleSave} disabled={saving} className={`${buttonClass} bg-gray-700 border-gray-600 text-white hover:bg-gray-600 disabled:opacity-50`}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {message && <span className="text-xs text-gray-400">{message}</span>}
      </div>

      <section className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-100">Group Health Profiles</h2>
        <p className="text-xs text-gray-500">
          Override factor weights for specific asset groups. Profiles inherit the factors defined above, including custom ones.
        </p>
        <AssetHealthProfilesPanel groups={groups} />
      </section>
    </div>
  );
}
