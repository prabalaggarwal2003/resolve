'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

const INDUSTRIES = [
  { value: 'IT', label: 'Information Technology' },
  { value: 'Construction', label: 'Construction' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Education', label: 'Education' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Other', label: 'Other' },
];

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

const PRIMARY_GOALS = [
  { value: 'track_it_assets', label: 'Track IT Assets' },
  { value: 'maintenance', label: 'Maintenance Management' },
  { value: 'inventory', label: 'Inventory Management' },
  { value: 'compliance', label: 'Compliance & Auditing' },
  { value: 'other', label: 'Other' },
];

const ESTIMATED_ASSETS = [
  { value: '1-50', label: '1-50 assets' },
  { value: '51-200', label: '51-200 assets' },
  { value: '201-500', label: '201-500 assets' },
  { value: '501-1000', label: '501-1000 assets' },
  { value: '1000+', label: '1000+ assets' },
];

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass = 'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

function getLabel(options: { value: string; label: string }[], value?: string) {
  return options.find((o) => o.value === value)?.label || value || '—';
}

export default function OrganizationPage() {
  const { user, token } = useAuth();
  const [organization, setOrganization] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    companySize: '',
    country: '',
    region: '',
    primaryGoal: '',
    estimatedAssets: '',
  });

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const res = await fetch(apiUrl('/organization'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Only superadmins can view organization details.');
          return;
        }
        throw new Error('Failed to fetch organization details');
      }
      
      const data = await res.json();
      setOrganization(data.organization);
      setStatistics(data.statistics);
      setFormData({
        name: data.organization.name || '',
        industry: data.organization.industry || '',
        companySize: data.organization.companySize || '',
        country: data.organization.country || '',
        region: data.organization.region || '',
        primaryGoal: data.organization.primaryGoal || '',
        estimatedAssets: data.organization.estimatedAssets || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Filter out empty strings for enum fields to avoid validation errors
      const payload = {
        name: formData.name,
        industry: formData.industry || undefined,
        companySize: formData.companySize || undefined,
        country: formData.country || undefined,
        region: formData.region || undefined,
        primaryGoal: formData.primaryGoal || undefined,
        estimatedAssets: formData.estimatedAssets || undefined,
      };

      const res = await fetch(apiUrl('/organization'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update organization');
      }

      setOrganization(data.organization);
      setSuccess('Organization updated successfully');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        industry: organization.industry || '',
        companySize: organization.companySize || '',
        country: organization.country || '',
        region: organization.region || '',
        primaryGoal: organization.primaryGoal || '',
        estimatedAssets: organization.estimatedAssets || '',
      });
    }
    setEditing(false);
    setError('');
    setSuccess('');
  };

  if (loading) {
    return <LoadingSpinner message="Loading organization details..." />;
  }

  if (error && !organization) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Organization</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Manage your organization profile, identifiers, and workspace settings.
          </p>
        </div>
        {user?.role === 'super_admin' && (
          <div className="flex flex-wrap gap-1.5">
            {editing ? (
              <>
                <button
                  onClick={handleCancel}
                  className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 disabled:opacity-50`}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50`}
              >
                Edit organization
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-emerald-900/20 border border-emerald-800 rounded-lg text-emerald-400 text-sm">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-1">Workspace</p>
            <h2 className="text-lg font-bold text-gray-100">{organization?.name || 'Unnamed organization'}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{organization?.orgId}</p>
          </div>
          {organization?.industry && (
            <span className="shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-md border text-blue-300 bg-blue-500/15 border-blue-500/30">
              {organization.industry}
            </span>
          )}
        </div>

        {statistics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <SummaryCard label="Total users" value={String(statistics.totalUsers)} accent="text-blue-300" />
            <SummaryCard
              label="Created"
              value={new Date(statistics.createdAt).toLocaleDateString()}
              accent="text-violet-300"
            />
            <SummaryCard
              label="Company size"
              value={getLabel(COMPANY_SIZES, organization?.companySize)}
              accent="text-emerald-300"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-4">
          <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-3">Organization information</p>

          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Organization name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Industry</label>
                  <select name="industry" value={formData.industry} onChange={handleInputChange} className={inputClass}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind.value} value={ind.value}>{ind.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Company size</label>
                  <select name="companySize" value={formData.companySize} onChange={handleInputChange} className={inputClass}>
                    <option value="">Select size</option>
                    {COMPANY_SIZES.map((size) => (
                      <option key={size.value} value={size.value}>{size.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <input type="text" name="country" value={formData.country} onChange={handleInputChange} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Region / state</label>
                <input type="text" name="region" value={formData.region} onChange={handleInputChange} className={inputClass} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Primary goal</label>
                  <select name="primaryGoal" value={formData.primaryGoal} onChange={handleInputChange} className={inputClass}>
                    <option value="">Select goal</option>
                    {PRIMARY_GOALS.map((goal) => (
                      <option key={goal.value} value={goal.value}>{goal.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Estimated assets</label>
                  <select name="estimatedAssets" value={formData.estimatedAssets} onChange={handleInputChange} className={inputClass}>
                    <option value="">Select range</option>
                    {ESTIMATED_ASSETS.map((range) => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <InfoField label="Organization name" value={organization?.name} />
              <InfoField label="Industry" value={getLabel(INDUSTRIES, organization?.industry)} />
              <InfoField label="Company size" value={getLabel(COMPANY_SIZES, organization?.companySize)} />
              <InfoField label="Country" value={organization?.country} />
              <InfoField label="Region / state" value={organization?.region} />
              <InfoField label="Primary goal" value={getLabel(PRIMARY_GOALS, organization?.primaryGoal)} />
              <InfoField label="Estimated assets" value={getLabel(ESTIMATED_ASSETS, organization?.estimatedAssets)} className="sm:col-span-2" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-gray-500/60 bg-gray-800/40 px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Organization ID</p>
            <p className="text-xs font-mono text-gray-300 bg-gray-900/50 px-2 py-1.5 rounded-lg border border-gray-700/40 break-all">
              {organization?.orgId}
            </p>
          </div>

          <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-amber-500/50 bg-gradient-to-r from-amber-950/15 to-gray-800/40 px-4 py-3">
            <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest mb-2">Quick actions</p>
            <div className="space-y-1">
              <QuickActionLink href="/dashboard/roles" label="Add new user" />
              <QuickActionLink href="/dashboard/subscriptions" label="Manage subscriptions" />
              <QuickActionLink href="/dashboard/audit" label="View audit logs" />
            </div>
          </div>

          <div className="rounded-xl border border-gray-700/40 bg-gray-800/30 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">About this page</p>
            <p className="text-xs text-gray-500">
              Organization details are visible to super admins. Updates apply across your workspace, including reports and asset limits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent}`}>{value}</p>
    </div>
  );
}

function InfoField({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  return (
    <div className={`px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 ${className}`}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-gray-200 mt-0.5">{value || '—'}</p>
    </div>
  );
}

function QuickActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-2 py-1.5 text-xs text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10 rounded-lg transition-colors no-underline"
    >
      → {label}
    </Link>
  );
}
