/** Default asset statuses — templates may add custom ones */
export const DEFAULT_ASSET_STATUSES = [
  'available',
  'in_use',
  'under_maintenance',
  'retired',
  'working',
  'needs_repair',
  'out_of_service',
];

/** Standard statuses that count as inactive for KPI metrics */
export const INACTIVE_ASSET_STATUSES = new Set([
  'under_maintenance',
  'needs_repair',
  'out_of_service',
  'retired',
]);

export function isActiveAssetStatus(status) {
  if (!status) return true;
  return !INACTIVE_ASSET_STATUSES.has(status);
}

export function collectAssetStatusesFromTemplates(templates = []) {
  const seen = new Set();
  const ordered = [];
  const add = (status) => {
    const key = String(status || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    ordered.push(key);
  };
  for (const s of DEFAULT_ASSET_STATUSES) add(s);
  for (const tpl of templates) {
    for (const s of tpl.statuses || []) add(s);
  }
  return ordered;
}
