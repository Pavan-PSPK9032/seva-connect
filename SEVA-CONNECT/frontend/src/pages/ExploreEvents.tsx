import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarOff, Search } from 'lucide-react';
import { apiGet, apiErrorMessage } from '../services/api';
import type { EventItem } from '../types';
import EventCard from '../components/EventCard';
import { GridSkeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';

export default function ExploreEvents() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('upcoming');
  const [online, setOnline] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const params: Record<string, string | boolean | undefined> = { limit: '12', status };
        if (query.trim()) params.q = query.trim();
        if (online) params.online = 'true';
        const res = await apiGet<EventItem>('/events', params);
        if (!active) return;
        setEvents(res.data ?? []);
      } catch (err) {
        if (active) {
          setError(apiErrorMessage(err));
          toast('error', 'Could not load events', apiErrorMessage(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query, status, online, toast]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="container-x py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Opportunities</p>
        <h1 className="mt-2 section-title">Explore volunteering events</h1>
        <p className="section-sub">Search by name, filter by cause, location and availability. Register for seats while they last.</p>
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center">
        <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border border-navy-700/10 bg-white p-2 shadow-soft sm:max-w-md dark:border-white/10 dark:bg-navy-800">
          <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, causes, cities…"
            className="w-full bg-transparent px-2 py-2 text-sm outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input w-auto"
            aria-label="Event status"
          >
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={online}
              onChange={(e) => setOnline(e.target.checked)}
              className="h-4 w-4 rounded border-navy-700/20 accent-primary-600"
            />
            Online events only
          </label>
        </div>
      </div>

      <div className="mt-10">
        {loading ? (
          <GridSkeleton count={6} />
        ) : error ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <CalendarOff className="h-10 w-10 text-red-400" />
            <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <CalendarOff className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 font-semibold text-navy-800 dark:text-white">No events match your filters</p>
            <p className="mt-1 text-sm text-slate-500">Try changing the search or clearing the online filter.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}