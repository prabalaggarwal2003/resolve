'use client';

import { useState } from 'react';
import Link from 'next/link';

const inputClass = 'w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent transition-all text-sm';

const STEPS = [
	{
		id: 1,
		badge: 'Step 1 of 5',
		title: 'Welcome to Resolve',
		desc: 'Your asset management platform is ready. Here\'s what to expect.',
	},
	{
		id: 2,
		badge: 'Step 2 of 5',
		title: 'Add your assets',
		desc: 'Start tracking your equipment from day one.',
	},
	{
		id: 3,
		badge: 'Step 3 of 5',
		title: 'Report issues via QR',
		desc: 'Anyone can report a problem — no login needed.',
	},
	{
		id: 4,
		badge: 'Step 4 of 5',
		title: 'Invite your team',
		desc: 'Assign the right roles to the right people.',
	},
	{
		id: 5,
		badge: 'Step 5 of 5',
		title: 'You\'re all set',
		desc: 'Everything is configured. Head to your dashboard.',
	},
];

export default function OnboardingPage() {
	const [step, setStep] = useState(1);
	const [industryTemplate, setIndustryTemplate] = useState('');

	const next = () => setStep((s) => Math.min(s + 1, 5));
	const prev = () => setStep((s) => Math.max(s - 1, 1));

	return (
		<main
			className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden"
			style={{ fontFamily: 'var(--font-manrope, Manrope, sans-serif)' }}
		>
			<div className="absolute top-[-180px] left-[-180px] w-[500px] h-[500px] rounded-full bg-gray-700/20 blur-[140px] pointer-events-none" />
			<div className="absolute bottom-[-160px] right-[-160px] w-[460px] h-[460px] rounded-full bg-gray-600/10 blur-[120px] pointer-events-none" />

			<div className="relative z-10 w-full max-w-xl mb-6">
				<Link href="/" className="text-sm text-gray-600 hover:text-gray-300 transition-colors no-underline">← resolve</Link>
			</div>

			{/* Glass card */}
			<div className="relative z-10 w-full max-w-xl rounded-3xl border border-gray-700/60 bg-gray-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">

				{/* Progress */}
				<div className="px-8 pt-8 pb-2">
					<div className="flex gap-2 mb-3">
						{STEPS.map((s) => (
							<div key={s.id} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
								s.id < step ? 'bg-green-500' : s.id === step ? 'bg-gray-300' : 'bg-gray-700/60'
							}`} />
						))}
					</div>
					<p className="text-xs text-gray-600 font-medium tracking-widest uppercase">{STEPS[step - 1].badge}</p>
				</div>

				<div className="px-8 pb-8 pt-4">
					{/* Header */}
					<div className="mb-6">
						<h1 className="text-2xl font-extrabold text-gray-100 tracking-tight mb-1">{STEPS[step - 1].title}</h1>
						<p className="text-gray-500 text-sm">{STEPS[step - 1].desc}</p>
					</div>

					{/* ── Step 1: Welcome ── */}
					{step === 1 && (
						<div className="space-y-3">
							{[
								{ icon: '📦', title: 'Track assets', desc: 'Add equipment with auto-generated IDs, QR codes, warranty dates and vendor info.' },
								{ icon: '🔔', title: 'Report issues', desc: 'Anyone can scan a QR code to report a problem — no login required.' },
								{ icon: '🔧', title: 'Manage maintenance', desc: 'Assets are auto-flagged when they exceed age or issue thresholds.' },
								{ icon: '📊', title: 'Analyse & audit', desc: 'KPIs, depreciation, audit logs and downloadable PDF reports — all built in.' },
							].map(({ icon, title, desc }) => (
								<div key={title} className="flex items-start gap-3 p-3 rounded-xl bg-gray-800/40 border border-gray-700/40">
									<span className="text-xl mt-0.5 shrink-0">{icon}</span>
									<div>
										<p className="text-sm font-semibold text-gray-200">{title}</p>
										<p className="text-xs text-gray-500 mt-0.5">{desc}</p>
									</div>
								</div>
							))}
						</div>
					)}

					{/* ── Step 2: Add assets ── */}
					{step === 2 && (
						<div className="space-y-3">
							<div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/40">
								<p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">How to add your first asset</p>
								{[
									{ n: '1', text: 'Go to Dashboard → Assets → Add New Asset' },
									{ n: '2', text: 'Fill in the name, category, purchase date and cost' },
									{ n: '3', text: 'A unique asset ID and QR code are auto-generated' },
									{ n: '4', text: 'Need to add 100 PCs? Use the Replicate feature to duplicate with incremented IDs' },
								].map(({ n, text }) => (
									<div key={n} className="flex items-start gap-3 mb-2 last:mb-0">
										<span className="w-5 h-5 rounded-full bg-gray-700 text-gray-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
										<p className="text-sm text-gray-300">{text}</p>
									</div>
								))}
							</div>
							<div className="p-3 rounded-xl bg-gray-800/40 border border-dashed border-gray-700/60 text-center">
								<p className="text-xs text-gray-600">CSV / Excel bulk import — coming soon</p>
							</div>
							<div className="mb-2">
								<label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Pick a category template <span className="normal-case text-gray-600">(optional)</span></label>
								<select value={industryTemplate} onChange={(e) => setIndustryTemplate(e.target.value)} className={inputClass}>
									<option value="">No template</option>
									<option value="education">Education — Projectors, Laptops, Lab Equipment, Furniture</option>
									<option value="it">IT — Desktops, Servers, Switches, UPS</option>
									<option value="healthcare">Healthcare — Medical devices, Beds, Monitors</option>
									<option value="construction">Construction — Equipment, Vehicles, Tools</option>
									<option value="other">Other — Start blank, add your own categories</option>
								</select>
								{industryTemplate && (
									<p className="text-xs text-green-500 mt-2">✓ Categories will be prefilled when you add assets.</p>
								)}
							</div>
						</div>
					)}

					{/* ── Step 3: QR & reporting ── */}
					{step === 3 && (
						<div className="space-y-3">
							<div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/40">
								<p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">How issue reporting works</p>
								{[
									{ icon: '🖨️', text: 'Print QR codes from Dashboard → Assets → Download QR PDF' },
									{ icon: '🔖', text: 'Stick the QR code on each physical asset' },
									{ icon: '📱', text: 'Anyone scans it with their phone — no app, no login needed' },
									{ icon: '✅', text: 'The issue is logged, admins are notified, and it\'s tracked until resolved' },
								].map(({ icon, text }) => (
									<div key={text} className="flex items-start gap-3 mb-2 last:mb-0">
										<span className="text-base shrink-0 mt-0.5">{icon}</span>
										<p className="text-sm text-gray-300">{text}</p>
									</div>
								))}
							</div>
							<div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/40">
								<p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Auto maintenance alerts</p>
								<p className="text-sm text-gray-400">Assets are automatically flagged for maintenance when they have <span className="text-gray-200 font-medium">5+ open issues</span> or are <span className="text-gray-200 font-medium">3+ years old</span>. You'll get notified instantly.</p>
							</div>
						</div>
					)}

					{/* ── Step 4: Team & roles ── */}
					{step === 4 && (
						<div className="space-y-3">
							<div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/40">
								<p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">User roles</p>
								{[
									{ role: 'Super Admin', desc: 'Full access — manage everything including org settings' },
									{ role: 'Admin', desc: 'Manage assets, users, issues and reports' },
									{ role: 'Manager', desc: 'View and manage assets, approve maintenance' },
									{ role: 'Reporter', desc: 'Report issues only — no dashboard access' },
								].map(({ role, desc }) => (
									<div key={role} className="flex items-start gap-3 mb-2 last:mb-0">
										<span className="px-2 py-0.5 rounded-md bg-gray-700/60 text-gray-300 text-xs font-bold shrink-0 mt-0.5">{role}</span>
										<p className="text-sm text-gray-400">{desc}</p>
									</div>
								))}
							</div>
							<div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700/40">
								<p className="text-xs text-gray-500">
									Add users from <span className="text-gray-300 font-medium">Dashboard → Users & Roles</span>. You can update roles any time.
								</p>
							</div>
						</div>
					)}

					{/* ── Step 5: All set ── */}
					{step === 5 && (
						<div className="space-y-3">
							<div className="p-4 rounded-xl bg-green-900/20 border border-green-800/40 text-center mb-2">
								<p className="text-3xl mb-2">🎉</p>
								<p className="text-green-400 font-bold text-sm">Organisation created · Admin account active</p>
							</div>
							{[
								{ icon: '📦', action: 'Add your first asset', path: 'Assets → Add New Asset' },
								{ icon: '👥', action: 'Invite your team', path: 'Users & Roles → Add User' },
								{ icon: '📍', action: 'Create locations', path: 'Locations → Add Location' },
								{ icon: '🖨️', action: 'Print QR codes', path: 'Assets → Download QR PDF' },
							].map(({ icon, action, path }) => (
								<div key={action} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/40 border border-gray-700/40">
									<span className="text-lg shrink-0">{icon}</span>
									<div>
										<p className="text-sm font-semibold text-gray-200">{action}</p>
										<p className="text-xs text-gray-600">{path}</p>
									</div>
								</div>
							))}
						</div>
					)}

					{/* Navigation */}
					<div className="mt-8 flex justify-between items-center">
						<button type="button" onClick={prev} disabled={step === 1}
							className="px-4 py-2 text-sm text-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium">
							← Back
						</button>
						{step < 5 ? (
							<button type="button" onClick={next}
								className="px-6 py-3 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all">
								Continue →
							</button>
						) : (
							<Link href="/dashboard"
								className="px-6 py-3 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all no-underline inline-block">
								Go to dashboard →
							</Link>
						)}
					</div>
				</div>
			</div>

			<Link href="/dashboard" className="relative z-10 mt-6 text-xs text-gray-700 hover:text-gray-400 transition-colors no-underline">
				Skip setup → Go to dashboard
			</Link>
		</main>
	);
}
