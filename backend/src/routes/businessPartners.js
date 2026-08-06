import express from 'express';
import { protect } from '../middleware/auth.js';
import { canRead, canWrite } from '../services/permissions.js';
import { Asset, Invoice, Procurement } from '../models/index.js';
import BusinessPartner from '../models/BusinessPartner.js';
import BusinessPartnerDashboard from '../models/BusinessPartnerDashboard.js';
import PartnerContract from '../models/PartnerContract.js';
import PartnerDocument from '../models/PartnerDocument.js';
import PartnerLink from '../models/PartnerLink.js';
import PartnerActivity from '../models/PartnerActivity.js';
import { getDefaultPartnerDashboardLayout } from '../constants/businessPartnerDefaults.js';
import {
  getBusinessPartnerOrgConfig,
  updateBusinessPartnerOrgConfig,
  validatePartnerCustomFields,
} from '../services/businessPartnerOrgConfigService.js';
import { generatePartnerCode } from '../services/partnerIdGenerator.js';
import {
  recordPartnerActivity,
  listPartnerActivities,
  listOrgPartnerActivities,
} from '../services/partnerActivityService.js';
import {
  diffPartnerFields,
  enrichPartnerStats,
  formatPartnerFieldChangesSummary,
  partnerActivityDetails,
  partnerLinkQuery,
} from '../services/businessPartnerService.js';
import { computePartnerPerformance } from '../services/partnerPerformanceService.js';
import { getPartnerDashboardSummary } from '../services/partnerDashboardService.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../services/auditService.js';

const router = express.Router();

router.use(protect);

