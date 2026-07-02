'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { canWrite } from '@/lib/permissions';
import AssetTemplateFieldsForm, { buildAssetPayloadFromTemplate } from '@/components/AssetTemplateFieldsForm';
import type { AssetTemplate } from '@/lib/assetTemplates';
import type { LocationTreeNode } from '@/lib/locations';
import type { AssetGroup } from '@/lib/assetGroups';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export default function NewAssetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<AssetTemplate[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [template, setTemplate] = useState<AssetTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string | string[]>>({ status: 'available' });
  const [locationTree, setLocationTree] = useState<LocationTreeNode[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; vendorId: string; name: string }[]>([]);
  const [assetId, setAssetId] = useState('');
  const [generatingAssetId, setGeneratingAssetId] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const generateAssetId = async (categoryName?: string) => {
    setGeneratingAssetId(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setGeneratingAssetId(false);
      return;
    }
    try {
      const cat = categoryName || template?.name || 'Asset';
      const [orgRes, assetsRes] = await Promise.all([
        fetch(api('/api/organization'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(api('/api/assets?limit=9999&sort=createdAt&order=desc'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const orgData = await orgRes.json();
      const assetsData = await assetsRes.json();
      const orgName = orgData.organization?.name?.replace(/[^A-Za-z]/g, '') || 'ORG';
      const orgPrefix = orgName.substring(0, 3).toUpperCase() || 'ORG';
      const categoryPrefix = cat.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'ASS';
      let highest = 0;
      assetsData.assets?.forEach((a: { assetId?: string }) => {
        if (!a.assetId) return;
        const parts = a.assetId.split('-');
        if (parts.length === 3 && parts[0] === orgPrefix && parts[1] === categoryPrefix) {
          const n = parseInt(parts[2], 10);
          if (!isNaN(n) && n > highest) highest = n;
        }
      });
      const next = highest + 1;
      const padded = String(next).padStart(Math.max(3, String(next).length), '0');
      setAssetId(`${orgPrefix}-${categoryPrefix}-${padded}`);
    } catch {
      setError('Failed to generate asset ID');
    } finally {
      setGeneratingAssetId(false);
    }
  };

  const generateSequentialId = (baseId: string, index: number): string => {
    const parts = baseId.split('-');
    if (parts.length !== 3) return `${baseId}-${index + 1}`;
    const n = parseInt(parts[2], 10) + index;
    return `${parts[0]}-${parts[1]}-${String(n).padStart(Math.max(3, String(n).length), '0')}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    Promise.all([
      fetch(api('/api/asset-templates'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/asset-groups'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/locations/tree'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/vendors?status=Active'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([tplRes, groupsRes, locsRes, deptRes, vendorsRes]) => {
        const groupedTemplates = (tplRes.templates || []).filter((t: AssetTemplate) => t.groupId);
        if (groupsRes.groups?.length) {
          setAssetGroups(groupsRes.groups);
          const firstGroup = groupsRes.groups[0];
          setSelectedGroupId(firstGroup._id);
          const groupTemplates = groupedTemplates.filter(
            (t: AssetTemplate) => String(t.groupId) === String(firstGroup._id)
          );
          if (groupTemplates.length) {
            const first = groupTemplates[0];
            setTemplates(groupedTemplates);
            setSelectedTemplateId(first._id);
            setTemplate(first);
            setFieldValues({ status: first.statuses?.[0] || 'available' });
            generateAssetId(first.name);
          } else {
            setTemplates(groupedTemplates);
          }
        } else if (groupedTemplates.length) {
          setTemplates(groupedTemplates);
          const first = groupedTemplates[0];
          setSelectedTemplateId(first._id);
          setTemplate(first);
          setFieldValues({ status: first.statuses?.[0] || 'available' });
          generateAssetId(first.name);
        }
        if (locsRes.tree) setLocationTree(locsRes.tree);
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (Array.isArray(vendorsRes)) setVendors(vendorsRes.filter((v: { status: string }) => v.status === 'Active'));
      })
      .catch(() => {});
  }, []);

  const templatesInGroup = templates.filter((t) => String(t.groupId) === selectedGroupId);

  const onGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const inGroup = templates.filter((t) => String(t.groupId) === groupId);
    const first = inGroup[0] || null;
    setSelectedTemplateId(first?._id || '');
    setTemplate(first);
    setFieldValues({ status: first?.statuses?.[0] || 'available' });
    if (first) generateAssetId(first.name);
  };

  const onTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    const t = templates.find((x) => x._id === id) || null;
    setTemplate(t);
    setFieldValues({ status: t?.statuses?.[0] || 'available' });
    if (t) generateAssetId(t.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!template) {
      setError('Select an asset template');
      return;
    }
    if (quantity < 1 || quantity > 1000) {
      setError('Quantity must be between 1 and 1000');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not signed in');
      return;
    }

    const postOne = async (id: string, copyValues: Record<string, string | string[]>, includeSerial: boolean) => {
      const values = { ...copyValues };
      if (!includeSerial) delete values.serialNumber;
      const payload = buildAssetPayloadFromTemplate(template, values, {
        assetId: id,
        templateId: template._id,
      });
      const res = await fetch(api('/api/assets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create');
      return data;
    };

    if (quantity === 1) {
      setLoading(true);
      try {
        const data = await postOne(assetId, fieldValues, true);
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
      let created = 0;
      for (let i = 0; i < quantity; i++) {
        setBulkProgress({ current: i + 1, total: quantity });
        const id = generateSequentialId(assetId, i);
        await postOne(id, fieldValues, i === 0);
        created++;
      }
      alert(`Successfully created ${created} assets`);
      router.push('/dashboard/assets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk creation failed');
    } finally {
      setBulkCreating(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  };

  if (!canWrite('assets')) {
    return (
      <div className="max-w-7xl mx-auto">
        <p className="text-red-400 text-sm">You do not have permission to add assets.</p>
        <Link href="/dashboard/assets" className={`${buttonClass} inline-block mt-3 border-gray-700/60 text-gray-400 no-underline`}>
          Back to assets
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/dashboard/assets" className={`${buttonClass} inline-block mb-4 border-gray-700/60 bg-gray-400/20 text-gray-400 hover:text-gray-200 no-underline`}>
        Back to assets
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Add asset</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Choose a template — fields load automatically. Bulk copies share all values except asset ID, serial number, and QR.
          </p>
        </div>
        <Link
          href="/dashboard/assets/templates"
          className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 no-underline`}
        >
          Asset templates
        </Link>
      </div>

      {error && <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 px-4 py-4 mb-4">
          <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-3">Template & ID</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Asset group *</label>
              <select
                value={selectedGroupId}
                onChange={(e) => onGroupChange(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select group</option>
                {assetGroups.map((g) => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Template / category *</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => onTemplateChange(e.target.value)}
                className={inputClass}
                required
                disabled={!selectedGroupId}
              >
                <option value="">{selectedGroupId ? 'Select template' : 'Select a group first'}</option>
                {templatesInGroup.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
              {selectedGroupId && templatesInGroup.length === 0 && (
                <p className="text-[11px] text-amber-400/90 mt-1">
                  No templates in this group. Assign templates on the templates page.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Asset ID *</label>
              <input value={assetId} readOnly className={`${inputClass} bg-gray-900/50 text-gray-400 cursor-not-allowed`} />
            </div>
            <div>
              <label className={labelClass}>Quantity *</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className={inputClass}
              />
              {quantity > 1 && assetId && (
                <p className="text-[11px] text-gray-600 mt-1">
                  Creates {assetId} … {generateSequentialId(assetId, quantity - 1)} (serial # only on first)
                </p>
              )}
            </div>
          </div>
        </div>

        {template && (
          <AssetTemplateFieldsForm
            template={template}
            values={fieldValues}
            setValues={setFieldValues}
            locationTree={locationTree}
            departments={departments}
            vendors={vendors}
          />
        )}

        <button
          type="submit"
          disabled={loading || bulkCreating || generatingAssetId || !template}
          className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50`}
        >
          {bulkCreating
            ? `Creating ${bulkProgress.current}/${bulkProgress.total}…`
            : loading
            ? 'Creating…'
            : quantity > 1
            ? `Create ${quantity} assets`
            : 'Add asset'}
        </button>
      </form>
    </div>
  );
}
