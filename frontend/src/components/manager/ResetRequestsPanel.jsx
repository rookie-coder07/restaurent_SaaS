import { useMemo, useState } from 'react';
import { KeyRound, Loader, ShieldAlert } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { authAPI } from '../../services/apiEndpoints';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Toast from '../common/Toast';

const initialPasswordState = {
  requestId: '',
  newPassword: '',
  confirmPassword: '',
};

export default function ResetRequestsPanel() {
  const {
    data: resetRequestData = {},
    loading,
    refetch,
  } = useApi(authAPI.getResetRequests);
  const [passwordForm, setPasswordForm] = useState(initialPasswordState);
  const [submitState, setSubmitState] = useState({
    isSaving: false,
    error: '',
    success: '',
  });

  const requests = useMemo(() => resetRequestData?.items || [], [resetRequestData]);
  const activeRequest = useMemo(
    () => requests.find((request) => request.id === passwordForm.requestId) || null,
    [passwordForm.requestId, requests]
  );

  const closeModal = () => {
    setPasswordForm(initialPasswordState);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!passwordForm.requestId) {
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setSubmitState({
        isSaving: false,
        error: 'New password must be at least 6 characters long.',
        success: '',
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setSubmitState({
        isSaving: false,
        error: 'Confirm password must match the new password.',
        success: '',
      });
      return;
    }

    try {
      setSubmitState({
        isSaving: true,
        error: '',
        success: '',
      });

      await authAPI.resetUserPassword({
        requestId: passwordForm.requestId,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });

      await refetch();
      closeModal();
      setSubmitState({
        isSaving: false,
        error: '',
        success: 'POS user password reset successfully.',
      });
    } catch (error) {
      setSubmitState({
        isSaving: false,
        error: error.response?.data?.message || 'Unable to reset password right now.',
        success: '',
      });
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Reset Requests</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Pending POS password requests</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <ShieldAlert className="h-4 w-4" />
            {requests.length} pending
          </div>
        </div>

        {submitState.error ? <div className="mt-4"><Toast type="error" message={submitState.error} /></div> : null}
        {submitState.success ? <div className="mt-4"><Toast type="success" message={submitState.success} /></div> : null}

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-surface-muted)] px-4 py-4 text-sm text-[var(--text-secondary)]">
              <Loader className="h-4 w-4 animate-spin" />
              Loading reset requests...
            </div>
          ) : null}

          {!loading && requests.length === 0 ? (
            <div className="rounded-2xl bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-[var(--text-secondary)]">
              No pending POS reset requests right now.
            </div>
          ) : null}

          {!loading
            ? requests.map((request) => (
                <div key={request.id} className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {request.user?.name || 'POS user'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {request.user?.email || 'No email'} • requested {new Date(request.requestedAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        setPasswordForm({
                          requestId: request.id,
                          newPassword: '',
                          confirmPassword: '',
                        })
                      }
                    >
                      <KeyRound className="h-4 w-4" />
                      Reset Password
                    </Button>
                  </div>
                </div>
              ))
            : null}
        </div>
      </Card>

      <Modal
        title={activeRequest ? `Reset Password · ${activeRequest.user?.name || activeRequest.user?.email || 'POS user'}` : 'Reset Password'}
        isOpen={Boolean(passwordForm.requestId)}
        onClose={closeModal}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="New password"
            name="newPassword"
            type="password"
            value={passwordForm.newPassword}
            onChange={(event) =>
              setPasswordForm((current) => ({
                ...current,
                newPassword: event.target.value,
              }))
            }
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(event) =>
              setPasswordForm((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitState.isSaving}>
              {submitState.isSaving ? <Loader className="h-4 w-4 animate-spin" /> : null}
              {submitState.isSaving ? 'Resetting...' : 'Confirm Reset'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
