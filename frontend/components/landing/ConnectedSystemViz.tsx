'use client';

/**
 * Legacy SVG hub animation — superseded by ConnectedSystemGraph.tsx
 * (scroll-driven Three.js operational graph). Kept for reference only.
 */

import { useEffect, useMemo, useState } from 'react';

/*
═══════════════════════════════════════════════════════════════════════════════
PREVIOUS Three.js orbiting-nodes visualization (kept for reference)
═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const NODES = [
  { label: 'Assets', color: 0x94a3b8 },
  { label: 'Partners', color: 0x64748b },
  { label: 'Procurement', color: 0x78879a },
  { label: 'Maintenance', color: 0x6b7c8f },
  { label: 'Issues', color: 0x8b9aab },
  { label: 'Reports', color: 0x7a8b9c },
];

export default function ConnectedSystemViz() {
  // … 3D spheres revolving around a hub with projected HTML labels …
}

═══════════════════════════════════════════════════════════════════════════════
*/

const MODULES = [
  { id: 'assets', label: 'Assets' },
  { id: 'partners', label: 'Partners' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'issues', label: 'Issues' },
  { id: 'reports', label: 'Reports' },
] as const;

const CX = 320;
const CY = 210;
const RADIUS = 138;

type Pulse = {
  id: number;
  from: number; // -1 = hub
  to: number; // module index, or -1 for return-to-hub
  progress: number;
  speed: number;
};

