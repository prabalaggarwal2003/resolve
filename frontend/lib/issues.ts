export function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export type IssueOption = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  isClosed?: boolean;
};

export type IssueTypeOption = IssueOption & {
  formFields?: {
    key: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
    placeholder?: string;
    showWhen?: { field: string; equals?: string | boolean | number; notEquals?: string | boolean | number } | null;
  }[];
};

export type IssueOrgConfig = {
  statuses: IssueOption[];
  priorities: IssueOption[];
  severities: IssueOption[];
  issueTypes: IssueTypeOption[];
  settings: {
    ticketPrefix: string;
    defaultPriorityId: string;
    defaultSeverityId: string;
    defaultIssueTypeId: string;
    defaultWorkflowKey: string;
    requireVerificationBeforeClose?: boolean;
    preventSelfVerification?: boolean;
  };
};

export type WorkflowTransition = {
  from: string;
  to: string;
  requireReason?: boolean;
  requiredFields?: string[];
  requireAttachment?: boolean;
  requireApproval?: boolean;
  allowedRoles?: string[];
};

export type IssueActivity = {
  _id: string;
  type: string;
  actorName?: string;
  actorKind?: string;
  actorUserId?: { name?: string; email?: string };
  from?: string;
  to?: string;
  reason?: string;
  meta?: Record<string, unknown>;
  at: string;
};

export type RelatedPerson = {
  _id: string;
  kind: 'contact' | 'partnerContact';
  contactId?: string | { _id: string; name?: string };
  partnerId?: string | { _id: string; name?: string };
  partnerContactId?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
  relation: string;
  addedBy?: { _id?: string; name?: string };
  addedAt?: string;
};

export type RelatedPersonOption = {
  key: string;
  kind: 'contact' | 'partnerContact';
  contactId?: string;
  partnerId?: string;
  partnerContactId?: string | null;
  partnerName?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
  source?: string;
  isPrimary?: boolean;
};

export type IssueReport = {
  _id?: string;
  reportId?: string;
  reporterName: string;
  reporterEmail?: string;
  reporterPhone?: string;
  description?: string;
  photos?: { url: string; uploadedAt?: string }[];
  customFields?: Record<string, unknown>;
  status?: 'new' | 'acknowledged';
  acknowledgedAt?: string;
  acknowledgedBy?: { _id?: string; name?: string; email?: string };
  createdAt?: string;
  followUps?: { note: string; createdAt?: string; _id?: string }[];
};

export type IssueTicket = {
  _id: string;
  ticketId: string;
  title: string;
  description?: string;
  category?: string;
  issueTypeId?: string;
  status: string;
  statusId?: string;
  priority?: string;
  priorityId?: string;
  severityId?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  reports?: IssueReport[];
  reportCount?: number;
  newReportCount?: number;
  slaLabel?: string;
  sla?: {
    responseDueAt?: string;
    resolutionDueAt?: string;
    pausedAt?: string;
    breached?: boolean;
  };
  escalation?: {
    level?: number;
    status?: 'none' | 'warned' | 'escalated' | 'was_escalated';
    lastRuleId?: string;
    lastFiredAt?: string;
    lastReason?: string;
    lastTargetLabel?: string;
    lastTargetUserId?: string | { _id?: string; name?: string };
    history?: {
      ruleId?: string;
      level?: number;
      reason?: string;
      targetLabel?: string;
      targetUserId?: string;
      source?: 'rule' | 'manual' | 'settled';
      at?: string;
    }[];
  };
  createdAt: string;
  dueAt?: string;
  tags?: string[];
  relatedPersons?: RelatedPerson[];
  customFields?: Record<string, unknown>;
  resolution?: {
    notes?: string;
    resolvedAt?: string;
    resolvedBy?: { _id?: string; name?: string; email?: string };
  };
  verification?: {
    notes?: string;
    verifiedAt?: string;
    verifiedBy?: { _id?: string; name?: string; email?: string };
  };
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: { _id?: string; name?: string; email?: string };
  assigneeLabel?: string;
  teamLabel?: string;
  personLabel?: string;
  departmentLabel?: string;
  assetId?: {
    _id: string;
    name: string;
    assetId: string;
    category?: string;
    status?: string;
    assignedTo?: { name: string; email?: string };
    locationId?: { name?: string; path?: string };
    partnerId?: { _id: string; name?: string; partnerCode?: string };
  };
  assignedTo?: { _id?: string; name: string; email?: string; role?: string };
  assigneeUserId?: { _id?: string; name: string; email?: string; role?: string };
  assigneeContactId?: { _id?: string; name: string; email?: string; phone?: string; company?: string; role?: string };
  assigneeGroupId?: { _id?: string; name: string; description?: string };
  assigneeDepartmentId?: {
    _id?: string;
    name: string;
    locationId?: { _id?: string; name?: string; path?: string; type?: string };
  };
  locationId?: { name?: string; path?: string };
  activities?: IssueActivity[];
  allowedTransitions?: WorkflowTransition[];
  config?: {
    statuses: IssueOption[];
    priorities: IssueOption[];
    severities: IssueOption[];
    issueTypes: IssueTypeOption[];
  };
};

