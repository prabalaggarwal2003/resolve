'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

// ════════════════════════════════════════════════════════════════════════════════════
// COMMENTED OUT: Plus Sign Pattern with Sweeping Highlight Animation
// ════════════════════════════════════════════════════════════════════════════════════
// This animation displayed a grid of + signs with a horizontal sweeping light effect
// that illuminated the signs as it moved across. Kept for reference if needed.
/*
function AnimatedBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Set canvas size
		const setCanvasSize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		setCanvasSize();

		// Animation loop
		let animationId: number;
		let time = 0;

		const animate = () => {
			animationId = requestAnimationFrame(animate);

			// Clear canvas
			ctx.fillStyle = 'rgba(15, 23, 42, 1)';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Draw + signs pattern
			const gridSize = 160;
			const plusSize = 12;
			const baseOpacity = 0.15;

			ctx.strokeStyle = `rgba(100, 116, 139, ${baseOpacity})`;
			ctx.lineWidth = 2.5;

			// Draw + signs at grid intersections
			for (let x = 0; x < canvas.width; x += gridSize) {
				for (let y = 0; y < canvas.height; y += gridSize) {
					ctx.beginPath();
					ctx.moveTo(x - plusSize, y);
					ctx.lineTo(x + plusSize, y);
					ctx.stroke();

					ctx.beginPath();
					ctx.moveTo(x, y - plusSize);
					ctx.lineTo(x, y + plusSize);
					ctx.stroke();
				}
			}

			// Sweeping light effect
			const sweepWidth = canvas.width * 0.25;
			const sweepPos = (time) % (canvas.width + sweepWidth);
			const sweepX = sweepPos - sweepWidth;

			for (let x = 0; x < canvas.width; x += gridSize) {
				for (let y = 0; y < canvas.height; y += gridSize) {
					const distFromSweep = Math.abs(x - sweepX - sweepWidth / 2);
					const sweepIntensity = Math.max(0, 1 - distFromSweep / (sweepWidth / 2));

					if (sweepIntensity > 0.01) {
						const glowAlpha = sweepIntensity * 0.6;
						const glowRadius = 20;
						const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
						grad.addColorStop(0, `rgba(255, 255, 255, ${glowAlpha * 0.8})`);
						grad.addColorStop(0.5, `rgba(255, 255, 255, ${glowAlpha * 0.3})`);
						grad.addColorStop(1, `rgba(255, 255, 255, 0)`);

						ctx.fillStyle = grad;
						ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);

						ctx.strokeStyle = `rgba(255, 255, 200, ${sweepIntensity * 0.4})`;
						ctx.lineWidth = 2.5;

						ctx.beginPath();
						ctx.moveTo(x - plusSize, y);
						ctx.lineTo(x + plusSize, y);
						ctx.stroke();

						ctx.beginPath();
						ctx.moveTo(x, y - plusSize);
						ctx.lineTo(x, y + plusSize);
						ctx.stroke();
					}
				}
			}

			time++;
		};

		animate();

		const handleResize = () => {
			setCanvasSize();
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			cancelAnimationFrame(animationId);
		};
	}, []);

	return <canvas ref={canvasRef} className="absolute inset-0" />;
}
*/
// ════════════════════════════════════════════════════════════════════════════════════

