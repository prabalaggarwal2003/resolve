'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite, canRead, isSuperAdminUser } from '@/lib/permissions';
import {
  CURRENCIES,
  ORG_ADDRESS_TYPES,
  TIME_ZONES,
  formatOrgAddressLabel,
} from '@/lib/orgProfile';
import { setOrgCurrency } from '@/lib/orgCurrency';
import { formatOrgDate, setOrgTimezone } from '@/lib/orgTimezone';

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

const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'textarea', label: 'Long text' },
];

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const textareaClass = `${inputClass} resize-none`;
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const sectionClass = 'rounded-xl border border-gray-700/60 bg-gray-900/30 p-4 space-y-3';

type OrgContact = {
  _id?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

type OrgAddress = {
  _id?: string;
  typeKey: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isPrimary: boolean;
  contactId: string;
};

type CustomFieldDef = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
};

type OrgFormData = {
  name: string;
  industry: string;
  companySize: string;
  country: string;
  region: string;
  website: string;
  timezone: string;
  currency: string;
  gstin: string;
  registeredAddress: string;
  primaryGoal: string;
  estimatedAssets: string;
  contacts: OrgContact[];
  addresses: OrgAddress[];
  customFieldDefinitions: CustomFieldDef[];
  customFields: Record<string, string | number>;
};

function createObjectId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function emptyContact(): OrgContact {
  return { _id: createObjectId(), name: '', role: '', email: '', phone: '', isPrimary: false };
}

function emptyAddress(): OrgAddress {
  return {
    _id: createObjectId(),
    typeKey: 'head_office',
    label: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    isPrimary: false,
    contactId: '',
  };
}

function getLabel(options: { value: string; label: string }[], value?: string) {
  return options.find((o) => o.value === value)?.label || value || '—';
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) || `field_${Date.now()}`
  );
}

function mapOrgToForm(org: any): OrgFormData {
  return {
    name: org?.name || '',
    industry: org?.industry || '',
    companySize: org?.companySize || '',
    country: org?.country || '',
    region: org?.region || '',
    website: org?.website || '',
    timezone: org?.timezone || 'Asia/Kolkata',
    currency: org?.currency || 'INR',
    gstin: org?.gstin || '',
    registeredAddress: org?.registeredAddress || '',
    primaryGoal: org?.primaryGoal || '',
    estimatedAssets: org?.estimatedAssets || '',
    contacts: (org?.contacts || []).map((c: any) => ({
      _id: c._id || createObjectId(),
      name: c.name || '',
      role: c.role || '',
      email: c.email || '',
      phone: c.phone || '',
      isPrimary: Boolean(c.isPrimary),
    })),
    addresses: (org?.addresses || []).map((a: any) => ({
      _id: a._id || createObjectId(),
      typeKey: a.typeKey || 'other',
      label: a.label || '',
      street: a.street || '',
      city: a.city || '',
      state: a.state || '',
      zipCode: a.zipCode || '',
      country: a.country || '',
      isPrimary: Boolean(a.isPrimary),
      contactId: a.contactId ? String(a.contactId) : '',
    })),
    customFieldDefinitions: (org?.customFieldDefinitions || []).map((f: any) => ({
      key: f.key || '',
      label: f.label || '',
      type: f.type || 'text',
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options : [],
    })),
    customFields: { ...(org?.customFields || {}) },
  };
}

