import AssetTemplate from '../models/AssetTemplate.js';
import {
  DEFAULT_ASSET_TEMPLATES,
  DEFAULT_ASSET_STATUSES,
  BUILTIN_FIELD_KEYS,
  FIELD_TYPES,
} from '../constants/assetTemplateDefaults.js';
import { DEFAULT_TEMPLATE_GROUP_MAP } from '../constants/assetGroupDefaults.js';
import { ensureDefaultAssetGroups } from './assetGroupService.js';

export async function ensureDefaultTemplates(organizationId, userId) {
  const count = await AssetTemplate.countDocuments({ organizationId });
  if (count > 0) return;

  const groups = await ensureDefaultAssetGroups(organizationId, userId);
  const groupByKey = Object.fromEntries(groups.filter((g) => g.key).map((g) => [g.key, g._id]));

  const docs = DEFAULT_ASSET_TEMPLATES.map((t, index) => {
    const groupKey = DEFAULT_TEMPLATE_GROUP_MAP[t.name];
    return {
      organizationId,
      name: t.name,
      description: t.description,
      isDefault: true,
      groupId: groupKey && groupByKey[groupKey] ? groupByKey[groupKey] : null,
      sortOrder: index,
      fields: t.fields.map((f, i) => ({ ...f, order: f.order ?? i })),
      statuses: t.statuses?.length ? t.statuses : [...DEFAULT_ASSET_STATUSES],
      tagSuggestions: t.tagSuggestions || [],
      createdBy: userId,
      updatedBy: userId,
    };
  });

  await AssetTemplate.insertMany(docs);
}

function slugKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || `field_${Date.now()}`;
}

export function normalizeTemplateFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field, index) => {
      const key = field.key?.trim() || slugKey(field.label || `field_${index}`);
      const builtIn = BUILTIN_FIELD_KEYS.has(key);
      return {
        key,
        label: String(field.label || key).trim(),
        type: FIELD_TYPES.includes(field.type) ? field.type : 'text',
        required: Boolean(field.required),
        order: typeof field.order === 'number' ? field.order : index,
        section: field.section || (builtIn ? 'basic' : 'custom'),
        builtIn,
        options: Array.isArray(field.options) ? field.options.map(String) : [],
      };
    })
    .sort((a, b) => a.order - b.order);
}

export function validateTemplatePayload(body) {
  if (!body.name?.trim()) {
    return { ok: false, message: 'Template name is required' };
  }
  const fields = normalizeTemplateFields(body.fields);
  if (fields.length === 0) {
    return { ok: false, message: 'At least one field is required' };
  }
  const keys = new Set();
  for (const f of fields) {
    if (keys.has(f.key)) return { ok: false, message: `Duplicate field key: ${f.key}` };
    keys.add(f.key);
    if (['select', 'checkbox', 'radio'].includes(f.type) && (!f.options || f.options.length === 0)) {
      return { ok: false, message: `"${f.label}" requires at least one option` };
    }
  }
  const statuses = Array.isArray(body.statuses)
    ? [...new Set(body.statuses.map((s) => String(s).trim()).filter(Boolean))]
    : [...DEFAULT_ASSET_STATUSES];
  const tagSuggestions = Array.isArray(body.tagSuggestions)
    ? [...new Set(body.tagSuggestions.map((t) => String(t).trim()).filter(Boolean))]
    : [];

  return {
    ok: true,
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || '',
      fields,
      statuses: statuses.length ? statuses : [...DEFAULT_ASSET_STATUSES],
      tagSuggestions,
    },
  };
}

/** Split incoming asset body into schema fields vs customFields based on template */
export function applyTemplateToAssetBody(body, template) {
  const result = { ...body };
  const customFields = { ...(body.customFields || {}) };
  const fieldMap = new Map((template?.fields || []).map((f) => [f.key, f]));

  for (const [key, value] of Object.entries(body)) {
    const def = fieldMap.get(key);
    if (def && !def.builtIn && value !== undefined) {
      customFields[key] = value;
      delete result[key];
    }
  }

  if (Object.keys(customFields).length) result.customFields = customFields;
  if (template?._id) result.templateId = template._id;
  if (template?.groupId) result.groupId = template.groupId;
  if (template?.name && !result.category) result.category = template.name;

  return result;
}

export function validateAssetAgainstTemplate(body, template) {
  if (!template) return { ok: true };
  const errors = [];
  for (const field of template.fields || []) {
    if (!field.required) continue;
    if (field.type === 'location') {
      if (!body.locationId) errors.push(`${field.label} is required`);
      continue;
    }
    if (field.type === 'tags') {
      const val = body.tags;
      if (!Array.isArray(val) || val.length === 0) errors.push(`${field.label} is required`);
      continue;
    }
    if (field.type === 'checkbox') {
      const val = field.builtIn ? body[field.key] : body.customFields?.[field.key] ?? body[field.key];
      if (!Array.isArray(val) || val.length === 0) errors.push(`${field.label} is required`);
      continue;
    }
    if (field.builtIn) {
      const val = body[field.key];
      if (val === undefined || val === null || String(val).trim() === '') {
        errors.push(`${field.label} is required`);
      }
    } else {
      const val = body.customFields?.[field.key] ?? body[field.key];
      if (val === undefined || val === null || String(val).trim() === '') {
        errors.push(`${field.label} is required`);
      }
    }
  }
  if (body.status && template.statuses?.length && !template.statuses.includes(body.status)) {
    errors.push(`Invalid status for this template`);
  }
  return errors.length ? { ok: false, message: errors.join('; ') } : { ok: true };
}
