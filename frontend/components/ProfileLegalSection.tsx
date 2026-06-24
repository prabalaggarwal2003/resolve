'use client';

/** Update this date whenever the legal copy below is changed. */
const LEGAL_LAST_UPDATED = '2026-06-24';

const legalDocs = [
  {
    id: 'privacy',
    title: 'Privacy Policy',
    intro: 'We value your privacy.',
    body: [
      'Resolve collects and processes only the information required to provide asset management services, including organization details, user accounts, asset records, uploaded files, and QR-related data.',
    ],
    bullets: [
      'Your organization owns its data.',
      'Data is stored securely using industry-standard encryption.',
      'We do not sell customer data to third parties.',
      'Data is shared only with trusted service providers necessary to operate the platform.',
      'You may request data export or account deletion, subject to applicable laws.',
    ],
    footer: 'Governed in accordance with the Digital Personal Data Protection Act, 2023 (India).',
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    intro: 'By using Resolve, you agree to:',
    bullets: [
      'Use the platform only for lawful business purposes.',
      'Keep your account credentials secure.',
      'Ensure the accuracy of information entered into the system.',
      "Comply with your organization's internal policies.",
      'Avoid misuse, unauthorized access, or activities that may disrupt the service.',
    ],
    footer: 'Resolve reserves the right to suspend accounts that violate these terms.',
  },
  {
    id: 'dpa',
    title: 'Data Processing Agreement (DPA)',
    intro: 'Resolve acts as a Data Processor, while your organization remains the Data Controller.',
    body: ['We process your organization\'s data solely to:'],
    bullets: [
      'Store and manage asset information.',
      'Process issue reports and maintenance records.',
      'Authenticate users.',
      'Generate reports and analytics.',
      'Maintain backups and ensure service availability.',
    ],
    footer: 'We implement appropriate technical and organizational security measures to protect your data.',
  },
  {
    id: 'license',
    title: 'License Information',
    intro:
      'Your subscription grants your organization a non-exclusive, non-transferable, subscription-based license to use Resolve during the active subscription period.',
    body: ['The license:'],
    bullets: [
      'Cannot be resold or redistributed.',
      'Does not transfer ownership of the software.',
      'Remains valid while your subscription is active.',
      'Is subject to the usage limits of your selected plan (Assets, Users, Storage, etc.).',
    ],
    footer: 'All intellectual property rights for the Resolve platform remain with its owner.',
  },
] as const;

function formatLegalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProfileLegalSection() {
  return (
    <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-slate-500/50 bg-gray-800/40 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/80 mb-3">
        Legal &amp; compliance
      </p>

      <div className="space-y-2">
        {legalDocs.map((doc) => (
          <details
            key={doc.id}
            className="group rounded-lg border border-gray-700/40 bg-gray-900/30 overflow-hidden"
          >
            <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-gray-200 hover:bg-gray-800/40 transition-colors flex items-center justify-between gap-2">
              <span>{doc.title}</span>
              <span className="text-[10px] text-gray-600 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-700/30">
              {doc.intro && <p className="text-xs text-gray-400 leading-relaxed">{doc.intro}</p>}
              {doc.body?.map((paragraph) => (
                <p key={paragraph} className="text-xs text-gray-400 leading-relaxed">
                  {paragraph}
                </p>
              ))}
              {doc.bullets && (
                <ul className="text-xs text-gray-400 space-y-1 list-disc pl-4 leading-relaxed">
                  {doc.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {doc.footer && (
                <p className="text-xs text-gray-500 leading-relaxed pt-1">{doc.footer}</p>
              )}
            </div>
          </details>
        ))}
      </div>

      <p className="text-[10px] text-gray-600 mt-4 text-center">
        Last updated: {formatLegalDate(LEGAL_LAST_UPDATED)}
      </p>
    </div>
  );
}
