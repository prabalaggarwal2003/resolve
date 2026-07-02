'use client';

import { useEffect, useMemo, useState } from 'react';

type LocationNode = {
  _id: string;
  name: string;
  type: string;
  parentId?: string | null;
  path?: string;
};

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

function buildAncestorChain(locations: LocationNode[], locId: string): LocationNode[] {
  const chain: LocationNode[] = [];
  let current = locations.find((l) => l._id === locId);
  const seen = new Set<string>();
  while (current && !seen.has(current._id)) {
    chain.unshift(current);
    seen.add(current._id);
    current = current.parentId
      ? locations.find((l) => l._id === current!.parentId)
      : undefined;
  }
  return chain;
}

export default function LocationHierarchyPicker({
  locations,
  value,
  onChange,
  required = false,
}: {
  locations: LocationNode[];
  value: string;
  onChange: (locationId: string) => void;
  required?: boolean;
}) {
  const sorted = useMemo(
    () =>
      [...locations].sort((a, b) =>
        (a.path || a.name).localeCompare(b.path || b.name, undefined, { sensitivity: 'base' })
      ),
    [locations]
  );

  const roots = useMemo(
    () => locations.filter((l) => !l.parentId),
    [locations]
  );

  const [levels, setLevels] = useState<string[]>(['']);

  useEffect(() => {
    if (!value) {
      setLevels(['']);
      return;
    }
    const chain = buildAncestorChain(locations, value);
    if (chain.length) {
      setLevels(chain.map((c) => c._id));
    }
  }, [value, locations]);

  const childrenOf = (parentId: string) =>
    locations.filter((l) => String(l.parentId || '') === parentId);

  const updateLevel = (index: number, id: string) => {
    const next = [...levels.slice(0, index + 1)];
    next[index] = id;
    const children = id ? childrenOf(id) : [];
    if (children.length) next.push('');
    setLevels(next);
    onChange(id);
  };

  const rows: { parentId: string; options: LocationNode[]; value: string; index: number }[] = [];
  let parentId = '';
  for (let i = 0; i < levels.length; i++) {
    const opts = i === 0 ? roots : childrenOf(parentId);
    if (!opts.length) break;
    rows.push({ parentId, options: opts, value: levels[i] || '', index: i });
    if (!levels[i]) break;
    parentId = levels[i];
  }

  if (sorted.length > 0 && rows.length === 0) {
    return (
      <div>
        <label className={labelClass}>Location{required ? ' *' : ''}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Select location</option>
          {sorted.map((l) => (
            <option key={l._id} value={l._id}>
              {l.path || l.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={`${row.parentId}-${row.index}`}>
          <label className={labelClass}>
            {row.index === 0 ? `Location level ${row.index + 1}${required ? ' *' : ''}` : `Level ${row.index + 1}`}
          </label>
          <select
            value={row.value}
            onChange={(e) => updateLevel(row.index, e.target.value)}
            className={inputClass}
          >
            <option value="">Select…</option>
            {row.options.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      {value && (
        <p className="text-[10px] text-gray-500">
          Selected: {sorted.find((l) => l._id === value)?.path || sorted.find((l) => l._id === value)?.name}
        </p>
      )}
    </div>
  );
}
