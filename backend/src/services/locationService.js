import mongoose from 'mongoose';
import { Location, LocationType, Asset, Issue } from '../models/index.js';
import { DEFAULT_LOCATION_TYPES, LOCATION_TEMPLATES } from '../constants/locationDefaults.js';

function slugKey(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || `type_${Date.now()}`;
}

export async function ensureDefaultLocationTypes(organizationId) {
  const existing = await LocationType.find({ organizationId }).lean();
  if (existing.length > 0) return existing;

  const docs = DEFAULT_LOCATION_TYPES.map((t) => ({
    ...t,
    isDefault: true,
    organizationId,
  }));
  await LocationType.insertMany(docs);
  return LocationType.find({ organizationId }).sort({ order: 1 }).lean();
}

export async function getLocationTypes(organizationId) {
  const types = await LocationType.find({ organizationId }).sort({ order: 1, name: 1 }).lean();
  if (types.length === 0) return ensureDefaultLocationTypes(organizationId);
  return types;
}

export function buildPath(name, parentPath) {
  return parentPath ? `${parentPath}/${name}` : name;
}

export async function getParentPath(organizationId, parentId) {
  if (!parentId) return '';
  const parent = await Location.findOne({ _id: parentId, organizationId }).lean();
  return parent?.path || parent?.name || '';
}

export async function wouldCreateCycle(organizationId, nodeId, newParentId) {
  if (!newParentId) return false;
  if (String(nodeId) === String(newParentId)) return true;

  let current = newParentId;
  const seen = new Set();
  while (current) {
    if (String(current) === String(nodeId)) return true;
    if (seen.has(String(current))) break;
    seen.add(String(current));
    const loc = await Location.findOne({ _id: current, organizationId }).select('parentId').lean();
    if (!loc) break;
    current = loc.parentId;
  }
  return false;
}

export async function getDescendantIds(organizationId, rootId) {
  const all = await Location.find({ organizationId }).select('_id parentId').lean();
  const byParent = new Map();
  for (const loc of all) {
    const pid = loc.parentId ? String(loc.parentId) : '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(String(loc._id));
  }

  const result = [];
  const stack = [String(rootId)];
  while (stack.length) {
    const id = stack.pop();
    result.push(id);
    const children = byParent.get(id) || [];
    for (const c of children) stack.push(c);
  }
  return result;
}

export async function recomputePathsForSubtree(organizationId, rootId) {
  const root = await Location.findOne({ _id: rootId, organizationId }).lean();
  if (!root) return;

  const all = await Location.find({ organizationId }).lean();
  const byParent = new Map();
  for (const loc of all) {
    const pid = loc.parentId ? String(loc.parentId) : '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(loc);
  }

  async function walk(node, parentPath) {
    const path = buildPath(node.name, parentPath);
    if (node.path !== path) {
      await Location.updateOne({ _id: node._id }, { path });
    }
    const children = byParent.get(String(node._id)) || [];
    for (const child of children) {
      await walk(child, path);
    }
  }

  const parentPath = root.parentId
    ? (await Location.findById(root.parentId).select('path name').lean())?.path ||
      (await Location.findById(root.parentId).select('name').lean())?.name ||
      ''
    : '';

  await walk(root, parentPath);
}

export async function deleteLocationSubtree(organizationId, id) {
  const ids = await getDescendantIds(organizationId, id);
  const objectIds = ids.map((i) => new mongoose.Types.ObjectId(i));
  await Location.deleteMany({ _id: { $in: objectIds }, organizationId });
  return ids.length;
}

