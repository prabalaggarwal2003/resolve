'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/api';

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

const buttonClass = 'px-4 py-2 rounded-lg font-medium transition-colors';
const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

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
      const res = await fetch(apiUrl('/organization'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        throw new Error('Failed to update organization');
      }
      
      const data = await res.json();
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading organization details...</div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium mb-2">Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Organization Details</h1>
              <p className="text-slate-600 mt-1">Manage your organization information and settings</p>
            </div>
            {user?.role === 'super_admin' && (
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleCancel}
                      className={`${buttonClass} bg-slate-100 hover:bg-slate-200 text-slate-700`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={`${buttonClass} bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50`}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className={`${buttonClass} bg-blue-600 hover:bg-blue-700 text-white`}
                  >
                    Edit Organization
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Information */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Organization Information</h2>
              
              {editing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Organization Name</label>
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
                      <select
                        name="industry"
                        value={formData.industry}
                        onChange={handleInputChange}
                        className={inputClass}
                      >
                        <option value="">Select Industry</option>
                        {INDUSTRIES.map((ind) => (
                          <option key={ind.value} value={ind.value}>{ind.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Company Size</label>
                      <select
                        name="companySize"
                        value={formData.companySize}
                        onChange={handleInputChange}
                        className={inputClass}
                      >
                        <option value="">Select Size</option>
                        {COMPANY_SIZES.map((size) => (
                          <option key={size.value} value={size.value}>{size.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Country</label>
                      <input
                        type="text"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Region/State</label>
                    <input
                      type="text"
                      name="region"
                      value={formData.region}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Primary Goal</label>
                      <select
                        name="primaryGoal"
                        value={formData.primaryGoal}
                        onChange={handleInputChange}
                        className={inputClass}
                      >
                        <option value="">Select Goal</option>
                        {PRIMARY_GOALS.map((goal) => (
                          <option key={goal.value} value={goal.value}>{goal.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Estimated Assets</label>
                      <select
                        name="estimatedAssets"
                        value={formData.estimatedAssets}
                        onChange={handleInputChange}
                        className={inputClass}
                      >
                        <option value="">Select Range</option>
                        {ESTIMATED_ASSETS.map((range) => (
                          <option key={range.value} value={range.value}>{range.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Organization Name</p>
                      <p className="font-medium text-slate-900">{organization?.name || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Industry</p>
                      <p className="font-medium text-slate-900">{organization?.industry || 'Not set'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Company Size</p>
                      <p className="font-medium text-slate-900">{organization?.companySize || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Country</p>
                      <p className="font-medium text-slate-900">{organization?.country || 'Not set'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Region/State</p>
                      <p className="font-medium text-slate-900">{organization?.region || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Primary Goal</p>
                      <p className="font-medium text-slate-900">{organization?.primaryGoal || 'Not set'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-slate-600">Estimated Assets</p>
                    <p className="font-medium text-slate-900">{organization?.estimatedAssets || 'Not set'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Organization ID */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-3">Organization ID</h3>
                <p className="text-sm font-mono text-slate-700 bg-white px-3 py-2 rounded border border-slate-200">
                  {organization?.orgId}
                </p>
              </div>

              {/* Statistics */}
              {statistics && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-medium text-slate-900 mb-3">Statistics</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Total Users</span>
                      <span className="text-sm font-medium text-slate-900">{statistics.totalUsers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Created</span>
                      <span className="text-sm font-medium text-slate-900">
                        {new Date(statistics.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full text-left text-sm text-blue-700 hover:text-blue-800">
                    → Invite team members
                  </button>
                  <button className="w-full text-left text-sm text-blue-700 hover:text-blue-800">
                    → Export organization data
                  </button>
                  <button className="w-full text-left text-sm text-blue-700 hover:text-blue-800">
                    → View audit logs
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
