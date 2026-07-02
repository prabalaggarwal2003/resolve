'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite } from '@/lib/permissions';
import AssetTemplateFieldsForm, {
  assetToFieldValues,
  buildAssetPatchFromTemplate,
} from '@/components/AssetTemplateFieldsForm';
import ChangeReasonModal from '@/components/ChangeReasonModal';
import { detectImportantChanges, type ImportantChange } from '@/lib/assetChangeReason';
import type { AssetTemplate } from '@/lib/assetTemplates';
import { buildFallbackTemplateFromAsset } from '@/lib/assetFieldDisplay';
import { breadcrumbForNode, flattenTree, type LocationTreeNode } from '@/lib/locations';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

type AssetRecord = Record<string, unknown> & {
  _id: string;
  assetId?: string;
  category?: string;
  templateId?: string | { _id: string };
  photos?: { url: string; caption?: string }[];
  documents?: { url: string; name: string; type?: string }[];
};

function resolveTemplateId(asset: AssetRecord): string {
  const tid = asset.templateId;
  if (!tid) return '';
  if (typeof tid === 'string') return tid;
  return tid._id || '';
}

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [error, setError] = useState('');
  const [template, setTemplate] = useState<AssetTemplate | null>(null);
  const [assetMeta, setAssetMeta] = useState({ assetId: '', category: '' });
  const [fieldValues, setFieldValues] = useState<Record<string, string | string[]>>({});
  const [originalFieldValues, setOriginalFieldValues] = useState<Record<string, string | string[]>>({});
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<ImportantChange[]>([]);
  const [changeReason, setChangeReason] = useState('');
  const [locationTree, setLocationTree] = useState<LocationTreeNode[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ _id: string; vendorId: string; name: string }[]>([]);
  const [photos, setPhotos] = useState<{ url: string; caption?: string }[]>([]);
  const [documents, setDocuments] = useState<{ url: string; name: string; type?: string }[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !params.id) {
      setPageLoading(false);
      return;
    }

    Promise.all([
      fetch(api(`/api/assets/${params.id}`), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/asset-templates'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/locations/tree'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/vendors?status=Active'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([asset, tplRes, locRes, deptRes, vendorsRes]) => {
        if (!asset._id) {
          setLoadErr(asset.message || 'Not found');
          return;
        }

        const record = asset as AssetRecord;
        const templates: AssetTemplate[] = tplRes.templates || [];
        const templateId = resolveTemplateId(record);
        const matched =
          templates.find((t) => t._id === templateId) ||
          templates.find((t) => t.name === record.category) ||
          buildFallbackTemplateFromAsset(record);

        setTemplate(matched);
        setAssetMeta({
          assetId: String(record.assetId || ''),
          category: String(record.category || matched.name),
        });
        setFieldValues(assetToFieldValues(record, matched));
        setOriginalFieldValues(assetToFieldValues(record, matched));
        setPhotos(
          Array.isArray(record.photos)
            ? record.photos.map((p) => ({ url: p.url, caption: p.caption ?? '' }))
            : []
        );
        setDocuments(
          Array.isArray(record.documents)
            ? record.documents.map((d) => ({ url: d.url, name: d.name, type: d.type ?? '' }))
            : []
        );

        if (locRes.tree) setLocationTree(locRes.tree);
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (Array.isArray(vendorsRes)) {
          setVendors(vendorsRes.filter((v: { status: string }) => v.status === 'Active'));
        }
      })
      .catch(() => setLoadErr('Failed to load'))
      .finally(() => setPageLoading(false));
  }, [params.id]);

  const saveAsset = async (reason?: string) => {
    if (!template) return;
    setError('');
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token || !params.id) {
      setLoading(false);
      return;
    }
    try {
      const payload = {
        ...buildAssetPatchFromTemplate(template, fieldValues),
        photos,
        documents,
        ...(reason ? { changeReason: reason } : {}),
      };
      const res = await fetch(api(`/api/assets/${params.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      router.push(`/dashboard/assets/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      setShowReasonModal(false);
    } finally {
      setLoading(false);
    }
  };

  const resolveFieldDisplay = (key: string, val: string | string[] | undefined): string => {
    if (key === 'locationId' && typeof val === 'string') {
      if (!val) return '—';
      const node = flattenTree(locationTree).find((l) => l._id === val);
      return breadcrumbForNode(node);
    }
    if (key === 'departmentId' && typeof val === 'string' && val) {
      return departments.find((d) => d._id === val)?.name || val;
    }
    if (key === 'vendorId' && typeof val === 'string' && val) {
      const v = vendors.find((x) => x._id === val);
      return v ? `${v.vendorId} — ${v.name}` : val;
    }
    if (key === 'status' && typeof val === 'string') return val.replace(/_/g, ' ');
    if (Array.isArray(val)) return val.length ? val.join(', ') : '—';
    if (val === undefined || val === null || val === '') return '—';
    return String(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    const important = detectImportantChanges(template, originalFieldValues, fieldValues).map((c) => ({
      ...c,
      oldValue: resolveFieldDisplay(c.field, originalFieldValues[c.field]),
      newValue: resolveFieldDisplay(c.field, fieldValues[c.field]),
    }));
    if (important.length > 0) {
      setPendingChanges(important);
      setChangeReason('');
      setShowReasonModal(true);
      return;
    }

    await saveAsset();
  };

  const handleConfirmReason = async () => {
    if (!changeReason.trim()) return;
    await saveAsset(changeReason.trim());
  };

  if (pageLoading) return <LoadingSpinner message="Loading asset..." />;

  if (!canWrite('assets')) {
    return (
      <div className="max-w-7xl mx-auto">
        <p className="text-red-400 text-sm">You do not have permission to edit assets.</p>
        <Link href={`/dashboard/assets/${params.id}`} className={`${buttonClass} inline-block mt-3 border-gray-700/60 text-gray-400 no-underline`}>
          Back to asset
        </Link>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="max-w-7xl mx-auto">
        <p className="text-red-400">{loadErr}</p>
        <div className="flex gap-2 mt-3">
          <Link href="/dashboard/assets" className={`${buttonClass} border-gray-700/60 text-gray-400 no-underline`}>
            Back to assets
          </Link>
          <Link href="/dashboard/assets/templates" className={`${buttonClass} border-violet-500/40 text-violet-300 no-underline`}>
            Asset templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Link
        href={`/dashboard/assets/${params.id}`}
        className={`${buttonClass} inline-block mb-4 border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 no-underline`}
      >
        Back to asset
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Edit asset</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Fields match the <span className="text-gray-300">{template?.name}</span> template — including tags and custom fields.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 px-4 py-4 mb-4">
          <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-3">Asset identity</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Asset ID</label>
              <input value={assetMeta.assetId} readOnly className={`${inputClass} bg-gray-900/50 text-gray-400 cursor-not-allowed`} />
            </div>
            <div>
              <label className={labelClass}>Template</label>
              <input value={template?.name || assetMeta.category} readOnly className={`${inputClass} bg-gray-900/50 text-gray-400 cursor-not-allowed`} />
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

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading || !template}
            className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50`}
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <Link
            href={`/dashboard/assets/${params.id}`}
            className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 no-underline`}
          >
            Cancel
          </Link>
        </div>
      </form>

      {showReasonModal && (
        <ChangeReasonModal
          changes={pendingChanges}
          reason={changeReason}
          onReasonChange={setChangeReason}
          onConfirm={handleConfirmReason}
          onCancel={() => setShowReasonModal(false)}
          saving={loading}
        />
      )}
    </div>
  );
}
