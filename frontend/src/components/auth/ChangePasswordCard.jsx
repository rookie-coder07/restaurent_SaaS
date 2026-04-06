import { useState } from 'react';
import { KeyRound, Loader } from 'lucide-react';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import Toast from '../common/Toast';
import { authAPI } from '../../services/apiEndpoints';

const initialFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function ChangePasswordCard({ title = 'Change Password', helper = 'Update your account password securely.' }) {
  const [formData, setFormData] = useState(initialFormState);
  const [saveState, setSaveState] = useState({
    isSaving: false,
    error: '',
    success: '',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setSaveState({
        isSaving: false,
        error: 'All password fields are required.',
        success: '',
      });
      return;
    }

    if (formData.newPassword.length < 6) {
      setSaveState({
        isSaving: false,
        error: 'New password must be at least 6 characters long.',
        success: '',
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setSaveState({
        isSaving: false,
        error: 'Confirm password must match the new password.',
        success: '',
      });
      return;
    }

    try {
      setSaveState({
        isSaving: true,
        error: '',
        success: '',
      });

      await authAPI.changePassword(formData);

      setFormData(initialFormState);
      setSaveState({
        isSaving: false,
        error: '',
        success: 'Password changed successfully.',
      });
    } catch (error) {
      setSaveState({
        isSaving: false,
        error: error.response?.data?.message || 'Unable to change password right now.',
        success: '',
      });
    }
  };

  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">Account security</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{helper}</p>
        </div>
      </div>

      {saveState.error ? <div className="mt-4"><Toast type="error" message={saveState.error} /></div> : null}
      {saveState.success ? <div className="mt-4"><Toast type="success" message={saveState.success} /></div> : null}

      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3">
        <Input
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={formData.currentPassword}
          onChange={handleChange}
        />
        <Input
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={formData.newPassword}
          onChange={handleChange}
        />
        <Input
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={handleChange}
        />

        <div className="mt-1 flex justify-end">
          <Button type="submit" disabled={saveState.isSaving}>
            {saveState.isSaving ? <Loader className="h-4 w-4 animate-spin" /> : null}
            {saveState.isSaving ? 'Updating...' : 'Change password'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
