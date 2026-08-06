import { generatePartnerCode } from './partnerIdGenerator.js';

/** Legacy alias — vendor IDs are business partner codes now. */
export async function generateVendorId(organizationId) {
  return generatePartnerCode(organizationId);
}
