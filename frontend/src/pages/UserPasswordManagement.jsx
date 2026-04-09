import { useState, useEffect } from 'react';
import { KeyRound, AlertCircle, CheckCircle, Search, RefreshCw, Loader, Eye, EyeOff } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import { restaurantAPI, authAPI } from '../services/apiEndpoints';
import { useAuthStore } from '../context/authStore';

export default function UserPasswordManagement() {
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(filterUsersByRole(users));
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredUsers(
        filterUsersByRole(users).filter((user) =>
          user.email.toLowerCase().includes(term) ||
          (user.name && user.name.toLowerCase().includes(term)) ||
          (user.role && user.role.toLowerCase().includes(term))
        )
      );
    }
  }, [searchTerm, users]);

  const filterUsersByRole = (usersList) => {
    if (!currentUser) return [];
    
    // Admin/Owner can see everyone
    if (currentUser.role === 'owner') {
      return usersList.filter(u => u.role !== 'owner'); // Don't show other owners
    }
    
    // Manager can only see waiters and staff
    if (currentUser.role === 'manager') {
      return usersList.filter(u => ['staff', 'kitchen_staff', 'waiter'].includes(u.role));
    }
    
    // Others can't see anyone
    return [];
  };

  const canManageUser = (user) => {
    if (!currentUser) return false;
    if (currentUser.role === 'owner') return user.role !== 'owner';
    if (currentUser.role === 'manager') return ['staff', 'kitchen_staff', 'waiter'].includes(user.role);
    return false;
  };

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      setError('');
      // Reduce limit for better performance - fetch max 200 records
      const response = await restaurantAPI.getStaff({ limit: 200, skip: 0 });
      const staffData = response?.data?.data?.staff || response?.staff || [];
      setUsers(staffData);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users. Please try again.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };


  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    if (!canManageUser(selectedUser)) {
      setError(`You don't have permission to change password for ${selectedUser.role} users`);
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError('Both password fields are required');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setResetting(true);
      // Use the API endpoint to reset password for a specific user
      await restaurantAPI.resetStaffPassword(selectedUser.id, {
        newPassword,
      });

      setSuccess(`Password changed successfully for ${selectedUser.email}!`);
      setNewPassword('');
      setConfirmPassword('');
      setSelectedUser(null);
      
      // Refresh users list
      await fetchAllUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setResetting(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'staff':
        return 'bg-green-100 text-green-800';
      case 'kitchen_staff':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">User Password Management</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {currentUser?.role === 'owner' 
                ? 'View and change passwords for all staff members in your restaurant'
                : 'View and change passwords for waiters and staff only'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4">
          <Toast type="error" message={error} />
        </div>
      )}

      {success && (
        <div className="mb-4">
          <Toast type="success" message={success} />
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Selection Panel */}
        <div className="lg:col-span-1">
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-[var(--text-primary)]">Select User</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {loading ? 'Loading...' : `${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button
                onClick={fetchAllUsers}
                disabled={loading}
                className="rounded-lg p-1 hover:bg-[var(--bg-panel-muted)] disabled:opacity-50"
                title="Refresh user list"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] pl-10 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
              />
            </div>

            {/* Users List */}
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader className="h-5 w-5 animate-spin text-[var(--color-primary)] mb-2" />
                  <p className="text-xs text-[var(--text-secondary)]">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-[var(--text-secondary)] mx-auto mb-2" />
                  {users.length === 0 ? (
                    <div>
                      <p className="text-sm font-medium text-[var(--text-secondary)]">No staff members found</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Create staff accounts first</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-[var(--text-secondary)]">
                        {currentUser?.role === 'manager' 
                          ? 'No staff or waiters found for this restaurant'
                          : 'No staff members match your search'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                      selectedUser?.id === user.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--text-primary)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-primary)] hover:bg-[var(--bg-card-muted)]'
                    }`}
                  >
                    <div className="font-medium">{user.email}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{user.name || 'No name'}</div>
                    <div className="mt-1 flex gap-1">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Password Reset Form */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            {!selectedUser ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-panel-muted)]">
                    <KeyRound className="h-6 w-6 text-[var(--text-secondary)]" />
                  </div>
                  <p className="text-[var(--text-secondary)]">Select a user to change their password</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Selected User Info */}
                <div className="rounded-lg border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/20 p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Changing password for:</p>
                  <div className="mt-2">
                    <p className="font-semibold text-[var(--text-primary)]">{selectedUser.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${getRoleColor(selectedUser.role)}`}>
                        {selectedUser.role}
                      </span>
                      {selectedUser.name && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {selectedUser.name}
                        </span>
                      )}
                      {selectedUser.updated_at && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          Last changed: {new Date(selectedUser.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Current Password Display */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">Password Status</p>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 border border-amber-200">
                    <span className="flex-1">
                      {selectedUser.password && selectedUser.password.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="font-mono text-sm text-green-700 font-medium">
                            Password is set
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({selectedUser.password.length} characters)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500"></div>
                          <span className="font-mono text-sm text-red-700 font-medium">
                            No password set
                          </span>
                        </div>
                      )}
                    </span>
                    {selectedUser.password && selectedUser.password.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="rounded-lg p-1 hover:bg-gray-100"
                        title={showPassword ? 'Hide password hash' : 'Show password hash'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-600" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-600" />
                        )}
                      </button>
                    )}
                  </div>
                  {selectedUser.password && selectedUser.password.length > 0 && showPassword && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 break-all font-mono text-xs text-gray-600">
                      {selectedUser.password.substring(0, 60)}...
                    </div>
                  )}
                </div>

                {/* Password Form */}
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (minimum 6 characters)"
                      disabled={resetting}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:bg-[var(--bg-panel-muted)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      disabled={resetting}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] disabled:bg-[var(--bg-panel-muted)]"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={resetting || !newPassword.trim() || !confirmPassword.trim()}
                      className="flex-1"
                    >
                      {resetting ? 'Changing Password...' : 'Change Password'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setSelectedUser(null);
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      disabled={resetting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-500/10 p-4 md:p-6">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-700" />
          <div>
            <p className="text-sm font-semibold text-blue-900">How it works</p>
            <ul className="mt-2 space-y-1 text-sm text-blue-800">
              <li>• Search for a user by email or name</li>
              <li>• Select the user from the list</li>
              <li>• Enter the new password (minimum 6 characters)</li>
              <li>• User can login with the new password immediately</li>
              <li>• Previous password will no longer work</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
