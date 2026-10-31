import AssetTemplate from '../models/AssetTemplate.js';
import {
  getQrVisibilityFromTemplate,
  normalizeQrSections,
  normalizeTemplateFields,
} from './assetTemplateService.js';

const FALLBACK_QR_FIELD_KEYS = [
  'name',
  'model',
  'serialNumber',
  'status',
  'tags',
  'condition',
  'assignedToName',
  'assignedToEmployeeCode',
  'locationId',
  'departmentId',
  'purchaseDate',
  'warrantyExpiry',
  'amcExpiry',
  'nextMaintenanceDate',
  'vendorId',
  'cost',
];

function fallbackTemplate() {
  return {
    fields: FALLBACK_QR_FIELD_KEYS.map((key) => ({
      key,
      label: key,
      type: 'text',
      required: false,
      order: 0,
      section: ['assignedToName', 'assignedToEmployeeCode', 'locationId', 'departmentId'].includes(key)
        ? 'assignment'
        : ['purchaseDate', 'warrantyExpiry', 'amcExpiry', 'nextMaintenanceDate', 'vendorId', 'cost'].includes(key)
          ? 'purchase'
          : 'basic',
      builtIn: true,
      qrVisible: true,
      reportVisible: true,
      readonly: true,
      options: [],
    })),
    qrSections: {
      basic: true,
      assignment: true,
      purchase: true,
      custom: true,
      photos: true,
      documents: true,
      maintenance: true,
      issues: true,
    },
  };
}

export async function loadAssetTemplate(asset) {
  if (!asset) return null;
  let template = null;
  if (asset.templateId) {
    const id = asset.templateId._id || asset.templateId;
    template = await AssetTemplate.findById(id).lean();
  }
  if (!template && asset.category && asset.organizationId) {
    template = await AssetTemplate.findOne({
      organizationId: asset.organizationId,
      name: asset.category,
    }).lean();
  }
  return template;
}

function normalizeExtraFields(extraFields) {
  return normalizeTemplateFields(extraFields || []).map((f) => ({
    ...f,
    section: 'custom',
    builtIn: false,
    reportVisible: f.reportVisible !== false,
    readonly: f.readonly !== false,
    source: 'asset',
  }));
}

/**
 * Resolve Category/Template → Asset override → public field list.
 * @param {'qr'|'report'} surface
 */
export function resolveAssetPublicFields(asset, template, surface = 'qr') {
  const tpl = template || fallbackTemplate();
  const qrSections = normalizeQrSections(tpl.qrSections);
  const withReportDefaults = normalizeTemplateFields(tpl.fields || []).map((f) => ({
    ...f,
    source: 'template',
  }));

  const overrides =
    asset?.fieldConfig?.overrides && typeof asset.fieldConfig.overrides === 'object'
      ? asset.fieldConfig.overrides
      : {};
  const extraFields = normalizeExtraFields(asset?.fieldConfig?.extraFields);
  const orderKeys = Array.isArray(asset?.fieldConfig?.order)
    ? asset.fieldConfig.order.map(String)
    : null;

  const merged = [];
  const seen = new Set();

  for (const field of withReportDefaults) {
    const ov = overrides[field.key] || {};
    if (ov.hidden === true) {
      seen.add(field.key);
      continue;
    }
    merged.push({
      ...field,
      label: ov.label != null && String(ov.label).trim() ? String(ov.label).trim() : field.label,
      required: ov.required !== undefined ? Boolean(ov.required) : field.required,
      order: typeof ov.order === 'number' ? ov.order : field.order,
      qrVisible: ov.qrVisible !== undefined ? Boolean(ov.qrVisible) : field.qrVisible !== false,
      reportVisible:
        ov.reportVisible !== undefined ? Boolean(ov.reportVisible) : field.reportVisible !== false,
      readonly: ov.readonly !== undefined ? Boolean(ov.readonly) : field.readonly !== false,
      source: 'template',
    });
    seen.add(field.key);
  }

  for (const field of extraFields) {
    if (seen.has(field.key)) continue;
    const ov = overrides[field.key] || {};
    if (ov.hidden === true) continue;
    merged.push({
      ...field,
      label: ov.label != null && String(ov.label).trim() ? String(ov.label).trim() : field.label,
      required: ov.required !== undefined ? Boolean(ov.required) : field.required,
      order: typeof ov.order === 'number' ? ov.order : field.order,
      qrVisible: ov.qrVisible !== undefined ? Boolean(ov.qrVisible) : field.qrVisible !== false,
      reportVisible:
        ov.reportVisible !== undefined ? Boolean(ov.reportVisible) : field.reportVisible !== false,
      readonly: ov.readonly !== undefined ? Boolean(ov.readonly) : field.readonly !== false,
      source: 'asset',
    });
    seen.add(field.key);
  }

  if (orderKeys?.length) {
    const rank = new Map(orderKeys.map((k, i) => [k, i]));
    merged.sort((a, b) => {
      const ra = rank.has(a.key) ? rank.get(a.key) : 10000 + a.order;
      const rb = rank.has(b.key) ? rank.get(b.key) : 10000 + b.order;
      return ra - rb || a.order - b.order || a.label.localeCompare(b.label);
    });
  } else {
    merged.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }

  const allFields = merged.map((f, index) => ({ ...f, order: index }));

  const visibleFields = allFields.filter((f) => {
    if (surface === 'report') {
      return f.reportVisible !== false;
    }
    return qrSections[f.section] !== false && f.qrVisible !== false;
  });

  return {
    template: tpl,
    qrSections,
    fields: allFields,
    visibleFields,
  };
}

