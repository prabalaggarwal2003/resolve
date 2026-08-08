import express from 'express';
import mongoose from 'mongoose';
import { Organization, User, Budget, BusinessPartner, BusinessPartnerOrgConfig, Invoice } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { canRead, canWrite } from '../services/permissions.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';
import { buildOrganizationEditChanges } from '../services/organizationLogService.js';

const router = express.Router();

const ADDRESS_TYPES = new Set([
  'head_office',
  'registered',
  'warehouse',
  'branch',
  'billing',
  'shipping',
  'other',
]);

const CUSTOM_FIELD_TYPES = new Set(['text', 'number', 'date', 'select', 'textarea']);

function slugify(text) {
  return (
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) || `field_${Date.now()}`
  );
}

function normalizeContacts(list = []) {
  if (!Array.isArray(list)) return [];
  const contacts = list
    .map((c) => {
      const name = String(c?.name || '').trim();
      if (!name) return null;
      const doc = {
        name,
        role: String(c?.role || '').trim(),
        email: String(c?.email || '').trim().toLowerCase(),
        phone: String(c?.phone || '').trim(),
        isPrimary: Boolean(c?.isPrimary),
      };
      if (c?._id && mongoose.Types.ObjectId.isValid(c._id)) {
        doc._id = c._id;
      }
      return doc;
    })
    .filter(Boolean);

  if (contacts.length && !contacts.some((c) => c.isPrimary)) {
    contacts[0].isPrimary = true;
  }
  if (contacts.filter((c) => c.isPrimary).length > 1) {
    let seen = false;
    for (const c of contacts) {
      if (c.isPrimary && seen) c.isPrimary = false;
      else if (c.isPrimary) seen = true;
    }
  }
  return contacts;
}

function normalizeAddresses(list = [], contacts = []) {
  if (!Array.isArray(list)) return [];
  const contactIds = new Set(contacts.map((c) => String(c._id)));
  const addresses = list
    .map((a) => {
      const typeKey = ADDRESS_TYPES.has(a?.typeKey) ? a.typeKey : 'other';
      const street = String(a?.street || '').trim();
      const city = String(a?.city || '').trim();
      const label = String(a?.label || '').trim();
      if (!street && !city && !label) return null;
      let contactId = null;
      if (a?.contactId && mongoose.Types.ObjectId.isValid(a.contactId) && contactIds.has(String(a.contactId))) {
        contactId = a.contactId;
      }
      const doc = {
        typeKey,
        label,
        street,
        city,
        state: String(a?.state || '').trim(),
        zipCode: String(a?.zipCode || '').trim(),
        country: String(a?.country || '').trim(),
        isPrimary: Boolean(a?.isPrimary),
        contactId,
      };
      if (a?._id && mongoose.Types.ObjectId.isValid(a._id)) {
        doc._id = a._id;
      }
      return doc;
    })
    .filter(Boolean);

  if (addresses.length && !addresses.some((a) => a.isPrimary)) {
    addresses[0].isPrimary = true;
  }
  if (addresses.filter((a) => a.isPrimary).length > 1) {
    let seen = false;
    for (const a of addresses) {
      if (a.isPrimary && seen) a.isPrimary = false;
      else if (a.isPrimary) seen = true;
    }
  }
  return addresses;
}

function normalizeCustomFieldDefinitions(list = []) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list
    .map((f) => {
      const label = String(f?.label || '').trim();
      if (!label) return null;
      const key = slugify(f?.key || label);
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        key,
        label,
        type: CUSTOM_FIELD_TYPES.has(f?.type) ? f.type : 'text',
        required: Boolean(f?.required),
        options: Array.isArray(f?.options) ? f.options.map(String).filter(Boolean) : [],
      };
    })
    .filter(Boolean);
}

function normalizeCustomFields(defs = [], values = {}) {
  const out = {};
  const map = values && typeof values === 'object' ? values : {};
  for (const def of defs) {
    const raw = map[def.key];
    if (raw == null || raw === '') continue;
    out[def.key] = def.type === 'number' ? Number(raw) : String(raw);
  }
  return out;
}

