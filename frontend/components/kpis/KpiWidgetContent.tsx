'use client';

import { useContainerSize } from '@/hooks/useContainerSize';
import { buildKpiWidgetResult } from '@/components/kpis/KpiWidgetRenderer';
import KpiWidgetRenderer from '@/components/kpis/KpiWidgetRenderer';
import type { KpiDataContext, KpiWidget } from '@/lib/kpiWidgets';

export default function KpiWidgetContent({
  widget,
  ctx,
}: {
  widget: KpiWidget;
  ctx: KpiDataContext;
}) {
  const { ref, size, ready } = useContainerSize<HTMLDivElement>();
  const result = buildKpiWidgetResult(ctx, widget);

  return (
    <div ref={ref} className="relative z-0 flex-1 min-h-0 min-w-0 w-full overflow-hidden">
      {ready && <KpiWidgetRenderer widget={widget} result={result} containerSize={size} />}
    </div>
  );
}