function polar(i: number, n: number, r = RADIUS) {
  const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CX + Math.cos(angle) * r,
    y: CY + Math.sin(angle) * r * 0.92,
    angle,
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function ConnectedSystemViz() {
  const nodes = useMemo(
    () => MODULES.map((m, i) => ({ ...m, ...polar(i, MODULES.length) })),
    []
  );

  const [active, setActive] = useState(0);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [ripple, setRipple] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let spawnAcc = 0;
    let pulseId = 0;
    let localPulses: Pulse[] = [];
    let rippleT = 0;
    let highlight = 0;

    const spawn = () => {
      const to = Math.floor(Math.random() * MODULES.length);
      // Hub → module
      localPulses.push({
        id: pulseId++,
        from: -1,
        to,
        progress: 0,
        speed: 0.55 + Math.random() * 0.35,
      });
      // Occasional neighbor hop (module → module)
      if (Math.random() > 0.45) {
        const neighbor = (to + 1 + Math.floor(Math.random() * (MODULES.length - 1))) % MODULES.length;
        localPulses.push({
          id: pulseId++,
          from: to,
          to: neighbor,
          progress: -0.35, // delayed start
          speed: 0.4 + Math.random() * 0.25,
        });
      }
    };

    spawn();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spawnAcc += dt;
      rippleT += dt;

      if (spawnAcc > 1.15) {
        spawnAcc = 0;
        spawn();
      }

      const next: Pulse[] = [];
      for (const p of localPulses) {
        const prog = p.progress + p.speed * dt;
        if (prog < 1.05) {
          next.push({ ...p, progress: prog });
          if (prog >= 0.92 && prog < 1 && p.to >= 0) highlight = p.to;
        } else if (p.from === -1 && p.to >= 0 && Math.random() > 0.35) {
          // Echo back to hub
          next.push({
            id: pulseId++,
            from: p.to,
            to: -1,
            progress: 0,
            speed: p.speed * 0.9,
          });
        }
      }
      localPulses = next.slice(-14);
      setPulses([...localPulses]);
      setActive(highlight);
      setRipple((rippleT % 3.2) / 3.2);
      setTick((t) => t + 1);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pulseDots = pulses
    .filter((p) => p.progress >= 0 && p.progress <= 1)
    .map((p) => {
      const from =
        p.from === -1 ? { x: CX, y: CY } : { x: nodes[p.from].x, y: nodes[p.from].y };
      const to = p.to === -1 ? { x: CX, y: CY } : { x: nodes[p.to].x, y: nodes[p.to].y };
      // Slight arc
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const nx = -dy * 0.12;
      const ny = dx * 0.12;
      const t = p.progress;
      const omt = 1 - t;
      const x = omt * omt * from.x + 2 * omt * t * (mx + nx) + t * t * to.x;
      const y = omt * omt * from.y + 2 * omt * t * (my + ny) + t * t * to.y;
      return { id: p.id, x, y, t };
    });

  const breath = 1 + Math.sin(tick * 0.04) * 0.04;

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="relative rounded-3xl border border-gray-700/40 bg-gradient-to-b from-gray-900/70 to-gray-950/90 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(148 163 184) 1px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.1),transparent_60%)]" />

        <svg
          viewBox="0 0 640 420"
          className="relative w-full h-auto block"
          role="img"
          aria-label="Resolve modules connected as one system"
        >
          <defs>
            <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#94a3b8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="spokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.15" />
            </linearGradient>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Unity ring */}
          <ellipse
            cx={CX}
            cy={CY}
            rx={RADIUS + 8}
            ry={(RADIUS + 8) * 0.92}
            fill="none"
            stroke="rgb(71 85 105)"
            strokeOpacity="0.35"
            strokeWidth="1"
            strokeDasharray="4 10"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;28"
              dur="8s"
              repeatCount="indefinite"
            />
          </ellipse>

          {/* Expanding sync ripple */}
          <ellipse
            cx={CX}
            cy={CY}
            rx={lerp(36, RADIUS + 40, ripple)}
            ry={lerp(36, (RADIUS + 40) * 0.92, ripple)}
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="1.5"
            strokeOpacity={Math.max(0, 0.45 * (1 - ripple))}
          />

          {/* Neighbor links — oneness between modules */}
          {nodes.map((node, i) => {
            const next = nodes[(i + 1) % nodes.length];
            const lit = active === i || active === (i + 1) % nodes.length;
            return (
              <line
                key={`ring-${node.id}`}
                x1={node.x}
                y1={node.y}
                x2={next.x}
                y2={next.y}
                stroke={lit ? 'rgb(148 163 184)' : 'rgb(51 65 85)'}
                strokeOpacity={lit ? 0.45 : 0.2}
                strokeWidth={lit ? 1.5 : 1}
              />
            );
          })}

          {/* Hub → module spokes */}
          {nodes.map((node, i) => {
            const lit = active === i;
            return (
              <line
                key={`spoke-${node.id}`}
                x1={CX}
                y1={CY}
                x2={node.x}
                y2={node.y}
                stroke="url(#spokeGrad)"
                strokeOpacity={lit ? 0.95 : 0.4}
                strokeWidth={lit ? 2 : 1.2}
              />
            );
          })}

          {/* Traveling pulses */}
          {pulseDots.map((d) => (
            <g key={d.id} filter="url(#softGlow)">
              <circle cx={d.x} cy={d.y} r={5.5} fill="rgb(226 232 240)" opacity={0.25} />
              <circle
                cx={d.x}
                cy={d.y}
                r={2.8}
                fill="rgb(226 232 240)"
                opacity={0.55 + (1 - Math.abs(d.t - 0.5) * 2) * 0.35}
              />
            </g>
          ))}

          {/* Hub */}
          <circle cx={CX} cy={CY} r={54 * breath} fill="url(#hubGlow)" />
          <circle
            cx={CX}
            cy={CY}
            r={34}
            fill="rgb(3 7 18)"
            stroke="rgb(148 163 184)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
          <circle
            cx={CX}
            cy={CY}
            r={26}
            fill="rgb(15 23 42)"
            stroke="rgb(100 116 139)"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <text
            x={CX}
            y={CY - 4}
            textAnchor="middle"
            fill="rgb(226 232 240)"
            fontSize="11"
            fontWeight="700"
            letterSpacing="0.28em"
          >
            RESOLVE
          </text>
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            fill="rgb(100 116 139)"
            fontSize="9"
            letterSpacing="0.12em"
          >
            one system
          </text>

          {/* Module nodes */}
          {nodes.map((node, i) => {
            const lit = active === i;
            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={lit ? 22 : 18}
                  fill={lit ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.9)'}
                  stroke={lit ? 'rgb(203 213 225)' : 'rgb(71 85 105)'}
                  strokeWidth={lit ? 1.8 : 1.2}
                  className="transition-[r] duration-300"
                  filter={lit ? 'url(#softGlow)' : undefined}
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={4}
                  fill={lit ? 'rgb(226 232 240)' : 'rgb(148 163 184)'}
                  opacity={lit ? 1 : 0.7}
                />
                <text
                  x={node.x}
                  y={node.y + (node.y < CY ? -30 : 36)}
                  textAnchor="middle"
                  fill={lit ? 'rgb(241 245 249)' : 'rgb(148 163 184)'}
                  fontSize="11"
                  fontWeight="600"
                  letterSpacing="0.06em"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