// Get organization details (all authenticated users can access)
router.get('/', protect, async (req, res) => {
  try {
    if (!req.user.organizationId) {
      return res.status(400).json({ message: 'No organization found' });
    }

    const organization = await Organization.findById(req.user.organizationId).lean();
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (canRead(req.user, 'organization', req)) {
      const userCount = await User.countDocuments({ organizationId: req.user.organizationId, isActive: true });
      res.json({
        organization,
        statistics: {
          totalUsers: userCount,
          createdAt: organization.createdAt,
        },
      });
    } else {
      res.json({
        organization: {
          orgId: organization.orgId,
          name: organization.name,
          addresses: organization.addresses || [],
          timezone: organization.timezone,
          currency: organization.currency,
        },
      });
    }
  } catch (err) {
    console.error('Get organization error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update organization details
router.put('/', protect, async (req, res) => {
  try {
    if (!canWrite(req.user, 'organization', req)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.user.organizationId) {
      return res.status(400).json({ message: 'No organization found' });
    }

    const body = req.body || {};
    const updateData = {};

    if (body.name !== undefined) updateData.name = String(body.name || '').trim();
    if (body.industry !== undefined) updateData.industry = body.industry || undefined;
    if (body.companySize !== undefined) updateData.companySize = body.companySize || undefined;
    if (body.country !== undefined) updateData.country = body.country?.trim() || undefined;
    if (body.region !== undefined) updateData.region = body.region?.trim() || undefined;
    if (body.website !== undefined) updateData.website = body.website?.trim() || '';
    if (body.timezone !== undefined) updateData.timezone = body.timezone?.trim() || 'Asia/Kolkata';
    if (body.currency !== undefined) updateData.currency = (body.currency?.trim() || 'INR').toUpperCase();
    if (body.primaryGoal !== undefined) updateData.primaryGoal = body.primaryGoal || undefined;
    if (body.estimatedAssets !== undefined) updateData.estimatedAssets = body.estimatedAssets || undefined;
    if (body.gstin !== undefined) updateData.gstin = body.gstin?.trim().toUpperCase() || undefined;
    if (body.registeredAddress !== undefined) {
      updateData.registeredAddress = body.registeredAddress?.trim() || undefined;
    }

    if (body.contacts !== undefined || body.addresses !== undefined) {
      const contacts = normalizeContacts(body.contacts !== undefined ? body.contacts : undefined);
      // When only addresses sent, keep existing contacts for contactId validation
      const prev = await Organization.findById(req.user.organizationId).select('contacts addresses').lean();
      const nextContacts =
        body.contacts !== undefined ? contacts : normalizeContacts(prev?.contacts || []);
      if (body.contacts !== undefined) updateData.contacts = nextContacts;

      if (body.addresses !== undefined) {
        updateData.addresses = normalizeAddresses(body.addresses, nextContacts);
      }
    }

    if (body.customFieldDefinitions !== undefined) {
      updateData.customFieldDefinitions = normalizeCustomFieldDefinitions(body.customFieldDefinitions);
    }
    if (body.customFields !== undefined || body.customFieldDefinitions !== undefined) {
      const prev = await Organization.findById(req.user.organizationId)
        .select('customFieldDefinitions customFields')
        .lean();
      const defs =
        updateData.customFieldDefinitions ||
        prev?.customFieldDefinitions ||
        [];
      updateData.customFields = normalizeCustomFields(
        defs,
        body.customFields !== undefined ? body.customFields : prev?.customFields || {}
      );
    }

    const prev = await Organization.findById(req.user.organizationId).lean();
    if (!prev) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const pendingEditLog = buildOrganizationEditChanges(prev, updateData);

    const organization = await Organization.findByIdAndUpdate(req.user.organizationId, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Keep budgets / partners in sync when organization currency changes
    if (
      updateData.currency &&
      String(prev.currency || '').toUpperCase() !== String(organization.currency || '').toUpperCase()
    ) {
      const currency = String(organization.currency || 'INR').toUpperCase();
      await Promise.all([
        Budget.updateMany({ organizationId: organization._id }, { $set: { currency } }),
        BusinessPartner.updateMany({ organizationId: organization._id }, { $set: { currency } }),
        Invoice.updateMany({ organizationId: organization._id }, { $set: { currency } }),
        BusinessPartnerOrgConfig.updateOne(
          { organizationId: organization._id },
          { $set: { 'settings.defaultCurrency': currency } }
        ),
      ]);
    }

    if (pendingEditLog?.fieldChanges?.length) {
      await logAudit(req.user._id, AUDIT_ACTIONS.ORG_UPDATED, AUDIT_RESOURCES.ORGANIZATION, organization._id, {
        resourceName: organization.name,
        description: pendingEditLog.summary || `Updated organization "${organization.name}"`,
        details: {
          fieldChanges: pendingEditLog.fieldChanges,
          summary: pendingEditLog.summary || null,
        },
        severity: 'medium',
        ...getRequestMetadata(req),
      });
    }

    res.json({ message: 'Organization updated successfully', organization });
  } catch (err) {
    console.error('Update organization error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
