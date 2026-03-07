'use client';

import { useState } from 'react';
import Link from 'next/link';

const WIZARD_STEPS = [
	{ id: 1, title: 'Choose template', desc: 'Load default asset fields for your industry' },
	{ id: 2, title: 'Import assets', desc: 'Upload CSV, Excel, or connect Google Sheet' },
	{ id: 3, title: 'Invite teammates', desc: 'Add users and assign roles (Admin, Manager, Employee)' },
	{ id: 4, title: 'Reporting & workflows', desc: 'Optional — configure later' },
	{ id: 5, title: 'Mobile app', desc: 'Suggest downloading the companion app' },
];

export default function OnboardingPage() {
	const [step, setStep] = useState(1);
	const [industryTemplate, setIndustryTemplate] = useState('');

	const next = () => setStep((s) => Math.min(s + 1, 5));
	const prev = () => setStep((s) => Math.max(s - 1, 1));

	return (
		<main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
			<div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-sm border border-gray-700 overflow-hidden">
				{/* Progress */}
				<div className="px-8 pt-8">
					<div className="flex gap-2 mb-2">
						{WIZARD_STEPS.map((s) => (
							<button
								key={s.id}
								type="button"
								onClick={() => setStep(s.id)}
								className={`flex-1 h-2 rounded-full transition-colors ${
									s.id <= step ? 'bg-gray-600' : 'bg-gray-700'
								} ${s.id === step ? 'ring-2 ring-gray-600 ring-offset-2 ring-offset-gray-800' : ''}`}
								aria-label={`Step ${s.id}`}
							/>
						))}
					</div>
					<p className="text-sm text-gray-400">
						Step {step} of {WIZARD_STEPS.length}
					</p>
				</div>

				<div className="p-8">
					<h1 className="text-xl font-bold mb-1 text-gray-100">
						{WIZARD_STEPS[step - 1].title}
					</h1>
					<p className="text-gray-400 mb-6">
						{WIZARD_STEPS[step - 1].desc}
					</p>

					{step === 1 && (
						<div>
							<p className="text-sm font-medium text-gray-300 mb-2">Industry template</p>
							<select
								value={industryTemplate}
								onChange={(e) => setIndustryTemplate(e.target.value)}
								className="w-full px-3 py-2.5 border border-gray-700 bg-gray-900 text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-600"
							>
								<option value="">Select (optional)</option>
								<option value="education">Education — Projectors, Laptops, Lab Equipment</option>
								<option value="it">IT — Desktops, Servers, Network</option>
								<option value="healthcare">Healthcare — Medical devices, Beds</option>
								<option value="construction">Construction — Equipment, Vehicles</option>
								<option value="other">Other — Custom fields later</option>
							</select>
							<p className="mt-2 text-sm text-gray-400">
								Picking Education will prefill asset categories like Projectors, Laptops, Lab Equipment.
							</p>
						</div>
					)}

					{step === 2 && (
						<div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center text-gray-400">
							<p className="mb-4">CSV / Excel import coming soon.</p>
							<p className="text-sm">You can add assets manually from the dashboard for now.</p>
						</div>
					)}

					{step === 3 && (
						<div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center text-gray-400">
							<p className="mb-4">Invite teammates from Dashboard → Settings (coming soon).</p>
							<p className="text-sm">You&apos;re the admin — you can add staff and technicians later.</p>
						</div>
					)}

					{step === 4 && (
						<div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center text-gray-400">
							<p>Reporting and workflows can be configured later from the dashboard.</p>
							<button type="button" onClick={next} className="mt-4 text-gray-300 font-medium hover:text-white no-underline">
								Skip for now →
							</button>
						</div>
					)}

					{step === 5 && (
						<div className="text-center">
							<p className="text-gray-400 mb-4">
								Get the companion app to scan QR codes and report issues from your phone.
							</p>
							<div className="inline-block px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 text-sm">
								App download links will appear here when the mobile app is ready.
							</div>
						</div>
					)}

					<div className="mt-8 flex justify-between">
						<button type="button" onClick={prev} disabled={step === 1}
							className="px-4 py-2 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
							Back
						</button>
						{step < 5 ? (
							<button type="button" onClick={next}
								className="px-6 py-2.5 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600">
								Next
							</button>
						) : (
							<Link href="/dashboard"
								className="px-6 py-2.5 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 inline-block no-underline">
								Go to dashboard
							</Link>
						)}
					</div>
				</div>
			</div>

			<Link href="/dashboard" className="mt-6 text-gray-500 text-sm hover:text-gray-300 no-underline">
				Skip wizard → Dashboard
			</Link>
		</main>
	);
}
