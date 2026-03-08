'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ── Role definitions with privileges ─────────────────────────────────────────
const ROLES = [
	{
		value: 'super_admin',
		label: 'Super Admin',
		color: 'text-red-400 bg-red-900/30 border-red-800/50',
		dot: 'bg-red-400',
		privileges: [
			{ label: 'Full dashboard access', granted: true },
			{ label: 'Create / edit / delete users', granted: true },
			{ label: 'Assign roles to users', granted: true },
			{ label: 'Assign assets to users', granted: true },
			{ label: 'Manage all assets (all departments)', granted: true },
			{ label: 'Manage issues', granted: true },
			{ label: 'Manage locations & departments', granted: true },
			{ label: 'View audit logs & reports', granted: true },
			{ label: 'Edit organisation settings', granted: true },
		],
		scope: 'All assets & data within the organisation',
	},
	{
		value: 'admin',
		label: 'Admin',
		color: 'text-amber-400 bg-amber-900/30 border-amber-800/50',
		dot: 'bg-amber-400',
		privileges: [
			{ label: 'Full dashboard access', granted: true },
			{ label: 'Create / edit / delete users', granted: false },
			{ label: 'Assign roles to users', granted: false },
			{ label: 'Assign assets to users', granted: false },
			{ label: 'Manage all assets (all departments)', granted: true },
			{ label: 'Manage issues', granted: true },
			{ label: 'Manage locations & departments', granted: true },
			{ label: 'View audit logs & reports', granted: true },
			{ label: 'Edit organisation settings', granted: false },
		],
		scope: 'All assets & data within the organisation',
	},
	{
		value: 'manager',
		label: 'Manager',
		color: 'text-blue-400 bg-blue-900/30 border-blue-800/50',
		dot: 'bg-blue-400',
		privileges: [
			{ label: 'Full dashboard access', granted: true },
			{ label: 'Create / edit / delete users', granted: false },
			{ label: 'Assign roles to users', granted: false },
			{ label: 'Assign assets to users', granted: false },
			{ label: 'Manage all assets (all departments)', granted: false },
			{ label: 'Manage assets in own department only', granted: true },
			{ label: 'Manage issues in own department only', granted: true },
			{ label: 'View locations', granted: true },
			{ label: 'View audit logs & reports', granted: false },
		],
		scope: 'Only assets & issues in their assigned department',
	},
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
};

const inputClass =
	'w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent transition-all text-sm';
const labelClass =
	'block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2';

