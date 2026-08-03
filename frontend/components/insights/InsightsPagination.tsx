'use client';

export const INSIGHTS_PAGE_SIZE = 15;

export default function InsightsPagination({
  page,
  pageSize = INSIGHTS_PAGE_SIZE,
  total,
  onChange,
}: {
  page: number;
  pageSize?: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <p className="text-xs text-gray-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-2.5 py-1 text-xs rounded-lg border border-gray-700/60 text-gray-300 disabled:opacity-40 hover:bg-gray-800/60"
        >
          Previous
        </button>
        <span className="text-xs text-gray-500 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-2.5 py-1 text-xs rounded-lg border border-gray-700/60 text-gray-300 disabled:opacity-40 hover:bg-gray-800/60"
        >
          Next
        </button>
      </div>
    </div>
  );
}
