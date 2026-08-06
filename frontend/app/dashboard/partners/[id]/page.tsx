'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  fetchPartner,
  fetchPartnerConfig,
  updatePartner,
  deletePartner,
  partnerAction,
  formatMoney,
  BusinessPartner,
  PartnerConfig,
} from '@/lib/businessPartners';
import { canWrite } from '@/lib/permissions';
import PartnerActivityList from '@/components/partners/PartnerActivityList';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const btnPrimary =
  'px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-50';
const btnGhost =
  'px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 transition-colors';
const btnDanger =
  'px-2.5 py-1 text-xs font-medium rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors';
const sectionClass = 'rounded-xl border border-gray-700/60 bg-gray-900/30 p-4 space-y-3';
const thClass = 'px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500';
const tdClass = 'px-3 py-2 text-xs text-gray-300';

function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function labelize(key: string) {
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function initMapDraft(details: Record<string, unknown> | undefined, guaranteedKeys: string[]): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const key of guaranteedKeys) draft[key] = '';
  for (const [key, value] of Object.entries(details || {})) {
    draft[key] = value == null ? '' : String(value);
  }
  return draft;
}

function SectionTitle({
  children,
  canEdit,
  sectionKey,
  editingSection,
  saving,
  onEdit,
  onSave,
  onCancel,
  toggleOnly,
}: {
  children: React.ReactNode;
  canEdit?: boolean;
  sectionKey?: string;
  editingSection?: string | null;
  saving?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  toggleOnly?: boolean;
}) {
  const isEditing = Boolean(sectionKey) && editingSection === sectionKey;
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-gray-100">{children}</h3>
      {canEdit && sectionKey && (
        isEditing ? (
          toggleOnly ? (
            <button type="button" onClick={onCancel} className={btnGhost}>
              Done
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button type="button" onClick={onSave} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={onCancel} className={btnGhost}>
                Cancel
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-blue-300 hover:bg-gray-800/60 transition-colors"
          >
            ✎
          </button>
        )
      )}
    </div>
  );
}

function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-4 text-center text-xs text-gray-500">
        {message}
      </td>
    </tr>
  );
}

function KeyValueDisplay({ data }: { data: Record<string, unknown> | undefined }) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <p className="text-xs text-gray-500">No details</p>;
  return (
    <div className="grid md:grid-cols-3 gap-3 text-xs">
      {entries.map(([k, v]) => (
        <div key={k}>
          <p className="text-gray-500 capitalize">{k}</p>
          <p className="text-gray-200">{v != null && String(v) !== '' ? String(v) : '—'}</p>
        </div>
      ))}
    </div>
  );
}

function KeyValueEditGrid({
  draft,
  onChange,
  priorityKeys = [],
}: {
  draft: Record<string, string>;
  onChange: (key: string, value: string) => void;
  priorityKeys?: string[];
}) {
  const keys = [...priorityKeys, ...Object.keys(draft).filter((k) => !priorityKeys.includes(k))];
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {keys.map((k) => (
        <div key={k}>
          <label className={labelClass}>{labelize(k)}</label>
          <input className={inputClass} value={draft[k] ?? ''} onChange={(e) => onChange(k, e.target.value)} />
        </div>
      ))}
    </div>
  );
}

