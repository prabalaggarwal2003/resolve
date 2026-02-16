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

const inputClassName =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

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
    assignedTo: '' as string,
    locationId: '' as string,
    departmentId: '' as string,
    purchaseDate: '',
    warrantyExpiry: '',
    vendorId: '',
    cost: '',
  });
  const [photos, setPhotos] = useState<{ url: string; caption: string }[]>([]);
  const [documents, setDocuments] = useState<{ url: string; name: string; type: string }[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
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

      // Fetch organization info and ALL assets to find the highest ID
      const [orgRes, assetsRes] = await Promise.all([
        fetch(base ? `${base}/api/organization` : '/api/organization', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(base ? `${base}/api/assets?limit=9999&sort=createdAt&order=desc` : '/api/assets?limit=9999&sort=createdAt&order=desc', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const orgData = await orgRes.json();
      const assetsData = await assetsRes.json();

      if (!orgRes.ok || !orgData.organization || !orgData.organization.name) {
        throw new Error('Failed to fetch organization details');
      }

      // Get category from form - if not selected, use default "ASS" for Asset
      const selectedCategory = form.category || 'Asset';

      // Get organization prefix (first 3 letters of organization name, or full if shorter)
      const orgName = orgData.organization.name.replace(/[^A-Za-z]/g, ''); // Remove non-letters
      const orgPrefix = orgName.substring(0, 3).toUpperCase() || 'ORG';

      // Get category prefix (first 3 letters of category, or full if shorter)
      const categoryName = selectedCategory.replace(/[^A-Za-z]/g, ''); // Remove non-letters
      const categoryPrefix = categoryName.substring(0, 3).toUpperCase() || 'ASS';

      // Create the expected format: ORG-CAT-001
      const expectedPrefix = `${orgPrefix}-${categoryPrefix}`;

      // Find the highest asset number from existing assets with same org and category prefix
      let highestNumber = 0;

      if (assetsData.assets && assetsData.assets.length > 0) {
        // Extract numbers from all asset IDs that match our org and category prefix
        assetsData.assets.forEach((asset: any) => {
          if (asset.assetId && typeof asset.assetId === 'string') {
            // Expected format: ORG-CAT-123
            const parts = asset.assetId.split('-');
            if (parts.length === 3 && parts[0] === orgPrefix && parts[1] === categoryPrefix) {
              const num = parseInt(parts[2], 10);
              if (!isNaN(num) && num > highestNumber) {
                highestNumber = num;
              }
            }
          }
        });
      }

      // Next number is highest + 1
      const nextNumber = highestNumber + 1;

      // Dynamic padding: minimum 3 digits, but grows as needed
      const minDigits = 3;
      const numberLength = String(nextNumber).length;
      const paddingLength = Math.max(minDigits, numberLength);
      const paddedNumber = String(nextNumber).padStart(paddingLength, '0');

      // Generate ID in format: ORG-CAT-001 (e.g., ABC-PRO-001 for ABC School, Projector category)
      const generatedId = `${orgPrefix}-${categoryPrefix}-${paddedNumber}`;

      setForm({ ...form, assetId: generatedId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Asset ID');
      setTimeout(() => setError(''), 3000);
    } finally {
      setGeneratingAssetId(false);
    }
  };

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPhotos((p) => [...p, { url, caption: '' }]);
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

    // Save only custom categories (those not in the default CATEGORIES list)
    const customCategories = updatedCategories.filter(cat => !CATEGORIES.includes(cat));
    localStorage.setItem('assetCategories', JSON.stringify(customCategories));
  };

  const generateSequentialId = (baseId: string, index: number): string => {
    // Extract prefix and current number from base ID (e.g., "ABC-PRO-001")
    const parts = baseId.split('-');
    if (parts.length !== 3) return `${baseId}-${index + 1}`;

    const orgPrefix = parts[0]; // "ABC"
    const categoryPrefix = parts[1]; // "PRO"
    const baseNumber = parseInt(parts[2], 10); // 1

    const newNumber = baseNumber + index;
    const minDigits = 3;
    const numberLength = String(newNumber).length;
    const paddingLength = Math.max(minDigits, numberLength);
    const paddedNumber = String(newNumber).padStart(paddingLength, '0');

    return `${orgPrefix}-${categoryPrefix}-${paddedNumber}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    Promise.all([
      fetch(base ? `${base}/api/users` : '/api/users', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(base ? `${base}/api/locations` : '/api/locations', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(base ? `${base}/api/departments` : '/api/departments', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(base ? `${base}/api/vendors?status=Active` : '/api/vendors?status=Active', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([usersRes, locsRes, deptRes, vendorsRes]) => {
        if (usersRes.users) setUsers(usersRes.users);
        if (locsRes.locations) setLocations(locsRes.locations);
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (Array.isArray(vendorsRes)) setVendors(vendorsRes.filter((v: any) => v.status === 'Active'));
      })
      .catch(() => {});

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

    // Auto-generate Asset ID on mount
    generateAssetId();
  }, []);

  // Regenerate asset ID when category changes
  useEffect(() => {
    if (form.category && form.assetId) {
      generateAssetId();
    }
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

    if (quantity === 1) {
      // Single asset creation (existing logic)
      setLoading(true);
      try {
        const url = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/assets` : '/api/assets';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...form,
            cost: form.cost ? Number(form.cost) : undefined,
            purchaseDate: form.purchaseDate || undefined,
            warrantyExpiry: form.warrantyExpiry || undefined,
            assignedTo: form.assignedTo || undefined,
            locationId: form.locationId || undefined,
            departmentId: form.departmentId || undefined,
            photos: photos.length ? photos : undefined,
            documents: documents.length ? documents : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create');
        router.push(`/dashboard/assets/${data._id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create asset');
      } finally {
        setLoading(false);
      }
    } else {
      // Bulk asset creation
      setBulkCreating(true);
      setBulkProgress({ current: 0, total: quantity });

      try {
        const baseAssetId = form.assetId;
        const createdAssets: string[] = [];
        const failedAssets: { id: string; error: string }[] = [];

        for (let i = 0; i < quantity; i++) {
          setBulkProgress({ current: i + 1, total: quantity });

          // Generate sequential asset ID
          const currentAssetId = generateSequentialId(baseAssetId, i);

          try {
            const url = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api/assets` : '/api/assets';
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                ...form,
                assetId: currentAssetId,
                cost: form.cost ? Number(form.cost) : undefined,
                purchaseDate: form.purchaseDate || undefined,
                warrantyExpiry: form.warrantyExpiry || undefined,
                assignedTo: form.assignedTo || undefined,
                locationId: form.locationId || undefined,
                departmentId: form.departmentId || undefined,
                photos: photos.length ? photos : undefined,
                documents: documents.length ? documents : undefined,
              }),
            });

            const data = await res.json();
            if (!res.ok) {
              failedAssets.push({ id: currentAssetId, error: data.message || 'Failed' });
            } else {
              createdAssets.push(currentAssetId);
            }
          } catch (err) {
            failedAssets.push({ id: currentAssetId, error: err instanceof Error ? err.message : 'Network error' });
          }
        }

        // Show summary
        if (failedAssets.length === 0) {
          alert(`✅ Successfully created ${createdAssets.length} assets!\n\nIDs: ${createdAssets[0]} to ${createdAssets[createdAssets.length - 1]}`);
          router.push('/dashboard/assets');
        } else {
          const summary = `Created: ${createdAssets.length}\nFailed: ${failedAssets.length}\n\nFailed Assets:\n${failedAssets.slice(0, 10).map(f => `${f.id}: ${f.error}`).join('\n')}${failedAssets.length > 10 ? '\n...and more' : ''}`;
          alert(summary);
          if (createdAssets.length > 0) {
            router.push('/dashboard/assets');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk creation failed');
      } finally {
        setBulkCreating(false);
        setBulkProgress({ current: 0, total: 0 });
      }
    }
  };

  return (
    <div>
      <Link href="/dashboard/assets" className="inline-block mb-4 text-slate-600 hover:text-slate-900">
        ← Back to assets
      </Link>
      <h1 className="text-2xl font-bold mb-2">Add asset</h1>
      <p className="text-slate-600 mb-6">
        Classroom, lab, or office — add one asset at a time. You can add location & department later.
      </p>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg bg-white p-6 rounded-lg border border-slate-200"
      >
        {error && (
          <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
        )}
        <Field label="Asset ID (auto-generated)" required>
          <input
            value={form.assetId}
            readOnly
            required
            placeholder="Generating..."
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 cursor-not-allowed"
            title="Auto-generated based on your organization name and asset category"
          />
          <p className="text-xs text-slate-500 mt-1">
            Format: [ORG]-[CATEGORY]-[NUMBER] (e.g., ABC-PRO-001 for ABC School, Projector)
          </p>
        </Field>
        <Field label="Quantity (How many identical assets?)" required>
          <input
            type="number"
            min="1"
            max="1000"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className={inputClassName}
            placeholder="1"
          />
          {quantity > 1 && form.assetId ? (
            <p className="text-xs text-green-600 mt-1 font-medium">
              ✓ Will create {quantity} assets with IDs: {form.assetId} to {generateSequentialId(form.assetId, quantity - 1)}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">
              Enter 1 for single asset or more for bulk creation (max 1000)
            </p>
          )}
        </Field>
        <Field label="Name" required>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g. Projector Room 201"
            className={inputClassName}
          />
        </Field>
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={inputClassName}
          >
            <option value="">Select</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
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
              placeholder="Add new category..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              type="button"
              onClick={addNewCategory}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium text-sm hover:bg-slate-700"
            >
              Add
            </button>
          </div>
        </Field>
        <Field label="Model">
          <input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="e.g. Epson EB-X06"
            className={inputClassName}
          />
        </Field>
        <Field label="Serial number">
          <input
            value={form.serialNumber}
            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            className={inputClassName}
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className={inputClassName}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </Field>
        <Field label="Assigned to (optional)">
          <select
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            className={inputClassName}
          >
            <option value="">None</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </Field>
        <Field label="Location (optional)">
          <select
            value={form.locationId}
            onChange={(e) => setForm({ ...form, locationId: e.target.value })}
            className={inputClassName}
          >
            <option value="">None</option>
            {locations.map((l) => (
              <option key={l._id} value={l._id}>{l.name} ({l.type})</option>
            ))}
          </select>
        </Field>
        <Field label="Department (optional)">
          <select
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            className={inputClassName}
          >
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Purchase date">
          <input
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
            className="w-full px-3 py-2.5 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </Field>
        <Field label="Warranty expiry">
          <input
            type="date"
            value={form.warrantyExpiry}
            onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })}
            className="w-full px-3 py-2.5 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            You'll be notified when warranty expires
          </p>
        </Field>
        <Field label="Vendor">
          <select
            value={form.vendorId}
            onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
            className={inputClassName}
          >
            <option value="">Select vendor (optional)</option>
            {vendors.map((v) => (
              <option key={v._id} value={v._id}>
                {v.vendorId} - {v.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            <Link href="/dashboard/vendors" className="text-blue-600 hover:underline">
              Manage vendors
            </Link> to add new vendors
          </p>
        </Field>
        <Field label="Cost (₹)">
          <input
            type="number"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            placeholder="0"
            className={inputClassName}
          />
        </Field>
        <Field label="Photos (optional)">
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
        <Field label="Documents (optional)">
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
        <button
          type="submit"
          disabled={loading || bulkCreating || generatingAssetId}
          className="mt-4 px-6 py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-60 hover:bg-primary-hover"
        >
          {bulkCreating
            ? `Creating ${bulkProgress.current} of ${bulkProgress.total}...`
            : loading
            ? 'Creating asset...'
            : generatingAssetId
            ? 'Generating ID...'
            : quantity > 1
            ? `Create ${quantity} Assets`
            : 'Add asset'}
        </button>

        {bulkCreating && (
          <div className="mt-4">
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-sm text-slate-600 text-center mt-2">
              Creating asset {bulkProgress.current} of {bulkProgress.total}...
            </p>
          </div>
        )}
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block mb-1.5 font-medium text-slate-700 dark:text-gray-300">
        {label} {required && '*'}
      </label>
      {children}
    </div>
  );
}
