import BudgetOrgConfig from '../models/BudgetOrgConfig.js';
import { getDefaultBudgetOrgConfig } from '../constants/budgetDefaults.js';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || `item_${Date.now()}`;
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
      section: f.section || 'Details',
    }))
    .filter((f) => {
      if (!f.label || seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
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
      isClosed: Boolean(item.isClosed),
    }))
    .filter((item) => {
      if (!item.name || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

export async function ensureBudgetOrgConfig(organizationId) {
  let config = await BudgetOrgConfig.findOne({ organizationId });
  const defaults = getDefaultBudgetOrgConfig();

  if (!config) {
    config = await BudgetOrgConfig.create({
      organizationId,
      ...defaults,
    });
    return config;
  }

  let dirty = false;
  if (!config.procurementLifecycleStages?.length) {
    config.procurementLifecycleStages = defaults.procurementLifecycleStages;
    dirty = true;
  }
  if (!config.procurementPaymentStatuses?.length) {
    config.procurementPaymentStatuses = defaults.procurementPaymentStatuses;
    dirty = true;
  }
  if (!config.procurementCustomFields) {
    config.procurementCustomFields = defaults.procurementCustomFields;
    dirty = true;
  }
  if (dirty) await config.save();

  return config;
}

export async function getBudgetOrgConfig(organizationId) {
  return ensureBudgetOrgConfig(organizationId);
}

export async function updateBudgetOrgConfig(organizationId, userId, payload) {
  const defaults = getDefaultBudgetOrgConfig();
  const config = await ensureBudgetOrgConfig(organizationId);

  if (payload.budgetTypes) {
    config.budgetTypes = normalizeOptionList(payload.budgetTypes, defaults.budgetTypes);
  }
  if (payload.budgetStatuses) {
    config.budgetStatuses = normalizeOptionList(payload.budgetStatuses, defaults.budgetStatuses);
  }
  if (payload.fundingSources) {
    config.fundingSources = normalizeOptionList(payload.fundingSources, defaults.fundingSources);
  }
  if (payload.enabledDimensions) {
    config.enabledDimensions = payload.enabledDimensions.map((d) => ({
      key: d.key,
      label: d.label || d.key,
      enabled: d.enabled !== false,
      required: Boolean(d.required),
    }));
  }
  if (payload.customFields) {
    config.customFields = normalizeCustomFields(payload.customFields);
  }
  if (payload.procurementLifecycleStages) {
    config.procurementLifecycleStages = payload.procurementLifecycleStages.map((s) => ({
      id: s.id || slugify(s.name),
      name: String(s.name || '').trim(),
      color: s.color || '',
      bucket: s.bucket || 'planned',
      isDefault: Boolean(s.isDefault),
    })).filter((s) => s.name);
  }
  if (payload.procurementPaymentStatuses) {
    config.procurementPaymentStatuses = normalizeOptionList(
      payload.procurementPaymentStatuses,
      defaults.procurementPaymentStatuses
    );
  }
  if (payload.procurementCustomFields) {
    config.procurementCustomFields = normalizeCustomFields(payload.procurementCustomFields);
  }
  if (payload.settings && typeof payload.settings === 'object') {
    config.settings = { ...config.settings.toObject?.() || config.settings, ...payload.settings };
  }

  config.updatedBy = userId;
  await config.save();
  return config;
}

export function validateBudgetCustomFields(config, customFields = {}) {
  const errors = [];
  for (const field of config.customFields || []) {
    if (!field.required) continue;
    const val = customFields[field.key];
    if (val == null || val === '') {
      errors.push(`${field.label} is required`);
    }
  }
  return errors;
}

export function validateBudgetDimensions(config, dimensions = {}) {
  const errors = [];
  for (const dim of config.enabledDimensions || []) {
    if (!dim.enabled || !dim.required) continue;
    const val = dimensions[dim.key];
    if (val == null || val === '') {
      errors.push(`${dim.label} is required`);
    }
  }
  return errors;
}

export function resolveBudgetStatus(config, statusId) {
  const statuses = config.budgetStatuses || [];
  return statuses.find((s) => s.id === statusId) || statuses.find((s) => s.isDefault) || statuses[0];
}

export function resolveBudgetType(config, typeId) {
  const types = config.budgetTypes || [];
  return types.find((t) => t.id === typeId) || types.find((t) => t.isDefault) || types[0];
}
