import {
  Asset,
  AssetTemplate,
  AssetGroup,
  Location,
  Department,
  BusinessPartner,
  Organization,
} from '../../models/index.js';
import mongoose from 'mongoose';
import ImportJobRow from '../../models/ImportJobRow.js';
import { applyTemplateToAssetBody } from '../assetTemplateService.js';
import { applyPartnerRelationshipsToBody } from '../assetPartnerRelationships.js';
import { generateQrDataUrl, getAssetPublicUrl } from '../qrService.js';
import { logAudit, getRequestMetadata, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../auditService.js';
import { getBusinessPartnerOrgConfig } from '../businessPartnerOrgConfigService.js';
import { generatePartnerCode } from '../partnerIdGenerator.js';
import { env } from '../../config/env.js';
import {
  DEFAULT_ASSET_STATUSES,
  getStandardTemplateFields,
} from '../../constants/assetTemplateDefaults.js';
import { suggestConditionValue, ASSET_CONDITION_VALUES } from './importAliases.js';
import { nextUniqueImportAssetId } from './generateImportAssetId.js';

import LocationType from '../../models/LocationType.js';

const OBJECT_ID_FIELDS = [
  'locationId',
  'departmentId',
  'vendorId',
  'partnerId',
  'assignedTo',
  'templateId',
  'groupId',
  'budgetId',
  'procurementId',
  'purchaseInvoiceId',
  'depreciationPolicyId',
];

function isObjectIdString(v) {
  return typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) && mongoose.Types.ObjectId.isValid(v);
}

function sanitizeObjectIdFields(body) {
  for (const key of OBJECT_ID_FIELDS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v == null || v === '') {
      delete body[key];
      continue;
    }
    if (typeof v === 'object' && v._id) {
      body[key] = v._id;
      continue;
    }
    if (!isObjectIdString(String(v)) && !(v instanceof mongoose.Types.ObjectId)) {
      delete body[key];
    }
  }
  return body;
}

