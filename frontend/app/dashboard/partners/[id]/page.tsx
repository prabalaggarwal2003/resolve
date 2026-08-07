'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  fetchPartner,
  fetchPartnerConfig,
  updatePartner,
  deletePartner,
  partnerAction,
  createPartnerInvoice,
  updatePartnerInvoice,
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

const TAX_DETAIL_KEYS = ['gstin', 'pan', 'tan', 'vat', 'tin', 'taxExemptionNumber', 'placeOfSupply'];
const REGISTRATION_KEYS = [
  'legalName',
  'registrationNumber',
  'registrationType',
  'incorporationDate',
  'cin',
  'pan',
  'country',
  'stateOfRegistration',
];
const BUSINESS_KEYS = [
  'industry',
  'legalStructure',
  'yearEstablished',
  'employeeCount',
  'website',
  'serviceCategories',
  'slaNotes',
];
const BANK_KEYS = [
  'bankName',
  'accountName',
  'accountNumber',
  'accountType',
  'ifsc',
  'swift',
  'branch',
  'iban',
];
const PAYMENT_DETAIL_KEYS = [
  'preferredPaymentMethod',
  'billingCycle',
  'earlyPaymentDiscount',
  'lateFeePolicy',
  'invoiceEmail',
  'poRequired',
];
const ASSETS_PAGE_SIZE = 8;

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

