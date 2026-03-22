import { useState } from 'react';
import { ChefHat, Loader, Plus, Shield, Trash2, User, Users } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { restaurantAPI } from '../services/apiEndpoints';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';

const ROLE_META = {
  manager: {
    label: 'Manager',
    color: 'bg-violet-100 text-violet-700',
    icon: Shield,
  },
  staff: {
    label: 'Staff',
    color: 'bg-sky-100 text-sky-700',
    icon: User,
  },
  kitchen_staff: {
    label: 'Kitchen Staff',
    color: 'bg-amber-100 text-amber-700',
    icon: ChefHat,
  },
};

export default function StaffManagement() {
  const { data: staffData = {}, loading, execute: refetch } = useApi(() => restaurantAPI.getStaff(100, 0));
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff',
    password: '',
  });

  const staff = staffData?.staff || [];
  const managerCount = staff.filter((member) => member.role === 'manager').length;
  const staffCount = staff.filter((member) => member.role === 'staff').length;
  const kitchenCount = staff.filter((member) => member.role === 'kitchen_staff').length;

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'staff',
      password: '',
    });
    setShowForm(false);
  };

  const validateStaffForm = () => {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      return 'Name must be at least 2 characters.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return 'Please enter a valid email address.';
    }

    if (!/^\d{10}$/.test(formData.phone.trim())) {
      return 'Phone number must be exactly 10 digits.';
    }

    if (!formData.password) {
      return 'Password is required.';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationMessage = validateStaffForm();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSubmitting(true);

    try {
      await restaurantAPI.createStaff({
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
      });
      setSuccess('Staff member added successfully');
      resetForm();
      await refetch();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const details = err.response?.data?.details;
      const detailedMessage =
        Array.isArray(details) && details.length > 0
          ? details.map((detail) => detail.message).join(' ')
          : null;
      setError(detailedMessage || err.response?.data?.message || 'Failed to add staff');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;

    try {
      await restaurantAPI.deactivateStaff(staffId);
      setSuccess('Staff member removed');
      await refetch();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove staff');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error && !showForm ? <Toast type="error" message={error} /> : null}

      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.14),_transparent_35%),var(--color-surface)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Staff</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Manage team access</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Add managers, staff, and kitchen users with a mobile-friendly team roster.
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Add Staff
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Shield} label="Managers" value={managerCount} subtitle="Admin-level users" tone="primary" />
        <StatCard icon={User} label="Staff" value={staffCount} subtitle="Front-of-house members" tone="neutral" />
        <StatCard icon={ChefHat} label="Kitchen" value={kitchenCount} subtitle="Kitchen team members" tone="warning" />
      </div>

      {staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff members yet"
          description="Invite your first team member to start assigning roles across operations."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {staff.map((member) => {
            const meta = ROLE_META[member.role] || ROLE_META.staff;
            const Icon = meta.icon;

            return (
              <Card key={member.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-bold text-[var(--color-text)]">{member.name}</h3>
                      <p className="mt-1 break-all text-sm text-[var(--color-text-muted)]">{member.email}</p>
                    </div>
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                      {meta.label}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Phone</p>
                        <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{member.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Status</p>
                        <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button variant="danger" onClick={() => handleDeleteStaff(member.id)} className="w-full sm:w-auto">
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal title="Add Staff Member" isOpen={showForm} onClose={() => { resetForm(); setError(null); }} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {error}
            </div>
          ) : null}

          <Input
            label="Name"
            autoComplete="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Phone"
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            maxLength={10}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            required
          />

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-text)]">Role</span>
            <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="input" required>
              <option value="staff">Staff</option>
              <option value="kitchen_staff">Kitchen Staff</option>
              <option value="manager">Manager</option>
            </select>
          </label>

          <Input
            label="Temporary Password"
            type="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" className="w-full sm:flex-1" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:flex-1" disabled={submitting}>
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : null}
              Add Staff
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
