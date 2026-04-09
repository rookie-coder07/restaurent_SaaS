import { useEffect, useMemo, useState } from 'react';
import { Check, MoonStar, Palette, Printer, Settings2, SunMedium, UserCircle2 } from 'lucide-react';
import useTheme from '../hooks/useTheme';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import ChangePasswordCard from '../components/auth/ChangePasswordCard';
import { restaurantAPI } from '../services/apiEndpoints';
import { useApi } from '../hooks/useApi';
import { getRestaurantPrinterSettings } from '../utils/printerConfig';
import { useAuthStore } from '../context/authStore';

const themeIcons = {
  midnight: MoonStar,
  light: Palette,
};

const emptyKotPrinter = () => ({
  name: '',
  enabled: true,
});

export default function Settings() {
  const { theme, setTheme, themes } = useTheme();
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role || '';
  const isOwner = userRole === 'owner';
  const isStaffPortalUser = userRole === 'manager' || userRole === 'staff';
  const { data: profileData, loading } = useApi(restaurantAPI.getProfile);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    gstNumber: '',
    gstAuthority: '',
  });
  const [settingsForm, setSettingsForm] = useState({
    enableGST: true,
    defaultCGSTPercent: 2.5,
    defaultSGSTPercent: 2.5,
    defaultServiceCharge: 0,
    currency: 'INR',
    printProvider: 'browser',
    printServiceUrl: '',
    receiptWidthMm: 80,
    autoPrintKOT: false,
    autoPrintBill: false,
    billPrinter: {
      name: '',
      enabled: false,
    },
    kotPrinters: [emptyKotPrinter()],
  });
  const [saveState, setSaveState] = useState({
    profile: 'idle',
    settings: 'idle',
    invoice: 'idle',
  });
  const [invoiceForm, setInvoiceForm] = useState({
    prefix: null,
    startingNumber: null,
  });
  const [invoiceMeta, setInvoiceMeta] = useState({
    currentNextNumber: null,
    currentPrefix: null,
  });
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState('');
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    if (!profileData) {
      return;
    }

    setProfileForm({
      name: profileData.name || '',
      email: profileData.email || '',
      phone: profileData.phone || '',
      address: profileData.address || '',
      gstNumber: profileData.gstNumber || '',
      gstAuthority: profileData.gstAuthority || '',
    });

    const printerSettings = getRestaurantPrinterSettings(profileData);

    setSettingsForm({
      enableGST: profileData.enableGST ?? true,
      defaultCGSTPercent: Number(profileData.defaultCGSTPercent ?? (Number(profileData.defaultGSTPercent ?? 5) / 2)),
      defaultSGSTPercent: Number(profileData.defaultSGSTPercent ?? (Number(profileData.defaultGSTPercent ?? 5) / 2)),
      defaultServiceCharge: Number(profileData.defaultServiceCharge ?? 0),
      currency: profileData.currency || 'INR',
      printProvider: printerSettings.provider,
      printServiceUrl: printerSettings.serviceUrl || '',
      receiptWidthMm: printerSettings.receiptWidthMm,
      autoPrintKOT: printerSettings.autoPrintKOT,
      autoPrintBill: printerSettings.autoPrintBill,
      billPrinter: {
        name: printerSettings.billPrinter?.name || '',
        enabled: printerSettings.billPrinter?.enabled ?? false,
      },
      kotPrinters:
        printerSettings.kotPrinters.length > 0
          ? printerSettings.kotPrinters.map((printer) => ({
            name: printer.name || '',
            enabled: printer.enabled ?? true,
          }))
          : [emptyKotPrinter()],
    });
    setSettingsError('');
  }, [profileData]);

  // Ensure bill settings always reflect latest backend state on mount
  useEffect(() => {
    const syncBillSettings = async () => {
      try {
        const { data } = await restaurantAPI.getProfile();
        const settings = data?.data?.invoiceSettings;
        if (settings?.nextNumber !== undefined && settings?.prefix) {
          const nextNumber = Number(settings.nextNumber);
          const prefix = String(settings.prefix).trim();
          
          setInvoiceMeta({
            currentNextNumber: nextNumber,
            currentPrefix: prefix,
          });
          setInvoiceForm({
            prefix: prefix,
            startingNumber: nextNumber,
          });
          setInvoiceError('');
        }
      } catch (error) {
        console.error('Failed to fetch bill settings:', error);
        setInvoiceError('Unable to load bill settings');
      } finally {
        setInvoiceLoading(false);
      }
    };

    syncBillSettings();
  }, []);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
  };

  const providerHelpText = useMemo(() => {
    if (settingsForm.printProvider === 'qz') {
      return 'Use this when QZ Tray is installed on the billing machine and printer names match exactly.';
    }

    if (settingsForm.printProvider === 'local_service') {
      return 'Use this when a local print bridge is running on the machine and listening at the URL below.';
    }

    return 'Browser mode keeps the current print flow and uses the browser print dialog as the safe fallback.';
  }, [settingsForm.printProvider]);

  const handleSettingsChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSettingsForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'defaultCGSTPercent' || name === 'defaultSGSTPercent' || name === 'defaultServiceCharge' || name === 'receiptWidthMm'
            ? Number(value || 0)
            : value,
    }));
  };

  const handleBillPrinterChange = (field, value) => {
    setSettingsForm((current) => ({
      ...current,
      billPrinter: {
        ...current.billPrinter,
        [field]: value,
      },
    }));
  };

  const handleKotPrinterChange = (index, field, value) => {
    setSettingsForm((current) => ({
      ...current,
      kotPrinters: current.kotPrinters.map((printer, printerIndex) =>
        printerIndex === index
          ? {
            ...printer,
            [field]: value,
          }
          : printer
      ),
    }));
  };

  const addKotPrinter = () => {
    setSettingsForm((current) => ({
      ...current,
      kotPrinters: [...current.kotPrinters, emptyKotPrinter()],
    }));
  };

  const removeKotPrinter = (index) => {
    setSettingsForm((current) => {
      const nextPrinters = current.kotPrinters.filter((_, printerIndex) => printerIndex !== index);

      return {
        ...current,
        kotPrinters: nextPrinters.length > 0 ? nextPrinters : [emptyKotPrinter()],
      };
    });
  };

  const handleProfileSave = async () => {
    try {
      setSaveState((current) => ({ ...current, profile: 'saving' }));
      await restaurantAPI.updateProfile(profileForm);
      setSaveState((current) => ({ ...current, profile: 'saved' }));
    } catch (error) {
      console.error('Failed to save profile settings', error);
      setSaveState((current) => ({ ...current, profile: 'error' }));
    }
  };

  const handleInvoiceChange = (event) => {
    const { name, value } = event.target;
    setInvoiceForm((current) => ({
      ...current,
      [name]: name === 'startingNumber' ? (value === '' ? null : Number(value)) : value.toUpperCase(),
    }));
  };

  const handleSettingsSave = async () => {
    try {
      setSaveState((current) => ({ ...current, settings: 'saving' }));
      setSettingsError('');
      await restaurantAPI.updateSettings({
        enableGST: settingsForm.enableGST,
        defaultCGSTPercent: Number(settingsForm.defaultCGSTPercent || 0),
        defaultSGSTPercent: Number(settingsForm.defaultSGSTPercent || 0),
        defaultServiceCharge: Number(settingsForm.defaultServiceCharge || 0),
        currency: settingsForm.currency,
        printProvider: settingsForm.printProvider,
        printServiceUrl: settingsForm.printProvider === 'local_service' ? settingsForm.printServiceUrl.trim() : '',
        receiptWidthMm: Number(settingsForm.receiptWidthMm || 80) === 58 ? 58 : 80,
        autoPrintKOT: settingsForm.autoPrintKOT,
        autoPrintBill: settingsForm.autoPrintBill,
        billPrinter: {
          name: settingsForm.billPrinter.name.trim(),
          enabled: settingsForm.billPrinter.enabled && Boolean(settingsForm.billPrinter.name.trim()),
        },
        kotPrinters: settingsForm.kotPrinters
          .map((printer) => ({
            name: printer.name.trim(),
            enabled: printer.enabled,
          }))
          .filter((printer) => printer.name),
      });
      setSaveState((current) => ({ ...current, settings: 'saved' }));
    } catch (error) {
      console.error('Failed to save workspace settings', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to save printer settings';
      setSettingsError(errorMsg);
      setSaveState((current) => ({ ...current, settings: 'error' }));
    }
  };

  const handleInvoiceSave = async () => {
    const normalizedPrefix = String(invoiceForm.prefix || '').trim().toUpperCase();
    const normalizedStartingNumber = Number(invoiceForm.startingNumber || 0);

    if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(normalizedPrefix)) {
      setInvoiceError('Bill prefix can use only uppercase letters, numbers, and hyphens.');
      setSaveState((current) => ({ ...current, invoice: 'error' }));
      return;
    }

    if (!Number.isInteger(normalizedStartingNumber) || normalizedStartingNumber <= 0) {
      setInvoiceError('Starting bill number must be a whole number greater than zero.');
      setSaveState((current) => ({ ...current, invoice: 'error' }));
      return;
    }

    if (normalizedStartingNumber < Number(invoiceMeta.currentNextNumber || 0)) {
      setInvoiceError(`Starting bill number cannot be lower than ${invoiceMeta.currentNextNumber}.`);
      setSaveState((current) => ({ ...current, invoice: 'error' }));
      return;
    }

    try {
      setInvoiceError('');
      setSaveState((current) => ({ ...current, invoice: 'saving' }));
      
      await restaurantAPI.updateInvoiceSettings({
        prefix: normalizedPrefix,
        startingNumber: normalizedStartingNumber,
      });

      // Refetch to ensure form reflects backend state
      const { data } = await restaurantAPI.getProfile();
      const settings = data?.data?.invoiceSettings;
      
      if (settings?.nextNumber !== undefined && settings?.prefix) {
        const nextNumber = Number(settings.nextNumber);
        const prefix = String(settings.prefix).trim();
        
        setInvoiceMeta({
          currentNextNumber: nextNumber,
          currentPrefix: prefix,
        });
        setInvoiceForm({
          prefix: prefix,
          startingNumber: nextNumber,
        });
      }
      
      setSaveState((current) => ({ ...current, invoice: 'saved' }));
    } catch (error) {
      setInvoiceError(error.response?.data?.message || 'Could not save invoice settings.');
      setSaveState((current) => ({ ...current, invoice: 'error' }));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-5">
        <div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-text-subtle)]">Workspace settings</p>
            <h1 className="mt-2 text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
              {isOwner ? 'Profile, preferences, and theme' : 'Account security and theme'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
              {isOwner
                ? 'Keep restaurant identity, workspace behavior, and the theme system aligned in one compact place.'
                : 'Change your password securely and keep your workspace comfortable during service.'}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          {isOwner ? (
            <Card className="overflow-hidden p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">Profile settings</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Restaurant profile</h2>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label="Restaurant name" name="name" value={profileForm.name} onChange={handleProfileChange} />
              <Input label="Email" name="email" type="email" value={profileForm.email} onChange={handleProfileChange} />
              <Input label="Phone" name="phone" value={profileForm.phone} onChange={handleProfileChange} />
              <Input label="Address" name="address" value={profileForm.address} onChange={handleProfileChange} />
              <Input label="GST Number (GSTIN)" name="gstNumber" value={profileForm.gstNumber} onChange={handleProfileChange} placeholder="e.g., 27AABCU1234H1Z0" />
              <Input label="GST Authority" name="gstAuthority" value={profileForm.gstAuthority} onChange={handleProfileChange} placeholder="e.g., GSTIN Registration Authority" />
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                {loading
                  ? 'Loading profile...'
                  : saveState.profile === 'saved'
                    ? 'Saved successfully.'
                    : saveState.profile === 'error'
                      ? 'Unable to save changes.'
                      : 'Keep your restaurant details up to date.'}
              </p>
              <Button onClick={handleProfileSave} disabled={saveState.profile === 'saving'}>
                {saveState.profile === 'saving' ? 'Saving...' : 'Save profile'}
              </Button>
            </div>
            </Card>
          ) : null}

          {isOwner ? (
            <Card className="overflow-hidden p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">Billing & printing</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Operational settings</h2>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
              <label className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">Currency</span>
                <select
                  name="currency"
                  value={settingsForm.currency}
                  onChange={handleSettingsChange}
                  className="mt-2 min-h-[2.875rem] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </label>

              <label className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">Default CGST %</span>
                <input
                  name="defaultCGSTPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settingsForm.defaultCGSTPercent}
                  onChange={handleSettingsChange}
                  className="mt-2 min-h-[2.875rem] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
                />
              </label>

              <label className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">Default SGST %</span>
                <input
                  name="defaultSGSTPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settingsForm.defaultSGSTPercent}
                  onChange={handleSettingsChange}
                  className="mt-2 min-h-[2.875rem] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
                />
              </label>

              <label className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">Service charge</span>
                <input
                  name="defaultServiceCharge"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsForm.defaultServiceCharge}
                  onChange={handleSettingsChange}
                  className="mt-2 min-h-[2.875rem] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
                />
              </label>

              <label className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">Receipt width</span>
                <select
                  name="receiptWidthMm"
                  value={settingsForm.receiptWidthMm}
                  onChange={handleSettingsChange}
                  className="mt-2 min-h-[2.875rem] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
                >
                  <option value={80}>80mm</option>
                  <option value={58}>58mm</option>
                </select>
              </label>
            </div>

            <div className="mt-4 space-y-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Printer className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Printer routing</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{providerHelpText}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Print provider</span>
                  <select
                    name="printProvider"
                    value={settingsForm.printProvider}
                    onChange={handleSettingsChange}
                    className="mt-2 min-h-[2.875rem] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
                  >
                    <option value="browser">Browser fallback</option>
                    <option value="qz">QZ Tray</option>
                    <option value="local_service">Local print service</option>
                  </select>
                </label>

                {settingsForm.printProvider === 'local_service' ? (
                  <Input
                    label="Local print service URL"
                    name="printServiceUrl"
                    value={settingsForm.printServiceUrl}
                    onChange={handleSettingsChange}
                    placeholder="http://127.0.0.1:4001/print"
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Auto-print KOT</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Send each new KOT to every enabled kitchen printer.</p>
                  </div>
                  <input
                    type="checkbox"
                    name="autoPrintKOT"
                    checked={settingsForm.autoPrintKOT}
                    onChange={handleSettingsChange}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Auto-print bill</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Send settled bills directly to the billing printer.</p>
                  </div>
                  <input
                    type="checkbox"
                    name="autoPrintBill"
                    checked={settingsForm.autoPrintBill}
                    onChange={handleSettingsChange}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">Billing printer</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Bills only route to this printer.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.billPrinter.enabled}
                      onChange={(event) => handleBillPrinterChange('enabled', event.target.checked)}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                  </div>

                  <Input
                    label="Printer name"
                    value={settingsForm.billPrinter.name}
                    onChange={(event) => handleBillPrinterChange('name', event.target.value)}
                    placeholder="Billing Counter Printer"
                    className="mt-3"
                  />
                </div>

                <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">Kitchen printers</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Each enabled printer receives every KOT job.</p>
                    </div>
                    <Button variant="secondary" onClick={addKotPrinter}>
                      Add printer
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {settingsForm.kotPrinters.map((printer, index) => (
                      <div key={`kot-printer-${index}`} className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--color-text)]">Kitchen Printer {index + 1}</p>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                              <input
                                type="checkbox"
                                checked={printer.enabled}
                                onChange={(event) => handleKotPrinterChange(index, 'enabled', event.target.checked)}
                                className="h-4 w-4 accent-[var(--color-primary)]"
                              />
                              Enabled
                            </label>
                            <button
                              type="button"
                              onClick={() => removeKotPrinter(index)}
                              className="text-xs font-semibold text-rose-400 transition hover:text-rose-300"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <Input
                          label="Printer name"
                          value={printer.name}
                          onChange={(event) => handleKotPrinterChange(index, 'name', event.target.value)}
                          placeholder={`Kitchen Printer ${index + 1}`}
                          className="mt-3"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              {saveState.settings === 'error' ? (
                <div className="flex-1">
                  <div className="rounded-lg border border-red-300/50 bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-900">Could not save printer settings</p>
                    {settingsError && (
                      <p className="mt-1 text-xs text-red-700">{settingsError}</p>
                    )}
                    <p className="mt-2 text-xs text-red-700">
                      <strong>Fix:</strong> See{' '}
                      <a href="#" className="underline hover:text-red-900"
                        onClick={(e) => {
                          e.preventDefault();
                          window.open('https://github.com', '_blank'); // Link to guide when available
                        }}
                      >
                        Printer Setup Guide
                      </a>{' '}
                      for the migration SQL and troubleshooting steps.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {saveState.settings === 'saved'
                    ? 'Billing and printer settings saved.'
                    : 'Only this restaurant will use these printers and auto-print rules.'}
                </p>
              )}
              <Button onClick={handleSettingsSave} disabled={saveState.settings === 'saving'}>
                {saveState.settings === 'saving' ? 'Saving...' : 'Save settings'}
              </Button>
            </div>
            </Card>
          ) : null}

          {isOwner ? (
            <Card className="overflow-hidden p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">Bill numbering</p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Bill settings</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                    Only the owner can change the bill prefix and next bill number.
                  </p>
                </div>
              </div>

              {invoiceLoading ? (
                <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4 text-center text-sm text-[var(--color-text-muted)]">
                  Loading bill settings...
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input
                      label="Bill Prefix"
                      name="prefix"
                      value={invoiceForm.prefix ?? ''}
                      onChange={handleInvoiceChange}
                      placeholder="INV"
                    />
                    <Input
                      label="Starting Bill Number"
                      name="startingNumber"
                      type="number"
                      min="1"
                      step="1"
                      value={invoiceForm.startingNumber ?? ''}
                      onChange={handleInvoiceChange}
                      placeholder="1001"
                    />
                  </div>

                  <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4 text-sm text-[var(--color-text-muted)]">
                    <p>Current prefix: <span className="font-semibold text-[var(--color-text)]">{invoiceMeta.currentPrefix || 'INV'}</span></p>
                    <p className="mt-1">Current next bill number: <span className="font-semibold text-[var(--color-text)]">{invoiceMeta.currentNextNumber || 'loading'}</span></p>
                    <p className="mt-1">Preview: <span className="font-semibold text-[var(--color-text)]">{`${invoiceForm.prefix || invoiceMeta.currentPrefix || 'INV'}-${invoiceForm.startingNumber ?? invoiceMeta.currentNextNumber ?? 0}`}</span></p>
                    <p className="mt-2 text-xs text-[var(--color-text-subtle)]">You can only keep the same next number or increase it. Bill numbers come from the backend.</p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {invoiceError
                        ? invoiceError
                        : saveState.invoice === 'saved'
                          ? 'Bill settings saved.'
                          : saveState.invoice === 'error'
                            ? 'Could not save bill settings.'
                            : 'Bill numbers are generated only from the backend.'}
                    </p>
                    <Button onClick={handleInvoiceSave} disabled={saveState.invoice === 'saving'}>
                      {saveState.invoice === 'saving' ? 'Saving...' : 'Save bill settings'}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ) : null}

          {isStaffPortalUser ? (
            <ChangePasswordCard
              title="Change Password"
              helper={
                userRole === 'manager'
                  ? 'Update your manager account password here. Use your admin account password reset option if needed.'
                  : 'Update your POS password here. Use the OTP-based password reset option at login if you forget your password.'
              }
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <SunMedium className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">Theme selection</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Choose your workspace look</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  Use Midnight as the default production look and switch to Light when you want a brighter daytime workspace.
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-[var(--border-color)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)]">
              {themes.map((option) => {
                const Icon = themeIcons[option.id] || Palette;
                const active = theme === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-[var(--color-primary-soft)] ${
                      active ? 'bg-[var(--color-primary-soft)]' : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-card)] text-[var(--color-primary)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--color-text)]">{option.label}</span>
                          {active ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {option.id === 'midnight'
                            ? 'High-contrast dark workspace with strong readability.'
                            : 'Bright workspace with clean surfaces and softer borders.'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${active ? 'text-[var(--color-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {active ? 'Active' : 'Switch'}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
