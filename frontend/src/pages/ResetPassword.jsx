import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader, ShieldCheck } from 'lucide-react';
import supabase from '../config/supabase';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validationError = useMemo(() => {
    if (!password && !confirmPassword) {
      return '';
    }

    if (password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  }, [confirmPassword, password]);

  useEffect(() => {
    let isActive = true;

    const verifyRecoverySession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message || 'This reset link is invalid or has expired.');
        setIsCheckingSession(false);
        return;
      }

      const hasRecoveryTokens =
        window.location.hash.includes('access_token=') ||
        window.location.hash.includes('refresh_token=') ||
        window.location.search.includes('type=recovery');

      if (data.session || hasRecoveryTokens) {
        setIsReady(true);
      } else {
        setError('This reset link is invalid or has expired.');
      }

      setIsCheckingSession(false);
    };

    verifyRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY' || session) {
        setIsReady(true);
        setError('');
        setIsCheckingSession(false);
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isReady) {
      setError('This reset link is invalid or has expired.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setIsSubmitting(false);
      setError(updateError.message || 'Unable to update password.');
      return;
    }

    setSuccess('Password updated successfully. Redirecting to admin login...');
    setIsSubmitting(false);

    window.setTimeout(async () => {
      await supabase.auth.signOut().catch(() => {});
      navigate('/admin/login', { replace: true });
    }, 1400);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <Card className="w-full max-w-xl">
          <div className="mx-auto w-full max-w-md">
            <Link to="/admin/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Login
            </Link>

            <div className="mb-6">
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
                <ShieldCheck className="h-4 w-4" />
                Password recovery
              </div>
              <h2 className="mt-4 text-3xl font-bold text-[var(--color-text)]">Reset Password</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Set a new password for your admin account.
              </p>
            </div>

            {error ? <Toast type="error" message={error} /> : null}
            {success ? <Toast type="success" message={success} /> : null}

            {isCheckingSession ? (
              <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6 text-center">
                <Loader className="mx-auto h-5 w-5 animate-spin text-[var(--color-primary)]" />
                <p className="mt-3 text-sm font-medium text-[var(--color-text-muted)]">Verifying reset link...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">New Password</span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="input pr-12"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        disabled={!isReady || isSubmitting}
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
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)]"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                </div>

                {validationError ? <p className="text-sm text-red-500">{validationError}</p> : null}

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
