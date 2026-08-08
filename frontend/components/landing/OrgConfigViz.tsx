'use client';

import { useEffect, useRef } from 'react';

type OrgConfig = {
  id: string;
  centerLabel: string;
  modules: string[];
  /** Unique ring rotation so fields move between org types */
  rotation: number;
  radius: number;
};

const PLATFORM: OrgConfig = {
  id: 'platform',
  centerLabel: 'Resolve',
  modules: [
    'Assets',
    'Vendors',
    'Users',
    'Locations',
    'Workflows',
    'Maintenance',
    'Issues',
    'Reports',
  ],
  rotation: 0,
  radius: 34,
};

const COLLEGE: OrgConfig = {
  id: 'college',
  centerLabel: 'College',
  modules: ['Assets', 'Students', 'Locations', 'Audits', 'Issues', 'Labs'],
  rotation: -0.25,
  radius: 33,
};

const FACTORY: OrgConfig = {
  id: 'factory',
  centerLabel: 'Factory',
  modules: ['Machines', 'Operators', 'Vendors', 'Maintenance', 'Production' ,'Breakdown'],
  rotation: Math.PI / 5,
  radius: 36,
};

const OFFICE: OrgConfig = {
  id: 'office',
  centerLabel: 'Office',
  modules: ['Assets', 'Employees', 'Vendors', 'Procurement', 'Issues', 'Audit Logs'],
  rotation: Math.PI / 2.15,
  radius: 34,
};

const FADE_IN = 2.2;
const HOLD = 2.6;
const MORPH = 3.5;
const PAUSE = 0.9;
const INTRO = 1.4; // whole-stage fade before modules appear
const OUTRO = 1.2; // whole-stage fade after office

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function ringSlot(index: number, count: number, radiusPct: number, rotation: number) {
  const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2 + rotation;
  return {
    x: 50 + Math.cos(angle) * radiusPct,
    y: 50 + Math.sin(angle) * radiusPct * 0.82,
  };
}

function layoutFor(config: OrgConfig) {
  const map = new Map<string, { x: number; y: number }>();
  config.modules.forEach((label, i) => {
    map.set(label, ringSlot(i, config.modules.length, config.radius, config.rotation));
  });
  return map;
}

type MorphPill = {
  id: string;
  fromLabel: string;
  toLabel: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  fadeOut: boolean;
  fadeIn: boolean;
};

function buildMorphPlan(from: OrgConfig, to: OrgConfig): MorphPill[] {
  const fromLayout = layoutFor(from);
  const toLayout = layoutFor(to);
  const usedTo = new Set<string>();
  const pills: MorphPill[] = [];

  // Shared labels keep identity and glide to the new org slot
  from.modules.forEach((label) => {
    if (!toLayout.has(label)) return;
    usedTo.add(label);
    pills.push({
      id: `keep-${label}`,
      fromLabel: label,
      toLabel: label,
      fromPos: fromLayout.get(label)!,
      toPos: toLayout.get(label)!,
      fadeOut: false,
      fadeIn: false,
    });
  });

  const unmatchedFrom = from.modules.filter((l) => !toLayout.has(l));
  const unmatchedTo = to.modules.filter((l) => !usedTo.has(l));

  // Shift pairing so pills travel to a different angle (visible rearrange)
  const shift = Math.max(1, Math.floor(unmatchedTo.length / 2));
  const rotatedTo = [...unmatchedTo.slice(shift), ...unmatchedTo.slice(0, shift)];
  const pairs = Math.min(unmatchedFrom.length, rotatedTo.length);
  const pairedTo = new Set<string>();

  for (let i = 0; i < pairs; i++) {
    const a = unmatchedFrom[i];
    const b = rotatedTo[i];
    pairedTo.add(b);
    pills.push({
      id: `morph-${a}-${b}`,
      fromLabel: a,
      toLabel: b,
      fromPos: fromLayout.get(a)!,
      toPos: toLayout.get(b)!,
      fadeOut: false,
      fadeIn: false,
    });
  }

  for (let i = pairs; i < unmatchedFrom.length; i++) {
    const a = unmatchedFrom[i];
    const pos = fromLayout.get(a)!;
    pills.push({
      id: `out-${a}`,
      fromLabel: a,
      toLabel: a,
      fromPos: pos,
      toPos: { x: 50 + (pos.x - 50) * 0.42, y: 50 + (pos.y - 50) * 0.42 },
      fadeOut: true,
      fadeIn: false,
    });
  }

  unmatchedTo
    .filter((b) => !pairedTo.has(b))
    .forEach((b) => {
      const pos = toLayout.get(b)!;
      pills.push({
        id: `in-${b}`,
        fromLabel: b,
        toLabel: b,
        fromPos: { x: 50 + (pos.x - 50) * 0.42, y: 50 + (pos.y - 50) * 0.42 },
        toPos: pos,
        fadeOut: false,
        fadeIn: true,
      });
    });

  return pills;
}

