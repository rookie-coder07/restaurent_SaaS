import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../context/authStore';
import { validateEmail } from '../utils/validators';
import { canAccessPortal, resolvePortalHome } from '../utils/portalRouting';
import { clearPortalSession, getValidPortalSession } from '../utils/authStorage';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';

const PORTAL_CONFIG = {
  admin: {
    badge: 'Admin Portal',
    modes: [
      { key: 'owner', label: 'Owner', helper: 'Restaurant account login', isStaff: false },
      { key: 'manager', label: 'Manager', helper: 'Operations account login', isStaff: true },
    ],
  },
  pos: {
    badge: 'POS Portal',
    modes: [
      { key: 'staff', label: 'Waiter / Cashier', helper: 'Staff account login', isStaff: true },
    ],
  },
};

export default function Login({ portal = 'admin', initialModeKey = '' }) {
  const navigate = useNavigate();
  const { login, isLoading, error: authError } = useAuth();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const baseConfig = PORTAL_CONFIG[portal] || PORTAL_CONFIG.admin;
  const filteredModes = initialModeKey
    ? baseConfig.modes.filter((mode) => mode.key === initialModeKey)
    : baseConfig.modes.filter((mode) => mode.key !== 'manager');
  const config = {
    ...baseConfig,
    modes: filteredModes.length > 0 ? filteredModes : baseConfig.modes,
  };
  const effectiveConfig =
    portal === 'admin' && initialModeKey === 'manager'
      ? {
          ...config,
          badge: 'Manager Portal',
        }
      : config;

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [selectedModeKey, setSelectedModeKey] = useState(initialModeKey || config.modes[0]?.key || 'owner');

  const selectedMode = useMemo(
    () => config.modes.find((mode) => mode.key === selectedModeKey) || config.modes[0],
    [config.modes, selectedModeKey]
  );

  useEffect(() => {
    setSelectedModeKey(initialModeKey || config.modes[0]?.key || 'owner');
  }, [config.modes, initialModeKey, portal]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const portalSession = getValidPortalSession(portal);
    if (portalSession) {
      const portalUser = portalSession.user;
      if (canAccessPortal(portalUser?.role, portal)) {
        navigate(resolvePortalHome(portal, portalUser?.role), { replace: true });
        return;
      }

      clearPortalSession(portal);
    }
  }, [isHydrated, navigate, portal]);

  if (!isHydrated) {
    return null;
  }

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
      const loggedInRole = getValidPortalSession(portal)?.user?.role;
      if (canAccessPortal(loggedInRole, portal)) {
        navigate(resolvePortalHome(portal, loggedInRole), { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <Card className="w-full max-w-xl">
          <div className="mx-auto w-full max-w-md">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>

            <div className="mb-6">
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
                <ShieldCheck className="h-4 w-4" />
                Secure login
              </div>
              <h2 className="mt-4 text-3xl font-bold text-[var(--color-text)]">Welcome back</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Sign in to continue inside the {effectiveConfig.badge.toLowerCase()}.
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
                  placeholder={
                    selectedModeKey === 'manager'
                      ? 'manager@restaurant.com'
                      : selectedMode?.isStaff
                        ? 'staff@restaurant.com'
                        : 'owner@restaurant.com'
                  }
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
                {isLoading ? 'Logging in...' : `Open ${selectedModeKey === 'manager' ? 'Manager Portal' : config.badge}`}
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
