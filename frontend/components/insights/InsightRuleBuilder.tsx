'use client';

import { useMemo, useState } from 'react';
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

const DEFAULT_MESSAGE = '{{count}} items need attention';

const QUICK_TEMPLATES: { label: string; description: string; patch: Partial<InsightRule> }[] = [
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
    label: 'Many repairs',
    description: 'Assets with more than 3 repairs',
    patch: {
      name: 'High repair count',
      messageTemplate: '{{count}} assets have many repairs',
      severity: 'warning',
      conditionTree: {
        rootLogic: 'and',
        groups: [{
          logic: 'and',
          conditions: [
            { metric: 'repairCount', operator: 'gt', value: 3 },
            { metric: 'ageYears', operator: 'gt', value: 5 },
          ],
        }],
      },
    },
  },
];

const RETIRED_HEALTH_METRICS = new Set(['healthScore', 'replacementScore', 'replacementPriority']);

function emptyCondition(): InsightCondition {
  return { metric: 'ageYears', operator: 'gt', value: 5 };
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
  title = 'Add an insight',
}: {
  catalog: InsightCatalog;
  rule: Partial<InsightRule>;
  departments: { _id: string; name: string }[];
  onChange: (patch: Partial<InsightRule>) => void;
  onSave: () => void;
  saving?: boolean;
  title?: string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(
    () => (rule.conditionTree?.groups?.length || 0) > 1
  );
  const tree = rule.conditionTree || emptyConditionTree();
  const scope = rule.ruleType === 'partner' ? 'partner' : rule.ruleType === 'budget' ? 'budget' : 'asset';
  const assetMetrics = catalog.metrics.filter(
    (m) => m.scope === scope && !RETIRED_HEALTH_METRICS.has(m.key)
  );

  const deptMap = useMemo(
    () => Object.fromEntries(departments.map((d) => [d._id, d.name])),
    [departments]
  );

  const plainPreview = describeRulePlain(rule, catalog, deptMap);

  const syncName = (name: string) => {
    const patch: Partial<InsightRule> = { name };
    const msg = rule.messageTemplate || '';
    if (!msg || msg === DEFAULT_MESSAGE || msg.endsWith(' need attention') || msg.includes('{{name}}')) {
      patch.messageTemplate = name.trim()
        ? `{{count}} assets match “${name.trim()}”`
        : DEFAULT_MESSAGE;
    }
    onChange(patch);
  };

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
    <div className="w-full min-w-0 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose a starting point, set your check, and save — that&apos;s it.
        </p>
      </div>

      {!rule._id && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">Start from a template</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => applyTemplate(tpl.patch)}
                className="text-left p-3 rounded-lg border border-gray-700/50 bg-gray-900/30 hover:border-emerald-500/40 hover:bg-emerald-950/15 transition-colors"
              >
                <p className="text-sm font-medium text-gray-200">{tpl.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-blue-500/20 bg-blue-950/15 px-4 py-3">
        <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-0.5">In plain English</p>
        <p className="text-sm text-gray-200 leading-relaxed break-words">{plainPreview}</p>
      </div>

      <section className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">Name &amp; importance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className={labelClass}>Name</label>
            <input
              className={inputClass}
              value={rule.name || ''}
              onChange={(e) => syncName(e.target.value)}
              placeholder="e.g. High maintenance cost"
            />
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Applies to</label>
            <select
              className={selectClass}
              value={rule.ruleType || 'asset'}
              onChange={(e) =>
                onChange({
                  ruleType: e.target.value as InsightRule['ruleType'],
                  link:
                    e.target.value === 'partner'
                      ? '/dashboard/partners/list'
                      : e.target.value === 'budget'
                      ? '/dashboard/budgets'
                      : '/dashboard/assets',
                  conditionTree: {
                    rootLogic: 'and',
                    groups: [
                      {
                        logic: 'and',
                        conditions: [
                          {
                            metric:
                              e.target.value === 'partner'
                                ? 'partnerIsInactive'
                                : e.target.value === 'budget'
                                ? 'utilizationPct'
                                : 'ageYears',
                            operator: e.target.value === 'partner' ? 'eq' : 'gt',
                            value: e.target.value === 'partner' ? true : e.target.value === 'budget' ? 80 : 5,
                          },
                        ],
                      },
                    ],
                  },
                })
              }
            >
              <option value="asset">Assets</option>
              <option value="partner">Business Partners</option>
              <option value="budget">Budgets</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>How urgent?</label>
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
        </div>
      </section>

      <section className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Your check</h3>
          <p className="text-xs text-gray-500 mt-1">
            Alert when a {scope === 'partner' ? 'partner' : scope === 'budget' ? 'budget' : 'asset'} matches this. Add more checks if you need them.
          </p>
        </div>

        {(showAdvanced || tree.groups.length > 1) && tree.groups.length > 1 && (
          <div className="min-w-0">
            <label className={labelClass}>Across scenarios</label>
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

        {tree.groups.map((group, gi) => {
          if (!showAdvanced && tree.groups.length > 1 && gi > 0) return null;
          return (
            <div key={gi} className="rounded-lg border border-gray-700/50 bg-gray-900/50 p-3 space-y-3 min-w-0">
              {(showAdvanced || tree.groups.length > 1) && tree.groups.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-emerald-300">Scenario {gi + 1}</span>
                  <button type="button" onClick={() => removeGroup(gi)} className="text-xs text-red-400">
                    Remove
                  </button>
                </div>
              )}

              {group.conditions.length > 1 && (
                <div className="min-w-0">
                  <label className={labelClass}>Match</label>
                  <select
                    className={selectClass}
                    value={group.logic}
                    onChange={(e) => updateGroup(gi, { logic: e.target.value as 'and' | 'or' })}
                  >
                    <option value="and">All of these</option>
                    <option value="or">Any of these</option>
                  </select>
                </div>
              )}

              {group.conditions.map((cond, ci) => (
                <div key={ci} className="space-y-2">
                  {ci > 0 && (
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      {group.logic === 'or' ? 'Or' : 'And'}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end min-w-0">
                    <div className="min-w-0">
                      <label className={labelClass}>{ci === 0 ? 'What to check' : 'Also check'}</label>
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
          );
        })}

        {showAdvanced ? (
          <button
            type="button"
            onClick={addGroup}
            className="text-xs text-emerald-300 hover:text-emerald-200"
          >
            + Add another scenario
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdvanced(true)}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Need more complex rules? Show advanced options
          </button>
        )}
      </section>

      <section className="rounded-xl border border-gray-800/80 bg-gray-900/20 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">Dashboard message</h3>
        <div className="min-w-0">
          <label className={labelClass}>What should people see?</label>
          <input
            className={inputClass}
            value={rule.messageTemplate || ''}
            onChange={(e) => onChange({ messageTemplate: e.target.value })}
            placeholder="{{count}} assets need your attention"
          />
          <p className="text-[11px] text-gray-600 mt-1">
            <code className="text-gray-500">{'{{count}}'}</code> becomes the number of matches.
          </p>
        </div>
        <p className={`text-xs ${SEVERITY_STYLES[rule.severity || 'warning']?.text}`}>
          Shown as {SEVERITY_FRIENDLY[rule.severity || 'warning']} on the Insights dashboard
        </p>
      </section>

      <button
        type="button"
        onClick={onSave}
        disabled={saving || !rule.name?.trim()}
        className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : rule._id ? 'Save changes' : 'Save insight'}
      </button>
    </div>
  );
}
