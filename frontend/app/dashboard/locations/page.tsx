'use client';

import { useState, useEffect } from 'react';

const TYPES = ['campus', 'building', 'floor', 'room'];

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

type Location = {
  _id: string;
  name: string;
  type: string;
  parentId?: string | null;
  path?: string;
  code?: string;
  departmentId?: { _id: string; name: string } | null;
};

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
    if (!token) { setLoading(false); setError('Not signed in'); return; }
    Promise.all([
      fetch(api('/api/locations'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(api('/api/departments'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([locData, deptData]) => {
        if (locData.locations) setLocations(locData.locations);
        else setError(locData.message || 'Failed to load');
        if (deptData.departments) setDepartments(deptData.departments);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLocations(); }, []);

  const getParentName = (parentId: string | null | undefined) => {
    if (!parentId) return '—';
    const p = locations.find((l) => l._id === parentId);
    return p ? p.name : parentId;
  };

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
    if (!token) { setSubmitLoading(false); return; }
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
      const res = await fetch(api(`/api/locations/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
  };

  const filtered = filterType ? locations.filter((l) => l.type === filterType) : locations;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedLocations = filtered.slice(startIdx, endIdx);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  if (loading) return (
    <div><h1 className="text-2xl font-bold mb-2">Locations</h1><p className="text-gray-400">Loading…</p></div>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Locations</h1>
      <p className="text-gray-400 mb-6">
        Campus → Building → Floor → Room. Set up once so every asset can be linked to a classroom or lab.
      </p>

      {error && <p className="mb-4 p-3 bg-red-900/20 text-red-400 rounded-lg text-sm">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => { setEditing(null); setForm({ name: '', type: 'room', parentId: '', code: '', departmentId: '' }); setShowForm(true); }}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover"
        >
          Add location
        </button>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6 max-w-md">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit location' : 'New location'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium text-gray-300">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                required className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100"
                placeholder="e.g. Room 201" />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-300">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-300">Department</label>
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100">
                <option value="">No department</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-300">Parent</label>
              <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100">
                <option value="">None (top level)</option>
                {locations.filter((l) => !editing || l._id !== editing._id).map((l) => (
                  <option key={l._id} value={l._id}>{l.name} ({l.type})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-300">Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-100"
                placeholder="e.g. R-201" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-60">
                {submitLoading ? 'Saving…' : editing ? 'Save' : 'Add'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 bg-slate-100 text-gray-700 rounded-lg font-medium hover:bg-slate-200">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Departments ── */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-300 mb-3">Departments</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="e.g. Computer Science"
            className="flex-1 px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-gray-100 text-sm focus:outline-none focus:border-gray-500"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
          />
          <button
            type="button"
            onClick={addDepartment}
            disabled={addingDept || !newDeptName.trim()}
            className="px-4 py-2 bg-gray-700 text-gray-100 rounded-lg text-sm font-medium hover:bg-gray-600 disabled:opacity-40 shrink-0"
          >
            {addingDept ? '…' : '+ Add'}
          </button>
        </div>
        {departments.length === 0 ? (
          <p className="text-sm text-gray-600">No departments yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <span key={d._id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-900/60 border border-gray-700 rounded-full text-sm text-gray-300">
                {d.name}
                <button
                  type="button"
                  onClick={() => deleteDepartment(d._id)}
                  disabled={deletingDept === d._id}
                  className="text-gray-600 hover:text-red-400 transition-colors leading-none disabled:opacity-40"
                  title="Delete department"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No locations yet. Add a campus, building, floor, or room to get started.
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-950 text-left">
                  <th className="p-3 font-medium text-gray-300">Name</th>
                  <th className="p-3 font-medium text-gray-300">Type</th>
                  <th className="p-3 font-medium text-gray-300">Department</th>
                  <th className="p-3 font-medium text-gray-300">Code</th>
                  <th className="p-3 font-medium text-gray-300">Parent</th>
                  <th className="p-3 font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLocations.map((loc) => (
                  <tr key={loc._id} className="border-t border-gray-700 hover:bg-gray-900/40">
                    <td className="p-3 font-medium text-gray-100">{loc.name}</td>
                    <td className="p-3 text-gray-400 capitalize">{loc.type}</td>
                    <td className="p-3 text-gray-400">{loc.departmentId?.name ?? '—'}</td>
                    <td className="p-3 text-gray-400">{loc.code ?? '—'}</td>
                    <td className="p-3 text-gray-400">{getParentName(loc.parentId)}</td>
                    <td className="p-3">
                      <button type="button" onClick={() => openEdit(loc)}
                        className="text-primary hover:underline mr-3">Edit</button>
                      <button type="button" onClick={() => handleDelete(loc._id)}
                        className="text-red-400 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700 bg-gray-900/50">
                <div className="text-sm text-gray-400">
                  Showing {startIdx + 1}–{Math.min(endIdx, filtered.length)} of {filtered.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-2.5 py-1 text-sm rounded transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-white font-medium'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
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
