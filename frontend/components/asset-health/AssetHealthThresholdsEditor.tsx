'use client';

import { useState } from 'react';

export type RangeThreshold = { min: number; max: number | null; score: number };
export type MapThreshold = Record<string, number>;

export type HealthThresholds = {
  age?: RangeThreshold[];
  condition?: MapThreshold;
  issues?: RangeThreshold[];
  maintenance?: RangeThreshold[];
  warranty?: MapThreshold;
  audit?: RangeThreshold[];
  downtime?: MapThreshold;
  [key: string]: RangeThreshold[] | MapThreshold | undefined;
};

export type CustomFactorMeta = { key: string; label: string; unit: string };

const inputClass = 'px-2 py-1 text-xs border border-gray-700/60 rounded-lg bg-gray-900/60 text-gray-200';
const buttonClass = 'px-2 py-1 text-xs font-medium rounded-lg border transition-colors';

const RANGE_FACTOR_META: Record<string, { label: string; unit: string; minLabel: string; maxLabel: string }> = {
  age: { label: 'Age', unit: 'years', minLabel: 'From (years)', maxLabel: 'To (years)' },
  issues: { label: 'Open Issues', unit: 'issues', minLabel: 'Min issues', maxLabel: 'Max issues' },
  maintenance: { label: 'Maintenance History', unit: 'events', minLabel: 'Min events', maxLabel: 'Max events' },
  audit: { label: 'Audit Status', unit: 'days', minLabel: 'Min days since audit', maxLabel: 'Max days since audit' },
};

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
  under_maintenance: 'Under maintenance',
};

const WARRANTY_LABELS: Record<string, string> = {
  active: 'Active warranty',
  expiresIn30Days: 'Expires within 30 days',
  expired: 'Expired',
  expiredOver1Year: 'Expired over 1 year',
  none: 'No warranty date',
};

const DOWNTIME_LABELS: Record<string, string> = {
  available: 'Available',
  in_use: 'In use',
  working: 'Working',
  under_maintenance: 'Under maintenance',
  needs_repair: 'Needs repair',
  out_of_service: 'Out of service',
  retired: 'Retired',
};

