import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BarChart3, Briefcase, Shield, Users, Zap, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';

const DEFAULT_PORTAL_CARDS = [
  {
    title: 'Admin Login',
    href: '/admin/login',
    icon: Shield,
    helper: 'Owner access',
  },
  {
    title: 'Manager Login',
    href: '/manager/login',
    icon: Briefcase,
    helper: 'Operations access',
  },
  {
    title: 'POS Login',
    href: '/pos/login',
    icon: Users,
    helper: 'Waiter & cashier access',
  },
];

const FEATURE_PILLS = [
  { icon: Zap, label: 'Fast order flow' },
  { icon: Clock3, label: 'Real-time kitchen sync' },
  { icon: BarChart3, label: 'Live billing insights' },
];

export default function Hero({ portalCards = DEFAULT_PORTAL_CARDS }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative isolate min-h-screen overflow-hidden bg-[#08111f]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_30%),linear-gradient(135deg,#020617_0%,#0b1220_52%,#111827_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:68px_68px]" />

      <motion.div
        aria-hidden="true"
        className="absolute left-[8%] top-[16%] h-28 w-28 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md"
        animate={reduceMotion ? undefined : { y: [0, -12, 0], rotate: [0, 2, 0] }}
        transition={reduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute bottom-[14%] right-[10%] h-24 w-24 rounded-full border border-amber-300/15 bg-amber-300/10 backdrop-blur-md"
        animate={reduceMotion ? undefined : { y: [0, 10, 0], x: [0, -8, 0] }}
        transition={reduceMotion ? undefined : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute right-[28%] top-[22%] h-16 w-40 rounded-full border border-sky-300/15 bg-sky-300/10 backdrop-blur-sm"
        animate={reduceMotion ? undefined : { x: [0, 10, 0] }}
        transition={reduceMotion ? undefined : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_420px] lg:gap-12">
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-200 backdrop-blur-md">
              Restaurant OS
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight text-white sm:text-6xl xl:text-7xl">
              <span className="bg-gradient-to-r from-white via-amber-100 to-orange-200 bg-clip-text text-transparent">
                RestroMax
              </span>
            </h1>

            <p className="mt-4 text-2xl font-bold text-slate-200 sm:text-3xl">
              Smart Restaurant Management Simplified
            </p>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg lg:mx-0">
              Manage orders, staff, billing, and kitchen operations in real-time
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              {FEATURE_PILLS.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.label}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 backdrop-blur-md"
                  >
                    <Icon className="h-4 w-4 text-amber-300" />
                    <span>{feature.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              <a
                href="#home-features"
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/12 bg-white/6 px-6 text-base font-semibold text-white backdrop-blur-md transition hover:border-white/25 hover:bg-white/10"
              >
                Explore Platform
              </a>
            </div>
          </motion.div>

          <motion.aside
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
            className="w-full"
          >
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/90">Portal Access</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Login</h2>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Ready
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {portalCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <Link
                      key={card.href}
                      to={card.href}
                      className="group flex min-h-14 w-full items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-amber-300/35 hover:bg-white/10"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/12 text-amber-200">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-white">{card.title}</div>
                        <div className="text-sm text-slate-400">{card.helper}</div>
                      </div>

                      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-amber-200" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}
