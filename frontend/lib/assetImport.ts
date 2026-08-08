import { apiUrl, authHeaders } from './api';

export type ImportHeader = {
  key: string;
  label: string;
  sampleValues: string[];
  detectedType: string;
};

export type DestinationField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  section: string;
  builtIn: boolean;
  options: string[];
  relationship: string | null;
};

export type ColumnMapping = {
  sourceColumn: string;
  targetField: string;
  ignored: boolean;
  suggested?: boolean;
  createCustomField?: boolean;
  customField?: {
    key: string;
    label: string;
    type: string;
    section?: string;
    options?: string[];
  };
};

export type ImportJob = {
  id: string;
  _id?: string;
  fileName: string;
  fileType: string;
  sheetNames: string[];
  sheetName: string;
  headers: ImportHeader[];
  rowCount: number;
  previewRows: Record<string, string>[];
  templateId?: string | null;
  columnMappings: ColumnMapping[];
  valueMappings: Record<string, Record<string, string>>;
  transforms: Record<string, Record<string, string>>;
  relationshipRules: Record<string, { mode?: string; matches?: Record<string, string> }>;
  duplicateHandling: 'skip' | 'update' | 'create_new' | 'stop';
  status: string;
  wizardStep?: string;
  validationSummary?: { valid: number; warnings: number; errors: number };
  result?: { created: number; updated: number; skipped: number; failed: number };
  createdAt?: string;
  createdBy?: { name?: string; email?: string };
  errorMessage?: string;
};

export type ImportCatalog = {
  template: { _id: string; name: string; statuses: string[]; fields: unknown[] } | null;
  sections?: { key: string; label: string }[];
  destinationFields: DestinationField[];
  entities: {
    locations: { id: string; name: string; path?: string; code?: string }[];
    departments: { id: string; name: string }[];
    partners: { id: string; name: string; code?: string }[];
    users: { id: string; name: string; email?: string }[];
    groups?: { id: string; name: string; key?: string }[];
    categories?: string[];
    statuses: string[];
    relationshipTypes: { key: string; label: string }[];
  };
};

export type ImportRow = {
  id: string;
  rowIndex: number;
  raw: Record<string, string>;
  mapped: Record<string, unknown>;
  status: string;
  issues: { severity: string; field?: string; message: string }[];
};

export type SavedMapping = {
  id: string;
  name: string;
  description?: string;
  templateId?: string | null;
  sourceHeaders: string[];
  columnMappings: ColumnMapping[];
  valueMappings: Record<string, Record<string, string>>;
  transforms: Record<string, Record<string, string>>;
  relationshipRules: Record<string, unknown>;
  duplicateHandling: string;
};

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export async function fetchImportCatalog(templateId?: string) {
  const q = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
  const res = await fetch(apiUrl(`/asset-import/catalog${q}`), { headers: authHeaders() });
  return jsonOrThrow(res) as Promise<{
    templates: { _id: string; name: string; isDefault?: boolean }[];
    catalog: ImportCatalog;
  }>;
}

