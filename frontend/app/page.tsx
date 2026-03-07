import Link from 'next/link';

const features = [
	{ icon: '📦', label: 'Asset Tracking', desc: 'Full lifecycle from purchase to retirement' },
	{ icon: '🔔', label: 'Issue Reporting', desc: 'QR-based reporting, no login needed' },
	{ icon: '🔧', label: 'Maintenance', desc: 'Auto-schedule, history & health scoring' },
	{ icon: '📊', label: 'Analytics & KPIs', desc: 'Depreciation, utilisation & metrics' },
	{ icon: '📋', label: 'Audit Logs', desc: 'Every action tracked and downloadable' },
	{ icon: '🏢', label: 'Multi-role', desc: 'Admin, manager, reporter — all in one' },
];

const overview = [
	{
		step: '01',
		title: 'Add your assets',
		desc: 'Create assets with auto-generated IDs, categories, purchase details, warranty dates and vendor info. Bulk-add with replication.',
	},
	{
		step: '02',
		title: 'Scan & report issues',
		desc: 'Every asset gets a QR code. Anyone can scan it to report a problem — no account required. Track every report from open to resolved.',
	},
	{
		step: '03',
		title: 'Manage & maintain',
		desc: 'Assets are automatically flagged for maintenance based on age and open issues. Complete maintenance cycles and track full history.',
	},
	{
		step: '04',
		title: 'Analyse & audit',
		desc: 'Download audit logs, generate daily/weekly/monthly reports, track depreciation and KPIs — everything in one place.',
	},
];

const plans = [
	{
		name: 'Free',
		price: '₹0',
		period: 'forever',
		desc: 'Perfect for small institutions getting started.',
		features: [
			'Up to 100 assets',
			'Issue reporting via QR',
			'Basic audit logs',
			'3 user roles',
			'Email notifications',
		],
		cta: 'Get started',
		href: '/signup',
		highlight: false,
	},
	{
		name: 'Pro',
		price: '₹999',
		period: 'per month',
		desc: 'For growing organisations that need more control.',
		features: [
			'Unlimited assets',
			'Advanced analytics & KPIs',
			'Depreciation tracking',
			'Vendor & invoice management',
			'PDF reports & exports',
			'Priority support',
		],
		cta: 'Start free trial',
		href: '/signup',
		highlight: true,
	},
	{
		name: 'Enterprise',
		price: 'Custom',
		period: '',
		desc: 'For large institutions with custom needs.',
		features: [
			'Everything in Pro',
			'Custom integrations',
			'Dedicated onboarding',
			'SLA guarantee',
			'On-premise option',
		],
		cta: 'Contact us',
		href: 'mailto:contact@resolve.app',
		highlight: false,
	},
];