/** New tab key with a bridge to the legacy `vendors` grant. */
function requirePartnerRead(req, res, next) {
  if (!canRead(req.user, 'businessPartners', req) && !canRead(req.user, 'vendors', req)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

function requirePartnerWrite(req, res, next) {
  if (!canWrite(req.user, 'businessPartners', req) && !canWrite(req.user, 'vendors', req)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

const PARTNER_WRITABLE_FIELDS = [
  'name',
  'partnerTypeKey',
  'categoryKey',
  'status',
  'email',
  'phone',
  'website',
  'taxId',
  'notes',
  'paymentTerms',
  'creditLimit',
  'currency',
  'registrationDetails',
  'businessDetails',
  'bankDetails',
  'taxDetails',
  'primaryContact',
  'tags',
  'customFields',
  'averageRating',
];

function pickPartnerFields(body = {}) {
  const payload = {};
  for (const field of PARTNER_WRITABLE_FIELDS) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  // Legacy vendor payload shape
  if (payload.categoryKey === undefined && body.category !== undefined) {
    payload.categoryKey = String(body.category).toLowerCase();
  }
  if (payload.primaryContact === undefined && body.contactPerson !== undefined) {
    payload.primaryContact = { name: body.contactPerson, email: body.email, phone: body.phone };
  }
  return payload;
}

/** Adds the legacy vendor keys the current frontend still reads. */
function withLegacyShape(partner) {
  return {
    ...partner,
    vendorId: partner.partnerCode,
    category: partner.categoryKey,
    contactPerson:
      partner.primaryContact?.name || partner.contacts?.find((c) => c.isPrimary)?.name || '',
  };
}

function audit(req, action, resource, resourceId, options = {}) {
  return logAudit(req.user._id, action, resource, resourceId, {
    severity: 'low',
    ...options,
    ...getRequestMetadata(req),
  });
}

async function loadPartner(req) {
  return BusinessPartner.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });
}

function canAccessDashboard(dashboard, user) {
  if (!dashboard) return false;
  if (String(dashboard.organizationId) !== String(user.organizationId)) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (dashboard.scope === 'organization') {
    if (!dashboard.allowedRoleIds?.length) return true;
    const roleId = user.customRoleId ? String(user.customRoleId) : null;
    return roleId && dashboard.allowedRoleIds.some((id) => String(id) === roleId);
  }
  return dashboard.ownerId && String(dashboard.ownerId) === String(user._id);
}

/* ------------------------------------------------------------------ config */

router.get('/config', requirePartnerRead, async (req, res) => {
  try {
    const config = await getBusinessPartnerOrgConfig(req.user.organizationId);
    res.json({ config });
  } catch (error) {
    console.error('Get partner config error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/config', requirePartnerWrite, async (req, res) => {
  try {
    const config = await updateBusinessPartnerOrgConfig(
      req.user.organizationId,
      req.user._id,
      req.body || {}
    );
    await audit(req, AUDIT_ACTIONS.BUSINESS_PARTNER_CONFIG_UPDATED, AUDIT_RESOURCES.BUSINESS_PARTNER, config._id, {
      resourceName: 'Business partner settings',
      description: 'Updated business partner configuration',
      details: { keys: Object.keys(req.body || {}) },
    });
    res.json({ config });
  } catch (error) {
    console.error('Update partner config error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* --------------------------------------------------------------- dashboard */

router.get('/activity', requirePartnerRead, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 250);
    const activities = await listOrgPartnerActivities(req.user.organizationId, limit);
    res.json({ activities });
  } catch (error) {
    console.error('List partner activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/summary', requirePartnerRead, async (req, res) => {
  try {
    const summary = await getPartnerDashboardSummary(req.user.organizationId);
    res.json(summary);
  } catch (error) {
    console.error('Partner summary error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/dashboards', requirePartnerRead, async (req, res) => {
  try {
    const dashboards = await BusinessPartnerDashboard.find({
      organizationId: req.user.organizationId,
      $or: [{ scope: 'organization' }, { scope: 'personal', ownerId: req.user._id }],
    })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ dashboards: dashboards.filter((d) => canAccessDashboard(d, req.user)) });
  } catch (error) {
    console.error('List partner dashboards error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/dashboards', requirePartnerRead, async (req, res) => {
  try {
    const { name, description, scope, layout, autoRefresh, allowedRoleIds } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const dashboard = await BusinessPartnerDashboard.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      description: description || '',
      scope: scope === 'organization' ? 'organization' : 'personal',
      ownerId: req.user._id,
      layout: layout || getDefaultPartnerDashboardLayout(),
      autoRefresh: autoRefresh || 'manual',
      allowedRoleIds: allowedRoleIds || [],
    });
    res.status(201).json({ dashboard });
  } catch (error) {
    console.error('Create partner dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/dashboards/:dashboardId', requirePartnerRead, async (req, res) => {
  try {
    const dashboard = await BusinessPartnerDashboard.findById(req.params.dashboardId).lean();
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    res.json({ dashboard });
  } catch (error) {
    console.error('Get partner dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/dashboards/:dashboardId', requirePartnerRead, async (req, res) => {
  try {
    const dashboard = await BusinessPartnerDashboard.findById(req.params.dashboardId);
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    const { name, description, layout, autoRefresh, allowedRoleIds, scope } = req.body || {};
    if (name != null) dashboard.name = String(name).trim();
    if (description != null) dashboard.description = description;
    if (layout != null) dashboard.layout = layout;
    if (autoRefresh != null) dashboard.autoRefresh = autoRefresh;
    if (allowedRoleIds != null) dashboard.allowedRoleIds = allowedRoleIds;
    if (
      scope != null &&
      (['admin', 'super_admin'].includes(req.user.role) ||
        String(dashboard.ownerId) === String(req.user._id))
    ) {
      dashboard.scope = scope === 'organization' ? 'organization' : 'personal';
    }
    await dashboard.save();
    res.json({ dashboard });
  } catch (error) {
    console.error('Update partner dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/dashboards/:dashboardId', requirePartnerRead, async (req, res) => {
  try {
    const dashboard = await BusinessPartnerDashboard.findById(req.params.dashboardId);
    if (!canAccessDashboard(dashboard, req.user)) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }
    if (dashboard.scope === 'organization' && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only admins can delete organization dashboards' });
    }
    await dashboard.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete partner dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* -------------------------------------------------- module-level sub-lists */

router.get('/contracts', requirePartnerRead, async (req, res) => {
  try {
    const query = { organizationId: req.user.organizationId };
    if (req.query.status) query.status = req.query.status;
    if (req.query.partnerId) query.partnerId = req.query.partnerId;
    if (req.query.expiringInDays) {
      const days = Number(req.query.expiringInDays) || 30;
      query.endDate = { $gte: new Date(), $lte: new Date(Date.now() + days * 86400000) };
    }
    const contracts = await PartnerContract.find(query)
      .populate('partnerId', 'name partnerCode')
      .sort({ endDate: 1 })
      .lean();
    res.json({ contracts });
  } catch (error) {
    console.error('List contracts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/documents', requirePartnerRead, async (req, res) => {
  try {
    const query = { organizationId: req.user.organizationId };
    if (req.query.category) query.category = req.query.category;
    if (req.query.partnerId) query.partnerId = req.query.partnerId;
    const documents = await PartnerDocument.find(query)
      .populate('partnerId', 'name partnerCode')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ documents });
  } catch (error) {
    console.error('List partner documents error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/contacts', requirePartnerRead, async (req, res) => {
  try {
    const partners = await BusinessPartner.find({ organizationId: req.user.organizationId })
      .select('name partnerCode contacts primaryContact status partnerTypeKey')
      .lean();
    const contacts = [];
    for (const p of partners) {
      for (const c of p.contacts || []) {
        contacts.push({
          ...c,
          partnerId: p._id,
          partnerName: p.name,
          partnerCode: p.partnerCode,
        });
      }
      if ((!p.contacts || !p.contacts.length) && p.primaryContact?.name) {
        contacts.push({
          ...p.primaryContact,
          isPrimary: true,
          partnerId: p._id,
          partnerName: p.name,
          partnerCode: p.partnerCode,
        });
      }
    }
    res.json({ contacts });
  } catch (error) {
    console.error('List partner contacts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/links', requirePartnerRead, async (req, res) => {
  try {
    const query = { organizationId: req.user.organizationId };
    if (req.query.resourceType) query.resourceType = req.query.resourceType;
    if (req.query.relationshipTypeKey) query.relationshipTypeKey = req.query.relationshipTypeKey;
    if (req.query.partnerId) query.partnerId = req.query.partnerId;
    if (req.query.resourceId) query.resourceId = req.query.resourceId;
    const links = await PartnerLink.find(query)
      .populate('partnerId', 'name partnerCode')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ links });
  } catch (error) {
    console.error('List partner links error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ------------------------------------------------------------- partner CRUD */

router.get('/', requirePartnerRead, async (req, res) => {
  try {
    const { status, category, partnerType, search, tag } = req.query;
    const query = { organizationId: req.user.organizationId };

    if (status) query.status = status;
    if (category) query.categoryKey = category;
    if (partnerType) query.partnerTypeKey = partnerType;
    if (tag) query.tags = tag;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { partnerCode: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const partners = await BusinessPartner.find(query)
      .populate('createdBy', 'name email')
      .sort({ name: 1 })
      .lean();

    const enriched = await Promise.all(
      partners.map(async (partner) => ({
        ...withLegacyShape(partner),
        ...(await enrichPartnerStats(partner, req.user.organizationId)),
      }))
    );

    res.json(enriched);
  } catch (error) {
    console.error('List business partners error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', requirePartnerWrite, async (req, res) => {
  try {
    const payload = pickPartnerFields(req.body);
    if (!payload.name?.trim()) return res.status(400).json({ message: 'Name is required' });

    const config = await getBusinessPartnerOrgConfig(req.user.organizationId);
    const errors = validatePartnerCustomFields(config, payload.customFields || {});
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });

    const partnerCode = req.body.partnerCode?.trim() || (await generatePartnerCode(req.user.organizationId));

    const partner = await BusinessPartner.create({
      ...payload,
      partnerCode,
      currency: payload.currency || config.settings?.defaultCurrency || 'INR',
      paymentTerms: payload.paymentTerms || config.settings?.defaultPaymentTerms || 'Net 30',
      contacts: Array.isArray(req.body.contacts) ? req.body.contacts : [],
      addresses: Array.isArray(req.body.addresses) ? req.body.addresses : [],
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });

    await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'created',
      summary: `Partner ${partner.name} created`,
      details: partnerActivityDetails(req, partner, { partnerCode: partner.partnerCode }),
    });

    const initialNote = String(payload.notes || req.body.initialNote || '').trim();
    if (initialNote) {
      await recordPartnerActivity({
        organizationId: req.user.organizationId,
        partnerId: partner._id,
        userId: req.user._id,
        type: 'note',
        summary: `${partner.name}: note added — ${initialNote.slice(0, 160)}`,
        details: partnerActivityDetails(req, partner, { text: initialNote }),
      });
    }

    // Ensure primary contact lands in contacts[] when only contactPerson / primaryContact sent
    if ((!partner.contacts || partner.contacts.length === 0) && partner.primaryContact?.name) {
      const pc = partner.primaryContact.toObject ? partner.primaryContact.toObject() : { ...partner.primaryContact };
      partner.contacts = [{ ...pc, isPrimary: true }];
      await partner.save();
    }

    const fresh = await BusinessPartner.findById(partner._id).lean();

    await audit(req, AUDIT_ACTIONS.BUSINESS_PARTNER_CREATED, AUDIT_RESOURCES.BUSINESS_PARTNER, partner._id, {
      resourceName: `${partner.partnerCode} - ${partner.name}`,
      description: `Created business partner: ${partner.name}`,
      details: {
        partnerCode: partner.partnerCode,
        partnerTypeKey: partner.partnerTypeKey,
        status: partner.status,
      },
    });

    res.status(201).json({
      message: 'Business partner created successfully',
      partner: withLegacyShape(fresh || partner.toObject()),
      vendor: withLegacyShape(fresh || partner.toObject()),
    });
  } catch (error) {
    console.error('Create business partner error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Partner code already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', requirePartnerRead, async (req, res) => {
  try {
    const partner = await BusinessPartner.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
      .populate('createdBy', 'name email')
      .lean();

    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const linkQuery = partnerLinkQuery(partner._id, req.user.organizationId);
    const [assets, invoices, procurements, contracts, documents, links, activities, stats] =
      await Promise.all([
        Asset.find(linkQuery)
          .populate('locationId', 'name path')
          .populate('departmentId', 'name')
          .select('assetId name cost category status purchaseDate')
          .sort({ purchaseDate: -1 })
          .lean(),
        Invoice.find(linkQuery).sort({ purchaseDate: -1 }).lean(),
        Procurement.find(linkQuery).sort({ purchaseDate: -1 }).lean(),
        PartnerContract.find({ partnerId: partner._id, organizationId: req.user.organizationId })
          .sort({ endDate: 1 })
          .lean(),
        PartnerDocument.find({ partnerId: partner._id, organizationId: req.user.organizationId })
          .sort({ createdAt: -1 })
          .lean(),
        PartnerLink.find({ partnerId: partner._id, organizationId: req.user.organizationId })
          .sort({ createdAt: -1 })
          .lean(),
        listPartnerActivities(partner._id, req.user.organizationId),
        enrichPartnerStats(partner, req.user.organizationId),
      ]);

    const shaped = withLegacyShape(partner);

    res.json({
      partner: shaped,
      vendor: shaped,
      assets,
      invoices,
      procurements,
      contracts,
      documents,
      links,
      activities,
      stats: {
        ...stats,
        totalAssets: stats.assetCount,
        totalInvoices: stats.invoiceCount,
      },
    });
  } catch (error) {
    console.error('Get business partner error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const payload = pickPartnerFields(req.body);
    if (payload.customFields) {
      const config = await getBusinessPartnerOrgConfig(req.user.organizationId);
      const errors = validatePartnerCustomFields(config, payload.customFields);
      if (errors.length) return res.status(400).json({ message: errors.join(', ') });
    }

    const changes = diffPartnerFields(partner.toObject(), payload);
    partner.set(payload);
    await partner.save();

    let activity = null;
    if (changes.length) {
      activity = await recordPartnerActivity({
        organizationId: req.user.organizationId,
        partnerId: partner._id,
        userId: req.user._id,
        type: 'updated',
        summary: formatPartnerFieldChangesSummary(partner.name, changes),
        details: partnerActivityDetails(req, partner, { changes }),
      });
    }

    await audit(req, AUDIT_ACTIONS.BUSINESS_PARTNER_UPDATED, AUDIT_RESOURCES.BUSINESS_PARTNER, partner._id, {
      resourceName: `${partner.partnerCode} - ${partner.name}`,
      description: `Updated business partner: ${partner.name}`,
      details: { changes },
    });

    res.json({
      message: 'Business partner updated successfully',
      partner,
      vendor: partner,
      activity,
    });
  } catch (error) {
    console.error('Update business partner error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const linkQuery = partnerLinkQuery(partner._id, req.user.organizationId);
    const assetCount = await Asset.countDocuments(linkQuery);
    if (assetCount > 0) {
      return res.status(400).json({
        message: `Cannot delete partner. ${assetCount} asset(s) are associated with this partner. Please reassign or remove the assets first.`,
      });
    }

    await partner.deleteOne();
    await Promise.all([
      Invoice.deleteMany(linkQuery),
      PartnerContract.deleteMany({ partnerId: partner._id, organizationId: req.user.organizationId }),
      PartnerDocument.deleteMany({ partnerId: partner._id, organizationId: req.user.organizationId }),
      PartnerLink.deleteMany({ partnerId: partner._id, organizationId: req.user.organizationId }),
      PartnerActivity.deleteMany({ partnerId: partner._id, organizationId: req.user.organizationId }),
    ]);

    await audit(req, AUDIT_ACTIONS.BUSINESS_PARTNER_DELETED, AUDIT_RESOURCES.BUSINESS_PARTNER, partner._id, {
      resourceName: `${partner.partnerCode} - ${partner.name}`,
      description: `Deleted business partner: ${partner.name}`,
      details: { partnerCode: partner.partnerCode, name: partner.name },
      severity: 'medium',
    });

    res.json({ message: 'Business partner deleted successfully' });
  } catch (error) {
    console.error('Delete business partner error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* --------------------------------------------------------- notes and tags */

router.post('/:id/notes', requirePartnerWrite, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Note text is required' });

    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'note',
      summary: `${partner.name}: note added — ${text.slice(0, 160)}`,
      details: partnerActivityDetails(req, partner, { text }),
    });

    res.status(201).json({ activity });
  } catch (error) {
    console.error('Add partner note error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/tags', requirePartnerWrite, async (req, res) => {
  try {
    const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((t) => String(t).trim()).filter(Boolean) : null;
    if (!tags) return res.status(400).json({ message: 'tags must be an array' });

    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const previousTags = [...(partner.tags || [])];
    partner.tags = [...new Set(tags)];
    await partner.save();

    const from = previousTags.join(', ') || '(empty)';
    const to = partner.tags.join(', ') || '(empty)';
    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'tag',
      summary: formatPartnerFieldChangesSummary(partner.name, [{ label: 'Tags', from, to }]),
      details: partnerActivityDetails(req, partner, {
        changes: [{ field: 'tags', label: 'Tags', from, to }],
        tags: partner.tags,
      }),
    });

    res.json({ partner, activity });
  } catch (error) {
    console.error('Update partner tags error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ------------------------------------------------------------ contacts */

router.post('/:id/contacts', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });
    if (!req.body?.name?.trim()) return res.status(400).json({ message: 'Contact name is required' });

    partner.contacts.push(req.body);
    const contact = partner.contacts[partner.contacts.length - 1];
    if (contact.isPrimary) {
      partner.contacts.forEach((c) => {
        if (String(c._id) !== String(contact._id)) c.isPrimary = false;
      });
      partner.primaryContact = {
        name: contact.name,
        role: contact.role,
        department: contact.department,
        email: contact.email,
        phone: contact.phone,
        mobile: contact.mobile,
        whatsapp: contact.whatsapp,
        notes: contact.notes,
      };
    }
    await partner.save();

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'contact',
      summary: `${partner.name}: contact ${contact.name} added`,
      details: partnerActivityDetails(req, partner, {
        changes: [{ field: 'contacts', label: 'Contact', from: '(empty)', to: contact.name }],
        contactId: String(contact._id),
      }),
    });

    res.status(201).json({ contact, partner, activity });
  } catch (error) {
    console.error('Add partner contact error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/contacts/:contactId', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const contact = partner.contacts.id(req.params.contactId);
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    contact.set(req.body || {});
    if (contact.isPrimary) {
      partner.contacts.forEach((c) => {
        if (String(c._id) !== String(contact._id)) c.isPrimary = false;
      });
    }
    await partner.save();

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'contact',
      summary: `${partner.name}: contact ${contact.name} updated`,
      details: partnerActivityDetails(req, partner, {
        changes: [{ field: 'contacts', label: 'Contact', from: contact.name, to: contact.name }],
        contactId: String(contact._id),
      }),
    });

    res.json({ contact, partner, activity });
  } catch (error) {
    console.error('Update partner contact error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/contacts/:contactId', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const contact = partner.contacts.id(req.params.contactId);
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    contact.deleteOne();
    await partner.save();

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'contact',
      summary: `${partner.name}: contact ${contact.name} removed`,
      details: partnerActivityDetails(req, partner, {
        changes: [{ field: 'contacts', label: 'Contact', from: contact.name, to: '(empty)' }],
        contactId: String(contact._id),
      }),
    });

    res.json({ message: 'Contact removed', partner, activity });
  } catch (error) {
    console.error('Delete partner contact error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ----------------------------------------------------------- addresses */

router.post('/:id/addresses', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    partner.addresses.push(req.body || {});
    const address = partner.addresses[partner.addresses.length - 1];
    if (address.isPrimary) {
      partner.addresses.forEach((a) => {
        if (String(a._id) !== String(address._id)) a.isPrimary = false;
      });
    }
    await partner.save();

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'address',
      summary: `${partner.name}: address added (${address.typeKey})`,
      details: partnerActivityDetails(req, partner, {
        changes: [
          {
            field: 'addresses',
            label: 'Address',
            from: '(empty)',
            to: [address.label, address.city, address.typeKey].filter(Boolean).join(', ') || address.typeKey,
          },
        ],
        addressId: String(address._id),
      }),
    });

    res.status(201).json({ address, partner, activity });
  } catch (error) {
    console.error('Add partner address error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/addresses/:addressId', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const address = partner.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ message: 'Address not found' });

    address.set(req.body || {});
    if (address.isPrimary) {
      partner.addresses.forEach((a) => {
        if (String(a._id) !== String(address._id)) a.isPrimary = false;
      });
    }
    await partner.save();

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'address',
      summary: `${partner.name}: address updated (${address.typeKey})`,
      details: partnerActivityDetails(req, partner, {
        changes: [
          {
            field: 'addresses',
            label: 'Address',
            from: address.typeKey,
            to: [address.label, address.city, address.typeKey].filter(Boolean).join(', ') || address.typeKey,
          },
        ],
        addressId: String(address._id),
      }),
    });

    res.json({ address, partner, activity });
  } catch (error) {
    console.error('Update partner address error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/addresses/:addressId', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const address = partner.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ message: 'Address not found' });

    address.deleteOne();
    await partner.save();

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'address',
      summary: `${partner.name}: address removed`,
      details: partnerActivityDetails(req, partner, {
        changes: [{ field: 'addresses', label: 'Address', from: req.params.addressId, to: '(empty)' }],
        addressId: req.params.addressId,
      }),
    });

    res.json({ message: 'Address removed', partner, activity });
  } catch (error) {
    console.error('Delete partner address error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ------------------------------------------------------------ contracts */

router.get('/:id/contracts', requirePartnerRead, async (req, res) => {
  try {
    const contracts = await PartnerContract.find({
      partnerId: req.params.id,
      organizationId: req.user.organizationId,
    })
      .sort({ endDate: 1 })
      .lean();
    res.json({ contracts });
  } catch (error) {
    console.error('List partner contracts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/contracts', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });
    if (!req.body?.contractNumber?.trim()) {
      return res.status(400).json({ message: 'Contract number is required' });
    }

    const contract = await PartnerContract.create({
      ...req.body,
      partnerId: partner._id,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'contract',
      summary: `${partner.name}: contract ${contract.contractNumber || contract.title} added`,
      details: partnerActivityDetails(req, partner, {
        changes: [
          {
            field: 'contracts',
            label: 'Contract',
            from: '(empty)',
            to: contract.contractNumber || contract.title || String(contract._id),
          },
        ],
        contractId: String(contract._id),
      }),
    });

    await audit(req, AUDIT_ACTIONS.PARTNER_CONTRACT_CREATED, AUDIT_RESOURCES.PARTNER_CONTRACT, contract._id, {
      resourceName: contract.contractNumber,
      description: `Created contract ${contract.contractNumber} for ${partner.name}`,
      details: { partnerId: String(partner._id) },
    });

    res.status(201).json({ contract, activity });
  } catch (error) {
    console.error('Create partner contract error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/contracts/:contractId', requirePartnerWrite, async (req, res) => {
  try {
    const contract = await PartnerContract.findOneAndUpdate(
      {
        _id: req.params.contractId,
        partnerId: req.params.id,
        organizationId: req.user.organizationId,
      },
      { ...req.body, partnerId: req.params.id },
      { new: true, runValidators: true }
    );
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    await audit(req, AUDIT_ACTIONS.PARTNER_CONTRACT_UPDATED, AUDIT_RESOURCES.PARTNER_CONTRACT, contract._id, {
      resourceName: contract.contractNumber,
      description: `Updated contract ${contract.contractNumber}`,
      details: { partnerId: req.params.id },
    });

    res.json({ contract });
  } catch (error) {
    console.error('Update partner contract error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/contracts/:contractId', requirePartnerWrite, async (req, res) => {
  try {
    const contract = await PartnerContract.findOneAndDelete({
      _id: req.params.contractId,
      partnerId: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    await audit(req, AUDIT_ACTIONS.PARTNER_CONTRACT_DELETED, AUDIT_RESOURCES.PARTNER_CONTRACT, contract._id, {
      resourceName: contract.contractNumber,
      description: `Deleted contract ${contract.contractNumber}`,
      details: { partnerId: req.params.id },
      severity: 'medium',
    });

    res.json({ message: 'Contract deleted' });
  } catch (error) {
    console.error('Delete partner contract error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ------------------------------------------------------------ documents */

router.get('/:id/documents', requirePartnerRead, async (req, res) => {
  try {
    const documents = await PartnerDocument.find({
      partnerId: req.params.id,
      organizationId: req.user.organizationId,
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ documents });
  } catch (error) {
    console.error('List partner documents error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/documents', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });
    if (!req.body?.name?.trim() || !req.body?.url?.trim()) {
      return res.status(400).json({ message: 'Document name and url are required' });
    }

    const document = await PartnerDocument.create({
      ...req.body,
      partnerId: partner._id,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });

    await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'document',
      summary: `${partner.name}: document ${document.name} uploaded`,
      details: partnerActivityDetails(req, partner, {
        changes: [{ field: 'documents', label: 'Document', from: '(empty)', to: document.name }],
        documentId: String(document._id),
      }),
    });

    await audit(req, AUDIT_ACTIONS.PARTNER_DOCUMENT_CREATED, AUDIT_RESOURCES.PARTNER_DOCUMENT, document._id, {
      resourceName: document.name,
      description: `Added document ${document.name} for ${partner.name}`,
      details: { partnerId: String(partner._id) },
    });

    res.status(201).json({ document });
  } catch (error) {
    console.error('Create partner document error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/documents/:documentId', requirePartnerWrite, async (req, res) => {
  try {
    const document = await PartnerDocument.findOneAndUpdate(
      {
        _id: req.params.documentId,
        partnerId: req.params.id,
        organizationId: req.user.organizationId,
      },
      { ...req.body, partnerId: req.params.id },
      { new: true, runValidators: true }
    );
    if (!document) return res.status(404).json({ message: 'Document not found' });

    await audit(req, AUDIT_ACTIONS.PARTNER_DOCUMENT_UPDATED, AUDIT_RESOURCES.PARTNER_DOCUMENT, document._id, {
      resourceName: document.name,
      description: `Updated document ${document.name}`,
      details: { partnerId: req.params.id },
    });

    res.json({ document });
  } catch (error) {
    console.error('Update partner document error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/documents/:documentId', requirePartnerWrite, async (req, res) => {
  try {
    const document = await PartnerDocument.findOneAndDelete({
      _id: req.params.documentId,
      partnerId: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!document) return res.status(404).json({ message: 'Document not found' });

    await audit(req, AUDIT_ACTIONS.PARTNER_DOCUMENT_DELETED, AUDIT_RESOURCES.PARTNER_DOCUMENT, document._id, {
      resourceName: document.name,
      description: `Deleted document ${document.name}`,
      details: { partnerId: req.params.id },
      severity: 'medium',
    });

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete partner document error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ---------------------------------------------------------------- links */

router.get('/:id/links', requirePartnerRead, async (req, res) => {
  try {
    const query = {
      partnerId: req.params.id,
      organizationId: req.user.organizationId,
    };
    if (req.query.resourceType) query.resourceType = req.query.resourceType;
    const links = await PartnerLink.find(query).sort({ createdAt: -1 }).lean();
    res.json({ links });
  } catch (error) {
    console.error('List partner links error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/links', requirePartnerWrite, async (req, res) => {
  try {
    const partner = await loadPartner(req);
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const { relationshipTypeKey, resourceType, resourceId } = req.body || {};
    if (!relationshipTypeKey || !resourceType || !resourceId) {
      return res
        .status(400)
        .json({ message: 'relationshipTypeKey, resourceType and resourceId are required' });
    }

    const link = await PartnerLink.create({
      ...req.body,
      partnerId: partner._id,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });

    const activity = await recordPartnerActivity({
      organizationId: req.user.organizationId,
      partnerId: partner._id,
      userId: req.user._id,
      type: 'link',
      summary: `${partner.name}: linked ${resourceType} (${relationshipTypeKey})`,
      details: partnerActivityDetails(req, partner, {
        changes: [
          {
            field: 'links',
            label: 'Link',
            from: '(empty)',
            to: `${relationshipTypeKey} → ${resourceType}`,
          },
        ],
        linkId: String(link._id),
        resourceId: String(resourceId),
      }),
    });

    await audit(req, AUDIT_ACTIONS.PARTNER_LINK_CREATED, AUDIT_RESOURCES.BUSINESS_PARTNER, link._id, {
      resourceName: `${partner.name} → ${resourceType}`,
      description: `Linked ${resourceType} to ${partner.name}`,
      details: { relationshipTypeKey, resourceId: String(resourceId) },
    });

    res.status(201).json({ link, activity });
  } catch (error) {
    console.error('Create partner link error:', error);
    if (error.code === 11000) return res.status(400).json({ message: 'Link already exists' });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/links/:linkId', requirePartnerWrite, async (req, res) => {
  try {
    const link = await PartnerLink.findOneAndUpdate(
      {
        _id: req.params.linkId,
        partnerId: req.params.id,
        organizationId: req.user.organizationId,
      },
      { ...req.body, partnerId: req.params.id },
      { new: true, runValidators: true }
    );
    if (!link) return res.status(404).json({ message: 'Link not found' });

    await audit(req, AUDIT_ACTIONS.PARTNER_LINK_UPDATED, AUDIT_RESOURCES.BUSINESS_PARTNER, link._id, {
      resourceName: `${link.resourceType} link`,
      description: `Updated partner link (${link.relationshipTypeKey})`,
      details: { partnerId: req.params.id },
    });

    res.json({ link });
  } catch (error) {
    console.error('Update partner link error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/links/:linkId', requirePartnerWrite, async (req, res) => {
  try {
    const link = await PartnerLink.findOneAndDelete({
      _id: req.params.linkId,
      partnerId: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!link) return res.status(404).json({ message: 'Link not found' });

    await audit(req, AUDIT_ACTIONS.PARTNER_LINK_DELETED, AUDIT_RESOURCES.BUSINESS_PARTNER, link._id, {
      resourceName: `${link.resourceType} link`,
      description: `Removed partner link (${link.relationshipTypeKey})`,
      details: { partnerId: req.params.id },
      severity: 'medium',
    });

    res.json({ message: 'Link removed' });
  } catch (error) {
    console.error('Delete partner link error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ---------------------------------------------------------- performance */

router.get('/:id/performance', requirePartnerRead, async (req, res) => {
  try {
    const partner = await BusinessPartner.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
      .select('_id name partnerCode')
      .lean();
    if (!partner) return res.status(404).json({ message: 'Business partner not found' });

    const config = await getBusinessPartnerOrgConfig(req.user.organizationId);
    const kpis = await computePartnerPerformance(
      partner._id,
      req.user.organizationId,
      config.performanceKpis || []
    );

    res.json({ partnerId: String(partner._id), kpis });
  } catch (error) {
    console.error('Partner performance error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
