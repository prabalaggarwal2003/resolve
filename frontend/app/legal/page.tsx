'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function LegalPage() {
  const [activeSection, setActiveSection] = useState<'tos' | 'privacy' | 'copyright'>('tos');

  const scrollToSection = (section: 'tos' | 'privacy' | 'copyright') => {
    setActiveSection(section);
    const element = document.getElementById(section);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      {/* Header */}
      <header className="relative z-10 w-full border-b border-gray-800/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <img src="/favicon.svg" alt="resolve logo" className="h-10 w-10" />
            <span className="text-gray-100 font-extrabold text-xl tracking-tight">resolve</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-100 transition-colors no-underline font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="mb-12">
          <h1 className="text-5xl font-extrabold text-gray-100 mb-4">Legal</h1>
          <p className="text-lg text-gray-400">Terms of Service, Privacy Policy & Copyright Notice</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 bg-gray-900/50 border border-gray-800/60 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-4">Sections</p>
              <nav className="space-y-2">
                {[
                  { id: 'tos', label: 'Terms of Service' },
                  { id: 'privacy', label: 'Privacy Policy' },
                  { id: 'copyright', label: 'Copyright & IP Rights' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id as any)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all no-underline ${
                      activeSection === id
                        ? 'bg-gray-700/60 text-gray-100'
                        : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/30'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-16">
            {/* Terms of Service */}
            <section
              id="tos"
              className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-8 backdrop-blur-sm"
            >
              <h2 className="text-3xl font-bold text-gray-100 mb-2">Terms of Service</h2>
              <p className="text-sm text-gray-500 mb-6">Last Updated: March 16, 2026</p>

              <div className="prose prose-invert max-w-none space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">1. Acceptance of Terms</h3>
                  <p className="text-gray-400 leading-relaxed">
                    By accessing and using Resolve ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to any part of these terms, you may not use the Service. Resolve is operated by Resolve Technologies Private Limited, a company incorporated under the laws of India.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">2. Service Description</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Resolve is an enterprise asset management platform designed to help organizations track equipment, manage inventory, report issues via QR codes, and maintain comprehensive audit logs. The Service includes features for role-based access control, asset lifecycle management, maintenance tracking, and depreciation calculations.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">3. Subscription Tiers & Pricing</h3>
                  <div className="text-gray-400 leading-relaxed space-y-2">
                    <p>
                      Resolve offers three subscription tiers:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong className="text-gray-300">Free Plan:</strong> 50 assets, 5 users, limited features (lifetime free)</li>
                      <li><strong className="text-gray-300">Pro Plan:</strong> 200 assets, 10 users, analytics and reporting (₹499/month or ₹4,999/year)</li>
                      <li><strong className="text-gray-300">Premium Plan:</strong> 1000 assets, 20 users, advanced analytics (₹899/month or ₹8,999/year)</li>
                    </ul>
                    <p className="mt-3">
                      Pricing is subject to change with 30 days' notice. Current customers will not be affected by price increases during their active subscription period.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">4. User Accounts & Responsibilities</h3>
                  <p className="text-gray-400 leading-relaxed">
                    You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You agree to provide accurate, complete, and current information during registration. You shall not share account credentials with unauthorized individuals. You are responsible for all actions taken under your account, whether authorized or not.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">5. Acceptable Use Policy</h3>
                  <p className="text-gray-400 leading-relaxed mb-3">You agree NOT to:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
                    <li>Use the Service for any illegal purpose or in violation of Indian laws</li>
                    <li>Attempt to gain unauthorized access to the Service or its infrastructure</li>
                    <li>Reverse engineer, decompile, or attempt to discover the source code</li>
                    <li>Interfere with or disrupt the Service or its servers</li>
                    <li>Use automated tools to extract data without authorization</li>
                    <li>Transmit malware, viruses, or malicious code</li>
                    <li>Engage in any form of harassment or abuse</li>
                    <li>Violate intellectual property rights</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">6. Data Ownership & Security</h3>
                  <p className="text-gray-400 leading-relaxed">
                    You retain ownership of all data you upload to Resolve. We implement 17-layer enterprise-grade security measures including encryption, rate limiting, NoSQL injection prevention, and token blacklisting to protect your data. However, no system is 100% secure, and we cannot guarantee absolute security. You acknowledge this risk.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">7. Backup & Data Loss</h3>
                  <p className="text-gray-400 leading-relaxed">
                    While we maintain regular backups, you are responsible for maintaining your own backups of critical data. Resolve is not liable for any data loss due to user action, account deletion, or unforeseen circumstances. We recommend regular data exports for critical assets.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">8. Subscription & Billing</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Subscription payments are processed through Razorpay (PCI-compliant payment gateway). By upgrading to Pro or Premium, you authorize recurring charges. Subscriptions automatically renew unless cancelled. You can cancel anytime, and the subscription will downgrade to Free at the end of the billing period. No refunds are provided for partial months.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">9. Limitation of Liability</h3>
                  <p className="text-gray-400 leading-relaxed">
                    To the maximum extent permitted by Indian law, Resolve shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">10. Termination</h3>
                  <p className="text-gray-400 leading-relaxed">
                    We may terminate your account immediately if you violate these terms. Upon termination, your access to the Service will be revoked. You may request your data within 30 days of termination; after that, we may delete it permanently.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">11. Modifications to Terms</h3>
                  <p className="text-gray-400 leading-relaxed">
                    We may modify these Terms of Service at any time. Continued use of the Service after modifications constitutes acceptance. We will notify users of significant changes via email.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">12. Governing Law</h3>
                  <p className="text-gray-400 leading-relaxed">
                    These Terms of Service are governed by the laws of India, specifically the Indian Contract Act, 1872, and the Information Technology Act, 2000. All disputes shall be subject to the exclusive jurisdiction of courts in Delhi, India.
                  </p>
                </div>
              </div>
            </section>

            {/* Privacy Policy */}
            <section
              id="privacy"
              className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-8 backdrop-blur-sm"
            >
              <h2 className="text-3xl font-bold text-gray-100 mb-2">Privacy Policy</h2>
              <p className="text-sm text-gray-500 mb-6">Last Updated: March 16, 2026</p>

              <div className="prose prose-invert max-w-none space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">1. Introduction</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Resolve ("we," "us," "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, process, and safeguard your personal information in accordance with the Information Technology Act, 2000 and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">2. Information We Collect</h3>
                  <p className="text-gray-400 leading-relaxed mb-3">We collect the following types of information:</p>
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-gray-300">Personal Information:</p>
                      <ul className="list-disc list-inside text-gray-400 ml-2 mt-1">
                        <li>Name, email address, phone number</li>
                        <li>Organization name and details</li>
                        <li>Payment information (processed by Razorpay, not stored by us)</li>
                        <li>IP address and device information</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-300">Asset Data:</p>
                      <ul className="list-disc list-inside text-gray-400 ml-2 mt-1">
                        <li>Asset details you upload (name, location, condition, etc.)</li>
                        <li>QR code reports and issue logs</li>
                        <li>Maintenance history and audit logs</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-300">Usage Information:</p>
                      <ul className="list-disc list-inside text-gray-400 ml-2 mt-1">
                        <li>Login timestamps and session duration</li>
                        <li>Features used and pages accessed</li>
                        <li>Browser type and operating system</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">3. How We Use Your Information</h3>
                  <p className="text-gray-400 leading-relaxed mb-3">We use your information to:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
                    <li>Provide, maintain, and improve the Service</li>
                    <li>Process subscription payments and billing</li>
                    <li>Send service-related notifications</li>
                    <li>Detect and prevent fraud and security threats</li>
                    <li>Comply with legal obligations</li>
                    <li>Generate anonymized analytics and reports</li>
                    <li>Respond to your support requests</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">4. Data Storage & Security</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Your data is stored on MongoDB Atlas (cloud-hosted database) with SSL/TLS encryption. We implement 17 layers of security including helmet headers, rate limiting, NoSQL injection prevention, JWT token blacklisting, and comprehensive audit logging. All data in transit is encrypted using HTTPS.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">5. Data Retention</h3>
                  <p className="text-gray-400 leading-relaxed">
                    We retain your data as long as your account is active. If you delete your account, we will delete your personal information within 30 days, except where required by law. Audit logs may be retained for 7 years for compliance purposes.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">6. Third-Party Services</h3>
                  <p className="text-gray-400 leading-relaxed">
                    We use the following third-party services:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2 mt-2">
                    <li><strong className="text-gray-300">Razorpay:</strong> Payment processing (PCI-DSS compliant)</li>
                    <li><strong className="text-gray-300">MongoDB Atlas:</strong> Database hosting</li>
                    <li><strong className="text-gray-300">Vercel:</strong> Frontend hosting</li>
                    <li><strong className="text-gray-300">Render:</strong> Backend hosting</li>
                  </ul>
                  <p className="text-gray-400 mt-3">
                    These services have their own privacy policies. We do not share your data with any other third parties without consent.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">7. Your Rights</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Under Indian law, you have the right to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2 mt-2">
                    <li>Access your personal information</li>
                    <li>Request correction of inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Withdraw consent for data processing</li>
                    <li>Data portability (export your data)</li>
                    <li>Lodge complaints with the concerned authorities</li>
                  </ul>
                  <p className="text-gray-400 mt-3">
                    To exercise these rights, contact us at support@resolve.local
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">8. Cookies & Tracking</h3>
                  <p className="text-gray-400 leading-relaxed">
                    We use browser storage (localStorage) to store authentication tokens for your convenience. We do not use tracking cookies or third-party analytics that identify you. You can clear this data anytime from your browser settings.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">9. Children's Privacy</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Resolve is not intended for children under 18 years of age. We do not knowingly collect information from children. If we become aware that a child has provided us with personal information, we will delete it immediately.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">10. Data Breach Notification</h3>
                  <p className="text-gray-400 leading-relaxed">
                    In the event of a data breach, we will notify affected users within 72 hours as required by the Information Technology Act, 2000. We will disclose the nature of the breach and steps taken to mitigate the risk.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">11. Policy Updates</h3>
                  <p className="text-gray-400 leading-relaxed">
                    We may update this Privacy Policy periodically. Significant changes will be communicated via email. Your continued use of the Service indicates acceptance of the updated policy.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">12. Contact Information</h3>
                  <p className="text-gray-400 leading-relaxed">
                    For privacy-related inquiries, contact us at:
                    <br />
                    Email: privacy@resolve.local
                    <br />
                    Address: Delhi, India
                  </p>
                </div>
              </div>
            </section>

            {/* Copyright & IP Rights */}
            <section
              id="copyright"
              className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-8 backdrop-blur-sm"
            >
              <h2 className="text-3xl font-bold text-gray-100 mb-2">Copyright & Intellectual Property Rights</h2>
              <p className="text-sm text-gray-500 mb-6">Last Updated: March 16, 2026</p>

              <div className="prose prose-invert max-w-none space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">1. Ownership of Resolve</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Resolve, including all its source code, design, features, functionality, and documentation, is the exclusive property of Resolve Technologies Private Limited. All intellectual property rights (copyright, trademark, patents, and trade secrets) are owned by us.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">2. Trademarks & Brand Identity</h3>
                  <p className="text-gray-400 leading-relaxed mb-3">
                    The following are registered or unregistered trademarks of Resolve Technologies Private Limited:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
                    <li>"Resolve" (name and logo)</li>
                    <li>All design elements, color schemes, and UI components</li>
                    <li>Taglines: "From Chaos, To Control"</li>
                    <li>All other marks and logos associated with our products</li>
                  </ul>
                  <p className="text-gray-400 mt-3">
                    You may not use our trademarks, logos, or brand identity without explicit written permission. Unauthorized use will result in legal action under the Trade Marks Act, 1999.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">3. License Grant</h3>
                  <p className="text-gray-400 leading-relaxed">
                    We grant you a limited, non-exclusive, non-transferable license to access and use Resolve solely for your authorized business purposes. This license does not permit you to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2 mt-2">
                    <li>Reproduce, copy, or duplicate the Service</li>
                    <li>Modify or create derivative works</li>
                    <li>Distribute, sell, or lease the Service</li>
                    <li>Reverse engineer, decompile, or disassemble</li>
                    <li>Use the Service as part of another product or service</li>
                    <li>Remove or obscure our copyright notices</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">4. User-Generated Content</h3>
                  <p className="text-gray-400 leading-relaxed">
                    You retain all intellectual property rights to the data and content you upload to Resolve. By uploading content, you grant us a non-exclusive, worldwide license to use it to provide and improve the Service. We do not sell or commercially exploit your data.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">5. Copyright Infringement Claims</h3>
                  <p className="text-gray-400 leading-relaxed">
                    If you believe that content on Resolve infringes your copyright, please notify us with:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2 mt-2">
                    <li>Your name and contact information</li>
                    <li>Description of the copyrighted work</li>
                    <li>Location of the infringing content</li>
                    <li>Your statement of good faith belief</li>
                    <li>Your digital signature</li>
                  </ul>
                  <p className="text-gray-400 mt-3">
                    Send complaints to: copyright@resolve.local
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">6. Brand Usage Guidelines</h3>
                  <p className="text-gray-400 leading-relaxed mb-3">
                    If you wish to reference Resolve in your marketing materials, you must:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2">
                    <li>Request written permission from Resolve Technologies Private Limited</li>
                    <li>Use the approved logos and branding guidelines provided</li>
                    <li>Not modify, distort, or alter our logos</li>
                    <li>Clearly state that Resolve is not endorsed by you</li>
                    <li>Not use our brand in any misleading context</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">7. No Resale or Redistribution</h3>
                  <p className="text-gray-400 leading-relaxed">
                    You may not resell, redistribute, or provide access to Resolve to any third party without explicit written permission. This includes:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2 mt-2">
                    <li>Creating competing products based on our Service</li>
                    <li>Offering white-label versions</li>
                    <li>Providing access to third parties as part of another service</li>
                    <li>Publicly sharing accounts or credentials</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">8. Enforcement & Legal Action</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Any violation of these intellectual property rights will result in:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2 mt-2">
                    <li>Immediate termination of your account</li>
                    <li>Removal of infringing content</li>
                    <li>Civil and criminal legal action under applicable Indian laws</li>
                    <li>Claims for damages and attorney fees</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">9. Attribution Required</h3>
                  <p className="text-gray-400 leading-relaxed">
                    If you reference Resolve in any public communication, you must:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2 mt-2">
                    <li>Give clear attribution to Resolve Technologies Private Limited</li>
                    <li>Include our website URL: www.resolve.local</li>
                    <li>Use our trademark notice: ® or ™ as appropriate</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">10. Open Source Compliance</h3>
                  <p className="text-gray-400 leading-relaxed">
                    Resolve uses certain open-source libraries and components. We comply with all applicable open-source licenses including MIT, Apache 2.0, and others. Our use of open-source does not make Resolve itself open-source.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">11. Monitoring & Enforcement</h3>
                  <p className="text-gray-400 leading-relaxed">
                    We actively monitor for unauthorized use of our intellectual property. We use automated tools and manual review to detect infringement. Upon discovery, we take immediate legal action including DMCA notices and court filings.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">12. Contact for IP Inquiries</h3>
                  <p className="text-gray-400 leading-relaxed">
                    For intellectual property inquiries, licensing requests, or infringement reports:
                    <br />
                    Email: ip@resolve.local
                    <br />
                    Address: Delhi, India
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-gray-200 mb-3">13. Applicable Law</h3>
                  <p className="text-gray-400 leading-relaxed">
                    All intellectual property rights are governed by:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 ml-2 mt-2">
                    <li>Copyright Act, 1957</li>
                    <li>Trade Marks Act, 1999</li>
                    <li>Patents Act, 1970</li>
                    <li>Information Technology Act, 2000</li>
                    <li>Indian Contract Act, 1872</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Contact Section */}
            <section className="bg-gradient-to-r from-gray-800/30 to-gray-900/30 border border-gray-800/60 rounded-xl p-8 backdrop-blur-sm">
              <h3 className="text-2xl font-bold text-gray-100 mb-4">Questions or Concerns?</h3>
              <p className="text-gray-400 mb-6">
                If you have any questions about these legal documents or need to report a violation, please contact us:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="font-semibold text-gray-300 mb-1">General Inquiries</p>
                  <p className="text-gray-400 text-sm">support@resolve.local</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-300 mb-1">Privacy Issues</p>
                  <p className="text-gray-400 text-sm">privacy@resolve.local</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-300 mb-1">IP & Copyright</p>
                  <p className="text-gray-400 text-sm">ip@resolve.local</p>
                </div>
              </div>
            </section>

            {/* Footer Notice */}
            <div className="border-t border-gray-800/60 pt-8 text-center">
              <p className="text-sm text-gray-500">
                © 2026 Resolve Technologies Private Limited. All rights reserved. | Based in Delhi, India | Incorporated under Indian law
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

