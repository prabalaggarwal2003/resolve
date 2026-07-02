'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import LocationTree from '@/components/locations/LocationTree';
import DepartmentsPanel, { type DepartmentRow } from '@/components/locations/DepartmentsPanel';
import {
  AddChildModal,
  EditLocationModal,
  BulkGenerateModal,
  TemplateModal,
  DuplicateModal,
  LocationTypesModal,
} from '@/components/locations/LocationModals';
import { canWrite } from '@/lib/permissions';
import {
  api,
  authHeaders,
  findNodePath,
  flattenTree,
  loadExpandedIds,
  saveExpandedIds,
  RECENT_EDIT_KEY,
  type LocationTreeNode,
  type LocationTypeDef,
  type LocationTemplate,
} from '@/lib/locations';
import { exportLocationsHierarchyPdf } from '@/lib/locationsPdfExport';

const buttonClass = 'px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors';
const inputClass =
  'px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-blue-500/40';

export default function LocationsPage() {
  const [tree, setTree] = useState<LocationTreeNode[]>([]);
  const [types, setTypes] = useState<LocationTypeDef[]>([]);
  const [templates, setTemplates] = useState<LocationTemplate[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => loadExpandedIds());
  const [selected, setSelected] = useState<LocationTreeNode | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<LocationTreeNode[]>([]);
  const [saving, setSaving] = useState(false);

  const [addModal, setAddModal] = useState<{ open: boolean; parent: LocationTreeNode | null }>({
    open: false,
    parent: null,
  });
  const [editNode, setEditNode] = useState<LocationTreeNode | null>(null);
  const [bulkParent, setBulkParent] = useState<LocationTreeNode | null>(null);
  const [duplicateNode, setDuplicateNode] = useState<LocationTreeNode | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTypes, setShowTypes] = useState(false);

  const canEditLocations = canWrite('locations');
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const breadcrumb = useMemo(() => {
    if (!selected) return [];
    return findNodePath(tree, selected._id);
  }, [selected, tree]);

  const totalStats = useMemo(() => {
    let assets = 0;
    let issues = 0;
    for (const root of tree) {
      assets += root.stats?.assetCount || 0;
      issues += root.stats?.issueCount || 0;
    }
    return { locations: flat.length, assets, issues, departments: departments.length };
  }, [flat, tree, departments.length]);

  const fetchAll = useCallback(async () => {
    setError('');
    const headers = { ...authHeaders(), 'Content-Type': 'application/json' };
    try {
      const [treeRes, typesRes, tplRes, usersRes, deptRes] = await Promise.all([
        fetch(api('/api/locations/tree'), { headers }),
        fetch(api('/api/location-types'), { headers }),
        fetch(api('/api/locations/templates'), { headers }),
        fetch(api('/api/users'), { headers }),
        fetch(api('/api/departments'), { headers }),
      ]);
      const [treeData, typesData, tplData, usersData, deptData] = await Promise.all([
        treeRes.json(),
        typesRes.json(),
        tplRes.json(),
        usersRes.json(),
        deptRes.json(),
      ]);
      if (treeData.tree) setTree(treeData.tree);
      else setError(treeData.message || 'Failed to load tree');
      if (typesData.types) setTypes(typesData.types);
      if (tplData.templates) setTemplates(tplData.templates);
      if (usersData.users) setUsers(usersData.users);
      if (deptData.departments) setDepartments(deptData.departments);

      const recent = localStorage.getItem(RECENT_EDIT_KEY);
      if (recent) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          JSON.parse(recent).forEach((id: string) => next.add(id));
          return next;
        });
      }
    } catch {
      setError('Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    saveExpandedIds(expandedIds);
  }, [expandedIds]);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(api(`/api/locations/search?q=${encodeURIComponent(q)}`), {
        headers: authHeaders(),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const expandToNode = (id: string) => {
    const path = findNodePath(tree, id);
    if (path.length) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        path.slice(0, -1).forEach((n) => next.add(n._id));
        next.add(id);
        return next;
      });
    }
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 2500);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rememberEdit = (nodeId: string) => {
    const path = findNodePath(tree, nodeId);
    const ids = path.map((n) => n._id);
    localStorage.setItem(RECENT_EDIT_KEY, JSON.stringify(ids));
    expandToNode(nodeId);
  };

  const handleAddChild = async (data: { name: string; type: string; departmentId?: string | null }) => {
    setSaving(true);
    try {
      const parentId = addModal.parent?._id || null;
      const res = await fetch(api('/api/locations'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, parentId: parentId || undefined }),
      });
      const loc = await res.json();
      if (!res.ok) throw new Error(loc.message);
      if (parentId) expandToNode(parentId);
      rememberEdit(loc._id);
      setAddModal({ open: false, parent: null });
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!editNode) return;
    setSaving(true);
    try {
      const res = await fetch(api(`/api/locations/${editNode._id}`), {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const loc = await res.json();
      if (!res.ok) throw new Error(loc.message);
      rememberEdit(editNode._id);
      setEditNode(null);
      setSelected(loc);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkGenerate = async (data: {
    type: string;
    start: number;
    end: number;
    namingPattern: string;
  }) => {
    if (!bulkParent) return;
    setSaving(true);
    try {
      const res = await fetch(api('/api/locations/bulk-generate'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: bulkParent._id, ...data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      expandToNode(bulkParent._id);
      setBulkParent(null);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (newName: string) => {
    if (!duplicateNode) return;
    setSaving(true);
    try {
      const res = await fetch(api(`/api/locations/${duplicateNode._id}/duplicate`), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      });
      const loc = await res.json();
      if (!res.ok) throw new Error(loc.message);
      rememberEdit(loc._id);
      setDuplicateNode(null);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (node: LocationTreeNode) => {
    const childCount = (node.stats?.childCount || 0);
    const msg =
      childCount > 0
        ? `Delete "${node.name}" and all ${childCount} child location(s)? This cannot be undone.`
        : `Delete "${node.name}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(api(`/api/locations/${node._id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      if (selected?._id === node._id) setSelected(null);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleMove = async (nodeId: string, newParentId: string | null) => {
    try {
      const res = await fetch(api(`/api/locations/${nodeId}/move`), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: newParentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      rememberEdit(nodeId);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(checkedIds);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected location branch(es)? This cannot be undone.`)) return;
    try {
      const res = await fetch(api('/api/locations/bulk'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCheckedIds(new Set());
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed');
    }
  };

  const handleAddDepartment = async (name: string) => {
    const res = await fetch(api('/api/departments'), {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add department');
    await fetchAll();
  };

  const handleDeleteDepartment = async (id: string) => {
    const res = await fetch(api(`/api/departments/${id}`), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete department');
    await fetchAll();
  };

  const handleExportPdf = () => {
    exportLocationsHierarchyPdf(tree, types);
  };

  const handleApplyTemplate = async (templateKey: string, rootName: string) => {
    setSaving(true);
    try {
      const res = await fetch(api('/api/locations/apply-template'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey, rootName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      rememberEdit(data.location._id);
      setShowTemplates(false);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateType = async (data: { name: string; icon: string; color: string }) => {
    const res = await fetch(api('/api/location-types'), {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message);
    const typesRes = await fetch(api('/api/location-types'), { headers: authHeaders() });
    const typesData = await typesRes.json();
    if (typesData.types) setTypes(typesData.types);
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Delete this location type?')) return;
    const res = await fetch(api(`/api/location-types/${id}`), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    const typesRes = await fetch(api('/api/location-types'), { headers: authHeaders() });
    const typesData = await typesRes.json();
    if (typesData.types) setTypes(typesData.types);
  };

  if (loading) return <LoadingSpinner message="Loading locations..." />;

  const parentNameForEdit = editNode?.parentId
    ? flat.find((l) => l._id === editNode.parentId)?.name
    : undefined;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Locations</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Hierarchical tree with custom types, bulk generation, and drag-and-drop.
          </p>
        </div>
        {canEditLocations && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300`}
            >
              Smart templates
            </button>
            <button
              type="button"
              onClick={() => setShowTypes(true)}
              className={`${buttonClass} border-gray-700/60 text-gray-300`}
            >
              Location types
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-4 mb-4">
        <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Locations</p>
            <p className="text-sm font-semibold text-blue-300">{totalStats.locations}</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Departments</p>
            <p className="text-sm font-semibold text-indigo-300">{totalStats.departments}</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Assets (in tree)</p>
            <p className="text-sm font-semibold text-emerald-300">{totalStats.assets}</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg border border-gray-700/40 bg-gray-900/30">
            <p className="text-[10px] text-gray-500 uppercase">Issues (in tree)</p>
            <p className="text-sm font-semibold text-amber-300">{totalStats.issues}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-800 bg-red-900/20 text-red-400 text-sm flex justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-300">×</button>
        </div>
      )}

      <DepartmentsPanel
        departments={departments}
        canEdit={canEditLocations}
        onAdd={async (name) => {
          try {
            await handleAddDepartment(name);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add department');
            throw err;
          }
        }}
        onDelete={async (id) => {
          try {
            await handleDeleteDepartment(id);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete department');
            throw err;
          }
        }}
      />

      <div className="mb-4 relative">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search locations — jump to Room 204…"
          className={`${inputClass} w-full`}
        />
        {searchResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-700/60 bg-gray-900 shadow-xl max-h-48 overflow-y-auto">
            {searchResults.map((r) => (
              <button
                key={r._id}
                type="button"
                className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 border-b border-gray-800/60 last:border-0"
                onClick={() => {
                  expandToNode(r._id);
                  const node = flat.find((f) => f._id === r._id) || r;
                  setSelected(node as LocationTreeNode);
                  setSearch('');
                  setSearchResults([]);
                }}
              >
                <span className="font-medium">{r.name}</span>
                {r.path && <span className="text-xs text-gray-500 ml-2">{r.path}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {breadcrumb.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-gray-400">
          {breadcrumb.map((n, i) => (
            <span key={n._id} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-600">›</span>}
              <button
                type="button"
                onClick={() => setSelected(n)}
                className="text-gray-300 hover:text-blue-300"
              >
                {n.name}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExportPdf}
          className={`${buttonClass} border-teal-500/40 bg-teal-500/10 text-teal-300`}
        >
          Export PDF
        </button>
        {canEditLocations && (
          <button
            type="button"
            onClick={() => {
              if (!selected) {
                setError('Select a location in the tree first, then use Generate multiple.');
                return;
              }
              setBulkParent(selected);
            }}
            disabled={!selected}
            title={selected ? `Generate children under ${selected.name}` : 'Select a location first'}
            className={`${buttonClass} border-violet-500/40 bg-violet-500/10 text-violet-300 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Generate multiple
          </button>
        )}
        {checkedIds.size > 0 && canEditLocations && (
          <>
            <span className="text-xs text-amber-200 px-2">{checkedIds.size} selected</span>
            <button
              type="button"
              onClick={handleBulkDelete}
              className={`${buttonClass} border-red-500/40 text-red-300`}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setCheckedIds(new Set())}
              className={`${buttonClass} border-gray-700/60 text-gray-500`}
            >
              Clear selection
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LocationTree
            nodes={tree}
            types={types}
            expandedIds={expandedIds}
            selectedId={selected?._id || null}
            checkedIds={checkedIds}
            canEdit={canEditLocations}
            highlightId={highlightId}
            onToggleExpand={toggleExpand}
            onSelect={setSelected}
            onCheck={(id, checked) => {
              setCheckedIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onAddChild={(parent) => setAddModal({ open: true, parent: parent._id ? parent : null })}
            onEdit={setEditNode}
            onDuplicate={setDuplicateNode}
            onDelete={handleDelete}
            onMove={handleMove}
            onAddTopLevel={canEditLocations ? () => setAddModal({ open: true, parent: null }) : undefined}
          />
        </div>

        <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 p-4 h-fit">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Location details</p>
          {!selected ? (
            <p className="text-xs text-gray-500">Select a location in the tree to view details.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-lg font-medium text-gray-100">{selected.name}</p>
              <p className="text-[11px] text-gray-500">
                Code:{' '}
                <span className="font-mono text-gray-300">{selected.code?.trim() || '-'}</span>
              </p>
              <p className="text-xs text-gray-500">{selected.path || selected.name}</p>
              {selected.stats && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-2 py-0.5 text-[10px] rounded border border-emerald-500/30 text-emerald-300">
                    {selected.stats.assetCount} assets
                  </span>
                  <span className="px-2 py-0.5 text-[10px] rounded border border-gray-600 text-gray-400">
                    {selected.stats.childCount} children
                  </span>
                  {selected.stats.issueCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] rounded border border-amber-500/30 text-amber-300">
                      {selected.stats.issueCount} issues
                    </span>
                  )}
                </div>
              )}
              {selected.description && (
                <p className="text-xs text-gray-400 pt-2">{selected.description}</p>
              )}
              {selected.departmentId && typeof selected.departmentId === 'object' && (
                <p className="text-xs text-gray-500">Department: {selected.departmentId.name}</p>
              )}
              {selected.capacity != null && (
                <p className="text-xs text-gray-500">Capacity: {selected.capacity}</p>
              )}
              {selected.managerId && typeof selected.managerId === 'object' && (
                <p className="text-xs text-gray-500">Manager: {selected.managerId.name}</p>
              )}
              {selected.notes && (
                <p className="text-xs text-gray-500 whitespace-pre-wrap">{selected.notes}</p>
              )}
              {canEditLocations && (
                <button
                  type="button"
                  onClick={() => setEditNode(selected)}
                  className={`${buttonClass} mt-3 border-blue-500/40 text-blue-300`}
                >
                  Edit details
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {addModal.open && (
        <AddChildModal
          parent={addModal.parent}
          types={types}
          departments={departments}
          onClose={() => setAddModal({ open: false, parent: null })}
          onSave={handleAddChild}
          saving={saving}
        />
      )}

      {editNode && (
        <EditLocationModal
          node={editNode}
          types={types}
          users={users}
          departments={departments}
          parentName={parentNameForEdit}
          onClose={() => setEditNode(null)}
          onSave={handleEdit}
          saving={saving}
        />
      )}
      {bulkParent && (
        <BulkGenerateModal
          parent={bulkParent}
          types={types}
          onClose={() => setBulkParent(null)}
          onSave={handleBulkGenerate}
          saving={saving}
        />
      )}
      {duplicateNode && (
        <DuplicateModal
          node={duplicateNode}
          onClose={() => setDuplicateNode(null)}
          onSave={handleDuplicate}
          saving={saving}
        />
      )}
      {showTemplates && (
        <TemplateModal
          templates={templates}
          types={types}
          onClose={() => setShowTemplates(false)}
          onApply={handleApplyTemplate}
          saving={saving}
        />
      )}
      {showTypes && (
        <LocationTypesModal
          types={types}
          onClose={() => setShowTypes(false)}
          onCreate={handleCreateType}
          onDelete={handleDeleteType}
          canEdit={canEditLocations}
        />
      )}
    </div>
  );
}
