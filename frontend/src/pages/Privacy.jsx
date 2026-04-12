import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function Privacy() {
  const [expandedSection, setExpandedSection] = useState(0);

  const sections = [
    {
      title: 'Information We Collect',
      content: 'RestroMax collects the following types of information:\n\n• Account Information: Name, email, phone number, restaurant details\n• Business Data: Orders, customer information, inventory, staff records\n• Usage Data: Login times, features used, performance metrics\n• Device Information: IP address, browser type, device information\n• Payment Information: Billing address, payment method (processed securely)',
    },
    {
      title: 'How We Use Data',
      content: 'We use collected data to:\n• Provide and maintain the Service\n• Process transactions and send related information\n• Send promotional emails and updates (with opt-out option)\n• Monitor and analyze usage patterns\n• Detect and prevent fraud\n• Improve our services and features\n• Comply with legal obligations',
    },
    {
      title: 'Data Security',
      content: 'RestroMax implements industry-standard security measures:\n• End-to-end encryption for sensitive data\n• Secure server infrastructure\n• Regular security audits\n• Limited access to personal data\n• Secure password hashing\n• Two-factor authentication support\n\nHowever, no online service is 100% secure. We cannot guarantee absolute security.',
    },
    {
      title: 'Cookies Usage',
      content: 'RestroMax uses cookies to:\n• Remember your login preferences\n• Improve user experience\n• Track website analytics\n• Prevent fraud\n\nYou can control cookies through your browser settings. Disabling cookies may limit certain features of the Service.',
    },
    {
      title: 'Third-party Services',
      content: 'RestroMax may use third-party services including:\n• Payment processors (Stripe, PayPal)\n• Analytics providers (Google Analytics)\n• Cloud hosting providers (AWS, Supabase)\n• Email service providers\n\nThese third parties have their own privacy policies. We encourage you to review their practices.',
    },
    {
      title: 'Data Retention',
      content: 'We retain your data as follows:\n• Active account data: Retained while account is active\n• Deleted account data: Retained for 30 days after deletion\n• Transaction records: Retained for 7 years (tax/legal requirement)\n• Support tickets: Retained for 2 years\n• Analytics data: Automatically purged after 12 months\n\nYou may request data deletion at any time.',
    },
    {
      title: 'User Rights',
      content: 'You have the right to:\n• Access all your personal data\n• Correct inaccurate information\n• Request deletion of your data\n• Export your data in a readable format\n• Opt-out of marketing communications\n• Withdraw consent at any time\n\nTo exercise these rights, contact legal@restromax.com',
    },
    {
      title: 'Updates to Policy',
      content: 'RestroMax may update this Privacy Policy periodically. We will notify you of significant changes via email or platform notification. Your continued use of the Service constitutes acceptance of the updated policy.\n\nWe recommend reviewing this policy regularly.',
    },
    {
      title: 'Contact',
      content: 'For privacy-related concerns, contact us at:\n\nEmail: privacy@restromax.com\nPrivacy Officer: privacy-team@restromax.com\nAddress: RestroMax Privacy Center\nPhone: +1 (555) 123-4567\n\nResponse time: Within 30 days\n\nLast Updated: April 12, 2026',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-5xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-slate-400 text-lg">
            Last updated: April 12, 2026
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, staggerChildren: 0.1 }}
          className="space-y-4"
        >
          {sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 * index }}
              className="border border-slate-700 rounded-lg bg-slate-800/50 backdrop-blur overflow-hidden hover:border-blue-500/50 transition-colors"
            >
              <button
                onClick={() => setExpandedSection(expandedSection === index ? -1 : index)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
              >
                <h2 className="text-lg font-semibold text-white text-left">
                  {section.title}
                </h2>
                <ChevronDown
                  className={`h-5 w-5 text-blue-400 transition-transform ${
                    expandedSection === index ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSection === index && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 py-4 border-t border-slate-700 bg-slate-900/50"
                >
                  <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                    {section.content}
                  </p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg"
        >
          <p className="text-blue-200">
            <strong>Your Privacy Matters:</strong> RestroMax is committed to protecting your privacy and maintaining transparency about how we handle your data. If you have questions about this policy, please don't hesitate to contact us.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