// Dots and Lines Network Animation - Appearing and disappearing network clusters
function AnimatedBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (!canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const setCanvasSize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		setCanvasSize();

		let animationId: number;
		let time = 0;

		// Define network clusters
		interface Dot {
			x: number;
			y: number;
			baseOpacity: number;
			id: string;
		}

		interface Cluster {
			dots: Dot[];
			lines: Array<{ from: number; to: number }>;
			startTime: number;
			duration: number;
			x: number;
			y: number;
			globalAlpha: number;
		}

		const clusters: Cluster[] = [];

		// Create a new cluster
		const createCluster = () => {
			const numDots = Math.random() < 0.4 ? 5 : 6; // Increased from 3-4 to 5-6
			const clusterX = Math.random() * canvas.width;
			const clusterY = Math.random() * canvas.height;
			const spacing = 50 + Math.random() * 50; // Adjusted spacing

			const dots: Dot[] = [];
			for (let i = 0; i < numDots; i++) {
				dots.push({
					x: clusterX + (Math.random() - 0.5) * spacing * 2.5,
					y: clusterY + (Math.random() - 0.5) * spacing * 2.5,
					baseOpacity: 0.6 + Math.random() * 0.3,
					id: `${clusterX}-${clusterY}-${i}`,
				});
			}

			// Create more connections - increased lines
			const lines: Array<{ from: number; to: number }> = [];
			for (let i = 0; i < numDots; i++) {
				const connectionCount = Math.floor(Math.random() * 3) + 2; // Increased from 1-2 to 2-3 connections per dot
				for (let j = 0; j < connectionCount; j++) {
					const targetIndex = Math.floor(Math.random() * numDots);
					if (targetIndex !== i && !lines.some(l => (l.from === i && l.to === targetIndex) || (l.from === targetIndex && l.to === i))) {
						lines.push({ from: i, to: targetIndex });
					}
				}
			}

			clusters.push({
				dots,
				lines,
				startTime: time,
				duration: 500 + Math.random() * 400, // Decreased from 800-1400 to 500-900 milliseconds
				x: clusterX,
				y: clusterY,
				globalAlpha: 0,
			});
		};

		// Spawn initial clusters
		for (let i = 0; i < 4; i++) { // Increased initial spawn from 3 to 4
			createCluster();
		}

		const animate = () => {
			animationId = requestAnimationFrame(animate);

			// Clear canvas
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Update and draw clusters
			for (let i = clusters.length - 1; i >= 0; i--) {
				const cluster = clusters[i];
				const elapsed = time - cluster.startTime;
				const progress = elapsed / cluster.duration;

				if (progress > 1) {
					// Remove finished cluster
					clusters.splice(i, 1);
					continue;
				}

				// Calculate opacity based on lifecycle
				// Fade in first 15%, stay visible in middle 70%, fade out last 15%
				let alpha: number;
				if (progress < 0.15) {
					alpha = progress / 0.15; // Fade in faster
				} else if (progress > 0.85) {
					alpha = 1 - (progress - 0.85) / 0.15; // Fade out faster
				} else {
					alpha = 1;
				}

				// Pulse effect
				const pulsePhase = (elapsed % 400) / 400;
				const pulseAmount = Math.sin(pulsePhase * Math.PI * 2) * 0.15;
				alpha = Math.max(0.2, alpha * (0.85 + pulseAmount));

				cluster.globalAlpha = alpha;

				// Draw lines
				ctx.strokeStyle = `rgba(100, 116, 139, ${alpha * 0.4})`;
				ctx.lineWidth = 1;

				cluster.lines.forEach(line => {
					const fromDot = cluster.dots[line.from];
					const toDot = cluster.dots[line.to];

					ctx.beginPath();
					ctx.moveTo(fromDot.x, fromDot.y);
					ctx.lineTo(toDot.x, toDot.y);
					ctx.stroke();
				});

				// Draw dots
				cluster.dots.forEach(dot => {
					const dotAlpha = alpha * dot.baseOpacity;

					// Dot glow
					const gradient = ctx.createRadialGradient(
						dot.x,
						dot.y,
						0,
						dot.x,
						dot.y,
						8
					);
					gradient.addColorStop(0, `rgba(100, 116, 139, ${dotAlpha * 0.8})`);
					gradient.addColorStop(1, `rgba(100, 116, 139, 0)`);

					ctx.fillStyle = gradient;
					ctx.fillRect(dot.x - 8, dot.y - 8, 16, 16);

					// Solid dot center
					ctx.fillStyle = `rgba(148, 163, 184, ${dotAlpha})`;
					ctx.beginPath();
					ctx.arc(dot.x, dot.y, 2.5, 0, Math.PI * 2);
					ctx.fill();
				});
			}

			// Spawn new clusters periodically
			if (Math.random() < 0.035 && clusters.length < 8) { // Increased spawn chance from 0.02 to 0.035, max from 6 to 8
				createCluster();
			}

			time++;
		};

		animate();

		const handleResize = () => {
			setCanvasSize();
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			cancelAnimationFrame(animationId);
		};
	}, []);

	return <canvas ref={canvasRef} className="absolute inset-0" />;
}