/** @deprecated use resolveAssetPublicFields — kept for callers that only need template QR */
export function getQrVisibilityWithAssetOverrides(asset, template) {
  const resolved = resolveAssetPublicFields(asset, template, 'qr');
  return {
    qrSections: resolved.qrSections,
    fields: resolved.fields,
    visibleFields: resolved.visibleFields,
  };
}

/**
 * Pick display values for a list of field keys from a lean asset doc.
 */
export function pickAssetFieldValues(asset, fieldKeys) {
  const keySet = new Set(fieldKeys);
  const values = {};
  for (const key of keySet) {
    if (key === 'locationId' && asset.locationId) {
      values[key] = asset.locationId;
      continue;
    }
    if (key === 'departmentId' && asset.departmentId) {
      values[key] = asset.departmentId;
      continue;
    }
    if (key === 'vendorId' && asset.vendorId) {
      values[key] = asset.vendorId;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(asset, key) && asset[key] !== undefined) {
      values[key] = asset[key];
      continue;
    }
    if (asset.customFields && Object.prototype.hasOwnProperty.call(asset.customFields, key)) {
      values[key] = asset.customFields[key];
    }
  }
  return values;
}

export function normalizeFieldConfig(input) {
  if (!input || typeof input !== 'object') {
    return { overrides: {}, extraFields: [], order: [] };
  }
  const overrides =
    input.overrides && typeof input.overrides === 'object' && !Array.isArray(input.overrides)
      ? input.overrides
      : {};
  const extraFields = normalizeTemplateFields(input.extraFields || []).map((f) => ({
    ...f,
    section: 'custom',
    builtIn: false,
    reportVisible: f.reportVisible !== false,
    readonly: f.readonly !== false,
  }));
  // Re-apply reportVisible/readonly from raw extra fields
  const rawExtra = Array.isArray(input.extraFields) ? input.extraFields : [];
  const extras = extraFields.map((f) => {
    const raw = rawExtra.find((x) => x.key === f.key) || {};
    return {
      ...f,
      qrVisible: raw.qrVisible !== false,
      reportVisible: raw.reportVisible !== false,
      readonly: raw.readonly === false ? false : true,
    };
  });
  const order = Array.isArray(input.order) ? input.order.map(String).filter(Boolean) : [];
  return { overrides, extraFields: extras, order };
}

// Re-export for convenience
export { getQrVisibilityFromTemplate, FALLBACK_QR_FIELD_KEYS };
