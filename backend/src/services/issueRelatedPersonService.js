import { Issue, Contact, Asset, BusinessPartner } from '../models/index.js';
import { recordIssueActivity } from './issueActivityService.js';

function idOf(v) {
  if (!v) return '';
  if (typeof v === 'object' && v._id) return String(v._id);
  return String(v);
}

/**
 * Collect partner IDs linked to an asset (primary + relationships).
 */
export function collectAssetPartnerIds(asset) {
  const ids = new Set();
  if (asset?.partnerId) ids.add(idOf(asset.partnerId));
  for (const rel of asset?.partnerRelationships || []) {
    if (rel?.partnerId) ids.add(idOf(rel.partnerId));
  }
  return [...ids].filter(Boolean);
}

function flattenPartnerContacts(partner) {
  const out = [];
  const partnerId = idOf(partner._id);
  const partnerName = partner.name || '';

  for (const c of partner.contacts || []) {
    out.push({
      key: `partner:${partnerId}:${idOf(c._id)}`,
      kind: 'partnerContact',
      partnerId,
      partnerContactId: idOf(c._id),
      partnerName,
      name: c.name,
      email: c.email || '',
      phone: c.phone || c.mobile || '',
      role: c.role || '',
      company: partnerName,
      source: 'business_partner',
    });
  }

  const pc = partner.primaryContact;
  if (pc?.name) {
    const already = out.some(
      (x) =>
        (pc.email && x.email && x.email.toLowerCase() === String(pc.email).toLowerCase()) ||
        x.name === pc.name
    );
    if (!already) {
      out.push({
        key: `partner:${partnerId}:primary`,
        kind: 'partnerContact',
        partnerId,
        partnerContactId: null,
        partnerName,
        name: pc.name,
        email: pc.email || '',
        phone: pc.phone || pc.mobile || '',
        role: pc.role || 'Primary contact',
        company: partnerName,
        source: 'business_partner',
        isPrimary: true,
      });
    }
  }

  return out;
}

/**
 * Options for tagging related people on a ticket: org contacts + asset partner contacts.
 */
export async function listRelatedPersonOptions(issue) {
  const orgId = issue.organizationId?.toString();
  const assetId = idOf(issue.assetId);

  const [contacts, asset] = await Promise.all([
    Contact.find({ organizationId: orgId, isActive: true })
      .select('_id name email phone company role')
      .sort({ name: 1 })
      .lean(),
    assetId
      ? Asset.findById(assetId)
          .select('partnerId partnerRelationships')
          .lean()
      : null,
  ]);

  const partnerIds = collectAssetPartnerIds(asset);
  let partners = [];
  if (partnerIds.length) {
    partners = await BusinessPartner.find({
      _id: { $in: partnerIds },
      organizationId: orgId,
    })
      .select('name contacts primaryContact')
      .lean();
  }

  const partnerContacts = partners.flatMap(flattenPartnerContacts);

  return {
    contacts: contacts.map((c) => ({
      key: `contact:${c._id}`,
      kind: 'contact',
      contactId: String(c._id),
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      role: c.role || '',
      company: c.company || '',
      source: 'org_contact',
    })),
    partnerContacts,
    partners: partners.map((p) => ({ _id: p._id, name: p.name })),
  };
}

async function reloadIssue(issueId) {
  return Issue.findById(issueId)
    .populate({
      path: 'assetId',
      select: 'name assetId category locationId assignedTo departmentId status partnerId partnerRelationships',
      populate: [
        { path: 'assignedTo', select: 'name email' },
        { path: 'partnerId', select: 'name partnerCode' },
        { path: 'partnerRelationships.partnerId', select: 'name partnerCode' },
      ],
    })
    .populate('assignedTo', 'name email role')
    .populate('assigneeUserId', 'name email role')
    .populate('assigneeContactId', 'name email phone company role')
    .populate('assigneeGroupId', 'name description')
      .populate({
        path: 'assigneeDepartmentId',
        select: 'name locationId',
        populate: { path: 'locationId', select: 'name path type' },
      })
    .populate('relatedPersons.contactId', 'name email phone company role')
    .populate('relatedPersons.partnerId', 'name partnerCode')
    .populate('relatedPersons.addedBy', 'name email')
    .populate('resolution.resolvedBy', 'name email')
    .populate('verification.verifiedBy', 'name email')
    .populate('resolvedBy', 'name email')
    .populate('locationId', 'name path')
    .lean();
}

/**
 * Add a related contact person to a ticket.
 */
