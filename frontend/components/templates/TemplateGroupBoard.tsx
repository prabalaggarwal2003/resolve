'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import type { AssetGroupWithTemplates, AssetTemplateSummary, TemplateGroupBoardData } from '@/lib/assetGroups';
import { api, authHeaders, buildLayoutAssignments } from '@/lib/assetGroups';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const dropZoneClass =
  'min-h-[120px] rounded-xl border border-dashed border-gray-700/60 bg-gray-900/30 p-2 space-y-2';

function TemplateCard({
  template,
  canEdit,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  template: AssetTemplateSummary;
  canEdit: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/template-id', template._id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`rounded-lg border border-gray-700/60 bg-gray-800/60 px-3 py-2 ${
        canEdit ? 'cursor-grab active:cursor-grabbing hover:border-violet-500/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-100 truncate">{template.name}</p>
          {template.description && (
            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>
        <span className="text-[10px] text-gray-600 shrink-0">{template.fields?.length || 0}f</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Link
          href={`/dashboard/assets/templates/${template._id}`}
          className={`${buttonClass} border-gray-700/60 text-gray-300 hover:bg-gray-700/40 no-underline`}
          onClick={(e) => e.stopPropagation()}
        >
          Edit
        </Link>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className={`${buttonClass} border-red-500/40 bg-red-500/10 text-red-300`}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function DropColumn({
  title,
  subtitle,
  templates,
  groupId,
  canEdit,
  onDrop,
  onDeleteGroup,
  onDeleteTemplate,
  draggingId,
  setDraggingId,
  accent,
}: {
  title: string;
  subtitle?: string;
  templates: AssetTemplateSummary[];
  groupId: string | null;
  canEdit: boolean;
  onDrop: (templateId: string, targetGroupId: string | null, index: number) => void;
  onDeleteGroup?: () => void;
  onDeleteTemplate?: (template: AssetTemplateSummary) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  accent?: string;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    setDragOver(true);
  };

  const handleDrop = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    setDragOver(false);
    const templateId = e.dataTransfer.getData('text/template-id') || draggingId;
    if (!templateId) return;
    onDrop(templateId, groupId, index ?? templates.length);
  };

  return (
    <div className="flex flex-col min-w-[240px] flex-1">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${accent || 'text-gray-300'}`}>{title}</p>
          {subtitle && <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {onDeleteGroup && canEdit && (
          <button
            type="button"
            onClick={onDeleteGroup}
            className={`${buttonClass} border-red-500/40 text-red-300 shrink-0`}
          >
            Delete
          </button>
        )}
      </div>
      <div
        className={`${dropZoneClass} flex-1 ${dragOver ? 'border-violet-500/50 bg-violet-500/5' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => handleDrop(e)}
      >
        {templates.length === 0 && (
          <p className="text-[11px] text-gray-600 text-center py-6">Drop templates here</p>
        )}
        {templates.map((t, index) => (
          <div
            key={t._id}
            onDragOver={(e) => {
              if (!canEdit) return;
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.stopPropagation();
              handleDrop(e, index);
            }}
          >
            <TemplateCard
              template={t}
              canEdit={canEdit}
              onDragStart={() => setDraggingId(t._id)}
              onDragEnd={() => setDraggingId(null)}
              onDelete={onDeleteTemplate ? () => onDeleteTemplate(t) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TemplateGroupBoard({
  initial,
  canEdit,
  onBoardChange,
}: {
  initial: TemplateGroupBoardData;
  canEdit: boolean;
  onBoardChange?: (board: TemplateGroupBoardData) => void;
}) {
  const [board, setBoard] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState('');

  const persistBoard = useCallback(
    async (next: TemplateGroupBoardData) => {
      setBoard(next);
      onBoardChange?.(next);
      if (!canEdit) return;
      setSaving(true);
      setError('');
      try {
        const res = await fetch(api('/api/asset-groups/layout'), {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ assignments: buildLayoutAssignments(next) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to save layout');
        setBoard(data);
        onBoardChange?.(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSaving(false);
      }
    },
    [canEdit, onBoardChange]
  );

  const findAndRemove = (templateId: string, data: TemplateGroupBoardData) => {
    const unassigned = data.unassigned.filter((t) => t._id !== templateId);
    const groups = data.groups.map((g) => ({
      ...g,
      templates: g.templates.filter((t) => t._id !== templateId),
    }));
    let template: AssetTemplateSummary | undefined =
      data.unassigned.find((t) => t._id === templateId) ||
      data.groups.flatMap((g) => g.templates).find((t) => t._id === templateId);
    return { unassigned, groups, template };
  };

  const handleDrop = (templateId: string, targetGroupId: string | null, index: number) => {
    const { unassigned, groups, template } = findAndRemove(templateId, board);
    if (!template) return;

    if (!targetGroupId) {
      const nextUnassigned = [...unassigned];
      nextUnassigned.splice(index, 0, template);
      persistBoard({ groups, unassigned: nextUnassigned });
      return;
    }

    const nextGroups = groups.map((g) => {
      if (g._id !== targetGroupId) return g;
      const nextTemplates = [...g.templates];
      nextTemplates.splice(index, 0, template);
      return { ...g, templates: nextTemplates };
    });
    persistBoard({ groups: nextGroups, unassigned });
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setError('');
    try {
      const res = await fetch(api('/api/asset-groups'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name }),
      });
      const group = await res.json();
      if (!res.ok) throw new Error(group.message || 'Failed to create group');
      const next: TemplateGroupBoardData = {
        ...board,
        groups: [...board.groups, { ...group, templates: [] }],
      };
      setBoard(next);
      onBoardChange?.(next);
      setNewGroupName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    }
  };

  const handleDeleteTemplate = async (template: AssetTemplateSummary) => {
    if (!confirm(`Delete template "${template.name}"? Existing assets are not affected.`)) return;
    setError('');
    try {
      const res = await fetch(api(`/api/asset-templates/${template._id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Delete failed');
      }
      const { unassigned, groups } = findAndRemove(template._id, board);
      setBoard({ groups, unassigned });
      onBoardChange?.({ groups, unassigned });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeleteGroup = async (group: AssetGroupWithTemplates) => {
    if (!confirm(`Delete group "${group.name}"? Templates will move to Available.`)) return;
    setError('');
    try {
      const res = await fetch(api(`/api/asset-groups/${group._id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      const next: TemplateGroupBoardData = {
        groups: board.groups.filter((g) => g._id !== group._id),
        unassigned: [...board.unassigned, ...group.templates],
      };
      setBoard(next);
      onBoardChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const groupAccent = (group: AssetGroupWithTemplates) => {
    if (group.key === 'it') return 'text-blue-400/90';
    if (group.key === 'infra') return 'text-amber-400/90';
    if (group.key === 'consumables') return 'text-emerald-400/90';
    return 'text-violet-400/90';
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg border border-red-800 bg-red-900/20 text-red-400 text-sm">{error}</div>
      )}
      {saving && <p className="text-[11px] text-gray-500">Saving layout…</p>}

      <DropColumn
        title="Available templates"
        subtitle="New templates appear here — drag into a group"
        templates={board.unassigned}
        groupId={null}
        canEdit={canEdit}
        onDrop={handleDrop}
        onDeleteTemplate={canEdit ? handleDeleteTemplate : undefined}
        draggingId={draggingId}
        setDraggingId={setDraggingId}
        accent="text-gray-400"
      />

      <div className="flex flex-wrap gap-3 items-start">
        {board.groups.map((group) => (
          <DropColumn
            key={group._id}
            title={group.name}
            subtitle={group.isDefault ? 'Default group' : undefined}
            templates={group.templates}
            groupId={group._id}
            canEdit={canEdit}
            onDrop={handleDrop}
            onDeleteGroup={() => handleDeleteGroup(group)}
            onDeleteTemplate={canEdit ? handleDeleteTemplate : undefined}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
            accent={groupAccent(group)}
          />
        ))}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-700/40">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New group name"
            className="px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 flex-1 min-w-[160px]"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
          />
          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={!newGroupName.trim()}
            className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 disabled:opacity-50`}
          >
            + Add group
          </button>
        </div>
      )}
    </div>
  );
}