function RangeThresholdEditor({
  factorKey,
  bands,
  onChange,
  metaOverride,
}: {
  factorKey: string;
  bands: RangeThreshold[];
  onChange: (bands: RangeThreshold[]) => void;
  metaOverride?: { label: string; unit: string; minLabel: string; maxLabel: string };
}) {
  const meta = metaOverride
    || RANGE_FACTOR_META[factorKey]
    || { label: factorKey, unit: '', minLabel: 'From', maxLabel: 'To' };
  const updateBand = (index: number, patch: Partial<RangeThreshold>) => {
    onChange(bands.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const addBand = () => {
    const last = bands[bands.length - 1];
    const nextMin = last?.max != null ? last.max : (last?.min ?? 0) + 1;
    onChange([...bands, { min: nextMin, max: null, score: 50 }]);
  };

  const removeBand = (index: number) => {
    if (bands.length <= 1) return;
    onChange(bands.filter((_, i) => i !== index));
  };

  const formatRange = (band: RangeThreshold) => {
    const maxLabel = band.max == null ? '+' : `–${band.max}`;
    return `${band.min}${maxLabel} ${meta.unit}`;
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Set score for each range. Leave &quot;To&quot; empty for the highest band (e.g. 10+ years).
      </p>
      <div className="space-y-2">
        {bands.map((band, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-700/40 bg-gray-900/30 p-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">{meta.minLabel}</label>
              <input
                type="number"
                min={0}
                value={band.min}
                onChange={(e) => updateBand(index, { min: Number(e.target.value) })}
                className={`${inputClass} w-20`}
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">{meta.maxLabel}</label>
              <input
                type="number"
                min={0}
                placeholder="∞"
                value={band.max ?? ''}
                onChange={(e) => updateBand(index, { max: e.target.value === '' ? null : Number(e.target.value) })}
                className={`${inputClass} w-20`}
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Score (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={band.score}
                onChange={(e) => updateBand(index, { score: Number(e.target.value) })}
                className={`${inputClass} w-20`}
              />
            </div>
            <span className="text-[10px] text-gray-600 pb-1 hidden sm:inline">{formatRange(band)}</span>
            <button
              type="button"
              onClick={() => removeBand(index)}
              disabled={bands.length <= 1}
              className={`${buttonClass} border-red-900/40 text-red-400 disabled:opacity-30 ml-auto`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addBand} className={`${buttonClass} border-gray-600 text-gray-300 hover:bg-gray-800`}>
        + Add range
      </button>
    </div>
  );
}

function MapThresholdEditor({
  labels,
  values,
  onChange,
}: {
  labels: Record<string, string>;
  values: MapThreshold;
  onChange: (values: MapThreshold) => void;
}) {
  return (
    <div className="space-y-2">
      {Object.entries(labels).map(([key, label]) => (
        <div key={key} className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-300 min-w-[160px]">{label}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={values[key] ?? 0}
            onChange={(e) => onChange({ ...values, [key]: Number(e.target.value) })}
            className={`${inputClass} w-20`}
          />
          <span className="text-xs text-gray-500">score</span>
        </div>
      ))}
    </div>
  );
}

export type HealthLevelBand = { min: number; max: number; label: string; key: string; emoji: string };

function HealthLevelsEditor({
  levels,
  onChange,
}: {
  levels: HealthLevelBand[];
  onChange: (levels: HealthLevelBand[]) => void;
}) {
  const update = (index: number, patch: Partial<HealthLevelBand>) => {
    onChange(levels.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Map overall health score (0–100) to labels shown on dashboards.</p>
      {levels.map((level, index) => (
        <div key={level.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-700/40 bg-gray-900/30 p-2">
          <span className="text-lg">{level.emoji}</span>
          <input
            type="text"
            value={level.label}
            onChange={(e) => update(index, { label: e.target.value })}
            className={`${inputClass} w-28`}
          />
          <input
            type="number"
            min={0}
            max={100}
            value={level.min}
            onChange={(e) => update(index, { min: Number(e.target.value) })}
            className={`${inputClass} w-16`}
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="number"
            min={0}
            max={100}
            value={level.max}
            onChange={(e) => update(index, { max: Number(e.target.value) })}
            className={`${inputClass} w-16`}
          />
        </div>
      ))}
    </div>
  );
}

export default function AssetHealthThresholdsEditor({
  thresholds,
  healthLevels,
  customFactors = [],
  onThresholdsChange,
  onHealthLevelsChange,
}: {
  thresholds: HealthThresholds;
  healthLevels: HealthLevelBand[];
  customFactors?: CustomFactorMeta[];
  onThresholdsChange: (thresholds: HealthThresholds) => void;
  onHealthLevelsChange: (levels: HealthLevelBand[]) => void;
}) {
  const [openFactor, setOpenFactor] = useState<string | null>('age');

  const setRange = (key: string, bands: RangeThreshold[]) => {
    onThresholdsChange({ ...thresholds, [key]: bands });
  };

  const setMap = (key: string, map: MapThreshold) => {
    onThresholdsChange({ ...thresholds, [key]: map });
  };

  const factors: Array<{ key: string; type: 'range' | 'map'; custom?: CustomFactorMeta }> = [
    { key: 'age', type: 'range' },
    { key: 'condition', type: 'map' },
    { key: 'issues', type: 'range' },
    { key: 'maintenance', type: 'range' },
    { key: 'warranty', type: 'map' },
    { key: 'audit', type: 'range' },
    { key: 'downtime', type: 'map' },
    ...customFactors.map((c) => ({ key: c.key, type: 'range' as const, custom: c })),
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {factors.map(({ key, type, custom }) => {
          const isOpen = openFactor === key;
          const label = custom?.label
            || RANGE_FACTOR_META[key]?.label
            || (key === 'condition' ? 'Condition' : key === 'warranty' ? 'Warranty' : 'Downtime');
          return (
            <div key={key} className="rounded-lg border border-gray-700/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFactor(isOpen ? null : key)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-gray-200 bg-gray-900/40 hover:bg-gray-900/60"
              >
                <span>{label}{custom && <span className="ml-2 text-[10px] text-violet-300/80 uppercase tracking-wide">Custom</span>}</span>
                <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="p-3 border-t border-gray-700/40">
                  {type === 'range' && (
                    <RangeThresholdEditor
                      factorKey={key}
                      bands={(thresholds[key] as RangeThreshold[]) || []}
                      onChange={(bands) => setRange(key, bands)}
                      metaOverride={custom ? { label: custom.label, unit: custom.unit, minLabel: `From (${custom.unit})`, maxLabel: `To (${custom.unit})` } : undefined}
                    />
                  )}
                  {key === 'condition' && (
                    <MapThresholdEditor
                      labels={CONDITION_LABELS}
                      values={thresholds.condition || {}}
                      onChange={(map) => setMap('condition', map)}
                    />
                  )}
                  {key === 'warranty' && (
                    <MapThresholdEditor
                      labels={WARRANTY_LABELS}
                      values={thresholds.warranty || {}}
                      onChange={(map) => setMap('warranty', map)}
                    />
                  )}
                  {key === 'downtime' && (
                    <MapThresholdEditor
                      labels={DOWNTIME_LABELS}
                      values={thresholds.downtime || {}}
                      onChange={(map) => setMap('downtime', map)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-100">Health Level Bands</h3>
        <HealthLevelsEditor levels={healthLevels} onChange={onHealthLevelsChange} />
      </div>
    </div>
  );
}
