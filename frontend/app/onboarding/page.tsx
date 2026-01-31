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
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Progress */}
        <div className="px-8 pt-8">
          <div className="flex gap-2 mb-2">
            {WIZARD_STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  s.id <= step ? 'bg-primary' : 'bg-slate-200'
                } ${s.id === step ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                aria-label={`Step ${s.id}`}
              />
            ))}
          </div>
          <p className="text-sm text-slate-500">
            Step {step} of {WIZARD_STEPS.length}
          </p>
        </div>

        <div className="p-8">
          <h1 className="text-xl font-bold mb-1">
            {WIZARD_STEPS[step - 1].title}
          </h1>
          <p className="text-slate-600 mb-6">
            {WIZARD_STEPS[step - 1].desc}
          </p>

          {step === 1 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Industry template</p>
              <select
                value={industryTemplate}
                onChange={(e) => setIndustryTemplate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select (optional)</option>
                <option value="education">Education — Projectors, Laptops, Lab Equipment</option>
                <option value="it">IT — Desktops, Servers, Network</option>
                <option value="healthcare">Healthcare — Medical devices, Beds</option>
                <option value="construction">Construction — Equipment, Vehicles</option>
                <option value="other">Other — Custom fields later</option>
              </select>
              <p className="mt-2 text-sm text-slate-500">
                Picking Education will prefill asset categories like Projectors, Laptops, Lab Equipment.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-500">
              <p className="mb-4">CSV / Excel import coming soon.</p>
              <p className="text-sm">You can add assets manually from the dashboard for now.</p>
            </div>
          )}

          {step === 3 && (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-500">
              <p className="mb-4">Invite teammates from Dashboard → Settings (coming soon).</p>
              <p className="text-sm">You&apos;re the admin — you can add staff and technicians later.</p>
            </div>
          )}

          {step === 4 && (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center text-slate-500">
              <p>Reporting and workflows can be configured later from the dashboard.</p>
              <button
                type="button"
                onClick={next}
                className="mt-4 text-primary font-medium hover:underline"
              >
                Skip for now →
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="text-center">
              <p className="text-slate-600 mb-4">
                Get the companion app to scan QR codes and report issues from your phone.
              </p>
              <div className="inline-block px-4 py-3 bg-slate-100 rounded-lg text-slate-600 text-sm">
                App download links will appear here when the mobile app is ready.
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={prev}
              disabled={step === 1}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            {step < 5 ? (
              <button
                type="button"
                onClick={next}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover"
              >
                Next
              </button>
            ) : (
              <Link
                href="/dashboard"
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover inline-block"
              >
                Go to dashboard
              </Link>
            )}
          </div>
        </div>
      </div>

      <Link
        href="/dashboard"
        className="mt-6 text-slate-500 text-sm hover:text-slate-700"
      >
        Skip wizard → Dashboard
      </Link>
    </main>
  );
}
