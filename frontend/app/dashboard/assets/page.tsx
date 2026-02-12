'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const CATEGORIES = [
  'Projector',
  'Whiteboard',
  'Desktop',
  'Laptop',
  'AC',
  'Furniture',
  'Lab Equipment',
  'Printer',
  'Other',
];

type Asset = {
  _id: string;
  assetId: string;
  name: string;
  category: string;
  status: string;
  locationId?: { name: string; path?: string };
  departmentId?: { name: string };
  assignedTo?: { _id: string; name: string; email: string };
};

// Color-coded: Available, In Use, Maintenance, Retired/Faulty
const STATUS_CLASSES: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  in_use: 'bg-blue-100 text-blue-800',
  under_maintenance: 'bg-amber-100 text-amber-800',
  retired: 'bg-slate-200 text-slate-600',
  working: 'bg-green-100 text-green-800',
  needs_repair: 'bg-red-100 text-red-800',
  out_of_service: 'bg-red-100 text-red-800',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function AssetsPageContent() {
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  useEffect(() => {
    const q = searchParams.get('assignedTo') || '';
    setAssignedToFilter(q);
  }, [searchParams]);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [myAssetsOnly, setMyAssetsOnly] = useState(false);
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);

  useEffect(() => {
    const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (u) try { setUser(JSON.parse(u)); } catch (_) {}

    // Load custom categories from localStorage
    const saved = localStorage.getItem('assetCategories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge default categories with saved custom ones, removing duplicates
        const merged = CATEGORIES.concat(parsed);
        setCategories(Array.from(new Set(merged)));
      } catch {
        // If parsing fails, keep default categories
      }
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    Promise.all([
      fetch(base ? `${base}/api/departments` : '/api/departments', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(base ? `${base}/api/users` : '/api/users', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([deptRes, usersRes]) => {
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (usersRes.users) setUsers(usersRes.users);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (departmentFilter) params.set('departmentId', departmentFilter);
    if (assignedToFilter) params.set('assignedTo', assignedToFilter);
    else if (myAssetsOnly && user?.id) params.set('assignedTo', user.id);
    params.set('sort', sort);
    params.set('order', order);
    params.set('page', String(page));
    params.set('limit', String(limit));
    const url = api(`/api/assets?${params.toString()}`);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.assets) {
          setAssets(data.assets);
          setTotal(data.total || 0);
        }
        else setError(data.message || 'Failed to load');
      })
      .catch(() => setError('Failed to load assets'))
      .finally(() => setLoading(false));
  }, [search, statusFilter, categoryFilter, departmentFilter, assignedToFilter, sort, order, myAssetsOnly, user?.id, page, limit]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, departmentFilter, assignedToFilter, myAssetsOnly]);

  const canAddAsset = ['super_admin', 'admin', 'manager'].includes(user?.role ?? '');

  const downloadQRPDF = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      const res = await fetch(api('/api/qr-pdf/download'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `asset-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to download PDF');
      }
    } catch (err) {
      alert('Failed to download PDF');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">{myAssetsOnly ? 'My Assets' : 'Assets'}</h1>
          <p className="text-slate-600 dark:text-gray-400">
            Search by ID, name, serial; filter by status, type; sort by date or value
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadQRPDF}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-green-600 dark:bg-green-500 text-white rounded-lg font-semibold hover:bg-green-700 dark:hover:bg-green-600 shrink-0"
          >
            📥 Download QR Codes PDF
          </button>
          {canAddAsset && (
            <Link
              href="/dashboard/assets/new"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-primary dark:bg-blue-500 text-white rounded-lg font-semibold hover:bg-primary-hover dark:hover:bg-blue-600 shrink-0"
            >
              Add asset
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Search (ID, name, serial…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
        >
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="in_use">In use</option>
          <option value="under_maintenance">Under maintenance</option>
          <option value="retired">Retired</option>
          <option value="needs_repair">Needs repair</option>
          <option value="out_of_service">Out of service</option>
        </select>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
        <select
          value={assignedToFilter}
          onChange={(e) => setAssignedToFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
        >
          <option value="">All assigned</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
        >
          <option value="">All types</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={`${sort}-${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split('-') as [string, 'asc' | 'desc'];
            setSort(s);
            setOrder(o);
          }}
          className="px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400"
        >
          <option value="createdAt-desc">Newest first</option>
          <option value="createdAt-asc">Oldest first</option>
          <option value="purchaseDate-desc">Purchase date (new)</option>
          <option value="purchaseDate-asc">Purchase date (old)</option>
          <option value="name-asc">Name A–Z</option>
          <option value="cost-desc">Value (high)</option>
        </select>
        {user?.role === 'reporter' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={myAssetsOnly}
              onChange={(e) => setMyAssetsOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-slate-700 dark:text-gray-300">My assets only</span>
          </label>
        )}
      </div>

      {loading && <p className="text-slate-600 dark:text-gray-400">Loading…</p>}
      {error && (
        <p className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-200 rounded-lg text-sm">{error}</p>
      )}
      {!loading && !error && assets.length === 0 && (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-lg border border-slate-200 dark:border-gray-700 text-center text-slate-600 dark:text-gray-400">
          No assets match. Try changing filters or add your first asset.
        </div>
      )}
      {!loading && !error && assets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-gray-700 text-left">
                  <th className="p-3 text-sm font-medium text-slate-700 dark:text-gray-300">ID</th>
                  <th className="p-3 text-sm font-medium text-slate-700 dark:text-gray-300">Name</th>
                  <th className="p-3 text-sm font-medium text-slate-700 dark:text-gray-300">Category</th>
                  <th className="p-3 text-sm font-medium text-slate-700 dark:text-gray-300">Department</th>
                  <th className="p-3 text-sm font-medium text-slate-700 dark:text-gray-300">Status</th>
                  <th className="p-3 text-sm font-medium text-slate-700 dark:text-gray-300">Assigned to</th>
                  <th className="p-3 text-sm font-medium text-slate-700 dark:text-gray-300">Location</th>
                  <th className="p-3 text-sm font-medium text-slate-700 dark:text-gray-300"></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a._id} className="border-t border-slate-200 dark:border-gray-700 hover:bg-slate-50/50 dark:hover:bg-gray-700/50">
                    <td className="p-3 text-gray-900 dark:text-gray-100">{a.assetId}</td>
                    <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{a.name}</td>
                    <td className="p-3 text-gray-900 dark:text-gray-100">{a.category}</td>
                    <td className="p-3 text-slate-600 dark:text-gray-400 text-sm">{a.departmentId?.name ?? '—'}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_CLASSES[a.status] ?? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
                      >
                        {a.status?.replace('_', ' ') || '—'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-gray-400 text-sm">
                      {a.assignedTo?.name ?? '—'}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-gray-400">
                      {a.locationId?.path || a.locationId?.name || '—'}
                    </td>
                    <td className="p-3">
                      <Link href={`/dashboard/assets/${a._id}`} className="text-primary dark:text-blue-400 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="p-4 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} assets
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-slate-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100">
                  Page {page} of {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page >= Math.ceil(total / limit)}
                  className="px-3 py-1.5 text-sm border border-slate-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<p className="text-slate-600">Loading…</p>}>
      <AssetsPageContent />
    </Suspense>
  );
}
