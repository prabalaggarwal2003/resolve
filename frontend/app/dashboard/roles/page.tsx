'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'principal', label: 'Principal' },
  { value: 'hod', label: 'HOD' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'lab_technician', label: 'Lab Technician / Assistant' },
  { value: 'admin', label: 'Admin (legacy)' },
  { value: 'manager', label: 'Manager (legacy)' },
  { value: 'reporter', label: 'Reporter (legacy)' },
];

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
  departmentId?: { _id: string; name: string };
  assignedLocationIds?: { _id: string; name: string; type: string }[];
};

export default function RolesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ _id: string; name: string; type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'teacher',
    password: '',
    departmentId: '' as string,
    assignedLocationIds: [] as string[],
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [addingDept, setAddingDept] = useState(false);

  const fetchData = () => {
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not signed in');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(api('/api/users'), { headers }).then((r) => r.json()),
      fetch(api('/api/departments'), { headers }).then((r) => r.json()),
      fetch(api('/api/locations'), { headers }).then((r) => r.json()),
    ])
      .then(([usersRes, deptRes, locRes]) => {
        if (usersRes.users) setUsers(usersRes.users);
        else setError(usersRes.message || 'Failed to load users');
        if (deptRes.departments) setDepartments(deptRes.departments);
        if (locRes.locations) setLocations(locRes.locations);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    const token = localStorage.getItem('token');
    if (!token) {
      setSubmitLoading(false);
      return;
    }
    try {
      if (editing) {
        const res = await fetch(api(`/api/users/${editing._id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name.trim(),
            role: form.role,
            departmentId: form.departmentId || undefined,
            assignedLocationIds: form.assignedLocationIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Update failed');
      } else {
        if (!form.password || form.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        const res = await fetch(api('/api/users'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: form.email.trim().toLowerCase(),
            name: form.name.trim(),
            role: form.role,
            password: form.password,
            departmentId: form.departmentId || undefined,
            assignedLocationIds: form.assignedLocationIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Create failed');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ email: '', name: '', role: 'teacher', password: '', departmentId: '', assignedLocationIds: [] });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const addDepartment = async () => {
    const name = newDeptName.trim();
    if (!name) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setAddingDept(true);
    setError('');
    try {
      const res = await fetch(api('/api/departments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add department');
      setNewDeptName('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add department');
    } finally {
      setAddingDept(false);
    }
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      email: user.email,
      name: user.name,
      role: user.role,
      password: '',
      departmentId: user.departmentId?._id ?? '',
      assignedLocationIds: user.assignedLocationIds?.map((l) => l._id) ?? [],
    });
    setShowForm(true);
  };

  const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

  let canManageUsers = false;
  if (typeof window !== 'undefined') {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      canManageUsers = u.role === 'super_admin' || u.role === 'admin';
    } catch (_) {}
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Users & Roles</h1>
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Users & Roles</h1>
      <p className="text-slate-600 mb-6">
        Add users by school/college email and assign roles: Principal (view all), HOD (department), Teachers & Students (report only), Lab technicians (their labs).
      </p>

      {error && (
        <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>
      )}

      {canManageUsers && (
        <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 max-w-md">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Add department</h2>
          <p className="text-xs text-slate-500 mb-2">Create departments here; use them when adding users (HOD) and assets.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              placeholder="e.g. Computer Science"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
            />
            <button
              type="button"
              onClick={addDepartment}
              disabled={addingDept || !newDeptName.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium text-sm disabled:opacity-60"
            >
              {addingDept ? 'Adding…' : 'Add'}
            </button>
          </div>
          {departments.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">Existing: {departments.map((d) => d.name).join(', ')}</p>
          )}
        </div>
      )}

      {canManageUsers && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({ email: '', name: '', role: 'teacher', password: '', departmentId: '', assignedLocationIds: [] });
              setShowForm(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover"
          >
            Add user
          </button>
        </div>
      )}

      {showForm && canManageUsers && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 mb-6 max-w-lg">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit user' : 'New user'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <div>
                <label className="block mb-1 font-medium text-slate-700">Email (school/college) *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="name@school.edu"
                />
              </div>
            )}
            <div>
              <label className="block mb-1 font-medium text-slate-700">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-slate-700">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {!editing && (
              <div>
                <label className="block mb-1 font-medium text-slate-700">Temporary password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing}
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Min 6 characters"
                />
                <p className="text-xs text-slate-500 mt-1">User can change after first login</p>
              </div>
            )}
            {(form.role === 'hod' || form.role === 'lab_technician') && (
              <>
                {form.role === 'hod' && (
                  <div>
                    <label className="block mb-1 font-medium text-slate-700">Department (for HOD)</label>
                    <select
                      value={form.departmentId}
                      onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="">None</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {form.role === 'lab_technician' && (
                  <div>
                    <label className="block mb-1 font-medium text-slate-700">Assigned labs (locations)</label>
                    <select
                      multiple
                      value={form.assignedLocationIds}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions || [], (o) => (o as HTMLOptionElement).value);
                        setForm((f) => ({ ...f, assignedLocationIds: selected }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-[80px]"
                    >
                      {locations.map((l) => (
                        <option key={l._id} value={l._id}>{l.name} ({l.type})</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium disabled:opacity-60"
              >
                {submitLoading ? 'Saving…' : editing ? 'Save' : 'Add user'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center text-slate-600">No users yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="p-3 font-medium text-slate-700">Name</th>
                <th className="p-3 font-medium text-slate-700">Email</th>
                <th className="p-3 font-medium text-slate-700">Role</th>
                <th className="p-3 font-medium text-slate-700">Department / Labs</th>
                <th className="p-3 font-medium text-slate-700">Actions</th>
                <th className="p-3 font-medium text-slate-700"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t border-slate-200">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-slate-600">{u.email}</td>
                  <td className="p-3">{roleLabel(u.role)}</td>
                  <td className="p-3 text-slate-600">
                    {u.departmentId?.name}
                    {u.assignedLocationIds?.length ? ` · ${u.assignedLocationIds.map((l) => l.name).join(', ')}` : ''}
                  </td>
                  <td className="p-3">
                    {canManageUsers && (
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-primary hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/dashboard/assets?assignedTo=${u._id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View assets
                    </Link>
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
