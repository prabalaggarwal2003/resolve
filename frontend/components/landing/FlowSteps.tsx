'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  'Your Excel',
  'Map columns',
  'Validate',
  'Preview',
  'Import',
] as const;

const REPORT_STEPS = [
  'Choose data',
  'Pick fields',
  'Filter',
  'Group',
  'Calculate',
  'Visualize',
  'Export',
] as const;

export function VerticalFlow({
  steps,
  accent = 'gray',
}: {
  steps: readonly string[];
  accent?: 'gray' | 'emerald';
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % steps.length);
    }, 1400);
    return () => window.clearInterval(id);
  }, [steps.length]);

  const activeBorder =
    accent === 'emerald' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-gray-400/50 bg-gray-100/10 text-gray-100';

  return (
    <div className="flex flex-col items-stretch gap-0 max-w-xs mx-auto w-full">
      {steps.map((step, i) => (
        <div key={step} className="flex flex-col items-center">
          <div
            className={`w-full text-center text-sm font-semibold px-4 py-3 rounded-xl border transition-all duration-500 ${
              i === active
                ? activeBorder
                : 'border-gray-800/70 bg-gray-900/40 text-gray-500'
            }`}
          >
            {step}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-5 w-px my-1 transition-colors duration-500 ${
                i === active ? 'bg-gray-400/70' : 'bg-gray-800'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function ImportFlow() {
  return <VerticalFlow steps={STEPS} />;
}

export function ReportFlow() {
  return <VerticalFlow steps={REPORT_STEPS} accent="emerald" />;
}
