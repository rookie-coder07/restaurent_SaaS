import { useMemo, useState } from 'react';
import { ChefHat, Loader, Plus, Trash2, User, Users } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { restaurantAPI } from '../services/apiEndpoints';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import PaginationControls from '../components/common/PaginationControls';
import useResponsivePagination from '../hooks/useResponsivePagination';

const ROLE_META = {
  manager: {
    label: 'Manager',
    color: 'bg-violet-100 text-violet-700',
    icon: Users,
  },
  staff: {
    label: 'POS Staff',
    color: 'bg-sky-100 text-sky-700',
    icon: User,
  },
  kitchen_staff: {
    label: 'KOT Staff',
    color: 'bg-amber-100 text-amber-700',
    icon: ChefHat,
  },
};

const STAFF_FILTERS = [
  { id: 'all', label: 'All Access', description: 'Manager, POS staff, and KOT staff' },
  { id: 'manager', label: 'Manager', description: 'Operations workspace with live service controls' },
  { id: 'staff', label: 'POS Staff', description: 'Waiters and cashiers using the POS portal' },
  { id: 'kitchen_staff', label: 'KOT Staff', description: 'Kitchen team using the KOT portal' },
];

export default function StaffManagement() {
  const { data: staffData = {}, loading, execute: refetch } = useApi(() =>
    restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true })
  );
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'manager',
    password: '',
  });

  const staff = staffData?.staff || [];
  const managerCount = staff.filter((member) => member.role === 'manager').length;
  const staffCount = staff.filter((member) => member.role === 'staff').length;
  const kitchenCount = staff.filter((member) => member.role === 'kitchen_staff').length;
  const filteredStaff = useMemo(
    () => (activeFilter === 'all' ? staff : staff.filter((member) => member.role === activeFilter)),
    [activeFilter, staff]
  );
  const {
    paginatedItems: paginatedStaff,
    currentPage,
    totalPages,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    hasPagination,
  } = useResponsivePagination(filteredStaff, { mobileItemsPerPage: 6, desktopItemsPerPage: 8 });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'manager',
      password: '',
    });
    setShowForm(false);
  };

  const openCreateForm = (role = 'manager') => {
    setError(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role,
      password: '',
    });
    setShowForm(true);
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
      const targetRole = formData.role;
      const response = await restaurantAPI.createStaff({
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
      });
      const createdStaff = response.data?.data;
      const roleLabel = ROLE_META[targetRole]?.label || 'Staff';

      setActiveFilter(targetRole);
      setSuccess(`${roleLabel} login created for ${createdStaff?.email || formData.email.trim().toLowerCase()}`);
      resetForm();
      await refetch();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => setSuccess(null), 5000);
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
      window.setTimeout(() => setSuccess(null), 5000);
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
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Create POS and KOT staff access</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Create role-based logins for managers, POS staff, and kitchen staff from one clean admin screen.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => openCreateForm('manager')}>
              <Plus className="h-4 w-4" />
              Add Manager
            </Button>
            <Button variant="secondary" onClick={() => openCreateForm('staff')}>
              <Plus className="h-4 w-4" />
              Add POS Staff
            </Button>
            <Button onClick={() => openCreateForm('kitchen_staff')}>
              <Plus className="h-4 w-4" />
              Add KOT Staff
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Managers" value={managerCount} subtitle="Operations leaders" iconTone="bg-violet-100 text-violet-700" />
        <StatCard icon={User} label="POS Staff" value={staffCount} subtitle="Front-of-house members" iconTone="bg-sky-100 text-sky-700" />
        <StatCard icon={ChefHat} label="KOT Staff" value={kitchenCount} subtitle="Kitchen team members" iconTone="bg-amber-100 text-amber-700" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {STAFF_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            className={`rounded-[1.5rem] border p-4 text-left shadow-[var(--shadow-card)] transition ${
              activeFilter === filter.id
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'border-[var(--border-color)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]'
            }`}
          >
            <p className="text-sm font-bold text-[var(--color-text)]">{filter.label}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{filter.description}</p>
          </button>
        ))}
      </div>

      {filteredStaff.length === 0 ? (
        <EmptyState
          icon={Users}
          title={activeFilter === 'all' ? 'No staff members yet' : `No ${STAFF_FILTERS.find((item) => item.id === activeFilter)?.label.toLowerCase()} yet`}
          description="Create the right portal access for your team and they will appear here."
          action={
            <Button onClick={() => openCreateForm(activeFilter === 'all' ? 'staff' : activeFilter)}>
              <Plus className="h-4 w-4" />
              Create Access
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {paginatedStaff.map((member) => {
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
          {hasPagination ? (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              canGoPrevious={canGoPrevious}
              canGoNext={canGoNext}
              onPrevious={goPrevious}
              onNext={goNext}
            />
          ) : null}
        </>
      )}

      <Modal
        title={
          formData.role === 'manager'
            ? 'Create Manager Login'
            : formData.role === 'kitchen_staff'
              ? 'Create KOT Staff Login'
              : 'Create POS Staff Login'
        }
        isOpen={showForm}
        onClose={() => { resetForm(); setError(null); }}
        maxWidth="max-w-lg"
      >
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
              <option value="manager">Manager</option>
              <option value="staff">POS Staff</option>
              <option value="kitchen_staff">KOT Staff</option>
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
              Create Login
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
