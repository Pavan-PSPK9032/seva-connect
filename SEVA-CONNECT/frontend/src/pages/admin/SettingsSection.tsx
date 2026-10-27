import { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Globe2,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Save,
  Settings2,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { apiErrorMessage, apiGetOne, apiPatch, apiPost } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { AdminSecurity, PlatformSettings } from '../../types';
import {
  Badge,
  ErrorState,
  Field,
  PageHeader,
  StatusBadge,
  TableSkeleton,
  useConfirm,
} from './ui';
import { formatDateTime } from './utils';

type Tab = 'profile' | 'notifications' | 'security' | 'platform';

const TABS: { id: Tab; label: string; icon: typeof UserCog }[] = [
  { id: 'profile', label: 'Profile', icon: UserCog },
  { id: 'notifications', label: 'Notifications', icon: BellRing },
  { id: 'security', label: 'Security', icon: KeyRound },
  { id: 'platform', label: 'Platform', icon: Globe2 },
];

export default function SettingsSection() {
  const { user, refreshUser, changePassword, logout } = useAuth();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Manage your administrator profile, notifications, credentials and platform-wide configuration."
      />

      <div className="mt-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-navy-700 hover:text-primary-700 dark:bg-navy-800 dark:text-slate-300 dark:hover:text-primary-300'
              }`}
            >
              <Icon className="h-4 w-4" /> {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === 'profile' && <ProfilePanel />}
        {tab === 'notifications' && <NotificationsPanel />}
        {tab === 'security' && (
          <SecurityPanel
            onChangePassword={changePassword}
            onLogoutAll={async () => {
              const ok = await confirm({
                title: 'Sign out of all devices?',
                message:
                  'Every issued session token for your account will be invalidated, including this one. You will need to sign in again.',
                confirmLabel: 'Sign out everywhere',
                tone: 'danger',
              });
              if (!ok) return;
              try {
                await apiPost('/admin/security/logout-all', {});
                toast('success', 'All sessions revoked', 'Please sign in again.');
              } catch (err) {
                toast('error', 'Could not revoke sessions', apiErrorMessage(err));
                return;
              }
              await logout();
              window.location.assign('/login');
            }}
          />
        )}
        {tab === 'platform' && <PlatformPanel />}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary-600" />
        Signed in as <span className="font-medium text-navy-700 dark:text-slate-300">{user?.email}</span>
      </div>

      {dialog}
    </div>
  );
}

/* --------------------------------- Profile --------------------------------- */

function ProfilePanel() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    location: user?.location || '',
    profileImage: user?.profileImage || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (form.name.trim().length < 2) {
      setError('Your name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      await apiPatch('/admin/profile', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        profileImage: form.profileImage.trim(),
      });
      await refreshUser();
      toast('success', 'Profile updated', 'Your administrator profile has been saved.');
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not update your profile.');
      setError(message);
      toast('error', 'Could not update profile', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-primary-600" />
        <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">
          Administrator profile
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        This information identifies you in audit records and admin listings.
      </p>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="profile-name">
          <input
            id="profile-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            maxLength={60}
            className="input"
          />
        </Field>
        <Field label="Email (read-only)" htmlFor="profile-email" hint="Contact a platform owner to change your sign-in email.">
          <input id="profile-email" value={user?.email || ''} readOnly className="input opacity-70" />
        </Field>
        <Field label="Phone" htmlFor="profile-phone">
          <input
            id="profile-phone"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            maxLength={30}
            className="input"
            placeholder="+91 90000 00000"
          />
        </Field>
        <Field label="Location" htmlFor="profile-location">
          <input
            id="profile-location"
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
            maxLength={100}
            className="input"
            placeholder="Bengaluru, India"
          />
        </Field>
        <Field
          label="Profile image URL"
          htmlFor="profile-image"
          hint="Optional. Must be an https URL if provided."
          className="sm:col-span-2"
        >
          <input
            id="profile-image"
            value={form.profileImage}
            onChange={(event) => setForm({ ...form, profileImage: event.target.value })}
            maxLength={500}
            className="input"
            placeholder="https://…"
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Notifications ------------------------------ */

const PREF_LABELS: { key: 'inApp' | 'email' | 'reminders'; title: string; description: string }[] = [
  {
    key: 'inApp',
    title: 'In-app notifications',
    description: 'Application decisions, announcements and platform updates in your notification inbox.',
  },
  {
    key: 'email',
    title: 'Email notifications',
    description: 'Send matching notifications to your email address as well.',
  },
  {
    key: 'reminders',
    title: 'Activity reminders',
    description: 'Remind you about upcoming activities and application deadlines.',
  },
];

function NotificationsPanel() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState({
    inApp: user?.notificationPrefs?.inApp ?? true,
    email: user?.notificationPrefs?.email ?? false,
    reminders: user?.notificationPrefs?.reminders ?? true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiPatch('/admin/profile', { notificationPrefs: prefs });
      await refreshUser();
      toast('success', 'Notification preferences saved');
    } catch (err) {
      toast('error', 'Could not save preferences', apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary-600" />
        <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">
          Notification preferences
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        These settings control your own inbox. Transactional account and security messages are always
        delivered.
      </p>

      <div className="mt-4 space-y-3">
        {PREF_LABELS.map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-700/10 p-3.5 transition hover:border-primary-500/40 dark:border-white/10"
          >
            <input
              type="checkbox"
              checked={prefs[item.key]}
              onChange={(event) => setPrefs({ ...prefs, [item.key]: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded accent-primary-600"
            />
            <span>
              <span className="block text-sm font-medium text-navy-800 dark:text-slate-200">{item.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Security -------------------------------- */

function SecurityPanel({
  onChangePassword,
  onLogoutAll,
}: {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<unknown>;
  onLogoutAll: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [security, setSecurity] = useState<AdminSecurity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<AdminSecurity>('/admin/security');
      if (!res.data) throw new Error(res.message || 'No security data returned.');
      setSecurity(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load security details.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitPassword = async () => {
    setFormError(null);
    if (!passwords.current) {
      setFormError('Enter your current password.');
      return;
    }
    if (passwords.next.length < 8) {
      setFormError('Your new password must be at least 8 characters.');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setFormError('The new passwords do not match.');
      return;
    }
    if (passwords.next === passwords.current) {
      setFormError('Choose a password different from your current one.');
      return;
    }

    setSubmitting(true);
    try {
      await onChangePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '', confirm: '' });
      toast('success', 'Password updated', 'Other sessions were signed out.');
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not update your password.');
      setFormError(message);
      toast('error', 'Password update failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error || !security) {
    return <ErrorState message={error || 'Security details unavailable.'} onRetry={load} />;
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary-600" />
          <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">
            Account security
          </h2>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Sign-in email</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-navy-800 dark:text-slate-200">
              <Mail className="h-3.5 w-3.5 text-slate-400" /> {security.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Email verified</dt>
            <dd className="mt-0.5">
              <Badge tone={security.emailVerified ? 'emerald' : 'amber'}>
                {security.emailVerified ? 'verified' : 'unverified'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Account status</dt>
            <dd className="mt-0.5">
              <StatusBadge status={security.accountStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Last sign-in</dt>
            <dd className="mt-0.5 text-navy-800 dark:text-slate-200">
              {security.lastLoginAt ? formatDateTime(security.lastLoginAt) : 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Administrator since</dt>
            <dd className="mt-0.5 text-navy-800 dark:text-slate-200">
              {security.createdAt ? formatDateTime(security.createdAt) : 'Unknown'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Session generation</dt>
            <dd className="mt-0.5 text-navy-800 dark:text-slate-200">v{security.tokenVersion}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3.5 dark:bg-amber-500/10">
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Revoke all sessions</p>
            <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
              Use this if you suspect your account was accessed elsewhere.
            </p>
          </div>
          <button type="button" onClick={() => void onLogoutAll()} className="btn bg-amber-600 text-sm text-white hover:bg-amber-700">
            <LogOut className="h-4 w-4" /> Sign out everywhere
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary-600" />
          <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">
            Change password
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Changing your password signs out every other device. This browser stays signed in.
        </p>

        {formError && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {formError}
          </div>
        )}

        <form
          className="mt-4 grid gap-4 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPassword();
          }}
        >
          <Field label="Current password" htmlFor="current-password">
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={passwords.current}
              onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
              className="input"
            />
          </Field>
          <Field label="New password" htmlFor="new-password" hint="At least 8 characters.">
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={passwords.next}
              onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
              className="input"
            />
          </Field>
          <Field
            label="Confirm new password"
            htmlFor="confirm-password"
            error={
              passwords.confirm && passwords.next !== passwords.confirm
                ? 'Passwords do not match.'
                : undefined
            }
          >
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={passwords.confirm}
              onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
              className="input"
            />
          </Field>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={submitting} className="btn btn-primary text-sm">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --------------------------------- Platform -------------------------------- */

const PLATFORM_DEFAULTS: PlatformSettings = {
  platformName: 'Seva Connect',
  supportEmail: '',
  registrationOpen: true,
  maintenanceNotice: '',
  announcementBanner: '',
};

function PlatformPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSettings>(PLATFORM_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOne<PlatformSettings>('/admin/settings');
      if (!res.data) throw new Error(res.message || 'No settings returned.');
      setSettings({ ...PLATFORM_DEFAULTS, ...res.data });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load platform settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setFormError(null);
    if (settings.platformName.trim().length < 2) {
      setFormError('The platform name must be at least 2 characters.');
      return;
    }
    if (settings.supportEmail && !/^\S+@\S+\.\S+$/.test(settings.supportEmail.trim())) {
      setFormError('Enter a valid support email address or leave it blank.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiPatch<PlatformSettings>('/admin/settings', {
        platformName: settings.platformName.trim(),
        supportEmail: settings.supportEmail.trim(),
        registrationOpen: settings.registrationOpen,
        maintenanceNotice: settings.maintenanceNotice.trim(),
        announcementBanner: settings.announcementBanner.trim(),
      });
      if (res.data) setSettings({ ...PLATFORM_DEFAULTS, ...res.data });
      toast('success', 'Platform settings saved', 'Changes apply to public pages immediately.');
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not save platform settings.');
      setFormError(message);
      toast('error', 'Could not save settings', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary-600" />
        <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">
          Platform configuration
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        These values are served publicly and drive the banner and registration behaviour across the site.
      </p>

      {formError && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {formError}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Platform name" htmlFor="platform-name">
          <input
            id="platform-name"
            value={settings.platformName}
            onChange={(event) => setSettings({ ...settings, platformName: event.target.value })}
            maxLength={80}
            className="input"
          />
        </Field>
        <Field label="Support email" htmlFor="platform-email" hint="Shown to members who need help.">
          <input
            id="platform-email"
            type="email"
            value={settings.supportEmail}
            onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })}
            className="input"
            placeholder="support@sevaconnect.org"
          />
        </Field>
        <Field
          label="Announcement banner"
          htmlFor="platform-banner"
          hint="Short message shown at the top of public pages. Leave blank to hide."
          className="sm:col-span-2"
        >
          <input
            id="platform-banner"
            value={settings.announcementBanner}
            onChange={(event) => setSettings({ ...settings, announcementBanner: event.target.value })}
            maxLength={300}
            className="input"
            placeholder="Registrations for the winter drive are open!"
          />
        </Field>
        <Field
          label="Maintenance notice"
          htmlFor="platform-maintenance"
          hint="Shown when you need to explain a temporary disruption."
          className="sm:col-span-2"
        >
          <textarea
            id="platform-maintenance"
            value={settings.maintenanceNotice}
            onChange={(event) => setSettings({ ...settings, maintenanceNotice: event.target.value })}
            rows={3}
            maxLength={500}
            className="input resize-y"
            placeholder="We are performing scheduled maintenance between 02:00 and 04:00 UTC."
          />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-700/10 p-3.5 transition hover:border-primary-500/40 dark:border-white/10 sm:col-span-2">
          <input
            type="checkbox"
            checked={settings.registrationOpen}
            onChange={(event) => setSettings({ ...settings, registrationOpen: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded accent-primary-600"
          />
          <span>
            <span className="block text-sm font-medium text-navy-800 dark:text-slate-200">
              Registration open
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              When disabled, new registrations are refused with a clear message. Existing members are unaffected.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save platform settings'}
        </button>
      </div>
    </div>
  );
}