export default function PartnerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');
  const canEdit = canWrite('businessPartners');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<PartnerConfig | null>(null);
  const [partner, setPartner] = useState<BusinessPartner | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [performance, setPerformance] = useState<any[]>([]);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const [generalDraft, setGeneralDraft] = useState({
    name: '',
    partnerTypeKey: '',
    categoryKey: '',
    status: '',
    email: '',
    phone: '',
    website: '',
    currency: 'INR',
  });
  const [taxDraft, setTaxDraft] = useState<Record<string, string>>({});
  const [registrationDraft, setRegistrationDraft] = useState<Record<string, string>>({});
  const [businessDraft, setBusinessDraft] = useState<Record<string, string>>({});
  const [bankDraft, setBankDraft] = useState<Record<string, string>>({});
  const [paymentDraft, setPaymentDraft] = useState({ paymentTerms: '', creditLimit: '', currency: 'INR' });
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});

  const [contactForm, setContactForm] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    mobile: '',
    isPrimary: false,
  });
  const [addressForm, setAddressForm] = useState({
    typeKey: '',
    label: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    isPrimary: false,
  });
  const [tagInput, setTagInput] = useState('');
  const [noteText, setNoteText] = useState('');
  const [contractForm, setContractForm] = useState({
    contractNumber: '',
    title: '',
    startDate: '',
    endDate: '',
    status: 'Draft',
    notes: '',
  });
  const [linkForm, setLinkForm] = useState({
    relationshipTypeKey: '',
    resourceType: 'asset',
    resourceId: '',
    notes: '',
  });

  const enabledSections = useMemo(() => {
    const map = new Map((config?.profileSections || []).map((s) => [s.key, s.enabled !== false]));
    return (key: string) => map.get(key) !== false;
  }, [config]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [cfg, data, perf] = await Promise.all([
        fetchPartnerConfig(),
        fetchPartner(id),
        partnerAction(`/${id}/performance`, 'GET').catch(() => ({ kpis: [] })),
      ]);
      setConfig(cfg);
      setPartner(data.partner || data.vendor || null);
      setAssets(data.assets || []);
      setInvoices(data.invoices || []);
      setProcurements(data.procurements || []);
      setContracts(data.contracts || []);
      setLinks(data.links || []);
      setActivities(data.activities || []);
      setStats(data.stats || null);
      setPerformance(perf.kpis || []);
      setAddressForm((prev) => ({
        ...prev,
        typeKey: cfg.addressTypes?.[0]?.id || '',
      }));
      setLinkForm((prev) => ({
        ...prev,
        relationshipTypeKey: cfg.assetRelationshipTypes?.[0]?.key || '',
      }));
    } catch (e: any) {
      setError(e.message || 'Failed to load partner');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshPartnerOnly = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchPartner(id);
      const updated = data.partner || data.vendor;
      if (updated) setPartner(updated);
    } catch {
      /* soft refresh failures are non-fatal */
    }
  }, [id]);

  const refreshRelated = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchPartner(id);
      const updated = data.partner || data.vendor;
      if (updated) setPartner(updated);
      setAssets(data.assets || []);
      setInvoices(data.invoices || []);
      setProcurements(data.procurements || []);
      setContracts(data.contracts || []);
      setLinks(data.links || []);
      setActivities(data.activities || []);
      setStats(data.stats || null);
    } catch {
      /* soft refresh failures are non-fatal */
    }
  }, [id]);

  async function saveSection(sectionKey: string, payload: Record<string, unknown>) {
    setSavingSection(sectionKey);
    try {
      const data = await updatePartner(id, payload);
      const updated = data.partner || data.vendor || data;
      setPartner((prev) =>
        prev
          ? { ...prev, ...updated, contactPerson: updated.primaryContact?.name || updated.contactPerson }
          : prev
      );
      if (data.activity) {
        setActivities((prev) => [data.activity, ...prev]);
      }
      setEditingSection(null);
    } catch (e: any) {
      alert(e.message || 'Failed to save changes');
    } finally {
      setSavingSection(null);
    }
  }

  function startEditGeneral() {
    if (!partner) return;
    setGeneralDraft({
      name: partner.name || '',
      partnerTypeKey: partner.partnerTypeKey || '',
      categoryKey: partner.categoryKey || '',
      status: partner.status || '',
      email: partner.email || '',
      phone: partner.phone || '',
      website: partner.website || '',
      currency: partner.currency || 'INR',
    });
    setEditingSection('general');
  }

  async function saveGeneral() {
    if (!generalDraft.name.trim()) {
      alert('Name is required');
      return;
    }
    await saveSection('general', generalDraft);
  }

  function startEditTax() {
    const details = initMapDraft(partner?.taxDetails, ['gst', 'vat']);
    setTaxDraft({ taxId: partner?.taxId || '', ...details });
    setEditingSection('tax');
  }

  async function saveTax() {
    const { taxId, ...taxDetails } = taxDraft;
    await saveSection('tax', { taxId, taxDetails });
  }

  function startEditRegistration() {
    setRegistrationDraft(initMapDraft(partner?.registrationDetails, ['registrationNumber', 'country']));
    setEditingSection('registration');
  }

  async function saveRegistration() {
    await saveSection('registration', { registrationDetails: registrationDraft });
  }

  function startEditBusiness() {
    setBusinessDraft(initMapDraft(partner?.businessDetails, ['industry', 'website']));
    setEditingSection('business');
  }

  async function saveBusiness() {
    await saveSection('business', { businessDetails: businessDraft });
  }

  function startEditBank() {
    setBankDraft(initMapDraft(partner?.bankDetails, ['bankName', 'accountNumber', 'ifsc']));
    setEditingSection('bank');
  }

  async function saveBank() {
    await saveSection('bank', { bankDetails: bankDraft });
  }

  function startEditPayment() {
    setPaymentDraft({
      paymentTerms: partner?.paymentTerms || '',
      creditLimit: partner?.creditLimit != null ? String(partner.creditLimit) : '',
      currency: partner?.currency || 'INR',
    });
    setEditingSection('payment');
  }

  async function savePayment() {
    await saveSection('payment', {
      paymentTerms: paymentDraft.paymentTerms,
      creditLimit: paymentDraft.creditLimit === '' ? null : Number(paymentDraft.creditLimit),
      currency: paymentDraft.currency,
    });
  }

  function startEditCustom() {
    const cf = partner?.customFields || {};
    const draft: Record<string, string> = {};
    for (const field of config?.customFields || []) {
      draft[field.key] = cf[field.key] != null ? String(cf[field.key]) : '';
    }
    setCustomDraft(draft);
    setEditingSection('custom');
  }

  async function saveCustom() {
    const customFields: Record<string, unknown> = { ...(partner?.customFields || {}) };
    for (const [key, value] of Object.entries(customDraft)) {
      customFields[key] = value;
    }
    await saveSection('custom', { customFields });
  }

  async function handleDelete() {
    if (!partner) return;
    if (!confirm(`Delete partner "${partner.name}"? This cannot be undone.`)) return;
    try {
      await deletePartner(partner._id);
      router.push('/dashboard/partners/list');
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const data = await partnerAction(`/${id}/contacts`, 'POST', contactForm);
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      setContactForm({ name: '', role: '', email: '', phone: '', mobile: '', isPrimary: false });
    } catch (err: any) {
      alert(err.message || 'Failed to add contact');
    }
  }

  async function removeContact(contactId: string) {
    if (!confirm('Remove this contact?')) return;
    try {
      const data = await partnerAction(`/${id}/contacts/${contactId}`, 'DELETE');
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
    } catch (err: any) {
      alert(err.message || 'Failed to remove contact');
    }
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const data = await partnerAction(`/${id}/addresses`, 'POST', addressForm);
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      setAddressForm({
        typeKey: config?.addressTypes?.[0]?.id || '',
        label: '',
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        isPrimary: false,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to add address');
    }
  }

  async function removeAddress(addressId: string) {
    if (!confirm('Remove this address?')) return;
    try {
      const data = await partnerAction(`/${id}/addresses/${addressId}`, 'DELETE');
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
    } catch (err: any) {
      alert(err.message || 'Failed to remove address');
    }
  }

  async function saveTags() {
    if (!canEdit || !partner) return;
    const tags = [...(partner.tags || [])];
    const next = tagInput.trim();
    if (next && !tags.includes(next)) tags.push(next);
    try {
      const data = await partnerAction(`/${id}/tags`, 'PUT', { tags });
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      setTagInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to save tags');
    }
  }

  async function removeTag(tag: string) {
    if (!canEdit || !partner) return;
    try {
      const data = await partnerAction(`/${id}/tags`, 'PUT', { tags: (partner.tags || []).filter((t) => t !== tag) });
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
    } catch (err: any) {
      alert(err.message || 'Failed to remove tag');
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !noteText.trim()) return;
    try {
      const data = await partnerAction(`/${id}/notes`, 'POST', { text: noteText.trim() });
      const activity = data.activity || data;
      if (activity) setActivities((prev) => [activity, ...prev]);
      setNoteText('');
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    }
  }

  async function addContract(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const data = await partnerAction(`/${id}/contracts`, 'POST', contractForm);
      if (data.contract) {
        setContracts((prev) => [data.contract, ...prev]);
        setStats((prev: any) => (prev ? { ...prev, contractCount: (prev.contractCount || 0) + 1 } : prev));
      } else {
        await refreshRelated();
      }
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      setContractForm({ contractNumber: '', title: '', startDate: '', endDate: '', status: 'Draft', notes: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to add contract');
    }
  }

  async function removeContract(contractId: string) {
    if (!confirm('Delete this contract?')) return;
    try {
      await partnerAction(`/${id}/contracts/${contractId}`, 'DELETE');
      setContracts((prev) => prev.filter((c) => c._id !== contractId));
      setStats((prev: any) => (prev ? { ...prev, contractCount: Math.max(0, (prev.contractCount || 0) - 1) } : prev));
    } catch (err: any) {
      alert(err.message || 'Failed to delete contract');
    }
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const data = await partnerAction(`/${id}/links`, 'POST', linkForm);
      if (data.link) setLinks((prev) => [data.link, ...prev]);
      else await refreshRelated();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      setLinkForm({
        relationshipTypeKey: config?.assetRelationshipTypes?.[0]?.key || '',
        resourceType: 'asset',
        resourceId: '',
        notes: '',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to add link');
    }
  }

  async function removeLink(linkId: string) {
    if (!confirm('Remove this link?')) return;
    try {
      await partnerAction(`/${id}/links/${linkId}`, 'DELETE');
      setLinks((prev) => prev.filter((l) => l._id !== linkId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove link');
    }
  }

  const relationshipOptions = useMemo(() => {
    const asset = (config?.assetRelationshipTypes || []).map((r) => ({ ...r, group: 'Asset' }));
    const service = (config?.serviceRelationshipTypes || []).map((r) => ({
      key: r.key,
      label: r.label,
      group: 'Service',
    }));
    return [...asset, ...service];
  }, [config]);

  const noteItems = useMemo(() => {
    const fromActivities = activities.filter((a) => a.type === 'note');
    const mirrored = fromActivities.some(
      (a) => partner?.notes && (a.summary === partner.notes || a.details?.text === partner.notes)
    );
    if (partner?.notes && !mirrored) {
      return [
        ...fromActivities,
        {
          _id: 'partner-notes-field',
          createdAt: (partner as any).updatedAt || (partner as any).createdAt || null,
          summary: partner.notes,
          type: 'note',
        },
      ];
    }
    return fromActivities;
  }, [activities, partner]);

  if (loading) return <LoadingSpinner message="Loading partner..." />;
  if (error) {
    return (
      <div className="space-y-3">
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
        <Link href="/dashboard/partners/list" className="text-xs text-blue-300 no-underline">
          ← Back to partners
        </Link>
      </div>
    );
  }
  if (!partner) return null;

  const typeName = config?.partnerTypes.find((t) => t.id === partner.partnerTypeKey)?.name || partner.partnerTypeKey || '—';
  const categoryName =
    config?.categories.find((c) => c.id === partner.categoryKey)?.name || partner.categoryKey || partner.category || '—';
  const statusColor = config?.statuses.find((s) => s.id === partner.status)?.color;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/partners/list" className="text-[11px] text-gray-500 hover:text-gray-300 no-underline">
            ← All partners
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-100">{partner.name}</h2>
            <span className="text-xs font-mono text-gray-500">{partner.partnerCode}</span>
            <span
              className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded-md border"
              style={
                statusColor
                  ? { color: statusColor, backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }
                  : undefined
              }
            >
              {partner.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {typeName} · {categoryName}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button type="button" onClick={handleDelete} className={btnDanger}>
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Assets', value: stats?.assetCount ?? assets.length, accent: 'text-blue-300' },
          { label: 'Invoices', value: stats?.invoiceCount ?? invoices.length, accent: 'text-violet-300' },
          { label: 'Spend', value: formatMoney(stats?.totalPurchased || 0, partner.currency), accent: 'text-emerald-300' },
          { label: 'Pending', value: formatMoney(stats?.pendingPayment || 0, partner.currency), accent: 'text-amber-300' },
          { label: 'Contracts', value: stats?.contractCount ?? contracts.length, accent: 'text-cyan-300' },
        ].map((card) => (
          <div key={card.label} className="px-3 py-2 rounded-xl border border-gray-700/50 bg-gray-900/40">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-sm font-semibold mt-1 tabular-nums ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {enabledSections('general') && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="general"
            editingSection={editingSection}
            saving={savingSection === 'general'}
            onEdit={startEditGeneral}
            onSave={saveGeneral}
            onCancel={() => setEditingSection(null)}
          >
            General information
          </SectionTitle>
          {editingSection === 'general' ? (
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  required
                  className={inputClass}
                  value={generalDraft.name}
                  onChange={(e) => setGeneralDraft({ ...generalDraft, name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select
                  className={inputClass}
                  value={generalDraft.partnerTypeKey}
                  onChange={(e) => setGeneralDraft({ ...generalDraft, partnerTypeKey: e.target.value })}
                >
                  {(config?.partnerTypes || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select
                  className={inputClass}
                  value={generalDraft.categoryKey}
                  onChange={(e) => setGeneralDraft({ ...generalDraft, categoryKey: e.target.value })}
                >
                  {(config?.categories || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  className={inputClass}
                  value={generalDraft.status}
                  onChange={(e) => setGeneralDraft({ ...generalDraft, status: e.target.value })}
                >
                  {(config?.statuses || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={generalDraft.email}
                  onChange={(e) => setGeneralDraft({ ...generalDraft, email: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  className={inputClass}
                  value={generalDraft.phone}
                  onChange={(e) => setGeneralDraft({ ...generalDraft, phone: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input
                  className={inputClass}
                  value={generalDraft.website}
                  onChange={(e) => setGeneralDraft({ ...generalDraft, website: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <input
                  className={inputClass}
                  value={generalDraft.currency}
                  onChange={(e) => setGeneralDraft({ ...generalDraft, currency: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Type</p>
                <p className="text-gray-200">{typeName}</p>
              </div>
              <div>
                <p className="text-gray-500">Category</p>
                <p className="text-gray-200">{categoryName}</p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <p className="text-gray-200">{partner.status || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="text-gray-200">{partner.email || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="text-gray-200">{partner.phone || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Website</p>
                <p className="text-gray-200">{partner.website || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Currency</p>
                <p className="text-gray-200">{partner.currency || 'INR'}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {enabledSections('tax') && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="tax"
            editingSection={editingSection}
            saving={savingSection === 'tax'}
            onEdit={startEditTax}
            onSave={saveTax}
            onCancel={() => setEditingSection(null)}
          >
            Tax information
          </SectionTitle>
          {editingSection === 'tax' ? (
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Tax ID</label>
                <input
                  className={inputClass}
                  value={taxDraft.taxId || ''}
                  onChange={(e) => setTaxDraft({ ...taxDraft, taxId: e.target.value })}
                />
              </div>
              <KeyValueEditGrid
                draft={Object.fromEntries(Object.entries(taxDraft).filter(([k]) => k !== 'taxId'))}
                onChange={(key, value) => setTaxDraft({ ...taxDraft, [key]: value })}
                priorityKeys={['gst', 'vat']}
              />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Tax ID</p>
                <p className="text-gray-200">{partner.taxId || '—'}</p>
              </div>
              {Object.entries(partner.taxDetails || {}).map(([k, v]) => (
                <div key={k}>
                  <p className="text-gray-500 capitalize">{k}</p>
                  <p className="text-gray-200">{String(v ?? '—')}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {enabledSections('registration') && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="registration"
            editingSection={editingSection}
            saving={savingSection === 'registration'}
            onEdit={startEditRegistration}
            onSave={saveRegistration}
            onCancel={() => setEditingSection(null)}
          >
            Registration details
          </SectionTitle>
          {editingSection === 'registration' ? (
            <KeyValueEditGrid
              draft={registrationDraft}
              onChange={(key, value) => setRegistrationDraft({ ...registrationDraft, [key]: value })}
              priorityKeys={['registrationNumber', 'country']}
            />
          ) : (
            <KeyValueDisplay data={partner.registrationDetails} />
          )}
        </section>
      )}

      {enabledSections('business') && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="business"
            editingSection={editingSection}
            saving={savingSection === 'business'}
            onEdit={startEditBusiness}
            onSave={saveBusiness}
            onCancel={() => setEditingSection(null)}
          >
            Business details
          </SectionTitle>
          {editingSection === 'business' ? (
            <KeyValueEditGrid
              draft={businessDraft}
              onChange={(key, value) => setBusinessDraft({ ...businessDraft, [key]: value })}
              priorityKeys={['industry', 'website']}
            />
          ) : (
            <KeyValueDisplay data={partner.businessDetails} />
          )}
        </section>
      )}

      {enabledSections('contacts') && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="contacts"
            editingSection={editingSection}
            onEdit={() => setEditingSection('contacts')}
            onCancel={() => setEditingSection(null)}
            toggleOnly
          >
            Contacts
          </SectionTitle>
          <div className="rounded-lg border border-gray-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 border-b border-gray-700/60">
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Role</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Phone</th>
                  <th className={thClass}>Primary</th>
                  {editingSection === 'contacts' && <th className={`${thClass} text-center`}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {(partner.contacts || []).length === 0 && (
                  <EmptyRow cols={editingSection === 'contacts' ? 6 : 5} message="No contacts" />
                )}
                {(partner.contacts || []).map((c) => (
                  <tr key={String(c._id)} className="hover:bg-gray-800/40">
                    <td className={tdClass}>{c.name}</td>
                    <td className={tdClass}>{c.role || '—'}</td>
                    <td className={tdClass}>{c.email || '—'}</td>
                    <td className={tdClass}>{c.phone || c.mobile || '—'}</td>
                    <td className={tdClass}>{c.isPrimary ? 'Yes' : '—'}</td>
                    {editingSection === 'contacts' && (
                      <td className={`${tdClass} text-center`}>
                        <button type="button" className={btnDanger} onClick={() => removeContact(String(c._id))}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editingSection === 'contacts' && (
            <form onSubmit={addContact} className="grid md:grid-cols-6 gap-2 items-end">
              <div>
                <label className={labelClass}>Name *</label>
                <input required className={inputClass} value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <input className={inputClass} value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" className={inputClass} value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input className={inputClass} value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <input
                  id="contact-primary"
                  type="checkbox"
                  checked={contactForm.isPrimary}
                  onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                />
                <label htmlFor="contact-primary" className="text-xs text-gray-400">
                  Primary
                </label>
              </div>
              <button type="submit" className={btnPrimary}>
                Add contact
              </button>
            </form>
          )}
        </section>
      )}

      {enabledSections('addresses') && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="addresses"
            editingSection={editingSection}
            onEdit={() => setEditingSection('addresses')}
            onCancel={() => setEditingSection(null)}
            toggleOnly
          >
            Addresses
          </SectionTitle>
          <div className="rounded-lg border border-gray-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 border-b border-gray-700/60">
                <tr>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Label</th>
                  <th className={thClass}>Street</th>
                  <th className={thClass}>City</th>
                  <th className={thClass}>Country</th>
                  {editingSection === 'addresses' && <th className={`${thClass} text-center`}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {(partner.addresses || []).length === 0 && (
                  <EmptyRow cols={editingSection === 'addresses' ? 6 : 5} message="No addresses" />
                )}
                {(partner.addresses || []).map((a) => (
                  <tr key={String(a._id)} className="hover:bg-gray-800/40">
                    <td className={tdClass}>
                      {config?.addressTypes.find((t) => t.id === a.typeKey)?.name || a.typeKey || '—'}
                    </td>
                    <td className={tdClass}>{a.label || '—'}</td>
                    <td className={tdClass}>{a.street || '—'}</td>
                    <td className={tdClass}>{a.city || '—'}</td>
                    <td className={tdClass}>{a.country || '—'}</td>
                    {editingSection === 'addresses' && (
                      <td className={`${tdClass} text-center`}>
                        <button type="button" className={btnDanger} onClick={() => removeAddress(String(a._id))}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editingSection === 'addresses' && (
            <form onSubmit={addAddress} className="grid md:grid-cols-4 gap-2">
              <div>
                <label className={labelClass}>Type</label>
                <select className={inputClass} value={addressForm.typeKey} onChange={(e) => setAddressForm({ ...addressForm, typeKey: e.target.value })}>
                  {(config?.addressTypes || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Label</label>
                <input className={inputClass} value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Street</label>
                <input className={inputClass} value={addressForm.street} onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input className={inputClass} value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>State</label>
                <input className={inputClass} value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>ZIP</label>
                <input className={inputClass} value={addressForm.zipCode} onChange={(e) => setAddressForm({ ...addressForm, zipCode: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input className={inputClass} value={addressForm.country} onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })} />
              </div>
              <div className="flex items-end">
                <button type="submit" className={btnPrimary}>
                  Add address
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {enabledSections('bank') && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="bank"
            editingSection={editingSection}
            saving={savingSection === 'bank'}
            onEdit={startEditBank}
            onSave={saveBank}
            onCancel={() => setEditingSection(null)}
          >
            Bank details
          </SectionTitle>
          {editingSection === 'bank' ? (
            <KeyValueEditGrid
              draft={bankDraft}
              onChange={(key, value) => setBankDraft({ ...bankDraft, [key]: value })}
              priorityKeys={['bankName', 'accountNumber', 'ifsc']}
            />
          ) : (
            <KeyValueDisplay data={partner.bankDetails} />
          )}
        </section>
      )}

      {enabledSections('payment') && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="payment"
            editingSection={editingSection}
            saving={savingSection === 'payment'}
            onEdit={startEditPayment}
            onSave={savePayment}
            onCancel={() => setEditingSection(null)}
          >
            Payment terms
          </SectionTitle>
          {editingSection === 'payment' ? (
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Terms</label>
                <input
                  className={inputClass}
                  value={paymentDraft.paymentTerms}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, paymentTerms: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Credit limit</label>
                <input
                  type="number"
                  className={inputClass}
                  value={paymentDraft.creditLimit}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, creditLimit: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <input
                  className={inputClass}
                  value={paymentDraft.currency}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, currency: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Terms</p>
                <p className="text-gray-200">{partner.paymentTerms || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Credit limit</p>
                <p className="text-gray-200">
                  {partner.creditLimit != null ? formatMoney(Number(partner.creditLimit), partner.currency) : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Currency</p>
                <p className="text-gray-200">{partner.currency || 'INR'}</p>
              </div>
            </div>
          )}
        </section>
      )}

      <section className={sectionClass}>
        <SectionTitle
          canEdit={canEdit}
          sectionKey="tags"
          editingSection={editingSection}
          onEdit={() => setEditingSection('tags')}
          onCancel={() => setEditingSection(null)}
          toggleOnly
        >
          Tags
        </SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {(partner.tags || []).length === 0 && <span className="text-xs text-gray-500">No tags</span>}
          {(partner.tags || []).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border border-gray-700/60 bg-gray-800/60 text-gray-300">
              {tag}
              {editingSection === 'tags' && (
                <button type="button" className="text-gray-500 hover:text-red-300" onClick={() => removeTag(tag)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {editingSection === 'tags' && (
          <div className="flex gap-2 max-w-md">
            <input
              className={inputClass}
              placeholder="Add tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveTags();
                }
              }}
            />
            <button type="button" className={btnPrimary} onClick={saveTags}>
              Save
            </button>
          </div>
        )}
      </section>

      <section className={sectionClass}>
        <SectionTitle>Notes</SectionTitle>
        {canEdit && (
          <form onSubmit={addNote} className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Add a note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button type="submit" className={btnPrimary} disabled={!noteText.trim()}>
              Post
            </button>
          </form>
        )}
        <ul className="space-y-2">
          {noteItems.length === 0 && <li className="text-xs text-gray-500">No notes yet</li>}
          {noteItems.map((a) => (
            <li key={a._id} className="text-xs text-gray-300 border-b border-gray-800/80 pb-2">
              <span className="text-gray-500">{formatDate(a.createdAt)} · </span>
              {a.summary}
            </li>
          ))}
        </ul>
      </section>

      {enabledSections('custom') && (config?.customFields?.length || 0) > 0 && (
        <section className={sectionClass}>
          <SectionTitle
            canEdit={canEdit}
            sectionKey="custom"
            editingSection={editingSection}
            saving={savingSection === 'custom'}
            onEdit={startEditCustom}
            onSave={saveCustom}
            onCancel={() => setEditingSection(null)}
          >
            Custom fields
          </SectionTitle>
          {editingSection === 'custom' ? (
            <div className="grid md:grid-cols-3 gap-3">
              {(config?.customFields || []).map((field) => (
                <div key={field.key}>
                  <label className={labelClass}>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      className={inputClass}
                      value={customDraft[field.key] || ''}
                      onChange={(e) => setCustomDraft({ ...customDraft, [field.key]: e.target.value })}
                    >
                      <option value="">—</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inputClass}
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={customDraft[field.key] || ''}
                      onChange={(e) => setCustomDraft({ ...customDraft, [field.key]: e.target.value })}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              {(config?.customFields || []).map((field) => (
                <div key={field.key}>
                  <p className="text-gray-500">{field.label}</p>
                  <p className="text-gray-200">
                    {partner.customFields?.[field.key] != null && String(partner.customFields[field.key]) !== ''
                      ? String(partner.customFields[field.key])
                      : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className={sectionClass}>
        <SectionTitle>Assets</SectionTitle>
        <div className="rounded-lg border border-gray-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className={thClass}>Asset ID</th>
                <th className={thClass}>Name</th>
                <th className={thClass}>Category</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Cost</th>
                <th className={thClass}>Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {assets.length === 0 && <EmptyRow cols={6} message="No linked assets" />}
              {assets.map((a) => (
                <tr key={a._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>
                    <Link href={`/dashboard/assets/${a._id}`} className="text-blue-300 no-underline">
                      {a.assetId}
                    </Link>
                  </td>
                  <td className={tdClass}>{a.name}</td>
                  <td className={tdClass}>{a.category || '—'}</td>
                  <td className={tdClass}>{a.status || '—'}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(a.cost || 0, partner.currency)}</td>
                  <td className={tdClass}>{formatDate(a.purchaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sectionClass}>
        <SectionTitle>Invoices</SectionTitle>
        <div className="rounded-lg border border-gray-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className={thClass}>Invoice #</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Total</th>
                <th className={`${thClass} text-right`}>Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {invoices.length === 0 && <EmptyRow cols={5} message="No invoices" />}
              {invoices.map((inv) => (
                <tr key={inv._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>{inv.invoiceNumber}</td>
                  <td className={tdClass}>{formatDate(inv.purchaseDate)}</td>
                  <td className={tdClass}>{inv.status}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(inv.totalAmount || 0, partner.currency)}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(inv.paidAmount || 0, partner.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sectionClass}>
        <SectionTitle>Procurements</SectionTitle>
        <div className="rounded-lg border border-gray-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className={thClass}>Title / Ref</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {procurements.length === 0 && <EmptyRow cols={4} message="No procurements" />}
              {procurements.map((p) => (
                <tr key={p._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>{p.title || p.poNumber || p._id}</td>
                  <td className={tdClass}>{formatDate(p.purchaseDate || p.createdAt)}</td>
                  <td className={tdClass}>{p.status || '—'}</td>
                  <td className={`${tdClass} text-right`}>
                    {formatMoney(p.amount || p.totalAmount || 0, partner.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sectionClass}>
        <SectionTitle>Contracts</SectionTitle>
        <div className="rounded-lg border border-gray-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className={thClass}>Number</th>
                <th className={thClass}>Title</th>
                <th className={thClass}>Start</th>
                <th className={thClass}>End</th>
                <th className={thClass}>Status</th>
                {canEdit && <th className={`${thClass} text-center`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {contracts.length === 0 && <EmptyRow cols={canEdit ? 6 : 5} message="No contracts" />}
              {contracts.map((c) => (
                <tr key={c._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>{c.contractNumber}</td>
                  <td className={tdClass}>{c.title || '—'}</td>
                  <td className={tdClass}>{formatDate(c.startDate)}</td>
                  <td className={tdClass}>{formatDate(c.endDate)}</td>
                  <td className={tdClass}>{c.status}</td>
                  {canEdit && (
                    <td className={`${tdClass} text-center`}>
                      <button type="button" className={btnDanger} onClick={() => removeContract(c._id)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <form onSubmit={addContract} className="grid md:grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Contract # *</label>
              <input required className={inputClass} value={contractForm.contractNumber} onChange={(e) => setContractForm({ ...contractForm, contractNumber: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Title</label>
              <input className={inputClass} value={contractForm.title} onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={contractForm.status} onChange={(e) => setContractForm({ ...contractForm, status: e.target.value })}>
                {['Draft', 'Active', 'Expired', 'Renewed', 'Cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Start</label>
              <input type="date" className={inputClass} value={contractForm.startDate} onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>End</label>
              <input type="date" className={inputClass} value={contractForm.endDate} onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })} />
            </div>
            <div className="flex items-end">
              <button type="submit" className={btnPrimary}>
                Add contract
              </button>
            </div>
          </form>
        )}
      </section>

      <section className={sectionClass}>
        <SectionTitle>Links</SectionTitle>
        <div className="rounded-lg border border-gray-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className={thClass}>Relationship</th>
                <th className={thClass}>Resource type</th>
                <th className={thClass}>Resource ID</th>
                <th className={thClass}>Notes</th>
                {canEdit && <th className={`${thClass} text-center`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {links.length === 0 && <EmptyRow cols={canEdit ? 5 : 4} message="No links" />}
              {links.map((l) => (
                <tr key={l._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>
                    {relationshipOptions.find((r) => r.key === l.relationshipTypeKey)?.label || l.relationshipTypeKey}
                  </td>
                  <td className={tdClass}>{l.resourceType}</td>
                  <td className={`${tdClass} font-mono`}>{String(l.resourceId)}</td>
                  <td className={tdClass}>{l.notes || '—'}</td>
                  {canEdit && (
                    <td className={`${tdClass} text-center`}>
                      <button type="button" className={btnDanger} onClick={() => removeLink(l._id)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <form onSubmit={addLink} className="grid md:grid-cols-4 gap-2">
            <div>
              <label className={labelClass}>Relationship *</label>
              <select
                className={inputClass}
                value={linkForm.relationshipTypeKey}
                onChange={(e) => setLinkForm({ ...linkForm, relationshipTypeKey: e.target.value })}
              >
                {relationshipOptions.map((r) => (
                  <option key={`${r.group}-${r.key}`} value={r.key}>
                    {r.group}: {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Resource type *</label>
              <select
                className={inputClass}
                value={linkForm.resourceType}
                onChange={(e) => setLinkForm({ ...linkForm, resourceType: e.target.value })}
              >
                <option value="asset">asset</option>
                <option value="invoice">invoice</option>
                <option value="procurement">procurement</option>
                <option value="maintenance">maintenance</option>
                <option value="work_order">work_order</option>
                <option value="audit">audit</option>
                <option value="issue">issue</option>
                <option value="inspection">inspection</option>
                <option value="project">project</option>
                <option value="budget">budget</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Resource ID *</label>
              <input
                required
                className={inputClass}
                value={linkForm.resourceId}
                onChange={(e) => setLinkForm({ ...linkForm, resourceId: e.target.value })}
                placeholder="Mongo ObjectId"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className={btnPrimary}>
                Add link
              </button>
            </div>
          </form>
        )}
      </section>

      <section className={sectionClass}>
        <SectionTitle>Activity</SectionTitle>
        <PartnerActivityList
          activities={activities}
          showPartner={false}
          maxHeightClass="max-h-80 overflow-y-auto"
        />
      </section>

      <section className={sectionClass}>
        <SectionTitle>Performance</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {performance.length === 0 && <p className="text-xs text-gray-500 col-span-full">No KPIs available</p>}
          {performance.map((kpi) => (
            <div key={kpi.key} className="px-3 py-2 rounded-lg border border-gray-700/50 bg-gray-900/40">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{kpi.label}</p>
              <p className="text-sm font-semibold text-blue-300 mt-1 tabular-nums">
                {kpi.available === false || kpi.value == null
                  ? '—'
                  : kpi.unit === 'currency'
                    ? formatMoney(Number(kpi.value), partner.currency)
                    : `${kpi.value}${kpi.unit === 'percent' ? '%' : kpi.unit && kpi.unit !== 'count' && kpi.unit !== 'score' ? ` ${kpi.unit}` : ''}`}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
