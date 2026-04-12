import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getValidPortalSession } from '../../utils/authStorage';
import { useAuthStore } from '../../context/authStore';
import { validateEmail } from '../../utils/validators';
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
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
