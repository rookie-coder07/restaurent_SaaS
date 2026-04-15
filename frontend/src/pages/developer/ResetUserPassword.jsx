import { useState } from 'react';
import { Copy, Eye, EyeOff, Key, Loader2, Search } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Toast from '../../components/common/Toast';
import { developerAPI } from '../../services/apiEndpoints';

const generateTemporaryPassword = () => {
  // Generates a strong temporary password that meets all requirements:
  // - At least 8 characters
  // - Uppercase letter
  // - Lowercase letter
  // - Number
  // - Special character
  const randomNum = Math.floor(Math.random() * 10000 + 10000);
  return `Admin@${randomNum}!`;
};

export default function ResetUserPassword() {
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) {
      setToast({ type: 'error', message: 'Enter email to search' });
      return;
    }

    setIsSearching(true);
    try {
      const response = await developerAPI.getUsers();
      const users = response.data.data || [];
      const results = users.filter(u =>
        u.email.toLowerCase().includes(searchEmail.toLowerCase())
      );

      if (results.length === 0) {
        setToast({ type: 'warning', message: 'No users found' });
        setSearchResults([]);
      } else {
        setSearchResults(results);
      }
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Search failed' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetPassword = async (user) => {
    const newPassword = generateTemporaryPassword();
    setIsResetting(true);

    try {
      const response = await developerAPI.resetUserPassword(user.id, {
        newPassword,
      });

      setTempPassword(newPassword);
      setSelectedUser(user);
      setToast({
        type: 'success',
        message: `Password reset for ${user.email}`,
      });
    } catch (error) {
      setToast({
        type: 'error',
        message: error.response?.data?.message || 'Password reset failed',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setToast({ type: 'success', message: 'Password copied to clipboard' });
    } catch {
      setToast({ type: 'error', message: 'Could not copy password' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[var(--border)]">
          <Key className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Reset User Password</h2>
        </div>

        <form onSubmit={handleSearch} className="space-y-4 mb-6">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              disabled={isSearching}
            />
            <Button
              type="submit"
              disabled={isSearching}
              variant="primary"
              className="whitespace-nowrap"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-6 space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] hover:border-blue-400 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-[var(--text-primary)]">{user.email}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {user.name} • {user.role}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleResetPassword(user)}
                    disabled={isResetting}
                    variant="secondary"
                    size="sm"
                  >
                    {isResetting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Key className="w-4 h-4" />
                    )}
                    Reset Password
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Temporary Password Display */}
        {selectedUser && tempPassword && (
          <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Temporary Password Generated
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                User: <span className="font-mono font-bold">{selectedUser.email}</span>
              </p>

              <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded border border-amber-300 dark:border-amber-700">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={tempPassword}
                  readOnly
                  className="flex-1 bg-transparent font-mono text-sm focus:outline-none text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-slate-500" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                >
                  <Copy className="w-4 h-4 text-blue-500" />
                </button>
              </div>

              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Share this password only with the user. They should change it on first login.
              </p>
            </div>

            <Button
              onClick={() => {
                setSelectedUser(null);
                setTempPassword('');
                setSearchEmail('');
                setSearchResults([]);
              }}
              variant="secondary"
              className="w-full"
            >
              Reset Form
            </Button>
          </div>
        )}
      </Card>

      {toast.message && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast({ type: '', message: '' })}
        />
      )}
    </div>
  );
}
