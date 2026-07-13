'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import BudgetModuleNav from '@/components/budgets/BudgetModuleNav';
import BudgetAnalyticsTab from '@/components/budgets/BudgetAnalyticsTab';
import { fetchBudgetConfig } from '@/lib/budgets';
import { UpgradePrompt, canAccessFeature, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';
import { api } from '@/lib/budgetDashboard';

export default function BudgetAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const [budgetTypes, setBudgetTypes] = useState<{ id: string; name: string }[]>([]);
  const [budgetStatuses, setBudgetStatuses] = useState<{ id: string; name: string }[]>([]);
  const [fundingSources, setFundingSources] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const init = async () => {
      const sub = await fetchOrgSubscription(api);
      setTier(sub.tier);
      setIsExpired(sub.isExpired);
      if (!canAccessFeature(sub.tier, 'budgets') || sub.isExpired) {
        setLoading(false);
        return;
      }
      try {
        const [cfg, deptRes, locRes, userRes] = await Promise.all([
          fetchBudgetConfig(),
          fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then((r) => r.json()),
          fetch(api('/api/locations'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then((r) => r.json()),
          fetch(api('/api/users'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then((r) => r.json()),
        ]);
        setBudgetTypes(cfg.budgetTypes || []);
        setBudgetStatuses(cfg.budgetStatuses || []);
        setFundingSources(cfg.fundingSources || []);
        setDepartments(deptRes.departments || deptRes || []);
        setLocations((locRes.locations || []).map((l: { _id: string; name: string }) => ({ _id: l._id, name: l.name })));
        setUsers((userRes.users || []).map((u: { _id: string; name: string }) => ({ _id: u._id, name: u.name })));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return <LoadingSpinner message="Loading analytics…" />;

  if (!canAccessFeature(tier, 'budgets') || isExpired) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-4">Budget Analytics</h1>
        <UpgradePrompt feature="Budgets & Procurement" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-5 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Budgets & Procurement</h1>
        <p className="text-sm text-gray-500 mt-0.5">Customizable analytics dashboard with KPI cards, charts, and spending insights.</p>
      </div>
      <BudgetModuleNav />
      <BudgetAnalyticsTab
        departments={departments}
        locations={locations}
        users={users}
        budgetTypes={budgetTypes}
        budgetStatuses={budgetStatuses}
        fundingSources={fundingSources}
      />
    </div>
  );
}
