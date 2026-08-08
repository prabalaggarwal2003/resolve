'use client';

import { useEffect, useState } from 'react';

type Node = {
  id: string;
  label: string;
  group: string;
  /** percent positions inside the board */
  x: number;
  y: number;
  size: 'sm' | 'md' | 'lg';
};

const NODES: Node[] = [
  { id: 'fields', label: 'Fields', group: 'Data', x: 22, y: 30, size: 'lg' },
  { id: 'templates', label: 'Templates', group: 'Data', x: 24, y: 10, size: 'md' },
  { id: 'locations', label: 'Locations', group: 'Data', x: 12, y: 48, size: 'md' },
  { id: 'partners', label: 'Partner types', group: 'Data', x: 22, y: 72, size: 'sm' },
  { id: 'workflows', label: 'Workflows', group: 'Process', x: 72, y: 14, size: 'lg' },
  { id: 'statuses', label: 'Statuses', group: 'Process', x: 88, y: 38, size: 'md' },
  { id: 'relations', label: 'Relationships', group: 'Process', x: 84, y: 60, size: 'sm' },
  { id: 'notify', label: 'Notifications', group: 'Process', x: 70, y: 80, size: 'md' },
  { id: 'perms', label: 'Permissions', group: 'Access', x: 48, y: 10, size: 'md' },
  { id: 'dash', label: 'Dashboards', group: 'Access', x: 55, y: 88, size: 'sm' },
  { id: 'reports', label: 'Reports', group: 'Access', x: 38, y: 78, size: 'md' },
  { id: 'qr', label: 'QR views', group: 'Access', x: 90, y: 78, size: 'sm' },
];

const GROUP_TONE: Record<string, string> = {
  Data: 'border-sky-500/35 bg-sky-500/10 text-sky-100',
  Process: 'border-amber-500/35 bg-amber-500/10 text-amber-100',
  Access: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100',
};

export default function CustomOrgBoard() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % NODES.length);
    }, 1600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="w-full">
      {/* Desktop / tablet constellation */}
      <div className="relative hidden sm:block mx-auto max-w-3xl aspect-[16/10] rounded-3xl border border-gray-700/50 bg-gradient-to-b from-gray-900/80 to-gray-950/90 overflow-hidden">
        {/* soft grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(148 163 184) 1px, transparent 0)',
            backgroundSize: '27px 27px',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.08),transparent_55%)]" />

        {/* SVG spokes from hub to nodes */}
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          {NODES.map((node, i) => {
            const isActive = i === active;
            return (
              <line
                key={node.id}
                x1="50%"
                y1="50%"
                x2={`${node.x}%`}
                y2={`${node.y}%`}
                stroke={isActive ? 'rgb(203 213 225)' : 'rgb(71 85 105)'}
                strokeWidth={isActive ? 1.5 : 1}
                strokeOpacity={isActive ? 0.7 : 0.28}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>

        {/* Center hub */}
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gray-400/20 blur-xl scale-150" />
            <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-gray-500/50 bg-gray-950/90 shadow-[0_0_40px_rgba(148,163,184,0.15)] backdrop-blur-md">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Adapts</span>
              <span className="text-[12px] font-bold text-gray-100 mt-0.5">EVERY ORG</span>
            </div>
          </div>
        </div>

        {/* Orbiting capability nodes */}
        {NODES.map((node, i) => {
          const isActive = i === active;
          const pad =
            node.size === 'lg' ? 'px-3.5 py-2 text-sm' : node.size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]';
          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border backdrop-blur-sm font-medium transition-all duration-500 cursor-default ${pad} ${
                isActive
                  ? `${GROUP_TONE[node.group]} scale-110 shadow-lg`
                  : 'border-gray-700/70 bg-gray-900/80 text-gray-400 scale-100'
              }`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              {node.label}
            </button>
          );
        })}
      </div>

      {/* Mobile: compact connected stack */}
      <div className="sm:hidden rounded-2xl border border-gray-700/50 bg-gray-950/60 overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-800/80 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Adapt</p>
          <p className="text-base font-bold text-gray-100">Your organization</p>
        </div>
        <div className="divide-y divide-gray-800/60">
          {[
            { title: 'Shape data', items: ['Fields', 'Templates', 'Locations', 'Partner types'], tone: 'sky' },
            { title: 'Run process', items: ['Workflows', 'Statuses', 'Relationships', 'Notifications'], tone: 'amber' },
            { title: 'Control access', items: ['Permissions', 'Dashboards', 'Reports', 'QR views'], tone: 'emerald' },
          ].map((row) => (
            <div key={row.title} className="px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500 mb-2">{row.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {row.items.map((item) => (
                  <span
                    key={item}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      row.tone === 'sky'
                        ? 'border-sky-500/25 bg-sky-500/10 text-sky-100/90'
                        : row.tone === 'amber'
                          ? 'border-amber-500/25 bg-amber-500/10 text-amber-100/90'
                          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100/90'
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
