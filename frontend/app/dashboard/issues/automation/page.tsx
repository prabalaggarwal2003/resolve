'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canTicketAction } from '@/lib/permissions';
import {
  createAutomationRule,
  createEscalationRule,
  deleteAutomationRule,
  deleteEscalationRule,
  fetchAssignees,
  fetchAutomation,
  runEscalationCheck,
  updateAutomationRule,
  updateEscalationRule,
  type AutomationMatch,
  type EscalationTrigger,
  type IssueAutomationRule,
  type IssueEscalationRule,
} from '@/lib/issues';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

type Opt = { id: string; name: string };
type Person = { _id: string; name: string; email?: string };
type Group = { _id: string; name: string };
type Dept = { _id: string; name: string };

function idOf(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v && '_id' in v) return String((v as { _id: string })._id);
  return String(v);
}

function nameOf(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'object' && v && 'name' in v) return String((v as { name?: string }).name || '');
  return '';
}

function MatchChips({
  match,
  catalogs,
}: {
  match: AutomationMatch;
  catalogs: {
    categories: string[];
    types: Opt[];
    priorities: Opt[];
    locations: Opt[];
    departments: Opt[];
  };
}) {
  const chips: string[] = [];
  for (const c of match.assetCategories || []) chips.push(`Category: ${c}`);
  for (const id of match.issueTypeIds || []) {
    chips.push(`Type: ${catalogs.types.find((t) => t.id === id)?.name || id}`);
  }
  for (const id of match.priorityIds || []) {
    chips.push(`Priority: ${catalogs.priorities.find((p) => p.id === id)?.name || id}`);
  }
  for (const loc of match.locationIds || []) {
    const id = idOf(loc);
    chips.push(`Location: ${nameOf(loc) || catalogs.locations.find((l) => l.id === id)?.name || id}`);
  }
  for (const d of match.departmentIds || []) {
    const id = idOf(d);
    chips.push(`Dept: ${nameOf(d) || catalogs.departments.find((x) => x.id === id)?.name || id}`);
  }
  if (!chips.length) return <span className="text-xs text-gray-600">Matches any ticket</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="px-1.5 py-0.5 text-[10px] rounded border border-gray-700/60 bg-gray-800/50 text-gray-300"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function MultiCheck({
  label,
  options,
  values,
  onChange,
  disabled,
}: {
  label: string;
  options: Opt[];
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string) => {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
  };
  return (
    <div>
      <p className={labelClass}>
        {label} <span className="normal-case text-gray-600">(empty = any)</span>
      </p>
      {options.length === 0 ? (
        <p className="text-xs text-gray-600">None available</p>
      ) : (
        <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-800/60 bg-gray-900/30 p-2 space-y-1">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                disabled={disabled}
                checked={values.includes(o.id)}
                onChange={() => toggle(o.id)}
              />
              {o.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyMatch = (): AutomationMatch => ({
  assetCategories: [],
  issueTypeIds: [],
  priorityIds: [],
  locationIds: [],
  departmentIds: [],
});

type TriggerKind = EscalationTrigger['kind'];

const emptyTrigger = (): EscalationTrigger => ({
  kind: 'sla_pct',
  slaPct: 80,
  unresolvedHours: 24,
});

function ruleTriggers(rule: IssueEscalationRule): EscalationTrigger[] {
  if (Array.isArray(rule.triggers) && rule.triggers.length) return rule.triggers;
  if (rule.trigger?.kind) return [rule.trigger];
  return [emptyTrigger()];
}

function formatTriggerLabel(t: EscalationTrigger): string {
  if (t.kind === 'sla_pct') return `SLA ≥ ${t.slaPct || 80}%`;
  if (t.kind === 'sla_breached') return 'SLA breached';
  return `Unresolved ${t.unresolvedHours || '?'}h`;
}

function formatTriggersSummary(rule: IssueEscalationRule): string {
  const list = ruleTriggers(rule);
  const labels = list.map(formatTriggerLabel);
  if (labels.length === 1) return labels[0];
  const joiner = rule.triggerLogic === 'and' ? ' AND ' : ' OR ';
  return labels.join(joiner);
}

const emptyAutoDraft = () => ({
  name: '',
  enabled: true,
  sortOrder: 0,
  match: emptyMatch(),
  assign: {
    assigneeUserId: '',
    assigneeGroupId: '',
    assigneeDepartmentId: '',
  },
  slaResolutionHours: '' as string | number,
});

const emptyEscDraft = () => ({
  name: '',
  enabled: true,
  sortOrder: 0,
  match: emptyMatch(),
  triggerLogic: 'or' as 'and' | 'or',
  triggers: [emptyTrigger()],
  actions: {
    notifyAssignee: true,
    notifyUserIds: [] as string[],
    bumpPriorityId: '',
    reassign: {
      assigneeUserId: '',
      assigneeGroupId: '',
      assigneeDepartmentId: '',
    },
  },
  cooldownMinutes: 60,
});

export default function IssuesAutomationPage() {
  const writable = canTicketAction('manage_config');
  const [section, setSection] = useState<'auto' | 'escalation'>('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [autoRules, setAutoRules] = useState<IssueAutomationRule[]>([]);
  const [escRules, setEscRules] = useState<IssueEscalationRule[]>([]);
  const [types, setTypes] = useState<Opt[]>([]);
  const [priorities, setPriorities] = useState<Opt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<Opt[]>([]);
  const [users, setUsers] = useState<Person[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);

  const [editingAutoId, setEditingAutoId] = useState<string | null>(null);
  const [autoDraft, setAutoDraft] = useState(emptyAutoDraft);
  const [showAutoForm, setShowAutoForm] = useState(false);

  const [editingEscId, setEditingEscId] = useState<string | null>(null);
  const [escDraft, setEscDraft] = useState(emptyEscDraft);
  const [showEscForm, setShowEscForm] = useState(false);

  const catalogs = {
    categories,
    types,
    priorities,
    locations,
    departments: departments.map((d) => ({ id: d._id, name: d.name })),
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [bundle, assignees] = await Promise.all([fetchAutomation(), fetchAssignees()]);
      setAutoRules(bundle.automationRules || []);
      setEscRules(bundle.escalationRules || []);
      setTypes(bundle.options?.issueTypes || []);
      setPriorities(bundle.options?.priorities || []);
      setCategories(bundle.options?.assetCategories || []);
      setLocations(
        (bundle.options?.locations || []).map((l) => ({
          id: l._id,
          name: l.path || l.name,
        }))
      );
      setUsers(assignees.users || []);
      setGroups(assignees.groups || []);
      setDepartments(assignees.departments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNewAuto = () => {
    setEditingAutoId(null);
    setAutoDraft(emptyAutoDraft());
    setShowAutoForm(true);
  };

  const openEditAuto = (rule: IssueAutomationRule) => {
    setEditingAutoId(rule._id);
    setAutoDraft({
      name: rule.name,
      enabled: rule.enabled !== false,
      sortOrder: rule.sortOrder || 0,
      match: {
        assetCategories: [...(rule.match?.assetCategories || [])],
        issueTypeIds: [...(rule.match?.issueTypeIds || [])],
        priorityIds: [...(rule.match?.priorityIds || [])],
        locationIds: (rule.match?.locationIds || []).map(idOf),
        departmentIds: (rule.match?.departmentIds || []).map(idOf),
      },
      assign: {
        assigneeUserId: idOf(rule.assign?.assigneeUserId),
        assigneeGroupId: idOf(rule.assign?.assigneeGroupId),
        assigneeDepartmentId: idOf(rule.assign?.assigneeDepartmentId),
      },
      slaResolutionHours: rule.slaResolutionHours ?? '',
    });
    setShowAutoForm(true);
  };

  const saveAuto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writable) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const body = {
        name: autoDraft.name,
        enabled: autoDraft.enabled,
        sortOrder: Number(autoDraft.sortOrder) || 0,
        match: {
          assetCategories: autoDraft.match.assetCategories || [],
          issueTypeIds: autoDraft.match.issueTypeIds || [],
          priorityIds: autoDraft.match.priorityIds || [],
          locationIds: (autoDraft.match.locationIds || []).map(idOf),
          departmentIds: (autoDraft.match.departmentIds || []).map(idOf),
        },
        assign: {
          assigneeUserId: autoDraft.assign.assigneeUserId,
          assigneeGroupId: autoDraft.assign.assigneeGroupId || null,
          assigneeDepartmentId: autoDraft.assign.assigneeDepartmentId || null,
        },
        slaResolutionHours:
          autoDraft.slaResolutionHours === '' || autoDraft.slaResolutionHours == null
            ? undefined
            : Number(autoDraft.slaResolutionHours),
      };
      const res = editingAutoId
        ? await updateAutomationRule(editingAutoId, body)
        : await createAutomationRule(body);
      setAutoRules(res.automationRules);
      setShowAutoForm(false);
      setMessage(editingAutoId ? 'Auto-assignment rule updated' : 'Auto-assignment rule created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeAuto = async (id: string) => {
    if (!writable || !confirm('Delete this auto-assignment rule?')) return;
    try {
      const res = await deleteAutomationRule(id);
      setAutoRules(res.automationRules);
      setMessage('Rule deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const openNewEsc = () => {
    setEditingEscId(null);
    setEscDraft(emptyEscDraft());
    setShowEscForm(true);
  };

  const openEditEsc = (rule: IssueEscalationRule) => {
    setEditingEscId(rule._id);
    setEscDraft({
      name: rule.name,
      enabled: rule.enabled !== false,
      sortOrder: rule.sortOrder || 0,
      match: {
        assetCategories: [...(rule.match?.assetCategories || [])],
        issueTypeIds: [...(rule.match?.issueTypeIds || [])],
        priorityIds: [...(rule.match?.priorityIds || [])],
        locationIds: (rule.match?.locationIds || []).map(idOf),
        departmentIds: (rule.match?.departmentIds || []).map(idOf),
      },
      triggerLogic: rule.triggerLogic === 'and' ? 'and' : 'or',
      triggers: ruleTriggers(rule).map((t) => ({
        kind: t.kind,
        slaPct: t.slaPct ?? 80,
        unresolvedHours: t.unresolvedHours ?? 24,
      })),
      actions: {
        notifyAssignee: rule.actions?.notifyAssignee !== false,
        notifyUserIds: (rule.actions?.notifyUserIds || []).map(idOf),
        bumpPriorityId: rule.actions?.bumpPriorityId || '',
        reassign: {
          assigneeUserId: idOf(rule.actions?.reassign?.assigneeUserId),
          assigneeGroupId: idOf(rule.actions?.reassign?.assigneeGroupId),
          assigneeDepartmentId: idOf(rule.actions?.reassign?.assigneeDepartmentId),
        },
      },
      cooldownMinutes: rule.cooldownMinutes ?? 60,
    });
    setShowEscForm(true);
  };

  const saveEsc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writable) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const re = escDraft.actions.reassign;
      const body = {
        name: escDraft.name,
        enabled: escDraft.enabled,
        sortOrder: Number(escDraft.sortOrder) || 0,
        match: {
          assetCategories: escDraft.match.assetCategories || [],
          issueTypeIds: escDraft.match.issueTypeIds || [],
          priorityIds: escDraft.match.priorityIds || [],
          locationIds: (escDraft.match.locationIds || []).map(idOf),
          departmentIds: (escDraft.match.departmentIds || []).map(idOf),
        },
        triggerLogic: escDraft.triggerLogic,
        triggers: escDraft.triggers.map((t) => ({
          kind: t.kind,
          slaPct: t.kind === 'sla_pct' ? Number(t.slaPct) : undefined,
          unresolvedHours: t.kind === 'unresolved_hours' ? Number(t.unresolvedHours) : undefined,
        })),
        actions: {
          notifyAssignee: escDraft.actions.notifyAssignee,
          notifyUserIds: escDraft.actions.notifyUserIds,
          bumpPriorityId: escDraft.actions.bumpPriorityId || '',
          reassign: {
            assigneeUserId: re.assigneeUserId || null,
            assigneeGroupId: re.assigneeGroupId || null,
            assigneeDepartmentId: re.assigneeDepartmentId || null,
          },
        },
        cooldownMinutes: Number(escDraft.cooldownMinutes) || 60,
      };
      const res = editingEscId
        ? await updateEscalationRule(editingEscId, body)
        : await createEscalationRule(body);
      setEscRules(res.escalationRules);
      setShowEscForm(false);
      setMessage(editingEscId ? 'Escalation rule updated' : 'Escalation rule created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const removeEsc = async (id: string) => {
    if (!writable || !confirm('Delete this escalation rule?')) return;
    try {
      const res = await deleteEscalationRule(id);
      setEscRules(res.escalationRules);
      setMessage('Escalation rule deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const runNow = async () => {
    if (!writable) return;
    setMessage('');
    try {
      const r = await runEscalationCheck();
      setMessage(`Escalation check: ${r.checked} tickets scanned, ${r.fired} escalations fired`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    }
  };

  if (loading) return <LoadingSpinner message="Loading automation..." />;

  const matchEditors = (
    match: AutomationMatch,
    setMatch: (m: AutomationMatch) => void
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <MultiCheck
        label="Asset category"
        disabled={!writable}
        options={categories.map((c) => ({ id: c, name: c }))}
        values={match.assetCategories || []}
        onChange={(assetCategories) => setMatch({ ...match, assetCategories })}
      />
      <MultiCheck
        label="Issue type"
        disabled={!writable}
        options={types}
        values={match.issueTypeIds || []}
        onChange={(issueTypeIds) => setMatch({ ...match, issueTypeIds })}
      />
      <MultiCheck
        label="Priority"
        disabled={!writable}
        options={priorities}
        values={match.priorityIds || []}
        onChange={(priorityIds) => setMatch({ ...match, priorityIds })}
      />
      <MultiCheck
        label="Location"
        disabled={!writable}
        options={locations}
        values={(match.locationIds || []).map(idOf)}
        onChange={(locationIds) => setMatch({ ...match, locationIds })}
      />
      <MultiCheck
        label="Department (asset)"
        disabled={!writable}
        options={catalogs.departments}
        values={(match.departmentIds || []).map(idOf)}
        onChange={(departmentIds) => setMatch({ ...match, departmentIds })}
      />
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/dashboard/issues" className="text-xs text-blue-400 no-underline">
            ← Tickets
          </Link>
          <h1 className="text-2xl font-bold text-gray-100 mt-1">Automation & Escalations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Organization rules for auto-assignment on create and SLA-based escalation. User is
            required whenever assigning or reassigning.
            {!writable && ' View only — manage_config permission required to edit.'}
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
            href="/dashboard/issues/settings"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
          >
            Configuration
          </Link>
          <Link
            href="/dashboard/issues/contacts"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300 no-underline"
          >
            Contacts
          </Link>
        </div>
      </div>

      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'auto' as const, label: 'Auto-assignment' },
            { id: 'escalation' as const, label: 'Escalation' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSection(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              section === t.id
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : 'border-gray-700/60 text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {section === 'auto' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-gray-400">
              First matching rule (lowest sort order) assigns the ticket. Dimensions with values are
              ANDed; within a dimension, selected values are ORed.
            </p>
            {writable && (
              <button
                type="button"
                onClick={openNewAuto}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200"
              >
                + Add rule
              </button>
            )}
          </div>

          {showAutoForm && (
            <form
              onSubmit={saveAuto}
              className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 space-y-3"
            >
              <p className="text-sm font-medium text-gray-200">
                {editingAutoId ? 'Edit auto-assignment rule' : 'New auto-assignment rule'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    className={inputClass}
                    required
                    disabled={!writable}
                    value={autoDraft.name}
                    onChange={(e) => setAutoDraft({ ...autoDraft, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sort order</label>
                  <input
                    type="number"
                    className={inputClass}
                    disabled={!writable}
                    value={autoDraft.sortOrder}
                    onChange={(e) =>
                      setAutoDraft({ ...autoDraft, sortOrder: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  disabled={!writable}
                  checked={autoDraft.enabled}
                  onChange={(e) => setAutoDraft({ ...autoDraft, enabled: e.target.checked })}
                />
                Enabled
              </label>

              <p className="text-xs font-medium text-gray-300 pt-1">When ticket matches</p>
              {matchEditors(autoDraft.match, (match) => setAutoDraft({ ...autoDraft, match }))}

              <p className="text-xs font-medium text-gray-300 pt-1">Then assign</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>User (required)</label>
                  <select
                    className={inputClass}
                    required
                    disabled={!writable}
                    value={autoDraft.assign.assigneeUserId}
                    onChange={(e) =>
                      setAutoDraft({
                        ...autoDraft,
                        assign: { ...autoDraft.assign, assigneeUserId: e.target.value },
                      })
                    }
                  >
                    <option value="">Select user…</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                        {u.email ? ` (${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Team (optional)</label>
                  <select
                    className={inputClass}
                    disabled={!writable}
                    value={autoDraft.assign.assigneeGroupId}
                    onChange={(e) =>
                      setAutoDraft({
                        ...autoDraft,
                        assign: { ...autoDraft.assign, assigneeGroupId: e.target.value },
                      })
                    }
                  >
                    <option value="">—</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Department (optional)</label>
                  <select
                    className={inputClass}
                    disabled={!writable}
                    value={autoDraft.assign.assigneeDepartmentId}
                    onChange={(e) =>
                      setAutoDraft({
                        ...autoDraft,
                        assign: { ...autoDraft.assign, assigneeDepartmentId: e.target.value },
                      })
                    }
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="max-w-xs">
                <label className={labelClass}>Resolution SLA hours (optional override)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={inputClass}
                  disabled={!writable}
                  placeholder="Priority default"
                  value={autoDraft.slaResolutionHours}
                  onChange={(e) =>
                    setAutoDraft({ ...autoDraft, slaResolutionHours: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-2 pt-1">
                {writable && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save rule'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAutoForm(false)}
                  className="px-3 py-1.5 text-xs text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {autoRules.length === 0 ? (
            <p className="text-sm text-gray-600">No auto-assignment rules yet.</p>
          ) : (
            <div className="space-y-2">
              {autoRules.map((rule) => (
                <div
                  key={rule._id}
                  className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-gray-100">{rule.name}</p>
                        {!rule.enabled && (
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">
                            Disabled
                          </span>
                        )}
                        <span className="text-[10px] text-gray-600">order {rule.sortOrder ?? 0}</span>
                      </div>
                      <MatchChips match={rule.match || {}} catalogs={catalogs} />
                      <p className="text-xs text-gray-400">
                        Assign →{' '}
                        {nameOf(rule.assign?.assigneeUserId) ||
                          users.find((u) => u._id === idOf(rule.assign?.assigneeUserId))?.name ||
                          'User'}
                        {rule.assign?.assigneeGroupId
                          ? ` · Team: ${
                              nameOf(rule.assign.assigneeGroupId) ||
                              groups.find((g) => g._id === idOf(rule.assign.assigneeGroupId))?.name
                            }`
                          : ''}
                        {rule.assign?.assigneeDepartmentId
                          ? ` · Dept: ${
                              nameOf(rule.assign.assigneeDepartmentId) ||
                              departments.find(
                                (d) => d._id === idOf(rule.assign.assigneeDepartmentId)
                              )?.name
                            }`
                          : ''}
                        {rule.slaResolutionHours != null
                          ? ` · SLA ${rule.slaResolutionHours}h`
                          : ''}
                      </p>
                    </div>
                    {writable && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditAuto(rule)}
                          className="text-xs text-blue-400"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAuto(rule._id)}
                          className="text-xs text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'escalation' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-400">
              Escalation recipients are chosen per rule — no fixed hierarchy. Cron evaluates open
              tickets every 10 minutes.
            </p>
            <div className="flex gap-2 shrink-0">
              {writable && (
                <>
                  <button
                    type="button"
                    onClick={runNow}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700/60 text-gray-300"
                  >
                    Run check now
                  </button>
                  <button
                    type="button"
                    onClick={openNewEsc}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200"
                  >
                    + Add rule
                  </button>
                </>
              )}
            </div>
          </div>

          {showEscForm && (
            <form
              onSubmit={saveEsc}
              className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 space-y-3"
            >
              <p className="text-sm font-medium text-gray-200">
                {editingEscId ? 'Edit escalation rule' : 'New escalation rule'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    className={inputClass}
                    required
                    disabled={!writable}
                    value={escDraft.name}
                    onChange={(e) => setEscDraft({ ...escDraft, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sort order</label>
                  <input
                    type="number"
                    className={inputClass}
                    disabled={!writable}
                    value={escDraft.sortOrder}
                    onChange={(e) =>
                      setEscDraft({ ...escDraft, sortOrder: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  disabled={!writable}
                  checked={escDraft.enabled}
                  onChange={(e) => setEscDraft({ ...escDraft, enabled: e.target.checked })}
                />
                Enabled
              </label>

              <p className="text-xs font-medium text-gray-300 pt-1">Applies when ticket matches</p>
              {matchEditors(escDraft.match, (match) => setEscDraft({ ...escDraft, match }))}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-xs font-medium text-gray-300">Triggers</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-gray-700/60 overflow-hidden">
                    {(['or', 'and'] as const).map((logic) => (
                      <button
                        key={logic}
                        type="button"
                        disabled={!writable}
                        onClick={() => setEscDraft({ ...escDraft, triggerLogic: logic })}
                        className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          escDraft.triggerLogic === logic
                            ? 'bg-blue-600/30 text-blue-200'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {logic}
                      </button>
                    ))}
                  </div>
                  {writable && (
                    <button
                      type="button"
                      onClick={() =>
                        setEscDraft({
                          ...escDraft,
                          triggers: [...escDraft.triggers, emptyTrigger()],
                        })
                      }
                      className="text-xs text-blue-400"
                    >
                      + Add trigger
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-gray-600 -mt-1">
                {escDraft.triggerLogic === 'and'
                  ? 'All triggers must be true before this rule fires.'
                  : 'Any one trigger being true is enough for this rule to fire.'}
              </p>

              <div className="space-y-2">
                {escDraft.triggers.map((trig, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-gray-800/60 bg-gray-900/30 p-3 space-y-2"
                  >
                    {idx > 0 && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-300/80">
                        {escDraft.triggerLogic}
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className={labelClass}>Event</label>
                        <select
                          className={inputClass}
                          disabled={!writable}
                          value={trig.kind}
                          onChange={(e) => {
                            const kind = e.target.value as TriggerKind;
                            const next = [...escDraft.triggers];
                            next[idx] = { ...next[idx], kind };
                            setEscDraft({ ...escDraft, triggers: next });
                          }}
                        >
                          <option value="sla_pct">SLA reaches %</option>
                          <option value="sla_breached">SLA breached</option>
                          <option value="unresolved_hours">Unresolved for X hours</option>
                        </select>
                      </div>
                      {trig.kind === 'sla_pct' && (
                        <div>
                          <label className={labelClass}>SLA percent</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            className={inputClass}
                            disabled={!writable}
                            value={trig.slaPct ?? 80}
                            onChange={(e) => {
                              const next = [...escDraft.triggers];
                              next[idx] = {
                                ...next[idx],
                                slaPct: Number(e.target.value) || 80,
                              };
                              setEscDraft({ ...escDraft, triggers: next });
                            }}
                          />
                        </div>
                      )}
                      {trig.kind === 'unresolved_hours' && (
                        <div>
                          <label className={labelClass}>Hours unresolved</label>
                          <input
                            type="number"
                            min={0.25}
                            step={0.25}
                            className={inputClass}
                            disabled={!writable}
                            value={trig.unresolvedHours ?? 24}
                            onChange={(e) => {
                              const next = [...escDraft.triggers];
                              next[idx] = {
                                ...next[idx],
                                unresolvedHours: Number(e.target.value) || 24,
                              };
                              setEscDraft({ ...escDraft, triggers: next });
                            }}
                          />
                        </div>
                      )}
                      <div className="flex items-end">
                        {writable && escDraft.triggers.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEscDraft({
                                ...escDraft,
                                triggers: escDraft.triggers.filter((_, i) => i !== idx),
                              })
                            }
                            className="text-xs text-red-400 pb-1.5"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="max-w-xs">
                <label className={labelClass}>Cooldown (minutes)</label>
                <input
                  type="number"
                  min={5}
                  className={inputClass}
                  disabled={!writable}
                  value={escDraft.cooldownMinutes}
                  onChange={(e) =>
                    setEscDraft({
                      ...escDraft,
                      cooldownMinutes: Number(e.target.value) || 60,
                    })
                  }
                />
              </div>

              <p className="text-xs font-medium text-gray-300 pt-1">Actions</p>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  disabled={!writable}
                  checked={escDraft.actions.notifyAssignee}
                  onChange={(e) =>
                    setEscDraft({
                      ...escDraft,
                      actions: { ...escDraft.actions, notifyAssignee: e.target.checked },
                    })
                  }
                />
                Notify current assignee
              </label>
              <MultiCheck
                label="Also notify users"
                disabled={!writable}
                options={users.map((u) => ({ id: u._id, name: u.name }))}
                values={escDraft.actions.notifyUserIds}
                onChange={(notifyUserIds) =>
                  setEscDraft({
                    ...escDraft,
                    actions: { ...escDraft.actions, notifyUserIds },
                  })
                }
              />
              <div className="max-w-xs">
                <label className={labelClass}>Increase priority to (optional)</label>
                <select
                  className={inputClass}
                  disabled={!writable}
                  value={escDraft.actions.bumpPriorityId}
                  onChange={(e) =>
                    setEscDraft({
                      ...escDraft,
                      actions: { ...escDraft.actions, bumpPriorityId: e.target.value },
                    })
                  }
                >
                  <option value="">No change</option>
                  {priorities.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs font-medium text-gray-300 pt-1">
                Reassign / escalate to (user required if reassigning)
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>User</label>
                  <select
                    className={inputClass}
                    disabled={!writable}
                    value={escDraft.actions.reassign.assigneeUserId}
                    onChange={(e) =>
                      setEscDraft({
                        ...escDraft,
                        actions: {
                          ...escDraft.actions,
                          reassign: {
                            ...escDraft.actions.reassign,
                            assigneeUserId: e.target.value,
                          },
                        },
                      })
                    }
                  >
                    <option value="">No reassign</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Team</label>
                  <select
                    className={inputClass}
                    disabled={!writable}
                    value={escDraft.actions.reassign.assigneeGroupId}
                    onChange={(e) =>
                      setEscDraft({
                        ...escDraft,
                        actions: {
                          ...escDraft.actions,
                          reassign: {
                            ...escDraft.actions.reassign,
                            assigneeGroupId: e.target.value,
                          },
                        },
                      })
                    }
                  >
                    <option value="">—</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Department</label>
                  <select
                    className={inputClass}
                    disabled={!writable}
                    value={escDraft.actions.reassign.assigneeDepartmentId}
                    onChange={(e) =>
                      setEscDraft({
                        ...escDraft,
                        actions: {
                          ...escDraft.actions,
                          reassign: {
                            ...escDraft.actions.reassign,
                            assigneeDepartmentId: e.target.value,
                          },
                        },
                      })
                    }
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {writable && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/40 bg-blue-600/20 text-blue-200 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save rule'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowEscForm(false)}
                  className="px-3 py-1.5 text-xs text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {escRules.length === 0 ? (
            <p className="text-sm text-gray-600">No escalation rules yet.</p>
          ) : (
            <div className="space-y-2">
              {escRules.map((rule) => {
                const triggerLabel = formatTriggersSummary(rule);
                return (
                  <div
                    key={rule._id}
                    className="rounded-xl border border-rose-900/40 bg-rose-950/10 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-gray-100">{rule.name}</p>
                          {!rule.enabled && (
                            <span className="text-[10px] uppercase tracking-wide text-gray-500">
                              Disabled
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 text-[10px] rounded border border-rose-800/50 text-rose-300/90 max-w-full break-words">
                            {triggerLabel}
                          </span>
                        </div>
                        <MatchChips match={rule.match || {}} catalogs={catalogs} />
                        <p className="text-xs text-gray-400">
                          {rule.actions?.notifyAssignee !== false ? 'Notify assignee' : 'No assignee notify'}
                          {(rule.actions?.notifyUserIds || []).length
                            ? ` · +${(rule.actions?.notifyUserIds || []).length} users`
                            : ''}
                          {rule.actions?.bumpPriorityId
                            ? ` · Bump priority → ${
                                priorities.find((p) => p.id === rule.actions.bumpPriorityId)?.name ||
                                rule.actions.bumpPriorityId
                              }`
                            : ''}
                          {rule.actions?.reassign?.assigneeUserId
                            ? ` · Reassign → ${
                                nameOf(rule.actions.reassign.assigneeUserId) ||
                                users.find(
                                  (u) => u._id === idOf(rule.actions?.reassign?.assigneeUserId)
                                )?.name ||
                                'user'
                              }`
                            : ''}
                        </p>
                      </div>
                      {writable && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditEsc(rule)}
                            className="text-xs text-blue-400"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEsc(rule._id)}
                            className="text-xs text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
