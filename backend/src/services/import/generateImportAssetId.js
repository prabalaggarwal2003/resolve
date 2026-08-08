import Asset from '../../models/Asset.js';

const IMP_PATTERN = /^IMP-(\d+)$/i;

/**
 * Highest numeric suffix among existing IMP-#### asset IDs (global — assetId is unique).
 */
export async function getMaxImportAssetSeq() {
  const docs = await Asset.find({ assetId: { $regex: /^IMP-\d+$/i } })
    .select('assetId')
    .lean();
  let highest = 0;
  for (const doc of docs) {
    const m = String(doc.assetId || '').match(IMP_PATTERN);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > highest) highest = n;
    }
  }
  return highest;
}

function formatImportAssetId(seq) {
  return `IMP-${String(seq).padStart(4, '0')}`;
}

/**
 * Allocate the next unique auto-generated import Asset ID.
 * `used` is a Set of lowercase ids already reserved in this job/batch.
 */
export async function nextUniqueImportAssetId(used = new Set()) {
  let seq = (await getMaxImportAssetSeq()) + 1;

  // Also respect in-memory reservations (same file / batch)
  for (const id of used) {
    const m = String(id).match(IMP_PATTERN);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= seq) seq = n + 1;
    }
  }

  for (let guard = 0; guard < 10000; guard += 1) {
    const candidate = formatImportAssetId(seq);
    const lower = candidate.toLowerCase();
    if (used.has(lower)) {
      seq += 1;
      continue;
    }
    const exists = await Asset.exists({ assetId: new RegExp(`^${candidate}$`, 'i') });
    if (!exists) {
      used.add(lower);
      return candidate;
    }
    seq += 1;
  }

  // Extremely unlikely fallback
  const fallback = `IMP-${Date.now().toString(36).toUpperCase()}`;
  used.add(fallback.toLowerCase());
  return fallback;
}

/**
 * Pre-allocate `count` unique IMP ids after the current max (plus any already in `used`).
 * Faster for validation of many blank-ID rows — one DB scan then sequential assign.
 */
export async function allocateImportAssetIds(count, used = new Set()) {
  if (count <= 0) return [];
  let seq = (await getMaxImportAssetSeq()) + 1;
  for (const id of used) {
    const m = String(id).match(IMP_PATTERN);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= seq) seq = n + 1;
    }
  }

  const allocated = [];
  while (allocated.length < count) {
    const candidate = formatImportAssetId(seq);
    const lower = candidate.toLowerCase();
    seq += 1;
    if (used.has(lower)) continue;
    // Skip any that somehow exist outside IMP scan edge cases
    used.add(lower);
    allocated.push(candidate);
  }
  return allocated;
}
