import { useEffect, useMemo, useState } from 'react';
import { Check, MoonStar, Palette, Settings2, Store, SunMedium, UserCircle2 } from 'lucide-react';
import useTheme from '../hooks/useTheme';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { restaurantAPI } from '../services/apiEndpoints';
import { useApi } from '../hooks/useApi';

const themeIcons = {
  midnight: MoonStar,
  light: Palette,
};

export default function Settings() {
  const { theme, setTheme, themes } = useTheme();
  const { data: profileData, loading } = useApi(restaurantAPI.getProfile);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [preferences, setPreferences] = useState({
    autoRefresh: true,
    compactTables: false,
    emailAlerts: true,
  });
  const [saveState, setSaveState] = useState({
    profile: 'idle',
    preferences: 'idle',
  });

  useEffect(() => {
    if (!profileData) {
      return;
    }

    setProfileForm({
      name: profileData.name || '',
      email: profileData.email || '',
      phone: profileData.phone || '',
      address: profileData.address || '',
    });
  }, [profileData]);

  const selectedTheme = useMemo(
    () => themes.find((option) => option.id === theme) || themes[0],
    [theme, themes]
  );

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
  };

  const handlePreferenceToggle = (key) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
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

  const handlePreferenceSave = async () => {
    try {
      setSaveState((current) => ({ ...current, preferences: 'saving' }));
      await restaurantAPI.updateSettings(preferences);
      setSaveState((current) => ({ ...current, preferences: 'saved' }));
    } catch (error) {
      console.error('Failed to save app preferences', error);
      setSaveState((current) => ({ ...current, preferences: 'error' }));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-text-subtle)]">Workspace settings</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)] sm:text-4xl">One place for profile, preferences, and theme</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
              Keep restaurant identity, workspace behavior, and the theme system aligned in one consistent page.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] backdrop-blur-md">
            <Palette className="h-4 w-4" />
            Current theme: <span className="font-semibold text-[var(--text-primary)]">{selectedTheme?.label || 'Midnight'}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-[var(--color-primary-soft)] to-transparent opacity-90" />
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-subtle)]">Profile Settings</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">Restaurant profile</h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Input label="Restaurant name" name="name" value={profileForm.name} onChange={handleProfileChange} />
            <Input label="Email" name="email" type="email" value={profileForm.email} onChange={handleProfileChange} />
            <Input label="Phone" name="phone" value={profileForm.phone} onChange={handleProfileChange} />
            <Input label="Address" name="address" value={profileForm.address} onChange={handleProfileChange} />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-text-muted)]">
              {loading ? 'Loading profile...' : saveState.profile === 'saved' ? 'Saved successfully.' : saveState.profile === 'error' ? 'Unable to save changes.' : 'Keep your restaurant details up to date.'}
            </p>
            <Button onClick={handleProfileSave} disabled={saveState.profile === 'saving'}>
              {saveState.profile === 'saving' ? 'Saving...' : 'Save profile'}
            </Button>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-90" />
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-subtle)]">App Preferences</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">Workspace behavior</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              ['autoRefresh', 'Auto-refresh operational dashboards'],
              ['compactTables', 'Use compact tables and lists'],
              ['emailAlerts', 'Receive important email alerts'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePreferenceToggle(key)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-left transition-all hover:scale-[1.01] hover:bg-[var(--color-primary-soft)]"
              >
                <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
                <span
                  className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition ${
                    preferences[key] ? 'bg-[var(--color-primary)] justify-end' : 'bg-[var(--color-surface-muted)] justify-start'
                  }`}
                >
                  <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-text-muted)]">
              {saveState.preferences === 'saved' ? 'Preferences saved.' : saveState.preferences === 'error' ? 'Could not save preferences.' : 'Tune how the dashboard behaves for your team.'}
            </p>
              <Button onClick={handlePreferenceSave} disabled={saveState.preferences === 'saving'}>
              {saveState.preferences === 'saving' ? 'Saving...' : 'Save preferences'}
            </Button>
          </div>
        </Card>

        {themes.map((option) => {
          const Icon = themeIcons[option.id] || Palette;
          const active = theme === option.id;

          return (
            <Card key={option.id} className={`relative overflow-hidden ${active ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-soft)]' : ''}`}>
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[var(--color-primary-soft)] to-transparent opacity-80" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                {active ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <Check className="h-4 w-4" />
                  </div>
                ) : null}
              </div>

              <p className="mt-5 text-sm text-[var(--color-text-subtle)]">Theme Selection</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">{option.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                {option.id === 'midnight'
                  ? 'A high-contrast dark workspace with glass cards and strong readability.'
                  : 'A fully visible bright workspace with clean cards and soft borders.'}
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className={`h-16 rounded-xl ${option.id === 'midnight' ? 'bg-[#0b1320]' : 'bg-[#f9fafb]'}`} />
                <div className={`h-16 rounded-xl ${option.id === 'midnight' ? 'bg-[rgba(255,255,255,0.08)]' : 'bg-[#ffffff]'}`} />
                <div className={`h-16 rounded-xl ${option.id === 'midnight' ? 'bg-[#ffffff]' : 'bg-[#111827]'}`} />
              </div>

              <Button
                variant={active ? 'secondary' : 'primary'}
                className="mt-6 w-full"
                onClick={() => setTheme(option.id)}
              >
                {active ? 'Active theme' : `Switch to ${option.label}`}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-amber-500/10 to-transparent opacity-80" />
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <SunMedium className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-subtle)]">Workspace guidance</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">Keep the team aligned</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              Use Midnight as the default production look and switch to Light when you want a brighter daytime workspace.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
