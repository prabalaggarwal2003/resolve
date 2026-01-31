'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const CATEGORIES = ['Projector', 'Whiteboard', 'Desktop', 'Laptop', 'AC', 'Furniture', 'Lab Equipment', 'Printer', 'Other'];
const STATUSES = ['available', 'in_use', 'under_maintenance', 'retired', 'working', 'needs_repair', 'out_of_service'];

const inputClassName = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
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
    vendor: '',
    cost: '',
  });
  const [photos, setPhotos] = useState<{ url: string; caption?: string }[]>([]);
  const [documents, setDocuments] = useState<{ url: string; name: string; type?: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string; type: string }[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !params.id) return;
    Promise.all([
      fetch(api(`/api/assets/${params.id}`), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/users'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/locations'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([asset, usersRes, locRes, deptRes]) => {
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
            vendor: asset.vendor ?? '',
            cost: asset.cost != null ? String(asset.cost) : '',
          });
          setPhotos(Array.isArray(asset.photos) ? asset.photos.map((p: { url: string; caption?: string }) => ({ url: p.url, caption: p.caption ?? '' })) : []);
          setDocuments(Array.isArray(asset.documents) ? asset.documents.map((d: { url: string; name: string; type?: string }) => ({ url: d.url, name: d.name, type: d.type ?? '' })) : []);
        } else setLoadErr(asset.message || 'Not found');
        if (usersRes.users) setUsers(usersRes.users);
        if (locRes.locations) setLocations(locRes.locations);
        if (deptRes.departments) setDepartments(deptRes.departments);
      })
      .catch(() => setLoadErr('Failed to load'));
  }, [params.id]);

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((p) => [...p, { url: reader.result as string, caption: '' }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDocuments((d) => [...d, { url: reader.result as string, name: file.name, type: file.type }]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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

  if (loadErr) {
    return (
      <div>
        <p className="text-red-600">{loadErr}</p>
        <Link href="/dashboard/assets" className="text-primary hover:underline mt-2 inline-block">Back to assets</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/dashboard/assets/${params.id}`} className="inline-block mb-4 text-slate-600 hover:text-slate-900">← Back to asset</Link>
      <h1 className="text-2xl font-bold mb-2">Edit asset</h1>
      <form onSubmit={handleSubmit} className="max-w-lg bg-white p-6 rounded-lg border border-slate-200">
        {error && <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>}
        <Field label="Name" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClassName} /></Field>
        <Field label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClassName}><option value="">Select</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Model"><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputClassName} /></Field>
        <Field label="Serial number"><input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className={inputClassName} /></Field>
        <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClassName}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></Field>
        <Field label="Assigned to"><select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} className={inputClassName}><option value="">None</option>{users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></Field>
        <Field label="Location"><select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={inputClassName}><option value="">None</option>{locations.map((l) => <option key={l._id} value={l._id}>{l.name} ({l.type})</option>)}</select></Field>
        <Field label="Department"><select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className={inputClassName}><option value="">None</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></Field>
        <Field label="Purchase date"><input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className={inputClassName} /></Field>
        <Field label="Vendor"><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={inputClassName} /></Field>
        <Field label="Cost (₹)"><input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className={inputClassName} /></Field>
        <Field label="Photos">
          <div className="space-y-2">
            <input type="file" accept="image/*" onChange={addPhoto} className="text-sm text-slate-600" />
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p.url} alt="" className="h-20 w-20 object-cover rounded border border-slate-200" />
                    <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="Documents">
          <div className="space-y-2">
            <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={addDocument} className="text-sm text-slate-600" />
            {documents.length > 0 && (
              <ul className="text-sm text-slate-600 mt-2 space-y-1">
                {documents.map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span>{d.name}</span>
                    <button type="button" onClick={() => setDocuments((prev) => prev.filter((_, j) => j !== i))} className="text-red-600 hover:underline">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
        <button type="submit" disabled={loading} className="mt-4 px-6 py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-primary-hover">{loading ? 'Saving…' : 'Save'}</button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="mb-4"><label className="block mb-1.5 font-medium text-slate-700">{label} {required && '*'}</label>{children}</div>;
}
