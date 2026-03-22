import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { validateEmail, validatePhone } from '../utils/validators';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading, error: authError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Restaurant name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!validateEmail(formData.email)) newErrors.email = 'Enter a valid email';
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    else if (!validatePhone(formData.phone)) newErrors.phone = 'Phone must be 10 digits';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const success = await register({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      city: formData.city,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    });

    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center">
        <Card className="w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.16),_transparent_35%),var(--color-surface)]">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.82fr,1.18fr]">
            <div className="flex flex-col justify-between rounded-[1.75rem] bg-[var(--color-surface-muted)] p-5 sm:p-6">
              <div>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>

                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
                  <Sparkles className="h-4 w-4" />
                  Launch your restaurant workspace
                </div>
                <h1 className="mt-5 text-3xl font-bold text-[var(--color-text)] sm:text-4xl">
                  Create a production-ready restaurant SaaS account.
                </h1>
                <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">
                  Set up your dashboard, invite your team, manage kitchen operations, and start QR-based ordering.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-[1.25rem] bg-[var(--color-surface)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Fast setup</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">Owner onboarding</p>
                </div>
                <div className="rounded-[1.25rem] bg-[var(--color-surface)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Built in</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">Kitchen workflows</p>
                </div>
                <div className="rounded-[1.25rem] bg-[var(--color-surface)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Ready</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">Mobile ordering</p>
                </div>
              </div>
            </div>

            <div className="px-1 sm:px-2">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-[var(--color-text)]">Create your account</h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  Tell us a bit about your restaurant to get started.
                </p>
              </div>

              {authError ? <Toast type="error" message={authError} /> : null}

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Input
                      label="Restaurant Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Taj Mahal Restaurant"
                    />
                    {errors.name ? <p className="mt-2 text-sm text-red-500">{errors.name}</p> : null}
                  </div>

                  <div>
                    <Input
                      label="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Bellary"
                    />
                    {errors.city ? <p className="mt-2 text-sm text-red-500">{errors.city}</p> : null}
                  </div>
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
                  <Input
                    label="Phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="9876543210"
                  />
                  {errors.phone ? <p className="mt-2 text-sm text-red-500">{errors.phone}</p> : null}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-[var(--color-text)]">Password</span>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="input pr-12"
                          placeholder="Create a strong password"
                          autoComplete="new-password"
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

                  <div>
                    <Input
                      label="Confirm Password"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                    />
                    {errors.confirmPassword ? (
                      <p className="mt-2 text-sm text-red-500">{errors.confirmPassword}</p>
                    ) : null}
                  </div>
                </div>

                <Button type="submit" fullWidth size="lg" disabled={isLoading}>
                  {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : null}
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-[var(--color-primary)]">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
