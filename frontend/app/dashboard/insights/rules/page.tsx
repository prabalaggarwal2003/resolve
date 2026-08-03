'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import InsightsModuleNav from '@/components/insights/InsightsModuleNav';
import InsightRuleCard from '@/components/insights/InsightRuleCard';
import InsightRuleBuilder, { emptyConditionTree } from '@/components/insights/InsightRuleBuilder';
import InsightThresholdsForm from '@/components/insights/InsightThresholdsForm';
import InsightsPagination, { INSIGHTS_PAGE_SIZE } from '@/components/insights/InsightsPagination';
import { canWrite } from '@/lib/permissions';
import {
  UpgradePrompt,
  canAccessFeature,
  fetchOrgSubscription,
  getStoredSubscription,
} from '@/lib/subscriptionUtils';
import {
  api,
  createInsightRule,
  deleteInsightRule,
  fetchInsightCatalog,
  fetchInsightConfig,
  fetchInsightRules,
  resetInsightRule,
  updateInsightConfig,
  updateInsightRule,
  type InsightCatalog,
  type InsightOrgConfig,
  type InsightRule,
} from '@/lib/insights';

const EMPTY_DRAFT: Partial<InsightRule> = {
  name: '',
  description: '',
  severity: 'warning',
  enabled: true,
  messageTemplate: '{{count}} items need attention',
  conditionTree: emptyConditionTree(),
  category: 'custom',
  ruleType: 'asset',
  link: '/dashboard/assets',
};

function InsightConfigurePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const wantNew = searchParams.get('new') === '1';

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [rules, setRules] = useState<InsightRule[]>([]);
  const [catalog, setCatalog] = useState<InsightCatalog | null>(null);
  const [config, setConfig] = useState<InsightOrgConfig | null>(null);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);
  const [draft, setDraft] = useState<Partial<InsightRule>>(EMPTY_DRAFT);
  const [savingRule, setSavingRule] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const hasAccess = canAccessFeature(tier, 'insights') && !isExpired;
  const canEdit = canWrite('insights');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleList, cat, cfg, deptRes] = await Promise.all([
        fetchInsightRules(),
        fetchInsightCatalog(),
        fetchInsightConfig(),
        fetch(api('/api/departments'), {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then((r) => r.json()),
      ]);
      setRules(ruleList);
      setCatalog(cat);
      setConfig(cfg);
      setDepartments(deptRes.departments || deptRes || []);
      return ruleList;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      return [] as InsightRule[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgSubscription(api).then((sub) => {
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
    });
  }, []);

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    load();
  }, [hasAccess, load]);

  useEffect(() => {
    if (!rules.length && !editId && !wantNew) return;
    if (editId) {
      const existing = rules.find((r) => r._id === editId);
      if (existing) {
        setDraft(existing);
        setShowBuilder(true);
        return;
      }
    }
    if (wantNew) {
      setDraft({ ...EMPTY_DRAFT, conditionTree: emptyConditionTree() });
      setShowBuilder(true);
    }
  }, [editId, wantNew, rules]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#defaults') {
      setShowDefaults(true);
      requestAnimationFrame(() => {
        document.getElementById('defaults')?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [loading]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const openNew = () => {
    setDraft({ ...EMPTY_DRAFT, conditionTree: emptyConditionTree() });
    setShowBuilder(true);
    router.replace('/dashboard/insights/rules?new=1', { scroll: false });
  };

  const openEdit = (rule: InsightRule) => {
    setDraft(rule);
    setShowBuilder(true);
    router.replace(`/dashboard/insights/rules?edit=${rule._id}`, { scroll: false });
    requestAnimationFrame(() => {
      document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const closeBuilder = () => {
    setShowBuilder(false);
    setDraft({ ...EMPTY_DRAFT, conditionTree: emptyConditionTree() });
    router.replace('/dashboard/insights/rules', { scroll: false });
  };

  const handleSaveRule = async () => {
    if (!canEdit || !draft.name?.trim()) return;
    setSavingRule(true);
    setError('');
    try {
      if (draft._id) {
        const updated = await updateInsightRule(draft._id, draft);
        setRules((prev) => {
          const next = prev.map((r) => (r._id === updated._id ? updated : r));
          return next.sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });
        });
        closeBuilder();
      } else {
        const created = await createInsightRule({ ...draft, enabled: true });
        setRules((prev) => [created, ...prev]);
        setShowBuilder(false);
        setDraft({ ...EMPTY_DRAFT, conditionTree: emptyConditionTree() });
        router.push('/dashboard/insights');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingRule(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config || !canEdit) return;
    setSavingConfig(true);
    setError('');
    try {
      const saved = await updateInsightConfig(config);
      setConfig(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const filtered = useMemo(() => {
    return rules.filter((r) => {
      if (!filter.trim()) return true;
      const q = filter.toLowerCase();
      return r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
    });
  }, [rules, filter]);

  const pageRules = useMemo(() => {
    const start = (page - 1) * INSIGHTS_PAGE_SIZE;
    return filtered.slice(start, start + INSIGHTS_PAGE_SIZE);
  }, [filtered, page]);

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <UpgradePrompt feature="Insights" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-[920px] overflow-x-hidden mx-auto px-4 py-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Configure insights</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pick a template or add a simple check — turn rules on or off anytime
          </p>
        </div>
        {canEdit && !showBuilder && (
          <button
            type="button"
            onClick={openNew}
            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            + Add insight
          </button>
        )}
      </div>

      <InsightsModuleNav />

      {error && (
        <div className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>
      )}

      {loading || !catalog ? (
        <LoadingSpinner message="Loading…" />
      ) : (
        <>
          {config && (
            <section id="defaults" className="rounded-xl border border-blue-500/20 bg-blue-950/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDefaults((s) => !s)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-blue-950/30"
              >
                <div>
                  <h2 className="text-sm font-semibold text-gray-200">Defaults &amp; thresholds</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Shared numbers used by built-in insights (warranty days, cost limits, etc.)
                  </p>
                </div>
                <span className="text-xs text-gray-500 shrink-0">{showDefaults ? 'Hide' : 'Show'}</span>
              </button>
              {showDefaults && (
                <div className="px-4 pb-4 border-t border-blue-500/15 pt-4">
                  <InsightThresholdsForm
                    config={config}
                    onChange={(patch) =>
                      setConfig((c) =>
                        c
                          ? {
                              ...c,
                              ...patch,
                              thresholds: patch.thresholds ?? c.thresholds,
                              notifications: patch.notifications ?? c.notifications,
                            }
                          : c
                      )
                    }
                    onSave={handleSaveConfig}
                    saving={savingConfig}
                  />
                  {!canEdit && (
                    <p className="text-xs text-gray-600 mt-2">Read-only — ask an admin to change these.</p>
                  )}
                </div>
              )}
            </section>
          )}

          {showBuilder && canEdit && (
            <div id="builder" className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-xs text-emerald-300/80">
                  {draft._id ? 'Editing insight' : 'New insight'}
                </p>
                <button
                  type="button"
                  onClick={closeBuilder}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
              <InsightRuleBuilder
                catalog={catalog}
                rule={draft}
                departments={departments}
                onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                onSave={handleSaveRule}
                saving={savingRule}
                title={draft._id ? `Edit: ${draft.name}` : 'Add an insight'}
              />
            </div>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-200">Your insights</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {rules.filter((r) => r.enabled).length} of {rules.length} turned on · newest first
                </p>
              </div>
              <input
                className="w-full sm:w-56 px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200"
                placeholder="Search…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {pageRules.map((rule) => (
                <InsightRuleCard
                  key={rule._id}
                  rule={rule}
                  catalog={catalog}
                  canEdit={canEdit}
                  onEditConditions={!rule.isBuiltin ? () => openEdit(rule) : undefined}
                  onToggle={async (enabled) => {
                    const updated = await updateInsightRule(rule._id, { enabled });
                    setRules((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
                  }}
                  onSave={async (patch) => {
                    const updated = await updateInsightRule(rule._id, patch);
                    setRules((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
                  }}
                  onReset={
                    rule.isBuiltin
                      ? async () => {
                          const updated = await resetInsightRule(rule._id);
                          setRules((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
                        }
                      : undefined
                  }
                  onDelete={
                    !rule.isBuiltin
                      ? async () => {
                          if (!confirm(`Delete “${rule.name}”?`)) return;
                          await deleteInsightRule(rule._id);
                          setRules((prev) => prev.filter((r) => r._id !== rule._id));
                        }
                      : undefined
                  }
                />
              ))}
              {!filtered.length && (
                <p className="text-sm text-gray-500 py-8 text-center">No insights match your search.</p>
              )}
            </div>

            <InsightsPagination
              page={page}
              total={filtered.length}
              onChange={setPage}
            />
          </section>
        </>
      )}
    </div>
  );
}

export default function InsightConfigurePage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading…" />}>
      <InsightConfigurePageInner />
    </Suspense>
  );
}
