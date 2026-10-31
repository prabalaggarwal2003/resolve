import { canRead, canWrite, canPerformTicketAction } from '../services/permissions.js';

export function requireTabRead(tab) {
  return (req, res, next) => {
    if (!canRead(req.user, tab, req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

export function requireTabWrite(tab) {
  return (req, res, next) => {
    if (!canWrite(req.user, tab, req)) {
      return res.status(403).json({ message: 'Forbidden: you do not have permission to edit' });
    }
    next();
  };
}

/** Require a specific ticket action permission (does not rely on hardcoded role names). */
export function requireTicketAction(action) {
  return (req, res, next) => {
    if (!canPerformTicketAction(req.user, action, req)) {
      return res.status(403).json({
        message: `You do not have permission to ${String(action).replace(/_/g, ' ')} on tickets`,
      });
    }
    next();
  };
}
