'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { UpgradePrompt } from '@/lib/subscriptionUtils';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Vendor {
  _id: string;
  vendorId: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  website?: string;
  category: string;
  status: string;
  assetCount?: number;
  invoiceCount?: number;
  totalPurchased?: number;
  totalPaid?: number;
  pendingPayment?: number;
}

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const inputClass = 'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

const STATUS_BADGE: Record<string, string> = {
  Active: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  Inactive: 'text-gray-300 bg-gray-500/15 border-gray-500/30',
  Blacklisted: 'text-red-300 bg-red-500/15 border-red-500/30',
};

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 truncate ${accent}`}>{value}</p>
    </div>
  );
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [tier, setTier] = useState<string>('free');
  const [isExpired, setIsExpired] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    website: '',
    taxId: '',
    paymentTerms: 'Net 30',
    category: 'Hardware',
    status: 'Active',
    notes: ''
  });

  useEffect(() => {
    fetchSubscription();
  }, []);

  useEffect(() => {
    if (!subscriptionChecked) return;
    if (tier === 'free' || isExpired) {
      setLoading(false);
      return;
    }
    fetchVendors();
  }, [tier, isExpired, subscriptionChecked]);

  const filteredVendors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return vendors.filter((vendor) => {
      if (filters.status && vendor.status !== filters.status) return false;
      if (filters.category && vendor.category !== filters.category) return false;
      if (!q) return true;

      const haystack = [
        vendor.name,
        vendor.vendorId,
        vendor.email,
        vendor.contactPerson,
        vendor.phone,
        vendor.category,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return haystack.some((value) => value.includes(q));
    });
  }, [vendors, filters.status, filters.category, searchQuery]);

  const fetchSubscription = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setSubscriptionChecked(true);
      return;
    }

    try {
      const res = await fetch(api('/api/payments/subscription-status'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTier(data.tier);
        setIsExpired(data.isExpired || false);
      }
    } catch (_) {}
    finally {
      setSubscriptionChecked(true);
    }
  };

  const fetchVendors = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    try {
      const res = await fetch(api('/api/vendors'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setVendors(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const payload = {
      ...formData,
      address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country
      }
    };

    try {
      const url = editingVendor ? api(`/api/vendors/${editingVendor._id}`) : api('/api/vendors');
      const method = editingVendor ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowModal(false);
        resetForm();
        fetchVendors();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      street: vendor.address?.street || '',
      city: vendor.address?.city || '',
      state: vendor.address?.state || '',
      zipCode: vendor.address?.zipCode || '',
      country: vendor.address?.country || '',
      website: vendor.website || '',
      taxId: '',
      paymentTerms: 'Net 30',
      category: vendor.category,
      status: vendor.status,
      notes: ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vendor? This cannot be undone.')) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    try {
      const res = await fetch(api(`/api/vendors/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchVendors();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      website: '',
      taxId: '',
      paymentTerms: 'Net 30',
      category: 'Hardware',
      status: 'Active',
      notes: ''
    });
    setEditingVendor(null);
  };

  if (!subscriptionChecked || loading) {
    return (
      <LoadingSpinner message="Loading vendors..." />
    );
  }

  if (tier === 'free' || isExpired) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Vendors</h1>
        {isExpired && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-medium">Your subscription has expired</p>
            <p className="text-red-300 text-sm mt-1">Renew your subscription to access vendor management</p>
          </div>
        )}
        <UpgradePrompt feature={isExpired ? 'Vendor Management (Renew subscription to unlock)' : 'Vendor Management'} />
      </div>
    );
  }

  const activeCount = filteredVendors.filter((v) => v.status === 'Active').length;
  const totalPending = filteredVendors.reduce((sum, v) => sum + (v.pendingPayment || 0), 0);
  const totalPurchased = filteredVendors.reduce((sum, v) => sum + (v.totalPurchased || 0), 0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Vendors</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Manage suppliers, track purchases, invoices, and payment status.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50 transition-colors"
        >
          + Add vendor
        </button>
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="Total vendors" value={filteredVendors.length} accent="text-blue-300" />
          <SummaryCard label="Active" value={activeCount} accent="text-emerald-300" />
          <SummaryCard label="Total purchased" value={formatCurrency(totalPurchased)} accent="text-violet-300" />
          <SummaryCard
            label="Pending payment"
            value={totalPending > 0 ? formatCurrency(totalPending) : 'No pending payment'}
            accent={totalPending > 0 ? 'text-amber-300' : 'text-gray-500'}
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gradient-to-r from-violet-950/15 to-gray-800/40 px-4 py-3 mb-4">
        <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-2">Filters</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Search vendors…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={inputClass}
          />
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className={inputClass}
          >
            <option value="">All categories</option>
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Services">Services</option>
            <option value="Supplies">Supplies</option>
            <option value="Other">Other</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className={inputClass}
          >
            <option value="">All status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Blacklisted">Blacklisted</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {vendors.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-blue-500/20 bg-blue-950/10 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-300 mb-1">No vendors found</p>
          <p className="text-xs text-gray-500 mb-3">Add your first vendor to start tracking suppliers and invoices.</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors"
          >
            + Add vendor
          </button>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-violet-500/20 bg-violet-950/10 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-300 mb-1">No matching vendors</p>
          <p className="text-xs text-gray-500">Try a different search term or clear your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor._id}
              className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/60 bg-gray-800/40 px-4 py-3 hover:border-blue-500/25 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-100">{vendor.name}</h3>
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${STATUS_BADGE[vendor.status] || STATUS_BADGE.Inactive}`}>
                      {vendor.status}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-md border text-violet-300 bg-violet-500/15 border-violet-500/30">
                      {vendor.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{vendor.vendorId}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Link
                    href={`/dashboard/vendors/${vendor._id}`}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 no-underline transition-colors"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleEdit(vendor)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-700/60 bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(vendor._id)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {(vendor.contactPerson || vendor.email || vendor.phone) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mb-2">
                  {vendor.contactPerson && (
                    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Contact</p>
                      <p className="text-xs font-medium text-gray-200 mt-0.5 truncate">{vendor.contactPerson}</p>
                    </div>
                  )}
                  {vendor.email && (
                    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Email</p>
                      <p className="text-xs font-medium text-gray-200 mt-0.5 truncate">{vendor.email}</p>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Phone</p>
                      <p className="text-xs font-medium text-gray-200 mt-0.5 truncate">{vendor.phone}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5">
                <div className="px-2 py-1.5 rounded-lg border border-blue-800/30 bg-blue-900/15">
                  <p className="text-[10px] text-blue-400/70 uppercase tracking-wide">Assets</p>
                  <p className="text-sm font-semibold text-blue-300">{vendor.assetCount || 0}</p>
                </div>
                <div className="px-2 py-1.5 rounded-lg border border-violet-800/30 bg-violet-900/15">
                  <p className="text-[10px] text-violet-400/70 uppercase tracking-wide">Invoices</p>
                  <p className="text-sm font-semibold text-violet-300">{vendor.invoiceCount || 0}</p>
                </div>
                <div className="px-2 py-1.5 rounded-lg border border-emerald-800/30 bg-emerald-900/15">
                  <p className="text-[10px] text-emerald-400/70 uppercase tracking-wide">Purchased</p>
                  <p className="text-sm font-semibold text-emerald-300">{formatCurrency(vendor.totalPurchased || 0)}</p>
                </div>
              </div>

              <div className="mt-2 px-2 py-1.5 rounded-lg border border-amber-800/30 bg-amber-900/15">
                <p className="text-[10px] text-amber-400/70 uppercase tracking-wide">Pending payment</p>
                <p className={`text-xs font-medium mt-0.5 ${(vendor.pendingPayment ?? 0) > 0 ? 'text-amber-300' : 'text-gray-500'}`}>
                  {(vendor.pendingPayment ?? 0) > 0 ? formatCurrency(vendor.pendingPayment!) : 'No pending payment'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-100">{editingVendor ? 'Edit vendor' : 'Add vendor'}</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Supplier contact and billing details</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-200 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className={labelClass}>Vendor name *</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Contact person</label>
                  <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Website</label>
                  <input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Category</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={inputClass}>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Services">Services</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={inputClass}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Blacklisted">Blacklisted</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Street address</label>
                <input type="text" value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>City</label>
                  <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className={inputClass} />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  {editingVendor ? 'Update vendor' : 'Create vendor'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
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
