import { ArrowRight, Shield, Briefcase, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';

const ACCESS_CARDS = [
  {
    title: 'Admin Login',
    href: '/admin/login',
    icon: Shield,
    helper: 'Owner access',
    actionLabel: 'Open Admin Portal',
  },
  {
    title: 'Manager Login',
    href: '/manager/login',
    icon: Briefcase,
    helper: 'Operations access',
    actionLabel: 'Open Manager Portal',
  },
  {
    title: 'Staff Login',
    href: '/pos/login',
    icon: Users,
    helper: 'Waiter & Cashier access',
    actionLabel: 'Open Staff Portal',
  },
];

export default function HomeAccess() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center">
        <Card className="w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.14),_transparent_35%),var(--color-surface)] p-6 sm:p-8 lg:p-10">
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight text-[var(--color-text)] sm:text-4xl">
              Select Portal
            </h1>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Choose the portal you want to log into.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {ACCESS_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.href}
                  to={card.href}
                  aria-label={`${card.title} - ${card.actionLabel}`}
                  className="group rounded-[1.75rem] border border-[var(--border-color)] bg-[var(--color-surface-muted)] p-6 text-center shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                >
                  <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-card-muted)] text-[var(--color-primary)]">
                    <Icon className="h-6 w-6" />
                  </div>

                  <h2 className="mt-5 text-2xl font-black text-[var(--color-text)]">{card.title}</h2>
                  <p className="mt-2 text-sm font-medium text-[var(--color-text-muted)]">{card.helper}</p>

                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                    {card.actionLabel}
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
