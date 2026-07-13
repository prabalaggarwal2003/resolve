'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import InsightsModuleNav from '@/components/insights/InsightsModuleNav';
import InsightRuleBuilder, { emptyConditionTree } from '@/components/insights/InsightRuleBuilder';
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
  fetchInsightCatalog,
  fetchInsightRules,
  updateInsightRule,
  type InsightCatalog,
  type InsightRule,
} from '@/lib/insights';

export default function InsightBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [catalog, setCatalog] = useState<InsightCatalog | null>(null);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [draft, setDraft] = useState<Partial<InsightRule>>({
    name: '',
    description: '',
    severity: 'warning',
    messageTemplate: '{{count}} items match "{{name}}"',
    conditionTree: emptyConditionTree(),
    category: 'custom',
    ruleType: 'asset',
    link: '/dashboard/assets',
  });
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

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    const init = async () => {
      try {
        const [cat, deptRes, rules] = await Promise.all([
          fetchInsightCatalog(),
          fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then((r) => r.json()),
          editId ? fetchInsightRules() : Promise.resolve([]),
        ]);
        setCatalog(cat);
        setDepartments(deptRes.departments || deptRes || []);
        if (editId) {
          const existing = rules.find((r: InsightRule) => r._id === editId);
          if (existing) setDraft(existing);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [hasAccess, editId]);

  const handleSave = async () => {
    if (!canEdit || !draft.name?.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (draft._id) {
        await updateInsightRule(draft._id, draft);
      } else {
        await createInsightRule(draft);
      }
      router.push('/dashboard/insights/rules');
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

  if (!canEdit) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-400">You need write access to create insight rules.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden mx-auto px-4 py-5 space-y-4">
      <InsightsModuleNav />

      {error && <div className="text-sm text-red-300">{error}</div>}

      {loading || !catalog ? (
        <LoadingSpinner message="Loading rule builder…" />
      ) : (
        <InsightRuleBuilder
          catalog={catalog}
          rule={draft}
          departments={departments}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          onSave={handleSave}
          saving={saving}
          title={draft._id ? `Edit: ${draft.name}` : 'Create custom insight rule'}
        />
      )}
    </div>
  );
}
