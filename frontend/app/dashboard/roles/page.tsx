'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

// ── Role definitions with privileges ─────────────────────────────────────────
const ROLES = [
	{
		value: 'super_admin',
		label: 'Super Admin',
		badge: 'text-red-300 bg-red-500/15 border-red-500/30',
		accent: 'border-l-red-500/60',
		dot: 'bg-red-400',
		summary: 'Full access — users, roles, org settings, audit logs, all departments.',
		scope: 'Organisation-wide',
	},
	{
		value: 'admin',
		label: 'Admin',
		badge: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
		accent: 'border-l-amber-500/60',
		dot: 'bg-amber-400',
		summary: 'Manage assets, issues, locations, and reports across all departments. No user or org settings access.',
		scope: 'Organisation-wide',
	},
	{
		value: 'manager',
		label: 'Manager',
		badge: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
		accent: 'border-l-blue-500/60',
		dot: 'bg-blue-400',
		summary: 'View and manage assets and issues in their assigned department only.',
		scope: 'Department only',
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
	'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass =
	'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function SummaryCard({ label, value, accent = 'text-gray-100' }: { label: string; value: string | number; accent?: string }) {
	return (
		<div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
			<p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
			<p className={`text-sm font-semibold mt-0.5 ${accent}`}>{value}</p>
		</div>
	);
}

export default function RolesPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<User | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
	const [form, setForm] = useState({
		email: '',
		name: '',
		role: 'admin',
		password: '',
		departmentId: '',
	});
	const [submitLoading, setSubmitLoading] = useState(false);
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

	if (loading) return <LoadingSpinner message="Loading users..." />;

	const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
	const adminCount = users.filter((u) => u.role === 'admin').length;
	const managerCount = users.filter((u) => u.role === 'manager').length;

	return (
		<div className="max-w-7xl mx-auto">
			<div className="mb-6 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-gray-100">Users & Roles</h1>
					<p className="text-gray-400 mt-1 text-sm">
						{isSuperAdmin
							? 'Create users, assign roles, and control access across your organization.'
							: 'Contact your super admin to manage users and roles.'}
					</p>
				</div>
				{isSuperAdmin && (
					<button
						type="button"
						onClick={() => {
							setEditing(null);
							setForm({ email: '', name: '', role: 'admin', password: '', departmentId: '' });
							setShowForm(true);
							setError('');
						}}
						className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50`}
					>
						+ Add user
					</button>
				)}
			</div>

			{error && (
				<div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
					{error}
				</div>
			)}

			<div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
				<p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<SummaryCard label="Total users" value={users.length} accent="text-blue-300" />
					<SummaryCard label="Super admins" value={superAdminCount} accent="text-red-300" />
					<SummaryCard label="Admins" value={adminCount} accent="text-amber-300" />
					<SummaryCard label="Managers" value={managerCount} accent="text-violet-300" />
				</div>
			</div>

			{showForm && isSuperAdmin && (
				<div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-4 mb-4 max-w-xl">
					<p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-widest mb-3">
						{editing ? 'Edit user' : 'New user'}
					</p>
					<form onSubmit={handleSubmit} className="space-y-3">
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

						<div>
							<label className={labelClass}>Role *</label>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
								{ROLES.map((r) => (
									<button
										key={r.value}
										type="button"
										onClick={() => setForm({ ...form, role: r.value })}
										className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors text-left ${
											form.role === r.value
												? `${r.badge} ring-1 ring-current/30`
												: 'border-gray-700/60 bg-gray-800/40 text-gray-500 hover:text-gray-300'
										}`}
									>
										<div className={`w-1.5 h-1.5 rounded-full ${form.role === r.value ? r.dot : 'bg-gray-600'} shrink-0`} />
										{r.label}
									</button>
								))}
							</div>
						</div>

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
								<p className="text-[11px] text-gray-600 mt-1">
									Managers only see assets and issues in this department.
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
										className={`${inputClass} pr-12`}
									/>
									<button
										type="button"
										onClick={() => setShowFormPassword((v) => !v)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-gray-300 font-semibold transition-colors select-none"
									>
										{showFormPassword ? 'Hide' : 'Show'}
									</button>
								</div>
							</div>
						)}

						<div className="flex gap-2 pt-1">
							<button
								type="submit"
								disabled={submitLoading}
								className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 disabled:opacity-50`}
							>
								{submitLoading ? 'Saving…' : editing ? 'Save changes' : 'Add user'}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowForm(false);
									setEditing(null);
								}}
								className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200`}
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			<div className="rounded-xl border border-gray-700/60 overflow-hidden mb-4">
				<div className="px-4 py-3 border-b border-gray-700/60 bg-gray-900/40">
					<p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
						Users <span className="text-gray-600 font-normal">({users.length})</span>
					</p>
				</div>
				{users.length === 0 ? (
					<div className="rounded-b-xl border-t border-dashed border-violet-500/20 bg-violet-950/10 px-4 py-8 text-center">
						<p className="text-sm font-medium text-gray-300 mb-1">No users yet</p>
						<p className="text-xs text-gray-500">
							{isSuperAdmin ? 'Add your first user using the button above.' : 'Ask a super admin to add users.'}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-gray-900/80 border-b border-gray-700/60">
								<tr>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Name</th>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Email</th>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Role</th>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Department</th>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Scope</th>
									{isSuperAdmin && (
										<th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Actions</th>
									)}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-700/40">
								{users.map((u) => {
									const meta = getRoleMeta(u.role);
									return (
										<tr key={u._id} className="hover:bg-gray-800/40 transition-colors">
											<td className="px-3 py-2 text-xs font-medium text-gray-200">{u.name}</td>
											<td className="px-3 py-2">
												<p className="text-xs text-gray-400">{u.email}</p>
												{isSuperAdmin && storedPasswords[u._id] && (
													<div className="flex items-center gap-1.5 mt-1">
														<span className="text-[11px] text-gray-600 font-mono tracking-wider">
															{showPasswords[u._id] ? storedPasswords[u._id] : '••••••••'}
														</span>
														<button
															type="button"
															onClick={() => setShowPasswords((v) => ({ ...v, [u._id]: !v[u._id] }))}
															className="text-[10px] text-gray-600 hover:text-gray-400 font-semibold transition-colors select-none"
														>
															{showPasswords[u._id] ? 'Hide' : 'Show'}
														</button>
													</div>
												)}
											</td>
											<td className="px-3 py-2">
												<span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta?.badge ?? 'text-gray-300 bg-gray-500/15 border-gray-500/30'}`}>
													<div className={`w-1.5 h-1.5 rounded-full ${meta?.dot ?? 'bg-gray-500'}`} />
													{meta?.label ?? u.role}
												</span>
											</td>
											<td className="px-3 py-2 text-xs text-gray-500">{u.departmentId?.name ?? '—'}</td>
											<td className="px-3 py-2 text-xs text-gray-500 max-w-xs">{meta?.scope ?? '—'}</td>
											{isSuperAdmin && (
												<td className="px-3 py-2">
													<div className="flex items-center justify-center gap-1.5">
														<button
															type="button"
															onClick={() => openEdit(u)}
															className={`${buttonClass} border-gray-700/60 bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200`}
														>
															Edit
														</button>
														{deleteConfirm === u._id ? (
															<>
																<button
																	type="button"
																	onClick={() => handleDelete(u._id)}
																	className={`${buttonClass} border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20`}
																>
																	Confirm
																</button>
																<button
																	type="button"
																	onClick={() => setDeleteConfirm(null)}
																	className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-500 hover:text-gray-300`}
																>
																	Cancel
																</button>
															</>
														) : (
															<button
																type="button"
																onClick={() => setDeleteConfirm(u._id)}
																className={`${buttonClass} border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20`}
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

			<div className="rounded-xl border border-gray-700/40 bg-gray-800/30 px-4 py-4">
				<p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Role guide</p>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
					{ROLES.map((role) => (
						<div
							key={role.value}
							className={`rounded-lg border border-gray-700/40 bg-gray-900/30 border-l-2 ${role.accent} px-3 py-8`}
						>
							<div className="flex items-center justify-between gap-2 mb-1">
								<span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${role.badge}`}>
									{role.label}
								</span>
								<span className="text-[10px] text-gray-600 ">{role.scope}</span>
							</div>
							<p className="text-[11px] text-gray-500 leading-relaxed mt-4">{role.summary}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
