'use client';

import Link from 'next/link';
import {
  computePartnerWidgetData,
  type PartnerDataContext,
  type PartnerWidget,
} from '@/lib/partnerDashboardWidgets';

export default function PartnerWidgetContent({
  widget,
  ctx,
}: {
  widget: PartnerWidget;
  ctx: PartnerDataContext;
}) {
  const result = computePartnerWidgetData(ctx, widget);

  if (result.type === 'metric') {
    return (
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <p className={`text-2xl font-semibold tabular-nums ${result.accent || 'text-gray-100'}`}>{result.value}</p>
        {result.sub ? <p className="text-[10px] text-gray-600 mt-1">{result.sub}</p> : null}
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-1">
      {result.items.length === 0 && <li className="text-xs text-gray-500">No data</li>}
      {result.items.map((item) => (
        <li key={item.id} className="text-xs text-gray-300 border-b border-gray-800/60 pb-1.5 last:border-0">
          {item.href ? (
            <Link href={item.href} className="text-blue-300 no-underline font-medium">
              {item.primary}
            </Link>
          ) : (
            <span className="font-medium text-gray-200">{item.primary}</span>
          )}
          {item.secondary ? <p className="text-[10px] text-gray-500 mt-0.5">{item.secondary}</p> : null}
        </li>
      ))}
    </ul>
  );
}
