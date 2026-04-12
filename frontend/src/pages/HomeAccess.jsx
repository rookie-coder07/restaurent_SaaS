import { BarChart3, Briefcase, ChefHat, CreditCard, Shield, Users } from 'lucide-react';
import Hero from '../components/Hero';
import Footer from '../components/common/Footer';

const ACCESS_CARDS = [
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

const FEATURE_LIST = [
  {
    icon: ChefHat,
    title: 'Kitchen Coordination',
    description: 'Track incoming tickets, prep flow, and service timing in one place.',
  },
  {
    icon: CreditCard,
    title: 'Billing Control',
    description: 'Move from order to invoice faster with cleaner billing operations.',
  },
  {
    icon: BarChart3,
    title: 'Operational Visibility',
    description: 'Monitor staff, tables, and daily performance without switching tools.',
  },
];

export default function HomeAccess() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Hero portalCards={ACCESS_CARDS} />

      <section
        id="home-features"
        className="border-t border-white/8 bg-[linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(8,17,31,1)_100%)] px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-200">Platform Highlights</p>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              Built for fast teams and cleaner floor operations
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              One focused landing page, one login entry point, and a product experience centered on restaurant speed.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {FEATURE_LIST.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/12 text-amber-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
