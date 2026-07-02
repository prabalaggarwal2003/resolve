'use client';

import { useCallback } from 'react';
import {
  WIDGET_GRID_COLS,
  WIDGET_MAX_COL_SPAN,
  WIDGET_MAX_ROW_SPAN,
  WIDGET_MIN_COL_SPAN,
  WIDGET_MIN_ROW_SPAN,
  WIDGET_ROW_HEIGHT_PX,
  clampWidgetSpan,
} from '@/lib/depreciationWidgets';

export default function DepreciationWidgetResizeHandle({
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
      const cols = lg ? WIDGET_GRID_COLS : 1;
      const colWidth = grid.clientWidth / cols;
      const startX = e.clientX;
      const startY = e.clientY;
      const startCol = colSpan;
      const startRow = rowSpan;

      const onMove = (ev: PointerEvent) => {
        const dCol = Math.round((ev.clientX - startX) / colWidth);
        const dRow = Math.round((ev.clientY - startY) / WIDGET_ROW_HEIGHT_PX);
        onResize({
          colSpan: clampWidgetSpan(startCol + dCol, WIDGET_MIN_COL_SPAN, WIDGET_MAX_COL_SPAN),
          rowSpan: clampWidgetSpan(startRow + dRow, WIDGET_MIN_ROW_SPAN, WIDGET_MAX_ROW_SPAN),
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
    <div
      role="separator"
      aria-label="Resize widget"
      onPointerDown={onPointerDown}
      className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group/resize z-10"
      title="Drag to resize"
    >
      <svg
        viewBox="0 0 16 16"
        className="w-3 h-3 absolute bottom-1 right-1 text-gray-600 group-hover/resize:text-violet-400 transition-colors"
        fill="currentColor"
      >
        <path d="M14 14h-2v-2h2v2zm-4 0h-2v-2h2v2zm-4 0H4v-2h2v2zm8-4h-2V8h2v2zm-4 0h-2V8h2v2zm-4 0H4V8h2v2zm8-4h-2V4h2v2zm-4 0h-2V4h2v2z" />
      </svg>
    </div>
  );
}
