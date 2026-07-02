export type AssetGroup = {
  _id: string;
  name: string;
  key?: string;
  order?: number;
  isDefault?: boolean;
};

export type AssetTemplateSummary = {
  _id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  fields?: { key: string }[];
  groupId?: string | null;
  sortOrder?: number;
};

export type AssetGroupWithTemplates = AssetGroup & {
  templates: AssetTemplateSummary[];
};

export type TemplateGroupBoardData = {
  groups: AssetGroupWithTemplates[];
  unassigned: AssetTemplateSummary[];
};

export function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

export function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export function buildLayoutAssignments(board: TemplateGroupBoardData) {
  const assignments: { templateId: string; groupId: string | null; sortOrder: number }[] = [];
  board.unassigned.forEach((t, i) => {
    assignments.push({ templateId: t._id, groupId: null, sortOrder: i });
  });
  for (const group of board.groups) {
    group.templates.forEach((t, i) => {
      assignments.push({ templateId: t._id, groupId: group._id, sortOrder: i });
    });
  }
  return assignments;
}
