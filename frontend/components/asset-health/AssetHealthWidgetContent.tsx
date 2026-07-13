'use client';

import { useContainerSize } from '@/hooks/useContainerSize';
import type { HealthDataContext, HealthWidget } from '@/lib/assetHealthWidgets';
import { computeHealthWidgetData } from '@/lib/assetHealthWidgets';
import AssetHealthWidgetRenderer from './AssetHealthWidgetRenderer';

export default function AssetHealthWidgetContent({
  widget,
  ctx,
}: {
  widget: HealthWidget;
  ctx: HealthDataContext;
}) {
  const { ref, size, ready } = useContainerSize<HTMLDivElement>();
  const result = computeHealthWidgetData(ctx, widget);

  return (
    <div ref={ref} className="relative z-0 flex-1 min-h-0 min-w-0 w-full overflow-hidden">
      {ready && <AssetHealthWidgetRenderer widget={widget} result={result} containerSize={size} />}
    </div>
  );
}
