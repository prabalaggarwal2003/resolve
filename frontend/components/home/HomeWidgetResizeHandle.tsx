'use client';

import { useCallback } from 'react';
import {
  HOME_GRID_COLS,
  HOME_MAX_COL_SPAN,
  HOME_MAX_ROW_SPAN,
  HOME_MIN_COL_SPAN,
  HOME_MIN_ROW_SPAN,
  HOME_ROW_HEIGHT_PX,
  clampHomeSpan,
} from '@/lib/homeDashboardWidgets';

export default function HomeWidgetResizeHandle({
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
      const colWidth = grid.clientWidth / (lg ? HOME_GRID_COLS : 1);
      const startX = e.clientX;
      const startY = e.clientY;
      const startCol = colSpan;
      const startRow = rowSpan;
      const onMove = (ev: PointerEvent) => {
        onResize({
          colSpan: clampHomeSpan(startCol + Math.round((ev.clientX - startX) / colWidth), HOME_MIN_COL_SPAN, HOME_MAX_COL_SPAN),
          rowSpan: clampHomeSpan(startRow + Math.round((ev.clientY - startY) / HOME_ROW_HEIGHT_PX), HOME_MIN_ROW_SPAN, HOME_MAX_ROW_SPAN),
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
    <div role="separator" aria-label="Resize widget" onPointerDown={onPointerDown} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10" title="Drag to resize">
      <svg viewBox="0 0 16 16" className="w-3 h-3 absolute bottom-1 right-1 text-gray-600 hover:text-violet-400" fill="currentColor">
        <path d="M14 14h-2v-2h2v2zm-4 0h-2v-2h2v2zm-4 0H4v-2h2v2zm8-4h-2V8h2v2zm-4 0h-2V8h2v2zm-4 0H4V8h2v2zm8-4h-2V4h2v2zm-4 0h-2V4h2v2z" />
      </svg>
    </div>
  );
}
