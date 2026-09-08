/** Ticket-specific actions granted per OrgRole (alongside tab access). */

export const TICKET_ACTIONS = [
  { key: 'view', label: 'View tickets', description: 'See tickets in the list and detail views' },
  { key: 'create', label: 'Create tickets', description: 'Create new tickets from the dashboard' },
  { key: 'comment', label: 'Comment', description: 'Add public comments on tickets' },
  { key: 'internal_note', label: 'Add internal notes', description: 'Add staff-only internal notes' },
  { key: 'assign', label: 'Assign / reassign', description: 'Assign department, team, or handler' },
  { key: 'change_priority', label: 'Change priority', description: 'Change ticket priority' },
  { key: 'change_severity', label: 'Change severity', description: 'Change ticket severity' },
  { key: 'change_status', label: 'Change status', description: 'Move tickets along general workflow steps' },
  { key: 'resolve', label: 'Resolve', description: 'Mark tickets as resolved' },
  { key: 'verify', label: 'Verify', description: 'Verify a resolved ticket' },
  { key: 'close', label: 'Close', description: 'Close tickets' },
  { key: 'reopen', label: 'Reopen', description: 'Reopen closed, verified, or resolved tickets' },
  { key: 'escalate', label: 'Escalate', description: 'Manually escalate tickets (reason, reassign, optional priority bump)' },
  { key: 'manage_config', label: 'Manage ticket configuration', description: 'Edit statuses, types, workflow, automation & escalations' },
];

export const TICKET_ACTION_KEYS = TICKET_ACTIONS.map((a) => a.key);

export function emptyTicketActions() {
  return Object.fromEntries(TICKET_ACTION_KEYS.map((k) => [k, false]));
}

export function fullTicketActions() {
  return Object.fromEntries(TICKET_ACTION_KEYS.map((k) => [k, true]));
}

/** View-only defaults when the Issues tab is read-only. */
export function viewOnlyTicketActions() {
  const out = emptyTicketActions();
  out.view = true;
  return out;
}

/**
 * Sanitize ticketActions from a role payload.
 * Unknown keys ignored; values coerced to boolean.
 */
export function sanitizeTicketActions(input) {
  const out = emptyTicketActions();
  if (!input || typeof input !== 'object') return out;
  for (const key of TICKET_ACTION_KEYS) {
    if (input[key] === true || input[key] === false) out[key] = Boolean(input[key]);
  }
  return out;
}

/**
 * Resolve effective ticket actions from stored permissions + Issues tab level.
 * Backward compatible: issues write with no ticketActions → all actions;
 * issues read with no ticketActions → view only.
 */
export function resolveTicketActions(permissions) {
  if (!permissions || typeof permissions !== 'object') return emptyTicketActions();

  const issuesLevel = permissions.issues;
  const raw = permissions.ticketActions;
  const hasExplicit =
    raw &&
    typeof raw === 'object' &&
    TICKET_ACTION_KEYS.some((k) => typeof raw[k] === 'boolean');

  if (hasExplicit) {
    const actions = sanitizeTicketActions(raw);
    // Issues tab access still gates viewing
    if (issuesLevel !== 'read' && issuesLevel !== 'write') {
      return emptyTicketActions();
    }
    if (issuesLevel === 'read') {
      // Read tab: never grant write-like actions even if misconfigured
      const viewOnly = emptyTicketActions();
      viewOnly.view = actions.view !== false;
      return viewOnly;
    }
    actions.view = true;
    return actions;
  }

  if (issuesLevel === 'write') return fullTicketActions();
  if (issuesLevel === 'read') return viewOnlyTicketActions();
  return emptyTicketActions();
}

export function validateTicketActionsPayload(input) {
  if (input == null) return { ok: true, ticketActions: null };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'ticketActions must be an object' };
  }
  for (const key of Object.keys(input)) {
    if (!TICKET_ACTION_KEYS.includes(key)) {
      return { ok: false, message: `Unknown ticket action: ${key}` };
    }
    if (typeof input[key] !== 'boolean') {
      return { ok: false, message: `ticketActions.${key} must be a boolean` };
    }
  }
  return { ok: true, ticketActions: sanitizeTicketActions(input) };
}

/**
 * Which ticket action is required for a status transition.
 */
export function ticketActionForTransition(fromStatus, toStatus) {
  const from = String(fromStatus || '');
  const to = String(toStatus || '');

  if (to === 'resolved') return 'resolve';
  if (to === 'verified') return 'verify';
  if (to === 'closed') return 'close';

  const closedish = ['closed', 'cancelled', 'resolved', 'verified'];
  const openish = ['new', 'triaged', 'assigned', 'in_progress', 'waiting', 'open'];
  if (closedish.includes(from) && openish.includes(to)) return 'reopen';

  if (to === 'escalated' || to.includes('escalat')) return 'escalate';

  return 'change_status';
}
