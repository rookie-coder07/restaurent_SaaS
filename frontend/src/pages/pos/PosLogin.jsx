import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getValidPortalSession } from '../../utils/authStorage';
import { useAuthStore } from '../../context/authStore';
import { validateEmail } from '../../utils/validators';
import supabase from '../../config/supabase';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';

export default function PosLogin() {
  const navigate = useNavigate();
  const { login, isLoading: authLoading } = useAuth();
  const authError = useAuthStore((state) => state.error);
  const activePortal = useAuthStore((state) => state.activePortal);
  const setError = useAuthStore((state) => state.setError);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPasswordState, setForgotPasswordState] = useState({
    isLoading: false,
    error: '',
    success: '',
  });
  const [submittingReset, setSubmittingReset] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const resetRequestInProgressRef = useRef(false);

  // Sync auth store error to display
  useEffect(() => {
    if (authError) {
      setErrors((prev) => ({ ...prev, auth: authError }));
    }
  }, [authError]);

  // Clear error when toggling forgot password
  useEffect(() => {
    setError(null);
  }, [showForgotPassword, setError]);

  // Handle cooldown timer
  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = setTimeout(() => setForgotCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [forgotCooldown]);

  // After successful login, monitor activePortal to confirm transition
  useEffect(() => {
    if (activePortal === 'pos' && getValidPortalSession('pos')) {
      // Verify session and navigate
      navigate('/pos', { replace: true });
    }
  }, [activePortal, navigate]);

  const validateForm = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!validateEmail(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const success = await login(email, password, 'staff', 'pos');
    if (success) {
      // ActivePortal effect above will trigger navigation
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();

    // CRITICAL: Prevent duplicate API calls
    if (resetRequestInProgressRef.current) {
      console.warn('[POS Forgot Password] Request already in progress, ignoring duplicate call');
      return;
    }

    // Guard against rapid re-clicks
    if (forgotCooldown > 0 || submittingReset) {
      console.warn('[POS Forgot Password] In cooldown or already submitting, ignoring click');
      return;
    }

    const emailToReset = String(forgotEmail || '').trim().toLowerCase();
    if (!validateEmail(emailToReset)) {
      console.log('[POS Forgot Password] Invalid email:', emailToReset);
      setForgotPasswordState({
        isLoading: false,
        error: 'Enter a valid staff email address.',
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

    console.log('[POS Forgot Password] Initiating password reset request for:', emailToReset);

    // Use environment-based app URL
    const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
    const redirectTo = `${APP_URL}/reset-password`;

    console.log('[POS Forgot Password] Using redirect URL:', redirectTo);

    try {
      const { error, data } = await supabase.auth.resetPasswordForEmail(emailToReset, {
        redirectTo,
      });

      console.log('[POS Forgot Password] API Response:', { error: error?.message, hasData: !!data });

      if (error) {
        const message = error.message || 'Unable to send reset link right now.';
        const status = error.status || 0;

        const isRateLimit = message.toLowerCase().includes('rate limit') || status === 429;
        const isSmtpError = status === 500 || message.toLowerCase().includes('smtp') || message.toLowerCase().includes('email service');

        if (isRateLimit) {
          console.warn('[POS Forgot Password] Rate limit detected, setting 60s cooldown');
          setForgotCooldown(60);
        }

        if (isSmtpError) {
          console.error('[POS Forgot Password] SMTP/Email service error detected:', {
            status,
            message,
            fullError: error,
          });
        }

        console.error('[POS Forgot Password] Error:', {
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

      console.log('[POS Forgot Password] Success! Setting 60s cooldown and showing success message');
      setForgotPasswordState({
        isLoading: false,
        error: '',
        success: 'Reset link sent to your email. Check your inbox.',
      });

      setForgotCooldown(60);
      setSubmittingReset(false);
    } catch (unexpectedError) {
      console.error('[POS Forgot Password] Unexpected error:', unexpectedError);
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
            {/* Back to Home */}
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>

            {/* Welcome Section */}
            <div className="mb-6">
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
                <ShieldCheck className="h-4 w-4" />
                Staff Access
              </div>
              <h2 className="mt-4 text-3xl font-bold text-[var(--color-text)]">Welcome back</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Sign in to the POS system to continue.
              </p>
            </div>

            {/* Error Messages */}
            {authError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700">{authError}</p>
              </div>
            )}
            {authError ? <Toast type="error" message={authError} /> : null}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <Input
                  label="Email"
                  type="email"
                  name="username"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@restaurant.com"
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

              {/* Forgot Password Button */}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword((current) => !current);
                  }}
                  className="text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-80"
                >
                  Forgot Password?
                </button>
              </div>

              <Button type="submit" fullWidth size="lg" disabled={authLoading}>
                {authLoading ? <Loader className="h-4 w-4 animate-spin" /> : null}
                {authLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            {/* Forgot Password Modal */}
            {showForgotPassword && (
              <div className="mt-5 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">Reset your password</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    Enter your email to receive a password reset link.
                  </p>
                </div>

                {forgotPasswordState.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-700">{forgotPasswordState.error}</p>
                  </div>
                )}

                {forgotPasswordState.success && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-sm font-medium text-green-700">{forgotPasswordState.success}</p>
                  </div>
                )}

                {!forgotPasswordState.success ? (
                  <form onSubmit={handleForgotPassword} className="space-y-3">
                    <Input
                      label="Email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="staff@restaurant.com"
                      disabled={forgotPasswordState.isLoading || forgotCooldown > 0}
                    />

                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:flex-1"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotEmail('');
                          setForgotPasswordState({ isLoading: false, error: '', success: '' });
                        }}
                        disabled={forgotPasswordState.isLoading || forgotCooldown > 0}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="w-full sm:flex-1"
                        disabled={forgotPasswordState.isLoading || forgotCooldown > 0 || !forgotEmail.trim()}
                      >
                        {forgotPasswordState.isLoading ? <Loader className="h-4 w-4 animate-spin" /> : null}
                        {forgotPasswordState.isLoading
                          ? 'Sending...'
                          : forgotCooldown > 0
                          ? `Wait ${forgotCooldown}s`
                          : 'Send Reset Link'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:flex-1"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setForgotEmail('');
                        setForgotPasswordState({ isLoading: false, error: '', success: '' });
                      }}
                    >
                      Close
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
