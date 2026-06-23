'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

const CATEGORIES = ['Projector', 'Whiteboard', 'Desktop', 'Laptop', 'AC', 'Furniture', 'Lab Equipment', 'Printer', 'Other'];
const STATUSES = ['available', 'in_use', 'under_maintenance', 'retired', 'working', 'needs_repair', 'out_of_service'];

const STATUS_BADGE: Record<string, string> = {
  available: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  in_use: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  under_maintenance: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  retired: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
  working: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  needs_repair: 'text-red-300 bg-red-500/15 border-red-500/30',
  out_of_service: 'text-red-300 bg-red-500/15 border-red-500/30',
};

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  );
}

function Section({
  title,
  accentClass,
  titleClass,
  children,
}: {
  title: string;
  accentClass: string;
  titleClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-gray-700/60 border-l-2 ${accentClass} bg-gray-800/40 px-4 py-4 mb-4`}>
      <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${titleClass}`}>{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; vendorId: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: '',
    model: '',
    category: '',
    serialNumber: '',
    status: 'available',
    assignedTo: '' as string,
    locationId: '' as string,
    departmentId: '' as string,
    purchaseDate: '',
    vendorId: '',
    cost: '',
  });
  const [photos, setPhotos] = useState<{ url: string; caption?: string }[]>([]);
  const [documents, setDocuments] = useState<{ url: string; name: string; type?: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string; type: string }[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !params.id) {
      setPageLoading(false);
      return;
    }
    Promise.all([
      fetch(api(`/api/assets/${params.id}`), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/users'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/locations'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/vendors?status=Active'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([asset, usersRes, locRes, deptRes, vendorsRes]) => {
        if (asset._id) {
          setForm({
            name: asset.name ?? '',
            model: asset.model ?? '',
            category: asset.category ?? '',
            serialNumber: asset.serialNumber ?? '',
            status: asset.status ?? 'available',
            assignedTo: asset.assignedTo?._id ?? '',
            locationId: asset.locationId?._id ?? (typeof asset.locationId === 'string' ? asset.locationId : ''),
            departmentId: asset.departmentId?._id ?? (typeof asset.departmentId === 'string' ? asset.departmentId : ''),
            purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '',
            vendorId: asset.vendorId?._id ?? (typeof asset.vendorId === 'string' ? asset.vendorId : ''),
            cost: asset.cost != null ? String(asset.cost) : '',
          });
          setPhotos(
            Array.isArray(asset.photos)
              ? asset.photos.map((p: { url: string; caption?: string }) => ({ url: p.url, caption: p.caption ?? '' }))
              : []
          );
          setDocuments(
            Array.isArray(asset.documents)
              ? asset.documents.map((d: { url: string; name: string; type?: string }) => ({
                  url: d.url,
                  name: d.name,
                  type: d.type ?? '',
                }))
              : []
          );
        } else setLoadErr(asset.message || 'Not found');
        if (usersRes.users) setUsers(usersRes.users);
        if (locRes.locations) setLocations(locRes.locations);
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (Array.isArray(vendorsRes)) setVendors(vendorsRes.filter((v: { status: string }) => v.status === 'Active'));
      })
      .catch(() => setLoadErr('Failed to load'))
      .finally(() => setPageLoading(false));
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token || !params.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(api(`/api/assets/${params.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          cost: form.cost ? Number(form.cost) : undefined,
          purchaseDate: form.purchaseDate || undefined,
          assignedTo: form.assignedTo || undefined,
          locationId: form.locationId || undefined,
          departmentId: form.departmentId || undefined,
          vendorId: form.vendorId || undefined,
          photos,
          documents,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Update failed');
      router.push(`/dashboard/assets/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return <LoadingSpinner message="Loading asset..." />;

  if (loadErr) {
    return (
      <div className="max-w-7xl mx-auto">
        <p className="text-red-400">{loadErr}</p>
        <Link href="/dashboard/assets" className={`${buttonClass} inline-block mt-3 border-gray-700/60 text-gray-400`}>
          Back to assets
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Link
        href={`/dashboard/assets/${params.id}`}
        className={`${buttonClass} inline-block mb-4 border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
      >
        Back to asset
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Edit asset</h1>
        <p className="text-gray-400 mt-1 text-sm">Update asset details, assignment, and purchase information.</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <Section title="Basic information" accentClass="border-l-blue-500/50" titleClass="text-blue-400/80">
          <Field label="Name" required>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
              <option value="">Select category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Model">
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Serial number">
            <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className={inputClass} />
          </Field>
          <div className="md:col-span-2">
            <label className={labelClass}>Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, status: s })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                    form.status === s
                      ? STATUS_BADGE[s]
                      : 'border-gray-700/60 bg-gray-800/40 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Assignment & location" accentClass="border-l-violet-500/50" titleClass="text-violet-400/80">
          <Field label="Assigned to">
            <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} className={inputClass}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={inputClass}>
              <option value="">No location</option>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name} ({l.type})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className={inputClass}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Purchase & vendor" accentClass="border-l-emerald-500/50" titleClass="text-emerald-400/80">
          <Field label="Purchase date">
            <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Cost (INR)">
            <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Vendor">
            <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className={inputClass}>
              <option value="">No vendor</option>
              {vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.vendorId} — {v.name}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50`}
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <Link
            href={`/dashboard/assets/${params.id}`}
            className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