async function ensureLocation(organizationId, name, userId, cache) {
  const key = String(name).trim().toLowerCase();
  if (cache.locations.has(key)) return cache.locations.get(key);
  let loc = await Location.findOne({ organizationId, name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  if (!loc) {
    const typeDoc = await LocationType.findOne({ organizationId }).sort({ order: 1, name: 1 }).lean();
    const type = typeDoc?.key || typeDoc?.name || 'site';
    loc = await Location.create({
      name: String(name).trim(),
      type,
      path: String(name).trim(),
      organizationId,
    });
  }
  cache.locations.set(key, loc._id);
  return loc._id;
}

async function ensureDepartment(organizationId, name, userId, cache) {
  const key = String(name).trim().toLowerCase();
  if (cache.departments.has(key)) return cache.departments.get(key);
  let dep = await Department.findOne({ organizationId, name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  if (!dep) {
    dep = await Department.create({
      name: String(name).trim(),
      organizationId,
    });
  }
  cache.departments.set(key, dep._id);
  return dep._id;
}

async function ensureGroup(organizationId, name, userId, cache) {
  const key = String(name).trim().toLowerCase();
  if (cache.groups.has(key)) return cache.groups.get(key);
  let group = await AssetGroup.findOne({
    organizationId,
    $or: [
      { name: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      { key: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    ],
  });
  if (!group) {
    const slug =
      String(name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 48) || `group_${Date.now()}`;
    const maxOrder = await AssetGroup.findOne({ organizationId }).sort({ order: -1 }).select('order').lean();
    group = await AssetGroup.create({
      name: String(name).trim(),
      key: slug,
      order: (maxOrder?.order ?? -1) + 1,
      organizationId,
      createdBy: userId,
      updatedBy: userId,
    });
  }
  cache.groups.set(key, group._id);
  return group._id;
}

/**
 * Resolve asset template from category name. Creates a new template (no group)
 * when the category does not match an existing template.
 */
async function resolveTemplateForCategory(organizationId, categoryName, userId, cache) {
  const raw = String(categoryName || '').trim();
  if (!raw) return cache.fallbackTemplate || null;

  const key = raw.toLowerCase();
  if (cache.templatesByName.has(key)) return cache.templatesByName.get(key);

  let template = await AssetTemplate.findOne({
    organizationId,
    name: new RegExp(`^${escapeRegex(raw)}$`, 'i'),
  });

  if (!template) {
    try {
      template = await AssetTemplate.create({
        organizationId,
        name: raw,
        description: 'Created during asset import — assign a group under Asset templates if needed',
        isDefault: false,
        fields: getStandardTemplateFields(),
        statuses: [...DEFAULT_ASSET_STATUSES],
        tagSuggestions: [],
        groupId: null,
        sortOrder: 999,
        createdBy: userId,
        updatedBy: userId,
      });
    } catch (err) {
      // Concurrent import of same new category
      template = await AssetTemplate.findOne({
        organizationId,
        name: new RegExp(`^${escapeRegex(raw)}$`, 'i'),
      });
      if (!template) throw err;
    }
  }

  cache.templatesByName.set(key, template);
  // Also index by actual stored name casing
  cache.templatesByName.set(String(template.name).toLowerCase(), template);
  return template;
}

async function ensurePartner(organizationId, name, userId, cache) {
  const key = String(name).trim().toLowerCase();
  if (cache.partners.has(key)) return cache.partners.get(key);
  let partner = await BusinessPartner.findOne({
    organizationId,
    name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
  });
  if (!partner) {
    const config = await getBusinessPartnerOrgConfig(organizationId);
    const partnerCode = await generatePartnerCode(organizationId);
    partner = await BusinessPartner.create({
      name: String(name).trim(),
      partnerCode,
      organizationId,
      createdBy: userId,
      currency: config.settings?.defaultCurrency || 'INR',
      status: config.statuses?.[0]?.id || 'Active',
      partnerTypeKey: config.partnerTypes?.[0]?.id || 'vendor',
    });
  }
  cache.partners.set(key, partner._id);
  return partner._id;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanMappedForAsset(mapped, { keepCreateFlags = false } = {}) {
  const body = { ...mapped };
  if (!keepCreateFlags) {
    delete body.__createLocation;
    delete body.__createDepartment;
    delete body.__createPartner;
    delete body.__createUser;
    delete body.__createGroup;
  }
  for (const key of Object.keys(body)) {
    if (key.endsWith('__label')) delete body[key];
  }
  // revive dates
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) body[k] = d;
    }
  }
  return sanitizeObjectIdFields(body);
}

async function addCustomFieldsToTemplate(template, columnMappings, userId) {
  if (!template) return template;
  let changed = false;
  const fields = [...(template.fields || [])];
  for (const m of columnMappings || []) {
    if (!m.createCustomField || !m.customField?.key) continue;
    if (fields.some((f) => f.key === m.customField.key)) continue;
    fields.push({
      key: m.customField.key,
      label: m.customField.label || m.customField.key,
      type: m.customField.type || 'text',
      required: false,
      order: fields.length + 1,
      section: m.customField.section || 'custom',
      builtIn: false,
      qrVisible: false,
      options: m.customField.options || [],
    });
    changed = true;
  }
  if (changed) {
    template.fields = fields;
    template.updatedBy = userId;
    await template.save();
  }
  return template;
}

/** Move non-schema mapped keys into customFields so mongoose does not strip them. */
function moveUnknownIntoCustomFields(body) {
  const schemaPaths = new Set(Object.keys(Asset.schema.paths));
  const customFields = { ...(body.customFields || {}) };
  for (const [k, v] of Object.entries(body)) {
    if (k === 'customFields' || k.startsWith('__') || k.endsWith('__label')) continue;
    if (schemaPaths.has(k)) continue;
    if (v === undefined || v === null || v === '') {
      delete body[k];
      continue;
    }
    customFields[k] = v;
    delete body[k];
  }
  if (Object.keys(customFields).length) body.customFields = customFields;
  return body;
}

function sanitizeCondition(body) {
  if (body.condition == null || body.condition === '') {
    body.condition = 'good';
    return body;
  }
  const suggested = suggestConditionValue(body.condition, ASSET_CONDITION_VALUES);
  body.condition = suggested || 'good';
  return body;
}

/**
 * Execute a validated asset import job.
 */
export async function executeAssetImport(job, req) {
  const organizationId = job.organizationId;
  const userId = req.user._id;

  const org = await Organization.findById(organizationId).lean();
  const isExpired = org?.subscriptionEndDate && org.subscriptionEndDate < new Date();
  const tier = isExpired ? 'free' : org?.subscriptionTier || 'free';
  const limits = { free: 50, pro: 200, premium: 1000 };
  const maxAssets = limits[tier] || 50;
  let assetCount = await Asset.countDocuments({ organizationId });

  let fallbackTemplate = job.templateId
    ? await AssetTemplate.findOne({ _id: job.templateId, organizationId })
    : null;
  // Do not fall back to a random "default" template (was forcing Air Conditioner etc.)

  const cache = {
    locations: new Map(),
    departments: new Map(),
    partners: new Map(),
    groups: new Map(),
    templatesByName: new Map(),
    fallbackTemplate,
    usedImportIds: new Set(),
  };

  if (fallbackTemplate) {
    fallbackTemplate = await addCustomFieldsToTemplate(fallbackTemplate, job.columnMappings, userId);
    cache.fallbackTemplate = fallbackTemplate;
  }

  const result = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const batchSize = 100;
  let skip = 0;

  // Prefer valid + warning rows; skip error rows
  for (;;) {
    const rows = await ImportJobRow.find({
      jobId: job._id,
      status: { $in: ['valid', 'warning'] },
    })
      .sort({ rowIndex: 1 })
      .skip(skip)
      .limit(batchSize);

    if (!rows.length) break;

    for (const row of rows) {
      try {
        let mapped = cleanMappedForAsset(row.mapped || {}, { keepCreateFlags: true });

        if (mapped.__createLocation) {
          mapped.locationId = await ensureLocation(organizationId, mapped.__createLocation, userId, cache);
          delete mapped.__createLocation;
        }
        if (mapped.__createDepartment) {
          mapped.departmentId = await ensureDepartment(organizationId, mapped.__createDepartment, userId, cache);
          delete mapped.__createDepartment;
        }
        if (mapped.__createGroup) {
          mapped.groupId = await ensureGroup(organizationId, mapped.__createGroup, userId, cache);
          delete mapped.__createGroup;
        }
        if (mapped.__createPartner) {
          mapped.vendorId = await ensurePartner(organizationId, mapped.__createPartner, userId, cache);
          mapped.partnerId = mapped.vendorId;
          delete mapped.__createPartner;
        }
        if (mapped.__createUser) {
          // Never auto-create users from import
          delete mapped.__createUser;
          delete mapped.assignedTo;
        }

        mapped = cleanMappedForAsset(mapped);

        let assetIdStr = mapped.assetId != null ? String(mapped.assetId).trim() : '';
        if (!mapped.name || !String(mapped.name).trim()) {
          row.status = 'failed';
          row.issues = [
            ...(row.issues || []),
            { severity: 'error', field: 'name', message: 'Missing asset name at import time.' },
          ];
          await row.save();
          result.failed += 1;
          continue;
        }
        if (!assetIdStr) {
          assetIdStr = await nextUniqueImportAssetId(cache.usedImportIds);
          mapped.assetId = assetIdStr;
        } else {
          cache.usedImportIds.add(assetIdStr.toLowerCase());
        }

        // Template from category (per row). Creates template if category is new.
        const categoryName = mapped.category != null ? String(mapped.category).trim() : '';
        let template = await resolveTemplateForCategory(organizationId, categoryName, userId, cache);
        if (template) {
          template = await addCustomFieldsToTemplate(template, job.columnMappings, userId);
          // Canonical category name from template
          mapped.category = template.name;
        }

        // assetId is globally unique
        let existing = await Asset.findOne({ organizationId, assetId: assetIdStr });
        if (!existing) {
          const globalTaken = await Asset.exists({
            assetId: new RegExp(`^${escapeRegex(assetIdStr)}$`, 'i'),
          });
          if (globalTaken) {
            if (/^IMP-\d+$/i.test(assetIdStr)) {
              // Auto-id collision with another import — mint the next free one
              assetIdStr = await nextUniqueImportAssetId(cache.usedImportIds);
              mapped.assetId = assetIdStr;
            } else {
              row.status = 'failed';
              row.issues = [
                ...(row.issues || []),
                {
                  severity: 'error',
                  field: 'assetId',
                  message: `Asset ID "${assetIdStr}" is already in use.`,
                },
              ];
              await row.save();
              result.failed += 1;
              continue;
            }
          }
        }
        const handling = job.duplicateHandling || 'skip';

        if (existing) {
          if (handling === 'skip' || handling === 'stop') {
            row.status = 'skipped';
            row.assetId = existing._id;
            await row.save();
            result.skipped += 1;
            continue;
          }
          if (handling === 'create_new') {
            row.status = 'failed';
            row.issues = [
              ...(row.issues || []),
              {
                severity: 'error',
                field: 'assetId',
                message: 'Asset ID already exists. Choose Update or Skip for duplicates.',
              },
            ];
            await row.save();
            result.failed += 1;
            continue;
          }
          // update — skip strict template required-field checks (already validated for import)
          let body = sanitizeObjectIdFields({ ...mapped, organizationId });
          if (template) {
            body = applyTemplateToAssetBody(body, template);
            // Prefer explicitly mapped group over template default
            if (mapped.groupId) body.groupId = mapped.groupId;
          }
          applyPartnerRelationshipsToBody(body, { seedFromPrimary: true });
          body.updatedBy = userId;
          moveUnknownIntoCustomFields(body);
          sanitizeCondition(body);
          // Avoid overwriting with empty strings for unset relational fields
          for (const key of OBJECT_ID_FIELDS) {
            if (body[key] === undefined) delete body[key];
          }
          Object.assign(existing, body);
          await existing.save();
          row.status = 'updated';
          row.assetId = existing._id;
          await row.save();
          result.updated += 1;
          continue;
        }

        if (assetCount >= maxAssets) {
          row.status = 'failed';
          row.issues = [
            ...(row.issues || []),
            {
              severity: 'error',
              field: '',
              message: `Asset limit reached for your ${tier} plan (${maxAssets}).`,
            },
          ];
          await row.save();
          result.failed += 1;
          continue;
        }

        let body = sanitizeObjectIdFields({
          ...mapped,
          organizationId,
          createdBy: userId,
          category: mapped.category || template?.name || 'Asset',
          status: mapped.status || 'available',
          name: String(mapped.name).trim(),
          assetId: assetIdStr,
        });
        if (template) {
          body = applyTemplateToAssetBody(body, template);
          if (mapped.groupId) body.groupId = mapped.groupId;
        }
        // Ensure required schema fields after template apply
        if (!body.category) body.category = template?.name || 'Asset';
        if (!body.status) body.status = 'available';
        applyPartnerRelationshipsToBody(body, { seedFromPrimary: true });
        sanitizeObjectIdFields(body);
        moveUnknownIntoCustomFields(body);
        sanitizeCondition(body);
        if (!body.condition) body.condition = 'good';

        const asset = await Asset.create(body);
        try {
          const publicUrl = getAssetPublicUrl(asset._id, env.frontendUrl);
          asset.qrCodeUrl = await generateQrDataUrl(publicUrl);
          await asset.save();
        } catch {
          /* QR optional */
        }

        row.status = 'created';
        row.assetId = asset._id;
        await row.save();
        result.created += 1;
        assetCount += 1;
      } catch (err) {
        row.status = 'failed';
        row.issues = [
          ...(row.issues || []),
          { severity: 'error', field: '', message: err.message || 'Import failed for this row.' },
        ];
        await row.save();
        result.failed += 1;
      }
    }

    skip += rows.length;
    // When updating in place, skip advances incorrectly for filtered query —
    // reset skip to 0 and rely on status change removing rows from the filter.
    skip = 0;
    const remaining = await ImportJobRow.countDocuments({
      jobId: job._id,
      status: { $in: ['valid', 'warning'] },
    });
    if (!remaining) break;
  }

  await logAudit(userId, AUDIT_ACTIONS.ASSET_IMPORTED, AUDIT_RESOURCES.ASSET, job._id, {
    resourceName: job.fileName || 'Asset import',
    description: `Imported ${result.created} asset${result.created === 1 ? '' : 's'} from ${job.fileName || 'file'}`,
    details: {
      importJobId: String(job._id),
      source: 'asset_import',
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      fileName: job.fileName,
    },
    severity: 'low',
    organizationId,
    ...getRequestMetadata(req),
  });

  return result;
}
