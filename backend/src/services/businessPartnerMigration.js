import mongoose from 'mongoose';

function slugify(text, fallback = '') {
  const slug = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug || fallback;
}

function toPartnerDoc(vendor) {
  const contactName = String(vendor.contactPerson || '').trim();
  const primaryContact = contactName
    ? {
        name: contactName,
        role: '',
        department: '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        mobile: '',
        whatsapp: '',
        notes: '',
      }
    : {};

  const contacts = contactName
    ? [{ ...primaryContact, isPrimary: true }]
    : [];

  const address = vendor.address || {};
  const hasAddress = Object.values(address).some((v) => v);
  const addresses = hasAddress
    ? [
        {
          typeKey: 'registered',
          label: 'Registered Office',
          street: address.street || '',
          city: address.city || '',
          state: address.state || '',
          zipCode: address.zipCode || '',
          country: address.country || '',
          isPrimary: true,
        },
      ]
    : [];

  return {
    _id: vendor._id,
    partnerCode: vendor.vendorId || `VEN-${String(vendor._id).slice(-6)}`,
    name: vendor.name,
    partnerTypeKey: 'vendor',
    categoryKey: slugify(vendor.category, 'other'),
    status: vendor.status || 'Active',
    email: vendor.email || '',
    phone: vendor.phone || '',
    website: vendor.website || '',
    taxId: vendor.taxId || '',
    notes: vendor.notes || '',
    paymentTerms: vendor.paymentTerms || 'Net 30',
    creditLimit: null,
    currency: 'INR',
    registrationDetails: {},
    businessDetails: {},
    bankDetails: {},
    taxDetails: {},
    primaryContact,
    contacts,
    addresses,
    tags: [],
    customFields: {},
    organizationId: vendor.organizationId,
    createdBy: vendor.createdBy,
    createdAt: vendor.createdAt || new Date(),
    updatedAt: vendor.updatedAt || new Date(),
  };
}

async function copyVendors(db) {
  const collections = await db.listCollections({ name: 'vendors' }).toArray();
  if (!collections.length) return { migrated: 0, skipped: 0 };

  const vendors = await db.collection('vendors').find({}).toArray();
  if (!vendors.length) return { migrated: 0, skipped: 0 };

  const partners = db.collection('businesspartners');
  const existing = await partners
    .find({ _id: { $in: vendors.map((v) => v._id) } })
    .project({ _id: 1 })
    .toArray();
  const existingIds = new Set(existing.map((p) => String(p._id)));

  const pending = vendors.filter((v) => !existingIds.has(String(v._id)));
  if (!pending.length) return { migrated: 0, skipped: vendors.length };

  await partners.insertMany(pending.map(toPartnerDoc), { ordered: false });
  return { migrated: pending.length, skipped: vendors.length - pending.length };
}

async function backfillPartnerIds(db) {
  const counts = {};
  for (const name of ['assets', 'invoices', 'procurements']) {
    const collections = await db.listCollections({ name }).toArray();
    if (!collections.length) {
      counts[name] = 0;
      continue;
    }
    const result = await db.collection(name).updateMany(
      { vendorId: { $exists: true, $ne: null }, partnerId: null },
      [{ $set: { partnerId: '$vendorId' } }]
    );
    counts[name] = result.modifiedCount || 0;
  }
  return counts;
}

/**
 * One-way migration of the legacy `vendors` collection into `businesspartners`,
 * keeping the same _id so existing vendorId references stay valid.
 * Safe to run on every boot.
 */
export async function migrateVendorsToBusinessPartners() {
  const db = mongoose.connection?.db;
  if (!db) return { ok: false, reason: 'no-connection' };

  const copied = await copyVendors(db);
  const backfilled = await backfillPartnerIds(db);

  const totalBackfilled = Object.values(backfilled).reduce((sum, n) => sum + n, 0);
  if (copied.migrated || totalBackfilled) {
    console.log(
      `Business partners migration: ${copied.migrated} vendor(s) migrated, ` +
        `partnerId backfilled on ${backfilled.assets} asset(s), ${backfilled.invoices} invoice(s), ` +
        `${backfilled.procurements} procurement(s)`
    );
  }

  return { ok: true, ...copied, backfilled };
}
