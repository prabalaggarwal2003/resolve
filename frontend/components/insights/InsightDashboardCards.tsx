'use client';

import Link from 'next/link';
import type { InsightResult } from '@/lib/insights';
import { SEVERITY_STYLES } from '@/lib/insights';

export default function InsightDashboardCards({
  insights,
  loading,
}: {
  insights: InsightResult[];
  loading?: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Evaluating insights…</p>;
  }

  if (!insights.length) {
    return (
      <div className="text-center py-16 rounded-xl border border-dashed border-gray-700/50">
        <p className="text-gray-400 mb-1">No active insights</p>
        <p className="text-sm text-gray-600">All rules are clear or disabled. Check Rules to configure.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((insight) => {
        const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
        return (
          <div
            key={insight.ruleId}
            className={`rounded-xl border p-4 ${style.border} ${style.bg}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`text-sm font-semibold ${style.text}`}>{insight.name}</h3>
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">{insight.category}</span>
                    {insight.isBuiltin ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700/60 text-gray-500">Built-in</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-300 mt-0.5">{insight.message}</p>
                  {insight.description ? (
                    <p className="text-xs text-gray-500 mt-1">{insight.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-lg font-bold ${style.text}`}>{insight.count}</span>
                <Link
                  href={insight.link}
                  className="text-xs text-blue-400 hover:text-blue-300 no-underline"
                >
                  View →
                </Link>
              </div>
            </div>
            {insight.items.length > 0 && (
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
}
