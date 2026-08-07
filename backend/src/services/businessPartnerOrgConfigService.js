import BusinessPartnerOrgConfig from '../models/BusinessPartnerOrgConfig.js';
import { getDefaultBusinessPartnerOrgConfig } from '../constants/businessPartnerDefaults.js';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || `item_${Date.now()}`;
}

function normalizeOptionList(items = [], defaults = []) {
  const list = items.length ? items : defaults;
  const seen = new Set();
  return list
    .map((item) => ({
      id: item.id || slugify(item.name),
      name: String(item.name || '').trim(),
      description: item.description || '',
      color: item.color || '',
      isDefault: Boolean(item.isDefault),
    }))
    .filter((item) => {
      if (!item.name || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function normalizeSections(items = [], defaults = []) {
  const list = items.length ? items : defaults;
  const seen = new Set();
  return list
    .map((section) => ({
      key: section.key || slugify(section.label),
      label: String(section.label || '').trim(),
      enabled: section.enabled !== false,
    }))
    .filter((section) => {
      if (!section.label || seen.has(section.key)) return false;
      seen.add(section.key);
      return true;
    });
}

function normalizeRelationshipTypes(items = [], defaults = []) {
  const list = items.length ? items : defaults;
  const seen = new Set();
  return list
    .map((item) => ({
      key: item.key || slugify(item.label),
      label: String(item.label || '').trim(),
      resourceType: item.resourceType || '',
    }))
    .filter((item) => {
      if (!item.label || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
}

function normalizeCustomFields(fields = []) {
  const seen = new Set();
  return fields
    .map((f) => ({
      key: slugify(f.key || f.label),
      label: String(f.label || '').trim(),
      type: f.type || 'text',
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options.map(String) : [],
      section: f.section || 'custom',
    }))
    .filter((f) => {
      if (!f.label || seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
}

function normalizeKpis(items = [], defaults = []) {
  const builtinMap = new Map(defaults.map((k) => [k.key, k]));
  const seen = new Set();
  return items
    .map((kpi) => {
      const key = kpi.key || slugify(kpi.label);
      const builtin = builtinMap.get(key);
      return {
        key,
        label: String(kpi.label || builtin?.label || '').trim(),
        description: kpi.description ?? builtin?.description ?? '',
        unit: kpi.unit || builtin?.unit || 'count',
        higherIsBetter:
          kpi.higherIsBetter != null ? Boolean(kpi.higherIsBetter) : Boolean(builtin?.higherIsBetter),
        isBuiltin: Boolean(builtin),
        enabled: kpi.enabled !== false,
      };
    })
    .filter((kpi) => {
      if (!kpi.label || seen.has(kpi.key)) return false;
      seen.add(kpi.key);
      return true;
    });
}

export async function ensureBusinessPartnerOrgConfig(organizationId) {
  const defaults = getDefaultBusinessPartnerOrgConfig();
  let config = await BusinessPartnerOrgConfig.findOne({ organizationId });

  if (!config) {
    config = await BusinessPartnerOrgConfig.create({ organizationId, ...defaults });
    return config;
  }

  let dirty = false;
  const listKeys = [
    'partnerTypes',
    'categories',
    'statuses',
    'profileSections',
    'addressTypes',
    'assetRelationshipTypes',
    'serviceRelationshipTypes',
    'performanceKpis',
    'dashboardWidgetCatalog',
  ];
  for (const key of listKeys) {
    if (!config[key]?.length) {
      config[key] = defaults[key];
      dirty = true;
    }
  }
  // Merge newly introduced catalog widgets into existing org configs
  if (Array.isArray(config.dashboardWidgetCatalog) && Array.isArray(defaults.dashboardWidgetCatalog)) {
    const existing = new Set(config.dashboardWidgetCatalog.map((w) => w.key));
    const missing = defaults.dashboardWidgetCatalog.filter((w) => w.key && !existing.has(w.key));
    if (missing.length) {
      config.dashboardWidgetCatalog = [...config.dashboardWidgetCatalog, ...missing];
      dirty = true;
    }
  }
  if (!config.settings?.partnerCodePrefix) {
    config.settings = { ...defaults.settings, ...(config.settings?.toObject?.() || config.settings) };
    dirty = true;
  }
  if (dirty) await config.save();

  return config;
}

export async function getBusinessPartnerOrgConfig(organizationId) {
  return ensureBusinessPartnerOrgConfig(organizationId);
}

export async function updateBusinessPartnerOrgConfig(organizationId, userId, payload = {}) {
  const defaults = getDefaultBusinessPartnerOrgConfig();
  const config = await ensureBusinessPartnerOrgConfig(organizationId);

  if (payload.partnerTypes) {
    config.partnerTypes = normalizeOptionList(payload.partnerTypes, defaults.partnerTypes);
  }
  if (payload.categories) {
    config.categories = normalizeOptionList(payload.categories, defaults.categories);
  }
  if (payload.statuses) {
    config.statuses = normalizeOptionList(payload.statuses, defaults.statuses);
  }
  if (payload.addressTypes) {
    config.addressTypes = normalizeOptionList(payload.addressTypes, defaults.addressTypes);
  }
  if (payload.profileSections) {
    config.profileSections = normalizeSections(payload.profileSections, defaults.profileSections);
  }
  if (payload.assetRelationshipTypes) {
    config.assetRelationshipTypes = normalizeRelationshipTypes(
      payload.assetRelationshipTypes,
      defaults.assetRelationshipTypes
    );
  }
  if (payload.serviceRelationshipTypes) {
    config.serviceRelationshipTypes = normalizeRelationshipTypes(
      payload.serviceRelationshipTypes,
      defaults.serviceRelationshipTypes
    );
  }
  if (payload.customFields) {
    config.customFields = normalizeCustomFields(payload.customFields);
  }
  if (payload.performanceKpis) {
    config.performanceKpis = normalizeKpis(payload.performanceKpis, defaults.performanceKpis);
  }
  if (payload.dashboardWidgetCatalog) {
    config.dashboardWidgetCatalog = payload.dashboardWidgetCatalog
      .map((w) => ({
        key: w.key || slugify(w.label),
        label: String(w.label || '').trim(),
        kind: w.kind || 'metric',
      }))
      .filter((w) => w.label);
  }
  if (payload.settings && typeof payload.settings === 'object') {
    config.settings = {
      ...(config.settings?.toObject?.() || config.settings),
      ...payload.settings,
    };
  }

  config.updatedBy = userId;
  await config.save();
  return config;
}

export function validatePartnerCustomFields(config, customFields = {}) {
  const errors = [];
  for (const field of config?.customFields || []) {
    if (!field.required) continue;
    const val = customFields[field.key];
    if (val == null || val === '') errors.push(`${field.label} is required`);
  }
  return errors;
}

export function resolvePartnerType(config, typeKey) {
  const types = config?.partnerTypes || [];
  return types.find((t) => t.id === typeKey) || types.find((t) => t.isDefault) || types[0];
}

export function resolvePartnerStatus(config, statusId) {
  const statuses = config?.statuses || [];
  return statuses.find((s) => s.id === statusId) || statuses.find((s) => s.isDefault) || statuses[0];
}