const features = [
	{ icon: '📦', label: 'Asset Tracking', desc: 'Full lifecycle from purchase to retirement' },
	{ icon: '🔔', label: 'Issue Reporting', desc: 'QR-based reporting, no login needed' },
	{ icon: '🔧', label: 'Maintenance', desc: 'Schedule, history & health scoring' },
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
		desc: 'Assets can be flagged for maintenance based on age and open issues. Complete maintenance cycles and track full history.',
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
			'Up to 50 assets',
			'Issue reporting via QR',
			'5 user roles',
			'Audit logs',
			'Vendor & Invoice management',
			'PDF reports & exports',
			'Notifications & Maintenance',
		],
		cta: 'Get started',
		href: '/signup',
		highlight: false,
	},
	{
		name: 'Pro',
		price: '₹499',
		period: 'per month',
		desc: 'For growing organisations that need more control.',
		features: [
			'Everything in Free',
			'Up to 200 assets',
			'Advanced analytics & KPIs',
			'Depreciation tracking',
			'Priority support',
		],
		cta: 'Sign up today',
		href: '/signup',
		highlight: true,
	},
	{
		name: 'Premium',
		price: '₹899',
		period: 'per month',
		desc: 'For large institutions with more needs.',
		features: [
			'Everything in Pro',
			'Up to 1000 assets',
			'20 user roles',
			'Custom integrations',

		],
		cta: 'Start your journey',
		href: '/signup',
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

		{/* Three.js Animated Background */}
		<div className="absolute inset-0 top-0 h-[800px] opacity-40 pointer-events-none">
			<AnimatedBackground />
		</div>

			{/* ── Nav ── */}
			<header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<img src="/favicon.svg" alt="resolve logo" className="h-12 w-12 -mr-2" />
					<span className="text-gray-100 font-extrabold text-2xl tracking-tight">resolve</span>
				</div>
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
						WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
						maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
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



				{/* ── Platform Capabilities Showcase ── */}
				<div className="mt-24 w-full max-w-4xl mx-auto px-0">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{[
							{
								icon: '⚡',
								title: 'Instant Setup',
								desc: 'No complex configurations. Start tracking in minutes.',
								delay: '0ms',
								color: 'from-gray-700/30 to-gray-800/30',
							},
							{
								icon: '🔒',
								title: 'Enterprise Security',
								desc: 'Multiple layer security. Your data is protected.',
								delay: '100ms',
								color: 'from-gray-700/30 to-gray-800/30',
							},
							{
								icon: '♻️',
								title: 'Lifecycle Tracking',
								desc: 'From purchase to retirement. Complete asset history.',
								delay: '200ms',
								color: 'from-gray-700/30 to-gray-800/30',
							},
							{
								icon: '📡',
								title: 'Real-time Monitoring',
								desc: 'Live dashboards, health scoring & instant alerts.',
								delay: '300ms',
								color: 'from-gray-700/30 to-gray-800/30',
							},
						].map(({ icon, title, desc, delay, color }) => (
							<div
								key={title}
								className="group"
								style={{
									animation: `slideInUp 0.7s ease-out forwards`,
									animationDelay: delay,
									opacity: 0,
								}}
							>
								<div
									className={`relative rounded-xl border border-gray-700/40 bg-gradient-to-br ${color} backdrop-blur-md p-5 h-full transition-all duration-300 hover:border-gray-600/60 hover:bg-gradient-to-br hover:from-gray-700/40 hover:to-gray-800/40`}
								>
									{/* Animated top accent */}
									<div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-1 bg-gradient-to-r from-transparent via-gray-400 to-transparent group-hover:w-full transition-all duration-300" />

									{/* Icon */}
									<div className="text-3xl mb-3 transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
										{icon}
									</div>

									{/* Title */}
									<p className="text-sm font-bold text-gray-200 mb-2 group-hover:text-gray-100 transition-colors">
										{title}
									</p>

									{/* Description */}
									<p className="text-xs text-gray-500 leading-relaxed group-hover:text-gray-400 transition-colors">
										{desc}
									</p>

									{/* Hover bottom accent */}
									<div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent opacity-0 group-hover:opacity-100 rounded-b-xl transition-opacity duration-300" />
								</div>
							</div>
						))}
					</div>
				</div>
				{/* Horizontal divider */}
				<div className="mt-20 w-full max-w-4xl mx-auto">
					<div className="h-px bg-gradient-to-r from-transparent via-gray-700/60 to-transparent" />
				</div>

				{/* 3D Animated Impact Stats */}
				<div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
					{[
						{ value: '50K+', label: 'Assets Tracked', delay: '0ms' },
						{ value: '99.9%', label: 'Uptime SLA', delay: '100ms' },
						{ value: '10s', label: 'Avg Report Time', delay: '200ms' },
					].map(({ value, label, delay }) => (
						<div
							key={label}
							className="relative group"
							style={{
								animation: `fadeInUp 0.6s ease-out forwards`,
								animationDelay: delay,
								opacity: 0,
							}}
						>
							{/* Animated glow background */}
							<div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-700/20 to-gray-800/20 blur-xl group-hover:blur-2xl transition-all duration-300 opacity-0 group-hover:opacity-100" />

							{/* Card */}
							<div className="relative rounded-2xl border border-gray-700/50 bg-gray-900/60 backdrop-blur-md p-8 text-center hover:border-gray-600/60 transition-all duration-300 transform group-hover:scale-105 group-hover:-translate-y-1">
								<div className="text-5xl font-extrabold bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent mb-2">
									{value}
								</div>
								<div className="text-sm text-gray-500 font-medium">{label}</div>

								{/* Animated underline */}
								<div className="h-1 w-0 group-hover:w-full bg-gradient-to-r from-gray-600 to-gray-400 rounded-full mx-auto mt-4 transition-all duration-300" />
							</div>
						</div>
					))}
				</div>

				<style jsx>{`
					@keyframes fadeInUp {
						from {
							opacity: 0;
							transform: translateY(30px);
						}
						to {
							opacity: 1;
							transform: translateY(0);
						}
					}
					@keyframes slideInUp {
						from {
							opacity: 0;
							transform: translateY(25px);
						}
						to {
							opacity: 1;
							transform: translateY(0);
						}
					}
				`}</style>
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
			<div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-5 gap-8 mb-10">
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
				<div>
					<p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
						Legal
					</p>
					<ul className="space-y-2 text-sm text-gray-500">
						<li>
							<Link
								href="/legal"
								className="hover:text-gray-300 transition-colors no-underline"
							>
								Terms of Service
							</Link>
						</li>
						<li>
							<Link
								href="/legal#privacy"
								className="hover:text-gray-300 transition-colors no-underline"
							>
								Privacy Policy
							</Link>
						</li>
						<li>
							<Link
								href="/legal#copyright"
								className="hover:text-gray-300 transition-colors no-underline"
							>
								Copyright & IP
							</Link>
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
