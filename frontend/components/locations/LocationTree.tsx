'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LocationTreeNode, LocationTypeDef } from '@/lib/locations';
import { typeDef } from '@/lib/locations';

const buttonClass = 'px-2 py-0.5 text-[11px] font-medium rounded border transition-colors';
const MENU_WIDTH = 176;

type MenuAnchor = { left: number; right: number; top: number; bottom: number };

type Props = {
  nodes: LocationTreeNode[];
  types: LocationTypeDef[];
  expandedIds: Set<string>;
  selectedId: string | null;
  checkedIds: Set<string>;
  canEdit: boolean;
  highlightId?: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (node: LocationTreeNode) => void;
  onCheck: (id: string, checked: boolean) => void;
  onAddChild: (parent: LocationTreeNode) => void;
  onEdit: (node: LocationTreeNode) => void;
  onDuplicate: (node: LocationTreeNode) => void;
  onDelete: (node: LocationTreeNode) => void;
  onMove: (nodeId: string, newParentId: string | null) => void;
  onAddTopLevel?: () => void;
  orgLabel?: string;
};

function ContextMenu({
  anchor,
  cursor,
  onClose,
  onAddChild,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  anchor?: MenuAnchor;
  cursor?: { x: number; y: number };
  onClose: () => void;
  onAddChild: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const menuW = el.offsetWidth || MENU_WIDTH;
    const menuH = el.offsetHeight || 160;
    const pad = 8;

    let left: number;
    let top: number;

    if (anchor) {
      left = anchor.right - menuW;
      top = anchor.bottom + 4;
    } else if (cursor) {
      left = cursor.x;
      top = cursor.y;
    } else {
      return;
    }

    if (left + menuW > window.innerWidth - pad) left = window.innerWidth - menuW - pad;
    if (left < pad) left = pad;
    if (top + menuH > window.innerHeight - pad) {
      top = anchor ? anchor.top - menuH - 4 : cursor!.y - menuH;
    }
    if (top < pad) top = pad;

    setPos({ left, top });
  }, [anchor, cursor]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const itemClass =
    'block w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700/60';

  return (
    <div
      ref={ref}
      className="fixed z-50 w-44 rounded-lg border border-gray-700/60 bg-gray-900 shadow-xl py-1"
      style={{ left: pos.left, top: pos.top }}
    >
      <button type="button" className={itemClass} onClick={() => { onAddChild(); onClose(); }}>
        Add child
      </button>
      <button type="button" className={itemClass} onClick={() => { onEdit(); onClose(); }}>
        Edit
      </button>
      <button type="button" className={itemClass} onClick={() => { onDuplicate(); onClose(); }}>
        Duplicate branch
      </button>
      <button type="button" className={`${itemClass} text-red-300`} onClick={() => { onDelete(); onClose(); }}>
        Delete branch
      </button>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  types,
  expandedIds,
  selectedId,
  checkedIds,
  canEdit,
  highlightId,
  onToggleExpand,
  onSelect,
  onCheck,
  onAddChild,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
  onOpenMenu,
  dragNodeId,
  setDragNodeId,
}: {
  node: LocationTreeNode;
  depth: number;
  types: LocationTypeDef[];
  expandedIds: Set<string>;
  selectedId: string | null;
  checkedIds: Set<string>;
  canEdit: boolean;
  highlightId?: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (node: LocationTreeNode) => void;
  onCheck: (id: string, checked: boolean) => void;
  onAddChild: (parent: LocationTreeNode) => void;
  onEdit: (node: LocationTreeNode) => void;
  onDuplicate: (node: LocationTreeNode) => void;
  onDelete: (node: LocationTreeNode) => void;
  onMove: (nodeId: string, newParentId: string | null) => void;
  onOpenMenu: (node: LocationTreeNode, anchor: MenuAnchor, cursor?: { x: number; y: number }) => void;
  dragNodeId: string | null;
  setDragNodeId: (id: string | null) => void;
}) {
  const td = typeDef(types, node.type);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const expanded = expandedIds.has(node._id);
  const isSelected = selectedId === node._id;
  const isHighlighted = highlightId === node._id;
  const stats = node.stats;

  const openMenuFromTarget = (e: React.MouseEvent, node: LocationTreeNode) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onOpenMenu(node, {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dragged = e.dataTransfer.getData('text/location-id') || dragNodeId;
    if (!dragged || dragged === node._id) return;
    onMove(dragged, node._id);
    setDragNodeId(null);
  };

  return (
    <div className="select-none">
      <div
        className={`group flex items-center gap-1.5 py-1 px-2 rounded-lg border transition-colors min-w-0 ${
          isHighlighted
            ? 'border-amber-500/50 bg-amber-500/10'
            : isSelected
            ? 'border-blue-500/40 bg-blue-500/10'
            : 'border-transparent hover:border-gray-700/40 hover:bg-gray-800/40'
        }`}
        style={{ marginLeft: depth * 20 }}
        draggable={canEdit}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/location-id', node._id);
          setDragNodeId(node._id);
        }}
        onDragEnd={() => setDragNodeId(null)}
        onDragOver={(e) => {
          if (canEdit) e.preventDefault();
        }}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          if (canEdit) {
            e.preventDefault();
            onOpenMenu(node, {
              left: e.clientX,
              right: e.clientX,
              top: e.clientY,
              bottom: e.clientY,
            }, { x: e.clientX, y: e.clientY });
          }
        }}
      >
        {canEdit && (
          <input
            type="checkbox"
            checked={checkedIds.has(node._id)}
            onChange={(e) => onCheck(node._id, e.target.checked)}
            className="shrink-0 rounded border-gray-600"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        <button
          type="button"
          className="w-5 h-5 shrink-0 text-gray-500 hover:text-gray-300 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node._id);
          }}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '·'}
        </button>

        <button
          type="button"
          className="flex-1 min-w-0 flex items-center gap-2 text-left overflow-hidden"
          onClick={() => onSelect(node)}
        >
          <span className="shrink-0" style={td.color ? { color: td.color } : undefined}>
            {td.icon}
          </span>
          <span className="text-sm text-gray-200 truncate">{node.name}</span>
          <span className="text-[10px] text-gray-500 shrink-0 hidden md:inline">{td.name}</span>
        </button>

        {stats && (
          <span className="hidden sm:flex items-center gap-2 text-[10px] text-gray-500 shrink-0">
            {stats.assetCount > 0 && <span>{stats.assetCount} assets</span>}
            {stats.childCount > 0 && <span>{stats.childCount} children</span>}
            <span className={stats.issueCount > 0 ? 'text-amber-400/80' : ''}>
              {stats.issueCount} {stats.issueCount === 1 ? 'issue' : 'issues'}
            </span>
          </span>
        )}

        {canEdit && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 ml-1">
            <button
              type="button"
              title="Add child"
              className={`${buttonClass} border-gray-700/60 text-gray-400 hover:text-emerald-300`}
              onClick={(e) => { e.stopPropagation(); onAddChild(node); }}
            >
              +
            </button>
            <button
              type="button"
              title="Edit"
              className={`${buttonClass} border-gray-700/60 text-gray-400 hover:text-blue-300`}
              onClick={(e) => { e.stopPropagation(); onEdit(node); }}
            >
              ✏
            </button>
            <button
              type="button"
              title="More"
              className={`${buttonClass} border-gray-700/60 text-gray-400`}
              onClick={(e) => openMenuFromTarget(e, node)}
            >
              ⋮
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child._id}
              node={child}
              depth={depth + 1}
              types={types}
              expandedIds={expandedIds}
              selectedId={selectedId}
              checkedIds={checkedIds}
              canEdit={canEdit}
              highlightId={highlightId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onCheck={onCheck}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onMove={onMove}
              onOpenMenu={onOpenMenu}
              dragNodeId={dragNodeId}
              setDragNodeId={setDragNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LocationTree({
  nodes,
  types,
  expandedIds,
  selectedId,
  checkedIds,
  canEdit,
  highlightId,
  onToggleExpand,
  onSelect,
  onCheck,
  onAddChild,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
  onAddTopLevel,
  orgLabel = 'Organization',
}: Props) {
  const [contextMenu, setContextMenu] = useState<{
    node: LocationTreeNode;
    anchor?: MenuAnchor;
    cursor?: { x: number; y: number };
  } | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);

  const handleOpenMenu = useCallback(
    (node: LocationTreeNode, anchor: MenuAnchor, cursor?: { x: number; y: number }) => {
      setContextMenu({ node, anchor, cursor });
    },
    []
  );

  const rootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragged = e.dataTransfer.getData('text/location-id') || dragNodeId;
    if (!dragged) return;
    onMove(dragged, null);
    setDragNodeId(null);
  };

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/30 p-3 overflow-x-auto">
      <div
        className="flex items-center gap-2 py-1.5 px-2 mb-2 rounded-lg border border-gray-700/40 bg-gray-900/40 min-w-0"
        onDragOver={(e) => canEdit && e.preventDefault()}
        onDrop={rootDrop}
      >
        <span>📍</span>
        <span className="text-sm font-medium text-gray-200">{orgLabel}</span>
        <span className="text-[10px] text-gray-500">{nodes.length} top-level</span>
        {canEdit && onAddTopLevel && (
          <button
            type="button"
            className={`${buttonClass} ml-auto border-emerald-500/40 text-emerald-300`}
            onClick={onAddTopLevel}
          >
            + Add top-level
          </button>
        )}
      </div>

      {nodes.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">
          No locations yet. Add a top-level location or apply a template.
        </p>
      ) : (
        nodes.map((node) => (
          <TreeNode
            key={node._id}
            node={node}
            depth={0}
            types={types}
            expandedIds={expandedIds}
            selectedId={selectedId}
            checkedIds={checkedIds}
            canEdit={canEdit}
            highlightId={highlightId}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            onCheck={onCheck}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onMove={onMove}
            onOpenMenu={handleOpenMenu}
            dragNodeId={dragNodeId}
            setDragNodeId={setDragNodeId}
          />
        ))
      )}

      {contextMenu && (
        <ContextMenu
          anchor={contextMenu.cursor ? undefined : contextMenu.anchor}
          cursor={contextMenu.cursor}
          onClose={() => setContextMenu(null)}
          onAddChild={() => onAddChild(contextMenu.node)}
          onEdit={() => onEdit(contextMenu.node)}
          onDuplicate={() => onDuplicate(contextMenu.node)}
          onDelete={() => onDelete(contextMenu.node)}
        />
      )}
    </div>
  );
}
