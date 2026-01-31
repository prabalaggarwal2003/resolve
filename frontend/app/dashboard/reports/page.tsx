'use client';

import { useState } from 'react';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

function escapeCsvCell(s: string): string {
  if (s == null || s === undefined) return '';
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function ReportsPage() {
  const [exporting, setExporting] = useState<'assets' | 'issues' | null>(null);
  const [error, setError] = useState('');

  const exportAssetsCsv = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not signed in');
      return;
    }
    setExporting('assets');
    setError('');
    try {
      const res = await fetch(api('/api/assets?limit=2000'), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch assets');
      const assets = data.assets || [];
      const headers = [
        'Asset ID',
        'Name',
        'Category',
        'Model',
        'Serial Number',
        'Status',
        'Location',
        'Assigned To',
        'Purchase Date',
        'Vendor',
        'Cost',
        'Created At',
      ];
      const rows = assets.map(
        (a: {
          assetId?: string;
          name?: string;
          category?: string;
          model?: string;
          serialNumber?: string;
          status?: string;
          locationId?: { name?: string; path?: string };
          assignedTo?: { name?: string; email?: string };
          purchaseDate?: string;
          vendor?: string;
          cost?: number;
          createdAt?: string;
        }) => [
          escapeCsvCell(a.assetId),
          escapeCsvCell(a.name),
          escapeCsvCell(a.category),
          escapeCsvCell(a.model),
          escapeCsvCell(a.serialNumber),
          escapeCsvCell(a.status),
          escapeCsvCell(a.locationId?.path || a.locationId?.name || ''),
          escapeCsvCell(a.assignedTo ? `${a.assignedTo.name} (${a.assignedTo.email})` : ''),
          escapeCsvCell(a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : ''),
          escapeCsvCell(a.vendor),
          escapeCsvCell(a.cost != null ? String(a.cost) : ''),
          escapeCsvCell(a.createdAt ? new Date(a.createdAt).toISOString() : ''),
        ]
      );
      const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assets-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const exportIssuesCsv = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Not signed in');
      return;
    }
    setExporting('issues');
    setError('');
    try {
      const res = await fetch(api('/api/issues?limit=2000'), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch issues');
      const issues = data.issues || [];
      const headers = [
        'Ticket ID',
        'Title',
        'Category',
        'Status',
        'Asset',
        'Asset ID',
        'Reporter',
        'Description',
        'Created At',
        'Updated At',
      ];
      const rows = issues.map(
        (i: {
          ticketId?: string;
          title?: string;
          category?: string;
          status?: string;
          assetId?: { name?: string; assetId?: string };
          reporterName?: string;
          reporterEmail?: string;
          description?: string;
          createdAt?: string;
          updatedAt?: string;
        }) => [
          escapeCsvCell(i.ticketId),
          escapeCsvCell(i.title),
          escapeCsvCell(i.category),
          escapeCsvCell(i.status),
          escapeCsvCell(i.assetId?.name),
          escapeCsvCell(i.assetId?.assetId),
          escapeCsvCell(i.reporterName || i.reporterEmail || ''),
          escapeCsvCell((i.description || '').replace(/\s+/g, ' ')),
          escapeCsvCell(i.createdAt ? new Date(i.createdAt).toISOString() : ''),
          escapeCsvCell(i.updatedAt ? new Date(i.updatedAt).toISOString() : ''),
        ]
      );
      const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `issues-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Reports</h1>
      <p className="text-slate-600 mb-6">
        Export assets, issues, and maintenance history as CSV for audits and records.
      </p>

      {error && (
        <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="text-lg font-semibold mb-2">Assets</h2>
          <p className="text-slate-600 text-sm mb-4">
            Download all assets (ID, name, category, status, location, assigned user, purchase date, vendor, cost).
          </p>
          <button
            type="button"
            onClick={exportAssetsCsv}
            disabled={exporting !== null}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-60 hover:bg-primary-hover"
          >
            {exporting === 'assets' ? 'Exporting…' : 'Export as CSV'}
          </button>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h2 className="text-lg font-semibold mb-2">Issues</h2>
          <p className="text-slate-600 text-sm mb-4">
            Download all issues (ticket ID, title, category, status, asset, reporter, dates).
          </p>
          <button
            type="button"
            onClick={exportIssuesCsv}
            disabled={exporting !== null}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-60 hover:bg-primary-hover"
          >
            {exporting === 'issues' ? 'Exporting…' : 'Export as CSV'}
          </button>
        </div>
      </div>

      <p className="mt-6 text-slate-500 text-sm">
        Exports are limited to 2,000 records. For larger datasets, use filters on the Assets and Issues pages and export in batches.
      </p>
    </div>
  );
}
