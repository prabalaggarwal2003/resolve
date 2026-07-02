'use client';

import { useContainerSize } from '@/hooks/useContainerSize';
import DepreciationWidgetRenderer from '@/components/depreciation/DepreciationWidgetRenderer';
import { computeWidgetData } from '@/lib/depreciationWidgets';
import type { AssetDepreciationMetrics } from '@/lib/depreciation';
import type { DepreciationWidget } from '@/lib/depreciationWidgets';

export default function DepreciationWidgetContent({
  widget,
  assets,
}: {
  widget: DepreciationWidget;
  assets: AssetDepreciationMetrics[];
}) {
  const { ref, size, ready } = useContainerSize<HTMLDivElement>();
  const result = computeWidgetData(assets, widget);

  return (
    <div ref={ref} className="relative z-0 flex-1 min-h-0 min-w-0 w-full overflow-hidden">
      {ready && (
        <DepreciationWidgetRenderer widget={widget} result={result} containerSize={size} />
      )}
    </div>
  );
}