type DomPill = {
  el: HTMLButtonElement;
  line: SVGLineElement;
  id: string;
  hoverT: number;
};

const PILL_CLASS =
  'absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-gray-600/40 bg-gray-950/55 px-3 py-1.5 text-[11px] sm:text-xs font-semibold tracking-wide text-gray-300 backdrop-blur-[2px] will-change-transform cursor-default';

export default function OrgConfigViz() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const spokesRef = useRef<SVGSVGElement>(null);
  const centerLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const pillsRoot = pillsRef.current;
    const spokes = spokesRef.current;
    const centerLabelEl = centerLabelRef.current;
    if (!stage || !pillsRoot || !spokes || !centerLabelEl) return;

    const reduced = prefersReducedMotion();
    const domPills: DomPill[] = [];
    let hoverId: string | null = null;
    let morphPlan: MorphPill[] | null = null;

    const clearPills = () => {
      domPills.forEach((p) => {
        p.el.remove();
        p.line.remove();
      });
      domPills.length = 0;
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const paintPill = (
      pill: DomPill,
      x: number,
      y: number,
      opacity: number,
      scale: number,
      label: string,
      dt: number
    ) => {
      if (pill.el.textContent !== label) pill.el.textContent = label;

      const hoverTarget = hoverId === pill.id ? 1 : 0;
      const hoverFollow = reduced ? 1 : 1 - Math.exp(-6.5 * dt);
      pill.hoverT = lerp(pill.hoverT, hoverTarget, hoverFollow);
      const highlight = easeInOutCubic(pill.hoverT);

      // Ease others down only as the hovered pill eases up
      const maxHover = domPills.reduce((m, p) => Math.max(m, p.hoverT), 0);
      const othersDim = hoverId && hoverId !== pill.id ? lerp(1, 0.42, easeInOutCubic(maxHover)) : 1;

      const finalScale = scale * (1 + highlight * 0.1);
      const finalOpacity = Math.max(0, opacity * othersDim);

      pill.el.style.left = `${x}%`;
      pill.el.style.top = `${y}%`;
      pill.el.style.opacity = String(finalOpacity);
      pill.el.style.transform = `translate(-50%, -50%) scale(${finalScale})`;
      pill.el.style.borderColor = `rgba(${lerp(75, 156, highlight)}, ${lerp(85, 163, highlight)}, ${lerp(99, 175, highlight)}, ${lerp(0.4, 0.75, highlight)})`;
      pill.el.style.backgroundColor = `rgba(${lerp(3, 17, highlight)}, ${lerp(7, 24, highlight)}, ${lerp(18, 39, highlight)}, ${lerp(0.45, 0.9, highlight)})`;
      pill.el.style.color = `rgb(${lerp(209, 249, highlight)}, ${lerp(213, 250, highlight)}, ${lerp(219, 251, highlight)})`;
      pill.el.style.boxShadow =
        highlight > 0.02
          ? `0 ${6 + highlight * 8}px ${18 + highlight * 14}px rgba(0,0,0,${0.12 + highlight * 0.22})`
          : 'none';
      pill.el.style.zIndex = highlight > 0.45 ? '20' : '10';

      pill.line.setAttribute('x2', `${x}%`);
      pill.line.setAttribute('y2', `${y}%`);
      pill.line.setAttribute(
        'stroke-opacity',
        String(0.16 * opacity * othersDim * (1 + highlight * 0.75))
      );
      pill.line.setAttribute('stroke-width', String(1 + highlight * 0.55));
    };

    const ensurePills = (items: { id: string; label: string }[]) => {
      if (domPills.length !== items.length) {
        clearPills();
        items.forEach((item) => {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = PILL_CLASS;
          el.textContent = item.label;
          el.onpointerenter = () => {
            hoverId = item.id;
          };
          el.onpointerleave = () => {
            if (hoverId === item.id) hoverId = null;
          };
          pillsRoot.appendChild(el);

          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', '50%');
          line.setAttribute('y1', '50%');
          line.setAttribute('x2', '50%');
          line.setAttribute('y2', '50%');
          line.setAttribute('stroke', 'rgb(100 116 139)');
          line.setAttribute('stroke-opacity', '0');
          spokes.appendChild(line);

          domPills.push({ el, line, id: item.id, hoverT: 0 });
        });
      } else {
        items.forEach((item, i) => {
          domPills[i].id = item.id;
          domPills[i].el.onpointerenter = () => {
            hoverId = item.id;
          };
          domPills[i].el.onpointerleave = () => {
            if (hoverId === item.id) hoverId = null;
          };
        });
      }
    };

    const setCenterLabel = (text: string, opacity: number) => {
      // Platform state: only the static top "Resolve" — hide the secondary line
      if (text === 'Resolve') {
        centerLabelEl.textContent = '';
        centerLabelEl.style.opacity = '0';
        return;
      }
      centerLabelEl.textContent = text;
      centerLabelEl.style.opacity = String(opacity);
    };

    const showConfig = (config: OrgConfig, opacity: number) => {
      const layout = layoutFor(config);
      ensurePills(config.modules.map((label) => ({ id: label, label })));
      setCenterLabel(config.centerLabel, opacity);
      stage.style.opacity = '1';
      config.modules.forEach((label, i) => {
        const pos = layout.get(label)!;
        paintPill(domPills[i], pos.x, pos.y, opacity, 1, label, 1);
      });
    };

    type Phase =
      | { type: 'intro' }
      | { type: 'fade-in' }
      | { type: 'hold'; config: OrgConfig }
      | { type: 'morph'; from: OrgConfig; to: OrgConfig }
      | { type: 'outro' }
      | { type: 'pause' };

    const timeline: { phase: Phase; duration: number }[] = [
      { phase: { type: 'intro' }, duration: INTRO },
      { phase: { type: 'fade-in' }, duration: FADE_IN },
      { phase: { type: 'hold', config: PLATFORM }, duration: HOLD },
      { phase: { type: 'morph', from: PLATFORM, to: COLLEGE }, duration: MORPH },
      { phase: { type: 'hold', config: COLLEGE }, duration: HOLD },
      { phase: { type: 'morph', from: COLLEGE, to: FACTORY }, duration: MORPH },
      { phase: { type: 'hold', config: FACTORY }, duration: HOLD },
      { phase: { type: 'morph', from: FACTORY, to: OFFICE }, duration: MORPH },
      { phase: { type: 'hold', config: OFFICE }, duration: HOLD },
      { phase: { type: 'outro' }, duration: OUTRO },
      { phase: { type: 'pause' }, duration: PAUSE },
    ];

    if (reduced) {
      showConfig(COLLEGE, 1);
      stage.style.opacity = '1';
      return;
    }

    let phaseIndex = 0;
    let phaseT = 0;
    let inView = true;
    let raf = 0;
    let disposed = false;
    let last = performance.now();

    const enterPhase = (phase: Phase) => {
      morphPlan = null;
      if (phase.type === 'intro') {
        const layout = layoutFor(PLATFORM);
        ensurePills(PLATFORM.modules.map((label) => ({ id: label, label })));
        setCenterLabel('Resolve', 0);
        stage.style.opacity = '0';
        PLATFORM.modules.forEach((label, i) => {
          const pos = layout.get(label)!;
          paintPill(domPills[i], pos.x, pos.y, 0, 0.96, label, 1);
        });
      } else if (phase.type === 'fade-in') {
        const layout = layoutFor(PLATFORM);
        ensurePills(PLATFORM.modules.map((label) => ({ id: label, label })));
        setCenterLabel('Resolve', 0);
        stage.style.opacity = '1';
        PLATFORM.modules.forEach((label, i) => {
          const pos = layout.get(label)!;
          paintPill(domPills[i], pos.x, pos.y, 0, 0.96, label, 1);
        });
      } else if (phase.type === 'hold') {
        showConfig(phase.config, 1);
        stage.style.opacity = '1';
      } else if (phase.type === 'morph') {
        morphPlan = buildMorphPlan(phase.from, phase.to);
        ensurePills(morphPlan.map((p) => ({ id: p.id, label: p.fromLabel })));
        setCenterLabel(phase.from.centerLabel, phase.from.centerLabel === 'Resolve' ? 0 : 1);
        stage.style.opacity = '1';
        morphPlan.forEach((p, i) => {
          paintPill(domPills[i], p.fromPos.x, p.fromPos.y, p.fadeIn ? 0 : 1, 1, p.fromLabel, 1);
        });
      } else if (phase.type === 'outro') {
        showConfig(OFFICE, 1);
        stage.style.opacity = '1';
      } else if (phase.type === 'pause') {
        stage.style.opacity = '0';
        setCenterLabel('Resolve', 0);
        clearPills();
      }
    };

    enterPhase(timeline[0].phase);

    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!inView) return;

      phaseT += dt;
      const current = timeline[phaseIndex];
      const u = Math.min(1, phaseT / current.duration);
      const e = easeInOutCubic(u);
      const phase = current.phase;

      if (phase.type === 'intro') {
        stage.style.opacity = String(e);
        const layout = layoutFor(PLATFORM);
        PLATFORM.modules.forEach((label, i) => {
          const pos = layout.get(label)!;
          paintPill(domPills[i], pos.x, pos.y, 0, 0.96, label, dt);
        });
        setCenterLabel('Resolve', 0);
      } else if (phase.type === 'fade-in') {
        stage.style.opacity = '1';
        const layout = layoutFor(PLATFORM);
        PLATFORM.modules.forEach((label, i) => {
          const pos = layout.get(label)!;
          const start = (i / PLATFORM.modules.length) * 0.42;
          const local = Math.min(1, Math.max(0, (u - start) / 0.58));
          const le = easeInOutCubic(local);
          paintPill(domPills[i], pos.x, pos.y, le, 0.96 + le * 0.04, label, dt);
        });
        setCenterLabel('Resolve', 0);
      } else if (phase.type === 'hold') {
        stage.style.opacity = '1';
        const layout = layoutFor(phase.config);
        phase.config.modules.forEach((label, i) => {
          if (!domPills[i]) return;
          const pos = layout.get(label)!;
          paintPill(domPills[i], pos.x, pos.y, 1, 1, label, dt);
        });
        setCenterLabel(
          phase.config.centerLabel,
          phase.config.centerLabel === 'Resolve' ? 0 : 1
        );
      } else if (phase.type === 'morph' && morphPlan) {
        stage.style.opacity = '1';
        if (u < 0.4) {
          if (phase.from.centerLabel === 'Resolve') {
            setCenterLabel('Resolve', 0);
          } else {
            setCenterLabel(phase.from.centerLabel, 1 - easeInOutCubic(u / 0.4));
          }
        } else {
          setCenterLabel(
            phase.to.centerLabel,
            easeInOutCubic(Math.min(1, (u - 0.4) / 0.45))
          );
        }

        morphPlan.forEach((p, i) => {
          if (!domPills[i]) return;
          const x = p.fromPos.x + (p.toPos.x - p.fromPos.x) * e;
          const y = p.fromPos.y + (p.toPos.y - p.fromPos.y) * e;
          let opacity = 1;
          let label = p.fromLabel;
          let scale = 1;

          if (p.fadeOut) {
            opacity = 1 - e;
            scale = 1 - e * 0.08;
          } else if (p.fadeIn) {
            opacity = e;
            label = p.toLabel;
            scale = 0.94 + e * 0.06;
          } else if (p.fromLabel !== p.toLabel) {
            if (u < 0.45) {
              label = p.fromLabel;
              opacity = 1 - easeInOutCubic((u - 0.28) / 0.17) * 0.55;
              if (u < 0.28) opacity = 1;
            } else {
              label = p.toLabel;
              opacity = easeInOutCubic(Math.min(1, (u - 0.45) / 0.2));
              opacity = Math.max(0.45, opacity);
            }
          }

          paintPill(domPills[i], x, y, opacity, scale, label, dt);
        });
      } else if (phase.type === 'outro') {
        stage.style.opacity = String(1 - e);
        setCenterLabel('Office', 1);
        const layout = layoutFor(OFFICE);
        OFFICE.modules.forEach((label, i) => {
          if (!domPills[i]) return;
          const pos = layout.get(label)!;
          paintPill(domPills[i], pos.x, pos.y, 1, 1, label, dt);
        });
      }

      if (phaseT >= current.duration) {
        phaseT = 0;
        phaseIndex = (phaseIndex + 1) % timeline.length;
        enterPhase(timeline[phaseIndex].phase);
      }
    };

    raf = requestAnimationFrame(frame);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
      },
      { threshold: 0.12 }
    );
    if (rootRef.current) observer.observe(rootRef.current);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      clearPills();
    };
  }, []);

  return (
    <div ref={rootRef} className="relative w-full max-w-4xl mx-auto">
      <div
        ref={stageRef}
        className="relative mx-auto w-full overflow-visible"
        style={{ height: 'min(420px, 62vw)', opacity: 0 }}
      >
        <svg ref={spokesRef} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden />

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-[4.75rem] w-[4.75rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-gray-500/35 bg-gray-950/70 shadow-[0_0_36px_rgba(148,163,184,0.1)] backdrop-blur-[2px]">
          <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500">Resolve</span>
          <span
            ref={centerLabelRef}
            className="mt-0.5 max-w-[4.25rem] text-center text-[11px] font-semibold leading-tight text-gray-100"
            style={{ opacity: 0 }}
          />
        </div>

        <div ref={pillsRef} className="absolute inset-0 z-10" />
      </div>
    </div>
  );
}
