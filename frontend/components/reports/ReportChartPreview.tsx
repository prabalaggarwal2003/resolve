'use client';

type ChartData = {
  type: string;
  labels: string[];
  values: number[];
};

const COLORS = [
  '#f59e0b',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#f472b6',
  '#94a3b8',
  '#2dd4bf',
  '#eab308',
  '#818cf8',
];

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

function donutSlice(cx: number, cy: number, r: number, r0: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const s0 = polar(cx, cy, r0, end);
  const e0 = polar(cx, cy, r0, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} L ${e0.x} ${e0.y} A ${r0} ${r0} 0 ${large} 1 ${s0.x} ${s0.y} Z`;
}

function Legend({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
      {labels.map((label, i) => (
        <span key={`${label}-${i}`} className="inline-flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
          <span className="truncate max-w-[120px]">{label}</span>
        </span>
      ))}
    </div>
  );
}

function BarChart({ labels, values, horizontal = false }: { labels: string[]; values: number[]; horizontal?: boolean }) {
  const max = Math.max(...values, 1);
  if (horizontal) {
    return (
      <div className="space-y-1.5">
        {labels.map((label, i) => {
          const w = Math.max(4, Math.round((values[i] / max) * 100));
          return (
            <div key={`${label}-${i}`} className="flex items-center gap-2">
              <span className="w-20 text-[10px] text-gray-500 truncate shrink-0">{label}</span>
              <div className="flex-1 h-4 rounded bg-gray-800/80 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${w}%`, background: COLORS[i % COLORS.length] }}
                  title={`${label}: ${values[i]}`}
                />
              </div>
              <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">{values[i]}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-1.5 h-40">
      {labels.map((label, i) => {
        const h = Math.max(4, Math.round((values[i] / max) * 100));
        return (
          <div key={`${label}-${i}`} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-[9px] text-gray-500 tabular-nums">{values[i]}</span>
            <div
              className="w-full max-w-[36px] rounded-t"
              style={{ height: `${h}%`, background: COLORS[i % COLORS.length] }}
              title={`${label}: ${values[i]}`}
            />
            <span className="text-[9px] text-gray-500 truncate w-full text-center">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineOrArea({ labels, values, area }: { labels: string[]; values: number[]; area?: boolean }) {
  const max = Math.max(...values, 1);
  const w = 400;
  const h = 160;
  const pad = 20;
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
    const y = h - pad - ((v / max) * (h - pad * 2));
    return { x, y, v, label: labels[i] };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${line} L ${pts[pts.length - 1]?.x ?? pad} ${h - pad} L ${pad} ${h - pad} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={w - pad}
            y1={h - pad - t * (h - pad * 2)}
            y2={h - pad - t * (h - pad * 2)}
            stroke="#374151"
            strokeWidth="1"
          />
        ))}
        {area && <path d={areaPath} fill="#f59e0b33" stroke="none" />}
        <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={COLORS[i % COLORS.length]} stroke="#111827" strokeWidth="1">
            <title>{`${p.label}: ${p.v}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between px-2">
        {labels.map((label, i) => (
          <span key={`${label}-${i}`} className="text-[9px] text-gray-500 truncate max-w-[20%] text-center">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PieOrDonut({ labels, values, donut }: { labels: string[]; values: number[]; donut?: boolean }) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let angle = 0;
  const cx = 90;
  const cy = 90;
  const r = 70;
  const r0 = donut ? 38 : 0;
  const slices = values.map((v, i) => {
    const sweep = (v / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const mid = start + sweep / 2;
    const labelPos = polar(cx, cy, donut ? 54 : 42, mid);
    return { start, end, v, i, mid, labelPos, pct: Math.round((v / total) * 100) };
  });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 180 180" className="w-44 h-44 shrink-0">
        {slices.map((s) => {
          if (s.end - s.start < 0.2) return null;
          const d = donut
            ? donutSlice(cx, cy, r, r0, s.start, Math.min(s.end, s.start + 359.9))
            : `${arcPath(cx, cy, r, s.start, Math.min(s.end, s.start + 359.9))} L ${cx} ${cy} Z`;
          return (
            <path key={s.i} d={d} fill={COLORS[s.i % COLORS.length]} stroke="#111827" strokeWidth="1">
              <title>{`${labels[s.i]}: ${s.v} (${s.pct}%)`}</title>
            </path>
          );
        })}
        {donut && (
          <text x={cx} y={cy + 4} textAnchor="middle" className="fill-gray-300" fontSize="12" fontWeight="600">
            {total}
          </text>
        )}
      </svg>
      <div className="space-y-1 min-w-[140px]">
        {labels.map((label, i) => (
          <div key={`${label}-${i}`} className="flex items-center gap-2 text-xs text-gray-300">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="truncate flex-1">{label}</span>
            <span className="text-gray-500 tabular-nums">{values[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(...values, 1);
  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(labels.length))));
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {labels.map((label, i) => {
        const intensity = values[i] / max;
        return (
          <div
            key={`${label}-${i}`}
            className="rounded-md border border-gray-700/40 px-2 py-3 text-center"
            style={{ background: `rgba(245, 158, 11, ${0.12 + intensity * 0.7})` }}
            title={`${label}: ${values[i]}`}
          >
            <p className="text-[10px] text-gray-200 truncate">{label}</p>
            <p className="text-xs font-semibold text-amber-100 tabular-nums mt-0.5">{values[i]}</p>
          </div>
        );
      })}
    </div>
  );
}

function Treemap({ labels, values }: { labels: string[]; values: number[] }) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex flex-wrap gap-1 min-h-[160px]">
      {labels.map((label, i) => {
        const share = values[i] / total;
        const basis = Math.max(12, Math.round(share * 100));
        return (
          <div
            key={`${label}-${i}`}
            className="rounded-md border border-gray-800/60 p-2 flex flex-col justify-between overflow-hidden"
            style={{
              flexGrow: basis,
              flexBasis: `${basis}%`,
              minWidth: '72px',
              minHeight: `${60 + share * 80}px`,
              background: COLORS[i % COLORS.length],
            }}
            title={`${label}: ${values[i]}`}
          >
            <p className="text-[10px] font-medium text-gray-950 truncate">{label}</p>
            <p className="text-sm font-bold text-gray-950 tabular-nums">{values[i]}</p>
          </div>
        );
      })}
    </div>
  );
}

function Timeline({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="relative pl-3 border-l border-gray-700/60 space-y-3 py-1">
      {labels.map((label, i) => (
        <div key={`${label}-${i}`} className="relative">
          <span
            className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full"
            style={{ background: COLORS[i % COLORS.length] }}
          />
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-200 truncate">{label}</p>
              <div className="mt-1 h-1.5 rounded bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.max(6, Math.round((values[i] / max) * 100))}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-400 tabular-nums">{values[i]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiCards({ labels, values }: { labels: string[]; values: number[] }) {
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3">
        <p className="text-[10px] uppercase text-amber-400/80">Total</p>
        <p className="text-xl font-semibold text-amber-100 tabular-nums mt-1">{total}</p>
      </div>
      {labels.slice(0, 7).map((label, i) => (
        <div key={`${label}-${i}`} className="rounded-lg border border-gray-700/50 bg-gray-900/40 px-3 py-3">
          <p className="text-[10px] uppercase text-gray-500 truncate">{label}</p>
          <p className="text-lg font-semibold text-gray-100 tabular-nums mt-1">{values[i]}</p>
        </div>
      ))}
    </div>
  );
}

function PivotTable({ labels, values }: { labels: string[]; values: number[] }) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="overflow-auto rounded-lg border border-gray-700/50">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-800 bg-gray-900/60">
            <th className="px-3 py-2 font-medium">Group</th>
            <th className="px-3 py-2 font-medium">Count</th>
            <th className="px-3 py-2 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={`${label}-${i}`} className="border-b border-gray-800/60 text-gray-300">
              <td className="px-3 py-1.5">{label}</td>
              <td className="px-3 py-1.5 tabular-nums">{values[i]}</td>
              <td className="px-3 py-1.5 tabular-nums">{Math.round((values[i] / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportChartPreview({
  chart,
  visualization,
  emptyHint,
}: {
  chart: ChartData | null | undefined;
  visualization?: string;
  emptyHint?: string;
}) {
  const type = visualization || chart?.type || 'table';

  if (type === 'table') {
    return (
      <p className="text-xs text-gray-500 py-2">
        Table view selected — results appear in the data grid below.
      </p>
    );
  }

  if (!chart?.labels?.length) {
    return (
      <p className="text-xs text-gray-500 py-2">
        {emptyHint || 'No chart data yet. Select fields and run preview (grouping helps chart views).'}
      </p>
    );
  }

  const { labels, values } = chart;

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-900/30 p-3">
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-3">
        {type.replace(/_/g, ' ')} visualization
      </p>
      {type === 'bar' && <BarChart labels={labels} values={values} />}
      {type === 'line' && <LineOrArea labels={labels} values={values} />}
      {type === 'area' && <LineOrArea labels={labels} values={values} area />}
      {type === 'pie' && <PieOrDonut labels={labels} values={values} />}
      {type === 'donut' && <PieOrDonut labels={labels} values={values} donut />}
      {(type === 'heatmap') && <Heatmap labels={labels} values={values} />}
      {type === 'treemap' && <Treemap labels={labels} values={values} />}
      {type === 'timeline' && <Timeline labels={labels} values={values} />}
      {type === 'kpi' && <KpiCards labels={labels} values={values} />}
      {type === 'pivot' && <PivotTable labels={labels} values={values} />}
      {!['bar', 'line', 'area', 'pie', 'donut', 'heatmap', 'treemap', 'timeline', 'kpi', 'pivot'].includes(type) && (
        <BarChart labels={labels} values={values} />
      )}
      {!['pie', 'donut', 'kpi', 'pivot', 'treemap'].includes(type) && <Legend labels={labels} />}
    </div>
  );
}
