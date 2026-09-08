'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canWrite } from '@/lib/permissions';
import {
  createContact,
  createGroup,
  fetchAssignees,
  fetchContacts,
  fetchGroups,
  updateContact,
  updateGroup,
  type Contact,
  type ContactGroup,
} from '@/lib/issues';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

type OrgUser = { _id: string; name: string; email?: string; role?: string };

export default function IssuesContactsPage() {
  const [tab, setTab] = useState<'users' | 'contacts' | 'groups'>('users');
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const writable = canWrite('issues');

  const [draft, setDraft] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    role: '',
  });
  const [groupDraft, setGroupDraft] = useState({ name: '', description: '', contactIds: [] as string[] });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [assignees, c, g] = await Promise.all([
        fetchAssignees(),
        fetchContacts(),
        fetchGroups(),
      ]);
      setUsers(assignees.users);
      setContacts(c.contacts);
      setGroups(g.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writable) return;
    setMessage('');
    try {
      await createContact(draft);
      setDraft({ name: '', email: '', phone: '', company: '', role: '' });
      setMessage('Contact created');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const addGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writable) return;
    setMessage('');
    try {
      await createGroup(groupDraft);
      setGroupDraft({ name: '', description: '', contactIds: [] });
      setMessage('Group created');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (loading) return <LoadingSpinner message="Loading contacts..." />;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/dashboard/issues" className="text-xs text-blue-400 no-underline">
            ← Tickets
          </Link>
          <h1 className="text-2xl font-bold text-gray-100 mt-1">Contacts & teams</h1>
          <p className="text-sm text-gray-500 mt-1">
            Org users (for My Tickets), external contacts, and teams used when assigning tickets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/issues/employees"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
          >
            Employees
          </Link>
          <Link
            href="/dashboard/issues/automation"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
          >
            Automation & Escalations
          </Link>
          <Link
            href="/dashboard/issues/settings"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
          >
            Configuration
          </Link>
        </div>
      </div>

      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        {(['users', 'contacts', 'groups'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded-lg border capitalize ${
              tab === t
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : 'border-gray-700/60 text-gray-400'
            }`}
          >
            {t === 'users' ? 'Org users / roles' : t === 'groups' ? 'Teams' : t}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            These Resolve users can be assigned so tickets show under <span className="text-gray-300">My Tickets</span>.
            Managed in Users & Roles — listed here for assignment.
          </p>
          {users.length === 0 ? (
            <p className="text-sm text-gray-500">No active users in this organization.</p>
          ) : (
            users.map((u) => (
              <div
                key={u._id}
                className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3"
              >
                <p className="text-sm font-semibold text-gray-100">{u.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[u.role, u.email].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-4">
          {writable && (
            <form
              onSubmit={addContact}
              className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  className={inputClass}
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  className={inputClass}
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  If this matches an org user email, assigning the contact also links My Tickets.
                </p>
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  className={inputClass}
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Company</label>
                <input
                  className={inputClass}
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Role / designation</label>
                <input
                  className={inputClass}
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="sm:col-span-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200"
              >
                Add contact
              </button>
            </form>
          )}

          <div className="space-y-2">
            {contacts.length === 0 ? (
              <p className="text-sm text-gray-500">No contacts yet.</p>
            ) : (
              contacts.map((c) => (
                <div
                  key={c._id}
                  className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3 flex flex-wrap items-start justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-100">
                      {c.name}
                      {!c.isActive && (
                        <span className="ml-2 text-[10px] text-gray-500 uppercase">Inactive</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[c.role, c.company, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {writable && (
                    <button
                      type="button"
                      onClick={async () => {
                        await updateContact(c._id, { isActive: !c.isActive });
                        await load();
                      }}
                      className="text-xs text-gray-400 hover:text-gray-200"
                    >
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div className="space-y-4">
          {writable && (
            <form
              onSubmit={addGroup}
              className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-2"
            >
              <div>
                <label className={labelClass}>Team name *</label>
                <input
                  className={inputClass}
                  required
                  value={groupDraft.name}
                  onChange={(e) => setGroupDraft({ ...groupDraft, name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <input
                  className={inputClass}
                  value={groupDraft.description}
                  onChange={(e) => setGroupDraft({ ...groupDraft, description: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Members (contacts)</label>
                <select
                  className={inputClass}
                  multiple
                  value={groupDraft.contactIds}
                  onChange={(e) =>
                    setGroupDraft({
                      ...groupDraft,
                      contactIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                    })
                  }
                >
                  {contacts
                    .filter((c) => c.isActive !== false)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-600 mt-1">Hold Cmd/Ctrl to select multiple.</p>
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200"
              >
                Add team
              </button>
            </form>
          )}

          <div className="space-y-2">
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500">No teams yet.</p>
            ) : (
              groups.map((g) => {
                const members = Array.isArray(g.contactIds)
                  ? g.contactIds.map((m) => (typeof m === 'string' ? m : m.name)).join(', ')
                  : '';
                return (
                  <div
                    key={g._id}
                    className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3 flex flex-wrap justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-100">{g.name}</p>
                      {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                      <p className="text-[11px] text-gray-600 mt-1">{members || 'No members'}</p>
                    </div>
                    {writable && (
                      <button
                        type="button"
                        onClick={async () => {
                          await updateGroup(g._id, { isActive: !g.isActive });
                          await load();
                        }}
                        className="text-xs text-gray-400 hover:text-gray-200"
                      >
                        {g.isActive !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
