'use client';

import { useContainerSize } from '@/hooks/useContainerSize';
import KpiWidgetRenderer from '@/components/kpis/KpiWidgetRenderer';
import {
  buildHomeWidgetResult,
  homeDataAsKpiContext,
  homeWidgetAsKpi,
  isCustomHomeWidget,
} from '@/lib/homeDashboardWidgets';
import type { HomeDataContext, HomeWidget } from '@/lib/homeDashboardWidgets';
import HomeWidgetRenderer from '@/components/home/HomeWidgetRenderer';
import { computeKpiWidgetData } from '@/lib/kpiWidgets';

export default function HomeWidgetContent({
  widget,
  ctx,
}: {
  widget: HomeWidget;
  ctx: HomeDataContext;
}) {
  const { ref, size, ready } = useContainerSize<HTMLDivElement>();

  if (isCustomHomeWidget(widget)) {
    const kpiWidget = homeWidgetAsKpi(widget);
    const result = computeKpiWidgetData(homeDataAsKpiContext(ctx), kpiWidget);
    return (
      <div ref={ref} className="relative z-0 flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        {ready && <KpiWidgetRenderer widget={kpiWidget} result={result} containerSize={size} />}
      </div>
    );
  }

  const result = buildHomeWidgetResult(ctx, widget);

  return (
    <div ref={ref} className="relative z-0 flex-1 min-h-0 min-w-0 w-full overflow-hidden">
      {ready && <HomeWidgetRenderer widget={widget} result={result} containerSize={size} />}
    </div>
  );
}
