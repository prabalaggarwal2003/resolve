'use client';

import { useMemo } from 'react';
import type {
  InsightRule,
  InsightConditionTree,
  InsightConditionGroup,
  InsightCondition,
  InsightCatalog,
  InsightSeverity,
} from '@/lib/insights';
import {
  FRIENDLY_OPERATOR_LABELS,
  SEVERITY_FRIENDLY,
  SEVERITY_STYLES,
  describeRulePlain,
  metricLabel,
} from '@/lib/insights';

const inputClass =
  'w-full min-w-0 px-3 py-2 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200';
const selectClass = inputClass;
const labelClass = 'block text-xs font-medium text-gray-400 mb-1';

const BUILDER_OPERATORS = ['lt', 'lte', 'gt', 'gte', 'eq', 'ne', 'contains', 'empty', 'not_empty'] as const;

const QUICK_TEMPLATES: { label: string; description: string; patch: Partial<InsightRule> }[] = [
  {
    label: 'Low health assets',
    description: 'Flag assets with health score below 50',
    patch: {
      name: 'Low health assets',
      messageTemplate: '{{count}} assets have low health scores',
      severity: 'warning',
      conditionTree: {
        rootLogic: 'and',
        groups: [{ logic: 'and', conditions: [{ metric: 'healthScore', operator: 'lt', value: 50 }] }],
      },
    },
  },
  {
    label: 'High maintenance cost',
    description: 'Assets costing more than ₹20,000 in maintenance',
    patch: {
      name: 'High maintenance cost',
      messageTemplate: '{{count}} assets have high maintenance costs',
      severity: 'warning',
      conditionTree: {
        rootLogic: 'and',
        groups: [{ logic: 'and', conditions: [{ metric: 'maintenanceCost', operator: 'gt', value: 20000 }] }],
      },
    },
  },
  {
    label: 'Old assets',
    description: 'Assets older than 5 years',
    patch: {
      name: 'Aging assets',
      messageTemplate: '{{count}} assets are over 5 years old',
      severity: 'info',
      conditionTree: {
        rootLogic: 'and',
        groups: [{ logic: 'and', conditions: [{ metric: 'ageYears', operator: 'gt', value: 5 }] }],
      },
    },
  },
  {
    label: 'Replacement candidate',
    description: 'Poor health AND old AND many repairs',
    patch: {
      name: 'Consider replacement',
      messageTemplate: '{{count}} assets may need replacement',
      severity: 'warning',
      conditionTree: {
        rootLogic: 'and',
        groups: [{
          logic: 'and',
          conditions: [
            { metric: 'healthScore', operator: 'lt', value: 40 },
            { metric: 'ageYears', operator: 'gt', value: 5 },
            { metric: 'repairCount', operator: 'gt', value: 3 },
          ],
        }],
      },
    },
  },
];

function emptyCondition(): InsightCondition {
  return { metric: 'healthScore', operator: 'lt', value: 50 };
}

function emptyGroup(): InsightConditionGroup {
  return { logic: 'and', conditions: [emptyCondition()] };
}

export function emptyConditionTree(): InsightConditionTree {
  return { rootLogic: 'and', groups: [emptyGroup()] };
}

