import { ArrowRight, LayoutGrid, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';

const ACCESS_CARDS = [
  {
    title: 'Admin Login',
    description: 'For owners handling menu, staff, orders, analytics, and settings.',
    href: '/admin/login',
    icon: ShieldCheck,
    badge: 'Admin',
  },
  {
    title: 'Staff Login',
    description: 'For POS and KOT teams. Choose your work area first, then log in to the correct portal.',
    href: '/staff/login',
    icon: LayoutGrid,
    badge: 'Staff',
  },
];

export default function HomeAccess() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <Card className="w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.16),_transparent_35%),var(--color-surface)] p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center rounded-full bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]">
              Restaurant SaaS
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-[var(--color-text)] sm:text-5xl">
              Choose how you want to enter the system
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--color-text-muted)]">
              Keep business control, billing, and kitchen execution clean by sending every role to the right login flow.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {ACCESS_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.href}
                  to={card.href}
                  className="group rounded-[2rem] border border-[var(--border-color)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-card-muted)] text-[var(--color-primary)]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">
                      {card.badge}
                    </span>
                  </div>

                  <h2 className="mt-8 text-3xl font-black text-[var(--color-text)]">{card.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">{card.description}</p>

                  <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                    Continue
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
