import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, Loader2, Store } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Toast from '../../components/common/Toast';
import { developerAPI } from '../../services/apiEndpoints';
import { API_BASE_URL } from '../../services/api';

const INITIAL_FORM = {
  restaurantName: '',
  ownerName: '',
  ownerEmail: '',
  phone: '',
  address: '',
  gstNumber: '',
};

const normalizePhoneForApi = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const generateTemporaryPassword = () => {
  // Ensure it meets ALL password requirements:
  // - At least 8 characters
  // - At least one uppercase: T
  // - At least one lowercase: m, p
  // - At least one number: uses random 0-9
  // - At least one special character: @
  const randomNum = Math.floor(Math.random() * 10000 + 10000); // 5 digits (e.g., 10000-19999)
  return `Tmp@${randomNum}!A`; // e.g., "Tmp@15234!A"
};

export default function CreateRestaurant() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const [createdResult, setCreatedResult] = useState(null);

  const updateField = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const copyValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ type: 'success', message: `${label} copied` });
    } catch {
      setToast({ type: 'error', message: `Unable to copy ${label.toLowerCase()}` });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setToast({ type: '', message: '' });

    try {
      let payload = null;

      try {
        const response = await developerAPI.createRestaurant({
          ...form,
          phone: normalizePhoneForApi(form.phone),
        });
        payload = response.data.data;
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }

        const temporaryPassword = generateTemporaryPassword();
        const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.restaurantName.trim(),
            email: form.ownerEmail.trim().toLowerCase(),
            phone: normalizePhoneForApi(form.phone),
            password: temporaryPassword,
            city: 'Bellary',
            address: form.address.trim() || '',
            gstNumber: form.gstNumber.trim() || '',
          }),
        });

        const registerPayload = await registerResponse.json().catch(() => ({}));

        if (!registerResponse.ok) {
          throw {
            response: {
              status: registerResponse.status,
              data: registerPayload,
            },
          };
        }

        payload = {
          restaurant: {
            id: registerPayload?.data?.restaurant?.id || '',
            name: registerPayload?.data?.restaurant?.name || form.restaurantName.trim(),
            email: registerPayload?.data?.restaurant?.email || form.ownerEmail.trim().toLowerCase(),
            phone: normalizePhoneForApi(form.phone),
            address: form.address.trim(),
            gstNumber: form.gstNumber.trim(),
            status: 'active',
          },
          ownerCredentials: {
            ownerName: form.ownerName.trim(),
            email: form.ownerEmail.trim().toLowerCase(),
            temporaryPassword,
            loginPath: '/admin/login',
            role: 'admin',
          },
        };
      }

      setCreatedResult(payload);
      setForm(INITIAL_FORM);
      setToast({ type: 'success', message: 'Restaurant created successfully' });
    } catch (error) {
      setToast({
        type: 'error',
        message: error.response?.data?.message || 'Unable to create restaurant',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      {toast.message ? (
        <Toast
          type={toast.type || 'success'}
          message={toast.message}
          onClose={() => setToast({ type: '', message: '' })}
        />
      ) : null}

      <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="mx-auto w-full max-w-3xl border border-[var(--border-color)] bg-[linear-gradient(145deg,rgba(20,31,49,0.97),rgba(9,15,27,0.98))] p-0">
          <div className="border-b border-[var(--border-color)] px-6 py-5 sm:px-8">
            <Link
              to="/developer/restaurants"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to restaurants
            </Link>

            <div className="mt-5 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Store className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                  Developer Onboarding
                </p>
                <h1 className="mt-2 text-3xl font-black text-[var(--text-primary)]">
                  Create Restaurant
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                  Provision a new restaurant and its admin owner in one secure flow.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6 sm:px-8">
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Restaurant Name"
                value={form.restaurantName}
                onChange={updateField('restaurantName')}
                placeholder="Urban Spice"
                required
              />
              <Input
                label="Owner Name"
                value={form.ownerName}
                onChange={updateField('ownerName')}
                placeholder="Aarav Mehta"
                required
              />
              <Input
                label="Owner Email"
                type="email"
                value={form.ownerEmail}
                onChange={updateField('ownerEmail')}
                placeholder="owner@urbanspice.com"
                required
              />
              <Input
                label="Phone Number"
                value={form.phone}
                onChange={updateField('phone')}
                placeholder="+91 9876543210"
                required
              />
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Address</span>
              <textarea
                className="input min-h-[112px]"
                value={form.address}
                onChange={updateField('address')}
                placeholder="Optional address"
              />
            </label>

            <Input
              label="GST Number"
              value={form.gstNumber}
              onChange={updateField('gstNumber')}
              placeholder="Optional GST number"
            />

            <div className="flex flex-col gap-3 border-t border-[var(--border-color)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                The owner account will receive a temporary password for first login.
              </p>
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create Restaurant
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit border border-[var(--border-color)] bg-[linear-gradient(145deg,rgba(20,31,49,0.97),rgba(9,15,27,0.98))]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Provisioning Result</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Newly created owner credentials appear here after a successful request.
          </p>

          {createdResult ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Restaurant created successfully</span>
                </div>
                <p className="mt-2 text-sm text-emerald-100">{createdResult.restaurant.name}</p>
              </div>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Owner Email</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)] break-all">
                    {createdResult.ownerCredentials.email}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyValue(createdResult.ownerCredentials.email, 'Email')}
                    className="rounded-xl p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]"
                    aria-label="Copy owner email"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Temporary Password</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)] break-all">
                    {createdResult.ownerCredentials.temporaryPassword}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyValue(createdResult.ownerCredentials.temporaryPassword, 'Password')}
                    className="rounded-xl p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]"
                    aria-label="Copy temporary password"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4 text-sm text-[var(--text-secondary)]">
                Login path: <span className="font-semibold text-[var(--text-primary)]">{createdResult.ownerCredentials.loginPath}</span>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
              No credentials yet.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
