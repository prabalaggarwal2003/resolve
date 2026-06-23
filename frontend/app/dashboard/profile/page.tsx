'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  timeZone: string;
  role: string;
  memberSince: string;
  lastLogin?: string;
  organizationName: string;
  isOrgOwner: boolean;
  subscription: {
    tier: string;
    plan: string;
    isExpired: boolean;
    limits: { assets: number; users: number };
    subscriptionStartDate?: string;
    subscriptionEndDate?: string;
  };
  usage: { assets: number; users: number };
};

const TIER_BADGE: Record<string, string> = {
  free: 'text-gray-300 bg-gray-500/15 border-gray-500/30',
  pro: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  premium: 'text-violet-300 bg-violet-500/15 border-violet-500/30',
};

const TIME_ZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors';

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function UsageCard({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="rounded-lg border border-gray-700/40 bg-gray-900/30 px-3 py-2">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-100 tabular-nums mt-0.5">
        {used}
        <span className="text-sm font-normal text-gray-500"> / {limit}</span>
      </p>
      <div className="h-1.5 rounded-full bg-gray-800 mt-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 85 ? 'bg-amber-400' : 'bg-blue-400/80'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-600 mt-1">{pct}% of plan limit</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, login, token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    jobTitle: '',
    timeZone: 'Asia/Kolkata',
  });

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      setLoading(false);
      return;
    }
    fetchProfile();
  }, [user?.role]);

  const fetchProfile = async () => {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    try {
      const res = await fetch(apiUrl('/auth/profile'), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load profile');
      setProfile(data.profile);
      setForm({
        name: data.profile.name || '',
        phone: data.profile.phone || '',
        jobTitle: data.profile.jobTitle || '',
        timeZone: data.profile.timeZone || 'Asia/Kolkata',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    const authToken = token || localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl('/auth/profile'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');

      if (data.user && authToken) {
        const existing = JSON.parse(localStorage.getItem('user') || '{}');
        login(authToken, { ...existing, ...data.user });
      }

      setSuccess('Profile saved');
      await fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="max-w-7xl mx-auto">
        <p className="text-red-400 text-sm">Access denied. Profile is available for super admins only.</p>
        <Link href="/dashboard" className={`${buttonClass} inline-block mt-3 border-gray-700/60 text-gray-400 no-underline`}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (loading) return <LoadingSpinner message="Loading profile..." />;

  if (error && !profile) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  if (!profile) return null;

  const tier = profile.subscription.tier;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mt-8">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Profile</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your account and organization usage</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 text-[10px] rounded border uppercase ${TIER_BADGE[tier] || TIER_BADGE.free}`}>
            {tier} plan
          </span>
          {profile.isOrgOwner && (
            <span className="px-2 py-0.5 text-[10px] rounded border text-amber-300 bg-amber-500/15 border-amber-500/30">
              Organization owner
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
        <UsageCard label="Assets" used={profile.usage.assets} limit={profile.subscription.limits.assets} />
        <UsageCard label="Users" used={profile.usage.users} limit={profile.subscription.limits.users} />
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/80 mb-3">Account details</p>
        <form onSubmit={handleSave} className="space-y-3">
          {error && (
            <p className="text-[11px] text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
              {error}
            </p>
          )}
          {success && (
            <p className="text-[11px] text-emerald-400 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              {success}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Full name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email address</label>
              <input type="email" value={profile.email} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
            </div>
            <div>
              <label className={labelClass}>Phone number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                className={inputClass}
                placeholder="10-digit mobile"
              />
            </div>
            <div>
              <label className={labelClass}>Job title / designation</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                className={inputClass}
                placeholder="e.g. IT Administrator"
              />
            </div>
            <div>
              <label className={labelClass}>Time zone</label>
              <select
                value={form.timeZone}
                onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
                className={inputClass}
              >
                {TIME_ZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`${buttonClass} border-blue-500/40 bg-blue-600/20 text-blue-200 hover:bg-blue-600/30 disabled:opacity-50 py-2 px-4`}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/80 mb-3">Organization</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Organization name</p>
            <p className="text-xs font-medium text-gray-200 mt-0.5">{profile.organizationName || '—'}</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Member since</p>
            <p className="text-xs font-medium text-gray-200 mt-0.5">{formatDateTime(profile.memberSince)}</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Last login</p>
            <p className="text-xs font-medium text-gray-200 mt-0.5">{formatDateTime(profile.lastLogin)}</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Subscription</p>
            <p className="text-xs font-medium text-gray-200 mt-0.5 capitalize">
              {tier} · {profile.subscription.plan}
              {profile.subscription.isExpired ? ' (expired)' : ''}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/subscriptions"
          className={`${buttonClass} inline-block mt-3 no-underline border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
        >
          Manage subscription →
        </Link>
      </div>
    </div>
  );
}
