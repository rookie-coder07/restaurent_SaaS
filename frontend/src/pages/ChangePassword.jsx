import { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Toast from '../components/common/Toast';
import { authAPI } from '../services/apiEndpoints';

export default function ChangePassword() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from current password');
      return;
    }

    try {
      setLoading(true);
      await authAPI.changePassword(formData);
      
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setSuccess('Password changed successfully! You can use your new password on next login.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Change Password</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Update your account password securely. You'll need to log in again with your new password.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <Toast type="error" message={error} />
          </div>
        )}

        {success && (
          <div className="mb-6">
            <Toast type="success" message={success} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              Current Password
            </label>
            <input
              type="password"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              placeholder="Enter your current password"
              disabled={loading}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:bg-[var(--bg-panel-muted)]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              New Password
            </label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder="Enter your new password (minimum 6 characters)"
              disabled={loading}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:bg-[var(--bg-panel-muted)]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your new password"
              disabled={loading}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:bg-[var(--bg-panel-muted)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
              className="min-w-[200px]"
            >
              {loading ? 'Updating...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/10 p-4 md:p-6">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Security Tips</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              <li>• Use a strong password with uppercase, lowercase, numbers, and symbols</li>
              <li>• Never share your password with anyone</li>
              <li>• You'll be logged out after changing your password</li>
              <li>• Log in again with your new password</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
