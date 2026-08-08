'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ConnectedScanDemo from './ConnectedScanDemo';
import ConnectedSystemGraph from './ConnectedSystemGraph';
import OrgConfigViz from './OrgConfigViz';
import { ImportFlow, ReportFlow } from './FlowSteps';
import { Reveal, SectionLabel } from './Reveal';

const MODULE_STRIP = [
  { name: 'Assets', soon: false },
  { name: 'Partners', soon: false },
  { name: 'Procurement', soon: false },
  { name: 'Maintenance', soon: false },
  { name: 'Issues', soon: true },
] as const;

const MODULES = [
  {
    key: 'assets',
    title: 'Asset Management',
    blurb: 'Know what you own, where it lives, who’s using it and what’s happened to it.',
    points: [
      'Full inventory & history',
      'QR identification',
      'Custom fields & templates',
      'Locations & hierarchy',
      'Assignment & movement',
      'Depreciation',
    ],
    soon: false,
  },
  {
    key: 'partners',
    title: 'Business Partners',
    blurb: 'One place for every organization you buy from, work with or rely on.',
    points: [
      'Vendors & contacts',
      'Contracts & invoices',
      'Procurement history',
      'Linked assets',
      'Documents',
      'Partner relationships',
    ],
    soon: false,
  },
  {
    key: 'issues',
    title: 'Issue Management',
    blurb: 'From the first report to the final fix — capture, assign and close the loop.',
    points: [
      'QR-based reporting',
      'Assignment & workflow',
      'Priorities & SLAs',
      'Comments & files',
      'Resolution history',
    ],
    soon: true,
  },
  {
    key: 'reports',
    title: 'Reports & Insights',
    blurb: 'Ask your data the questions your organization actually needs answered.',
    points: [
      'Custom report builder',
      'Cross-module views',
      'Charts & dashboards',
      'PDF, Excel, CSV',
      'Scheduled delivery',
    ],
    soon: false,
  },
] as const;

const SCATTER = [
  'Spreadsheets',
  'WhatsApp chats',
  'Loose invoices',
  'Shared drives',
  'Verbal updates',
  'Lost folders',
];

const ROLES = [
  { title: 'Admin', desc: 'Full control across the organization.' },
  { title: 'Manager', desc: 'Assets, partners, issues and team activity.' },
  { title: 'Technician', desc: 'Assigned work, maintenance and open issues.' },
  { title: 'Reporter', desc: 'Scan → see what’s allowed → raise an issue.' },
  { title: 'Auditor', desc: 'Scan → verify → record the result.' },
];

const SECURITY = [
  'Role-based permissions',
  'Activity logs',
  'Audit trails',
  'Org-level data isolation',
  'Configurable QR visibility',
];