export async function duplicateLocationBranch(organizationId, id, newRootName) {
  const root = await Location.findOne({ _id: id, organizationId }).lean();
  if (!root) throw new Error('Location not found');

  const all = await Location.find({ organizationId }).lean();
  const subtreeIds = new Set(await getDescendantIds(organizationId, id));
  const nodes = all.filter((l) => subtreeIds.has(String(l._id)));

  const idMap = new Map();
  const depthOf = (node) => {
    let d = 0;
    let cur = node;
    const byId = new Map(nodes.map((n) => [String(n._id), n]));
    while (cur?.parentId) {
      d++;
      cur = byId.get(String(cur.parentId));
    }
    return d;
  };
  const sorted = [...nodes].sort((a, b) => depthOf(a) - depthOf(b));

  const created = [];
  for (const node of sorted) {
    const isRoot = String(node._id) === String(id);
    const parentId = isRoot
      ? node.parentId
      : idMap.get(String(node.parentId)) || null;

    const parentPath = parentId
      ? created.find((c) => String(c._id) === String(parentId))?.path || ''
      : '';

    const name = isRoot ? newRootName || `${node.name} (Copy)` : node.name;
    const path = buildPath(name, isRoot ? await getParentPath(organizationId, parentId) : parentPath);

    const doc = await Location.create({
      name,
      type: node.type,
      parentId: parentId || null,
      path,
      code: isRoot ? '' : node.code,
      description: node.description || '',
      capacity: node.capacity,
      managerId: node.managerId,
      notes: node.notes || '',
      departmentId: node.departmentId,
      organizationId,
    });
    idMap.set(String(node._id), String(doc._id));
    created.push(doc.toObject());
  }

  return created[0];
}

export async function moveLocation(organizationId, id, newParentId) {
  if (await wouldCreateCycle(organizationId, id, newParentId)) {
    throw new Error('Cannot move location: would create a circular hierarchy');
  }

  if (newParentId) {
    const parent = await Location.findOne({ _id: newParentId, organizationId }).lean();
    if (!parent) throw new Error('Invalid parent location');
  }

  const node = await Location.findOne({ _id: id, organizationId });
  if (!node) throw new Error('Location not found');

  const parentPath = await getParentPath(organizationId, newParentId);
  node.parentId = newParentId || null;
  node.path = buildPath(node.name, parentPath);
  await node.save();
  await recomputePathsForSubtree(organizationId, id);
  return node.toObject();
}

export function applyNamingPattern(pattern, num) {
  const padded = String(num).padStart(2, '0');
  return pattern.replace(/\{number\}/gi, String(num)).replace(/\{n\}/gi, padded);
}

export async function bulkGenerateLocations(organizationId, parentId, { type, start, end, namingPattern, namePrefix }) {
  const parent = parentId
    ? await Location.findOne({ _id: parentId, organizationId }).lean()
    : null;
  if (parentId && !parent) throw new Error('Invalid parent location');

  const parentPath = parent?.path || parent?.name || '';
  const pattern = namingPattern || `${namePrefix || 'Item'} {number}`;
  const from = Number(start);
  const to = Number(end);
  if (Number.isNaN(from) || Number.isNaN(to) || from > to) {
    throw new Error('Invalid start/end range');
  }
  if (to - from > 200) throw new Error('Cannot generate more than 200 locations at once');

  const created = [];
  for (let n = from; n <= to; n++) {
    const name = applyNamingPattern(pattern, n);
    const path = buildPath(name, parentPath);
    const doc = await Location.create({
      name,
      type,
      parentId: parentId || null,
      path,
      organizationId,
    });
    created.push(doc.toObject());
  }
  return created;
}

export async function applyLocationTemplate(organizationId, templateKey, rootName) {
  const template = LOCATION_TEMPLATES[templateKey];
  if (!template) throw new Error('Unknown template');

  let parentId = null;
  let parentPath = '';
  const root = await Location.create({
    name: rootName,
    type: template.rootType,
    parentId: null,
    path: rootName,
    organizationId,
  });
  parentId = root._id;
  parentPath = root.path;

  let last = root.toObject();
  for (const level of template.skeleton) {
    const path = buildPath(level.name, parentPath);
    const child = await Location.create({
      name: level.name,
      type: level.type,
      parentId,
      path,
      organizationId,
    });
    parentId = child._id;
    parentPath = path;
    last = child.toObject();
  }

  return root.toObject();
}