export default function OrganizationPage() {
  const { token } = useAuth();
  const [organization, setOrganization] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState<OrgFormData>(mapOrgToForm(null));
  const [newField, setNewField] = useState({ label: '', type: 'text', options: '' });

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const res = await fetch(apiUrl('/organization'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) {
          setError('You do not have permission to view organization details.');
          return;
        }
        throw new Error('Failed to fetch organization details');
      }
      const data = await res.json();
      setOrganization(data.organization);
      setStatistics(data.statistics);
      setFormData(mapOrgToForm(data.organization));
      setOrgCurrency(data.organization?.currency);
      setOrgTimezone(data.organization?.timezone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: formData.name,
        industry: formData.industry || undefined,
        companySize: formData.companySize || undefined,
        country: formData.country || undefined,
        region: formData.region || undefined,
        website: formData.website.trim() || '',
        timezone: formData.timezone || 'Asia/Kolkata',
        currency: formData.currency || 'INR',
        gstin: formData.gstin.trim().toUpperCase() || undefined,
        registeredAddress: formData.registeredAddress.trim() || undefined,
        primaryGoal: formData.primaryGoal || undefined,
        estimatedAssets: formData.estimatedAssets || undefined,
        contacts: formData.contacts.filter((c) => c.name.trim()),
        addresses: formData.addresses.filter((a) => a.street.trim() || a.city.trim() || a.label.trim()),
        customFieldDefinitions: formData.customFieldDefinitions,
        customFields: formData.customFields,
      };

      const res = await fetch(apiUrl('/organization'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update organization');

      setOrganization(data.organization);
      setFormData(mapOrgToForm(data.organization));
      setOrgCurrency(data.organization?.currency);
      setOrgTimezone(data.organization?.timezone);
      setSuccess('Organization updated successfully');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(mapOrgToForm(organization));
    setEditing(false);
    setError('');
    setSuccess('');
  };

  if (loading) return <LoadingSpinner message="Loading organization details..." />;

  if (error && !organization) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  const contactName = (id: string) => formData.contacts.find((c) => c._id === id)?.name || '—';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Organization</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Manage profile details, addresses, contacts, and custom fields after account setup.
          </p>
        </div>
        {canWrite('organization') && (
          <div className="flex flex-wrap gap-1.5">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50`}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20`}
              >
                Edit organization
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
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
              value={formatOrgDate(statistics.createdAt)}
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
        <div className="lg:col-span-2 space-y-3">
          {/* Basic info */}
          <div className={`${sectionClass} border-l-2 border-l-violet-500/50`}>
            <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest">Organization information</p>
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Organization name</label>
                    <input name="name" value={formData.name} onChange={handleInputChange} className={inputClass} required />
                  </div>
                  <div>
                    <label className={labelClass}>Website</label>
                    <input
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      className={inputClass}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Industry</label>
                    <select name="industry" value={formData.industry} onChange={handleInputChange} className={inputClass}>
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((ind) => (
                        <option key={ind.value} value={ind.value}>
                          {ind.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Company size</label>
                    <select name="companySize" value={formData.companySize} onChange={handleInputChange} className={inputClass}>
                      <option value="">Select size</option>
                      {COMPANY_SIZES.map((size) => (
                        <option key={size.value} value={size.value}>
                          {size.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Timezone</label>
                    <select name="timezone" value={formData.timezone} onChange={handleInputChange} className={inputClass}>
                      {TIME_ZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Currency</label>
                    <select name="currency" value={formData.currency} onChange={handleInputChange} className={inputClass}>
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Country</label>
                    <input name="country" value={formData.country} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Region / state</label>
                    <input name="region" value={formData.region} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>GSTIN</label>
                    <input
                      name="gstin"
                      value={formData.gstin}
                      onChange={handleInputChange}
                      className={`${inputClass} uppercase`}
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Primary goal</label>
                    <select name="primaryGoal" value={formData.primaryGoal} onChange={handleInputChange} className={inputClass}>
                      <option value="">Select goal</option>
                      {PRIMARY_GOALS.map((goal) => (
                        <option key={goal.value} value={goal.value}>
                          {goal.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Estimated assets</label>
                    <select
                      name="estimatedAssets"
                      value={formData.estimatedAssets}
                      onChange={handleInputChange}
                      className={inputClass}
                    >
                      <option value="">Select range</option>
                      {ESTIMATED_ASSETS.map((range) => (
                        <option key={range.value} value={range.value}>
                          {range.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Legacy registered address (optional)</label>
                  <textarea
                    name="registeredAddress"
                    value={formData.registeredAddress}
                    onChange={handleInputChange}
                    className={textareaClass}
                    rows={2}
                    placeholder="Kept for compatibility — prefer Addresses below"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoField label="Organization name" value={organization?.name} />
                <InfoField label="Website" value={organization?.website} />
                <InfoField label="Industry" value={getLabel(INDUSTRIES, organization?.industry)} />
                <InfoField label="Company size" value={getLabel(COMPANY_SIZES, organization?.companySize)} />
                <InfoField label="Timezone" value={getLabel([...TIME_ZONES], organization?.timezone)} />
                <InfoField label="Currency" value={getLabel([...CURRENCIES], organization?.currency)} />
                <InfoField label="Country" value={organization?.country} />
                <InfoField label="Region / state" value={organization?.region} />
                <InfoField label="GSTIN" value={organization?.gstin} valueClassName="font-mono tracking-wide" />
                <InfoField label="Primary goal" value={getLabel(PRIMARY_GOALS, organization?.primaryGoal)} />
                <InfoField label="Estimated assets" value={getLabel(ESTIMATED_ASSETS, organization?.estimatedAssets)} />
                {organization?.registeredAddress && (
                  <InfoField
                    label="Legacy registered address"
                    value={organization.registeredAddress}
                    className="sm:col-span-2"
                    valueClassName="whitespace-pre-wrap font-normal"
                  />
                )}
              </div>
            )}
          </div>

          {/* Contacts */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Contacts</p>
              {editing && (
                <button
                  type="button"
                  className={`${buttonClass} border-gray-700/60 text-gray-300`}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      contacts: [...prev.contacts, emptyContact()],
                    }))
                  }
                >
                  Add contact
                </button>
              )}
            </div>
            {editing ? (
              formData.contacts.length === 0 ? (
                <p className="text-xs text-gray-500">No contacts yet.</p>
              ) : (
                <div className="space-y-3">
                  {formData.contacts.map((c, idx) => (
                    <div key={c._id || idx} className="rounded-lg border border-gray-700/50 p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className={labelClass}>Name</label>
                          <input
                            className={inputClass}
                            value={c.name}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                contacts: prev.contacts.map((x, i) =>
                                  i === idx ? { ...x, name: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Role</label>
                          <input
                            className={inputClass}
                            value={c.role}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                contacts: prev.contacts.map((x, i) =>
                                  i === idx ? { ...x, role: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Email</label>
                          <input
                            className={inputClass}
                            value={c.email}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                contacts: prev.contacts.map((x, i) =>
                                  i === idx ? { ...x, email: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Phone</label>
                          <input
                            className={inputClass}
                            value={c.phone}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                contacts: prev.contacts.map((x, i) =>
                                  i === idx ? { ...x, phone: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-gray-400">
                          <input
                            type="checkbox"
                            checked={c.isPrimary}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                contacts: prev.contacts.map((x, i) => ({
                                  ...x,
                                  isPrimary: i === idx ? e.target.checked : e.target.checked ? false : x.isPrimary,
                                })),
                              }))
                            }
                          />
                          Primary contact
                        </label>
                        <button
                          type="button"
                          className={`${buttonClass} border-red-500/30 text-red-300`}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              contacts: prev.contacts.filter((_, i) => i !== idx),
                              addresses: prev.addresses.map((a) =>
                                a.contactId === c._id ? { ...a, contactId: '' } : a
                              ),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (organization?.contacts || []).length === 0 ? (
              <p className="text-xs text-gray-500">No contacts added.</p>
            ) : (
              <div className="space-y-2">
                {(organization.contacts || []).map((c: any) => (
                  <div key={c._id} className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
                    <p className="text-sm text-gray-200">
                      {c.name}
                      {c.isPrimary ? <span className="ml-2 text-[10px] text-amber-400">Primary</span> : null}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {[c.role, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Addresses */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Addresses</p>
              {editing && (
                <button
                  type="button"
                  className={`${buttonClass} border-gray-700/60 text-gray-300`}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      addresses: [...prev.addresses, emptyAddress()],
                    }))
                  }
                >
                  Add address
                </button>
              )}
            </div>
            {editing ? (
              formData.addresses.length === 0 ? (
                <p className="text-xs text-gray-500">No addresses yet. Add head office, warehouse, etc.</p>
              ) : (
                <div className="space-y-3">
                  {formData.addresses.map((a, idx) => (
                    <div key={a._id || idx} className="rounded-lg border border-gray-700/50 p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className={labelClass}>Type</label>
                          <select
                            className={inputClass}
                            value={a.typeKey}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) =>
                                  i === idx ? { ...x, typeKey: e.target.value } : x
                                ),
                              }))
                            }
                          >
                            {ORG_ADDRESS_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Label</label>
                          <input
                            className={inputClass}
                            value={a.label}
                            placeholder="e.g. HQ Mumbai"
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) =>
                                  i === idx ? { ...x, label: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>Street</label>
                          <input
                            className={inputClass}
                            value={a.street}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) =>
                                  i === idx ? { ...x, street: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>City</label>
                          <input
                            className={inputClass}
                            value={a.city}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) =>
                                  i === idx ? { ...x, city: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>State</label>
                          <input
                            className={inputClass}
                            value={a.state}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) =>
                                  i === idx ? { ...x, state: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>ZIP / PIN</label>
                          <input
                            className={inputClass}
                            value={a.zipCode}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) =>
                                  i === idx ? { ...x, zipCode: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Country</label>
                          <input
                            className={inputClass}
                            value={a.country}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) =>
                                  i === idx ? { ...x, country: e.target.value } : x
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClass}>Contact person</label>
                          <select
                            className={inputClass}
                            value={a.contactId}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) =>
                                  i === idx ? { ...x, contactId: e.target.value } : x
                                ),
                              }))
                            }
                          >
                            <option value="">None</option>
                            {formData.contacts
                              .filter((c) => c.name.trim())
                              .map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name}
                                  {c.role ? ` (${c.role})` : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-gray-400">
                          <input
                            type="checkbox"
                            checked={a.isPrimary}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                addresses: prev.addresses.map((x, i) => ({
                                  ...x,
                                  isPrimary: i === idx ? e.target.checked : e.target.checked ? false : x.isPrimary,
                                })),
                              }))
                            }
                          />
                          Primary address
                        </label>
                        <button
                          type="button"
                          className={`${buttonClass} border-red-500/30 text-red-300`}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              addresses: prev.addresses.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (organization?.addresses || []).length === 0 ? (
              <p className="text-xs text-gray-500">No addresses added.</p>
            ) : (
              <div className="space-y-2">
                {(organization.addresses || []).map((a: any) => {
                  const contact = (organization.contacts || []).find(
                    (c: any) => String(c._id) === String(a.contactId)
                  );
                  return (
                    <div key={a._id} className="px-3 py-2 rounded-lg border border-gray-700/40 bg-gray-900/30">
                      <p className="text-sm text-gray-200">
                        {formatOrgAddressLabel(a)}
                        {a.isPrimary ? <span className="ml-2 text-[10px] text-amber-400">Primary</span> : null}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {[a.street, a.city, a.state, a.zipCode, a.country].filter(Boolean).join(', ') || '—'}
                      </p>
                      {contact && (
                        <p className="text-[11px] text-gray-400 mt-0.5">Contact: {contact.name}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom fields */}
          <div className={sectionClass}>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Custom fields</p>
            {editing ? (
              <div className="space-y-3">
                {formData.customFieldDefinitions.map((f, idx) => (
                  <div key={f.key || idx} className="rounded-lg border border-gray-700/50 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-gray-300 font-medium">{f.label}</p>
                      <button
                        type="button"
                        className={`${buttonClass} border-red-500/30 text-red-300`}
                        onClick={() =>
                          setFormData((prev) => {
                            const nextDefs = prev.customFieldDefinitions.filter((_, i) => i !== idx);
                            const nextValues = { ...prev.customFields };
                            delete nextValues[f.key];
                            return { ...prev, customFieldDefinitions: nextDefs, customFields: nextValues };
                          })
                        }
                      >
                        Remove field
                      </button>
                    </div>
                    <div>
                      <label className={labelClass}>Value</label>
                      {f.type === 'textarea' ? (
                        <textarea
                          className={textareaClass}
                          rows={2}
                          value={String(formData.customFields[f.key] ?? '')}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              customFields: { ...prev.customFields, [f.key]: e.target.value },
                            }))
                          }
                        />
                      ) : f.type === 'select' ? (
                        <select
                          className={inputClass}
                          value={String(formData.customFields[f.key] ?? '')}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              customFields: { ...prev.customFields, [f.key]: e.target.value },
                            }))
                          }
                        >
                          <option value="">Select…</option>
                          {(f.options || []).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                          className={inputClass}
                          value={String(formData.customFields[f.key] ?? '')}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              customFields: { ...prev.customFields, [f.key]: e.target.value },
                            }))
                          }
                        />
                      )}
                    </div>
                  </div>
                ))}

                <div className="rounded-lg border border-dashed border-gray-700/60 p-3 space-y-2">
                  <p className="text-[11px] text-gray-500">Add a custom field definition</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      className={inputClass}
                      placeholder="Field label"
                      value={newField.label}
                      onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))}
                    />
                    <select
                      className={inputClass}
                      value={newField.type}
                      onChange={(e) => setNewField((p) => ({ ...p, type: e.target.value }))}
                    >
                      {CUSTOM_FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {newField.type === 'select' ? (
                      <input
                        className={inputClass}
                        placeholder="Options (comma-separated)"
                        value={newField.options}
                        onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                      />
                    ) : (
                      <div />
                    )}
                  </div>
                  <button
                    type="button"
                    className={`${buttonClass} border-blue-500/40 text-blue-300`}
                    onClick={() => {
                      if (!newField.label.trim()) return;
                      const key = slugify(newField.label);
                      if (formData.customFieldDefinitions.some((f) => f.key === key)) {
                        setError('A custom field with that key already exists');
                        return;
                      }
                      setFormData((prev) => ({
                        ...prev,
                        customFieldDefinitions: [
                          ...prev.customFieldDefinitions,
                          {
                            key,
                            label: newField.label.trim(),
                            type: newField.type,
                            required: false,
                            options:
                              newField.type === 'select'
                                ? newField.options
                                    .split(',')
                                    .map((o) => o.trim())
                                    .filter(Boolean)
                                : [],
                          },
                        ],
                      }));
                      setNewField({ label: '', type: 'text', options: '' });
                    }}
                  >
                    Add field
                  </button>
                </div>
              </div>
            ) : (organization?.customFieldDefinitions || []).length === 0 ? (
              <p className="text-xs text-gray-500">No custom fields defined.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(organization.customFieldDefinitions || []).map((f: CustomFieldDef) => (
                  <InfoField
                    key={f.key}
                    label={f.label}
                    value={
                      organization.customFields?.[f.key] == null || organization.customFields?.[f.key] === ''
                        ? '—'
                        : String(organization.customFields[f.key])
                    }
                  />
                ))}
              </div>
            )}
          </div>
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
              {canWrite('roles') && <QuickActionLink href="/dashboard/roles" label="Assign addresses to users" />}
              {canRead('subscriptions') && (
                <QuickActionLink
                  href="/dashboard/subscriptions"
                  label={isSuperAdminUser() ? 'Manage subscriptions' : 'View subscriptions'}
                />
              )}
              {canRead('audit') && <QuickActionLink href="/dashboard/audit" label="View audit logs" />}
            </div>
          </div>

          <div className="rounded-xl border border-gray-700/40 bg-gray-800/30 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">About</p>
            <p className="text-xs text-gray-500">
              Add website, timezone, currency, multiple addresses, contacts, and custom fields anytime after signup.
              Assign organization addresses to users from Users & Roles.
            </p>
            {editing && formData.contacts.some((c) => c.name) && (
              <p className="text-[11px] text-gray-600 mt-2">
                Tip: link a contact person on each address using the contact dropdown.
                {formData.contacts[0]?._id ? ` (e.g. ${contactName(formData.contacts[0]._id!)})` : ''}
              </p>
            )}
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

function InfoField({
  label,
  value,
  className = '',
  valueClassName = '',
}: {
  label: string;
  value?: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 ${className}`}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold text-gray-200 mt-0.5 ${valueClassName}`}>{value || '—'}</p>
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
