'use client';

import { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

const TYPES = ['campus', 'building', 'floor', 'room'] as const;

const TYPE_BADGE: Record<string, string> = {
  campus: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  building: 'text-violet-300 bg-violet-500/15 border-violet-500/30',
  floor: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  room: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
};

const TYPE_FILTER_ACTIVE: Record<string, string> = {
  '': 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  campus: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  building: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
  floor: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  room: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
};

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

type Location = {
  _id: string;
  name: string;
  type: string;
  parentId?: string | null;
  path?: string;
  code?: string;
  departmentId?: { _id: string; name: string } | null;
};

function SummaryCard({
  label,
  value,
  accent = 'text-gray-100',
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState({ name: '', type: 'room', parentId: '' as string, code: '', departmentId: '' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [addingDept, setAddingDept] = useState(false);
  const [deletingDept, setDeletingDept] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchLocations = () => {
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    Promise.all([
      fetch(api('/api/locations'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([locData, deptData]) => {
        if (locData.locations) setLocations(locData.locations);
        else setError(locData.message || 'Failed to load');
        if (deptData.departments) setDepartments(deptData.departments);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const getParentName = (parentId: string | null | undefined) => {
    if (!parentId) return '—';
    const p = locations.find((l) => l._id === parentId);
    return p ? p.name : parentId;
  };

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { campus: 0, building: 0, floor: 0, room: 0 };
    for (const loc of locations) {
      if (counts[loc.type] !== undefined) counts[loc.type]++;
    }
    return counts;
  }, [locations]);

  const addDepartment = async () => {
    const name = newDeptName.trim();
    if (!name) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setAddingDept(true);
    try {
      const res = await fetch(api('/api/departments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      setNewDeptName('');
      fetchLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add department');
    } finally {
      setAddingDept(false);
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Delete this department? This cannot be undone.')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setDeletingDept(id);
    try {
      const res = await fetch(api(`/api/departments/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      fetchLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingDept(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setSubmitLoading(false);
      return;
    }
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || undefined,
        code: form.code.trim() || undefined,
        departmentId: form.departmentId || undefined,
      };
      if (editing) {
        const res = await fetch(api(`/api/locations/${editing._id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Update failed');
      } else {
        const res = await fetch(api('/api/locations'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Create failed');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', type: 'room', parentId: '', code: '', departmentId: '' });
      setError('');
      fetchLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location? Child locations must be removed first.')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(api(`/api/locations/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      fetchLocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      type: loc.type,
      parentId: loc.parentId ?? '',
      code: loc.code ?? '',
      departmentId: loc.departmentId?._id ?? '',
    });
    setShowForm(true);
    setError('');
  };

  const filtered = filterType ? locations.filter((l) => l.type === filterType) : locations;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedLocations = filtered.slice(startIdx, endIdx);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  if (loading) {
    return <LoadingSpinner message="Loading locations..." />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Locations</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Campus → building → floor → room. Link every asset to a physical place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm({ name: '', type: 'room', parentId: '', code: '', departmentId: '' });
            setShowForm(true);
            setError('');
          }}
          className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50`}
        >
          + Add location
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="Total locations" value={locations.length} accent="text-blue-300" />
          <SummaryCard label="Departments" value={departments.length} accent="text-violet-300" />
          <SummaryCard label="Buildings" value={typeCounts.building} accent="text-amber-300" />
          <SummaryCard label="Rooms" value={typeCounts.room} accent="text-emerald-300" />
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-4 mb-4 max-w-xl">
          <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-widest mb-3">
            {editing ? 'Edit location' : 'New location'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={inputClass}
                placeholder="e.g. Room 201"
              />
            </div>
            <div>
              <label className={labelClass}>Type *</label>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                      form.type === t
                        ? TYPE_BADGE[t]
                        : 'border-gray-700/60 bg-gray-800/40 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className={inputClass}
              >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Parent</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className={inputClass}
              >
                <option value="">None (top level)</option>
                {locations
                  .filter((l) => !editing || l._id !== editing._id)
                  .map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name} ({l.type})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={inputClass}
                placeholder="e.g. R-201"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={submitLoading}
                className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50`}
              >
                {submitLoading ? 'Saving…' : editing ? 'Save changes' : 'Add location'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-3">Departments</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="e.g. Computer Science"
            className={`${inputClass} flex-1 min-w-[200px]`}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
          />
          <button
            type="button"
            onClick={addDepartment}
            disabled={addingDept || !newDeptName.trim()}
            className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 disabled:opacity-50 shrink-0`}
          >
            {addingDept ? 'Adding…' : '+ Add department'}
          </button>
        </div>
        {departments.length === 0 ? (
          <p className="text-xs text-gray-500">No departments yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {departments.map((d) => (
              <span
                key={d._id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs text-violet-200 bg-violet-500/10 border-violet-500/25"
              >
                {d.name}
                <button
                  type="button"
                  onClick={() => deleteDepartment(d._id)}
                  disabled={deletingDept === d._id}
                  className="text-violet-400/60 hover:text-red-400 transition-colors leading-none disabled:opacity-40"
                  title="Delete department"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gray-800/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700/60 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest">All locations</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterType('')}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                filterType === ''
                  ? TYPE_FILTER_ACTIVE['']
                  : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:text-gray-200'
              }`}
            >
              All ({locations.length})
            </button>
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border capitalize transition-colors ${
                  filterType === t
                    ? TYPE_FILTER_ACTIVE[t]
                    : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:text-gray-200'
                }`}
              >
                {t} ({typeCounts[t]})
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-gray-300">No locations yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Add a campus, building, floor, or room to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/60 text-left">
                    <th className="px-3 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="px-3 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="px-3 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wide">Code</th>
                    <th className="px-3 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wide">Parent</th>
                    <th className="px-3 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLocations.map((loc) => (
                    <tr key={loc._id} className="border-t border-gray-700/40 hover:bg-gray-900/30 transition-colors">
                      <td className="px-3 py-2 text-xs font-medium text-gray-200">{loc.name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize ${
                            TYPE_BADGE[loc.type] || 'text-gray-300 bg-gray-500/15 border-gray-500/30'
                          }`}
                        >
                          {loc.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{loc.departmentId?.name ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400 font-mono">{loc.code ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{getParentName(loc.parentId)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(loc)}
                            className={`${buttonClass} border-blue-500/30 bg-blue-500/5 text-blue-300 hover:bg-blue-500/15`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(loc._id)}
                            className={`${buttonClass} border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/15`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-700/60">
                <p className="text-xs text-gray-500">
                  Showing {startIdx + 1}–{Math.min(endIdx, filtered.length)} of {filtered.length}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-40`}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[28px] px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
                        currentPage === page
                          ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                          : 'border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200 disabled:opacity-40`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
