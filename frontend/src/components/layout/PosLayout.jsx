import { LayoutGrid, ListOrdered, Receipt, TableProperties } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import PortalLogoutButton from '../common/PortalLogoutButton';
import ThemeToggle from '../common/ThemeToggle';

const POS_NAV_ITEMS = [
  {
    href: '/pos',
    label: 'Billing',
    icon: Receipt,
  },
  {
    href: '/pos/orders',
    label: 'Orders',
    icon: ListOrdered,
  },
  {
    href: '/pos/tables',
    label: 'Tables',
    icon: TableProperties,
  },
];

export default function PosLayout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] shadow-[var(--shadow-card)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-lg">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-secondary)]">
                POS Portal
              </p>
              <h1 className="text-xl font-black text-[var(--text-primary)] sm:text-2xl">Billing & Floor Operations</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Quick access for waiters and cashiers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap items-center gap-2">
              {POS_NAV_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.href === '/pos'}
                    className={({ isActive }) =>
                      `inline-flex min-h-[3rem] items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-card-muted)]'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <PortalLogoutButton portal="pos" />

            <ThemeToggle className="min-h-[3rem] min-w-[3rem]" />
          </div>
        </div>
      </header>

      <main className="overflow-x-hidden">
        <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
