export const DEFAULT_ASSET_STATUSES = [
  'available',
  'in_use',
  'under_maintenance',
  'retired',
  'working',
  'needs_repair',
  'out_of_service',
] as const;

/** Standard statuses treated as inactive — custom template statuses are not included */
export const INACTIVE_ASSET_STATUSES = new Set([
  'under_maintenance',
  'needs_repair',
  'out_of_service',
  'retired',
]);

export function isActiveAssetStatus(status?: string | null): boolean {
  if (!status) return true;
  return !INACTIVE_ASSET_STATUSES.has(status);
}

export function formatAssetStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

/** Merge default statuses with all custom statuses defined on asset templates */
export function collectAssetStatusOptions(
  templates: Array<{ statuses?: string[] }> = [],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const add = (status: string) => {
    const key = status.trim();
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
