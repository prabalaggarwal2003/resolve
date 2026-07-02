'use client';

import { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
	PERMISSION_TABS,
	TAB_MODES,
	emptyPermissions,
	canManageUsers,
	canRead,
	type PermissionLevel,
	type PermissionsMap,
	type PermissionTabMode,
} from '@/lib/permissions';

function api(path: string) {
	const base = process.env.NEXT_PUBLIC_API_URL || '';
	return base ? `${base}${path}` : path;
}

type OrgRole = {
	_id: string;
	name: string;
	description?: string;
	permissions: PermissionsMap;
};

type User = {
	_id: string;
	name: string;
	email: string;
	role: string;
	customRoleId?: { _id: string; name: string } | string | null;
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

function PermissionMatrix({
	value,
	onChange,
	disabled = false,
}: {
	value: PermissionsMap;
	onChange: (next: PermissionsMap) => void;
	disabled?: boolean;
}) {
	const sections = useMemo(() => {
		const map = new Map<string, (typeof PERMISSION_TABS)[number][]>();
		for (const tab of PERMISSION_TABS) {
			if (!map.has(tab.section)) map.set(tab.section, []);
			map.get(tab.section)!.push(tab);
		}
		return Array.from(map.entries());
	}, []);

	const setAccess = (key: string, enabled: boolean) => {
		const next = { ...value };
		const mode = TAB_MODES[key as keyof typeof TAB_MODES] as PermissionTabMode;
		if (!enabled) {
			next[key] = null;
		} else if (mode === 'readOnly' || mode === 'visibleOnly' || mode === 'empty') {
			next[key] = 'read';
		} else {
			next[key] = next[key] === 'write' ? 'write' : 'read';
		}
		onChange(next);
	};

	const setLevel = (key: string, level: PermissionLevel) => {
		const mode = TAB_MODES[key as keyof typeof TAB_MODES] as PermissionTabMode;
		if (mode === 'readOnly' || mode === 'visibleOnly' || mode === 'empty') return;
		const next = { ...value };
		next[key] = level;
		onChange(next);
	};

	const modeHint = (mode: PermissionTabMode) => {
		if (mode === 'empty') return 'Shows an empty welcome screen';
		if (mode === 'visibleOnly') return 'Visible in navigation only';
		if (mode === 'readOnly') return 'View subscription details only';
		return null;
	};

	return (
		<div className="space-y-4">
			{sections.map(([section, tabs]) => (
				<div key={section}>
					<p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{section}</p>
					<div className="space-y-2">
						{tabs.map((tab) => {
							const enabled = value[tab.key] === 'read' || value[tab.key] === 'write';
							const level = value[tab.key];
							const mode = tab.mode as PermissionTabMode;
							const hint = modeHint(mode);
							const showReadWrite = enabled && mode === 'readWrite';
							return (
								<div
									key={tab.key}
									className="rounded-lg border border-gray-700/50 bg-gray-900/30 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
								>
									<label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
										<input
											type="checkbox"
											checked={enabled}
											disabled={disabled}
											onChange={(e) => setAccess(tab.key, e.target.checked)}
											className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/40"
										/>
										<span>
											{tab.label}
											{hint && (
												<span className="block text-[10px] text-gray-500 font-normal">{hint}</span>
											)}
										</span>
									</label>
									{showReadWrite && (
										<div className="flex items-center gap-3 pl-6 sm:pl-0">
											<label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
												<input
													type="radio"
													name={`${tab.key}-level`}
													checked={level === 'read'}
													disabled={disabled}
													onChange={() => setLevel(tab.key, 'read')}
													className="border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/40"
												/>
												Read only
											</label>
											<label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
												<input
													type="radio"
													name={`${tab.key}-level`}
													checked={level === 'write'}
													disabled={disabled}
													onChange={() => setLevel(tab.key, 'write')}
													className="border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/40"
												/>
												Read & write
											</label>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

export default function RolesPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [roles, setRoles] = useState<OrgRole[]>([]);
	const [departments, setDepartments] = useState<{ _id: string; name: string }[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [showRoleForm, setShowRoleForm] = useState(false);
	const [showUserForm, setShowUserForm] = useState(false);
	const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [deleteRoleConfirm, setDeleteRoleConfirm] = useState<string | null>(null);
	const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
	const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: emptyPermissions() });
	const [userForm, setUserForm] = useState({
		email: '',
		name: '',
		password: '',
		customRoleId: '',
		departmentId: '',
	});
	const [submitLoading, setSubmitLoading] = useState(false);
	const [storedPasswords, setStoredPasswords] = useState<Record<string, string>>({});
	const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
	const [showFormPassword, setShowFormPassword] = useState(false);

	const canEditRoles = canManageUsers();

	useEffect(() => {
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
			fetch(api('/api/org-roles'), { headers }).then((r) => r.json()),
			fetch(api('/api/departments'), { headers }).then((r) => r.json()),
		])
			.then(([usersData, rolesData, depsData]) => {
				if (usersData.users) setUsers(usersData.users);
				if (rolesData.roles) setRoles(rolesData.roles);
				if (depsData.departments) setDepartments(depsData.departments);
			})
			.catch(() => setError('Failed to load data'))
			.finally(() => setLoading(false));
	};

	const handleRoleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!canEditRoles) return;
		setSubmitLoading(true);
		setError('');
		const token = localStorage.getItem('token');
		if (!token) return;
		try {
			const body = {
				name: roleForm.name.trim(),
				description: roleForm.description.trim(),
				permissions: roleForm.permissions,
			};
			const url = editingRole ? api(`/api/org-roles/${editingRole._id}`) : api('/api/org-roles');
			const res = await fetch(url, {
				method: editingRole ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify(body),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Request failed');
			setShowRoleForm(false);
			setEditingRole(null);
			setRoleForm({ name: '', description: '', permissions: emptyPermissions() });
			fetchData();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Request failed');
		} finally {
			setSubmitLoading(false);
		}
	};

	const handleUserSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!canEditRoles) return;
		setSubmitLoading(true);
		setError('');
		const token = localStorage.getItem('token');
		if (!token) return;
		try {
			if (editingUser) {
				const res = await fetch(api(`/api/users/${editingUser._id}`), {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({
						name: userForm.name.trim(),
						customRoleId: userForm.customRoleId,
						departmentId: userForm.departmentId || undefined,
					}),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.message || 'Update failed');
			} else {
				if (!userForm.password || userForm.password.length < 6) {
					throw new Error('Password must be at least 6 characters');
				}
				if (!userForm.customRoleId) throw new Error('Select a role');
				const res = await fetch(api('/api/users'), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({
						email: userForm.email.trim().toLowerCase(),
						name: userForm.name.trim(),
						password: userForm.password,
						customRoleId: userForm.customRoleId,
						departmentId: userForm.departmentId || undefined,
					}),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.message || 'Create failed');
				if (data._id) {
					const updated = { ...storedPasswords, [data._id]: userForm.password };
					setStoredPasswords(updated);
					localStorage.setItem('userPasswords', JSON.stringify(updated));
				}
			}
			setShowUserForm(false);
			setEditingUser(null);
			setUserForm({ email: '', name: '', password: '', customRoleId: '', departmentId: '' });
			fetchData();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Request failed');
		} finally {
			setSubmitLoading(false);
		}
	};

	const handleDeleteRole = async (id: string) => {
		const token = localStorage.getItem('token');
		if (!token) return;
		try {
			const res = await fetch(api(`/api/org-roles/${id}`), {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Delete failed');
			setDeleteRoleConfirm(null);
			fetchData();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Delete failed');
		}
	};

	const handleDeleteUser = async (id: string) => {
		const token = localStorage.getItem('token');
		if (!token) return;
		try {
			const res = await fetch(api(`/api/users/${id}`), {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Delete failed');
			const updated = { ...storedPasswords };
			delete updated[id];
			setStoredPasswords(updated);
			localStorage.setItem('userPasswords', JSON.stringify(updated));
			setDeleteUserConfirm(null);
			fetchData();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Delete failed');
		}
	};

	const openEditRole = (role: OrgRole) => {
		setEditingRole(role);
		setRoleForm({
			name: role.name,
			description: role.description || '',
			permissions: { ...emptyPermissions(), ...role.permissions },
		});
		setShowRoleForm(true);
		setError('');
	};

	const openEditUser = (user: User) => {
		setEditingUser(user);
		const roleId =
			typeof user.customRoleId === 'object' && user.customRoleId
				? user.customRoleId._id
				: (user.customRoleId as string) || '';
		setUserForm({
			email: user.email,
			name: user.name,
			password: '',
			customRoleId: roleId,
			departmentId: user.departmentId?._id ?? '',
		});
		setShowUserForm(true);
		setError('');
	};

	const getUserRoleLabel = (user: User) => {
		if (user.role === 'super_admin') return 'Super Admin';
		if (typeof user.customRoleId === 'object' && user.customRoleId?.name) return user.customRoleId.name;
		if (user.role === 'admin') return 'Admin (legacy)';
		if (user.role === 'manager') return 'Manager (legacy)';
		return user.role;
	};

	const countRoleTabs = (perms: PermissionsMap) =>
		Object.values(perms).filter((v) => v === 'read' || v === 'write').length;

	if (loading) return <LoadingSpinner message="Loading users & roles..." />;

	if (!canRead('roles')) {
		return (
			<div className="max-w-7xl mx-auto">
				<p className="text-red-400 text-sm">You do not have permission to view users and roles.</p>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto">
			<div className="mb-6 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold text-gray-100">Users & Roles</h1>
					<p className="text-gray-400 mt-1 text-sm">
						{canEditRoles
							? 'Create custom roles with tab access and read/write permissions, then assign users.'
							: 'View roles, permissions, and users in your organization.'}
					</p>
				</div>
				{canEditRoles && (
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => {
								setEditingRole(null);
								setRoleForm({ name: '', description: '', permissions: emptyPermissions() });
								setShowRoleForm(true);
								setError('');
							}}
							className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20`}
						>
							+ Create role
						</button>
						<button
							type="button"
							onClick={() => {
								setEditingUser(null);
								setUserForm({ email: '', name: '', password: '', customRoleId: roles[0]?._id || '', departmentId: '' });
								setShowUserForm(true);
								setError('');
							}}
							disabled={roles.length === 0}
							className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50`}
						>
							+ Add user
						</button>
					</div>
				)}
			</div>

			{error && (
				<div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
			)}

			<div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
				<p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
					<SummaryCard label="Custom roles" value={roles.length} accent="text-violet-300" />
					<SummaryCard label="Total users" value={users.length} accent="text-blue-300" />
					<SummaryCard
						label="Super admins"
						value={users.filter((u) => u.role === 'super_admin').length}
						accent="text-red-300"
					/>
				</div>
			</div>

			{showRoleForm && canEditRoles && (
				<div className="rounded-xl border border-gray-700/60 border-l-2 border-l-violet-500/50 bg-gray-800/40 px-4 py-4 mb-4">
					<p className="text-xs font-semibold text-violet-400/80 uppercase tracking-widest mb-3">
						{editingRole ? 'Edit role' : 'New custom role'}
					</p>
					<form onSubmit={handleRoleSubmit} className="space-y-4">
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
							<div>
								<label className={labelClass}>Role name *</label>
								<input
									value={roleForm.name}
									onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
									required
									placeholder="e.g. Lab Technician, Store Manager"
									className={inputClass}
								/>
							</div>
							<div>
								<label className={labelClass}>Description</label>
								<input
									value={roleForm.description}
									onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
									placeholder="Optional short description"
									className={inputClass}
								/>
							</div>
						</div>
						<div>
							<p className={labelClass}>Tab access & permissions</p>
							<p className="text-[11px] text-gray-600 mb-3">
								Check each tab this role can see. Choose read-only or read & write for each enabled tab.
							</p>
							<PermissionMatrix
								value={roleForm.permissions}
								onChange={(permissions) => setRoleForm({ ...roleForm, permissions })}
							/>
						</div>
						<div className="flex gap-2">
							<button
								type="submit"
								disabled={submitLoading}
								className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 disabled:opacity-50`}
							>
								{submitLoading ? 'Saving…' : editingRole ? 'Save role' : 'Create role'}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowRoleForm(false);
									setEditingRole(null);
								}}
								className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			{showUserForm && canEditRoles && (
				<div className="rounded-xl border border-gray-700/60 border-l-2 border-l-emerald-500/50 bg-gray-800/40 px-4 py-4 mb-4 max-w-xl">
					<p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-widest mb-3">
						{editingUser ? 'Edit user' : 'New user'}
					</p>
					<form onSubmit={handleUserSubmit} className="space-y-3">
						{!editingUser && (
							<div>
								<label className={labelClass}>Email *</label>
								<input
									type="email"
									value={userForm.email}
									onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
									required
									className={inputClass}
								/>
							</div>
						)}
						<div>
							<label className={labelClass}>Name *</label>
							<input
								value={userForm.name}
								onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
								required
								className={inputClass}
							/>
						</div>
						{editingUser?.role !== 'super_admin' && (
							<div>
								<label className={labelClass}>Role *</label>
								<select
									value={userForm.customRoleId}
									onChange={(e) => setUserForm({ ...userForm, customRoleId: e.target.value })}
									required
									className={inputClass}
								>
									<option value="">Select a role</option>
									{roles.map((r) => (
										<option key={r._id} value={r._id}>
											{r.name}
										</option>
									))}
								</select>
							</div>
						)}
						<div>
							<label className={labelClass}>Department (optional)</label>
							<p className="text-[10px] text-gray-500 mb-1">
								Leave empty for all departments. Select one to limit assets and issues to that department.
							</p>
							<select
								value={userForm.departmentId}
								onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}
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
						{!editingUser && (
							<div>
								<label className={labelClass}>Temporary password *</label>
								<div className="relative">
									<input
										type={showFormPassword ? 'text' : 'password'}
										value={userForm.password}
										onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
										required
										minLength={6}
										className={`${inputClass} pr-12`}
									/>
									<button
										type="button"
										onClick={() => setShowFormPassword((v) => !v)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-gray-300 font-semibold"
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
								className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50`}
							>
								{submitLoading ? 'Saving…' : editingUser ? 'Save user' : 'Add user'}
							</button>
							<button
								type="button"
								onClick={() => {
									setShowUserForm(false);
									setEditingUser(null);
								}}
								className={`${buttonClass} border-gray-700/60 bg-gray-800/40 text-gray-400 hover:text-gray-200`}
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
						Custom roles <span className="text-gray-600 font-normal">({roles.length})</span>
					</p>
				</div>
				{roles.length === 0 ? (
					<div className="px-4 py-8 text-center text-sm text-gray-500">
						No custom roles yet. Create one to define tab access for your organization.
					</div>
				) : (
					<div className="divide-y divide-gray-700/40">
						{roles.map((role) => (
							<div key={role._id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<div>
									<p className="text-sm font-medium text-gray-200">{role.name}</p>
									{role.description && <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>}
									<p className="text-[11px] text-gray-600 mt-1">
										{countRoleTabs(role.permissions)} tab(s) enabled
									</p>
								</div>
								{canEditRoles && (
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => openEditRole(role)}
											className={`${buttonClass} border-gray-700/60 bg-gray-800/60 text-gray-400 hover:text-gray-200`}
										>
											Edit
										</button>
										{deleteRoleConfirm === role._id ? (
											<>
												<button
													type="button"
													onClick={() => handleDeleteRole(role._id)}
													className={`${buttonClass} border-red-500/40 bg-red-500/10 text-red-300`}
												>
													Confirm
												</button>
												<button
													type="button"
													onClick={() => setDeleteRoleConfirm(null)}
													className={`${buttonClass} border-gray-700/60 text-gray-500`}
												>
													Cancel
												</button>
											</>
										) : (
											<button
												type="button"
												onClick={() => setDeleteRoleConfirm(role._id)}
												className={`${buttonClass} border-red-500/40 bg-red-500/10 text-red-300`}
											>
												Delete
											</button>
										)}
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			<div className="rounded-xl border border-gray-700/60 overflow-hidden">
				<div className="px-4 py-3 border-b border-gray-700/60 bg-gray-900/40">
					<p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
						Users <span className="text-gray-600 font-normal">({users.length})</span>
					</p>
				</div>
				{users.length === 0 ? (
					<div className="px-4 py-8 text-center text-sm text-gray-500">No users yet.</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-gray-900/80 border-b border-gray-700/60">
								<tr>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Name</th>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Email</th>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Role</th>
									<th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide text-gray-500">Department</th>
									{canEditRoles && (
										<th className="px-3 py-2 text-center text-[10px] uppercase tracking-wide text-gray-500">Actions</th>
									)}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-700/40">
								{users.map((u) => (
									<tr key={u._id} className="hover:bg-gray-800/40">
										<td className="px-3 py-2 text-xs font-medium text-gray-200">{u.name}</td>
										<td className="px-3 py-2">
											<p className="text-xs text-gray-400">{u.email}</p>
											{canEditRoles && storedPasswords[u._id] && (
												<div className="flex items-center gap-1.5 mt-1">
													<span className="text-[11px] text-gray-600 font-mono">
														{showPasswords[u._id] ? storedPasswords[u._id] : '••••••••'}
													</span>
													<button
														type="button"
														onClick={() => setShowPasswords((v) => ({ ...v, [u._id]: !v[u._id] }))}
														className="text-[10px] text-gray-600 hover:text-gray-400 font-semibold"
													>
														{showPasswords[u._id] ? 'Hide' : 'Show'}
													</button>
												</div>
											)}
										</td>
										<td className="px-3 py-2 text-xs text-gray-300">{getUserRoleLabel(u)}</td>
										<td className="px-3 py-2 text-xs text-gray-500">{u.departmentId?.name ?? '—'}</td>
										{canEditRoles && u.role !== 'super_admin' && (
											<td className="px-3 py-2">
												<div className="flex items-center justify-center gap-1.5">
													<button
														type="button"
														onClick={() => openEditUser(u)}
														className={`${buttonClass} border-gray-700/60 bg-gray-800/60 text-gray-400 hover:text-gray-200`}
													>
														Edit
													</button>
													{deleteUserConfirm === u._id ? (
														<>
															<button
																type="button"
																onClick={() => handleDeleteUser(u._id)}
																className={`${buttonClass} border-red-500/40 bg-red-500/10 text-red-300`}
															>
																Confirm
															</button>
															<button
																type="button"
																onClick={() => setDeleteUserConfirm(null)}
																className={`${buttonClass} border-gray-700/60 text-gray-500`}
															>
																Cancel
															</button>
														</>
													) : (
														<button
															type="button"
															onClick={() => setDeleteUserConfirm(u._id)}
															className={`${buttonClass} border-red-500/40 bg-red-500/10 text-red-300`}
														>
															Delete
														</button>
													)}
												</div>
											</td>
										)}
										{canEditRoles && u.role === 'super_admin' && (
											<td className="px-3 py-2 text-center text-[10px] text-gray-600">—</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
