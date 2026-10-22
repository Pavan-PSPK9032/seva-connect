import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarOff, ChevronLeft, ChevronRight, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { apiGet, apiErrorMessage } from '../services/api';
import type { EventItem, Pagination } from '../types';
import EventCard from '../components/EventCard';
import { GridSkeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';

const SORTS = [
  { value: 'soonest', label: 'Soonest first' },
  { value: 'newest', label: 'Recently added' },
  { value: 'deadline', label: 'Closing soon' },
  { value: 'popular', label: 'Most popular' },
];

export default function ExploreEvents() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('upcoming');
  const [online, setOnline] = useState(false);
  const [cause, setCause] = useState('');
  const [skill, setSkill] = useState('');
  const [hasSeats, setHasSeats] = useState(false);
  const [sort, setSort] = useState('soonest');
  const [ngoId, setNgoId] = useState('');
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setNgoId(searchParams.get('ngoId') || '');
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const params: Record<string, string | boolean | undefined> = {
          limit: '12',
          status,
          page: String(page),
          sort,
        };
        if (query.trim()) params.q = query.trim();
        if (online) params.online = 'true';
        if (cause.trim()) params.cause = cause.trim();
        if (skill.trim()) params.skill = skill.trim();
        if (hasSeats) params.hasSeats = 'true';
        if (ngoId) params.ngoId = ngoId;
        const res = await apiGet<EventItem>('/events', params);
        if (!active) return;
        setEvents(res.data ?? []);
        setPagination(res.pagination ?? null);
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
  }, [query, status, online, cause, skill, hasSeats, sort, ngoId, page, toast]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const reset = () => {
    setQuery('');
    setStatus('upcoming');
    setOnline(false);
    setCause('');
    setSkill('');
    setHasSeats(false);
    setSort('soonest');
    setNgoId('');
    setPage(1);
  };

  const activeFilters = [cause.trim(), skill.trim(), online ? 'Online' : '', hasSeats ? 'Seats available' : '', ngoId ? 'Organisation' : ''].filter(Boolean);

  return (
    <div className="container-x py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Opportunities</p>
        <h1 className="mt-2 section-title">Explore volunteering events</h1>
        <p className="section-sub">
          Search by name, cause, location or skill. Filter for online roles and available seats, then apply while places last.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border border-navy-700/10 bg-white p-2 shadow-soft dark:border-white/10 dark:bg-navy-800">
          <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search events, causes, cities…"
            className="w-full bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button type="submit" className="btn-primary !py-2">Search</button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="input w-auto"
            aria-label="Event status"
          >
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
          <input
            value={cause}
            onChange={(e) => {
              setCause(e.target.value);
              setPage(1);
            }}
            placeholder="Cause"
            className="input w-32"
            aria-label="Filter by cause"
          />
          <input
            value={skill}
            onChange={(e) => {
              setSkill(e.target.value);
              setPage(1);
            }}
            placeholder="Skill"
            className="input w-32"
            aria-label="Filter by skill"
          />
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="input w-auto"
            aria-label="Sort events"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={online}
              onChange={(e) => {
                setOnline(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-navy-700/20 accent-primary-600"
            />
            Online only
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-navy-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={hasSeats}
              onChange={(e) => {
                setHasSeats(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-navy-700/20 accent-primary-600"
            />
            Seats available
          </label>
          {activeFilters.length > 0 && (
            <button type="button" onClick={reset} className="btn-ghost !px-3 !py-1.5 text-xs">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {pagination ? `${pagination.total} opportunit${pagination.total === 1 ? 'y' : 'ies'}` : 'Loading…'}
        </p>
        {ngoId && (
          <button type="button" onClick={() => setNgoId('')} className="chip bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
            Organisation filter <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <GridSkeleton count={6} />
        ) : error ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <CalendarOff className="h-10 w-10 text-red-400" />
            <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <SlidersHorizontal className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 font-semibold text-navy-800 dark:text-white">No events match your filters</p>
            <p className="mt-1 text-sm text-slate-500">Try changing the search or clearing the filters.</p>
            <button type="button" onClick={reset} className="btn-outline mt-5">Clear filters</button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
            className="btn-outline !px-3"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.pages}</span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))}
            disabled={page >= pagination.pages}
            className="btn-outline !px-3"
            aria-label="Next page"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
