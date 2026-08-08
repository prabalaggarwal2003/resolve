'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CONNECTED_SYSTEM_EDGES,
  CONNECTED_SYSTEM_NODES,
  type GraphNodeDef,
} from './connectedSystemGraphData';

const SCALE = 1.55;
const DEPTH = 0.35;

/** Seconds between each node/edge reveal step */
const STEP_SECONDS = 1.15;
/** Hold on the full graph before restarting */
const HOLD_SECONDS = 4.5;
/** Fade duration for each reveal */
const FADE_SECONDS = 0.85;

type RuntimeNode = {
  def: GraphNodeDef;
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  position: THREE.Vector3;
  labelEl: HTMLDivElement;
  /** Index in reveal sequence; 0 = Resolve */
  revealIndex: number;
};

type RuntimeEdge = {
  def: (typeof CONNECTED_SYSTEM_EDGES)[number];
  line: THREE.Line;
  positions: Float32Array;
  fromId: string;
  toId: string;
  revealIndex: number;
  particle?: THREE.Mesh;
  particleT: number;
  particleSpeed: number;
};

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobileWidth() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

function layoutPosition(def: GraphNodeDef, mobile: boolean) {
  const x = mobile && def.mobileX != null ? def.mobileX : def.x;
  const y = mobile && def.mobileY != null ? def.mobileY : def.y;
  const z = (Math.abs(x) + Math.abs(y)) * -DEPTH * 0.15;
  return new THREE.Vector3(x * SCALE, -y * SCALE, z);
}

/** Ordered reveal: hub first, then nodes by stage, edges when both ends exist */
function buildRevealOrder(mobile: boolean) {
  const nodes = CONNECTED_SYSTEM_NODES.filter((n) => (!mobile ? true : n.mobile === true));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const sorted = [...nodes].sort((a, b) => {
    if (a.hub) return -1;
    if (b.hub) return 1;
    if (a.stage !== b.stage) return a.stage - b.stage;
    return a.label.localeCompare(b.label);
  });

  const nodeIndex = new Map<string, number>();
  sorted.forEach((n, i) => nodeIndex.set(n.id, i));

  const edges = CONNECTED_SYSTEM_EDGES.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  const edgeIndex = new Map<string, number>();
  edges.forEach((e) => {
    // Reveal edge just after the later of its two nodes
    const idx = Math.max(nodeIndex.get(e.from) ?? 0, nodeIndex.get(e.to) ?? 0);
    edgeIndex.set(e.id, idx);
  });

  return { sorted, nodeIndex, edges, edgeIndex, stepCount: sorted.length };
}

function revealAmount(elapsed: number, index: number, reduced: boolean) {
  if (reduced) return 1;
  const start = index * STEP_SECONDS;
  if (elapsed < start) return 0;
  const t = (elapsed - start) / FADE_SECONDS;
  if (t >= 1) return 1;
  // ease-out
  return 1 - Math.pow(1 - t, 2);
}