export default function RolesPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<User | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [selectedRole, setSelectedRole] = useState<string | null>(null);
	const [form, setForm] = useState({
		email: '',
		name: '',
		role: 'admin',
		password: '',
		departmentId: '',
	});
	const [submitLoading, setSubmitLoading] = useState(false);
	const [newDeptName, setNewDeptName] = useState('');
	const [addingDept, setAddingDept] = useState(false);
	const [currentUser, setCurrentUser] = useState<{ role?: string } | null>(null);
	const [storedPasswords, setStoredPasswords] = useState<Record<string, string>>({});
	const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
	const [showFormPassword, setShowFormPassword] = useState(false);

	useEffect(() => {
		try {
			const u = JSON.parse(localStorage.getItem('user') || '{}');
			setCurrentUser(u);
		} catch (_) {}
		// Load stored passwords from localStorage
		try {
			const saved = JSON.parse(localStorage.getItem('userPasswords') || '{}');
			setStoredPasswords(saved);
		} catch (_) {}
		fetchData();
	}, []);

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
		])
			.then(([usersData, depsData]) => {
				if (usersData.users) setUsers(usersData.users);
				if (depsData.departments) setDepartments(depsData.departments);
			})
			.catch(() => setError('Failed to load data'))
			.finally(() => setLoading(false));
	};

	const isSuperAdmin = currentUser?.role === 'super_admin';

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
					}),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.message || 'Update failed');
			} else {
				if (!form.password || form.password.length < 6) throw new Error('Password must be at least 6 characters');
				const res = await fetch(api('/api/users'), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({
						email: form.email.trim().toLowerCase(),
						name: form.name.trim(),
						role: form.role,
						password: form.password,
						departmentId: form.departmentId || undefined,
					}),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.message || 'Create failed');
				// Store plain password locally (super_admin only, never sent back from server)
				if (data._id) {
					const updated = { ...storedPasswords, [data._id]: form.password };
					setStoredPasswords(updated);
					localStorage.setItem('userPasswords', JSON.stringify(updated));
				}
			}
			setShowForm(false);
			setEditing(null);
			setForm({ email: '', name: '', role: 'admin', password: '', departmentId: '' });
			fetchData();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Request failed');
		} finally {
			setSubmitLoading(false);
		}
	};

	const handleDelete = async (id: string) => {
		const token = localStorage.getItem('token');
		if (!token) return;
		try {
			const res = await fetch(api(`/api/users/${id}`), {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Delete failed');
			// Remove stored password
			const updated = { ...storedPasswords };
			delete updated[id];
			setStoredPasswords(updated);
			localStorage.setItem('userPasswords', JSON.stringify(updated));
			setDeleteConfirm(null);
			fetchData();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Delete failed');
		}
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
		});
		setShowForm(true);
		setError('');
	};

	const getRoleMeta = (value: string) => ROLES.find((r) => r.value === value);

	if (loading)
		return (
			<div>
				<h1 className="text-2xl font-bold mb-2">Users & Roles</h1>
				<p className="text-gray-400">Loading…</p>
			</div>
		);

	return (
		<div style={{ fontFamily: 'var(--font-manrope, Manrope, sans-serif)' }}>
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-gray-100 mb-1">Users & Roles</h1>
				<p className="text-gray-500 text-sm">
					{isSuperAdmin
						? 'As Super Admin, you are the only one who can create, edit and delete users.'
						: 'Contact your Super Admin to manage users and roles.'}
				</p>
			</div>

			{error && (
				<div className="mb-4 p-3 bg-red-900/20 border border-red-800/60 text-red-400 rounded-xl text-sm">
					{error}
				</div>
			)}

			{/* ── Role reference cards ── */}
			<div className="mb-8">
				<p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">
					Role Privileges
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
					{ROLES.map((role) => (
						<button
							key={role.value}
							type="button"
							onClick={() => setSelectedRole(selectedRole === role.value ? null : role.value)}
							className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${role.color} ${
								selectedRole === role.value ? 'ring-2 ring-gray-500' : 'hover:brightness-110'
							}`}
						>
							<div className="flex items-center gap-2 mb-2">
								<div className={`w-2 h-2 rounded-full ${role.dot} shrink-0`} />
								<span className="font-bold text-sm">{role.label}</span>
							</div>
							<p className="text-xs opacity-70 mb-3 leading-relaxed">{role.scope}</p>
							{selectedRole === role.value && (
								<ul className="space-y-1.5 mt-3 border-t border-current/20 pt-3">
									{role.privileges.map((p) => (
										<li key={p.label} className="flex items-start gap-2 text-xs">
											<span
												className={`mt-0.5 shrink-0 font-bold ${
													p.granted ? 'text-green-400' : 'text-gray-600'
												}`}
											>
												{p.granted ? '✓' : '✗'}
											</span>
											<span className={p.granted ? 'opacity-90' : 'opacity-40'}>
												{p.label}
											</span>
										</li>
									))}
								</ul>
							)}
							{selectedRole !== role.value && (
								<p className="text-xs opacity-50">Click to see privileges →</p>
							)}
						</button>
					))}
				</div>
			</div>

			{/* ── Department + Add user ── */}
			{isSuperAdmin && (
				<div className="flex flex-wrap gap-4 mb-6">
					{/* Add department */}
					<div className="flex-1 min-w-[240px] rounded-2xl border border-gray-700/60 bg-gray-900/40 p-4">
						<p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
							Add Department
						</p>
						<div className="flex gap-2">
							<input
								type="text"
								value={newDeptName}
								onChange={(e) => setNewDeptName(e.target.value)}
								placeholder="e.g. Computer Science"
								className={inputClass}
								onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
							/>
							<button
								type="button"
								onClick={addDepartment}
								disabled={addingDept || !newDeptName.trim()}
								className="px-4 py-2 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white disabled:opacity-40 shrink-0"
							>
								{addingDept ? '…' : 'Add'}
							</button>
						</div>
						{departments.length > 0 && (
							<p className="text-xs text-gray-600 mt-2">
								{departments.map((d) => d.name).join(' · ')}
							</p>
						)}
					</div>

					{/* Add user button */}
					<div className="flex items-end">
						<button
							type="button"
							onClick={() => {
								setEditing(null);
								setForm({ email: '', name: '', role: 'admin', password: '', departmentId: '' });
								setShowForm(true);
								setError('');
							}}
							className="px-6 py-3 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all"
						>
							+ Add user
						</button>
					</div>
				</div>
			)}

			{/* ── Add / Edit form ── */}
			{showForm && isSuperAdmin && (
				<div className="rounded-2xl border border-gray-700/60 bg-gray-900/40 backdrop-blur-sm p-6 mb-6 max-w-lg">
					<h2 className="text-lg font-bold text-gray-100 mb-5">
						{editing ? 'Edit user' : 'New user'}
					</h2>
					<form onSubmit={handleSubmit} className="space-y-4">
						{!editing && (
							<div>
								<label className={labelClass}>Email *</label>
								<input
									type="email"
									value={form.email}
									onChange={(e) => setForm({ ...form, email: e.target.value })}
									required
									placeholder="user@org.com"
									className={inputClass}
								/>
							</div>
						)}
						<div>
							<label className={labelClass}>Name *</label>
							<input
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								required
								placeholder="Full name"
								className={inputClass}
							/>
						</div>

						{/* Role selector with inline badge */}
						<div>
							<label className={labelClass}>Role *</label>
							<div className="grid grid-cols-2 gap-2">
								{ROLES.map((r) => (
									<button
										key={r.value}
										type="button"
										onClick={() => setForm({ ...form, role: r.value })}
										className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left
                      ${form.role === r.value ? `${r.color} ring-1 ring-current` : 'border-gray-700/60 bg-gray-800/40 text-gray-500 hover:text-gray-300'}`}
									>
										<div className={`w-2 h-2 rounded-full ${form.role === r.value ? r.dot : 'bg-gray-600'} shrink-0`} />
										{r.label}
									</button>
								))}
							</div>
						</div>

						{/* Department — shown for manager */}
						{form.role === 'manager' && (
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
								<p className="text-xs text-gray-600 mt-1">
									Manager will only see assets & issues in this department.
								</p>
							</div>
						)}

						{!editing && (
							<div>
								<label className={labelClass}>Temporary password *</label>
								<div className="relative">
									<input
										type={showFormPassword ? 'text' : 'password'}
										value={form.password}
										onChange={(e) => setForm({ ...form, password: e.target.value })}
										required
										minLength={6}
										placeholder="Min 6 characters"
										className={inputClass + ' pr-12'}
									/>
									<button
										type="button"
										onClick={() => setShowFormPassword(v => !v)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs font-semibold select-none"
									>
										{showFormPassword ? 'HIDE' : 'SHOW'}
									</button>
								</div>
								<p className="text-xs text-gray-600 mt-1">
									User can change this after first login.
								</p>
							</div>
						)}

						<div className="flex gap-2 pt-1">
							<button
								type="submit"
								disabled={submitLoading}
								className="px-6 py-3 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white disabled:opacity-50"
							>
								{submitLoading ? 'Saving…' : editing ? 'Save changes' : 'Add user'}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowForm(false);
									setEditing(null);
								}}
								className="px-4 py-3 rounded-xl border border-gray-700/60 text-gray-400 hover:text-gray-200 text-sm font-medium transition-all"
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			{/* ── Users table ── */}
			<div className="rounded-2xl border border-gray-700/60 bg-gray-900/40 overflow-hidden">
				<div className="px-5 py-4 border-b border-gray-800/60 flex items-center justify-between">
					<p className="text-sm font-semibold text-gray-300">
						Users{' '}
						<span className="text-gray-600 font-normal">({users.length})</span>
					</p>
				</div>
				{users.length === 0 ? (
					<div className="p-12 text-center text-gray-600">
						No users yet. Add your first user above.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gray-800/60">
									<th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-widest">
										Name
									</th>
									<th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-widest">
										Email
									</th>
									<th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-widest">
										Role
									</th>
									<th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-widest">
										Department
									</th>
									<th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-widest">
										Scope
									</th>
									{isSuperAdmin && (
										<th className="px-5 py-3 text-xs font-semibold text-gray-600 uppercase tracking-widest">
											Actions
										</th>
									)}
								</tr>
							</thead>
							<tbody>
								{users.map((u) => {
									const meta = getRoleMeta(u.role);
									return (
										<tr
											key={u._id}
											className="border-t border-gray-800/40 hover:bg-gray-800/20 transition-colors"
										>
											<td className="px-5 py-3 font-medium text-gray-200">
												{u.name}
											</td>
											<td className="px-5 py-3">
												<p className="text-gray-500 text-sm">{u.email}</p>
												{isSuperAdmin && storedPasswords[u._id] && (
													<div className="flex items-center gap-1.5 mt-1">
														<span className="text-xs text-gray-600 font-mono tracking-wider">
															{showPasswords[u._id] ? storedPasswords[u._id] : '••••••••'}
														</span>
														<button
															type="button"
															onClick={() => setShowPasswords(v => ({ ...v, [u._id]: !v[u._id] }))}
															className="text-[10px] text-gray-700 hover:text-gray-400 font-semibold transition-colors select-none"
														>
															{showPasswords[u._id] ? 'HIDE' : 'SHOW'}
														</button>
													</div>
												)}
											</td>
											<td className="px-5 py-3">
												<span
													className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
														meta?.color ?? 'bg-gray-800 text-gray-400 border-gray-700'
													}`}
												>
													<div
														className={`w-1.5 h-1.5 rounded-full ${
															meta?.dot ?? 'bg-gray-500'
														}`}
													/>
													{meta?.label ?? u.role}
												</span>
											</td>
											<td className="px-5 py-3 text-gray-500 text-xs">
												{u.departmentId?.name ?? '—'}
											</td>
											<td className="px-5 py-3 text-gray-600 text-xs max-w-[180px] truncate">
												{meta?.scope ?? '—'}
											</td>
											{isSuperAdmin && (
												<td className="px-5 py-3">
													<div className="flex items-center gap-2">
														<button
															type="button"
															onClick={() => openEdit(u)}
															className="text-xs text-gray-400 hover:text-gray-100 transition-colors font-medium"
														>
															Edit
														</button>
														<Link
															href={`/dashboard/assets?assignedTo=${u._id}`}
															className="text-xs text-gray-400 hover:text-gray-100 transition-colors font-medium no-underline"
														>
															Assets
														</Link>
														{deleteConfirm === u._id ? (
															<div className="flex items-center gap-1">
																<button
																	type="button"
																	onClick={() => handleDelete(u._id)}
																	className="text-xs text-red-400 hover:text-red-300 font-bold"
																>
																	Confirm
																</button>
																<button
																	type="button"
																	onClick={() => setDeleteConfirm(null)}
																	className="text-xs text-gray-600 hover:text-gray-300"
																>
																	Cancel
																</button>
															</div>
														) : (
															<button
																type="button"
																onClick={() => setDeleteConfirm(u._id)}
																className="text-xs text-gray-600 hover:text-red-400 transition-colors"
															>
																Delete
															</button>
														)}
													</div>
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