export async function downloadResolveImportTemplate(templateId?: string) {
  const q = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
  const res = await fetch(apiUrl(`/asset-import/template.csv${q}`), { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to download template');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resolve-asset-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadImportFile(file: File, sheetName?: string) {
  const form = new FormData();
  form.append('file', file);
  if (sheetName) form.append('sheetName', sheetName);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(apiUrl('/asset-import/upload'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return jsonOrThrow(res) as Promise<{
    job: ImportJob;
    headers: ImportHeader[];
    previewRows: Record<string, string>[];
    rowCount: number;
    sheetNames: string[];
    sheetName: string;
  }>;
}

export async function selectImportSheet(jobId: string, sheetName: string) {
  const res = await fetch(apiUrl(`/asset-import/${jobId}/sheet`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sheetName }),
  });
  return jsonOrThrow(res);
}

export async function configureImportJob(
  jobId: string,
  body: { templateId?: string; duplicateHandling?: string; wizardStep?: string }
) {
  const res = await fetch(apiUrl(`/asset-import/${jobId}/configure`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res) as Promise<{
    job: ImportJob;
    catalog: ImportCatalog;
    suggestedMappings: ColumnMapping[];
    suggestedSavedMapping: SavedMapping | null;
  }>;
}

export async function saveJobMappings(
  jobId: string,
  body: {
    columnMappings: ColumnMapping[];
    valueMappings?: Record<string, Record<string, string>>;
    transforms?: Record<string, Record<string, string>>;
    relationshipRules?: Record<string, unknown>;
    duplicateHandling?: string;
    savedMappingId?: string | null;
    wizardStep?: string;
  }
) {
  const res = await fetch(apiUrl(`/asset-import/${jobId}/mappings`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res) as Promise<{ job: ImportJob }>;
}

export async function saveImportProgress(jobId: string, wizardStep: string, duplicateHandling?: string) {
  const res = await fetch(apiUrl(`/asset-import/${jobId}/progress`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ wizardStep, duplicateHandling }),
  });
  return jsonOrThrow(res) as Promise<{ job: ImportJob }>;
}

export async function fetchImportJob(jobId: string) {
  const res = await fetch(apiUrl(`/asset-import/${jobId}`), { headers: authHeaders() });
  return jsonOrThrow(res) as Promise<{ job: ImportJob; catalog?: ImportCatalog }>;
}

export async function validateImportJob(jobId: string) {
  const res = await fetch(apiUrl(`/asset-import/${jobId}/validate`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  return jsonOrThrow(res) as Promise<{
    job: ImportJob;
    summary: { valid: number; warnings: number; errors: number };
    previewRows: ImportRow[];
    errorRows: ImportRow[];
  }>;
}

export async function fetchImportRows(
  jobId: string,
  opts?: { page?: number; limit?: number; status?: string }
) {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.status) params.set('status', opts.status);
  const q = params.toString() ? `?${params}` : '';
  const res = await fetch(apiUrl(`/asset-import/${jobId}/rows${q}`), { headers: authHeaders() });
  return jsonOrThrow(res) as Promise<{ rows: ImportRow[]; total: number; page: number; limit: number }>;
}

export async function executeImportJob(jobId: string) {
  const res = await fetch(apiUrl(`/asset-import/${jobId}/execute`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  return jsonOrThrow(res) as Promise<{
    job: ImportJob;
    result: { created: number; updated: number; skipped: number; failed: number };
    failedRows?: ImportRow[];
  }>;
}

export async function fetchImportHistory(opts?: { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const q = params.toString() ? `?${params}` : '';
  const res = await fetch(apiUrl(`/asset-import/history${q}`), { headers: authHeaders() });
  return jsonOrThrow(res) as Promise<{
    jobs: ImportJob[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
}

export async function downloadImportErrors(jobId: string) {
  const res = await fetch(apiUrl(`/asset-import/${jobId}/errors.csv`), { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to download error report');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-errors.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchSavedMappings() {
  const res = await fetch(apiUrl('/asset-import/mappings'), { headers: authHeaders() });
  return jsonOrThrow(res) as Promise<{ mappings: SavedMapping[] }>;
}

export async function saveImportMapping(body: Partial<SavedMapping> & { name: string }) {
  const res = await fetch(apiUrl('/asset-import/mappings'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res) as Promise<{ mapping: SavedMapping }>;
}

export async function deleteSavedMapping(id: string) {
  const res = await fetch(apiUrl(`/asset-import/mappings/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return jsonOrThrow(res);
}

export const IMPORT_STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'configure', label: 'Configure' },
  { id: 'map', label: 'Map' },
  { id: 'values', label: 'Values' },
  { id: 'validate', label: 'Validate' },
  { id: 'preview', label: 'Preview' },
  { id: 'import', label: 'Import' },
] as const;

export type ImportStepId = (typeof IMPORT_STEPS)[number]['id'];
