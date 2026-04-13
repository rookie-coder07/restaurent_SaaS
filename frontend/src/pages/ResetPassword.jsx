import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import supabase from '../config/supabase';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canResendEmail, setCanResendEmail] = useState(false);

  const validationError = useMemo(() => {
    if (!password && !confirmPassword) {
      return '';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter.';
    }

    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number.';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  }, [confirmPassword, password]);

  useEffect(() => {
    let isActive = true;
    let timeoutId = null;

    const verifyRecoverySession = async () => {
      try {
        // First, wait a moment to allow Supabase to parse the URL hash
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 100);
        });

        if (!isActive) return;

        // Get current session (Supabase should have parsed recovery token from URL)
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!isActive) return;

        if (sessionError) {
          console.error('[ResetPassword] Session error:', sessionError);
          setError('Unable to verify session. Please try again.');
          setIsCheckingSession(false);
          return;
        }

        // Check for recovery token in URL hash - Supabase stores it automatically
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const tokenType = hashParams.get('type');
        const refreshToken = hashParams.get('refresh_token');
        
        const hasRecoveryToken = (
          tokenType === 'recovery' ||
          window.location.hash.includes('access_token=') ||
          (accessToken && tokenType === 'recovery')
        );

        const hasActiveSession = !!data?.session;

        console.log('[ResetPassword] Session verification:', {
          hasActiveSession,
          hasRecoveryToken,
          tokenType,
          hasAccessToken: !!accessToken,
          hashLength: window.location.hash.length,
        });

        if (hasActiveSession || hasRecoveryToken) {
          setIsReady(true);
          setError('');
          setIsCheckingSession(false);
        } else {
          console.warn('[ResetPassword] No valid recovery session found');
          setError('This reset link is invalid or has expired. Please request a new one.');
          setCanResendEmail(true);
          setIsCheckingSession(false);
        }
      } catch (err) {
        console.error('[ResetPassword] Verification error:', err);
        if (isActive) {
          setError('An unexpected error occurred. Please try again.');
          setIsCheckingSession(false);
        }
      }
    };

    verifyRecoverySession();

    // Listen for password recovery event from Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) return;

      console.log('[ResetPassword] Auth state changed:', { event, hasSession: !!session });

      if (event === 'PASSWORD_RECOVERY' && session) {
        console.log('[ResetPassword] Recovery event detected with active session');
        setIsReady(true);
        setError('');
        setIsCheckingSession(false);
      }
    });

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, [location]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isReady) {
      setError('This reset link is invalid or has expired.');
      setCanResendEmail(true);
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      console.log('[ResetPassword] Updating password...');
      
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        console.error('[ResetPassword] Update error:', updateError);
        setIsSubmitting(false);
        
        // Check for specific error messages
        let errorMessage = updateError.message || 'Unable to update password. Please try again.';
        if (errorMessage.toLowerCase().includes('weakpassword')) {
          errorMessage = 'Password is too weak. Use at least 8 characters with uppercase letters and numbers.';
        }
        
        setError(errorMessage);
        return;
      }

      console.log('[ResetPassword] Password updated successfully');
      setSuccess('✓ Password updated successfully. Signing out and redirecting to login...');
      setIsSubmitting(false);

      // Wait 2 seconds then redirect
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Sign out the session
      await supabase.auth.signOut().catch(err => {
        console.error('[ResetPassword] Sign out error:', err);
      });
      
      // Determine appropriate login page based on current pathname
      let loginPage = '/admin/login';
      if (location.pathname.includes('/manager')) {
        loginPage = '/manager/login';
      } else if (location.pathname.includes('/developer')) {
        loginPage = '/developer/login';
      } else if (location.pathname.includes('/pos')) {
        loginPage = '/pos/login';
      }
      
      navigate(loginPage, { replace: true });
    } catch (unexpectedError) {
      console.error('[ResetPassword] Unexpected error:', unexpectedError);
      setIsSubmitting(false);
      setError(`An unexpected error occurred: ${unexpectedError?.message || 'Unknown error'}`);
    }
  };

  const handleResendEmail = async () => {
    // Determine appropriate login page based on current pathname
    let loginPage = '/admin/login';
    if (location.pathname.includes('/manager')) {
      loginPage = '/manager/login';
    } else if (location.pathname.includes('/developer')) {
      loginPage = '/developer/login';
    } else if (location.pathname.includes('/pos')) {
      loginPage = '/pos/login';
    }
    
    navigate(loginPage, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <Card className="w-full max-w-xl">
          <div className="mx-auto w-full max-w-md">
            {(() => {
              let backLink = '/';
              let backText = 'Back to Home';
              
              if (location.pathname.includes('/manager')) {
                backLink = '/manager/login';
                backText = 'Back to Manager Login';
              } else if (location.pathname.includes('/developer')) {
                backLink = '/developer/login';
                backText = 'Back to Developer Login';
              } else if (location.pathname.includes('/pos')) {
                backLink = '/pos/login';
                backText = 'Back to Staff Login';
              } else if (location.pathname.includes('/admin')) {
                backLink = '/admin/login';
                backText = 'Back to Admin Login';
              }
              
              return (
                <Link to={backLink} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                  <ArrowLeft className="h-4 w-4" />
                  {backText}
                </Link>
              );
            })()}

            <div className="mb-6">
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
                <ShieldCheck className="h-4 w-4" />
                Secure password reset
              </div>
              <h2 className="mt-4 text-3xl font-bold text-[var(--color-text)]">Reset Password</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Set a new password for your account.
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                  {canResendEmail && !isCheckingSession && (
                    <button
                      type="button"
                      onClick={handleResendEmail}
                      className="mt-2 text-xs font-semibold text-red-700 hover:text-red-900 underline"
                    >
                      Request a new reset link
                    </button>
                  )}
                </div>
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            )}

            {isCheckingSession ? (
              <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-8 text-center">
                <Loader className="mx-auto h-6 w-6 animate-spin text-[var(--color-primary)]" />
                <p className="mt-4 text-sm font-medium text-[var(--color-text)]">Verifying your reset link...</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">This may take a moment</p>
              </div>
            ) : !isReady && error ? (
              <div className="rounded-[1.5rem] border border-orange-200 bg-orange-50 p-6 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-orange-600" />
                <p className="mt-3 text-sm font-medium text-orange-900">Reset link invalid or expired</p>
                <p className="mt-1 text-xs text-orange-800">Reset links expire after 1 hour</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      New Password
                      <span className="text-xs text-[var(--color-text-muted)]"> (min. 8 characters, 1 uppercase, 1 number)</span>
                    </span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="input pr-12"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        disabled={!isReady || isSubmitting}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)]"
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">Confirm Password</span>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="input pr-12"
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        disabled={!isReady || isSubmitting}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)]"
                        disabled={isSubmitting}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                </div>

                {validationError && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-900 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{validationError}</span>
                    </p>
                  </div>
                )}

                <Button type="submit" fullWidth size="lg" disabled={!isReady || isSubmitting || Boolean(validationError)}>
                  {isSubmitting ? <Loader className="h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Updating Password...' : 'Update Password'}
                </Button>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