function KeyValueDisplay({
  data,
  guaranteedKeys = [],
}: {
  data: Record<string, unknown> | undefined;
  guaranteedKeys?: string[];
}) {
  const merged = initMapDraft(data, guaranteedKeys);
  const keys = [...guaranteedKeys, ...Object.keys(merged).filter((k) => !guaranteedKeys.includes(k))];
  if (!keys.length) return <p className="text-xs text-gray-500">No details</p>;
  return (
    <div className="grid md:grid-cols-3 gap-3 text-xs">
      {keys.map((k) => (
        <div key={k}>
          <p className="text-gray-500">{labelize(k)}</p>
          <p className="text-gray-200">{merged[k] ? merged[k] : '—'}</p>
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
  const searchParams = useSearchParams();
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
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [assetsPage, setAssetsPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [highlightedContractId, setHighlightedContractId] = useState<string | null>(null);
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const deepLinkHandled = useRef(false);

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
  const [paymentDraft, setPaymentDraft] = useState({
    paymentTerms: '',
    creditLimit: '',
    currency: 'INR',
    preferredPaymentMethod: '',
    billingCycle: '',
    earlyPaymentDiscount: '',
    lateFeePolicy: '',
    invoiceEmail: '',
    poRequired: '',
  });
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});

  const [contactForm, setContactForm] = useState({
    name: '',
    role: '',
    department: '',
    email: '',
    phone: '',
    mobile: '',
    whatsapp: '',
    notes: '',
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
    renewalDate: '',
    autoRenewal: false,
    reminderDays: '30',
    status: 'Draft',
    notes: '',
  });
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    purchaseDate: '',
    dueDate: '',
    totalAmount: '',
    paidAmount: '',
    currency: 'INR',
    status: 'Pending',
    paymentMethod: 'Bank Transfer',
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
      const [cfg, data] = await Promise.all([fetchPartnerConfig(), fetchPartner(id)]);
      setConfig(cfg);
      const p = data.partner || data.vendor || null;
      setPartner(p);
      setAssets(data.assets || []);
      setInvoices(data.invoices || []);
      setProcurements(data.procurements || []);
      setContracts(data.contracts || []);
      setActivities(data.activities || []);
      setStats(data.stats || null);
      setAssetsPage(1);
      setAddressForm((prev) => ({
        ...prev,
        typeKey: cfg.addressTypes?.[0]?.id || '',
      }));
      setInvoiceForm((prev) => ({
        ...prev,
        currency: p?.currency || cfg.settings?.defaultCurrency || 'INR',
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

  useEffect(() => {
    deepLinkHandled.current = false;
  }, [id, searchParams.get('invoiceId'), searchParams.get('contractId')]);

  useEffect(() => {
    if (loading || deepLinkHandled.current) return;
    const invoiceId = searchParams.get('invoiceId');
    const contractId = searchParams.get('contractId');
    if (!invoiceId && !contractId) return;

    let handled = false;

    if (invoiceId) {
      const inv = invoices.find((i) => String(i._id) === invoiceId);
      if (inv) {
        setHighlightedInvoiceId(invoiceId);
        setSelectedInvoice(inv);
        requestAnimationFrame(() => {
          document.getElementById('partner-invoices')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        handled = true;
      }
    }

    if (contractId) {
      const contract = contracts.find((c) => String(c._id) === contractId);
      if (contract) {
        setHighlightedContractId(contractId);
        requestAnimationFrame(() => {
          document.getElementById('partner-contracts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          document.getElementById(`contract-${contractId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        handled = true;
      }
    }

    if (handled) deepLinkHandled.current = true;
  }, [loading, invoices, contracts, searchParams]);

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
    const details = initMapDraft(partner?.taxDetails, TAX_DETAIL_KEYS);
    setTaxDraft({ taxId: partner?.taxId || '', ...details });
    setEditingSection('tax');
  }

  async function saveTax() {
    const { taxId, ...taxDetails } = taxDraft;
    await saveSection('tax', { taxId, taxDetails });
  }

  function startEditRegistration() {
    setRegistrationDraft(initMapDraft(partner?.registrationDetails, REGISTRATION_KEYS));
    setEditingSection('registration');
  }

  async function saveRegistration() {
    await saveSection('registration', { registrationDetails: registrationDraft });
  }

  function startEditBusiness() {
    setBusinessDraft(initMapDraft(partner?.businessDetails, BUSINESS_KEYS));
    setEditingSection('business');
  }

  async function saveBusiness() {
    await saveSection('business', { businessDetails: businessDraft });
  }

  function startEditBank() {
    setBankDraft(initMapDraft(partner?.bankDetails, BANK_KEYS));
    setEditingSection('bank');
  }

  async function saveBank() {
    await saveSection('bank', { bankDetails: bankDraft });
  }

  function startEditPayment() {
    const details = initMapDraft(partner?.paymentDetails, PAYMENT_DETAIL_KEYS);
    setPaymentDraft({
      paymentTerms: partner?.paymentTerms || '',
      creditLimit: partner?.creditLimit != null ? String(partner.creditLimit) : '',
      currency: partner?.currency || 'INR',
      preferredPaymentMethod: details.preferredPaymentMethod || '',
      billingCycle: details.billingCycle || '',
      earlyPaymentDiscount: details.earlyPaymentDiscount || '',
      lateFeePolicy: details.lateFeePolicy || '',
      invoiceEmail: details.invoiceEmail || '',
      poRequired: details.poRequired || '',
    });
    setEditingSection('payment');
  }

  async function savePayment() {
    const {
      paymentTerms,
      creditLimit,
      currency,
      preferredPaymentMethod,
      billingCycle,
      earlyPaymentDiscount,
      lateFeePolicy,
      invoiceEmail,
      poRequired,
    } = paymentDraft;
    await saveSection('payment', {
      paymentTerms,
      creditLimit: creditLimit === '' ? null : Number(creditLimit),
      currency,
      paymentDetails: {
        preferredPaymentMethod,
        billingCycle,
        earlyPaymentDiscount,
        lateFeePolicy,
        invoiceEmail,
        poRequired,
      },
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

  function resetContactForm() {
    setContactForm({
      name: '',
      role: '',
      department: '',
      email: '',
      phone: '',
      mobile: '',
      whatsapp: '',
      notes: '',
      isPrimary: false,
    });
    setEditingContactId(null);
  }

  function startEditContact(c: any) {
    setEditingContactId(String(c._id));
    setContactForm({
      name: c.name || '',
      role: c.role || '',
      department: c.department || '',
      email: c.email || '',
      phone: c.phone || '',
      mobile: c.mobile || '',
      whatsapp: c.whatsapp || '',
      notes: c.notes || '',
      isPrimary: Boolean(c.isPrimary),
    });
    setEditingSection('contacts');
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const data = editingContactId
        ? await partnerAction(`/${id}/contacts/${editingContactId}`, 'PUT', contactForm)
        : await partnerAction(`/${id}/contacts`, 'POST', contactForm);
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      resetContactForm();
    } catch (err: any) {
      alert(err.message || 'Failed to save contact');
    }
  }

  async function removeContact(contactId: string) {
    if (!confirm('Remove this contact?')) return;
    try {
      const data = await partnerAction(`/${id}/contacts/${contactId}`, 'DELETE');
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      if (editingContactId === contactId) resetContactForm();
    } catch (err: any) {
      alert(err.message || 'Failed to remove contact');
    }
  }

  function resetAddressForm() {
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
    setEditingAddressId(null);
  }

  function startEditAddress(a: any) {
    setEditingAddressId(String(a._id));
    setAddressForm({
      typeKey: a.typeKey || config?.addressTypes?.[0]?.id || '',
      label: a.label || '',
      street: a.street || '',
      city: a.city || '',
      state: a.state || '',
      zipCode: a.zipCode || '',
      country: a.country || '',
      isPrimary: Boolean(a.isPrimary),
    });
    setEditingSection('addresses');
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const data = editingAddressId
        ? await partnerAction(`/${id}/addresses/${editingAddressId}`, 'PUT', addressForm)
        : await partnerAction(`/${id}/addresses`, 'POST', addressForm);
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      resetAddressForm();
    } catch (err: any) {
      alert(err.message || 'Failed to save address');
    }
  }

  async function removeAddress(addressId: string) {
    if (!confirm('Remove this address?')) return;
    try {
      const data = await partnerAction(`/${id}/addresses/${addressId}`, 'DELETE');
      if (data.partner) setPartner(data.partner);
      else await refreshPartnerOnly();
      if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      if (editingAddressId === addressId) resetAddressForm();
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

  function resetContractForm() {
    setContractForm({
      contractNumber: '',
      title: '',
      startDate: '',
      endDate: '',
      renewalDate: '',
      autoRenewal: false,
      reminderDays: '30',
      status: 'Draft',
      notes: '',
    });
    setEditingContractId(null);
  }

  function startEditContract(c: any) {
    setEditingContractId(String(c._id));
    setContractForm({
      contractNumber: c.contractNumber || '',
      title: c.title || '',
      startDate: c.startDate ? String(c.startDate).slice(0, 10) : '',
      endDate: c.endDate ? String(c.endDate).slice(0, 10) : '',
      renewalDate: c.renewalDate ? String(c.renewalDate).slice(0, 10) : '',
      autoRenewal: Boolean(c.autoRenewal),
      reminderDays: c.reminderDays != null ? String(c.reminderDays) : '30',
      status: c.status || 'Draft',
      notes: c.notes || '',
    });
  }

  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const payload = {
        ...contractForm,
        reminderDays: contractForm.reminderDays === '' ? 30 : Number(contractForm.reminderDays),
        autoRenewal: Boolean(contractForm.autoRenewal),
      };
      if (editingContractId) {
        const data = await partnerAction(`/${id}/contracts/${editingContractId}`, 'PUT', payload);
        if (data.contract) {
          setContracts((prev) => prev.map((c) => (String(c._id) === editingContractId ? data.contract : c)));
        } else {
          await refreshRelated();
        }
        if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      } else {
        const data = await partnerAction(`/${id}/contracts`, 'POST', payload);
        if (data.contract) {
          setContracts((prev) => [data.contract, ...prev]);
          setStats((prev: any) => (prev ? { ...prev, contractCount: (prev.contractCount || 0) + 1 } : prev));
        } else {
          await refreshRelated();
        }
        if (data.activity) setActivities((prev) => [data.activity, ...prev]);
      }
      resetContractForm();
    } catch (err: any) {
      alert(err.message || 'Failed to save contract');
    }
  }

  async function removeContract(contractId: string) {
    if (!confirm('Delete this contract?')) return;
    try {
      await partnerAction(`/${id}/contracts/${contractId}`, 'DELETE');
      setContracts((prev) => prev.filter((c) => c._id !== contractId));
      setStats((prev: any) => (prev ? { ...prev, contractCount: Math.max(0, (prev.contractCount || 0) - 1) } : prev));
      if (editingContractId === contractId) resetContractForm();
    } catch (err: any) {
      alert(err.message || 'Failed to delete contract');
    }
  }

  function resetInvoiceForm() {
    setInvoiceForm({
      invoiceNumber: '',
      purchaseDate: '',
      dueDate: '',
      totalAmount: '',
      paidAmount: '',
      currency: partner?.currency || 'INR',
      status: 'Pending',
      paymentMethod: 'Bank Transfer',
      notes: '',
    });
    setEditingInvoiceId(null);
  }

  function startEditInvoice(inv: any) {
    setEditingInvoiceId(String(inv._id));
    setShowInvoiceForm(true);
    setInvoiceForm({
      invoiceNumber: inv.invoiceNumber || '',
      purchaseDate: inv.purchaseDate ? String(inv.purchaseDate).slice(0, 10) : '',
      dueDate: inv.dueDate ? String(inv.dueDate).slice(0, 10) : '',
      totalAmount: inv.totalAmount != null ? String(inv.totalAmount) : '',
      paidAmount: inv.paidAmount != null ? String(inv.paidAmount) : '',
      currency: inv.currency || partner?.currency || 'INR',
      status: inv.status || 'Pending',
      paymentMethod: inv.paymentMethod || 'Bank Transfer',
      notes: inv.notes || '',
    });
  }

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !partner) return;
    setSavingInvoice(true);
    try {
      const totalAmount = Number(invoiceForm.totalAmount) || 0;
      const paidAmount = Number(invoiceForm.paidAmount) || 0;
      const payload = {
        invoiceNumber: invoiceForm.invoiceNumber.trim(),
        purchaseDate: invoiceForm.purchaseDate || new Date().toISOString().slice(0, 10),
        dueDate: invoiceForm.dueDate || undefined,
        totalAmount,
        paidAmount,
        currency: invoiceForm.currency || partner.currency || 'INR',
        status: invoiceForm.status,
        paymentMethod: invoiceForm.paymentMethod,
        notes: invoiceForm.notes,
      };
      if (editingInvoiceId) {
        const updated = await updatePartnerInvoice(editingInvoiceId, payload);
        setInvoices((prev) => prev.map((inv) => (String(inv._id) === editingInvoiceId ? { ...inv, ...updated } : inv)));
        if (selectedInvoice && String(selectedInvoice._id) === editingInvoiceId) {
          setSelectedInvoice({ ...selectedInvoice, ...updated });
        }
      } else {
        const created = await createPartnerInvoice({
          ...payload,
          vendorId: partner._id,
          partnerId: partner._id,
        });
        setInvoices((prev) => [created, ...prev]);
        setStats((prev: any) =>
          prev
            ? {
                ...prev,
                invoiceCount: (prev.invoiceCount || 0) + 1,
                totalPurchased: (prev.totalPurchased || 0) + totalAmount,
                pendingPayment: (prev.pendingPayment || 0) + Math.max(0, totalAmount - paidAmount),
              }
            : prev
        );
      }
      resetInvoiceForm();
      setShowInvoiceForm(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save invoice');
    } finally {
      setSavingInvoice(false);
    }
  }

  const pagedAssets = useMemo(() => {
    const start = (assetsPage - 1) * ASSETS_PAGE_SIZE;
    return assets.slice(start, start + ASSETS_PAGE_SIZE);
  }, [assets, assetsPage]);

  const assetsTotalPages = Math.max(1, Math.ceil(assets.length / ASSETS_PAGE_SIZE));

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
                priorityKeys={TAX_DETAIL_KEYS}
              />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Tax ID</p>
                <p className="text-gray-200">{partner.taxId || '—'}</p>
              </div>
              {TAX_DETAIL_KEYS.map((k) => (
                <div key={k}>
                  <p className="text-gray-500">{labelize(k)}</p>
                  <p className="text-gray-200">
                    {(partner.taxDetails && (partner.taxDetails as any)[k]) || '—'}
                  </p>
                </div>
              ))}
              {Object.keys(partner.taxDetails || {})
                .filter((k) => !TAX_DETAIL_KEYS.includes(k))
                .map((k) => (
                  <div key={k}>
                    <p className="text-gray-500">{labelize(k)}</p>
                    <p className="text-gray-200">{String((partner.taxDetails as any)[k] ?? '—')}</p>
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
              priorityKeys={REGISTRATION_KEYS}
            />
          ) : (
            <KeyValueDisplay data={partner.registrationDetails} guaranteedKeys={REGISTRATION_KEYS} />
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
              priorityKeys={BUSINESS_KEYS}
            />
          ) : (
            <KeyValueDisplay data={partner.businessDetails} guaranteedKeys={BUSINESS_KEYS} />
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
            onCancel={() => {
              setEditingSection(null);
              resetContactForm();
            }}
            toggleOnly
          >
            Contacts
          </SectionTitle>
          <div className="rounded-lg border border-gray-700/50 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-900/80 border-b border-gray-700/60">
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Role</th>
                  <th className={thClass}>Department</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Phone</th>
                  <th className={thClass}>Mobile</th>
                  <th className={thClass}>WhatsApp</th>
                  <th className={thClass}>Notes</th>
                  <th className={thClass}>Primary</th>
                  {editingSection === 'contacts' && <th className={`${thClass} text-center`}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {(partner.contacts || []).length === 0 && (
                  <EmptyRow cols={editingSection === 'contacts' ? 10 : 9} message="No contacts" />
                )}
                {(partner.contacts || []).map((c) => (
                  <tr key={String(c._id)} className={`hover:bg-gray-800/40 ${editingContactId === String(c._id) ? 'bg-blue-500/10' : ''}`}>
                    <td className={tdClass}>{c.name}</td>
                    <td className={tdClass}>{c.role || '—'}</td>
                    <td className={tdClass}>{c.department || '—'}</td>
                    <td className={tdClass}>{c.email || '—'}</td>
                    <td className={tdClass}>{c.phone || '—'}</td>
                    <td className={tdClass}>{c.mobile || '—'}</td>
                    <td className={tdClass}>{c.whatsapp || '—'}</td>
                    <td className={`${tdClass} max-w-[14rem] whitespace-normal break-words`}>{c.notes || '—'}</td>
                    <td className={tdClass}>{c.isPrimary ? 'Yes' : '—'}</td>
                    {editingSection === 'contacts' && (
                      <td className={`${tdClass} text-center space-x-1 whitespace-nowrap`}>
                        <button type="button" className={btnGhost} onClick={() => startEditContact(c)}>
                          Edit
                        </button>
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
            <form onSubmit={saveContact} className="grid md:grid-cols-4 gap-2 items-end">
              <div>
                <label className={labelClass}>Name *</label>
                <input required className={inputClass} value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <input className={inputClass} value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Department</label>
                <input className={inputClass} value={contactForm.department} onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" className={inputClass} value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input className={inputClass} value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Mobile</label>
                <input className={inputClass} value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>WhatsApp</label>
                <input className={inputClass} value={contactForm.whatsapp} onChange={(e) => setContactForm({ ...contactForm, whatsapp: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <input className={inputClass} value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} />
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
              <div className="flex gap-2">
                <button type="submit" className={btnPrimary}>
                  {editingContactId ? 'Update contact' : 'Add contact'}
                </button>
                {editingContactId && (
                  <button type="button" className={btnGhost} onClick={resetContactForm}>
                    Cancel edit
                  </button>
                )}
              </div>
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
            onCancel={() => {
              setEditingSection(null);
              resetAddressForm();
            }}
            toggleOnly
          >
            Addresses
          </SectionTitle>
          <div className="rounded-lg border border-gray-700/50 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-900/80 border-b border-gray-700/60">
                <tr>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Label</th>
                  <th className={thClass}>Street</th>
                  <th className={thClass}>City</th>
                  <th className={thClass}>State</th>
                  <th className={thClass}>ZIP</th>
                  <th className={thClass}>Country</th>
                  <th className={thClass}>Primary</th>
                  {editingSection === 'addresses' && <th className={`${thClass} text-center`}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {(partner.addresses || []).length === 0 && (
                  <EmptyRow cols={editingSection === 'addresses' ? 9 : 8} message="No addresses" />
                )}
                {(partner.addresses || []).map((a) => (
                  <tr key={String(a._id)} className={`hover:bg-gray-800/40 ${editingAddressId === String(a._id) ? 'bg-blue-500/10' : ''}`}>
                    <td className={tdClass}>
                      {config?.addressTypes.find((t) => t.id === a.typeKey)?.name || a.typeKey || '—'}
                    </td>
                    <td className={tdClass}>{a.label || '—'}</td>
                    <td className={tdClass}>{a.street || '—'}</td>
                    <td className={tdClass}>{a.city || '—'}</td>
                    <td className={tdClass}>{a.state || '—'}</td>
                    <td className={tdClass}>{a.zipCode || '—'}</td>
                    <td className={tdClass}>{a.country || '—'}</td>
                    <td className={tdClass}>{a.isPrimary ? 'Yes' : '—'}</td>
                    {editingSection === 'addresses' && (
                      <td className={`${tdClass} text-center space-x-1 whitespace-nowrap`}>
                        <button type="button" className={btnGhost} onClick={() => startEditAddress(a)}>
                          Edit
                        </button>
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
            <form onSubmit={saveAddress} className="grid md:grid-cols-4 gap-2">
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
              <div className="flex items-center gap-2 pb-0.5">
                <input
                  id="address-primary"
                  type="checkbox"
                  checked={addressForm.isPrimary}
                  onChange={(e) => setAddressForm({ ...addressForm, isPrimary: e.target.checked })}
                />
                <label htmlFor="address-primary" className="text-xs text-gray-400">Primary</label>
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" className={btnPrimary}>
                  {editingAddressId ? 'Update address' : 'Add address'}
                </button>
                {editingAddressId && (
                  <button type="button" className={btnGhost} onClick={resetAddressForm}>
                    Cancel edit
                  </button>
                )}
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
              priorityKeys={BANK_KEYS}
            />
          ) : (
            <KeyValueDisplay data={partner.bankDetails} guaranteedKeys={BANK_KEYS} />
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
                <label className={labelClass}>Payment terms</label>
                <input
                  className={inputClass}
                  value={paymentDraft.paymentTerms}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, paymentTerms: e.target.value })}
                  placeholder="Net 30"
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
              <div>
                <label className={labelClass}>Preferred payment method</label>
                <select
                  className={inputClass}
                  value={paymentDraft.preferredPaymentMethod}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, preferredPaymentMethod: e.target.value })}
                >
                  <option value="">Select</option>
                  {['Bank Transfer', 'Cheque', 'Cash', 'Credit Card', 'UPI', 'Other'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Billing cycle</label>
                <input
                  className={inputClass}
                  value={paymentDraft.billingCycle}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, billingCycle: e.target.value })}
                  placeholder="Monthly / Quarterly"
                />
              </div>
              <div>
                <label className={labelClass}>Early payment discount</label>
                <input
                  className={inputClass}
                  value={paymentDraft.earlyPaymentDiscount}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, earlyPaymentDiscount: e.target.value })}
                  placeholder="2% if paid in 10 days"
                />
              </div>
              <div>
                <label className={labelClass}>Late fee policy</label>
                <input
                  className={inputClass}
                  value={paymentDraft.lateFeePolicy}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, lateFeePolicy: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Invoice email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={paymentDraft.invoiceEmail}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, invoiceEmail: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>PO required</label>
                <select
                  className={inputClass}
                  value={paymentDraft.poRequired}
                  onChange={(e) => setPaymentDraft({ ...paymentDraft, poRequired: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Payment terms</p>
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
              {PAYMENT_DETAIL_KEYS.map((k) => (
                <div key={k}>
                  <p className="text-gray-500">{labelize(k)}</p>
                  <p className="text-gray-200">
                    {(partner.paymentDetails && (partner.paymentDetails as any)[k]) || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className={sectionClass}>
        <SectionTitle>Tags</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {(partner.tags || []).length === 0 && <span className="text-xs text-gray-500">No tags</span>}
          {(partner.tags || []).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border border-gray-700/60 bg-gray-800/60 text-gray-300">
              {tag}
              {canEdit && (
                <button type="button" className="text-gray-500 hover:text-red-300" onClick={() => removeTag(tag)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
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
              Add
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
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
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
                <th className={thClass}>Relationship</th>
                <th className={`${thClass} text-right`}>Cost</th>
                <th className={thClass}>Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {assets.length === 0 && <EmptyRow cols={7} message="No linked assets" />}
              {pagedAssets.map((a) => (
                <tr key={a._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>
                    <Link href={`/dashboard/assets/${a._id}`} className="text-blue-300 no-underline">
                      {a.assetId}
                    </Link>
                  </td>
                  <td className={tdClass}>{a.name}</td>
                  <td className={tdClass}>{a.category || '—'}</td>
                  <td className={tdClass}>{a.status || '—'}</td>
                  <td className={tdClass}>
                    {(() => {
                      const partnerId = String(partner?._id || id || '');
                      const rels = Array.isArray(a.partnerRelationships)
                        ? a.partnerRelationships.filter(
                            (r: any) => String(r.partnerId?._id || r.partnerId) === partnerId
                          )
                        : [];
                      const keys = rels.length
                        ? rels.map((r: any) => r.relationshipTypeKey).filter(Boolean)
                        : a.relationshipTypeKey
                        ? [a.relationshipTypeKey]
                        : [];
                      if (!keys.length) return '—';
                      return Array.from(new Set(keys as string[]))
                        .map(
                          (key) =>
                            config?.assetRelationshipTypes?.find((r) => r.key === key)?.label ||
                            String(key).replace(/_/g, ' ')
                        )
                        .join('; ');
                    })()}
                  </td>
                  <td className={`${tdClass} text-right`}>{formatMoney(a.cost || 0, partner.currency)}</td>
                  <td className={tdClass}>{formatDate(a.purchaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {assets.length > ASSETS_PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {(assetsPage - 1) * ASSETS_PAGE_SIZE + 1}–
              {Math.min(assetsPage * ASSETS_PAGE_SIZE, assets.length)} of {assets.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={btnGhost}
                disabled={assetsPage <= 1}
                onClick={() => setAssetsPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="text-gray-400 self-center">
                {assetsPage} / {assetsTotalPages}
              </span>
              <button
                type="button"
                className={btnGhost}
                disabled={assetsPage >= assetsTotalPages}
                onClick={() => setAssetsPage((p) => Math.min(assetsTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <section id="partner-invoices" className={sectionClass}>
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Invoices</SectionTitle>
          {canEdit && (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (showInvoiceForm) {
                  resetInvoiceForm();
                  setShowInvoiceForm(false);
                } else {
                  resetInvoiceForm();
                  setShowInvoiceForm(true);
                }
              }}
            >
              {showInvoiceForm ? 'Close form' : 'Add invoice'}
            </button>
          )}
        </div>
        {showInvoiceForm && canEdit && (
          <form onSubmit={saveInvoice} className="grid md:grid-cols-3 gap-2 rounded-lg border border-gray-700/50 p-3 bg-gray-900/40">
            <div>
              <label className={labelClass}>Invoice # *</label>
              <input required className={inputClass} value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Invoice date *</label>
              <input required type="date" className={inputClass} value={invoiceForm.purchaseDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, purchaseDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Due date</label>
              <input type="date" className={inputClass} value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Total amount *</label>
              <input required type="number" min="0" step="0.01" className={inputClass} value={invoiceForm.totalAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, totalAmount: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Paid amount</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={invoiceForm.paidAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, paidAmount: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <input className={inputClass} value={invoiceForm.currency} onChange={(e) => setInvoiceForm({ ...invoiceForm, currency: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={invoiceForm.status} onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })}>
                {['Pending', 'Paid', 'Overdue', 'Cancelled'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment method</label>
              <select className={inputClass} value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })}>
                {['Bank Transfer', 'Cheque', 'Cash', 'Credit Card', 'Other'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <input className={inputClass} value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2">
              {editingInvoiceId && (
                <button type="button" className={btnGhost} onClick={() => { resetInvoiceForm(); setShowInvoiceForm(false); }}>
                  Cancel edit
                </button>
              )}
              <button type="submit" className={btnPrimary} disabled={savingInvoice}>
                {savingInvoice ? 'Saving…' : editingInvoiceId ? 'Update invoice' : 'Create invoice'}
              </button>
            </div>
          </form>
        )}
        <div className="rounded-lg border border-gray-700/50 overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className={thClass}>Invoice #</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Due</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Method</th>
                <th className={thClass}>Currency</th>
                <th className={`${thClass} text-right`}>Total</th>
                <th className={`${thClass} text-right`}>Paid</th>
                <th className={`${thClass} text-right`}>Balance</th>
                <th className={thClass}>Notes</th>
                {canEdit && <th className={`${thClass} text-center`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {invoices.length === 0 && <EmptyRow cols={canEdit ? 11 : 10} message="No invoices" />}
              {invoices.map((inv) => (
                <tr
                  key={inv._id}
                  id={`invoice-${inv._id}`}
                  className={`hover:bg-gray-800/40 cursor-pointer ${
                    editingInvoiceId === String(inv._id) || highlightedInvoiceId === String(inv._id)
                      ? 'bg-blue-500/10'
                      : ''
                  }`}
                  onClick={() => setSelectedInvoice(inv)}
                >
                  <td className={`${tdClass} text-blue-300`}>{inv.invoiceNumber}</td>
                  <td className={tdClass}>{formatDate(inv.purchaseDate)}</td>
                  <td className={tdClass}>{formatDate(inv.dueDate)}</td>
                  <td className={tdClass}>{inv.status || '—'}</td>
                  <td className={tdClass}>{inv.paymentMethod || '—'}</td>
                  <td className={tdClass}>{inv.currency || partner.currency || 'INR'}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(inv.totalAmount || 0, inv.currency || partner.currency)}</td>
                  <td className={`${tdClass} text-right`}>{formatMoney(inv.paidAmount || 0, inv.currency || partner.currency)}</td>
                  <td className={`${tdClass} text-right`}>
                    {formatMoney(Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0)), inv.currency || partner.currency)}
                  </td>
                  <td className={tdClass}>{inv.notes || '—'}</td>
                  {canEdit && (
                    <td className={`${tdClass} text-center`} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className={btnGhost} onClick={() => startEditInvoice(inv)}>
                        Edit
                      </button>
                    </td>
                  )}
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
                <th className={thClass}>Purchase ID</th>
                <th className={thClass}>PO #</th>
                <th className={thClass}>Invoice #</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Lifecycle</th>
                <th className={thClass}>Payment</th>
                <th className={`${thClass} text-right`}>Total</th>
                <th className={thClass}>Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {procurements.length === 0 && <EmptyRow cols={8} message="No procurements" />}
              {procurements.map((p) => (
                <tr key={p._id} className="hover:bg-gray-800/40">
                  <td className={tdClass}>{p.purchaseId || '—'}</td>
                  <td className={tdClass}>{p.purchaseOrderNumber || '—'}</td>
                  <td className={tdClass}>{p.invoiceNumber || '—'}</td>
                  <td className={tdClass}>{formatDate(p.purchaseDate || p.createdAt)}</td>
                  <td className={tdClass}>{p.lifecycleStage || p.status || '—'}</td>
                  <td className={tdClass}>{p.paymentStatus || '—'}</td>
                  <td className={`${tdClass} text-right`}>
                    {formatMoney(p.totalCost ?? p.amount ?? 0, partner.currency)}
                  </td>
                  <td className={tdClass}>
                    <Link
                      href={`/dashboard/budgets/procurement?id=${p._id}`}
                      className="text-blue-300 no-underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="partner-contracts" className={sectionClass}>
        <SectionTitle>Contracts</SectionTitle>
        <div className="rounded-lg border border-gray-700/50 overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-gray-900/80 border-b border-gray-700/60">
              <tr>
                <th className={thClass}>Number</th>
                <th className={thClass}>Title</th>
                <th className={thClass}>Start</th>
                <th className={thClass}>End</th>
                <th className={thClass}>Renewal</th>
                <th className={thClass}>Reminder</th>
                <th className={thClass}>Auto</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Notes</th>
                {canEdit && <th className={`${thClass} text-center`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {contracts.length === 0 && <EmptyRow cols={canEdit ? 10 : 9} message="No contracts" />}
              {contracts.map((c) => (
                <tr
                  key={c._id}
                  id={`contract-${c._id}`}
                  className={`hover:bg-gray-800/40 ${
                    editingContractId === String(c._id) || highlightedContractId === String(c._id)
                      ? 'bg-blue-500/10'
                      : ''
                  }`}
                >
                  <td className={tdClass}>{c.contractNumber}</td>
                  <td className={tdClass}>{c.title || '—'}</td>
                  <td className={tdClass}>{formatDate(c.startDate)}</td>
                  <td className={tdClass}>{formatDate(c.endDate)}</td>
                  <td className={tdClass}>{formatDate(c.renewalDate)}</td>
                  <td className={tdClass}>{c.reminderDays != null ? `${c.reminderDays}d` : '—'}</td>
                  <td className={tdClass}>{c.autoRenewal ? 'Yes' : '—'}</td>
                  <td className={tdClass}>{c.status}</td>
                  <td className={tdClass}>{c.notes || '—'}</td>
                  {canEdit && (
                    <td className={`${tdClass} text-center space-x-1 whitespace-nowrap`}>
                      <button type="button" className={btnGhost} onClick={() => startEditContract(c)}>
                        Edit
                      </button>
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
          <form onSubmit={saveContract} className="grid md:grid-cols-3 gap-2">
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
                  <option key={s} value={s}>{s}</option>
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
            <div>
              <label className={labelClass}>Renewal date</label>
              <input type="date" className={inputClass} value={contractForm.renewalDate} onChange={(e) => setContractForm({ ...contractForm, renewalDate: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Reminder days</label>
              <input type="number" min="0" className={inputClass} value={contractForm.reminderDays} onChange={(e) => setContractForm({ ...contractForm, reminderDays: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <input
                id="contract-auto"
                type="checkbox"
                checked={contractForm.autoRenewal}
                onChange={(e) => setContractForm({ ...contractForm, autoRenewal: e.target.checked })}
              />
              <label htmlFor="contract-auto" className="text-xs text-gray-400">Auto renewal</label>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <input className={inputClass} value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className={btnPrimary}>
                {editingContractId ? 'Update contract' : 'Add contract'}
              </button>
              {editingContractId && (
                <button type="button" className={btnGhost} onClick={resetContractForm}>
                  Cancel edit
                </button>
              )}
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


      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setSelectedInvoice(null)}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700/60 bg-gray-900 shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-100">Invoice {selectedInvoice.invoiceNumber}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">{selectedInvoice.status}</p>
              </div>
              <div className="flex gap-2">
                {canEdit && (
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      startEditInvoice(selectedInvoice);
                      setSelectedInvoice(null);
                    }}
                  >
                    Edit
                  </button>
                )}
                <button type="button" className={btnGhost} onClick={() => setSelectedInvoice(null)}>
                  Close
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Invoice date</p>
                <p className="text-gray-200">{formatDate(selectedInvoice.purchaseDate)}</p>
              </div>
              <div>
                <p className="text-gray-500">Due date</p>
                <p className="text-gray-200">{formatDate(selectedInvoice.dueDate)}</p>
              </div>
              <div>
                <p className="text-gray-500">Total</p>
                <p className="text-gray-200">
                  {formatMoney(selectedInvoice.totalAmount || 0, selectedInvoice.currency || partner.currency)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Paid</p>
                <p className="text-gray-200">
                  {formatMoney(selectedInvoice.paidAmount || 0, selectedInvoice.currency || partner.currency)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Balance due</p>
                <p className="text-gray-200">
                  {formatMoney(
                    Math.max(0, (selectedInvoice.totalAmount || 0) - (selectedInvoice.paidAmount || 0)),
                    selectedInvoice.currency || partner.currency
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Payment method</p>
                <p className="text-gray-200">{selectedInvoice.paymentMethod || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Currency</p>
                <p className="text-gray-200">{selectedInvoice.currency || partner.currency || 'INR'}</p>
              </div>
              <div>
                <p className="text-gray-500">Created</p>
                <p className="text-gray-200">{formatDate(selectedInvoice.createdAt)}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-500">Notes</p>
                <p className="text-gray-200 whitespace-pre-wrap">{selectedInvoice.notes || '—'}</p>
              </div>
              {selectedInvoice.invoiceFileUrl && (
                <div className="md:col-span-2">
                  <p className="text-gray-500">Attachment</p>
                  <a href={selectedInvoice.invoiceFileUrl} target="_blank" rel="noreferrer" className="text-blue-300 no-underline">
                    Open file
                  </a>
                </div>
              )}
            </div>
            {(selectedInvoice.items || []).length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Line items</p>
                <div className="rounded-lg border border-gray-700/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/80 border-b border-gray-700/60">
                      <tr>
                        <th className={thClass}>Description</th>
                        <th className={`${thClass} text-right`}>Qty</th>
                        <th className={`${thClass} text-right`}>Unit</th>
                        <th className={`${thClass} text-right`}>Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/40">
                      {selectedInvoice.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className={tdClass}>{item.description || '—'}</td>
                          <td className={`${tdClass} text-right`}>{item.quantity ?? '—'}</td>
                          <td className={`${tdClass} text-right`}>
                            {formatMoney(item.unitPrice || 0, selectedInvoice.currency || partner.currency)}
                          </td>
                          <td className={`${tdClass} text-right`}>
                            {formatMoney(item.totalPrice || 0, selectedInvoice.currency || partner.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