export default function ConnectedSystemGraph() {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    const labelsRoot = labelsRef.current;
    const tooltipEl = tooltipRef.current;
    if (!mount || !labelsRoot || !tooltipEl) return;

    const reduced = prefersReducedMotion();
    let mobile = isMobileWidth();
    let inView = false;

    const width = mount.clientWidth;
    const height = Math.max(380, Math.min(520, window.innerHeight * 0.58));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.12, 7.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const dustCount = mobile || reduced ? 0 : 36;
    let dust: THREE.Points | null = null;
    if (dustCount) {
      const dustPos = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 8;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 5;
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * 3 - 1;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
      dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
          color: 0x64748b,
          size: 0.025,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        })
      );
      scene.add(dust);
    }

    const runtimeNodes: RuntimeNode[] = [];
    const nodeById = new Map<string, RuntimeNode>();
    const runtimeEdges: RuntimeEdge[] = [];
    const pulseBoost = new Map<string, number>();
    let stepCount = 1;

    const clearGraph = () => {
      runtimeNodes.forEach((n) => {
        root.remove(n.mesh);
        root.remove(n.glow);
        n.labelEl.remove();
        n.mesh.geometry.dispose();
        (n.mesh.material as THREE.Material).dispose();
        n.glow.geometry.dispose();
        (n.glow.material as THREE.Material).dispose();
      });
      runtimeNodes.length = 0;
      nodeById.clear();
      labelsRoot.innerHTML = '';

      runtimeEdges.forEach((e) => {
        root.remove(e.line);
        e.line.geometry.dispose();
        (e.line.material as THREE.Material).dispose();
        if (e.particle) {
          root.remove(e.particle);
          e.particle.geometry.dispose();
          (e.particle.material as THREE.Material).dispose();
        }
      });
      runtimeEdges.length = 0;
    };

    const rebuild = () => {
      clearGraph();
      const order = buildRevealOrder(mobile);
      stepCount = order.stepCount;

      order.sorted.forEach((def) => {
        const pos = layoutPosition(def, mobile);
        const radius = def.hub ? 0.14 : 0.075;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 24, 24),
          new THREE.MeshBasicMaterial({
            color: def.hub ? 0xe2e8f0 : 0x94a3b8,
            transparent: true,
            opacity: 0,
          })
        );
        mesh.position.copy(pos);
        mesh.userData.nodeId = def.id;
        root.add(mesh);

        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 2.1, 16, 16),
          new THREE.MeshBasicMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          })
        );
        glow.position.copy(pos);
        root.add(glow);

        const labelEl = document.createElement('div');
        labelEl.className =
          'absolute left-0 top-0 pointer-events-none select-none whitespace-nowrap text-[11px] sm:text-xs font-semibold tracking-wide text-gray-300/90';
        labelEl.textContent = def.label;
        labelEl.style.opacity = '0';
        labelsRoot.appendChild(labelEl);

        const rn: RuntimeNode = {
          def,
          mesh,
          glow,
          position: pos.clone(),
          labelEl,
          revealIndex: order.nodeIndex.get(def.id) ?? 0,
        };
        runtimeNodes.push(rn);
        nodeById.set(def.id, rn);
      });

      order.edges.forEach((def) => {
        const a = nodeById.get(def.from);
        const b = nodeById.get(def.to);
        if (!a || !b) return;

        const positions = new Float32Array([
          a.position.x,
          a.position.y,
          a.position.z,
          b.position.x,
          b.position.y,
          b.position.z,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0 })
        );
        root.add(line);

        let particle: THREE.Mesh | undefined;
        if (def.particle && !reduced && !mobile) {
          particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0 })
          );
          root.add(particle);
        }

        runtimeEdges.push({
          def,
          line,
          positions,
          fromId: def.from,
          toId: def.to,
          revealIndex: order.edgeIndex.get(def.id) ?? 0,
          particle,
          particleT: Math.random(),
          particleSpeed: 0.08 + Math.random() * 0.06,
        });
      });
    };

    rebuild();

    let hoverId: string | null = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-10, -10);
    const tmp = new THREE.Vector3();
    let w = width;
    let h = height;
    let raf = 0;
    let disposed = false;
    let elapsed = reduced ? 999 : 0;
    let lastTs = performance.now();

    const cycleDuration = () => stepCount * STEP_SECONDS + HOLD_SECONDS;

    const projectLabel = (rn: RuntimeNode, opacity: number) => {
      tmp.copy(rn.mesh.position);
      root.localToWorld(tmp);
      tmp.project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * w;
      const sy = (-tmp.y * 0.5 + 0.5) * h;
      const yOff = rn.def.hub ? 28 : 22;
      rn.labelEl.style.transform = `translate(${sx}px, ${sy - yOff}px) translate(-50%, -50%)`;
      rn.labelEl.style.opacity = String(opacity);
    };

    const relatedIds = (id: string | null) => {
      const set = new Set<string>();
      if (!id) return set;
      set.add(id);
      runtimeEdges.forEach((e) => {
        if (e.fromId === id || e.toId === id) {
          set.add(e.fromId);
          set.add(e.toId);
        }
      });
      return set;
    };

    const animate = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      if (reduced) {
        elapsed = 999;
      } else if (inView) {
        elapsed += dt;
        const cycle = cycleDuration();
        if (elapsed > cycle) elapsed = 0;
      }

      const related = relatedIds(hoverId);
      const hovering = Boolean(hoverId);

      // Gentle idle drift (not a spin)
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, Math.sin(now * 0.00015) * 0.04, 0.04);
      root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, Math.sin(now * 0.00012) * 0.02, 0.04);

      runtimeNodes.forEach((rn) => {
        const reveal = revealAmount(elapsed, rn.revealIndex, reduced);
        const isRel = !hovering || related.has(rn.def.id);
        const dim = hovering && !isRel ? 0.22 : 1;
        const boost = pulseBoost.get(rn.def.id) || 0;
        const mat = rn.mesh.material as THREE.MeshBasicMaterial;
        const gmat = rn.glow.material as THREE.MeshBasicMaterial;
        const targetOp = reveal * dim * (rn.def.hub ? 0.95 : 0.85);
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOp, 0.14);
        gmat.opacity = THREE.MathUtils.lerp(
          gmat.opacity,
          reveal * dim * (0.08 + boost * 0.2 + (hoverId === rn.def.id ? 0.12 : 0)),
          0.14
        );
        const scale = Math.max(0.001, reveal * (hoverId === rn.def.id ? 1.22 : 1) * (1 + boost * 0.15));
        rn.mesh.scale.setScalar(THREE.MathUtils.lerp(rn.mesh.scale.x || 0.001, scale, 0.16));
        rn.glow.scale.setScalar(THREE.MathUtils.lerp(rn.glow.scale.x || 0.001, scale, 0.16));
        projectLabel(rn, mat.opacity * 0.98);
        if (boost > 0) pulseBoost.set(rn.def.id, Math.max(0, boost - 0.04));
      });

      runtimeEdges.forEach((edge) => {
        const reveal = revealAmount(elapsed, edge.revealIndex, reduced);
        const isRel = !hovering || related.has(edge.fromId) || related.has(edge.toId);
        const dim = hovering && !isRel ? 0.12 : 1;
        const mat = edge.line.material as THREE.LineBasicMaterial;
        const from = nodeById.get(edge.fromId)?.mesh.position;
        const to = nodeById.get(edge.toId)?.mesh.position;

        if (from && to) {
          edge.positions[0] = from.x;
          edge.positions[1] = from.y;
          edge.positions[2] = from.z;
          edge.positions[3] = THREE.MathUtils.lerp(from.x, to.x, reveal);
          edge.positions[4] = THREE.MathUtils.lerp(from.y, to.y, reveal);
          edge.positions[5] = THREE.MathUtils.lerp(from.z, to.z, reveal);
          const attr = edge.line.geometry.getAttribute('position') as THREE.BufferAttribute;
          (attr.array as Float32Array).set(edge.positions);
          attr.needsUpdate = true;
        }

        mat.opacity = THREE.MathUtils.lerp(
          mat.opacity,
          reveal * dim * (isRel && hovering ? 0.72 : 0.38),
          0.14
        );

        if (edge.particle && reveal > 0.9 && !reduced) {
          edge.particleT = (edge.particleT + edge.particleSpeed * dt) % 1;
          const t = edge.particleT;
          if (from && to) {
            edge.particle.position.set(
              THREE.MathUtils.lerp(from.x, to.x, t),
              THREE.MathUtils.lerp(from.y, to.y, t),
              THREE.MathUtils.lerp(from.z, to.z, t)
            );
            (edge.particle.material as THREE.MeshBasicMaterial).opacity = 0.35 * dim;
            if (t > 0.96) pulseBoost.set(edge.toId, 1);
          }
        } else if (edge.particle) {
          (edge.particle.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      });

      if (dust) dust.rotation.y += 0.0006;

      if (hoverId) {
        const rn = nodeById.get(hoverId);
        if (rn) {
          tmp.copy(rn.mesh.position);
          root.localToWorld(tmp);
          tmp.project(camera);
          const sx = (tmp.x * 0.5 + 0.5) * w;
          const sy = (-tmp.y * 0.5 + 0.5) * h;
          tooltipEl.style.opacity = '1';
          tooltipEl.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -120%)`;
          const title = tooltipEl.querySelector('[data-tip-title]') as HTMLElement | null;
          const sub = tooltipEl.querySelector('[data-tip-sub]') as HTMLElement | null;
          if (title && title.textContent !== rn.def.tooltip.title) title.textContent = rn.def.tooltip.title;
          if (sub && sub.textContent !== rn.def.tooltip.subtitle) sub.textContent = rn.def.tooltip.subtitle;
        }
      } else {
        tooltipEl.style.opacity = '0';
      }

      renderer.render(scene, camera);
    };

    raf = requestAnimationFrame(animate);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (entry.isIntersecting && !reduced && elapsed === 0) {
          lastTs = performance.now();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(mount);

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        runtimeNodes.map((n) => n.mesh),
        false
      );
      hoverId = (hits[0]?.object.userData.nodeId as string | undefined) || null;
      renderer.domElement.style.cursor = hoverId ? 'pointer' : 'default';
    };

    const onPointerLeave = () => {
      hoverId = null;
      renderer.domElement.style.cursor = 'default';
    };

    const onResize = () => {
      const nextMobile = isMobileWidth();
      w = mount.clientWidth;
      h = Math.max(380, Math.min(520, window.innerHeight * 0.58));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (nextMobile !== mobile) {
        mobile = nextMobile;
        rebuild();
      } else {
        runtimeNodes.forEach((rn) => {
          const pos = layoutPosition(rn.def, mobile);
          rn.position.copy(pos);
          rn.mesh.position.copy(pos);
          rn.glow.position.copy(pos);
        });
        runtimeEdges.forEach((e) => {
          root.remove(e.line);
          e.line.geometry.dispose();
          (e.line.material as THREE.Material).dispose();
          if (e.particle) {
            root.remove(e.particle);
            e.particle.geometry.dispose();
            (e.particle.material as THREE.Material).dispose();
          }
        });
        runtimeEdges.length = 0;
        const order = buildRevealOrder(mobile);
        order.edges.forEach((def) => {
          const a = nodeById.get(def.from);
          const b = nodeById.get(def.to);
          if (!a || !b) return;
          const positions = new Float32Array([
            a.position.x,
            a.position.y,
            a.position.z,
            b.position.x,
            b.position.y,
            b.position.z,
          ]);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          const line = new THREE.Line(
            geo,
            new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0 })
          );
          root.add(line);
          let particle: THREE.Mesh | undefined;
          if (def.particle && !reduced && !mobile) {
            particle = new THREE.Mesh(
              new THREE.SphereGeometry(0.035, 12, 12),
              new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0 })
            );
            root.add(particle);
          }
          runtimeEdges.push({
            def,
            line,
            positions,
            fromId: def.from,
            toId: def.to,
            revealIndex: order.edgeIndex.get(def.id) ?? 0,
            particle,
            particleT: Math.random(),
            particleSpeed: 0.08 + Math.random() * 0.06,
          });
        });
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      clearGraph();
      if (dust) {
        dust.geometry.dispose();
        (dust.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full max-w-5xl mx-auto my-8">
      <div
        ref={mountRef}
        className="relative w-full overflow-hidden"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(148 163 184) 1px, transparent 0)',
            backgroundSize: '28px 28px',
            maskImage:
              'radial-gradient(ellipse 75% 70% at 50% 50%, black 35%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 75% 70% at 50% 50%, black 35%, transparent 100%)',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.06),transparent_60%)] pointer-events-none" />
        {/* Soft edge fade into section background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            background:
              'radial-gradient(ellipse 80% 75% at 50% 48%, transparent 40%, rgb(3 7 18 / 0.55) 72%, rgb(3 7 18) 100%)',
          }}
        />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 w-[210px] rounded-xl border border-gray-600/50 bg-gray-950/95 px-3.5 py-2.5 shadow-xl backdrop-blur-md transition-opacity duration-150"
          style={{ opacity: 0, left: 0, top: 0 }}
        >
          <p data-tip-title className="text-sm font-semibold text-gray-100 leading-snug" />
          <p data-tip-sub className="text-xs text-gray-500 mt-0.5" />
        </div>
      </div>
    </div>
  );
}
