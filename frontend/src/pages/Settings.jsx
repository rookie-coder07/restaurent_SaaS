import { Check, MoonStar, Palette, School, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const themeIcons = {
  default: Sparkles,
  school: School,
  dark: MoonStar,
};

export default function Settings() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.15),_transparent_40%),var(--color-surface)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-text-subtle)]">Appearance</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)] sm:text-4xl">Theme settings</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
              Choose a professional SaaS look for your workspace. Your choice is saved locally and applied instantly.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm font-medium text-[var(--color-text-muted)]">
            <Palette className="h-4 w-4" />
            Current theme: <span className="font-semibold text-[var(--color-text)]">{theme}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {themes.map((option) => {
          const Icon = themeIcons[option.id] || Palette;
          const active = theme === option.id;

          return (
            <Card
              key={option.id}
              className={`transition-all duration-200 ${active ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-soft)]' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                {active ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-4 w-4" />
                  </div>
                ) : null}
              </div>

              <h2 className="mt-5 text-xl font-bold text-[var(--color-text)]">{option.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{option.description}</p>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <div
                  className={`h-16 rounded-2xl ${
                    option.id === 'default'
                      ? 'bg-[#ffffff]'
                      : option.id === 'school'
                        ? 'bg-[#f1f5f9]'
                        : 'bg-[#0f172a]'
                  }`}
                />
                <div
                  className={`h-16 rounded-2xl ${
                    option.id === 'default'
                      ? 'bg-[#4f46e5]'
                      : option.id === 'school'
                        ? 'bg-[#2563eb]'
                        : 'bg-[#1e293b]'
                  }`}
                />
                <div
                  className={`h-16 rounded-2xl ${
                    option.id === 'default'
                      ? 'bg-[#111827]'
                      : option.id === 'school'
                        ? 'bg-[#0f172a]'
                        : 'bg-[#e5e7eb]'
                  }`}
                />
              </div>

              <Button
                variant={active ? 'secondary' : 'primary'}
                className="mt-6 w-full"
                onClick={() => setTheme(option.id)}
              >
                {active ? 'Active theme' : `Switch to ${option.label}`}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
