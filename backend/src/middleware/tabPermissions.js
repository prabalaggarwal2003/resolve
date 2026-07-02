import { canRead, canWrite } from '../services/permissions.js';

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
