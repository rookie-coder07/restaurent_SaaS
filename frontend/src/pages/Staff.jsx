import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { restaurantAPI } from '../services/apiEndpoints';
import { Plus, Trash2, X, AlertCircle, Loader, Shield, User, ChefHat } from 'lucide-react';

const ROLE_COLORS = {
  manager: 'bg-purple-100 text-purple-800',
  staff: 'bg-blue-100 text-blue-800',
  kitchen_staff: 'bg-orange-100 text-orange-800',
};

const ROLE_ICONS = {
  manager: Shield,
  staff: User,
  kitchen_staff: ChefHat,
};

export default function StaffManagement() {
  const { data: staffData = {}, loading, execute: refetch } = useApi(() =>
    restaurantAPI.getStaff(100, 0)
  );

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

  const handleAddStaff = () => {
    setError(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'staff',
      password: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await restaurantAPI.createStaff({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        password: formData.password,
      });

      setSuccess('Staff member added successfully');
      setShowForm(false);
      await refetch(); // Wait for data to reload
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add staff');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (confirm('Are you sure  you want to remove this staff member?')) {
      try {
        await restaurantAPI.deactivateStaff(staffId);
        setSuccess('Staff member removed');
        await refetch(); // Wait for data to reload
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to remove staff');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const managerCount = staff.filter(s => s.role === 'manager').length;
  const staffCount = staff.filter(s => s.role === 'staff').length;
  const kitchenCount = staff.filter(s => s.role === 'kitchen_staff').length;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
        <button
          onClick={handleAddStaff}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Add Staff
        </button>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-purple-600" />
            <p className="text-gray-600 text-sm font-medium">Managers</p>
          </div>
          <p className="text-3xl font-bold text-purple-600">{managerCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-blue-600" />
            <p className="text-gray-600 text-sm font-medium">Staff</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{staffCount}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ChefHat className="w-5 h-5 text-orange-600" />
            <p className="text-gray-600 text-sm font-medium">Kitchen</p>
          </div>
          <p className="text-3xl font-bold text-orange-600">{kitchenCount}</p>
        </div>
      </div>

      {/* Staff List */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Phone</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Role</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.length > 0 ? (
              staff.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role];
                return (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-900">{member.name}</td>
                    <td className="px-6 py-4 text-gray-600">{member.email}</td>
                    <td className="px-6 py-4 text-gray-600">{member.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[member.role]}`}>
                        {RoleIcon && <RoleIcon className="w-4 h-4" />}
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteStaff(member.id)}
                        className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-600">
                  No staff members yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Staff Member</h2>
              <button
                onClick={() => { setShowForm(false); setError(null); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="staff">Staff</option>
                  <option value="kitchen_staff">Kitchen Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  placeholder="Temporary password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input w-full"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                >
                  {submitting ? 'Adding...' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