export async function addRelatedPerson({ issue, user, payload }) {
  const orgId = issue.organizationId?.toString();
  const relation = String(payload.relation || '').trim();
  if (!relation) {
    const err = new Error('Relation description is required');
    err.status = 400;
    throw err;
  }

  let entry = {
    kind: payload.kind,
    relation,
    addedBy: user._id,
    addedAt: new Date(),
    name: '',
    email: '',
    phone: '',
    role: '',
    company: '',
  };

  if (payload.kind === 'contact') {
    const contactId = payload.contactId;
    if (!contactId) {
      const err = new Error('contactId is required');
      err.status = 400;
      throw err;
    }
    const c = await Contact.findOne({ _id: contactId, organizationId: orgId, isActive: true }).lean();
    if (!c) {
      const err = new Error('Contact not found');
      err.status = 404;
      throw err;
    }
    const dup = (issue.relatedPersons || []).some(
      (r) => r.kind === 'contact' && idOf(r.contactId) === String(c._id)
    );
    if (dup) {
      const err = new Error('This contact is already linked to the ticket');
      err.status = 400;
      throw err;
    }
    entry = {
      ...entry,
      contactId: c._id,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      role: c.role || '',
      company: c.company || '',
    };
  } else if (payload.kind === 'partnerContact') {
    const partnerId = payload.partnerId;
    if (!partnerId) {
      const err = new Error('partnerId is required');
      err.status = 400;
      throw err;
    }
    const partner = await BusinessPartner.findOne({ _id: partnerId, organizationId: orgId }).lean();
    if (!partner) {
      const err = new Error('Business partner not found');
      err.status = 404;
      throw err;
    }

    let name = '';
    let email = '';
    let phone = '';
    let role = '';
    let partnerContactId = payload.partnerContactId || null;

    if (partnerContactId) {
      const c = (partner.contacts || []).find((x) => idOf(x._id) === String(partnerContactId));
      if (!c) {
        const err = new Error('Partner contact not found');
        err.status = 404;
        throw err;
      }
      name = c.name;
      email = c.email || '';
      phone = c.phone || c.mobile || '';
      role = c.role || '';
    } else if (payload.usePrimary || payload.isPrimary) {
      const pc = partner.primaryContact;
      if (!pc?.name) {
        const err = new Error('Partner has no primary contact');
        err.status = 404;
        throw err;
      }
      name = pc.name;
      email = pc.email || '';
      phone = pc.phone || pc.mobile || '';
      role = pc.role || 'Primary contact';
      partnerContactId = null;
    } else if (payload.name) {
      name = String(payload.name).trim();
      email = String(payload.email || '').trim();
      phone = String(payload.phone || '').trim();
      role = String(payload.role || '').trim();
    } else {
      const err = new Error('partnerContactId or usePrimary is required');
      err.status = 400;
      throw err;
    }

    const dup = (issue.relatedPersons || []).some((r) => {
      if (r.kind !== 'partnerContact' || idOf(r.partnerId) !== String(partnerId)) return false;
      if (partnerContactId) return idOf(r.partnerContactId) === String(partnerContactId);
      return !r.partnerContactId && r.name === name;
    });
    if (dup) {
      const err = new Error('This partner contact is already linked to the ticket');
      err.status = 400;
      throw err;
    }

    entry = {
      ...entry,
      partnerId: partner._id,
      partnerContactId: partnerContactId || undefined,
      name,
      email,
      phone,
      role,
      company: partner.name || '',
    };
  } else {
    const err = new Error('kind must be contact or partnerContact');
    err.status = 400;
    throw err;
  }

  await Issue.updateOne({ _id: issue._id }, { $push: { relatedPersons: entry } });

  await recordIssueActivity({
    issueId: issue._id,
    organizationId: issue.organizationId,
    type: 'field_updated',
    actorUserId: user._id,
    actorName: user.name || '',
    to: entry.name,
    reason: entry.relation,
    meta: { fields: ['relatedPersons'], action: 'added', kind: entry.kind },
  });

  return reloadIssue(issue._id);
}

export async function removeRelatedPerson({ issue, user, relatedPersonId }) {
  const existing = (issue.relatedPersons || []).find((r) => idOf(r._id) === String(relatedPersonId));
  if (!existing) {
    const err = new Error('Related person not found');
    err.status = 404;
    throw err;
  }

  await Issue.updateOne({ _id: issue._id }, { $pull: { relatedPersons: { _id: relatedPersonId } } });

  await recordIssueActivity({
    issueId: issue._id,
    organizationId: issue.organizationId,
    type: 'field_updated',
    actorUserId: user._id,
    actorName: user.name || '',
    from: existing.name,
    reason: existing.relation || '',
    meta: { fields: ['relatedPersons'], action: 'removed', kind: existing.kind },
  });

  return reloadIssue(issue._id);
}

export async function updateIssueTags({ issue, user, tags }) {
  if (!Array.isArray(tags)) {
    const err = new Error('tags must be an array of strings');
    err.status = 400;
    throw err;
  }
  const cleaned = [
    ...new Set(
      tags
        .map((t) => String(t || '').trim())
        .filter(Boolean)
        .map((t) => t.slice(0, 48))
    ),
  ].slice(0, 30);

  const prev = (issue.tags || []).join(', ');
  const next = cleaned.join(', ');
  if (prev === next) return reloadIssue(issue._id);

  await Issue.updateOne({ _id: issue._id }, { $set: { tags: cleaned } });

  await recordIssueActivity({
    issueId: issue._id,
    organizationId: issue.organizationId,
    type: 'field_updated',
    actorUserId: user._id,
    actorName: user.name || '',
    from: prev,
    to: next,
    meta: { fields: ['tags'] },
  });

  return reloadIssue(issue._id);
}
