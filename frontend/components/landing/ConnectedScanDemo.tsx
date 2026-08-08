'use client';

import { useEffect, useState } from 'react';

const QR_CELLS = [
  1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1,
  1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1,
  1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1,
  1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1,
  1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1,
  0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
  1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1,
  0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0,
  1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0,
  0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1,
  1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0,
  1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
  1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1,
];

const FIELDS = [
  { label: 'Status', value: 'In use', link: null },
  { label: 'Location', value: 'IT · Floor 2', link: 'Locations' },
  { label: 'Assigned to', value: 'Rahul Sharma', link: null },
  { label: 'Partner', value: 'Dell Technologies', link: 'Partners' },
  { label: 'Warranty', value: 'Active · expires Mar 2027', link: 'Partners' },
  { label: 'Last service', value: '12 days ago', link: 'Maintenance' },
  { label: 'Open issues', value: 'None', link: 'Issues' },
] as const;

const STEPS = [
  { key: 'scan', title: 'Scan QR' },
  { key: 'identify', title: 'Identify asset' },
  { key: 'details', title: 'Load details' },
  { key: 'act', title: 'Ready to act' },
] as const;

type Phase = 'idle' | 'scanning' | 'found' | 'fields' | 'ready';

export default function ConnectedScanDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [scanY, setScanY] = useState(12);
  const [fieldCount, setFieldCount] = useState(0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    setPhase('idle');
    setFieldCount(0);
    setScanY(12);

    const timeouts: number[] = [];
    const intervals: number[] = [];
    const wait = (ms: number, fn: () => void) => {
      timeouts.push(window.setTimeout(fn, ms));
    };

    wait(400, () => {
      setPhase('scanning');
      let y = 12;
      intervals.push(
        window.setInterval(() => {
          y += 7;
          if (y > 88) y = 12;
          setScanY(y);
        }, 120)
      );
    });

    wait(2200, () => {
      intervals.forEach((id) => window.clearInterval(id));
      setPhase('found');
      setScanY(50);
    });

    wait(3400, () => {
      setPhase('fields');
    });

    FIELDS.forEach((_, i) => {
      wait(3600 + i * 380, () => setFieldCount(i + 1));
    });

    wait(3600 + FIELDS.length * 380 + 500, () => setPhase('ready'));

    wait(3600 + FIELDS.length * 380 + 3000, () => setLoop((n) => n + 1));

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      intervals.forEach((id) => window.clearInterval(id));
    };
  }, [loop]);

  const stepIndex =
    phase === 'idle' || phase === 'scanning'
      ? 0
      : phase === 'found'
        ? 1
        : phase === 'fields'
          ? 2
          : 3;

  const showPanel = phase === 'found' || phase === 'fields' || phase === 'ready';

  return (
    <div id="how-it-works" className="mt-12 scroll-mt-24 rounded-2xl border border-gray-700/50 bg-gray-900/50 p-5 sm:p-8 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
            How it works in practice
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Scan an asset QR — Resolve surfaces the connected record.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((step, i) => (
            <span
              key={step.key}
              className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all duration-500 ${
                i === stepIndex
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : i < stepIndex
                    ? 'border-gray-600/60 bg-gray-800/60 text-gray-400'
                    : 'border-gray-800 bg-transparent text-gray-600'
              }`}
            >
              {i + 1}. {step.title}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Phone / QR side */}
        <div className="mx-auto lg:mx-0">
          <div className="w-[200px] rounded-[1.6rem] border border-gray-600/50 bg-gray-950 p-3 shadow-2xl">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[9px] text-gray-500">9:41</span>
              <span className="h-1 w-8 rounded-full bg-gray-700" />
            </div>
            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500 mb-2 text-center">
                {phase === 'scanning' ? 'Scanning…' : phase === 'idle' ? 'Point camera' : 'Matched'}
              </p>
              <div className="relative mx-auto w-fit rounded-xl bg-white p-2.5">
                <div
                  className="grid gap-[2.5px]"
                  style={{ gridTemplateColumns: 'repeat(13, 7px)' }}
                >
                  {QR_CELLS.map((on, i) => (
                    <span
                      key={i}
                      className={`h-[7px] w-[7px] rounded-[0.5px] ${on ? 'bg-gray-950' : 'bg-transparent'}`}
                    />
                  ))}
                </div>
                {(phase === 'scanning' || phase === 'idle') && (
                  <div
                    className="pointer-events-none absolute inset-x-1.5 h-0.5 rounded-full bg-emerald-400"
                    style={{
                      top: `${scanY}%`,
                      boxShadow: '0 0 14px rgba(52, 211, 153, 0.85)',
                      transition: phase === 'scanning' ? 'none' : 'top 0.4s ease',
                    }}
                  />
                )}
                {showPanel && (
                  <div className="absolute inset-0 rounded-xl bg-emerald-400/15 flex items-center justify-center">
                    <span className="h-8 w-8 rounded-full border-2 border-emerald-400 bg-emerald-500/20 flex items-center justify-center text-emerald-300 text-sm font-bold">
                      ✓
                    </span>
                  </div>
                )}
              </div>
              <p
                className={`mt-2.5 text-center text-[11px] font-semibold transition-colors duration-500 ${
                  showPanel ? 'text-emerald-300' : 'text-gray-500'
                }`}
              >
                {showPanel ? 'AST-0142' : 'Asset QR'}
              </p>
            </div>
          </div>
        </div>

        {/* Details panel */}
        <div className="min-h-[280px]">
          <div
            className={`rounded-2xl border bg-gray-950/60 transition-all duration-700 overflow-hidden ${
              showPanel
                ? 'border-gray-600/60 opacity-100 translate-y-0'
                : 'border-gray-800/40 opacity-40 translate-y-2'
            }`}
          >
            <div className="px-4 sm:px-5 py-4 border-b border-gray-800/80 flex items-start justify-between gap-3 min-h-[4.75rem]">
              <div>
                <p
                  className={`text-lg font-bold text-gray-100 transition-all duration-500 ${
                    showPanel ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  {showPanel ? 'Dell Latitude 5540' : 'Waiting for scan…'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {showPanel ? 'Laptop · IT Equipment' : 'Fields appear when an asset is identified'}
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 transition-opacity duration-500 ${
                  phase === 'ready' ? 'opacity-100' : 'opacity-0'
                }`}
              >
                Connected
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-2">
              {FIELDS.map((field, i) => {
                const visible = fieldCount > i;
                return (
                  <div
                    key={field.label}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-500 ${
                      visible
                        ? 'border-gray-700/70 bg-gray-900/70 opacity-100 translate-x-0'
                        : 'border-gray-800/40 bg-transparent opacity-25 translate-x-2'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-600">{field.label}</p>
                      <p className={`text-sm font-medium truncate ${visible ? 'text-gray-200' : 'text-gray-600'}`}>
                        {visible ? field.value : '—'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] text-gray-500 px-2 py-0.5 rounded border border-gray-700/60 transition-opacity duration-300 ${
                        field.link && visible ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {field.link ? `via ${field.link}` : 'via —'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              className={`px-4 sm:px-5 pb-4 flex flex-wrap gap-2 min-h-[2.75rem] transition-opacity duration-500 ${
                phase === 'ready' ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {['View history', 'Report issue', 'Open partner'].map((action) => (
                <span
                  key={action}
                  className="text-xs font-medium text-gray-300 px-3 py-1.5 rounded-lg border border-gray-600/50 bg-gray-800/50"
                >
                  {action}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
