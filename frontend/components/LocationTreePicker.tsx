'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  authHeaders,
  breadcrumbForNode,
  findNodePath,
  flattenTree,
  type LocationTreeNode,
} from '@/lib/locations';

const inputClass =
  'w-full px-3 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';
const rowButtonClass =
  'flex items-center gap-1.5 w-full text-left py-1 px-2 rounded-lg border transition-colors min-w-0';

type SearchHit = {
  _id: string;
  name: string;
  path?: string;
  type?: string;
  code?: string;
};

type PickerNodeProps = {
  node: LocationTreeNode;
  depth: number;
  expandedIds: Set<string>;
  selectedIds: Set<string>;
  multiple: boolean;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
};

function PickerNode({
  node,
  depth,
  expandedIds,
  selectedIds,
  multiple,
  onToggleExpand,
  onSelect,
}: PickerNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const expanded = expandedIds.has(node._id);
  const isSelected = selectedIds.has(node._id);

  return (
    <div>
      <div
        className={`${rowButtonClass} ${
          isSelected
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-200'
            : 'border-transparent text-gray-300 hover:border-gray-700/40 hover:bg-gray-800/40'
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        {multiple && (
          <span
            className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
              isSelected ? 'border-blue-400 bg-blue-500/30 text-blue-200' : 'border-gray-600 text-transparent'
            }`}
            aria-hidden
          >
            ✓
          </span>
        )}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node._id);
            }}
            className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-300"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="shrink-0 w-5" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node._id)}
          className="flex-1 min-w-0 text-left text-xs truncate"
        >
          <span className="font-medium">{node.name}</span>
          {node.code ? <span className="text-gray-500 ml-1.5 font-mono text-[10px]">{node.code}</span> : null}
        </button>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <PickerNode
              key={child._id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedIds={selectedIds}
              multiple={multiple}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type BaseProps = {
  tree: LocationTreeNode[];
  label?: string;
  compact?: boolean;
  hideHint?: boolean;
};

type SingleProps = BaseProps & {
  multiple?: false;
  value: string;
  onChange: (locationId: string) => void;
  required?: boolean;
};

type MultiProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (locationIds: string[]) => void;
  required?: never;
};

export type LocationTreePickerProps = SingleProps | MultiProps;

export default function LocationTreePicker(props: LocationTreePickerProps) {
  const { tree, multiple = false, compact = false, hideHint = false, label } = props;
  const isMultiple = multiple === true;

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const flat = useMemo(() => flattenTree(tree), [tree]);

  const selectedIds = useMemo(() => {
    if (isMultiple) return new Set(props.value);
    return props.value ? new Set([props.value]) : new Set<string>();
  }, [isMultiple, props.value]);

  const selectedNodes = useMemo(
    () => flat.filter((n) => selectedIds.has(n._id)),
    [flat, selectedIds]
  );

  const expandAncestors = useCallback(
    (id: string) => {
      const path = findNodePath(tree, id);
      if (path.length <= 1) return;
      setExpandedIds((prev) => {
        const next = new Set(prev);
        path.slice(0, -1).forEach((n) => next.add(n._id));
        return next;
      });
    },
    [tree]
  );

  useEffect(() => {
    if (isMultiple) {
      props.value.forEach((id) => expandAncestors(id));
      return;
    }
    if (props.value) expandAncestors(props.value);
  }, [isMultiple, props.value, expandAncestors]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(api(`/api/locations/search?q=${encodeURIComponent(q)}`), {
          headers: authHeaders(),
        });
        const data = await res.json();
        setSearchResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      if (isMultiple) {
        const current = props.value;
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        props.onChange(next);
        expandAncestors(id);
        return;
      }

      props.onChange(id);
      setQuery('');
      setSearchResults([]);
      expandAncestors(id);
    },
    [isMultiple, props, expandAncestors]
  );

  const clearSelection = useCallback(() => {
    if (isMultiple) props.onChange([]);
    else props.onChange('');
  }, [isMultiple, props]);

  const showSearch = query.trim().length > 0;
  const fieldLabel = label ?? (isMultiple ? 'Locations' : 'Location');
  const required = !isMultiple && props.required;

  return (
    <div className="space-y-2">
      <label className={labelClass}>
        {fieldLabel}
        {required ? ' *' : ''}
      </label>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, code, or path…"
        className={inputClass}
      />

      <div
        className={`overflow-y-auto rounded-lg border border-gray-700/60 bg-gray-900/40 p-1.5 ${
          compact ? 'max-h-40' : 'max-h-52'
        }`}
      >
        {showSearch ? (
          <div className="space-y-0.5">
            {searching && <p className="text-[11px] text-gray-500 px-2 py-1">Searching…</p>}
            {!searching && searchResults.length === 0 && (
              <p className="text-[11px] text-gray-500 px-2 py-1">No locations match your search.</p>
            )}
            {searchResults.map((hit) => {
              const isSelected = selectedIds.has(hit._id);
              return (
                <button
                  key={hit._id}
                  type="button"
                  onClick={() => handleSelect(hit._id)}
                  className={`${rowButtonClass} ${
                    isSelected
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-200'
                      : 'border-transparent text-gray-300 hover:border-gray-700/40 hover:bg-gray-800/40'
                  }`}
                >
                  {isMultiple && (
                    <span
                      className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                        isSelected
                          ? 'border-blue-400 bg-blue-500/30 text-blue-200'
                          : 'border-gray-600 text-transparent'
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                  )}
                  <span className="text-xs text-left min-w-0">
                    <span className="font-medium block truncate">{hit.name}</span>
                    <span className="text-[10px] text-gray-500 block truncate">
                      {breadcrumbForNode(hit)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : tree.length === 0 ? (
          <p className="text-[11px] text-gray-500 px-2 py-1">No locations yet. Add locations first.</p>
        ) : (
          tree.map((node) => (
            <PickerNode
              key={node._id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              selectedIds={selectedIds}
              multiple={isMultiple}
              onToggleExpand={toggleExpand}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>

      {selectedIds.size > 0 ? (
        <div className="space-y-1.5">
          {isMultiple ? (
            <div className="flex flex-wrap gap-1">
              {selectedNodes.map((node) => (
                <span
                  key={node._id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-blue-500/30 bg-blue-500/10 text-blue-200 max-w-full"
                >
                  <span className="truncate">{breadcrumbForNode(node)}</span>
                  <button
                    type="button"
                    onClick={() => handleSelect(node._id)}
                    className="text-blue-300/80 hover:text-red-300 shrink-0"
                    aria-label={`Remove ${node.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 min-w-0">
              Selected:{' '}
              <span className="text-gray-200">{breadcrumbForNode(selectedNodes[0])}</span>
            </p>
          )}
          {(!required || isMultiple) && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] text-gray-500 hover:text-red-300"
            >
              {isMultiple ? 'Clear all' : 'Clear'}
            </button>
          )}
        </div>
      ) : (
        !hideHint && (
          <p className="text-[10px] text-gray-600">
            {isMultiple
              ? 'Select one or more locations. Child locations can be included via the toggle below.'
              : 'Select the most specific location (e.g. room, not just campus).'}
          </p>
        )
      )}
    </div>
  );
}
