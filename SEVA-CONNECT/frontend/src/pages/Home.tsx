import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  HeartHandshake,
  Info,
  MapPin,
  Megaphone,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { apiGet, apiGetOne } from '../services/api';
import type { Announcement, EventItem, NGO, PlatformSettings, PlatformStats } from '../types';
import NGOCard from '../components/NGOCard';
import EventCard from '../components/EventCard';
import { GridSkeleton } from '../components/Skeleton';

const STEPS = [
  {
    Icon: HeartHandshake,
    title: 'Create your profile',
    text: 'Sign up as a volunteer or NGO and tell us your skills, interests and location.',
  },
  {
    Icon: Search,
    title: 'Discover opportunities',
    text: 'Search verified NGOs and upcoming events, filtered by cause, location and availability.',
  },
  {
    Icon: CalendarDays,
    title: 'Apply to serve',
    text: 'Send an application, get confirmed by the NGO, and see your schedule in one dashboard.',
  },
  {
    Icon: Award,
    title: 'Track your impact',
    text: 'Verified hours from completed events build an honest record of your service.',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ngoRes, eventRes, statsRes] = await Promise.all([
          apiGet<NGO>('/ngos', { limit: 3, verified: true, sort: 'name', order: 'asc' }),
          apiGet<EventItem>('/events', { limit: 3, status: 'upcoming' }),
          apiGetOne<PlatformStats>('/stats/public'),
        ]);
        if (!active) return;
        setNgos(ngoRes.data ?? []);
        setEvents(eventRes.data ?? []);
        setPlatform(statsRes.data ?? null);
      } catch {
        if (active) setError('We could not reach the server. Is the backend running?');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Platform notices are non-critical: a failure here must never block the page.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [settingsRes, announcementRes] = await Promise.all([
          apiGetOne<PlatformSettings>('/settings'),
          apiGet<Announcement>('/announcements'),
        ]);
        if (!active) return;
        setSettings(settingsRes.data ?? null);
        setAnnouncements(announcementRes.data ?? []);
      } catch {
        /* the banner and notices simply stay hidden */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const bannerText = settings?.announcementBanner?.trim() || '';
  const maintenanceText = settings?.maintenanceNotice?.trim() || '';

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/events?q=${encodeURIComponent(search.trim())}`);
  };

  const stat = (value: number | undefined, ready: boolean) =>
    ready && typeof value === 'number' ? new Intl.NumberFormat('en').format(value) : '—';

  const stats = [
    { label: 'Verified NGOs', value: stat(platform?.verifiedNgos, Boolean(platform)) },
    { label: 'Active opportunities', value: stat(platform?.activeEvents, Boolean(platform)) },
    { label: 'Verified volunteer hours', value: stat(platform?.verifiedHours, Boolean(platform)) },
    { label: 'Volunteers onboard', value: stat(platform?.volunteers, Boolean(platform)) },
  ];

  return (
    <div>
      {!bannerDismissed && (bannerText || maintenanceText) && (
        <div
          role="status"
          className={`print:hidden ${
            maintenanceText
              ? 'bg-amber-500 text-amber-950'
              : 'bg-primary-700 text-white'
          }`}
        >
          <div className="container-x flex items-start gap-3 py-2.5 text-sm">
            {maintenanceText ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="flex-1">{maintenanceText || bannerText}</p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss announcement"
              className="rounded-full p-1 transition hover:bg-black/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-600/30 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="container-x relative py-20 sm:py-28">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="chip bg-white/10 text-primary-300">
              <Sparkles className="h-3.5 w-3.5" /> AI-powered social impact
            </span>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">
              Small acts of service, <span className="text-primary-400">measurable impact</span>.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-300">
              Seva Connect connects volunteers, NGOs, donors and administrators on one platform — to discover
              opportunities, track verified hours, earn certificates and build real change together.
            </p>

            <form onSubmit={submitSearch} className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-card dark:bg-white">
              <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events, causes, cities…"
                className="w-full bg-transparent px-2 py-2.5 text-sm text-navy-800 outline-none placeholder:text-slate-400"
              />
              <button type="submit" className="btn-primary shrink-0">
                Search
              </button>
            </form>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#events" className="btn-accent">
                Explore events <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#ngos" className="btn bg-white/10 text-white hover:bg-white/20">
                Meet the NGOs
              </a>
            </div>

            <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-sm text-slate-400">{s.label}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-primary-400">{s.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>
      </section>

      {/* Featured NGOs */}
      <section id="ngos" className="container-x py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Partner organizations</p>
            <h2 className="mt-2 section-title">Featured NGOs</h2>
            <p className="section-sub">Verified organizations shaping communities across the country.</p>
          </div>
          <a href="/ngos" className="btn-outline">
            View all NGOs <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-10">
          {loading ? (
            <GridSkeleton count={3} />
          ) : error ? (
            <div className="card flex flex-col items-center p-12 text-center">
              <BadgeCheck className="h-10 w-10 text-red-400" />
              <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error}</p>
              <p className="text-sm text-slate-500">Start the backend with <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run dev</code> and this becomes live data.</p>
            </div>
          ) : ngos.length === 0 ? (
            <div className="card p-12 text-center text-slate-500">No NGOs to show yet. Seed the database to get started.</div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {ngos.map((ngo) => (
                <NGOCard key={ngo._id} ngo={ngo} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Upcoming events */}
      <section id="events" className="bg-white py-20 dark:bg-navy-900">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Make a difference</p>
              <h2 className="mt-2 section-title">Upcoming volunteering events</h2>
              <p className="section-sub">Real opportunities from real NGOs. Your hours become verified impact.</p>
            </div>
            <a href="/events" className="btn-outline">
              View all events <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-10">
            {loading ? (
              <GridSkeleton count={3} />
            ) : error ? (
              <div className="card flex flex-col items-center p-12 text-center">
                <MapPin className="h-10 w-10 text-red-400" />
                <p className="mt-3 font-semibold text-navy-800 dark:text-white">{error}</p>
              </div>
            ) : events.length === 0 ? (
              <div className="card p-12 text-center text-slate-500">
                No upcoming events right now — check back soon.
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
      </section>

      {/* Platform announcements */}
      {announcements.length > 0 && (
        <section className="container-x pt-16" aria-labelledby="announcements-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary-600">
                <Megaphone className="h-4 w-4" /> Platform notices
              </p>
              <h2 id="announcements-heading" className="mt-2 section-title">
                What&apos;s happening at Seva Connect
              </h2>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {announcements.map((announcement) => (
              <article key={announcement._id} className="card flex flex-col p-5">
                <h3 className="font-display text-base font-semibold text-navy-800 dark:text-white">
                  {announcement.title}
                </h3>
                <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {announcement.message}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <time
                    dateTime={announcement.publishedAt || announcement.createdAt}
                    className="text-xs text-slate-400"
                  >
                    {new Date(announcement.publishedAt || announcement.createdAt).toLocaleDateString('en', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                  {announcement.link &&
                    (announcement.link.startsWith('http') ? (
                      <a
                        href={announcement.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-primary-600 hover:underline"
                      >
                        Learn more <ArrowRight className="inline h-3 w-3" />
                      </a>
                    ) : (
                      <Link
                        to={announcement.link}
                        className="text-xs font-semibold text-primary-600 hover:underline"
                      >
                        Learn more <ArrowRight className="inline h-3 w-3" />
                      </Link>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="container-x py-20">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">How Seva Connect works</p>
          <h2 className="mt-2 section-title">From intention to impact</h2>
          <p className="mx-auto mt-3 section-sub">Four simple steps between wanting to help and making it count.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="card p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                <Icon className="h-6 w-6" />
              </div>
              <p className="mt-4 font-display font-semibold text-navy-800 dark:text-white">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-x pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-navy-800 px-8 py-14 text-center text-white sm:px-14">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <Users className="mx-auto h-10 w-10 text-primary-300" />
          <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Ready to make a difference?</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-100">
            Join volunteers turning skills into service — and help NGOs build thriving communities.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-accent">
              Create free account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/ngos" className="btn bg-white/15 text-white hover:bg-white/25">
              Explore NGOs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}