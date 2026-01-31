'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState({ name: '', type: 'room', parentId: '' as string, code: '' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [filterType, setFilterType] = useState('');

  const fetchLocations = () => {
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    fetch(api('/api/locations'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.locations) setLocations(d.locations);
        else setError(d.message || 'Failed to load');
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
      setForm({ name: '', type: 'room', parentId: '', code: '' });
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
    });
    setShowForm(true);
  };

  const filtered = filterType ? locations.filter((l) => l.type === filterType) : locations;

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Locations</h1>
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Locations</h1>
      <p className="text-slate-600 mb-6">
        Campus → Building → Floor → Room. Set up once so every asset can be linked to a classroom or lab.
      </p>

      {error && (
        <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm({ name: '', type: 'room', parentId: '', code: '' });
            setShowForm(true);
          }}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover"
        >
          Add location
        </button>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 mb-6 max-w-md">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit location' : 'New location'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium text-slate-700">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="e.g. Room 201"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-slate-700">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium text-slate-700">Parent</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
              <label className="block mb-1 font-medium text-slate-700">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="e.g. R-201"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-60"
              >
                {submitLoading ? 'Saving…' : editing ? 'Save' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-600">
            No locations yet. Add a campus, building, floor, or room to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="p-3 font-medium text-slate-700">Name</th>
                <th className="p-3 font-medium text-slate-700">Type</th>
                <th className="p-3 font-medium text-slate-700">Code</th>
                <th className="p-3 font-medium text-slate-700">Parent</th>
                <th className="p-3 font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((loc) => (
                <tr key={loc._id} className="border-t border-slate-200">
                  <td className="p-3 font-medium">{loc.name}</td>
                  <td className="p-3 text-slate-600">{loc.type}</td>
                  <td className="p-3 text-slate-600">{loc.code ?? '—'}</td>
                  <td className="p-3 text-slate-600">{getParentName(loc.parentId)}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => openEdit(loc)}
                      className="text-primary hover:underline mr-2"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(loc._id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
