import { Issue } from '../models/index.js';

/**
 * Generate next ticket ID: ISS-YYYY-NNN (e.g. ISS-2024-001).
 */
export async function generateTicketId() {
  const year = new Date().getFullYear();
  const prefix = `ISS-${year}-`;
  const last = await Issue.findOne({ ticketId: new RegExp(`^${prefix}`) })
    .sort({ ticketId: -1 })
    .select('ticketId')
    .lean();
  let next = 1;
  if (last?.ticketId) {
    const num = parseInt(last.ticketId.slice(prefix.length), 10);
    if (!Number.isNaN(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(3, '0')}`;
}
