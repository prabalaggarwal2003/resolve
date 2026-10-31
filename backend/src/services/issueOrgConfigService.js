import IssueOrgConfig from '../models/IssueOrgConfig.js';
import { getDefaultIssueOrgConfig, FORM_FIELD_TYPES } from '../constants/issueDefaults.js';

function slugify(text) {
  return (
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) || `item_${Date.now()}`
  );
}

function normalizeOptionList(items = [], defaults = []) {
  const list = items.length ? items : defaults;
  const seen = new Set();
  return list
    .map((item) => {
      const name = String(item.name || '').trim();
      let id = String(item.id || '').trim();
      // Temporary UI ids (custom_<timestamp>) → stable slug from name so they match list/filters
      if (!id || /^custom_\d+$/i.test(id)) {
        id = slugify(name) || id || `item_${Date.now()}`;
      }
      if (seen.has(id) && name) {
        id = `${slugify(name)}_${Date.now().toString(36)}`;
      }
      return {
        id,
        name,
        description: item.description || '',
        color: item.color || '#6b7280',
        isDefault: Boolean(item.isDefault),
        isClosed: Boolean(item.isClosed),
      };
    })
    .filter((item) => {
      if (!item.name || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function normalizeFormFields(fields = []) {
  const seen = new Set();
  return (Array.isArray(fields) ? fields : [])
    .map((f) => {
      const key = slugify(f.key || f.label);
      const type = FORM_FIELD_TYPES.includes(f.type) ? f.type : 'text';
      return {
        key,
        label: String(f.label || '').trim(),
        type,
        required: Boolean(f.required),
        options: Array.isArray(f.options) ? f.options.map(String) : [],
        placeholder: f.placeholder || '',
        showWhen: f.showWhen && f.showWhen.field
          ? {
              field: String(f.showWhen.field),
              equals: f.showWhen.equals,
              notEquals: f.showWhen.notEquals,
            }
          : null,
      };
    })
    .filter((f) => {
      if (!f.label || !f.key || seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
}

function normalizeIssueTypes(items = [], defaults = []) {
  const list = items.length ? items : defaults;
  const seen = new Set();
  const defaultById = Object.fromEntries(defaults.map((d) => [d.id, d]));
  return list
    .map((item) => {
      const id = item.id || slugify(item.name);
      const fallback = defaultById[id];
      const formFields =
        Array.isArray(item.formFields) && item.formFields.length
          ? normalizeFormFields(item.formFields)
          : normalizeFormFields(fallback?.formFields || []);
      return {
        id,
        name: String(item.name || '').trim(),
        description: item.description || '',
        color: item.color || '',
        isDefault: Boolean(item.isDefault),
        formFields,
      };
    })
    .filter((item) => {
      if (!item.name || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function normalizePrefix(prefix) {
  const cleaned = String(prefix || 'TKT')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return cleaned || 'TKT';
}

export async function ensureIssueOrgConfig(organizationId) {
  let config = await IssueOrgConfig.findOne({ organizationId });
  const defaults = getDefaultIssueOrgConfig();

  if (!config) {
    config = await IssueOrgConfig.create({
      organizationId,
      ...defaults,
    });
    return config;
  }

  let dirty = false;
  if (!config.statuses?.length) {
    config.statuses = defaults.statuses;
    dirty = true;
  }
  if (!config.priorities?.length) {
    config.priorities = defaults.priorities;
    dirty = true;
  }
  if (!config.severities?.length) {
    config.severities = defaults.severities;
    dirty = true;
  }
  if (!config.issueTypes?.length) {
    config.issueTypes = defaults.issueTypes;
    dirty = true;
  } else {
    // Backfill formFields for types that were seeded without them
    const defaultById = Object.fromEntries(defaults.issueTypes.map((t) => [t.id, t]));
    let typesDirty = false;
    config.issueTypes = config.issueTypes.map((t) => {
      const plain = t.toObject ? t.toObject() : t;
      if (Array.isArray(plain.formFields) && plain.formFields.length) return plain;
      const fallback = defaultById[plain.id];
      if (fallback?.formFields?.length) {
        typesDirty = true;
        return { ...plain, formFields: fallback.formFields };
      }
      return plain;
    });
    if (typesDirty) dirty = true;
  }
  if (!config.settings) {
    config.settings = { ...defaults.settings };
    dirty = true;
  } else if (!config.settings.ticketPrefix) {
    config.settings.ticketPrefix = defaults.settings.ticketPrefix;
    dirty = true;
  }
  if (config.settings.requireVerificationBeforeClose === undefined) {
    config.settings.requireVerificationBeforeClose = defaults.settings.requireVerificationBeforeClose;
    dirty = true;
  }
  if (config.settings.preventSelfVerification === undefined) {
    config.settings.preventSelfVerification = defaults.settings.preventSelfVerification;
    dirty = true;
  }
  if (config.settings.employeeIdAutoSeq == null || Number(config.settings.employeeIdAutoSeq) < 1) {
    config.settings.employeeIdAutoSeq = defaults.settings.employeeIdAutoSeq || 1;
    dirty = true;
  }
  if (dirty) await config.save();

  return config;
}

export async function getIssueOrgConfig(organizationId) {
  return ensureIssueOrgConfig(organizationId);
}

export async function updateIssueOrgConfig(organizationId, userId, payload) {
  const defaults = getDefaultIssueOrgConfig();
  const config = await ensureIssueOrgConfig(organizationId);

  if (payload.statuses) {
    config.statuses = normalizeOptionList(payload.statuses, defaults.statuses);
  }
  if (payload.priorities) {
    config.priorities = normalizeOptionList(payload.priorities, defaults.priorities);
  }
  if (payload.severities) {
    config.severities = normalizeOptionList(payload.severities, defaults.severities);
  }
  if (payload.issueTypes) {
    config.issueTypes = normalizeIssueTypes(payload.issueTypes, defaults.issueTypes);
  }
  if (payload.settings) {
    config.settings = {
      ticketPrefix: normalizePrefix(payload.settings.ticketPrefix ?? config.settings?.ticketPrefix),
      defaultPriorityId:
        payload.settings.defaultPriorityId ||
        config.settings?.defaultPriorityId ||
        defaults.settings.defaultPriorityId,
      defaultSeverityId:
        payload.settings.defaultSeverityId ||
        config.settings?.defaultSeverityId ||
        defaults.settings.defaultSeverityId,
      defaultIssueTypeId:
        payload.settings.defaultIssueTypeId ||
        config.settings?.defaultIssueTypeId ||
        defaults.settings.defaultIssueTypeId,
      defaultWorkflowKey:
        payload.settings.defaultWorkflowKey ||
        config.settings?.defaultWorkflowKey ||
        defaults.settings.defaultWorkflowKey,
      requireVerificationBeforeClose:
        payload.settings.requireVerificationBeforeClose !== undefined
          ? Boolean(payload.settings.requireVerificationBeforeClose)
          : config.settings?.requireVerificationBeforeClose !== false,
      preventSelfVerification:
        payload.settings.preventSelfVerification !== undefined
          ? Boolean(payload.settings.preventSelfVerification)
          : config.settings?.preventSelfVerification !== false,
      employeeIdAutoSeq: Math.max(
        1,
        Number(
          payload.settings.employeeIdAutoSeq ??
            config.settings?.employeeIdAutoSeq ??
            defaults.settings.employeeIdAutoSeq ??
            1
        ) || 1
      ),
    };
  }

  config.updatedBy = userId;
  await config.save();
  return config;
}
