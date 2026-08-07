import mongoose from 'mongoose';

/**
 * Normalize partner relationship rows from a request or document.
 * Dedupes by _id when present, otherwise by partnerId + relationshipTypeKey.
 * Preserves subdocument _id so in-place edits stay the same row.
 */
export function normalizePartnerRelationshipsInput(raw) {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set();
  const seenKeys = new Set();
  const out = [];

  for (const row of raw) {
    if (!row) continue;
    const partnerId = row.partnerId?._id || row.partnerId;
    const relationshipTypeKey = String(row.relationshipTypeKey || '').trim();
    if (!partnerId || !mongoose.Types.ObjectId.isValid(String(partnerId)) || !relationshipTypeKey) {
      continue;
    }

    const id = row._id && mongoose.Types.ObjectId.isValid(String(row._id)) ? String(row._id) : '';
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    } else {
      const key = `${String(partnerId)}::${relationshipTypeKey}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
    }

    const normalized = {
      partnerId: new mongoose.Types.ObjectId(String(partnerId)),
      relationshipTypeKey,
      notes: String(row.notes || '').trim(),
    };
    if (id) normalized._id = new mongoose.Types.ObjectId(id);
    out.push(normalized);
  }

  return out;
}

/** Build relationships from legacy single partner fields when the array is empty. */
export function legacyPartnerRelationshipsFromAsset(asset = {}) {
  const partnerId = asset.partnerId?._id || asset.partnerId || asset.vendorId?._id || asset.vendorId;
  if (!partnerId || !mongoose.Types.ObjectId.isValid(String(partnerId))) return [];
  const relationshipTypeKey = String(asset.relationshipTypeKey || '').trim();
  if (!relationshipTypeKey) {
    return [
      {
        partnerId: new mongoose.Types.ObjectId(String(partnerId)),
        relationshipTypeKey: 'purchased_from',
        notes: '',
      },
    ];
  }
  return [
    {
      partnerId: new mongoose.Types.ObjectId(String(partnerId)),
      relationshipTypeKey,
      notes: '',
    },
  ];
}

export function resolvePartnerRelationships(asset = {}) {
  const fromArray = normalizePartnerRelationshipsInput(asset.partnerRelationships);
  if (fromArray.length) return fromArray;
  return legacyPartnerRelationshipsFromAsset(asset);
}

/** Sync primary vendor/partner/relationship fields from the first relationship row. */
export function primaryPartnerFieldsFromRelationships(relationships) {
  const first = relationships?.[0];
  if (!first?.partnerId) {
    return { partnerId: null, vendorId: null, relationshipTypeKey: '' };
  }
  return {
    partnerId: first.partnerId,
    vendorId: first.partnerId,
    relationshipTypeKey: first.relationshipTypeKey || '',
  };
}

/**
 * Apply partnerRelationships from body (or seed from vendor/partner on create).
 * Mutates `body` in place and returns normalized relationships.
 */
export function applyPartnerRelationshipsToBody(body, { seedFromPrimary = false } = {}) {
  let relationships = normalizePartnerRelationshipsInput(body.partnerRelationships);

  if (!relationships.length && seedFromPrimary) {
    const partnerId = body.partnerId || body.vendorId;
    const relationshipTypeKey = String(body.relationshipTypeKey || '').trim();
    if (partnerId && relationshipTypeKey) {
      relationships = normalizePartnerRelationshipsInput([
        { partnerId, relationshipTypeKey, notes: '' },
      ]);
    } else if (partnerId) {
      relationships = normalizePartnerRelationshipsInput([
        { partnerId, relationshipTypeKey: 'purchased_from', notes: '' },
      ]);
    }
  }

  if (body.partnerRelationships !== undefined || relationships.length) {
    body.partnerRelationships = relationships;
    Object.assign(body, primaryPartnerFieldsFromRelationships(relationships));
  }

  return relationships;
}
