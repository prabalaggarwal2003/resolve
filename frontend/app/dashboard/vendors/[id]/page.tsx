'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

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
    fetchVendorDetails();
  }, [params.id]);

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

      const res = await fetch(api('/api/invoices'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        alert('Invoice uploaded successfully!');
        setShowInvoiceModal(false);
        resetInvoiceForm();
        fetchVendorDetails();
      } else {
        alert(data.message || 'Failed to upload invoice');
      }
    } catch (err) {
      alert('Failed to upload invoice');
    } finally {
      setUploadingInvoice(false);
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading vendor details...</span>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600">{error || 'Vendor not found'}</p>
        </div>
        <Link href="/dashboard/vendors" className="text-blue-600 hover:underline">
          ← Back to vendors
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/vendors" className="text-blue-600 hover:underline mb-3 inline-block">
          ← Back to vendors
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{vendor.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{vendor.vendorId}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${
            vendor.status === 'Active' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' :
            vendor.status === 'Inactive' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' :
            'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
          }`}>
            {vendor.status}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Assets</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalAssets}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Invoices</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalInvoices}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchased</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.totalPurchased)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Paid</p>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{formatCurrency(stats.totalPaid)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(stats.pendingPayment)}</p>
          </div>
        </div>
      )}

      {/* Vendor Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Vendor Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Category</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{vendor.category}</p>
          </div>
          {vendor.contactPerson && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Contact Person</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{vendor.contactPerson}</p>
            </div>
          )}
          {vendor.email && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{vendor.email}</p>
            </div>
          )}
          {vendor.phone && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{vendor.phone}</p>
            </div>
          )}
          {vendor.website && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Website</p>
              <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                {vendor.website}
              </a>
            </div>
          )}
          {vendor.address && (vendor.address.street || vendor.address.city) && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Address</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {[
                  vendor.address.street,
                  vendor.address.city,
                  vendor.address.state,
                  vendor.address.zipCode,
                  vendor.address.country
                ].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
          {vendor.notes && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Notes</p>
              <p className="font-medium text-gray-900">{vendor.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Invoices Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invoices ({invoices.length})</h2>
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium text-sm"
          >
            + Upload Invoice
          </button>
        </div>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Purchase Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {invoices.map((invoice) => (
                  <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatDate(invoice.purchaseDate)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                      {formatCurrency(invoice.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400 font-medium">
                      {formatCurrency(invoice.totalAmount - invoice.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'Paid' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' :
                        invoice.status === 'Overdue' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' :
                        'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {invoice.invoiceFileUrl ? (
                        <a
                          href={invoice.invoiceFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No invoices uploaded yet</p>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium text-sm"
            >
              Upload First Invoice
            </button>
          </div>
        )}
      </div>

      {/* Assets Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Assets from this Vendor ({assets.length})</h2>

        {assets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Asset ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Purchase Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assets.map((asset) => (
                  <tr key={asset._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      <Link href={`/dashboard/assets/${asset._id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {asset.assetId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{asset.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{asset.category}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(asset.cost)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {asset.purchaseDate ? formatDate(asset.purchaseDate) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No assets purchased from this vendor yet</p>
          </div>
        )}
      </div>

      {/* Invoice Upload Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50" onClick={() => { setShowInvoiceModal(false); resetInvoiceForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Upload Invoice</h2>
              <form onSubmit={handleInvoiceSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invoice Number *</label>
                    <input
                      type="text"
                      required
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Date *</label>
                    <input
                      type="date"
                      required
                      value={invoiceForm.purchaseDate}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, purchaseDate: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Amount *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={invoiceForm.totalAmount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, totalAmount: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paid Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceForm.paidAmount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, paidAmount: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={invoiceForm.status}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                    <select
                      value={invoiceForm.paymentMethod}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invoice File (PDF/Image)</label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceFile: e.target.files?.[0] || null })}
                    className="w-full text-sm text-gray-600 dark:text-gray-400"
                  />
                  {invoiceForm.invoiceFile && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Selected: {invoiceForm.invoiceFile.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={uploadingInvoice}
                    className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium disabled:opacity-50"
                  >
                    {uploadingInvoice ? 'Uploading...' : 'Upload Invoice'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowInvoiceModal(false); resetInvoiceForm(); }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

