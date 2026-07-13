'use client';

import { useContainerSize } from '@/hooks/useContainerSize';
import BudgetWidgetRenderer, { buildBudgetWidgetResult } from '@/components/budgets/BudgetWidgetRenderer';
import type { BudgetDataContext, BudgetWidget } from '@/lib/budgetWidgets';

export default function BudgetWidgetContent({ widget, ctx }: { widget: BudgetWidget; ctx: BudgetDataContext }) {
  const { ref, size, ready } = useContainerSize<HTMLDivElement>();
  const result = buildBudgetWidgetResult(ctx, widget);
  return (
    <div ref={ref} className="relative z-0 flex-1 min-h-0 min-w-0 w-full overflow-hidden">
      {ready && <BudgetWidgetRenderer widget={widget} result={result} containerSize={size} />}
    </div>
  );
}
