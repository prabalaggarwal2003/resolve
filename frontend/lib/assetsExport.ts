import {
  COLUMN_DEFS,
  STATUS_LABELS,
  type ColumnId,
  type BasicFilters,
  type AdvancedFilter,
} from '@/lib/assetsTableConfig';
import { breadcrumbForNode } from '@/lib/locations';

export type AssetExportRow = {
  assetId?: string;
  name?: string;
  category?: string;
  status?: string;
  model?: string;
  serialNumber?: string;
  cost?: number;
  purchaseDate?: string;
  createdAt?: string;
  updatedAt?: string;
  warrantyExpiry?: string;
  tags?: string[];
  assignedToName?: string;
  assignedToEmployeeCode?: string;
  locationId?: { name: string; path?: string };
  groupId?: { name: string };
  departmentId?: { name: string };
  assignedTo?: { name: string };
};

function formatDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(n?: number) {
  if (n == null) return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function assetCellText(asset: AssetExportRow, col: ColumnId): string {
  switch (col) {
    case 'assetId':
      return asset.assetId || '';
    case 'name':
      return asset.name || '';
    case 'category':
      return asset.category || '';
    case 'assetGroup':
      return asset.groupId?.name || '';
    case 'status':
      return STATUS_LABELS[asset.status || ''] || asset.status?.replace(/_/g, ' ') || '';
    case 'location':
      return breadcrumbForNode(asset.locationId) || '';
    case 'assignedTo':
      return asset.assignedToName || asset.assignedTo?.name || '';
    case 'model':
      return asset.model || '';
    case 'serialNumber':
      return asset.serialNumber || '';
    case 'department':
      return asset.departmentId?.name || '';
    case 'cost':
      return formatCurrency(asset.cost);
    case 'purchaseDate':
      return formatDate(asset.purchaseDate);
    case 'createdAt':
      return formatDate(asset.createdAt);
    case 'warrantyExpiry':
      return formatDate(asset.warrantyExpiry);
    case 'updatedAt':
      return formatDate(asset.updatedAt);
    case 'employeeCode':
      return asset.assignedToEmployeeCode || '';
    case 'tags':
      return asset.tags?.length ? asset.tags.join(', ') : '';
    default:
      return '';
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAssetsCsv(assets: AssetExportRow[], columns: ColumnId[]): string {
  const headers = columns.map((id) => COLUMN_DEFS[id]?.label || id);
  const lines = [
    headers.map(csvEscape).join(','),
    ...assets.map((asset) => columns.map((col) => csvEscape(assetCellText(asset, col))).join(',')),
  ];
  return lines.join('\n');
}

export function downloadTextFile(content: string, fileName: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export type AssetListQueryInput = {
  search?: string;
  assignedTo?: string;
  assetIds?: string[] | null;
  basicFilters?: Partial<BasicFilters> | null;
  advancedFilters?: AdvancedFilter[];
  sort?: string;
  order?: 'asc' | 'desc';
};

/** Build query params matching the Assets list API (no pagination by default). */
export function buildAssetListSearchParams(
  input: AssetListQueryInput,
  opts?: { page?: number; limit?: number; forExport?: boolean }
): URLSearchParams {
  const params = new URLSearchParams();
  if (input.search?.trim()) params.set('search', input.search.trim());
  if (input.assignedTo) params.set('assignedTo', input.assignedTo);
  if (input.assetIds !== undefined && input.assetIds !== null) {
    params.set('assetIds', input.assetIds.join(','));
  }

  const bf = input.basicFilters;
  if (bf?.status) params.set('status', bf.status);
  if (bf?.category) params.set('category', bf.category);
  if (bf?.departmentId) params.set('departmentId', bf.departmentId);
  if (bf?.groupId) params.set('groupId', bf.groupId);
  const locationIds = bf?.locationIds?.filter(Boolean) ?? [];
  if (locationIds.length) {
    params.set('locationIds', locationIds.join(','));
    if (bf?.locationIncludeChildren === false) {
      params.set('locationIncludeChildren', 'false');
    }
  }
  if (input.advancedFilters?.length) {
    params.set('filters', JSON.stringify(input.advancedFilters));
  }
  if (input.sort) params.set('sort', input.sort);
  if (input.order) params.set('order', input.order);

  if (opts?.forExport) {
    params.set('forExport', '1');
    params.set('limit', String(opts.limit ?? 10000));
  } else {
    if (opts?.page != null) params.set('page', String(opts.page));
    if (opts?.limit != null) params.set('limit', String(opts.limit));
  }

  return params;
}

/** Convert a PNG/JPEG data URL to a JPEG file download. */
export function downloadDataUrlAsJpeg(dataUrl: string, fileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not create canvas'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to encode JPEG'));
              return;
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ? fileName : `${fileName}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            resolve();
          },
          'image/jpeg',
          0.92
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load QR image'));
    img.src = dataUrl;
  });
}
