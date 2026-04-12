import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function Terms() {
  const [expandedSection, setExpandedSection] = useState(0);

  const sections = [
    {
      title: 'Introduction',
      content: 'These Terms and Conditions ("Terms") govern your use of RestroMax and the associated services. By accessing or using RestroMax, you agree to be bound by these Terms. If you do not agree to any part of these Terms, you may not use the Service.',
    },
    {
      title: 'Use of Service',
      content: 'You agree to use RestroMax only for lawful purposes and in ways that do not infringe upon the rights of others or restrict their use and enjoyment of the Service. Prohibited behavior includes:\n• Harassing or causing distress or inconvenience to any person\n• Disrupting the normal flow of dialogue within our platform\n• Attempting to gain unauthorized access to our systems\n• Transmitting obscene or offensive content\n• Disrupting the normal flow of dialogue within our platform',
    },
    {
      title: 'User Responsibilities',
      content: 'As a user of RestroMax, you are responsible for maintaining the confidentiality of your account information and password. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.',
    },
    {
      title: 'Account Security',
      content: 'RestroMax takes security seriously. You agree to:\n• Create strong, unique passwords\n• Not share your login credentials with others\n• Log out after each session\n• Report suspicious activity immediately\n• Keep your billing information current and accurate',
    },
    {
      title: 'Subscription & Payments',
      content: 'RestroMax operates on a subscription basis. You agree to pay the subscription fees as outlined in your plan. Payments are processed monthly or annually based on your chosen plan. If payment fails, we reserve the right to suspend your account until payment is received.',
    },
    {
      title: 'Data Usage',
      content: 'RestroMax collects, stores, and processes data necessary to provide the Service. Your data is treated with utmost confidentiality. We do not sell or share your data with third parties without explicit consent, except as required by law.',
    },
    {
      title: 'Limitation of Liability',
      content: 'RestroMax is provided "as is" without warranty of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid in the last 12 months.',
    },
    {
      title: 'Termination',
      content: 'RestroMax reserves the right to terminate or suspend your account if you violate these Terms. You may terminate your account at any time by notifying us in writing. Upon termination, your data will be retained for 30 days before permanent deletion.',
    },
    {
      title: 'Changes to Terms',
      content: 'RestroMax may update these Terms from time to time. We will notify you of any significant changes via email or through the platform. Your continued use of the Service constitutes acceptance of the updated Terms.',
    },
    {
      title: 'Contact Information',
      content: 'If you have any questions about these Terms, please contact us at:\n\nEmail: legal@restromax.com\nAddress: RestroMax Support Center\nPhone: +1 (555) 123-4567\n\nLast Updated: April 12, 2026',
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
            Terms & Conditions
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
              className="border border-slate-700 rounded-lg bg-slate-800/50 backdrop-blur overflow-hidden hover:border-amber-500/50 transition-colors"
            >
              <button
                onClick={() => setExpandedSection(expandedSection === index ? -1 : index)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
              >
                <h2 className="text-lg font-semibold text-white text-left">
                  {section.title}
                </h2>
                <ChevronDown
                  className={`h-5 w-5 text-amber-400 transition-transform ${
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
          className="mt-12 p-6 bg-amber-500/10 border border-amber-500/30 rounded-lg"
        >
          <p className="text-amber-200">
            <strong>Important:</strong> By using RestroMax, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree, please do not use our service.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
