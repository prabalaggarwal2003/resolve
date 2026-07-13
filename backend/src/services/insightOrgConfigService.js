import InsightOrgConfig from '../models/InsightOrgConfig.js';
import InsightRule from '../models/InsightRule.js';
import { DEFAULT_INSIGHT_THRESHOLDS, getDefaultInsightRules } from '../constants/insightDefaults.js';

export async function getInsightOrgConfig(organizationId) {
  return ensureInsightOrgConfig(organizationId);
}

export async function ensureInsightOrgConfig(organizationId) {
  let config = await InsightOrgConfig.findOne({ organizationId }).lean();
  if (!config) {
    config = (
      await InsightOrgConfig.create({
        organizationId,
        thresholds: { ...DEFAULT_INSIGHT_THRESHOLDS },
        notifications: { showOnDashboard: true, showInApp: true, maxDashboardItems: 20 },
        seededAt: new Date(),
      })
    ).toObject();
    await seedDefaultRules(organizationId);
  } else {
    const merged = { ...DEFAULT_INSIGHT_THRESHOLDS, ...(config.thresholds || {}) };
    const missingThresholds = Object.keys(DEFAULT_INSIGHT_THRESHOLDS).some(
      (k) => config.thresholds?.[k] == null
    );
    if (missingThresholds) {
      await InsightOrgConfig.updateOne({ organizationId }, { $set: { thresholds: merged } });
      config.thresholds = merged;
    }
    const defaultNotifications = {
      showOnDashboard: true,
      showInApp: true,
      maxDashboardItems: 20,
    };
    if (!config.notifications) {
      await InsightOrgConfig.updateOne(
        { organizationId },
        { $set: { notifications: defaultNotifications } }
      );
      config.notifications = defaultNotifications;
    }
    await ensureBuiltinRules(organizationId);
  }
  return config;
}

async function seedDefaultRules(organizationId) {
  const defaults = getDefaultInsightRules();
  const docs = defaults.map((r) => ({
    organizationId,
    ...r,
    isBuiltin: true,
  }));
  await InsightRule.insertMany(docs, { ordered: false }).catch(() => {});
}

async function ensureBuiltinRules(organizationId) {
  const existing = await InsightRule.find({ organizationId, isBuiltin: true }).select('ruleKey').lean();
  const existingKeys = new Set(existing.map((r) => r.ruleKey));
  const missing = getDefaultInsightRules().filter((r) => !existingKeys.has(r.ruleKey));
  if (!missing.length) return;
  await InsightRule.insertMany(
    missing.map((r) => ({ organizationId, ...r, isBuiltin: true })),
    { ordered: false }
  ).catch(() => {});
}

export async function updateInsightOrgConfig(organizationId, userId, body) {
  await ensureInsightOrgConfig(organizationId);
  const update = {};
  if (body.thresholds && typeof body.thresholds === 'object') {
    update.thresholds = body.thresholds;
  }
  if (body.notifications && typeof body.notifications === 'object') {
    update.notifications = body.notifications;
  }
  update.updatedBy = userId;
  const config = await InsightOrgConfig.findOneAndUpdate(
    { organizationId },
    { $set: update },
    { new: true }
  ).lean();
  return config;
}

export async function listInsightRules(organizationId) {
  await ensureInsightOrgConfig(organizationId);
  return InsightRule.find({ organizationId }).sort({ order: 1, name: 1 }).lean();
}

export async function getInsightRuleById(organizationId, id) {
  return InsightRule.findOne({ organizationId, _id: id }).lean();
}

export async function updateInsightRule(organizationId, userId, id, body) {
  const rule = await InsightRule.findOne({ organizationId, _id: id });
  if (!rule) {
    const err = new Error('Insight rule not found');
    err.status = 404;
    throw err;
  }

  const allowed = [
    'name', 'description', 'category', 'severity', 'enabled',
    'messageTemplate', 'conditionTree', 'link', 'order',
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) rule[key] = body[key];
  }
  rule.updatedBy = userId;
  await rule.save();
  return rule.toObject();
}

export async function createCustomInsightRule(organizationId, userId, body) {
  if (!body.name?.trim()) {
    const err = new Error('Rule name is required');
    err.status = 400;
    throw err;
  }
  const ruleKey = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const maxOrder = await InsightRule.findOne({ organizationId }).sort({ order: -1 }).select('order').lean();
  const rule = await InsightRule.create({
    organizationId,
    ruleKey,
    isBuiltin: false,
    name: body.name.trim(),
    description: body.description || '',
    category: body.category || 'custom',
    ruleType: body.ruleType || 'asset',
    severity: body.severity || 'warning',
    enabled: body.enabled !== false,
    messageTemplate: body.messageTemplate || '{{count}} items match "{{name}}"',
    conditionTree: body.conditionTree || { rootLogic: 'and', groups: [{ logic: 'and', conditions: [] }] },
    link: body.link || '/dashboard/assets',
    order: body.order ?? (maxOrder?.order ?? 0) + 1,
    createdBy: userId,
    updatedBy: userId,
  });
  return rule.toObject();
}

export async function deleteInsightRule(organizationId, id) {
  const rule = await InsightRule.findOne({ organizationId, _id: id });
  if (!rule) {
    const err = new Error('Insight rule not found');
    err.status = 404;
    throw err;
  }
  if (rule.isBuiltin) {
    const err = new Error('Built-in rules cannot be deleted. Disable them instead.');
    err.status = 400;
    throw err;
  }
  await rule.deleteOne();
  return { message: 'Rule deleted' };
}

export async function resetInsightRule(organizationId, userId, id) {
  const rule = await InsightRule.findOne({ organizationId, _id: id });
  if (!rule || !rule.isBuiltin) {
    const err = new Error('Built-in rule not found');
    err.status = 404;
    throw err;
  }
  const defaults = getDefaultInsightRules().find((r) => r.ruleKey === rule.ruleKey);
  if (!defaults) {
    const err = new Error('Default rule definition not found');
    err.status = 404;
    throw err;
  }
  Object.assign(rule, {
    name: defaults.name,
    description: defaults.description,
    category: defaults.category,
    ruleType: defaults.ruleType,
    severity: defaults.severity,
    messageTemplate: defaults.messageTemplate,
    conditionTree: defaults.conditionTree,
    link: defaults.link,
    order: defaults.order,
    updatedBy: userId,
  });
  await rule.save();
  return rule.toObject();
}
