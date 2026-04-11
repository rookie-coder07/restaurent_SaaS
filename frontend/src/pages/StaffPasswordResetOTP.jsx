import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Mail, Key, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { validateEmail } from '../utils/validators';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';

export default function StaffPasswordResetOTP() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // email -> otp -> password -> success
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.post('/v1/auth/request-password-reset-otp', {
        email: formData.email.toLowerCase().trim(),
        role: 'staff',
      });

      setMessage({ type: 'success', text: response.data.message || 'OTP sent to your email' });
      setStep('otp');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to send OTP. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.otp) {
      newErrors.otp = 'OTP is required';
    } else if (formData.otp.length !== 6 || !/^\d+$/.test(formData.otp)) {
      newErrors.otp = 'OTP must be 6 digits';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.post('/v1/auth/verify-otp', {
        email: formData.email.toLowerCase().trim(),
        otp: formData.otp,
      });

      setMessage({ type: 'success', text: response.data.message || 'OTP verified' });
      setStep('password');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Invalid OTP. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.post('/v1/auth/set-password-with-otp', {
        email: formData.email.toLowerCase().trim(),
        newPassword: formData.newPassword,
      });

      setMessage({ type: 'success', text: response.data.message || 'Password reset successfully' });
      setStep('success');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to reset password. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackClick = () => {
    if (step === 'email') {
      navigate('/pos/login');
    } else if (step === 'otp') {
      setStep('email');
      setFormData({ ...formData, otp: '' });
      setErrors({});
      setMessage({ type: '', text: '' });
    } else if (step === 'password') {
      setStep('otp');
      setFormData({ ...formData, newPassword: '', confirmPassword: '' });
      setErrors({});
      setMessage({ type: '', text: '' });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <Card className="w-full max-w-xl">
          <div className="mx-auto w-full max-w-md">
            <button
              onClick={handleBackClick}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 'email' ? 'Back to Login' : 'Back'}
            </button>

            <div className="mb-6">
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
                <ShieldCheck className="h-4 w-4" />
                {step === 'success' ? 'Password Reset' : 'Secure Reset'}
              </div>

              <h2 className="mt-4 text-3xl font-bold text-[var(--color-text)]">
                {step === 'email' && 'Reset Your Password'}
                {step === 'otp' && 'Verify Your Email'}
                {step === 'password' && 'Create New Password'}
                {step === 'success' && 'Password Reset Successful'}
              </h2>

              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {step === 'email' && 'Enter your email address to get started'}
                {step === 'otp' && 'We sent a 6-digit code to your email'}
                {step === 'password' && 'Create a strong new password'}
                {step === 'success' && 'You can now login with your new password'}
              </p>
            </div>

            {message.text && <Toast type={message.type} message={message.text} />}

            {/* STEP 1: Email */}
            {step === 'email' && (
              <form onSubmit={handleRequestOTP} className="mt-6 space-y-5">
                <div>
                  <Input
                    label="Work Email"
                    type="email"
                    icon={Mail}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setErrors({ ...errors, email: '' });
                    }}
                    placeholder="staff@restaurant.com"
                    disabled={isLoading}
                  />
                  {errors.email && <p className="mt-2 text-sm text-red-500">{errors.email}</p>}
                </div>

                <Button
                  type="submit"
                  fullWidth
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  Send OTP Code
                </Button>
              </form>
            )}

            {/* STEP 2: OTP Verification */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="mt-6 space-y-5">
                <div className="rounded-lg bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-text-muted)]">
                  We sent a 6-digit code to <strong>{formData.email}</strong>. Check your spam folder if you don't see it.
                </div>

                <div>
                  <Input
                    label="6-Digit OTP Code"
                    type="text"
                    icon={Key}
                    value={formData.otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setFormData({ ...formData, otp: value });
                      setErrors({ ...errors, otp: '' });
                    }}
                    placeholder="000000"
                    maxLength="6"
                    disabled={isLoading}
                  />
                  {errors.otp && <p className="mt-2 text-sm text-red-500">{errors.otp}</p>}
                </div>

                <Button
                  type="submit"
                  fullWidth
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  Verify OTP
                </Button>
              </form>
            )}

            {/* STEP 3: New Password */}
            {step === 'password' && (
              <form onSubmit={handleSetPassword} className="mt-6 space-y-5">
                <div>
                  <Input
                    label="New Password"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => {
                      setFormData({ ...formData, newPassword: e.target.value });
                      setErrors({ ...errors, newPassword: '' });
                    }}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  {errors.newPassword && <p className="mt-2 text-sm text-red-500">{errors.newPassword}</p>}
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    • Minimum 8 characters • Mix of uppercase and lowercase • Include numbers and symbols
                  </p>
                </div>

                <div>
                  <Input
                    label="Confirm Password"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => {
                      setFormData({ ...formData, confirmPassword: e.target.value });
                      setErrors({ ...errors, confirmPassword: '' });
                    }}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  {errors.confirmPassword && (
                    <p className="mt-2 text-sm text-red-500">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  fullWidth
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  Reset Password
                </Button>
              </form>
            )}

            {/* STEP 4: Success */}
            {step === 'success' && (
              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-green-100 p-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <p className="text-sm font-semibold text-green-900">Password Reset Successful!</p>
                  <p className="mt-1 text-sm text-green-700">You can now log in with your new password.</p>
                </div>

                <Button
                  onClick={() => navigate('/pos/login')}
                  fullWidth
                >
                  Back to Login
                </Button>
              </div>
            )}

            <div className="mt-8 border-t border-[var(--color-border)] pt-6 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                Remember your password?{' '}
                <Link to="/login/pos" className="font-semibold text-[var(--color-primary)] hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