function QrPanel() {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPulse((p) => p + 1), 2200);
    return () => window.clearInterval(id);
  }, []);

  const cells = [
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

  const phase = pulse % 3;
  const captions = [
    'Projector · Floor 2',
    'Open details',
    'Report a problem',
  ];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-gray-700/50 bg-gray-900/70 p-6 backdrop-blur-md">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0 rounded-xl bg-white p-3 shadow-lg">
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: 'repeat(13, 8px)' }}
            >
              {cells.map((on, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-[1px] ${on ? 'bg-gray-950' : 'bg-transparent'}`}
                />
              ))}
            </div>
            <div
              className="pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-emerald-400/80"
              style={{
                top: `${18 + (pulse % 10) * 6}%`,
                transition: 'top 0.9s ease',
                boxShadow: '0 0 12px rgba(52, 211, 153, 0.7)',
              }}
            />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">
              Live scan
            </p>
            <p
              key={phase}
              className="text-lg font-bold text-gray-100"
              style={{ animation: 'landingFade 0.5s ease' }}
            >
              {captions[phase]}
            </p>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Permission-aware info — then act without hunting for forms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingBody() {
  return (
    <>
      {/* 1. Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-36 pb-20">
        <Reveal>
          <h1 className="text-xl sm:text-6xl lg:text-4xl font-extrabold text-gray-100 tracking-tight leading-[1.08] mb-6 max-w-4xl mt-2">
            Manage assets, partners &amp; operations
            <span className="block text-gray-500 mt-1">— all in one place.</span>
          </h1>
        </Reveal>
        <Reveal delay={80}>
          <p className="text-gray-500 text-base sm:text-lg leading-relaxed max-w-3xl mb-10">
            Track what you own, who you work with, where everything is and what needs attention.
            Resolve connects day-to-day operations so your organization runs from one system.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-14">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-4 bg-gray-100 text-gray-950 rounded-xl font-bold text-base hover:bg-white transition-all shadow-xl no-underline"
            >
              Get started free
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center px-8 py-4 bg-gray-800/60 border border-gray-700/60 text-gray-300 rounded-xl font-semibold text-base hover:bg-gray-700/60 transition-all backdrop-blur-sm no-underline"
            >
              See how it works
            </a>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className="w-full max-w-3xl mx-auto mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-4">
              One connected system
            </p>
            <div className="rounded-2xl border border-gray-700/50 bg-gray-900/40 backdrop-blur-sm px-3 py-3 sm:px-5 sm:py-4">
              <div className="flex flex-wrap items-center justify-center gap-y-2">
                {MODULE_STRIP.map((m, i) => (
                  <div key={m.name} className="flex items-center">
                    {i > 0 && (
                      <span
                        aria-hidden
                        className="mx-1.5 sm:mx-2 h-px w-3 sm:w-5 bg-gradient-to-r from-gray-600 to-gray-500 shrink-0"
                      />
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${
                        m.soon
                          ? 'border-amber-500/30 bg-amber-500/5 text-gray-300'
                          : 'border-gray-700/70 bg-gray-950/50 text-gray-200'
                      }`}
                    >
                      {m.name}
                      {m.soon && (
                        <span className="text-[8px] uppercase tracking-wider text-amber-400/90 font-semibold mt-1">
                          Soon
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 2. Problem */}
      <section className="relative z-10 w-full py-24 px-6 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12 -mt-4">
            <SectionLabel>The problem</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-100 tracking-tight mt-2">
              Your information shouldn’t live everywhere.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            <Reveal>
              <div className="rounded-2xl border border-rose-500/20 bg-gray-900/40 p-6 h-full">
                <p className="text-[11px] uppercase tracking-[0.2em] text-rose-300/70 mb-5">
                  Before
                </p>
                <div className="relative h-56 overflow-hidden">
                  {SCATTER.map((label, i) => {
                    const rot = (i % 2 === 0 ? -1 : 1) * (4 + i);
                    return (
                      <span
                        key={label}
                        className="absolute text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-gray-700/60 bg-gray-800/70 text-gray-400 whitespace-nowrap"
                        style={{
                          left: `${8 + (i % 3) * 28 + (i % 2) * 6}%`,
                          top: `${10 + Math.floor(i / 3) * 36 + (i % 3) * 8}%`,
                          animation: `landingFloat ${3.5 + i * 0.3}s ease-in-out infinite`,
                          animationDelay: `${i * 0.15}s`,
                          ['--scatter-rot' as string]: `${rot}deg`,
                        }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="rounded-2xl border border-emerald-500/25 bg-gray-900/40 p-6 h-full flex flex-col">
                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/70 mb-5">
                  With Resolve
                </p>
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 blur-2xl bg-emerald-500/10 rounded-full scale-150" />
                    <div className="relative w-20 h-20 rounded-2xl border border-emerald-500/30 bg-gray-950 flex items-center justify-center">
                      <span className="text-gray-100 font-extrabold tracking-tight text-lg">R</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-gray-100 mb-2">One connected system</p>
                  <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                  Bring scattered operational information together and turn it into one clear picture.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3. Modules */}
      <section id="modules" className="relative z-10 w-full py-24 px-6 bg-gray-900/40 border-y border-gray-800/60">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-14">
            <SectionLabel>Modules</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-100 tracking-tight mt-2">
              What resolve brings together
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Separate tools become connected modules — so work doesn’t restart every time you switch context.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {MODULES.map((mod, i) => (
              <Reveal key={mod.key} delay={i * 60}>
                <div
                  className={`h-full rounded-2xl border p-6 backdrop-blur-sm transition-colors ${
                    mod.soon
                      ? 'border-amber-500/25 bg-gray-900/50'
                      : 'border-gray-700/50 bg-gray-900/60 hover:border-gray-600/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg font-bold text-gray-100">{mod.title}</h3>
                    {mod.soon && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-300 px-2 py-1 rounded-md border border-amber-500/30 bg-amber-500/10">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-5">{mod.blurb}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mod.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-500 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 4. QR USP */}
      <section className="relative z-10 w-full py-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <SectionLabel>QR everywhere</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-100 tracking-tight mt-2 mb-4">
              Scan. Know. Act.
            </h2>
            <p className="text-gray-500 text-base leading-relaxed mb-4 max-w-md">
              Put a code on every asset. Anyone who scans sees only what they’re allowed to —
              details, history and soon a direct path to report a problem.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed max-w-md">
              When Issue Management launches, that same scan becomes the start of assignment,
              notification, and resolution — without redesigning how people find the asset.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <QrPanel />
          </Reveal>
        </div>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <ConnectedScanDemo />
          </Reveal>
        </div>
      </section>

      {/* 5. Built for your org */}
      <section className="relative z-10 w-full py-16 px-6 bg-gray-900/40 border-y border-gray-800/60 overflow-hidden">
        {/* Subtle ambient motion */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-gray-500/[0.06] blur-3xl"
            style={{ animation: 'orgAmbientDrift 22s ease-in-out infinite' }}
          />
          <div
            className="absolute bottom-[-5rem] right-[12%] h-80 w-80 rounded-full bg-slate-400/[0.05] blur-3xl"
            style={{ animation: 'orgAmbientDrift 28s ease-in-out infinite reverse' }}
          />
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgb(148 163 184) 1px, transparent 0)',
              backgroundSize: '32px 32px',
              animation: 'orgAmbientGrid 40s linear infinite',
            }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <SectionLabel>Your rules</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-100 tracking-tight mt-2 mb-3">
              Built around how your organization works
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              One platform. Different organizations. Wire the pieces you need — data, process and access — around how you already operate.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <OrgConfigViz />
          </Reveal>

          <Reveal delay={140}>
            <p className="text-center text-md text-gray-500 mt-10">
              Your platform. Your rules.
            </p>
            <p className="text-center text-lg text-gray-500 mt-2 -mb-4">
              EVERYTHING is CUSTOMIZABLE.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 6. Connected system */}
      <section id="how-it-connects" className="relative z-10 w-full pt-24 px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-6">
            <SectionLabel>Connected by design</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-100 tracking-tight mt-2">
              See the complete picture, not isolated data
            </h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto">
              Assets, partners, maintenance, issues and records share one operational graph.
            </p>
          </Reveal>
        </div>

        <ConnectedSystemGraph />
      </section>

      {/* 7. Roles */}
      <section className="relative z-10 w-full py-24 px-6 bg-gray-900/40 border-y border-gray-800/60">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <SectionLabel>Access</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-100 tracking-tight mt-2">
              Everyone sees what they need
            </h2>
            <p className="text-gray-500 mt-3 max-w-md mx-auto">
              Permissions decide the view — from full org control to a single scan-and-report flow.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {ROLES.map((role, i) => (
              <Reveal key={role.title} delay={i * 50}>
                <div className="h-full rounded-xl border border-gray-700/50 bg-gray-950/40 p-4 text-left hover:border-gray-500/50 transition-colors">
                  <p className="text-sm font-bold text-gray-100 mb-1.5">{role.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{role.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Report Studio */}
      <section className="relative z-10 w-full py-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <SectionLabel>Report Studio</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-100 tracking-tight mt-2 mb-4">
              Ask your data any question
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6 max-w-md">
              Skip the fixed template. Choose the module, shape the fields, filter hard, then export
              or schedule — in the format your team already uses.
            </p>
            <div className="flex flex-wrap gap-2">
              {['PDF', 'Excel', 'CSV', 'DOCX', 'Scheduled'].map((f) => (
                <span
                  key={f}
                  className="text-xs font-semibold tracking-wide text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700/60 bg-gray-900/60"
                >
                  {f}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <ReportFlow />
          </Reveal>
        </div>
      </section>

      {/* 9. Import */}
      <section className="relative z-10 w-full py-24 px-6 bg-gray-900/40 border-y border-gray-800/60">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal className="order-2 lg:order-1">
            <ImportFlow />
          </Reveal>
          <Reveal className="order-1 lg:order-2" delay={80}>
            <SectionLabel>Bring your data</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-100 tracking-tight mt-2 mb-4">
              Already in Excel? Keep going.
            </h2>
            <p className="text-gray-500 leading-relaxed max-w-md">
              Upload your inventory, map columns to Resolve, validate, preview, then import.
              No need to retype what you’ve already built.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 10. Security */}
      <section className="relative z-10 w-full py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <SectionLabel>Control</SectionLabel>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-100 tracking-tight mt-2 mb-8">
              Security that stays out of the way
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <div className="flex flex-wrap justify-center gap-2.5">
              {SECURITY.map((item) => (
                <span
                  key={item}
                  className="text-sm text-gray-400 px-3.5 py-2 rounded-lg border border-gray-800 bg-gray-900/50"
                >
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 11. Final CTA */}
      <section className="relative z-10 w-full py-24 px-6 bg-gray-900/40 border-t border-gray-800/60">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-100 tracking-tight mb-4">
            Bring your entire organization into one place
            </h2>
            <p className="text-gray-500 text-base sm:text-lg mb-8 max-w-xl mx-auto leading-relaxed">
              Start organizing assets, partners and day-to-day work with Resolve.
              No complicated setup.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-4 bg-gray-100 text-gray-950 rounded-xl font-bold text-base hover:bg-white transition-all shadow-xl no-underline"
            >
              Get started free
            </Link>
          </div>
        </Reveal>
      </section>

      <style jsx global>{`
        @keyframes landingFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landingFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landingFloat {
          0%, 100% { transform: translateY(0) rotate(var(--scatter-rot, 0deg)); }
          50% { transform: translateY(-6px) rotate(var(--scatter-rot, 0deg)); }
        }
        @keyframes orgAmbientDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(28px, -18px, 0) scale(1.06); }
        }
        @keyframes orgAmbientGrid {
          0% { background-position: 0 0; }
          100% { background-position: 32px 32px; }
        }
      `}</style>
    </>
  );
}
