import { api, authHeaders } from './issues';

export type Employee = {
  _id: string;
  employeeId: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  team?: string;
  isActive?: boolean;
  notes?: string;
  kind?: 'employee';
};

export type EmployeeImportJob = {
  _id: string;
  fileName: string;
  status: string;
  rowCount: number;
  headers?: { key: string; label: string; sampleValues?: string[] }[];
  previewRows?: Record<string, string>[];
  columnMappings?: {
    sourceColumn: string;
    targetField: string;
    ignored?: boolean;
    suggested?: boolean;
  }[];
  duplicateHandling?: string;
  autoGenerateEmployeeIds?: boolean;
  validationSummary?: { valid: number; warnings: number; errors: number };
  result?: { created: number; updated: number; skipped: number; failed: number };
};

export type DestinationField = {
  key: string;
  label: string;
  required?: boolean;
};

export async function fetchEmployees(params: { q?: string; active?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.active) qs.set('active', params.active);
  const res = await fetch(api(`/api/issues/employees?${qs}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load employees');
  return data as { employees: Employee[] };
}

export async function createEmployee(body: Partial<Employee>) {
  const res = await fetch(api('/api/issues/employees'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create employee');
  return data as { employee: Employee };
}

export async function updateEmployee(id: string, body: Partial<Employee>) {
  const res = await fetch(api(`/api/issues/employees/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update employee');
  return data as { employee: Employee };
}

export async function deactivateEmployee(id: string) {
  const res = await fetch(api(`/api/issues/employees/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to deactivate');
  return data as { employee: Employee };
}

export async function downloadEmployeeTemplate() {
  const res = await fetch(api('/api/issues/employees/import/template.csv'), {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || 'Failed to download template');
  }
  return res.blob();
}

export async function uploadEmployeeImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(api('/api/issues/employees/import/upload'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data as {
    job: EmployeeImportJob;
    headers: { key: string; label: string }[];
    previewRows: Record<string, string>[];
    suggestedMappings: EmployeeImportJob['columnMappings'];
    catalog: { destinationFields: DestinationField[] };
  };
}

export async function saveEmployeeMappings(
  jobId: string,
  body: {
    columnMappings: EmployeeImportJob['columnMappings'];
    duplicateHandling?: string;
    autoGenerateEmployeeIds?: boolean;
  }
) {
  const res = await fetch(api(`/api/issues/employees/import/${jobId}/mappings`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save mappings');
  return data as { job: EmployeeImportJob };
}

export async function validateEmployeeImport(jobId: string) {
  const res = await fetch(api(`/api/issues/employees/import/${jobId}/validate`), {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Validation failed');
  return data as { job: EmployeeImportJob; summary: EmployeeImportJob['validationSummary'] };
}

export async function executeEmployeeImportJob(jobId: string) {
  const res = await fetch(api(`/api/issues/employees/import/${jobId}/execute`), {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Import failed');
  return data as { job: EmployeeImportJob; result: EmployeeImportJob['result'] };
}

export async function fetchEmployeeImportRows(jobId: string, limit = 30) {
  const res = await fetch(api(`/api/issues/employees/import/${jobId}/rows?limit=${limit}`), {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load rows');
  return data as {
    rows: {
      rowIndex: number;
      status: string;
      mapped?: Record<string, string>;
      issues?: { level: string; field?: string; message: string }[];
    }[];
  };
}
