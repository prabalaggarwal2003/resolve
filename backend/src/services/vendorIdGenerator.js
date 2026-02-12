import { Vendor } from '../models/index.js';

/**
 * Generate unique vendor ID based on organization
 * Format: VEN-XXX (where XXX is a 3-digit number)
 */
export async function generateVendorId(organizationId) {
  try {
    // Find the latest vendor for this organization
    const latestVendor = await Vendor.findOne({ organizationId })
      .sort({ createdAt: -1 })
      .select('vendorId')
      .lean();

    let nextNumber = 1;

    if (latestVendor && latestVendor.vendorId) {
      // Extract the number from the vendorId (e.g., "VEN-001" -> 1)
      const match = latestVendor.vendorId.match(/VEN-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Format with leading zeros (VEN-001, VEN-002, etc.)
    const vendorId = `VEN-${String(nextNumber).padStart(3, '0')}`;

    // Check if this ID already exists (safety check)
    const existing = await Vendor.findOne({ organizationId, vendorId });
    if (existing) {
      // If somehow it exists, increment and try again
      return generateVendorId(organizationId);
    }

    return vendorId;
  } catch (error) {
    console.error('Error generating vendor ID:', error);
    throw new Error('Failed to generate vendor ID');
  }
}

