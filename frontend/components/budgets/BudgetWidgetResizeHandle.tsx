'use client';

import { useCallback } from 'react';
import {
  BUDGET_GRID_COLS,
  BUDGET_MAX_COL_SPAN,
  BUDGET_MAX_ROW_SPAN,
  BUDGET_MIN_COL_SPAN,
  BUDGET_MIN_ROW_SPAN,
  BUDGET_ROW_HEIGHT_PX,
  clampBudgetSpan,
} from '@/lib/budgetWidgets';

export default function BudgetWidgetResizeHandle({
  colSpan,
  rowSpan,
  onResize,
}: {
  colSpan: number;
  rowSpan: number;
  onResize: (next: { colSpan: number; rowSpan: number; sizeLocked: true }) => void;
}) {
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const grid = e.currentTarget.closest('[data-widget-grid]') as HTMLElement | null;
      if (!grid) return;
      const lg = window.matchMedia('(min-width: 1024px)').matches;
      const colWidth = grid.clientWidth / (lg ? BUDGET_GRID_COLS : 1);
      const startX = e.clientX;
      const startY = e.clientY;
      const startCol = colSpan;
      const startRow = rowSpan;
      const onMove = (ev: PointerEvent) => {
        onResize({
          colSpan: clampBudgetSpan(startCol + Math.round((ev.clientX - startX) / colWidth), BUDGET_MIN_COL_SPAN, BUDGET_MAX_COL_SPAN),
          rowSpan: clampBudgetSpan(startRow + Math.round((ev.clientY - startY) / BUDGET_ROW_HEIGHT_PX), BUDGET_MIN_ROW_SPAN, BUDGET_MAX_ROW_SPAN),
          sizeLocked: true,
        });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [colSpan, rowSpan, onResize]
  );

  return (
    <div role="separator" aria-label="Resize widget" onPointerDown={onPointerDown} className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-30 group" title="Drag to resize">
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 absolute bottom-1 right-1 text-gray-600 group-hover:text-violet-400 transition-colors" fill="currentColor">
        <path d="M14 14h-2v-2h2v2zm-4 0h-2v-2h2v2zm-4 0H4v-2h2v2zm8-4h-2V8h2v2zm-4 0h-2V8h2v2zm-4 0H4V8h2v2zm8-4h-2V4h2v2zm-4 0h-2V4h2v2z" />
      </svg>
    </div>
  );
}