async function rollupCounts(locations) {
  const orgIds = [...new Set(locations.map((l) => String(l.organizationId)))];
  if (orgIds.length !== 1) return locations;

  const organizationId = locations[0].organizationId;
  const locIds = locations.map((l) => l._id);

  const [assetAgg, issueAgg] = await Promise.all([
    Asset.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(String(organizationId)), locationId: { $in: locIds } } },
      { $group: { _id: '$locationId', count: { $sum: 1 } } },
    ]),
    Issue.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(String(organizationId)), locationId: { $in: locIds } } },
      { $group: { _id: '$locationId', count: { $sum: 1 } } },
    ]),
  ]);

  const directAssets = new Map(assetAgg.map((a) => [String(a._id), a.count]));
  const directIssues = new Map(issueAgg.map((i) => [String(i._id), i.count]));

  const byParent = new Map();
  for (const loc of locations) {
    const pid = loc.parentId ? String(loc.parentId) : '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(loc);
  }

  function enrich(node) {
    const id = String(node._id);
    const children = (byParent.get(id) || []).map(enrich);
    const childCount = children.length;
    let assetCount = directAssets.get(id) || 0;
    let issueCount = directIssues.get(id) || 0;
    for (const c of children) {
      assetCount += c.stats.assetCount;
      issueCount += c.stats.issueCount;
    }
    return {
      ...node,
      children,
      stats: { assetCount, issueCount, childCount },
    };
  }

  const roots = (byParent.get('') || []).map(enrich);
  return roots;
}

export async function getLocationTree(organizationId) {
  const locations = await Location.find({ organizationId })
    .populate('departmentId', 'name')
    .populate('managerId', 'name email')
    .sort({ name: 1 })
    .lean();
  return await rollupCounts(locations);
}

export async function searchLocations(organizationId, query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return Location.find({
    organizationId,
    $or: [{ name: re }, { path: re }, { code: re }],
  })
    .sort({ path: 1 })
    .limit(25)
    .lean();
}

export async function bulkMoveLocations(organizationId, ids, newParentId) {
  if (!ids?.length) throw new Error('No locations selected');
  if (newParentId) {
    const parent = await Location.findOne({ _id: newParentId, organizationId }).lean();
    if (!parent) throw new Error('Invalid parent location');
  }

  for (const id of ids) {
    if (newParentId && ids.includes(String(newParentId))) {
      throw new Error('Cannot move a location into itself');
    }
    if (await wouldCreateCycle(organizationId, id, newParentId)) {
      throw new Error('Cannot move: would create a circular hierarchy');
    }
  }

  for (const id of ids) {
    await moveLocation(organizationId, id, newParentId);
  }
  return ids.length;
}

export async function bulkDeleteLocations(organizationId, ids) {
  const allIds = new Set();
  for (const id of ids) {
    const desc = await getDescendantIds(organizationId, id);
    desc.forEach((d) => allIds.add(d));
  }
  const objectIds = [...allIds].map((i) => new mongoose.Types.ObjectId(i));
  await Location.deleteMany({ _id: { $in: objectIds }, organizationId });
  return objectIds.length;
}

export async function createLocationType(organizationId, body) {
  const key = body.key || slugKey(body.name);
  const existing = await LocationType.findOne({ organizationId, key }).lean();
  if (existing) throw new Error('A location type with this key already exists');

  const maxOrder = await LocationType.findOne({ organizationId }).sort({ order: -1 }).select('order').lean();
  return LocationType.create({
    key,
    name: body.name,
    icon: body.icon || '📍',
    color: body.color || '',
    order: body.order ?? (maxOrder?.order ?? 0) + 1,
    isDefault: false,
    organizationId,
  });
}

export { LOCATION_TEMPLATES, DEFAULT_LOCATION_TYPES, slugKey };
