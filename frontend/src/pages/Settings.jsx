import { useEffect, useState } from 'react';
import { Check, MoonStar, Palette, Settings2, SunMedium, UserCircle2 } from 'lucide-react';
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
    <div className="space-y-4">
      <Card className="overflow-hidden p-5">
        <div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-text-subtle)]">Workspace settings</p>
            <h1 className="mt-2 text-2xl font-bold text-[var(--color-text)] sm:text-3xl">Profile, preferences, and theme</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
              Keep restaurant identity, workspace behavior, and the theme system aligned in one compact place.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
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

          <Card className="overflow-hidden p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">App preferences</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Workspace behavior</h2>
              </div>
            </div>

            <div className="mt-4 divide-y divide-[var(--border-color)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)]">
              {[
                ['autoRefresh', 'Auto-refresh operational dashboards'],
                ['compactTables', 'Use compact tables and lists'],
                ['emailAlerts', 'Receive important email alerts'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePreferenceToggle(key)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-[var(--color-primary-soft)]"
                >
                  <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
                  <span
                    className={`inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full p-1 transition ${
                      preferences[key] ? 'justify-end bg-[var(--color-primary)]' : 'justify-start bg-[var(--color-surface-muted)]'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                {saveState.preferences === 'saved'
                  ? 'Preferences saved.'
                  : saveState.preferences === 'error'
                    ? 'Could not save preferences.'
                    : 'Tune how the dashboard behaves for your team.'}
              </p>
              <Button onClick={handlePreferenceSave} disabled={saveState.preferences === 'saving'}>
                {saveState.preferences === 'saving' ? 'Saving...' : 'Save preferences'}
              </Button>
            </div>
          </Card>
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