export default function HomePage() {
	return (
		<main
			className="min-h-screen bg-gray-950 flex flex-col relative overflow-hidden"
			style={{ fontFamily: 'var(--font-manrope, Manrope, sans-serif)' }}
		>
			{/* Ambient blobs */}
			<div className="absolute top-[-180px] left-[-180px] w-[500px] h-[500px] rounded-full bg-gray-700/20 blur-[140px] pointer-events-none" />
			<div className="absolute top-[40%] right-[-200px] w-[460px] h-[460px] rounded-full bg-gray-600/10 blur-[120px] pointer-events-none" />

			{/* ── Nav ── */}
			<header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
				<span className="text-gray-100 font-extrabold text-2xl tracking-tight">resolve</span>
				<div className="flex items-center gap-3">
					<Link href="/login" className="text-sm text-gray-400 hover:text-gray-100 transition-colors no-underline font-medium">Sign in</Link>
					<Link href="/signup" className="text-sm bg-gray-100 text-gray-950 px-4 py-2 rounded-lg font-bold hover:bg-white transition-all no-underline">Get started →</Link>
				</div>
			</header>

			{/* ── Giant faded wordmark ── */}
			<div className="relative z-10 w-full flex justify-center overflow-hidden" style={{ height: '220px', marginBottom: '-80px' }}>
				<span
					className="select-none font-extrabold tracking-tighter text-gray-800 leading-none"
					style={{
						fontSize: 'clamp(140px, 24vw, 280px)',
						WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)',
						maskImage: 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)',
						lineHeight: 1,
					}}
				>
					resolve
				</span>
			</div>

			{/* ── Hero ── */}
			<section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-36 pb-24">
				<span className="mb-6 inline-flex items-center px-4 py-1.5 rounded-full bg-gray-800/70 border border-gray-700/60 text-xs font-semibold text-gray-400 tracking-widest uppercase backdrop-blur-sm">
					Asset Management Platform
				</span>
				<h1 className="text-6xl sm:text-7xl font-extrabold text-gray-100 tracking-tight leading-tight mb-5">
					From Chaos,
					<br />
					<span className="text-gray-500">To Control.</span>
				</h1>
				<p className="text-gray-500 text-lg leading-relaxed max-w-lg mb-10">
					Track equipment, report issues via QR, manage inventory and audits — purpose-built for all organisations.
				</p>
				<div className="flex flex-col sm:flex-row items-center gap-3 mb-20">
					<Link
						href="/signup"
						className="inline-flex items-center justify-center px-8 py-4 bg-gray-100 text-gray-950 rounded-xl font-bold text-base hover:bg-white transition-all shadow-xl no-underline"
					>
						Get started free →
					</Link>
					<a
						href="#overview"
						className="inline-flex items-center justify-center px-8 py-4 bg-gray-800/60 border border-gray-700/60 text-gray-300 rounded-xl font-semibold text-base hover:bg-gray-700/60 transition-all backdrop-blur-sm no-underline"
					>
						See how it works
					</a>
				</div>

				{/* Feature pills */}
				<div className="flex flex-wrap justify-center gap-2">
					{features.map(({ icon, label }) => (
						<span
							key={label}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900/60 border border-gray-800/80 text-xs text-gray-400 font-medium backdrop-blur-sm"
						>
							<span>{icon}</span>
							{label}
						</span>
					))}
				</div>
			</section>

			{/* ── Product Overview ── */}
			<section
				id="overview"
				className="scroll-mt-20 relative z-10 w-full bg-gray-900/50 border-y border-gray-800/60 backdrop-blur-sm py-24 px-6"
			>
				<div className="max-w-5xl mx-auto">
					<div className="text-center mb-14">
						<span className="mb-6 inline-flex items-center px-4 py-1.5 rounded-full bg-gray-800/70 border border-gray-700/60 text-xs font-semibold text-gray-400 tracking-widest uppercase backdrop-blur-sm">
					HOW IT WORKS
				</span>
						<h2 className="text-4xl font-extrabold text-gray-100 mt-3 tracking-tight">
							Simple. Powerful. Complete.
						</h2>
						<p className="text-gray-500 mt-3 max-w-md mx-auto text-base">
							From setup to daily operations, resolve handles every step of your asset lifecycle.
						</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
						{overview.map(({ step, title, desc }) => (
							<div
								key={step}
								className="rounded-2xl border border-gray-700/50 bg-gray-900/60 backdrop-blur-md p-7 hover:border-gray-600/60 hover:bg-gray-800/50 transition-all"
							>
								<span className="text-xs font-bold text-gray-600 tracking-widest">
									{step}
								</span>
								<h3 className="text-lg font-bold text-gray-100 mt-2 mb-2">
									{title}
								</h3>
								<p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
							</div>
						))}
					</div>

					<div className="border-t border-gray-800/60 mt-8">
					</div>


					{/* Feature detail grid */}
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8">
						{features.map(({ icon, label, desc }) => (
							<div
								key={label}
								className="rounded-xl border border-gray-800/60 bg-gray-900/40 backdrop-blur-sm p-5 hover:border-gray-700/60 transition-all"
							>
								<div className="text-xl mb-2">{icon}</div>
								<p className="text-sm font-bold text-gray-200 mb-1">{label}</p>
								<p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── Pricing ── */}
			<section id="pricing" className="scroll-mt-20 relative z-10 w-full py-24 px-6">
				<div className="absolute inset-0 pointer-events-none">
					<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-gray-800/10 blur-[100px]" />
				</div>
				<div className="relative max-w-5xl mx-auto">
					<div className="text-center mb-14">
						<span className="mb-6 inline-flex items-center px-4 py-1.5 rounded-full bg-gray-800/70 border border-gray-700/60 text-xs font-semibold text-gray-400 tracking-widest uppercase backdrop-blur-sm">
					PRICING
				</span>
						<h2 className="text-4xl font-extrabold text-gray-100 mt-3 tracking-tight">
							Simple, transparent pricing
						</h2>
						<p className="text-gray-500 mt-3 max-w-md mx-auto text-base">
							Start free. Scale when you're ready.
						</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
						{plans.map(
							({ name, price, period, desc, features: planFeatures, cta, href, highlight }) => (
								<div
									key={name}
									className={`relative rounded-2xl border p-7 flex flex-col backdrop-blur-md transition-all
                ${highlight
										? 'border-gray-500/70 bg-gray-800/70 shadow-2xl scale-[1.02]'
										: 'border-gray-700/50 bg-gray-900/50 hover:border-gray-600/60 hover:bg-gray-800/40'
									}`}
								>
									{highlight && (
										<span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-200 text-gray-900 text-xs font-bold rounded-full">
											Most popular
										</span>
									)}
									<div className="mb-6">
										<p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
											{name}
										</p>
										<div className="flex items-end gap-1 mb-1">
											<span className="text-4xl font-extrabold text-gray-100">
												{price}
											</span>
											{period && (
												<span className="text-sm text-gray-500 mb-1">
													/ {period}
												</span>
											)}
										</div>
										<p className="text-sm text-gray-500">{desc}</p>
									</div>
									<ul className="space-y-2 mb-8 flex-1">
										{planFeatures.map(f => (
											<li key={f} className="flex items-start gap-2 text-sm text-gray-400">
												<span className="text-green-500 mt-0.5 shrink-0">✓</span>
												{f}
											</li>
										))}
									</ul>
									<Link
										href={href}
										className={`w-full text-center py-3 rounded-xl font-bold text-sm transition-all no-underline
                  ${highlight
												? 'bg-gray-100 text-gray-950 hover:bg-white'
												: 'bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700'
										}`}
									>
										{cta}
									</Link>
								</div>
							)
						)}
					</div>
				</div>
			</section>

			{/* ── Footer ── */}
			<footer className="relative z-10 w-full border-t border-gray-800/60 bg-gray-900/40 backdrop-blur-sm py-12 px-6">
				<div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
					<div className="col-span-2 sm:col-span-1">
						<p className="text-gray-100 font-extrabold text-lg tracking-tight mb-2">
							resolve
						</p>
						<p className="text-xs text-gray-600 leading-relaxed">
							Asset management for all organisations.
						</p>
					</div>
					<div>
						<p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
							Product
						</p>
						<ul className="space-y-2 text-sm text-gray-500">
							<li>
								<a
									href="#overview"
									className="hover:text-gray-300 transition-colors no-underline"
								>
									Overview
								</a>
							</li>
							<li>
								<a
									href="#pricing"
									className="hover:text-gray-300 transition-colors no-underline"
								>
									Pricing
								</a>
							</li>
							<li>
								<Link
									href="/signup"
									className="hover:text-gray-300 transition-colors no-underline"
								>
									Get started
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
							Account
						</p>
						<ul className="space-y-2 text-sm text-gray-500">
							<li>
								<Link
									href="/login"
									className="hover:text-gray-300 transition-colors no-underline"
								>
									Sign in
								</Link>
							</li>
							<li>
								<Link
									href="/signup"
									className="hover:text-gray-300 transition-colors no-underline"
								>
									Register
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
							Contact
						</p>
						<ul className="space-y-2 text-sm text-gray-500">
							<li>
								<a
									href="mailto:resolveishere@gmail.com"
									className="hover:text-gray-300 transition-colors no-underline"
								>
									resolveishere@gmail.com
								</a>
							</li>
							<li>
								<a
									href="tel:+911234567890"
									className="hover:text-gray-300 transition-colors no-underline"
								>
									+91 1234567890
								</a>
							</li>
						</ul>
					</div>
				</div>
				<div className="border-t border-gray-800/60 pt-6 text-center">
					<p className="text-xs text-gray-700">
						© {new Date().getFullYear()} resolve · Free to use · No credit card required
					</p>
				</div>
			</footer>
		</main>
	);
}
