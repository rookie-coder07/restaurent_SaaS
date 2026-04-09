import { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { restaurantAPI } from '../services/apiEndpoints';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';

export default function GSTSettings() {
  const { data: profile, loading: profileLoading, refetch: refetchProfile } = useApi(restaurantAPI.getProfile);
  const [formData, setFormData] = useState({
    gstNumber: '',
    enableGST: true,
    defaultCGSTPercent: 0,
    defaultSGSTPercent: 0,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        gstNumber: profile.gstNumber || '',
        enableGST: profile.enableGST ?? true,
        defaultCGSTPercent: profile.defaultCGSTPercent || 0,
        defaultSGSTPercent: profile.defaultSGSTPercent || 0,
      });
    }
  }, [profile]);

  // Show message for 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const validateGSTNumber = (gstin) => {
    // Indian GST number format: 2 digits (state) + 10 alphanumeric + 1 letter + 1 digit + 1 letter
    // Total 15 characters
    if (!gstin) return true; // Optional field
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstPattern.test(gstin.toUpperCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.gstNumber && !validateGSTNumber(formData.gstNumber)) {
      setMessage('Invalid GST Number format. Example: 27AABCU1234H1Z0');
      setMessageType('error');
      return;
    }

    if (formData.defaultCGSTPercent < 0 || formData.defaultCGSTPercent > 100) {
      setMessage('CGST percentage must be between 0 and 100');
      setMessageType('error');
      return;
    }

    if (formData.defaultSGSTPercent < 0 || formData.defaultSGSTPercent > 100) {
      setMessage('SGST percentage must be between 0 and 100');
      setMessageType('error');
      return;
    }

    try {
      setLoading(true);

      // Update profile (GST number)
      if (formData.gstNumber !== profile?.gstNumber) {
        await restaurantAPI.updateProfile({
          gstNumber: formData.gstNumber.toUpperCase(),
        });
      }

      // Update settings (GST percentages)
      await restaurantAPI.updateSettings({
        enableGST: formData.enableGST,
        defaultCGSTPercent: formData.defaultCGSTPercent,
        defaultSGSTPercent: formData.defaultSGSTPercent,
      });

      setMessage('GST settings updated successfully!');
      setMessageType('success');

      // Refresh profile
      await refetchProfile();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to update settings');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings size={32} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">GST Settings</h1>
          </div>
          <p className="text-gray-600">Manage your restaurant's GST number and tax rates</p>
        </div>

        {/* Message Alert */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              messageType === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {messageType === 'success' ? (
              <CheckCircle className="text-green-600" size={20} />
            ) : (
              <AlertCircle className="text-red-600" size={20} />
            )}
            <p className={messageType === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message}
            </p>
          </div>
        )}

        {/* Main Card */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* GST Number Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">GST Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="gstNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    GST Number (GSTIN)
                  </label>
                  <Input
                    id="gstNumber"
                    name="gstNumber"
                    type="text"
                    value={formData.gstNumber}
                    onChange={handleChange}
                    placeholder="e.g., 27AABCU1234H1Z0"
                    className="w-full"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Format: 2 digits (state code) + 10 alphanumeric characters + 3 special characters
                  </p>
                  {formData.gstNumber && validateGSTNumber(formData.gstNumber) && (
                    <p className="text-xs text-green-600 mt-2">✓ Valid GST format</p>
                  )}
                  {formData.gstNumber && !validateGSTNumber(formData.gstNumber) && (
                    <p className="text-xs text-red-600 mt-2">✗ Invalid GST format</p>
                  )}
                </div>

                {/* Enable GST Toggle */}
                <div className="flex items-center gap-3">
                  <input
                    id="enableGST"
                    name="enableGST"
                    type="checkbox"
                    checked={formData.enableGST}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="enableGST" className="text-sm font-medium text-gray-700">
                    Enable GST in bills
                  </label>
                </div>
              </div>
            </div>

            {/* Tax Rates Section */}
            {formData.enableGST && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Default Tax Rates</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="defaultCGSTPercent" className="block text-sm font-medium text-gray-700 mb-2">
                      Default CGST (%)
                    </label>
                    <Input
                      id="defaultCGSTPercent"
                      name="defaultCGSTPercent"
                      type="number"
                      value={formData.defaultCGSTPercent}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={loading}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-2">Central GST (0-100%)</p>
                  </div>

                  <div>
                    <label htmlFor="defaultSGSTPercent" className="block text-sm font-medium text-gray-700 mb-2">
                      Default SGST (%)
                    </label>
                    <Input
                      id="defaultSGSTPercent"
                      name="defaultSGSTPercent"
                      type="number"
                      value={formData.defaultSGSTPercent}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={loading}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-2">State GST (0-100%)</p>
                  </div>
                </div>

                {/* Total ITC */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-700">
                    Total Tax:<span className="font-semibold ml-2 text-blue-600">
                      {(formData.defaultCGSTPercent + formData.defaultSGSTPercent).toFixed(2)}%
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Note:</span> GST settings are applied per restaurant and visible only to
                customers of your restaurant. Each restaurant in the system maintains separate GST configurations.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save GST Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Example Info */}
        <Card className="mt-6 p-6 bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-3">GST Number Format Guide</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <span className="font-mono font-semibold">27AABCU1234H1Z0</span> - Valid Indian GST number
            </p>
            <p>
              <span className="font-mono">27</span> - State code (Maharashtra in this example)
            </p>
            <p>
              <span className="font-mono">AABCU</span> - PAN of business entity
            </p>
            <p>
              <span className="font-mono">1234</span> - Sequential number
            </p>
            <p>
              <span className="font-mono">H1Z0</span> - Check digits
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
