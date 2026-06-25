'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && ' *'}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
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

export default function NewAssetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    assetId: '',
    name: '',
    model: '',
    category: '',
    serialNumber: '',
    status: 'available',
    assignedToName: '',
    assignedToEmployeeCode: '',
    locationId: '' as string,
    departmentId: '' as string,
    purchaseDate: '',
    warrantyExpiry: '',
    vendorId: '',
    cost: '',
  });
  const [photos, setPhotos] = useState<{ url: string; caption: string }[]>([]);
  const [documents, setDocuments] = useState<{ url: string; name: string; type: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string; type: string }[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; vendorId: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [newCategory, setNewCategory] = useState('');
  const [generatingAssetId, setGeneratingAssetId] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const generateAssetId = async () => {
    setGeneratingAssetId(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not signed in');
      setGeneratingAssetId(false);
      return;
    }

    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const [orgRes, assetsRes] = await Promise.all([
        fetch(base ? `${base}/api/organization` : '/api/organization', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(base ? `${base}/api/assets?limit=9999&sort=createdAt&order=desc` : '/api/assets?limit=9999&sort=createdAt&order=desc', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const orgData = await orgRes.json();
      const assetsData = await assetsRes.json();

      if (!orgRes.ok || !orgData.organization?.name) {
        throw new Error('Failed to fetch organization details');
      }

      const selectedCategory = form.category || 'Asset';
      const orgName = orgData.organization.name.replace(/[^A-Za-z]/g, '');
      const orgPrefix = orgName.substring(0, 3).toUpperCase() || 'ORG';
      const categoryName = selectedCategory.replace(/[^A-Za-z]/g, '');
      const categoryPrefix = categoryName.substring(0, 3).toUpperCase() || 'ASS';

      let highestNumber = 0;
      if (assetsData.assets?.length) {
        assetsData.assets.forEach((asset: { assetId?: string }) => {
          if (asset.assetId) {
            const parts = asset.assetId.split('-');
            if (parts.length === 3 && parts[0] === orgPrefix && parts[1] === categoryPrefix) {
              const num = parseInt(parts[2], 10);
              if (!isNaN(num) && num > highestNumber) highestNumber = num;
            }
          }
        });
      }

      const nextNumber = highestNumber + 1;
      const paddingLength = Math.max(3, String(nextNumber).length);
      const paddedNumber = String(nextNumber).padStart(paddingLength, '0');
      setForm({ ...form, assetId: `${orgPrefix}-${categoryPrefix}-${paddedNumber}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Asset ID');
      setTimeout(() => setError(''), 3000);
    } finally {
      setGeneratingAssetId(false);
    }
  };

  const addNewCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setError('Category already exists');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const updatedCategories = [...categories, trimmed];
    setCategories(updatedCategories);
    setForm({ ...form, category: trimmed });
    setNewCategory('');
    const customCategories = updatedCategories.filter((cat) => !CATEGORIES.includes(cat));
    localStorage.setItem('assetCategories', JSON.stringify(customCategories));
  };

  const generateSequentialId = (baseId: string, index: number): string => {
    const parts = baseId.split('-');
    if (parts.length !== 3) return `${baseId}-${index + 1}`;
    const newNumber = parseInt(parts[2], 10) + index;
    const paddingLength = Math.max(3, String(newNumber).length);
    return `${parts[0]}-${parts[1]}-${String(newNumber).padStart(paddingLength, '0')}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    Promise.all([
      fetch(base ? `${base}/api/locations` : '/api/locations', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(base ? `${base}/api/departments` : '/api/departments', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(base ? `${base}/api/vendors?status=Active` : '/api/vendors?status=Active', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([locsRes, deptRes, vendorsRes]) => {
        if (locsRes.locations) setLocations(locsRes.locations);
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (Array.isArray(vendorsRes)) setVendors(vendorsRes.filter((v: { status: string }) => v.status === 'Active'));
      })
      .catch(() => {});

    const saved = localStorage.getItem('assetCategories');
    if (saved) {
      try {
        setCategories(Array.from(new Set(CATEGORIES.concat(JSON.parse(saved)))));
      } catch (_) {}
    }

    generateAssetId();
  }, []);

  useEffect(() => {
    if (form.category && form.assetId) generateAssetId();
  }, [form.category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (quantity < 1 || quantity > 1000) {
      setError('Quantity must be between 1 and 1000');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not signed in');
      return;
    }

    const payload = (assetId?: string) => ({
      ...form,
      assetId: assetId ?? form.assetId,
      cost: form.cost ? Number(form.cost) : undefined,
      purchaseDate: form.purchaseDate || undefined,
      warrantyExpiry: form.warrantyExpiry || undefined,
      assignedToName: form.assignedToName.trim(),
      assignedToEmployeeCode: form.assignedToEmployeeCode.trim(),
      locationId: form.locationId || undefined,
      departmentId: form.departmentId || undefined,
      vendorId: form.vendorId || undefined,
      photos: photos.length ? photos : undefined,
      documents: documents.length ? documents : undefined,
    });

    if (quantity === 1) {
      setLoading(true);
      try {
        const url = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/assets` : '/api/assets';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload()),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create');
        router.push(`/dashboard/assets/${data._id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create asset');
      } finally {
        setLoading(false);
      }
      return;
    }

    setBulkCreating(true);
    setBulkProgress({ current: 0, total: quantity });
    try {
      const createdAssets: string[] = [];
      const failedAssets: { id: string; error: string }[] = [];
      const url = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/assets` : '/api/assets';

      for (let i = 0; i < quantity; i++) {
        setBulkProgress({ current: i + 1, total: quantity });
        const currentAssetId = generateSequentialId(form.assetId, i);
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload(currentAssetId)),
          });
          const data = await res.json();
          if (!res.ok) failedAssets.push({ id: currentAssetId, error: data.message || 'Failed' });
          else createdAssets.push(currentAssetId);
        } catch (err) {
          failedAssets.push({ id: currentAssetId, error: err instanceof Error ? err.message : 'Network error' });
        }
      }

      if (failedAssets.length === 0) {
        alert(`Successfully created ${createdAssets.length} assets (${createdAssets[0]} to ${createdAssets[createdAssets.length - 1]})`);
        router.push('/dashboard/assets');
      } else {
        alert(`Created: ${createdAssets.length}, Failed: ${failedAssets.length}`);
        if (createdAssets.length > 0) router.push('/dashboard/assets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk creation failed');
    } finally {
      setBulkCreating(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Link
        href="/dashboard/assets"
        className={`${buttonClass} inline-block mb-4 border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
      >
        Back to assets
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Add asset</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Add one asset or create multiple identical assets. IDs are auto-generated from your org and category.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <Section title="Asset ID & quantity" accentClass="border-l-blue-500/50" titleClass="text-blue-400/80">
          <Field label="Asset ID" required hint="Format: ORG-CAT-NUMBER (auto-generated)">
            <input
              value={form.assetId}
              readOnly
              required
              placeholder="Generating..."
              className={`${inputClass} bg-gray-900/50 text-gray-400 cursor-not-allowed`}
            />
          </Field>
          <Field label="Quantity" required hint={quantity > 1 && form.assetId ? `Creates ${form.assetId} to ${generateSequentialId(form.assetId, quantity - 1)}` : '1 for single asset, up to 1000 for bulk'}>
            <input
              type="number"
              min={1}
              max={1000}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              className={inputClass}
            />
          </Field>
        </Section>

        <Section title="Basic information" accentClass="border-l-violet-500/50" titleClass="text-violet-400/80">
          <Field label="Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. Projector Room 201"
              className={inputClass}
            />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNewCategory();
                  }
                }}
                placeholder="New category…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addNewCategory}
                className={`${buttonClass} shrink-0 border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20`}
              >
                Add
              </button>
            </div>
          </Field>
          <Field label="Model">
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputClass} placeholder="e.g. Epson EB-X06" />
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

        <Section title="Assignment & location" accentClass="border-l-amber-500/50" titleClass="text-amber-400/80">
          <Field label="Assigned to (name)" required>
            <input
              value={form.assignedToName}
              onChange={(e) => setForm({ ...form, assignedToName: e.target.value })}
              className={inputClass}
              placeholder="e.g. Rahul Sharma"
              required
            />
          </Field>
          <Field label="Employee code" required>
            <input
              value={form.assignedToEmployeeCode}
              onChange={(e) => setForm({ ...form, assignedToEmployeeCode: e.target.value })}
              className={inputClass}
              placeholder="e.g. EMP-1024"
              required
            />
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

        <Section title="Purchase & warranty" accentClass="border-l-emerald-500/50" titleClass="text-emerald-400/80">
          <Field label="Purchase date">
            <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Warranty expiry">
            <input type="date" value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} className={inputClass} />
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
            <p className="text-[11px] text-gray-600 mt-1">
              <Link href="/dashboard/vendors" className="text-blue-400 hover:text-blue-300">
                Manage vendors
              </Link>
            </p>
          </Field>
          <Field label="Cost (INR)">
            <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0" className={inputClass} />
          </Field>
        </Section>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="submit"
            disabled={loading || bulkCreating || generatingAssetId}
            className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50`}
          >
            {bulkCreating
              ? `Creating ${bulkProgress.current} of ${bulkProgress.total}…`
              : loading
              ? 'Creating…'
              : generatingAssetId
              ? 'Generating ID…'
              : quantity > 1
              ? `Create ${quantity} assets`
              : 'Add asset'}
          </button>
        </div>

        {bulkCreating && (
          <div className="mt-4">
            <div className="w-full bg-gray-700/60 rounded-full h-1.5">
              <div
                className="bg-emerald-500/70 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Creating asset {bulkProgress.current} of {bulkProgress.total}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
