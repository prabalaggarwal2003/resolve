'use client';

import { useState } from 'react';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

export type DepartmentRow = {
  _id: string;
  name: string;
  description?: string;
};

export default function DepartmentsPanel({
  departments,
  canEdit,
  onAdd,
  onDelete,
}: {
  departments: DepartmentRow[];
  canEdit: boolean;
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      setName('');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, deptName: string) => {
    if (!confirm(`Delete department "${deptName}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-indigo-500/50 bg-gray-800/40 p-4 mb-4">
      <p className="text-xs font-semibold text-indigo-400/80 uppercase tracking-widest mb-3">Departments</p>
      <p className="text-[11px] text-gray-500 mb-3">
        Link departments to locations when adding or editing a location.
      </p>

      {departments.length === 0 ? (
        <p className="text-xs text-gray-500 mb-3">No departments yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-3 max-h-28 overflow-y-auto">
          {departments.map((d) => (
            <span
              key={d._id}
              className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 text-[11px] font-medium rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-200"
            >
              <span className="truncate">{d.name}</span>
              {canEdit && (
                <button
                  type="button"
                  disabled={deletingId === d._id}
                  onClick={() => handleDelete(d._id, d.name)}
                  className="shrink-0 ml-0.5 text-indigo-400/80 hover:text-red-300 disabled:opacity-50 leading-none"
                  title={`Delete ${d.name}`}
                  aria-label={`Delete ${d.name}`}
                >
                  {deletingId === d._id ? '…' : '×'}
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="New department name"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !name.trim()}
            className={`${buttonClass} shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 disabled:opacity-50`}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
}

export function DepartmentSelect({
  departments,
  value,
  onChange,
  label = 'Department (optional)',
}: {
  departments: DepartmentRow[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">None</option>
        {departments.map((d) => (
          <option key={d._id} value={d._id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
