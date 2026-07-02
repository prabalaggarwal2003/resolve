'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UpgradePrompt, fetchOrgSubscription, getStoredSubscription } from '@/lib/subscriptionUtils';
import { canWrite } from '@/lib/permissions';
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
  notes?: string;
  createdAt: string;
}

interface Asset {
  _id: string;
  assetId: string;
  name: string;
  category: string;
  cost: number;
  status: string;
  purchaseDate: string;
  locationId?: { name: string };
  departmentId?: { name: string };
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  purchaseDate: string;
  dueDate?: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  invoiceFileUrl?: string;
}

interface VendorStats {
  totalAssets: number;
  totalInvoices: number;
  totalPurchased: number;
  totalPaid: number;
  pendingPayment: number;
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const inputClass = 'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

const STATUS_BADGE: Record<string, string> = {
  Active: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  Inactive: 'text-gray-300 bg-gray-500/15 border-gray-500/30',
  Blacklisted: 'text-red-300 bg-red-500/15 border-red-500/30',
  Paid: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  Pending: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  Overdue: 'text-red-300 bg-red-500/15 border-red-500/30',
  Cancelled: 'text-gray-300 bg-gray-500/15 border-gray-500/30',
};

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 truncate ${accent}`}>{value}</p>
    </div>
  );
}

function InfoField({ label, value, className = '' }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={`px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30 ${className}`}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="text-sm font-semibold text-gray-200 mt-0.5">{value || '—'}</div>
    </div>
  );
}

function PaginationBar({
  page,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
      <p className="text-xs text-gray-500">
        {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, totalItems)} of {totalItems}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-2.5 py-1 text-xs font-medium border border-gray-700/60 bg-gray-800/60 text-gray-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
        >
          Prev
        </button>
        <span className="px-2 text-xs text-gray-500">{page}/{totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-2.5 py-1 text-xs font-medium border border-gray-700/60 bg-gray-800/60 text-gray-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tier, setTier] = useState<string>(() => getStoredSubscription().tier);
  const [isExpired, setIsExpired] = useState(() => getStoredSubscription().isExpired);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [assetsPage, setAssetsPage] = useState(1);
  const itemsPerPage = 10;
  const canEditVendors = canWrite('vendors');

  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    purchaseDate: '',
    dueDate: '',
    totalAmount: '',
    paidAmount: '0',
    status: 'Pending',
    paymentMethod: 'Bank Transfer',
    notes: '',
    invoiceFile: null as File | null
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
    setLoading(true);
    fetchVendorDetails();
  }, [params.id, tier, isExpired, subscriptionChecked]);

  const fetchSubscription = async () => {
    const sub = await fetchOrgSubscription(api);
    setTier(sub.tier);
    setIsExpired(sub.isExpired);
    setSubscriptionChecked(true);
  };

  const fetchVendorDetails = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || !params.id) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    try {
      const res = await fetch(api(`/api/vendors/${params.id}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        setVendor(data.vendor);
        setAssets(data.assets || []);
        setInvoices(data.invoices || []);
        setStats(data.stats || null);
      } else {
        setError(data.message || 'Failed to load vendor details');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    setUploadingInvoice(true);

    try {
      let invoiceFileUrl = '';

      // If there's a file, convert to base64
      if (invoiceForm.invoiceFile) {
        const reader = new FileReader();
        invoiceFileUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(invoiceForm.invoiceFile!);
        });
      }

      const payload = {
        vendorId: params.id,
        invoiceNumber: invoiceForm.invoiceNumber,
        purchaseDate: invoiceForm.purchaseDate,
        dueDate: invoiceForm.dueDate || undefined,
        totalAmount: parseFloat(invoiceForm.totalAmount),
        paidAmount: parseFloat(invoiceForm.paidAmount),
        status: invoiceForm.status,
        paymentMethod: invoiceForm.paymentMethod,
        notes: invoiceForm.notes,
        invoiceFileUrl: invoiceFileUrl || undefined
      };

      const url = editingInvoice ? api(`/api/invoices/${editingInvoice._id}`) : api('/api/invoices');
      const method = editingInvoice ? 'PUT' : 'POST';

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
        alert(editingInvoice ? 'Invoice updated successfully!' : 'Invoice uploaded successfully!');
        setShowInvoiceModal(false);
        resetInvoiceForm();
        fetchVendorDetails();
      } else {
        alert(data.message || 'Failed to save invoice');
      }
    } catch (err) {
      alert('Failed to save invoice');
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setInvoiceForm({
      invoiceNumber: invoice.invoiceNumber,
      purchaseDate: invoice.purchaseDate,
      dueDate: invoice.dueDate || '',
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      status: invoice.status,
      paymentMethod: 'Bank Transfer',
      notes: '',
      invoiceFile: null
    });
    setShowInvoiceModal(true);
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const res = await fetch(api(`/api/invoices/${invoiceId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        alert('Invoice deleted successfully!');
        fetchVendorDetails();
      } else {
        alert(data.message || 'Failed to delete invoice');
      }
    } catch (err) {
      alert('Failed to delete invoice');
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      invoiceNumber: '',
      purchaseDate: '',
      dueDate: '',
      totalAmount: '',
      paidAmount: '0',
      status: 'Pending',
      paymentMethod: 'Bank Transfer',
      notes: '',
      invoiceFile: null
    });
    setEditingInvoice(null);
  };

  if (!subscriptionChecked || loading) {
    return (
      <LoadingSpinner message="Loading vendor details..." />
    );
  }

  if (tier === 'free' || isExpired) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Vendor details</h1>
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

  if (error || !vendor) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm mb-4">
          {error || 'Vendor not found'}
        </div>
        <Link href="/dashboard/vendors" className="text-xs text-blue-400 hover:underline no-underline">← Back to vendors</Link>
      </div>
    );
  }

  const address = vendor.address
    ? [vendor.address.street, vendor.address.city, vendor.address.state, vendor.address.zipCode, vendor.address.country].filter(Boolean).join(', ')
    : '';

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/dashboard/vendors" className="text-xs text-gray-500 hover:text-gray-300 mb-3 inline-block no-underline">← Back to vendors</Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{vendor.name}</h1>
          <p className="text-gray-400 mt-1 text-sm font-mono">{vendor.vendorId}</p>
        </div>
        <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${STATUS_BADGE[vendor.status] || STATUS_BADGE.Inactive}`}>
          {vendor.status}
        </span>
      </div>

      {stats && (
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
          <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Financial overview</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <SummaryCard label="Assets" value={stats.totalAssets} accent="text-blue-300" />
            <SummaryCard label="Invoices" value={stats.totalInvoices} accent="text-violet-300" />
            <SummaryCard label="Purchased" value={formatCurrency(stats.totalPurchased)} accent="text-emerald-300" />
            <SummaryCard label="Paid" value={formatCurrency(stats.totalPaid)} accent="text-gray-300" />
            <SummaryCard
              label="Pending"
              value={stats.pendingPayment > 0 ? formatCurrency(stats.pendingPayment) : 'No pending payment'}
              accent={stats.pendingPayment > 0 ? 'text-amber-300' : 'text-gray-500'}
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-3">Vendor information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <InfoField label="Category" value={vendor.category} />
          <InfoField label="Contact person" value={vendor.contactPerson} />
          <InfoField label="Email" value={vendor.email} />
          <InfoField label="Phone" value={vendor.phone} />
          <InfoField
            label="Website"
            value={vendor.website ? (
              <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline font-normal text-sm no-underline">
                {vendor.website}
              </a>
            ) : undefined}
            className="sm:col-span-2"
          />
          {address && <InfoField label="Address" value={address} className="sm:col-span-2" />}
          {vendor.notes && <InfoField label="Notes" value={vendor.notes} className="sm:col-span-2" />}
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-amber-500/50 bg-gray-800/40 px-4 py-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest">Invoices ({invoices.length})</p>
          {canEditVendors && (
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            + Upload invoice
          </button>
          )}
        </div>

        {invoices.length > 0 ? (
          <>
            <div className="rounded-xl border border-gray-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/80 border-b border-gray-700/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Invoice #</th>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Date</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Amount</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Paid</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Balance</th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Status</th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">File</th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/40">
                    {invoices
                      .slice((invoicePage - 1) * itemsPerPage, invoicePage * itemsPerPage)
                      .map((invoice) => (
                        <tr key={invoice._id} className="hover:bg-gray-800/40">
                          <td className="px-3 py-2 text-xs font-medium text-gray-200">{invoice.invoiceNumber}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{formatDate(invoice.purchaseDate)}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-200">{formatCurrency(invoice.totalAmount)}</td>
                          <td className="px-3 py-2 text-xs text-right text-emerald-400">{formatCurrency(invoice.paidAmount)}</td>
                          <td className="px-3 py-2 text-xs text-right text-amber-300">{formatCurrency(invoice.totalAmount - invoice.paidAmount)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-md border ${STATUS_BADGE[invoice.status] || STATUS_BADGE.Pending}`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {invoice.invoiceFileUrl ? (
                              <a href={invoice.invoiceFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline no-underline">View</a>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {canEditVendors ? (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleEditInvoice(invoice)} className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-gray-700/60 bg-gray-800/60 text-gray-400 hover:bg-gray-700/60">Edit</button>
                              <button onClick={() => handleDeleteInvoice(invoice._id)} className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20">Delete</button>
                            </div>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <PaginationBar page={invoicePage} totalItems={invoices.length} itemsPerPage={itemsPerPage} onPageChange={setInvoicePage} />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-950/10 px-4 py-6 text-center">
            <p className="text-sm font-medium text-gray-300 mb-1">No invoices yet</p>
            <p className="text-xs text-gray-500 mb-3">Upload the first invoice for this vendor.</p>
            {canEditVendors && (
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              + Upload invoice
            </button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-4">
        <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-widest mb-3">Assets ({assets.length})</p>

        {assets.length > 0 ? (
          <>
            <div className="rounded-xl border border-gray-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/80 border-b border-gray-700/60">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Asset ID</th>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Category</th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wide text-gray-500">Cost</th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Purchased</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/40">
                    {assets
                      .slice((assetsPage - 1) * itemsPerPage, assetsPage * itemsPerPage)
                      .map((asset) => (
                        <tr key={asset._id} className="hover:bg-gray-800/40">
                          <td className="px-3 py-2 text-xs font-medium">
                            <Link href={`/dashboard/assets/${asset._id}`} className="text-blue-400 hover:underline no-underline">{asset.assetId}</Link>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-200">{asset.name}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{asset.category}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-200">{formatCurrency(asset.cost)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded-md border text-blue-300 bg-blue-500/15 border-blue-500/30">
                              {asset.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{asset.purchaseDate ? formatDate(asset.purchaseDate) : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <PaginationBar page={assetsPage} totalItems={assets.length} itemsPerPage={itemsPerPage} onPageChange={setAssetsPage} />
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-500/20 bg-emerald-950/10 px-4 py-6 text-center">
            <p className="text-sm font-medium text-gray-300 mb-1">No assets linked</p>
            <p className="text-xs text-gray-500">Assets purchased from this vendor will appear here.</p>
          </div>
        )}
      </div>

      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => { setShowInvoiceModal(false); resetInvoiceForm(); }}>
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-100">{editingInvoice ? 'Edit invoice' : 'Upload invoice'}</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">{vendor.name}</p>
              </div>
              <button onClick={() => { setShowInvoiceModal(false); resetInvoiceForm(); }} className="text-gray-400 hover:text-gray-200 text-xl">✕</button>
            </div>
            <form onSubmit={handleInvoiceSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Invoice number *</label>
                  <input type="text" required value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Purchase date *</label>
                  <input type="date" required value={invoiceForm.purchaseDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, purchaseDate: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Total amount *</label>
                  <input type="number" required step="0.01" value={invoiceForm.totalAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, totalAmount: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Paid amount</label>
                  <input type="number" step="0.01" value={invoiceForm.paidAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, paidAmount: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={invoiceForm.status} onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })} className={inputClass}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Payment method</label>
                  <select value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })} className={inputClass}>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Due date</label>
                <input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} rows={3} className={inputClass} />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={uploadingInvoice}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  {uploadingInvoice ? (editingInvoice ? 'Updating…' : 'Uploading…') : (editingInvoice ? 'Update invoice' : 'Upload invoice')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInvoiceModal(false); resetInvoiceForm(); }}
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

