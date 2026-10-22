import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, Loader2, Mail, MessageSquare, XCircle } from 'lucide-react';
import { apiGet, apiGetOne, apiPatch, apiErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { NotificationItem, NotificationPreferences, Pagination } from '../types';
import { CardSkeleton } from '../components/Skeleton';

const TYPE_TONE: Record<string, string> = {
  application_approved: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
  application_completed: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
  application_rejected: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  application_withdrawn: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  application_received: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

export default function Notifications() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const res = await apiGet<NotificationItem>('/notifications', { page: nextPage, limit: 20 });
      const incoming = res.data ?? [];
      setItems((prev) => (append ? [...prev, ...incoming] : incoming));
      setPagination(res.pagination ?? null);
      setUnread(res.unreadCount ?? 0);
      setPage(nextPage);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(1, false);
    apiGetOne<NotificationPreferences>('/notifications/preferences')
      .then((res) => setPrefs(res.data ?? null))
      .catch(() => undefined);
  }, [load]);

  const open = async (item: NotificationItem) => {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
      setUnread((n) => Math.max(0, n - 1));
      apiPatch(`/notifications/${item._id}/read`, {}).catch(() => undefined);
    }
    if (item.link) navigate(item.link);
  };

  const markAll = async () => {
    try {
      await apiPatch('/notifications/read-all', {});
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      toast('success', 'All caught up', 'Every notification is marked as read.');
    } catch (err) {
      toast('error', 'Could not update', apiErrorMessage(err));
    }
  };

  const togglePref = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await apiPatch('/notifications/preferences', next);
    } catch (err) {
      setPrefs(prefs);
      toast('error', 'Could not save preference', apiErrorMessage(err));
    }
  };

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Inbox</p>
          <h1 className="mt-2 section-title">Notifications</h1>
          <p className="section-sub">Application updates and platform announcements in one place.</p>
        </div>
        <button type="button" onClick={markAll} disabled={unread === 0} className="btn btn-outline">
          <CheckCheck className="h-4 w-4" /> Mark all read
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.7fr_1fr]">
        <div>
          {loading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : error ? (
            <div className="card p-8 text-center">
              <XCircle className="mx-auto h-9 w-9 text-red-400" />
              <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error}</p>
              <button type="button" onClick={() => load(1, false)} className="btn btn-outline mt-4">
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="card p-10 text-center">
              <Bell className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 font-semibold text-navy-800 dark:text-white">No notifications yet</p>
              <p className="mt-1 text-sm text-slate-500">Updates about your applications will appear here.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item._id}>
                    <button
                      type="button"
                      onClick={() => open(item)}
                      className={`w-full rounded-2xl border p-4 text-left transition hover:border-primary-300 ${
                        item.read
                          ? 'border-navy-700/10 bg-white dark:border-white/10 dark:bg-navy-800'
                          : 'border-primary-200 bg-primary-50/60 dark:border-primary-500/30 dark:bg-primary-500/5'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TYPE_TONE[item.type] ?? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                          {item.read ? <Bell className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-sm ${item.read ? 'font-medium text-navy-700 dark:text-slate-200' : 'font-semibold text-navy-800 dark:text-white'}`}>
                              {item.title}
                            </p>
                            <span className="shrink-0 text-xs text-slate-400">
                              {new Date(item.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.message}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {pagination && page < pagination.pages && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => load(page + 1, true)}
                    disabled={loadingMore}
                    className="btn btn-outline"
                  >
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="card h-fit p-6">
          <h2 className="font-display text-base font-semibold text-navy-800 dark:text-white">Preferences</h2>
          <p className="mt-1 text-sm text-slate-500">Choose how you want to hear from us.</p>
          <div className="mt-4 space-y-3">
            <PrefRow
              icon={<Bell className="h-4 w-4" />}
              label="In-app notifications"
              description="Updates inside Seva Connect"
              checked={prefs?.inApp ?? true}
              onChange={() => togglePref('inApp')}
            />
            <PrefRow
              icon={<Mail className="h-4 w-4" />}
              label="Email digest"
              description="Occasional summary by email"
              checked={prefs?.email ?? false}
              onChange={() => togglePref('email')}
            />
            <PrefRow
              icon={<MessageSquare className="h-4 w-4" />}
              label="Event reminders"
              description="A reminder before your shifts"
              checked={prefs?.reminders ?? true}
              onChange={() => togglePref('reminders')}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PrefRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-navy-700/10 p-3 dark:border-white/10">
      <span className="text-primary-600 dark:text-primary-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-navy-800 dark:text-slate-200">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-navy-700/20 accent-primary-600"
      />
    </label>
  );
}
