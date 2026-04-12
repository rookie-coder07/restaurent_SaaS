import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-700 bg-slate-900/50 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold text-white mb-4">RestroMax</h3>
            <p className="text-slate-400 text-sm">
              Smart Restaurant Management Simplified
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="text-slate-400 hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-slate-400 hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#demo" className="text-slate-400 hover:text-white transition-colors">
                  Demo
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#about" className="text-slate-400 hover:text-white transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#blog" className="text-slate-400 hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="#contact" className="text-slate-400 hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Support</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Mail className="h-4 w-4" />
                <a href="mailto:support@restromax.com" className="hover:text-white transition-colors">
                  support@restromax.com
                </a>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Phone className="h-4 w-4" />
                <a href="tel:+15551234567" className="hover:text-white transition-colors">
                  +1 (555) 123-4567
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-slate-700" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <p className="text-slate-400 text-sm">
            © {currentYear} RestroMax. All rights reserved.
          </p>

          {/* Legal Links */}
          <div className="flex gap-6 text-sm">
            <Link
              to="/terms"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Terms & Conditions
            </Link>
            <Link
              to="/privacy"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <a
              href="mailto:legal@restromax.com"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Legal
            </a>
          </div>
        </div>

        {/* Social Links or Additional Info */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500">
          <span>Secure • Reliable • Fast</span>
          <span>•</span>
          <span>GDPR Compliant</span>
          <span>•</span>
          <span>Enterprise Ready</span>
        </div>
      </div>
    </footer>
  );
}
