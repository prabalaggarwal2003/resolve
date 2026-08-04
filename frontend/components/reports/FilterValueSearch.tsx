'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchFieldValues } from '@/lib/reportStudio';

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 focus:ring-1 focus:ring-amber-500/40';

/**
 * Searchable value picker for report filters — matches existing field values
 * without requiring exact case/spelling (server uses soft match).
 */
export default function FilterValueSearch({
  source,
  field,
  value,
  onChange,
  placeholder = 'Search existing values…',
  className = '',
}: {
  source: string;
  field: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ value: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!source || !field) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchFieldValues(source, field, value);
        if (!cancelled) setOptions(data.values || []);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [source, field, value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={wrapRef} className={`relative flex-1 min-w-[140px] ${className}`}>
      <input
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-40 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-700/60 bg-gray-900 shadow-xl">
          {loading && <p className="px-3 py-2 text-[11px] text-gray-500">Searching…</p>}
          {!loading && options.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-gray-500">
              No matching values — your text still works as a fuzzy search.
            </p>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-amber-500/10 flex justify-between gap-2"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span className="truncate">{opt.value}</span>
              <span className="text-gray-600 shrink-0">{opt.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
