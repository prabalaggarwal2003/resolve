'use client';

import { DonutChart as DepDonut, HorizontalBars as DepBars } from '@/components/depreciation/DepreciationCharts';

export function DonutChart(props: React.ComponentProps<typeof DepDonut>) {
  return <DepDonut {...props} />;
}

export function HorizontalBars(props: React.ComponentProps<typeof DepBars>) {
  return <DepBars {...props} />;
}

export function GaugeChart({
  value,
  max,
  label,
  size = 100,
}: {
  value: number;
  max: number;
  label?: string;
  size?: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(55 65 81 / 0.6)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#8b5cf6" strokeWidth="10" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <p className="text-sm font-bold text-gray-100 -mt-14 pointer-events-none">{label ?? `${Math.round(pct)}%`}</p>
    </div>
  );
}

export function ProgressRing({
  value,
  max,
  label,
  size = 100,
}: {
  value: number;
  max: number;
  label?: string;
  size?: number;
}) {
  return <GaugeChart value={value} max={max} label={label} size={size} />;
}
