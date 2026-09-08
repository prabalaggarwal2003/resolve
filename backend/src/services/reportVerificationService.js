import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import Contact from '../models/Contact.js';

const REPORT_TOKEN_PURPOSE = 'public_report_verified';
const REPORT_TOKEN_EXPIRE = '30m';

export async function orgHasEmployeeRoster(organizationId) {
  // Strict: only an imported CSV/Excel roster enables employee-ID reporting.
  // Manually added employees do not turn on the employee-ID gate.
  const n = await Contact.countDocuments({
    organizationId,
    kind: 'employee',
    source: 'import',
    isActive: true,
    employeeId: { $gt: '' },
  });
  return n > 0;
}

export function maskEmail(email = '') {
  const s = String(email).trim().toLowerCase();
  const [user, domain] = s.split('@');
  if (!user || !domain) return '***';
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

export function signReportVerificationToken(payload) {
  return jwt.sign(
    {
      purpose: REPORT_TOKEN_PURPOSE,
      organizationId: String(payload.organizationId),
      assetId: String(payload.assetId),
      email: String(payload.email).toLowerCase(),
      name: String(payload.name || ''),
      employeeId: payload.employeeId ? String(payload.employeeId) : '',
      contactId: payload.contactId ? String(payload.contactId) : '',
      phone: payload.phone ? String(payload.phone) : '',
    },
    env.jwtSecret,
    { expiresIn: REPORT_TOKEN_EXPIRE }
  );
}

export function verifyReportVerificationToken(token, { assetId, organizationId } = {}) {
  if (!token) {
    const err = new Error('Email verification is required before submitting a report');
    err.status = 401;
    throw err;
  }
  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    const err = new Error('Verification expired or invalid. Please verify your email again.');
    err.status = 401;
    throw err;
  }
  if (decoded.purpose !== REPORT_TOKEN_PURPOSE) {
    const err = new Error('Invalid verification token');
    err.status = 401;
    throw err;
  }
  if (assetId && String(decoded.assetId) !== String(assetId)) {
    const err = new Error('Verification does not match this asset');
    err.status = 401;
    throw err;
  }
  if (organizationId && String(decoded.organizationId) !== String(organizationId)) {
    const err = new Error('Verification does not match this organization');
    err.status = 401;
    throw err;
  }
  return decoded;
}

export async function findActiveEmployee(organizationId, employeeId) {
  const id = String(employeeId || '').trim();
  if (!id) return null;
  return Contact.findOne({
    organizationId,
    kind: 'employee',
    source: 'import',
    isActive: true,
    employeeId: id,
  }).lean();
}
