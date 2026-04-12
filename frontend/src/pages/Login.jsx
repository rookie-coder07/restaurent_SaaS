import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../context/authStore';
import supabase from '../config/supabase';
import { authAPI } from '../services/apiEndpoints';
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
      { key: 'developer', label: 'Developer', helper: 'Platform control login', isStaff: true },
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
  const setError = useAuthStore((state) => state.setError);
  const baseConfig = PORTAL_CONFIG[portal] || PORTAL_CONFIG.admin;
  const filteredModes = initialModeKey
    ? baseConfig.modes.filter((mode) => mode.key === initialModeKey)
    : baseConfig.modes.filter((mode) => mode.key === 'owner');
  const config = {
    ...baseConfig,
    modes: filteredModes.length > 0 ? filteredModes : baseConfig.modes,
  };
  const effectiveConfig =
    portal === 'admin' && initialModeKey === 'manager'
      ? {
          ...config,
          badge: initialModeKey === 'developer' ? 'Developer Console' : 'Manager Portal',
        }
      : config;

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [selectedModeKey, setSelectedModeKey] = useState(initialModeKey || config.modes[0]?.key || 'owner');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPasswordState, setForgotPasswordState] = useState({
    isLoading: false,
    error: '',
    success: '',
  });
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [submittingReset, setSubmittingReset] = useState(false);

  // Ref to prevent duplicate password reset requests (React Strict Mode + async safety)
  const resetRequestInProgressRef = useRef(false);

  const selectedMode = useMemo(
    () => config.modes.find((mode) => mode.key === selectedModeKey) || config.modes[0],
    [config.modes, selectedModeKey]
  );
  const canResetAdminPassword = portal === 'admin' && !selectedMode?.isStaff && selectedModeKey === 'owner';

  useEffect(() => {
    setSelectedModeKey(initialModeKey || config.modes[0]?.key || 'owner');
  }, [config.modes, initialModeKey, portal]);

  // Countdown timer used to prevent spamming reset links (avoids Supabase email rate limit)
  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = setInterval(() => {
      setForgotCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotCooldown]);

  // Clear auth error when switching modes to show fresh state
  useEffect(() => {
    setError(null);
  }, [selectedModeKey, setError]);

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

    const success = await login(formData.email, formData.password, selectedModeKey, portal);
    if (success) {
      const loggedInRole = getValidPortalSession(portal)?.user?.role;
      if (canAccessPortal(loggedInRole, portal)) {
        navigate(resolvePortalHome(portal, loggedInRole), { replace: true });
      }
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    
    // CRITICAL: Prevent duplicate API calls from React Strict Mode or double-click
    if (resetRequestInProgressRef.current) {
      console.warn('[Forgot Password] Request already in progress, ignoring duplicate call');
      return;
    }
    
    // Guard against rapid re-clicks
    if (forgotCooldown > 0 || submittingReset) {
      console.warn('[Forgot Password] In cooldown or already submitting, ignoring click');
      return;
    }

    const emailToReset = String(forgotEmail || formData.email || '').trim().toLowerCase();
    if (!validateEmail(emailToReset)) {
      console.log('[Forgot Password] Invalid email:', emailToReset);
      setForgotPasswordState({
        isLoading: false,
        error: 'Enter a valid admin email address.',
        success: '',
      });
      return;
    }

    // Set the ref FIRST to block any duplicate calls
    resetRequestInProgressRef.current = true;
    setSubmittingReset(true);
    setForgotPasswordState({
      isLoading: true,
      error: '',
      success: '',
    });

    console.log('[Forgot Password] Initiating password reset request for:', emailToReset);

    // Use environment-based app URL (critical for production compatibility)
    const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
    const redirectTo = `${APP_URL}/reset-password`;
    
    console.log('[Forgot Password] Using redirect URL:', redirectTo);
    
    try {
      const { error, data } = await supabase.auth.resetPasswordForEmail(emailToReset, {
        redirectTo,
      });

      console.log('[Forgot Password] API Response:', { error: error?.message, hasData: !!data });

      if (error) {
        const message = error.message || 'Unable to send reset link right now.';
        const status = error.status || 0;
        
        // Detect specific error types
        const isRateLimit = message.toLowerCase().includes('rate limit') || status === 429;
        const isSmtpError = status === 500 || message.toLowerCase().includes('smtp') || message.toLowerCase().includes('email service');
        
        if (isRateLimit) {
          console.warn('[Forgot Password] Rate limit detected, setting 60s cooldown');
          setForgotCooldown(60);
        }

        if (isSmtpError) {
          console.error('[Forgot Password] SMTP/Email service error detected:', {
            status,
            message,
            fullError: error,
          });
        }

        console.error('[Forgot Password] Error:', {
          message,
          status,
          isRateLimit,
          isSmtpError,
          fullError: error,
        });

        setForgotPasswordState({
          isLoading: false,
          error: isRateLimit
            ? '⏱️ Too many reset requests. Please wait 60 seconds before retrying.'
            : isSmtpError
            ? '📧 Email service temporarily unavailable. Please try again in a few moments.'
            : message,
          success: '',
        });
        return;
      }

      console.log('[Forgot Password] Success! Setting 60s cooldown and showing success message');
      setForgotPasswordState({
        isLoading: false,
        error: '',
        success: 'Reset link sent to your email. Check your inbox.',
      });
      
      setForgotCooldown(60);
      setSubmittingReset(false);
    } catch (unexpectedError) {
      console.error('[Forgot Password] Unexpected error:', unexpectedError);
      setForgotPasswordState({
        isLoading: false,
        error: `Something went wrong: ${unexpectedError?.message || 'Unknown error'}`,
        success: '',
      });
      setSubmittingReset(false);
    } finally {
      // IMPORTANT: Clear the ref ONLY after all state updates are complete
      resetRequestInProgressRef.current = false;
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

            {authError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700">{authError}</p>
              </div>
            )}
            {authError ? <Toast type="error" message={authError} /> : null}
            {forgotPasswordState.error ? <Toast type="error" message={forgotPasswordState.error} /> : null}
            {forgotPasswordState.success ? <Toast type="success" message={forgotPasswordState.success} /> : null}

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
                      : selectedModeKey === 'developer'
                        ? 'developer@platform.com'
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

              {canResetAdminPassword || portal === 'pos' ? (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword((current) => !current);
                      setForgotEmail((current) => current || formData.email);
                      setForgotPasswordState({
                        isLoading: false,
                        error: '',
                        success: '',
                      });
                    }}
                    className="text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-80"
                  >
                    Forgot Password?
                  </button>
                </div>
              ) : null}

              <Button type="submit" fullWidth size="lg" disabled={isLoading}>
                {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Logging in...' : `Open ${selectedModeKey === 'manager' ? 'Manager Portal' : selectedModeKey === 'developer' ? 'Developer Console' : config.badge}`}
              </Button>
            </form>

            {canResetAdminPassword && showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="mt-5 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Reset admin password</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Enter your admin email to receive a secure reset link.
                </p>
                
                <div className="mt-4">
                  <Input
                    label="Admin Email"
                    type="email"
                    name="forgot-email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="owner@restaurant.com"
                  />
                </div>
                
                {forgotCooldown > 0 ? (
                  <p className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">
                    You can request another reset link in {forgotCooldown} seconds.
                  </p>
                ) : null}
                
                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:flex-1"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordState({
                        isLoading: false,
                        error: '',
                        success: '',
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:flex-1"
                    disabled={forgotPasswordState.isLoading || submittingReset || forgotCooldown > 0}
                  >
                    {forgotPasswordState.isLoading || submittingReset ? <Loader className="h-4 w-4 animate-spin" /> : null}
                    {forgotPasswordState.isLoading || submittingReset
                      ? 'Sending...'
                      : forgotCooldown > 0
                        ? `Retry in ${forgotCooldown}s`
                        : 'Send Reset Link'}
                  </Button>
                </div>
              </form>
            ) : portal === 'pos' && showForgotPassword ? (
              <div className="mt-5 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Reset your password</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  You can reset your password using OTP sent to your email.
                </p>
                
                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:flex-1"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordState({
                        isLoading: false,
                        error: '',
                        success: '',
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Link to="/pos/reset-password" className="w-full sm:flex-1">
                    <Button type="button" className="w-full">
                      Reset via OTP
                    </Button>
                  </Link>
                </div>
              </div>
            ) : null}

            {portal === 'admin' && selectedModeKey === 'owner' ? (
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
