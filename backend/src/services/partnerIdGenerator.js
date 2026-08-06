import BusinessPartner from '../models/BusinessPartner.js';
import { getBusinessPartnerOrgConfig } from './businessPartnerOrgConfigService.js';

const CODE_PAD = 3;

async function resolvePrefix(organizationId, override) {
  if (override) return override;
  try {
    const config = await getBusinessPartnerOrgConfig(organizationId);
    return config?.settings?.partnerCodePrefix || 'BP';
  } catch {
    return 'BP';
  }
}

/**
 * Generate a unique partner code per organization, e.g. BP-001.
 * Existing migrated vendor codes (VEN-001) are left untouched.
 */
export async function generatePartnerCode(organizationId, prefixOverride = null) {
  const raw = await resolvePrefix(organizationId, prefixOverride);
  const prefix = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BP';

  const existing = await BusinessPartner.find({
    organizationId,
    partnerCode: new RegExp(`^${prefix}-\\d+$`),
  })
    .select('partnerCode')
    .lean();

  let highest = 0;
  for (const partner of existing) {
    const match = String(partner.partnerCode).match(/-(\d+)$/);
    if (match) highest = Math.max(highest, parseInt(match[1], 10));
  }

  let next = highest + 1;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = `${prefix}-${String(next).padStart(CODE_PAD, '0')}`;
    const taken = await BusinessPartner.exists({ organizationId, partnerCode: code });
    if (!taken) return code;
    next += 1;
  }

  return `${prefix}-${Date.now()}`;
}
