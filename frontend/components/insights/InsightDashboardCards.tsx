'use client';

import Link from 'next/link';
import type { InsightResult } from '@/lib/insights';
import { SEVERITY_STYLES, insightViewHref } from '@/lib/insights';

export default function InsightDashboardCards({
  insights,
  loading,
  scrollable = false,
  maxHeight = '320px',
  showItems = false,
}: {
  insights: InsightResult[];
  loading?: boolean;
  scrollable?: boolean;
  maxHeight?: string;
  /** When false (default), hide the affected assets/items list for a simpler card. */
  showItems?: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Evaluating insights…</p>;
  }

  if (!insights.length) {
    return (
      <div className="text-center py-16 rounded-xl border border-dashed border-gray-700/50">
        <p className="text-gray-400 mb-1">No insights yet</p>
        <p className="text-sm text-gray-600">
          Add a check on Configure, or turn on built-in rules.{' '}
          <Link href="/dashboard/insights/rules" className="text-blue-400 hover:text-blue-300 no-underline">
            Configure insights
          </Link>
        </p>
      </div>
    );
  }

  const cards = (
    <div className="space-y-3">
      {insights.map((insight) => {
        const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
        const quiet = insight.count === 0;
        return (
          <div
            key={insight.ruleId}
            className={`rounded-xl border p-4 ${quiet ? 'border-gray-700/50 bg-gray-900/20' : `${style.border} ${style.bg}`}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${quiet ? 'bg-gray-500' : style.dot}`} />
                <div className="min-w-0">
                  <h3 className={`text-sm font-semibold ${quiet ? 'text-gray-300' : style.text}`}>{insight.name}</h3>
                  <p className="text-sm text-gray-300 mt-0.5">
                    {quiet ? 'No matches yet — adjust the check or wait for data to change.' : insight.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className={`text-lg font-bold tabular-nums ${quiet ? 'text-gray-400' : style.text}`}>{insight.count}</p>
                  <p className="text-[10px] text-gray-500 uppercase">matches</p>
                </div>
                {!quiet && (
                  <Link
                    href={insightViewHref(insight)}
                    className="text-xs text-blue-400 hover:text-blue-300 no-underline"
                  >
                    View →
                  </Link>
                )}
                {quiet && (
                  <Link
                    href={`/dashboard/insights/rules?edit=${insight.ruleId}`}
                    className="text-xs text-blue-400 hover:text-blue-300 no-underline"
                  >
                    Edit →
                  </Link>
                )}
              </div>
            </div>
            {showItems && insight.items.length > 0 && (
              <ul className="mt-3 pt-3 border-t border-gray-700/30 space-y-1">
                {insight.items.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex justify-between text-xs text-gray-400">
                    <span className="truncate">{item.label}{item.sublabel ? ` · ${item.sublabel}` : ''}</span>
                    {item.meta ? <span className="text-gray-600 shrink-0 ml-2">{item.meta}</span> : null}
                  </li>
                ))}
                {insight.items.length > 5 && (
                  <li className="text-[10px] text-gray-600">+{insight.items.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );

  if (scrollable) {
    return (
      <div className="overflow-y-auto pr-1 -mr-1" style={{ maxHeight }}>
        {cards}
      </div>
    );
  }

  return cards;
}
