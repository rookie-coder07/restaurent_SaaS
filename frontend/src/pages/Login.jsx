import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { validateEmail } from '../utils/validators';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error: authError } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

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

    const success = await login(formData.email, formData.password, isStaff);
    if (success) {
      navigate(isStaff ? '/kitchen' : '/');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <Card className="flex flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.18),_transparent_35%),var(--color-surface)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
              <Sparkles className="h-4 w-4" />
              Restaurant SaaS
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[var(--color-text)] sm:text-5xl">
              Run service, kitchen, and tables from one dashboard.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--color-text-muted)]">
              A mobile-friendly operating system for restaurants with live kitchen workflows, QR ordering, analytics,
              and staff management.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Kitchen</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">Real-time queue</p>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Ordering</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">QR-first flow</p>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Analytics</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">Daily revenue</p>
            </div>
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
                Choose your role and sign in to continue managing your restaurant.
              </p>
            </div>

            {authError ? <Toast type="error" message={authError} /> : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 rounded-[1.5rem] bg-[var(--color-surface-muted)] p-2">
                <button
                  type="button"
                  onClick={() => setIsStaff(false)}
                  className={`rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                    !isStaff
                      ? 'bg-[var(--color-primary)] text-white shadow-[0_14px_30px_rgba(79,70,229,0.2)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  Owner / Manager
                </button>
                <button
                  type="button"
                  onClick={() => setIsStaff(true)}
                  className={`rounded-[1rem] px-4 py-3 text-sm font-semibold transition ${
                    isStaff
                      ? 'bg-[var(--color-primary)] text-white shadow-[0_14px_30px_rgba(79,70,229,0.2)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  Kitchen / Staff
                </button>
              </div>

              <div>
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="owner@restaurant.com"
                />
                {errors.email ? <p className="mt-2 text-sm text-red-500">{errors.email}</p> : null}
              </div>

              <div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
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
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            <div className="mt-6 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">New to the platform?</p>
              <Link to="/register" className="mt-2 inline-flex text-sm font-semibold text-[var(--color-primary)]">
                Create restaurant account
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
