import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { validateEmail } from '../utils/validators';
import { canAccessPortal, PORTAL_HOME } from '../utils/portalRouting';
import { clearPortalSession, hasPortalSession, readPortalSession } from '../utils/authStorage';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';

const PORTAL_CONFIG = {
  admin: {
    badge: 'Admin Portal',
    title: 'Control business, menu, and reporting.',
    description:
      'For owners handling business setup, menu control, staff, orders, analytics, and settings.',
    featureCards: [
      { label: 'Control', value: 'Business overview' },
      { label: 'Menu', value: 'Item management' },
      { label: 'Insights', value: 'Sales analytics' },
    ],
    modes: [
      { key: 'owner', label: 'Owner', helper: 'Restaurant account login', isStaff: false },
    ],
  },
  pos: {
    badge: 'POS Portal',
    title: 'Fast billing for waiters and cashiers.',
    description:
      'For table selection, order taking, cart review, and quick billing during service.',
    featureCards: [
      { label: 'Tables', value: 'Live floor view' },
      { label: 'Billing', value: 'Quick order flow' },
      { label: 'Service', value: 'Dine-in & takeaway' },
    ],
    modes: [
      { key: 'staff', label: 'Waiter / Cashier', helper: 'Staff account login', isStaff: true },
    ],
  },
  kot: {
    badge: 'KOT Portal',
    title: 'Kitchen execution with zero distractions.',
    description:
      'For kitchen staff managing active tickets, ready queue, and preparation flow on the display screen.',
    featureCards: [
      { label: 'Queue', value: 'Active tickets only' },
      { label: 'Prep', value: 'One-tap status updates' },
      { label: 'Speed', value: 'Full-screen workflow' },
    ],
    modes: [
      { key: 'kitchen_staff', label: 'Kitchen Staff', helper: 'Kitchen-only login', isStaff: true },
    ],
  },
};

export default function Login({ portal = 'admin' }) {
  const navigate = useNavigate();
  const { login, isLoading, error: authError } = useAuth();
  const config = PORTAL_CONFIG[portal] || PORTAL_CONFIG.admin;

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [selectedModeKey, setSelectedModeKey] = useState(config.modes[0]?.key || 'owner');

  const selectedMode = useMemo(
    () => config.modes.find((mode) => mode.key === selectedModeKey) || config.modes[0],
    [config.modes, selectedModeKey]
  );

  useEffect(() => {
    setSelectedModeKey(config.modes[0]?.key || 'owner');
  }, [config.modes, portal]);

  useEffect(() => {
    if (hasPortalSession(portal)) {
      const portalUser = readPortalSession(portal)?.user;
      if (canAccessPortal(portalUser?.role, portal)) {
        navigate(PORTAL_HOME[portal], { replace: true });
        return;
      }

      clearPortalSession(portal);
    }
  }, [navigate, portal]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!validateEmail(formData.email)) newErrors.email = 'Enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const success = await login(formData.email, formData.password, selectedMode?.isStaff, portal);
    if (success) {
      const loggedInRole = readPortalSession(portal)?.user?.role;
      if (canAccessPortal(loggedInRole, portal)) {
        navigate(PORTAL_HOME[portal], { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <Card className="flex flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.18),_transparent_35%),var(--color-surface)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
              <Sparkles className="h-4 w-4" />
              {config.badge}
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[var(--color-text)] sm:text-5xl">
              {config.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--color-text-muted)]">
              {config.description}
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {config.featureCards.map((card) => (
              <div key={card.label} className="rounded-[1.5rem] bg-[var(--color-surface-muted)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">{card.label}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{card.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col justify-center">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
                <ShieldCheck className="h-4 w-4" />
                Secure login
              </div>
              <h2 className="mt-4 text-3xl font-bold text-[var(--color-text)]">Welcome back</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Sign in to continue inside the {config.badge.toLowerCase()}.
              </p>
            </div>

            {authError ? <Toast type="error" message={authError} /> : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {config.modes.length > 1 ? (
                <div className={`grid gap-3 rounded-[1.5rem] bg-[var(--color-surface-muted)] p-2 ${config.modes.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {config.modes.map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setSelectedModeKey(mode.key)}
                      className={`rounded-[1rem] px-4 py-3 text-left text-sm font-semibold transition ${
                        selectedModeKey === mode.key
                          ? 'bg-[var(--color-primary)] text-white shadow-[0_14px_30px_rgba(79,70,229,0.2)]'
                          : 'text-[var(--color-text-muted)]'
                      }`}
                    >
                      <span className="block">{mode.label}</span>
                      <span className={`mt-1 block text-xs ${selectedModeKey === mode.key ? 'text-white/80' : 'text-[var(--color-text-subtle)]'}`}>
                        {mode.helper}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div>
                <Input
                  label="Email"
                  type="email"
                  name="username"
                  autoComplete="username"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={selectedMode?.isStaff ? 'staff@restaurant.com' : 'owner@restaurant.com'}
                />
                {errors.email ? <p className="mt-2 text-sm text-red-500">{errors.email}</p> : null}
              </div>

              <div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input pr-12"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                {errors.password ? <p className="mt-2 text-sm text-red-500">{errors.password}</p> : null}
              </div>

              <Button type="submit" fullWidth size="lg" disabled={isLoading}>
                {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Logging in...' : `Open ${config.badge}`}
              </Button>
            </form>

            {portal === 'admin' ? (
              <div className="mt-6 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">New to the platform?</p>
                <Link to="/register" className="mt-2 inline-flex text-sm font-semibold text-[var(--color-primary)]">
                  Create restaurant account
                </Link>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
