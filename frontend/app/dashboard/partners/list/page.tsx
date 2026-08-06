'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  fetchPartners,
  fetchPartnerConfig,
  createPartner,
  deletePartner,
  formatMoney,
  BusinessPartner,
  PartnerConfig,
} from '@/lib/businessPartners';
import { canWrite } from '@/lib/permissions';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const sectionTitle = 'text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-700/50 pb-1 mb-3';

const STATUS_FALLBACK: Record<string, string> = {
  Active: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  Inactive: 'text-gray-300 bg-gray-500/15 border-gray-500/30',
  Blacklisted: 'text-red-300 bg-red-500/15 border-red-500/30',
  Pending: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
};

function statusBadgeClass(status: string, config: PartnerConfig | null) {
  const color = config?.statuses.find((s) => s.id === status)?.color;
  if (!color) return STATUS_FALLBACK[status] || STATUS_FALLBACK.Inactive;
  return '';
}

type CreateForm = {
  name: string;
  partnerTypeKey: string;
  categoryKey: string;
  status: string;
  email: string;
  phone: string;
  website: string;
  taxId: string;
  paymentTerms: string;
  creditLimit: string;
  currency: string;
  notes: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  contactMobile: string;
  addressTypeKey: string;
  addressLabel: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  taxGst: string;
  taxVat: string;
  regNumber: string;
  regCountry: string;
  businessIndustry: string;
  businessWebsite: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  tags: string;
  customFields: Record<string, string>;
};

function buildEmptyForm(config: PartnerConfig | null): CreateForm {
  const customFields: Record<string, string> = {};
  for (const f of config?.customFields || []) customFields[f.key] = '';
  return {
    name: '',
    partnerTypeKey: config?.partnerTypes.find((t) => t.isDefault)?.id || config?.partnerTypes[0]?.id || '',
    categoryKey: config?.categories.find((c) => c.isDefault)?.id || config?.categories[0]?.id || '',
    status: config?.statuses.find((s) => s.isDefault)?.id || config?.statuses[0]?.id || 'Active',
    email: '',
    phone: '',
    website: '',
    taxId: '',
    paymentTerms: config?.settings?.defaultPaymentTerms || 'Net 30',
    creditLimit: '',
    currency: config?.settings?.defaultCurrency || 'INR',
    notes: '',
    contactName: '',
    contactRole: '',
    contactEmail: '',
    contactPhone: '',
    contactMobile: '',
    addressTypeKey: config?.addressTypes[0]?.id || 'registered',
    addressLabel: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    taxGst: '',
    taxVat: '',
    regNumber: '',
    regCountry: '',
    businessIndustry: '',
    businessWebsite: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    tags: '',
    customFields,
  };
}

function buildCreatePayload(form: CreateForm) {
  const primaryContact = form.contactName.trim()
    ? {
        name: form.contactName.trim(),
        role: form.contactRole,
        email: form.contactEmail || form.email,
        phone: form.contactPhone || form.phone,
        mobile: form.contactMobile,
        isPrimary: true,
      }
    : undefined;

  const address =
    form.street || form.city || form.country
      ? {
          typeKey: form.addressTypeKey,
          label: form.addressLabel || 'Primary',
          street: form.street,
          city: form.city,
          state: form.state,
          zipCode: form.zipCode,
          country: form.country,
          isPrimary: true,
        }
      : null;

  const taxDetails: Record<string, string> = {};
  if (form.taxGst.trim()) taxDetails.gst = form.taxGst.trim();
  if (form.taxVat.trim()) taxDetails.vat = form.taxVat.trim();

  const registrationDetails: Record<string, string> = {};
  if (form.regNumber.trim()) registrationDetails.registrationNumber = form.regNumber.trim();
  if (form.regCountry.trim()) registrationDetails.country = form.regCountry.trim();

  const businessDetails: Record<string, string> = {};
  if (form.businessIndustry.trim()) businessDetails.industry = form.businessIndustry.trim();
  if (form.businessWebsite.trim()) businessDetails.website = form.businessWebsite.trim();

  const bankDetails: Record<string, string> = {};
  if (form.bankName.trim()) bankDetails.bankName = form.bankName.trim();
  if (form.bankAccount.trim()) bankDetails.accountNumber = form.bankAccount.trim();
  if (form.bankIfsc.trim()) bankDetails.ifsc = form.bankIfsc.trim();

  const customFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(form.customFields)) {
    if (String(v).trim()) customFields[k] = String(v).trim();
  }

  const tags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    name: form.name.trim(),
    partnerTypeKey: form.partnerTypeKey,
    categoryKey: form.categoryKey,
    status: form.status,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    website: form.website.trim() || undefined,
    taxId: form.taxId.trim() || undefined,
    paymentTerms: form.paymentTerms,
    creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
    currency: form.currency,
    notes: form.notes.trim() || undefined,
    primaryContact,
    contacts: primaryContact ? [primaryContact] : [],
    addresses: address ? [address] : [],
    taxDetails,
    registrationDetails,
    businessDetails,
    bankDetails,
    customFields,
    tags,
  };
}

