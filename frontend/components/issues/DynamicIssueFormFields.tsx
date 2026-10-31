'use client';

import { useMemo } from 'react';

export type FormFieldDef = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  showWhen?: { field: string; equals?: string | boolean | number; notEquals?: string | boolean | number } | null;
};

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-gray-700/60 rounded-lg bg-gray-800/60 text-gray-200 placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40';
const labelClass = 'block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1';

export function isFieldVisible(field: FormFieldDef, values: Record<string, unknown>) {
  if (!field.showWhen?.field) return true;
  const current = values[field.showWhen.field];
  if (field.showWhen.equals !== undefined) {
    return current === field.showWhen.equals || String(current) === String(field.showWhen.equals);
  }
  if (field.showWhen.notEquals !== undefined) {
    return current !== field.showWhen.notEquals && String(current) !== String(field.showWhen.notEquals);
  }
  return Boolean(current);
}

export function DynamicIssueFormFields({
  fields,
  values,
  onChange,
}: {
  fields: FormFieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const visible = useMemo(
    () => fields.filter((f) => isFieldVisible(f, values)),
    [fields, values]
  );

  return (
    <div className="space-y-3">
      {visible.map((field) => {
        const val = values[field.key];
        return (
          <div key={field.key}>
            <label className={labelClass}>
              {field.label}
              {field.required ? ' *' : ''}
            </label>
            {field.type === 'textarea' && (
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                required={field.required}
                placeholder={field.placeholder}
                value={String(val ?? '')}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
            {(field.type === 'text' || field.type === 'user' || field.type === 'contact' || field.type === 'asset' || field.type === 'location') && (
              <input
                type="text"
                className={inputClass}
                required={field.required}
                placeholder={field.placeholder || (field.type !== 'text' ? `${field.type} name or ID` : undefined)}
                value={String(val ?? '')}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
            {field.type === 'number' && (
              <input
                type="number"
                className={inputClass}
                required={field.required}
                value={val === undefined || val === null ? '' : String(val)}
                onChange={(e) => onChange(field.key, e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}
            {field.type === 'date' && (
              <input
                type="date"
                className={inputClass}
                required={field.required}
                value={String(val ?? '')}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
            {field.type === 'dropdown' && (
              <select
                className={inputClass}
                required={field.required}
                value={String(val ?? '')}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                <option value="">Select…</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            )}
            {field.type === 'multiselect' && (
              <select
                className={inputClass}
                multiple
                value={Array.isArray(val) ? (val as string[]) : []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  onChange(field.key, selected);
                }}
              >
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            )}
            {field.type === 'checkbox' && !(field.options || []).length && (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={Boolean(val)}
                  onChange={(e) => onChange(field.key, e.target.checked)}
                />
                Yes
              </label>
            )}
            {field.type === 'checkbox' && (field.options || []).length > 0 && (
              <div className="space-y-1.5">
                {(field.options || []).map((opt) => {
                  const selected = Array.isArray(val) ? (val as string[]) : [];
                  const checked = selected.includes(opt);
                  return (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) onChange(field.key, [...selected, opt]);
                          else onChange(field.key, selected.filter((x) => x !== opt));
                        }}
                      />
                      {opt.replace(/_/g, ' ')}
                    </label>
                  );
                })}
              </div>
            )}
            {field.type === 'attachment' && (
              <input
                type="url"
                className={inputClass}
                required={field.required}
                placeholder="https://… (attachment URL)"
                value={String(val ?? '')}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
