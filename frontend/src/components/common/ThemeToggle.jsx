import { GraduationCap, SunMedium } from 'lucide-react';
import useTheme from '../../hooks/useTheme';

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === 'school' ? 'light' : 'school';

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={`inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 p-2.5 text-[var(--color-text)] backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-white/15 ${className}`}
      title={`Switch to ${nextTheme === 'school' ? 'School Theme' : 'Light Theme'}`}
    >
      {theme === 'school' ? <SunMedium className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
    </button>
  );
}
