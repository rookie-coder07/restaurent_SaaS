import { MoonStar, SunMedium } from 'lucide-react';
import useTheme from '../../hooks/useTheme';

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === 'midnight' ? 'light' : 'midnight';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={`inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[linear-gradient(135deg,var(--bg-card-muted),var(--bg-card))] p-2.5 text-[var(--text-primary)] backdrop-blur-md transition-all hover:scale-[1.02] hover:brightness-105 ${className}`}
      title={`Switch to ${nextTheme === 'midnight' ? 'Midnight' : 'Light Theme'}`}
    >
      {theme === 'midnight' ? <SunMedium className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
    </button>
  );
}
