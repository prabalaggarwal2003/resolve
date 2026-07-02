'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/api';
import { validatePassword } from '@/lib/validation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { isSuperAdminUser, canRead } from '@/lib/permissions';
import TwoFactorSection from '@/components/TwoFactorSection';
import ProfileLegalSection from '@/components/ProfileLegalSection';

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
  emailVerified: boolean;
  twoFactorEnabled: boolean;
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
  const { user, login, logout, token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    jobTitle: '',
    timeZone: 'Asia/Kolkata',
  });

  useEffect(() => {
    fetchProfile();
  }, [user?.role, user?.permissions]);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    const newPasswordError = validatePassword(passwordForm.newPassword);
    if (newPasswordError) {
      setPasswordError(newPasswordError);
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    const authToken = token || localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl('/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password');

      setPasswordSuccess(data.message);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');

    if (!deletePassword.trim()) {
      setDeleteError('Enter your password to confirm deletion');
      return;
    }

    const confirmed = window.confirm(
      'This will permanently delete your account, organization, and all associated data. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    setDeleting(true);
    const authToken = token || localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl('/auth/account'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete account');

      await logout();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

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

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-amber-500/50 bg-gray-800/40 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80">Security</p>
          {!showPasswordForm && (
            <button
              type="button"
              onClick={() => {
                setShowPasswordForm(true);
                setPasswordError('');
                setPasswordSuccess('');
              }}
              className={`${buttonClass} border-amber-500/40 bg-amber-600/15 text-amber-200 hover:bg-amber-600/25`}
            >
              Change password
            </button>
          )}
        </div>

        {passwordSuccess && !showPasswordForm && (
          <p className="text-[11px] text-emerald-400 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 mb-3">
            {passwordSuccess}
          </p>
        )}

        {showPasswordForm && (
          <form onSubmit={handleChangePassword} className="space-y-3">
            {passwordError && (
              <p className="text-[11px] text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                {passwordError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>Current password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                    className={`${inputClass} pr-9`}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>New password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                    className={`${inputClass} pr-9`}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                    tabIndex={-1}
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Confirm new password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                    className={`${inputClass} pr-9`}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={changingPassword}
                className={`${buttonClass} border-amber-500/40 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30 disabled:opacity-50 py-2 px-4`}
              >
                {changingPassword ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!showPasswordForm && (
          <p className="text-xs text-gray-500">Update your password using your current credentials.</p>
        )}

        {profile && (
          <TwoFactorSection
            emailVerified={profile.emailVerified}
            twoFactorEnabled={profile.twoFactorEnabled}
            token={token}
            onStatusChange={fetchProfile}
          />
        )}
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
        {canRead('subscriptions') && (
        <Link
          href="/dashboard/subscriptions"
          className={`${buttonClass} inline-block mt-3 no-underline border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
        >
          Manage subscription →
        </Link>
        )}
      </div>

      <ProfileLegalSection />

      {isSuperAdminUser() && (
        <div className="rounded-xl border border-red-500/30 border-l-2 border-l-red-500/60 bg-red-950/20 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400/90">Danger zone</p>
            {!showDeleteForm && (
              <button
                type="button"
                onClick={() => {
                  setShowDeleteForm(true);
                  setDeleteError('');
                  setDeletePassword('');
                }}
                className={`${buttonClass} border-red-500/40 bg-red-600/15 text-red-300 hover:bg-red-600/25`}
              >
                Delete account
              </button>
            )}
          </div>

          {!showDeleteForm && (
            <p className="text-xs text-gray-500">
              Permanently delete your account, organization, and all assets, users, issues, and related data.
            </p>
          )}

          {showDeleteForm && (
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <p className="text-xs text-red-300/90 leading-relaxed">
                This action is permanent. Your organization, all users, assets, issues, vendors, invoices, audit logs,
                and other data will be removed and cannot be recovered.
              </p>

              {deleteError && (
                <p className="text-[11px] text-red-400 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                  {deleteError}
                </p>
              )}

              <div>
                <label className={labelClass}>Confirm with your password</label>
                <div className="relative max-w-sm">
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className={`${inputClass} pr-9`}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                    tabIndex={-1}
                  >
                    {showDeletePassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={deleting || !deletePassword.trim()}
                  className={`${buttonClass} border-red-500/50 bg-red-600/25 text-red-200 hover:bg-red-600/35 disabled:opacity-40 disabled:cursor-not-allowed py-2 px-4`}
                >
                  {deleting ? 'Deleting…' : 'Delete account permanently'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteForm(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  disabled={deleting}
                  className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-50`}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