export async function fetchIssueConfig(): Promise<{
  config: IssueOrgConfig;
  workflows: { key: string; name: string; transitions?: WorkflowTransition[] }[];
}> {
  const res = await fetch(api('/api/issues/config'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load issues config');
  return data;
}

export async function updateIssueConfig(payload: Partial<IssueOrgConfig>) {
  const res = await fetch(api('/api/issues/config'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save issues config');
  return data as { config: IssueOrgConfig };
}

export async function fetchIssues(params: Record<string, string | number | undefined> = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const res = await fetch(api(`/api/issues?${q}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load issues');
  return data as { issues: IssueTicket[]; total: number; page: number; limit: number };
}

export async function fetchIssue(id: string) {
  const res = await fetch(api(`/api/issues/${id}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load issue');
  return data as IssueTicket;
}

export async function acknowledgeIssueReport(issueId: string, reportId: string) {
  const res = await fetch(api(`/api/issues/${issueId}/reports/${encodeURIComponent(reportId)}/acknowledge`), {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to acknowledge report');
  return data as IssueTicket;
}

export async function transitionIssue(
  id: string,
  body: {
    toStatus: string;
    reason?: string;
    fields?: { resolution?: { notes?: string }; verification?: { notes?: string } };
  }
) {
  const res = await fetch(api(`/api/issues/${id}/transition`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Transition failed');
  return data as IssueTicket;
}

export type Contact = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  isActive?: boolean;
  notes?: string;
};

export type ContactGroup = {
  _id: string;
  name: string;
  description?: string;
  contactIds?: Contact[] | string[];
  isActive?: boolean;
};

export async function fetchContacts(params: { active?: string; q?: string } = {}) {
  const q = new URLSearchParams();
  if (params.active) q.set('active', params.active);
  if (params.q) q.set('q', params.q);
  const res = await fetch(api(`/api/issues/contacts?${q}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load contacts');
  return data as { contacts: Contact[] };
}

export async function createContact(body: Partial<Contact>) {
  const res = await fetch(api('/api/issues/contacts'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create contact');
  return data as { contact: Contact };
}

export async function updateContact(id: string, body: Partial<Contact>) {
  const res = await fetch(api(`/api/issues/contacts/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update contact');
  return data as { contact: Contact };
}

export async function fetchGroups() {
  const res = await fetch(api('/api/issues/groups?active=true'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load groups');
  return data as { groups: ContactGroup[] };
}

export async function createGroup(body: { name: string; description?: string; contactIds?: string[] }) {
  const res = await fetch(api('/api/issues/groups'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create group');
  return data as { group: ContactGroup };
}

export async function updateGroup(id: string, body: Partial<ContactGroup> & { contactIds?: string[] }) {
  const res = await fetch(api(`/api/issues/groups/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update group');
  return data as { group: ContactGroup };
}

export async function fetchAssignees() {
  const res = await fetch(api('/api/issues/assignees'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load assignees');
  return data as {
    users: { _id: string; name: string; email?: string; role?: string; kind: 'user' }[];
    contacts: {
      _id: string;
      name: string;
      email?: string;
      role?: string;
      kind: 'contact';
      teams?: { _id: string; name: string }[];
    }[];
    unteamedContacts: {
      _id: string;
      name: string;
      email?: string;
      role?: string;
      kind: 'contact';
    }[];
    groups: {
      _id: string;
      name: string;
      description?: string;
      contactIds: string[];
      kind: 'group';
    }[];
    departments: {
      _id: string;
      name: string;
      description?: string;
      locationPath?: string;
      locationId?: string | null;
      kind: 'department';
    }[];
  };
}

export async function updateIssue(
  id: string,
  body: Partial<{ title: string; description: string; priorityId: string; severityId: string; dueAt: string | null }>
) {
  const res = await fetch(api(`/api/issues/${id}`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Update failed');
  return data as IssueTicket;
}

export async function assignIssue(
  id: string,
  body: {
    assigneeUserId?: string | null;
    assigneeContactId?: string | null;
    assigneeGroupId?: string | null;
    assigneeDepartmentId?: string | null;
    reason?: string;
    clear?: boolean;
    clearTeam?: boolean;
    clearPerson?: boolean;
    clearDepartment?: boolean;
  }
) {
  const res = await fetch(api(`/api/issues/${id}/assign`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Assign failed');
  return data as IssueTicket;
}

export async function escalateIssue(
  id: string,
  body: {
    reason: string;
    assigneeUserId: string;
    assigneeGroupId?: string | null;
    assigneeDepartmentId?: string | null;
    bumpPriorityId?: string;
  }
) {
  const res = await fetch(api(`/api/issues/${id}/escalate`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Escalation failed');
  return data as IssueTicket;
}

export async function addIssueComment(id: string, body: string) {
  const res = await fetch(api(`/api/issues/${id}/comments`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to add comment');
  return data as IssueTicket;
}

export async function addInternalNote(id: string, body: string) {
  const res = await fetch(api(`/api/issues/${id}/internal-notes`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to add internal note');
  return data as IssueTicket;
}

export async function fetchRelatedPersonOptions(id: string) {
  const res = await fetch(api(`/api/issues/${id}/related-person-options`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load contact options');
  return data as {
    contacts: RelatedPersonOption[];
    partnerContacts: RelatedPersonOption[];
    partners: { _id: string; name: string }[];
  };
}

export async function addRelatedPerson(
  id: string,
  body: {
    kind: 'contact' | 'partnerContact';
    contactId?: string;
    partnerId?: string;
    partnerContactId?: string | null;
    usePrimary?: boolean;
    relation: string;
  }
) {
  const res = await fetch(api(`/api/issues/${id}/related-persons`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to add related person');
  return data as IssueTicket;
}

export async function removeRelatedPerson(id: string, relatedPersonId: string) {
  const res = await fetch(api(`/api/issues/${id}/related-persons/${relatedPersonId}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to remove related person');
  return data as IssueTicket;
}

export async function updateIssueTags(id: string, tags: string[]) {
  const res = await fetch(api(`/api/issues/${id}/tags`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ tags }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update tags');
  return data as IssueTicket;
}

export type AutomationMatch = {
  assetCategories?: string[];
  issueTypeIds?: string[];
  priorityIds?: string[];
  locationIds?: (string | { _id: string; name?: string; path?: string })[];
  departmentIds?: (string | { _id: string; name?: string })[];
};

export type AutomationAssign = {
  assigneeUserId: string | { _id: string; name?: string; email?: string };
  assigneeGroupId?: string | { _id: string; name?: string } | null;
  assigneeDepartmentId?: string | { _id: string; name?: string } | null;
};

export type IssueAutomationRule = {
  _id: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  match: AutomationMatch;
  assign: AutomationAssign;
  slaResolutionHours?: number | null;
};

export type EscalationTrigger = {
  kind: 'sla_pct' | 'sla_breached' | 'unresolved_hours';
  slaPct?: number;
  unresolvedHours?: number;
};

export type EscalationActions = {
  notifyAssignee?: boolean;
  notifyUserIds?: (string | { _id: string; name?: string; email?: string })[];
  notifyGroupId?: string | null;
  bumpPriorityId?: string;
  reassign?: {
    assigneeUserId?: string | { _id: string; name?: string; email?: string } | null;
    assigneeGroupId?: string | { _id: string; name?: string } | null;
    assigneeDepartmentId?: string | { _id: string; name?: string } | null;
  };
};

export type IssueEscalationRule = {
  _id: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  match: AutomationMatch;
  /** @deprecated Prefer triggers[] — kept for older rules */
  trigger?: EscalationTrigger;
  triggers?: EscalationTrigger[];
  triggerLogic?: 'and' | 'or';
  actions: EscalationActions;
  cooldownMinutes?: number;
};

export type AutomationBundle = {
  automationRules: IssueAutomationRule[];
  escalationRules: IssueEscalationRule[];
  options: {
    issueTypes: { id: string; name: string }[];
    priorities: { id: string; name: string; color?: string }[];
    locations: { _id: string; name: string; path?: string }[];
    assetCategories: string[];
  };
};

export async function fetchAutomation() {
  const res = await fetch(api('/api/issues/automation'), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load automation');
  return data as AutomationBundle;
}

export async function createAutomationRule(body: Record<string, unknown>) {
  const res = await fetch(api('/api/issues/automation/rules'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create rule');
  return data as { rule: IssueAutomationRule; automationRules: IssueAutomationRule[] };
}

export async function updateAutomationRule(id: string, body: Record<string, unknown>) {
  const res = await fetch(api(`/api/issues/automation/rules/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update rule');
  return data as { rule: IssueAutomationRule; automationRules: IssueAutomationRule[] };
}

export async function deleteAutomationRule(id: string) {
  const res = await fetch(api(`/api/issues/automation/rules/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || 'Failed to delete rule');
  return data as { automationRules: IssueAutomationRule[] };
}

export async function createEscalationRule(body: Record<string, unknown>) {
  const res = await fetch(api('/api/issues/escalation/rules'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create escalation rule');
  return data as { rule: IssueEscalationRule; escalationRules: IssueEscalationRule[] };
}

export async function updateEscalationRule(id: string, body: Record<string, unknown>) {
  const res = await fetch(api(`/api/issues/escalation/rules/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update escalation rule');
  return data as { rule: IssueEscalationRule; escalationRules: IssueEscalationRule[] };
}

export async function deleteEscalationRule(id: string) {
  const res = await fetch(api(`/api/issues/escalation/rules/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || 'Failed to delete escalation rule');
  }
  return data as { escalationRules: IssueEscalationRule[] };
}

export async function runEscalationCheck() {
  const res = await fetch(api('/api/issues/escalation/run'), {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to run escalation check');
  return data as { checked: number; fired: number };
}

export function statusLabel(config: IssueOrgConfig | null | undefined, statusId: string) {
  return config?.statuses?.find((s) => s.id === statusId)?.name || statusId.replace(/_/g, ' ');
}

export function optionColor(config: IssueOrgConfig | null | undefined, kind: 'statuses' | 'priorities', id: string) {
  const list = config?.[kind] || [];
  return list.find((s) => s.id === id)?.color || '#6b7280';
}
