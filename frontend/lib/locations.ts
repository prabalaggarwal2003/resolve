export type LocationTypeDef = {
  _id: string;
  key: string;
  name: string;
  icon: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
};

export type LocationStats = {
  assetCount: number;
  issueCount: number;
  childCount: number;
};

export type LocationTreeNode = {
  _id: string;
  name: string;
  type: string;
  parentId?: string | null;
  path?: string;
  code?: string;
  description?: string;
  capacity?: number | null;
  notes?: string;
  departmentId?: { _id: string; name: string } | null;
  managerId?: { _id: string; name: string; email?: string } | null;
  children?: LocationTreeNode[];
  stats?: LocationStats;
};

export type LocationTemplate = {
  key: string;
  name: string;
  description: string;
  rootType: string;
};

export function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function typeDef(types: LocationTypeDef[], key: string): LocationTypeDef {
  return (
    types.find((t) => t.key === key) || {
      _id: key,
      key,
      name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: '📍',
    }
  );
}

export function flattenTree(nodes: LocationTreeNode[]): LocationTreeNode[] {
  const out: LocationTreeNode[] = [];
  const walk = (list: LocationTreeNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function formatLocationBreadcrumb(path?: string, name?: string): string {
  if (path?.trim()) {
    return path
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' > ');
  }
  return name?.trim() || '—';
}

export function breadcrumbForNode(node?: Pick<LocationTreeNode, 'path' | 'name'> | null): string {
  if (!node) return '—';
  return formatLocationBreadcrumb(node.path, node.name);
}

export function findNodePath(nodes: LocationTreeNode[], targetId: string): LocationTreeNode[] {
  for (const n of nodes) {
    if (n._id === targetId) return [n];
    if (n.children?.length) {
      const sub = findNodePath(n.children, targetId);
      if (sub.length) return [n, ...sub];
    }
  }
  return [];
}

export function collectDescendantIds(node: LocationTreeNode): string[] {
  const ids = [node._id];
  for (const c of node.children || []) {
    ids.push(...collectDescendantIds(c));
  }
  return ids;
}

export const EXPANDED_STORAGE_KEY = 'locations-tree-expanded-ids';
export const RECENT_EDIT_KEY = 'locations-tree-recent-edit';

export function loadExpandedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveExpandedIds(ids: Set<string>) {
  localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(Array.from(ids)));
}
