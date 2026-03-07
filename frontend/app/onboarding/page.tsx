'use client';

import { useState } from 'react';
import Link from 'next/link';

const WIZARD_STEPS = [
	{ id: 1, title: 'Choose template', desc: 'Load default asset categories for your industry' },
	{ id: 2, title: 'Import assets', desc: 'Upload CSV, Excel, or add manually' },
	{ id: 3, title: 'Invite teammates', desc: 'Add users and assign roles' },
	{ id: 4, title: 'Reporting & workflows', desc: 'Configure reports and alerts' },
	{ id: 5, title: 'Mobile app', desc: 'Scan QR codes on the go' },
];

const inputClass = 'w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/60 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent transition-all text-sm';

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
			{/* Ambient blobs */}
			<div className="absolute top-[-180px] left-[-180px] w-[500px] h-[500px] rounded-full bg-gray-700/20 blur-[140px] pointer-events-none" />
			<div className="absolute bottom-[-160px] right-[-160px] w-[460px] h-[460px] rounded-full bg-gray-600/10 blur-[120px] pointer-events-none" />

			{/* Back link */}
			<div className="relative z-10 w-full max-w-xl mb-6">
				<Link href="/" className="text-sm text-gray-600 hover:text-gray-300 transition-colors no-underline">← resolve</Link>
			</div>

			{/* Glass card */}
			<div className="relative z-10 w-full max-w-xl rounded-3xl border border-gray-700/60 bg-gray-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">

				{/* Progress bar */}
				<div className="px-8 pt-8 pb-2">
					<div className="flex gap-2 mb-3">
						{WIZARD_STEPS.map((s) => (
							<button
								key={s.id}
								type="button"
								onClick={() => setStep(s.id)}
								className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
									s.id < step ? 'bg-green-500' : s.id === step ? 'bg-gray-300' : 'bg-gray-700/60'
								}`}
								aria-label={`Step ${s.id}`}
							/>
						))}
					</div>
					<p className="text-xs text-gray-600 font-medium tracking-widest uppercase">
						Step {step} of {WIZARD_STEPS.length}
					</p>
				</div>

				<div className="px-8 pb-8 pt-4">
					{/* Header */}
					<div className="mb-6">
						<span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800/70 border border-gray-700/60 text-xs font-semibold text-gray-400 tracking-widest uppercase mb-3">
							{WIZARD_STEPS[step - 1].title}
						</span>
						<h1 className="text-2xl font-extrabold text-gray-100 tracking-tight">
							{WIZARD_STEPS[step - 1].title}
						</h1>
						<p className="text-gray-500 text-sm mt-1">{WIZARD_STEPS[step - 1].desc}</p>
					</div>

					{/* Step content */}
					{step === 1 && (
						<div className="space-y-3">
							<label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Industry template</label>
							<select
								value={industryTemplate}
								onChange={(e) => setIndustryTemplate(e.target.value)}
								className={inputClass}
							>
								<option value="">Select (optional)</option>
								<option value="education">Education — Projectors, Laptops, Lab Equipment</option>
								<option value="it">IT — Desktops, Servers, Network</option>
								<option value="healthcare">Healthcare — Medical devices, Beds</option>
								<option value="construction">Construction — Equipment, Vehicles</option>
								<option value="other">Other — Custom fields later</option>
							</select>
							{industryTemplate && (
								<p className="text-xs text-gray-500 mt-2">
									✓ Template selected — asset categories will be prefilled in your dashboard.
								</p>
							)}
						</div>
					)}

					{step === 2 && (
						<div className="rounded-2xl border border-dashed border-gray-700/60 bg-gray-800/30 p-8 text-center">
							<p className="text-3xl mb-3">📂</p>
							<p className="text-gray-300 font-semibold mb-1">CSV / Excel import coming soon</p>
							<p className="text-sm text-gray-500">Add assets manually from the dashboard for now — it only takes a minute.</p>
						</div>
					)}

					{step === 3 && (
						<div className="rounded-2xl border border-dashed border-gray-700/60 bg-gray-800/30 p-8 text-center">
							<p className="text-3xl mb-3">👥</p>
							<p className="text-gray-300 font-semibold mb-1">Invite teammates</p>
							<p className="text-sm text-gray-500">Go to Dashboard → Roles to add staff, managers, and technicians with the right permissions.</p>
						</div>
					)}

					{step === 4 && (
						<div className="rounded-2xl border border-dashed border-gray-700/60 bg-gray-800/30 p-8 text-center">
							<p className="text-3xl mb-3">📊</p>
							<p className="text-gray-300 font-semibold mb-1">Reporting & workflows</p>
							<p className="text-sm text-gray-500">Daily, weekly and monthly reports are auto-generated. Configure alerts and thresholds from the Reports tab.</p>
						</div>
					)}

					{step === 5 && (
						<div className="rounded-2xl border border-dashed border-gray-700/60 bg-gray-800/30 p-8 text-center">
							<p className="text-3xl mb-3">📱</p>
							<p className="text-gray-300 font-semibold mb-1">Mobile app</p>
							<p className="text-sm text-gray-500">Scan QR codes and report issues from your phone. App download links will appear here when the mobile app is ready.</p>
						</div>
					)}

					{/* Navigation */}
					<div className="mt-8 flex justify-between items-center">
						<button
							type="button"
							onClick={prev}
							disabled={step === 1}
							className="px-4 py-2 text-sm text-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
						>
							← Back
						</button>
						{step < 5 ? (
							<button
								type="button"
								onClick={next}
								className="px-6 py-3 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all"
							>
								Continue →
							</button>
						) : (
							<Link
								href="/dashboard"
								className="px-6 py-3 bg-gray-100 text-gray-950 rounded-xl font-bold text-sm hover:bg-white transition-all no-underline inline-block"
							>
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
