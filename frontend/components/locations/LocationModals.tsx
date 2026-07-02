'use client';

import { useState } from 'react';
import type { LocationTemplate, LocationTreeNode, LocationTypeDef } from '@/lib/locations';
import { typeDef } from '@/lib/locations';
import { DepartmentSelect, type DepartmentRow } from '@/components/locations/DepartmentsPanel';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';

function ModalShell({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`rounded-xl border border-gray-700/60 bg-gray-900 shadow-2xl p-5 max-h-[90vh] overflow-y-auto ${wide ? 'w-full max-w-lg' : 'w-full max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AddChildModal({
  parent,
  types,
  departments,
  onClose,
  onSave,
  saving,
}: {
  parent: LocationTreeNode | null;
  types: LocationTypeDef[];
  departments: DepartmentRow[];
  onClose: () => void;
  onSave: (data: { name: string; type: string; departmentId?: string | null }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState(types[0]?.key || 'room');
  const [departmentId, setDepartmentId] = useState('');

  return (
    <ModalShell title={parent?._id ? `Add child under ${parent.name}` : 'Add top-level location'} onClose={onClose}>
      {parent?._id && (
        <p className="text-xs text-gray-500 mb-3">
          Parent: <span className="text-gray-300">{parent.path || parent.name}</span>
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Location name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Room 101"
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Location type</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
            {types.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={`px-2 py-1.5 text-xs rounded-lg border text-left ${
                  type === t.key
                    ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                    : 'border-gray-700/60 text-gray-400 hover:border-gray-600'
                }`}
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>
        </div>
        <DepartmentSelect
          departments={departments}
          value={departmentId}
          onChange={setDepartmentId}
        />
      </div>
      <div className="flex gap-2 mt-5">
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              type,
              departmentId: departmentId || null,
            })
          }
          className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 disabled:opacity-50`}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

export function EditLocationModal({
  node,
  types,
  users,
  departments,
  parentName,
  onClose,
  onSave,
  saving,
}: {
  node: LocationTreeNode;
  types: LocationTypeDef[];
  users: { _id: string; name: string }[];
  departments: DepartmentRow[];
  parentName?: string;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(node.name);
  const [type, setType] = useState(node.type);
  const [code, setCode] = useState(node.code || '');
  const [description, setDescription] = useState(node.description || '');
  const [capacity, setCapacity] = useState(node.capacity != null ? String(node.capacity) : '');
  const [managerId, setManagerId] = useState(
    typeof node.managerId === 'object' && node.managerId?._id ? node.managerId._id : ''
  );
  const [departmentId, setDepartmentId] = useState(
    typeof node.departmentId === 'object' && node.departmentId?._id ? node.departmentId._id : ''
  );
  const [notes, setNotes] = useState(node.notes || '');

  return (
    <ModalShell title="Edit location" onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={labelClass}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {types.map((t) => (
              <option key={t.key} value={t.key}>{t.icon} {t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Parent</label>
          <input value={parentName || '— (top level)'} readOnly className={`${inputClass} bg-gray-900/50 text-gray-500`} />
        </div>
        <div>
          <label className={labelClass}>Capacity (optional)</label>
          <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Manager (optional)</label>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <DepartmentSelect
            departments={departments}
            value={departmentId}
            onChange={setDepartmentId}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              type,
              code,
              description,
              capacity: capacity === '' ? null : Number(capacity),
              managerId: managerId || null,
              departmentId: departmentId || null,
              notes,
            })
          }
          className={`${buttonClass} border-emerald-500/40 bg-emerald-500/10 text-emerald-300 disabled:opacity-50`}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onClose} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

export function BulkGenerateModal({
  parent,
  types,
  onClose,
  onSave,
  saving,
}: {
  parent: LocationTreeNode;
  types: LocationTypeDef[];
  onClose: () => void;
  onSave: (data: {
    type: string;
    start: number;
    end: number;
    namingPattern: string;
  }) => void;
  saving: boolean;
}) {
  const [type, setType] = useState(types.find((t) => t.key === 'floor')?.key || types[0]?.key || 'room');
  const [start, setStart] = useState('1');
  const [end, setEnd] = useState('5');
  const [namingPattern, setNamingPattern] = useState('Floor {number}');

  return (
    <ModalShell title={`Generate multiple under ${parent.name}`} onClose={onClose} wide>
      <p className="text-xs text-gray-500 mb-3">Use {'{number}'} in the naming pattern.</p>
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            {types.map((t) => (
              <option key={t.key} value={t.key}>{t.icon} {t.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Start</label>
            <input type="number" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End</label>
            <input type="number" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Naming pattern</label>
          <input value={namingPattern} onChange={(e) => setNamingPattern(e.target.value)} className={inputClass} />
        </div>
        <p className="text-[11px] text-gray-500">
          Preview: {namingPattern.replace(/\{number\}/gi, start)} … {namingPattern.replace(/\{number\}/gi, end)}
        </p>
      </div>
      <div className="flex gap-2 mt-5">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave({
              type,
              start: Number(start),
              end: Number(end),
              namingPattern,
            })
          }
          className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 disabled:opacity-50`}
        >
          {saving ? 'Generating…' : 'Generate'}
        </button>
        <button type="button" onClick={onClose} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

export function TemplateModal({
  templates,
  types,
  onClose,
  onApply,
  saving,
}: {
  templates: LocationTemplate[];
  types: LocationTypeDef[];
  onClose: () => void;
  onApply: (templateKey: string, rootName: string) => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState(templates[0]?.key || '');
  const [rootName, setRootName] = useState('');

  const tpl = templates.find((t) => t.key === selected);

  return (
    <ModalShell title="Smart templates" onClose={onClose} wide>
      <p className="text-xs text-gray-500 mb-3">Quick-setup skeleton — modify everything afterward.</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSelected(t.key)}
            className={`p-3 rounded-lg border text-left ${
              selected === t.key
                ? 'border-violet-500/50 bg-violet-500/10'
                : 'border-gray-700/60 hover:border-gray-600'
            }`}
          >
            <p className="text-sm font-medium text-gray-200">{t.name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{t.description}</p>
          </button>
        ))}
      </div>
      {tpl && (
        <p className="text-xs text-gray-400 mb-3">
          Root type: {typeDef(types, tpl.rootType).icon} {typeDef(types, tpl.rootType).name}
        </p>
      )}
      <div>
        <label className={labelClass}>Root location name</label>
        <input
          value={rootName}
          onChange={(e) => setRootName(e.target.value)}
          className={inputClass}
          placeholder="e.g. Main Campus"
        />
      </div>
      <div className="flex gap-2 mt-5">
        <button
          type="button"
          disabled={saving || !rootName.trim() || !selected}
          onClick={() => onApply(selected, rootName.trim())}
          className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 disabled:opacity-50`}
        >
          {saving ? 'Creating…' : 'Apply template'}
        </button>
        <button type="button" onClick={onClose} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

export function DuplicateModal({
  node,
  onClose,
  onSave,
  saving,
}: {
  node: LocationTreeNode;
  onClose: () => void;
  onSave: (newName: string) => void;
  saving: boolean;
}) {
  const [newName, setNewName] = useState(`${node.name} (Copy)`);

  return (
    <ModalShell title="Duplicate branch" onClose={onClose}>
      <p className="text-xs text-gray-500 mb-3">
        Copies <span className="text-gray-300">{node.name}</span> and all descendants.
      </p>
      <label className={labelClass}>New root name</label>
      <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
      <div className="flex gap-2 mt-5">
        <button
          type="button"
          disabled={saving || !newName.trim()}
          onClick={() => onSave(newName.trim())}
          className={`${buttonClass} border-blue-500/40 bg-blue-500/10 text-blue-300 disabled:opacity-50`}
        >
          {saving ? 'Duplicating…' : 'Duplicate'}
        </button>
        <button type="button" onClick={onClose} className={`${buttonClass} border-gray-700/60 text-gray-400`}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}

export function LocationTypesModal({
  types,
  onClose,
  onCreate,
  onDelete,
  canEdit,
}: {
  types: LocationTypeDef[];
  onClose: () => void;
  onCreate: (data: { name: string; icon: string; color: string }) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📍');
  const [color, setColor] = useState('#6366f1');

  return (
    <ModalShell title="Location types" onClose={onClose} wide>
      <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
        {types.map((t) => (
          <div key={t._id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <span style={t.color ? { color: t.color } : undefined}>{t.icon}</span>
            <span className="text-sm text-gray-200 flex-1">{t.name}</span>
            <span className="text-[10px] text-gray-500 font-mono">{t.key}</span>
            {canEdit && !t.isDefault && (
              <button
                type="button"
                onClick={() => onDelete(t._id)}
                className={`${buttonClass} border-red-500/40 text-red-300`}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="border-t border-gray-700/40 pt-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Add custom type</p>
          <div className="grid grid-cols-3 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputClass} />
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon" className={inputClass} />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-[38px] w-full rounded-lg border border-gray-700/60 bg-gray-800" />
          </div>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              onCreate({ name: name.trim(), icon, color });
              setName('');
            }}
            className={`${buttonClass} mt-2 border-emerald-500/40 text-emerald-300 disabled:opacity-50`}
          >
            Add type
          </button>
        </div>
      )}
    </ModalShell>
  );
}
