import { AssetGroup, AssetTemplate } from '../models/index.js';
import {
  DEFAULT_ASSET_GROUPS,
  DEFAULT_TEMPLATE_GROUP_MAP,
} from '../constants/assetGroupDefaults.js';

function slugKey(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || `group_${Date.now()}`;
}

export async function ensureDefaultAssetGroups(organizationId, userId) {
  const existing = await AssetGroup.find({ organizationId }).sort({ order: 1 }).lean();
  if (existing.length > 0) return existing;

  const docs = DEFAULT_ASSET_GROUPS.map((g) => ({
    organizationId,
    name: g.name,
    key: g.key,
    order: g.order,
    isDefault: true,
    createdBy: userId,
    updatedBy: userId,
  }));
  await AssetGroup.insertMany(docs);
  return AssetGroup.find({ organizationId }).sort({ order: 1 }).lean();
}

export async function assignDefaultTemplateGroups(organizationId) {
  const groups = await AssetGroup.find({ organizationId }).lean();
  if (!groups.length) return;

  const byKey = Object.fromEntries(groups.filter((g) => g.key).map((g) => [g.key, g._id]));
  const templates = await AssetTemplate.find({ organizationId, groupId: null }).lean();

  for (const tpl of templates) {
    const groupKey = DEFAULT_TEMPLATE_GROUP_MAP[tpl.name];
    if (!groupKey || !byKey[groupKey]) continue;
    await AssetTemplate.updateOne({ _id: tpl._id }, { groupId: byKey[groupKey] });
  }
}

export async function getAssetGroupBoard(organizationId, userId) {
  await ensureDefaultAssetGroups(organizationId, userId);
  await assignDefaultTemplateGroups(organizationId);

  const [groups, templates] = await Promise.all([
    AssetGroup.find({ organizationId }).sort({ order: 1, name: 1 }).lean(),
    AssetTemplate.find({ organizationId })
      .sort({ sortOrder: 1, isDefault: -1, name: 1 })
      .lean(),
  ]);

  const unassigned = templates.filter((t) => !t.groupId);
  const grouped = groups.map((group) => ({
    ...group,
    templates: templates
      .filter((t) => String(t.groupId) === String(group._id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
  }));

  return { groups: grouped, unassigned };
}

export async function createAssetGroup(organizationId, userId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Group name is required');

  const dup = await AssetGroup.findOne({ organizationId, name: trimmed });
  if (dup) throw new Error('A group with this name already exists');

  const maxOrder = await AssetGroup.findOne({ organizationId }).sort({ order: -1 }).select('order').lean();
  const order = (maxOrder?.order ?? -1) + 1;

  return AssetGroup.create({
    organizationId,
    name: trimmed,
    key: slugKey(trimmed),
    order,
    isDefault: false,
    createdBy: userId,
    updatedBy: userId,
  });
}

export async function deleteAssetGroup(organizationId, groupId) {
  const group = await AssetGroup.findOne({ _id: groupId, organizationId });
  if (!group) throw new Error('Group not found');

  await AssetTemplate.updateMany({ organizationId, groupId: group._id }, { groupId: null });
  await group.deleteOne();
  return { message: 'Group deleted' };
}

export async function updateTemplateLayout(organizationId, userId, assignments) {
  if (!Array.isArray(assignments)) throw new Error('assignments must be an array');

  for (const item of assignments) {
    if (!item?.templateId) continue;
    const groupId = item.groupId || null;
    if (groupId) {
      const group = await AssetGroup.findOne({ _id: groupId, organizationId }).lean();
      if (!group) throw new Error('Invalid group');
    }
    const sortOrder = typeof item.sortOrder === 'number' ? item.sortOrder : 0;
    await AssetTemplate.updateOne(
      { _id: item.templateId, organizationId },
      { groupId, sortOrder }
    );
  }

  return getAssetGroupBoard(organizationId, userId);
}

export async function listAssetGroups(organizationId, userId) {
  await ensureDefaultAssetGroups(organizationId, userId);
  return AssetGroup.find({ organizationId }).sort({ order: 1, name: 1 }).lean();
}