export default function InsightRuleBuilder({
  catalog,
  rule,
  departments,
  onChange,
  onSave,
  saving,
  title = 'Create a custom insight',
}: {
  catalog: InsightCatalog;
  rule: Partial<InsightRule>;
  departments: { _id: string; name: string }[];
  onChange: (patch: Partial<InsightRule>) => void;
  onSave: () => void;
  saving?: boolean;
  title?: string;
}) {
  const tree = rule.conditionTree || emptyConditionTree();
  const assetMetrics = catalog.metrics.filter((m) => m.scope === 'asset');

  const deptMap = useMemo(
    () => Object.fromEntries(departments.map((d) => [d._id, d.name])),
    [departments]
  );

  const plainPreview = describeRulePlain(rule, catalog, deptMap);

  const updateTree = (next: InsightConditionTree) => onChange({ conditionTree: next });

  const updateGroup = (gi: number, patch: Partial<InsightConditionGroup>) => {
    const groups = tree.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g));
    updateTree({ ...tree, groups });
  };

  const updateCondition = (gi: number, ci: number, patch: Partial<InsightCondition>) => {
    const groups = tree.groups.map((g, i) => {
      if (i !== gi) return g;
      return {
        ...g,
        conditions: g.conditions.map((c, j) => (j === ci ? { ...c, ...patch } : c)),
      };
    });
    updateTree({ ...tree, groups });
  };

  const addCondition = (gi: number) => {
    updateGroup(gi, { conditions: [...tree.groups[gi].conditions, emptyCondition()] });
  };

  const removeCondition = (gi: number, ci: number) => {
    const conditions = tree.groups[gi].conditions.filter((_, j) => j !== ci);
    if (!conditions.length) return;
    updateGroup(gi, { conditions });
  };

  const addGroup = () => updateTree({ ...tree, groups: [...tree.groups, emptyGroup()] });

  const removeGroup = (gi: number) => {
    if (tree.groups.length <= 1) return;
    updateTree({ ...tree, groups: tree.groups.filter((_, i) => i !== gi) });
  };

  const applyTemplate = (patch: Partial<InsightRule>) => {
    onChange({
      ...rule,
      ...patch,
      conditionTree: patch.conditionTree || rule.conditionTree,
    });
  };

  const renderValueInput = (cond: InsightCondition, gi: number, ci: number) => {
    const metric = catalog.metrics.find((m) => m.key === cond.metric);
    if (cond.operator === 'empty' || cond.operator === 'not_empty') {
      return <p className="text-xs text-gray-500 py-2">No value needed</p>;
    }
    if (metric?.options) {
      return (
        <select
          className={selectClass}
          value={String(cond.value ?? '')}
          onChange={(e) => updateCondition(gi, ci, { value: e.target.value })}
        >
          <option value="">Choose…</option>
          {metric.options.map((o) => (
            <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
          ))}
        </select>
      );
    }
    if (metric?.ref === 'department') {
      return (
        <select
          className={selectClass}
          value={String(cond.value ?? '')}
          onChange={(e) => updateCondition(gi, ci, { value: e.target.value })}
        >
          <option value="">Choose department…</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
      );
    }
    const isMoney = metric?.type === 'currency';
    const isNumber = metric?.type === 'number' || isMoney;
    return (
      <div className="relative">
        {isMoney && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
        )}
        <input
          type={isNumber ? 'number' : 'text'}
          className={`${inputClass} ${isMoney ? 'pl-7' : ''}`}
          value={cond.value == null ? '' : String(cond.value)}
          onChange={(e) =>
            updateCondition(gi, ci, {
              value: isNumber ? Number(e.target.value) : e.target.value,
            })
          }
          placeholder={isMoney ? '20,000' : isNumber ? '0' : 'Enter value'}
        />
      </div>
    );
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Tell Resolve when to surface an insight — use everyday language, no technical setup required.
        </p>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-blue-500/25 bg-blue-950/20 p-4">
        <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-1">Preview</p>
        <p className="text-sm text-gray-200 leading-relaxed break-words">{plainPreview}</p>
        {rule.messageTemplate && (
          <p className="text-xs text-gray-500 mt-2 break-words">
            Dashboard message: “{rule.messageTemplate.replace(/\{\{count\}\}/g, '3').replace(/\{\{name\}\}/g, rule.name || 'this rule')}”
          </p>
        )}
      </div>

      {/* Quick start */}
      {!rule._id && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">Quick start — pick a template</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => applyTemplate(tpl.patch)}
                className="text-left p-3 rounded-lg border border-gray-700/50 bg-gray-900/30 hover:border-violet-500/40 hover:bg-violet-950/20 transition-colors"
              >
                <p className="text-sm font-medium text-gray-200">{tpl.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Basics */}
      <section className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">1. Name and priority</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className={labelClass}>What should we call this insight?</label>
            <input
              className={inputClass}
              value={rule.name || ''}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Assets needing replacement"
            />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>How important is it?</label>
            <select
              className={selectClass}
              value={rule.severity || 'warning'}
              onChange={(e) => onChange({ severity: e.target.value as InsightSeverity })}
            >
              {catalog.severities.map((s) => (
                <option key={s} value={s}>{SEVERITY_FRIENDLY[s as InsightSeverity] || s}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 min-w-0">
            <label className={labelClass}>Short description (optional)</label>
            <input
              className={inputClass}
              value={rule.description || ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Helps your team understand why this insight exists"
            />
          </div>
        </div>
      </section>

      {/* Step 2: Conditions */}
      <section className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">2. When should we show this?</h3>
          <p className="text-xs text-gray-500 mt-1">
            Add one or more checks. Use “all of these” when every check must pass, or “any of these” when just one is enough.
          </p>
        </div>

        {tree.groups.length > 1 && (
          <div className="min-w-0">
            <label className={labelClass}>Across multiple scenarios</label>
            <select
              className={selectClass}
              value={tree.rootLogic}
              onChange={(e) => updateTree({ ...tree, rootLogic: e.target.value as 'and' | 'or' })}
            >
              <option value="and">All scenarios must match</option>
              <option value="or">Any one scenario is enough</option>
            </select>
          </div>
        )}

        {tree.groups.map((group, gi) => (
          <div key={gi} className="rounded-lg border border-gray-700/50 bg-gray-900/50 p-3 space-y-3 min-w-0">
            {tree.groups.length > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-violet-300">Scenario {gi + 1}</span>
                <button type="button" onClick={() => removeGroup(gi)} className="text-xs text-red-400">
                  Remove scenario
                </button>
              </div>
            )}

            {group.conditions.length > 1 && (
              <div className="min-w-0">
                <label className={labelClass}>Within this scenario</label>
                <select
                  className={selectClass}
                  value={group.logic}
                  onChange={(e) => updateGroup(gi, { logic: e.target.value as 'and' | 'or' })}
                >
                  <option value="and">All of these must be true</option>
                  <option value="or">Any one of these is enough</option>
                </select>
              </div>
            )}

            {group.conditions.map((cond, ci) => (
              <div key={ci} className="space-y-2">
                {ci > 0 && (
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {group.logic === 'or' ? 'Or' : 'And also'}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end min-w-0">
                  <div className="min-w-0">
                    <label className={labelClass}>{ci === 0 ? 'Check' : 'Next check'}</label>
                    <select
                      className={selectClass}
                      value={cond.metric}
                      onChange={(e) => updateCondition(gi, ci, { metric: e.target.value, value: '' })}
                    >
                      {assetMetrics.map((m) => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 sm:pb-0.5">
                    <label className={`${labelClass} sm:sr-only`}>Comparison</label>
                    <select
                      className={selectClass}
                      value={cond.operator}
                      onChange={(e) => updateCondition(gi, ci, { operator: e.target.value })}
                    >
                      {BUILDER_OPERATORS.map((op) => (
                        <option key={op} value={op}>{FRIENDLY_OPERATOR_LABELS[op]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className={labelClass}>Value</label>
                    {renderValueInput(cond, gi, ci)}
                  </div>
                  {group.conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCondition(gi, ci)}
                      className="text-xs text-gray-500 hover:text-red-400 py-2 sm:pb-2"
                      title="Remove this check"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-600 break-words pl-0.5">
                  → {metricLabel(catalog, cond.metric)}{' '}
                  {FRIENDLY_OPERATOR_LABELS[cond.operator]}{' '}
                  {cond.operator !== 'empty' && cond.operator !== 'not_empty'
                    ? (cond.metric === 'departmentId' ? deptMap[String(cond.value)] : cond.value)
                    : ''}
                </p>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addCondition(gi)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              + Add another check
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addGroup}
          className="text-xs text-violet-300 hover:text-violet-200"
        >
          + Add another scenario (use OR logic between scenarios)
        </button>
      </section>

      {/* Step 3: Message */}
      <section className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">3. What should the dashboard say?</h3>
        <div className="min-w-0">
          <label className={labelClass}>Alert message</label>
          <input
            className={inputClass}
            value={rule.messageTemplate || ''}
            onChange={(e) => onChange({ messageTemplate: e.target.value })}
            placeholder="{{count}} assets need your attention"
          />
          <p className="text-[11px] text-gray-600 mt-1">
            Use <code className="text-gray-500">{'{{count}}'}</code> for the number of matching items and{' '}
            <code className="text-gray-500">{'{{name}}'}</code> for this insight&apos;s name.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3">
          <p className="text-xs text-emerald-300 font-medium">Then → show on Insights dashboard</p>
          <p className="text-xs text-gray-500 mt-1">
            Priority: <span className={SEVERITY_STYLES[rule.severity || 'warning']?.text}>
              {SEVERITY_FRIENDLY[rule.severity || 'warning']}
            </span>
          </p>
        </div>
      </section>

      <button
        type="button"
        onClick={onSave}
        disabled={saving || !rule.name?.trim()}
        className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : rule._id ? 'Save changes' : 'Create insight'}
      </button>
    </div>
  );
}
