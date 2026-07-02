'use client';

import { useState } from 'react';
import { COLUMN_DEFS, type ColumnConfig, type ColumnId } from '@/lib/assetsTableConfig';

export default function ColumnCustomizer({
  columns,
  onChange,
}: {
  columns: ColumnConfig[];
  onChange: (columns: ColumnConfig[]) => void;
}) {
  const [dragId, setDragId] = useState<ColumnId | null>(null);
  const [overId, setOverId] = useState<ColumnId | null>(null);

  const reorder = (fromId: ColumnId, toId: ColumnId) => {
    if (fromId === toId) return;
    const next = [...columns];
    const from = next.findIndex((c) => c.id === fromId);
    const to = next.findIndex((c) => c.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const toggle = (id: ColumnId) => {
    onChange(columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  };

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-3">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
        Customize & reorder columns
      </p>
      <p className="text-[11px] text-gray-600 mb-3">Drag a column name to change order. Use checkboxes to show or hide.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {columns.map((col) => {
          const isDragging = dragId === col.id;
          const isOver = overId === col.id && dragId !== col.id;
          return (
            <div
              key={col.id}
              draggable
              onDragStart={() => setDragId(col.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(col.id);
              }}
              onDragLeave={() => {
                if (overId === col.id) setOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) reorder(dragId, col.id);
                setDragId(null);
                setOverId(null);
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs select-none transition-colors cursor-grab active:cursor-grabbing ${
                isDragging
                  ? 'opacity-40 border-gray-600 bg-gray-800/40'
                  : isOver
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
              }`}
            >
              <span className="text-gray-600 shrink-0" aria-hidden>
                ⠿
              </span>
              <label className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={() => toggle(col.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-gray-600 shrink-0"
                />
                <span className={`truncate ${col.visible ? 'text-gray-200' : 'text-gray-500'}`}>
                  {COLUMN_DEFS[col.id].label}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