export default function PartnersListPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [config, setConfig] = useState<PartnerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', category: '', partnerType: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(() => buildEmptyForm(null));
  const [saving, setSaving] = useState(false);
  const canEdit = canWrite('businessPartners');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [cfg, list] = await Promise.all([fetchPartnerConfig(), fetchPartners()]);
      setConfig(cfg);
      setPartners(list);
    } catch (e: any) {
      setError(e.message || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners.filter((p) => {
      if (filters.status && p.status !== filters.status) return false;
      if (filters.category && p.categoryKey !== filters.category) return false;
      if (filters.partnerType && p.partnerTypeKey !== filters.partnerType) return false;
      if (!q) return true;
      const haystack = [p.name, p.partnerCode, p.email, p.phone, p.contactPerson]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());
      return haystack.some((v) => v.includes(q));
    });
  }, [partners, search, filters]);

  function openCreate() {
    setForm(buildEmptyForm(config));
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createPartner(buildCreatePayload(form));
      setShowModal(false);
      const newId = created?.partner?._id || created?.vendor?._id;
      if (newId) {
        router.push(`/dashboard/partners/${newId}`);
        return;
      }
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to save partner');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this partner? This cannot be undone.')) return;
    try {
      await deletePartner(id);
      setPartners((prev) => prev.filter((p) => p._id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete partner');
    }
  }

  if (loading) return <LoadingSpinner message="Loading partners..." />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">All Partners</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {filtered.length} of {partners.length} partners
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
          >
            + Add partner
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gradient-to-r from-violet-950/15 to-gray-800/40 px-4 py-3 mb-4">
        <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-2">Filters</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="Search partners…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
          <select
            value={filters.partnerType}
            onChange={(e) => setFilters({ ...filters, partnerType: e.target.value })}
            className={inputClass}
          >
            <option value="">All types</option>
            {config?.partnerTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className={inputClass}
          >
            <option value="">All categories</option>
            {config?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className={inputClass}
          >
            <option value="">All status</option>
            {config?.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-500/20 bg-blue-950/10 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-300 mb-1">No partners found</p>
          <p className="text-xs text-gray-500 mb-3">Add your first business partner to get started.</p>
          {canEdit && (
            <button
              onClick={openCreate}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
            >
              + Add partner
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 border-b border-gray-700/60">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Code</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Type</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Category</th>
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Assets</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Spend</th>
                  <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {filtered.map((p) => {
                  const statusColor = config?.statuses.find((s) => s.id === p.status)?.color;
                  return (
                    <tr key={p._id} className="hover:bg-gray-800/40">
                      <td className="px-3 py-2 text-xs font-mono text-gray-400">{p.partnerCode}</td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-200">{p.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {config?.partnerTypes.find((t) => t.id === p.partnerTypeKey)?.name || p.partnerTypeKey || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {config?.categories.find((c) => c.id === p.categoryKey)?.name || p.categoryKey || '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-md border ${statusBadgeClass(p.status, config)}`}
                          style={
                            statusColor
                              ? { color: statusColor, backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }
                              : undefined
                          }
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-blue-300">{p.assetCount || 0}</td>
                      <td className="px-3 py-2 text-xs text-right text-emerald-300">
                        {formatMoney(p.totalPurchased || 0, p.currency)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <Link
                            href={`/dashboard/partners/${p._id}`}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 no-underline transition-colors"
                          >
                            View
                          </Link>
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(p._id)}
                              className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div
            className="bg-gray-800 rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-gray-700 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-100">Add partner</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Fill the same details shown on the partner profile — sections map 1:1 after create.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-200 text-xl">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className={sectionTitle}>General</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Company name *</label>
                    <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Partner type</label>
                    <select className={inputClass} value={form.partnerTypeKey} onChange={(e) => setForm({ ...form, partnerTypeKey: e.target.value })}>
                      {config?.partnerTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select className={inputClass} value={form.categoryKey} onChange={(e) => setForm({ ...form, categoryKey: e.target.value })}>
                      {config?.categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {config?.statuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Website</label>
                    <input className={inputClass} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Tags (comma-separated)</label>
                    <input className={inputClass} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="preferred, critical" />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Primary contact</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Name</label>
                    <input className={inputClass} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Role</label>
                    <input className={inputClass} value={form.contactRole} onChange={(e) => setForm({ ...form, contactRole: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" className={inputClass} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input className={inputClass} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Mobile</label>
                    <input className={inputClass} value={form.contactMobile} onChange={(e) => setForm({ ...form, contactMobile: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Address</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Type</label>
                    <select className={inputClass} value={form.addressTypeKey} onChange={(e) => setForm({ ...form, addressTypeKey: e.target.value })}>
                      {config?.addressTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Label</label>
                    <input className={inputClass} value={form.addressLabel} onChange={(e) => setForm({ ...form, addressLabel: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Street</label>
                    <input className={inputClass} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>State</label>
                    <input className={inputClass} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>ZIP</label>
                    <input className={inputClass} value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Country</label>
                    <input className={inputClass} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Tax</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Tax ID</label>
                    <input className={inputClass} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>GST</label>
                    <input className={inputClass} value={form.taxGst} onChange={(e) => setForm({ ...form, taxGst: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>VAT</label>
                    <input className={inputClass} value={form.taxVat} onChange={(e) => setForm({ ...form, taxVat: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Registration</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Registration number</label>
                    <input className={inputClass} value={form.regNumber} onChange={(e) => setForm({ ...form, regNumber: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Country of registration</label>
                    <input className={inputClass} value={form.regCountry} onChange={(e) => setForm({ ...form, regCountry: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Business</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Industry</label>
                    <input className={inputClass} value={form.businessIndustry} onChange={(e) => setForm({ ...form, businessIndustry: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Business website</label>
                    <input className={inputClass} value={form.businessWebsite} onChange={(e) => setForm({ ...form, businessWebsite: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Bank</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Bank name</label>
                    <input className={inputClass} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Account number</label>
                    <input className={inputClass} value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>IFSC / SWIFT</label>
                    <input className={inputClass} value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionTitle}>Payment</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Payment terms</label>
                    <input className={inputClass} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Credit limit</label>
                    <input type="number" className={inputClass} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Currency</label>
                    <input className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                  </div>
                </div>
              </div>

              {(config?.customFields || []).length > 0 && (
                <div>
                  <p className={sectionTitle}>Custom fields</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {config!.customFields.map((f) => (
                      <div key={f.key}>
                        <label className={labelClass}>{f.label}</label>
                        <input
                          className={inputClass}
                          value={form.customFields[f.key] || ''}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              customFields: { ...form.customFields, [f.key]: e.target.value },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className={sectionTitle}>Notes</p>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Shown in the Notes section on the partner profile"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create partner'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
