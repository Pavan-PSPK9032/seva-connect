import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarCheck,
  Clock,
  Globe2,
  Mail,
  MapPin,
  UsersRound,
} from 'lucide-react';
import { apiGetOne, apiErrorMessage } from '../services/api';
import type { NGO } from '../types';
import EventCard from '../components/EventCard';
import Spinner from '../components/Spinner';

function websiteHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function NGOProfile() {
  const { id } = useParams();
  const [ngo, setNgo] = useState<NGO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await apiGetOne<NGO>(`/ngos/${id}`);
        if (active) setNgo(res.data ?? null);
      } catch (err) {
        if (active) setError(apiErrorMessage(err, 'This organisation could not be found.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container-x py-20">
        <Spinner label="Loading organisation" />
      </div>
    );
  }

  if (error || !ngo) {
    return (
      <div className="container-x py-20">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h1 className="mt-4 font-display text-xl font-semibold text-navy-800 dark:text-white">Organisation unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error || 'This organisation could not be found.'}</p>
          <Link to="/ngos" className="btn-outline mt-6">
            <ArrowLeft className="h-4 w-4" /> Back to NGOs
          </Link>
        </div>
      </div>
    );
  }

  const events = (ngo.events ?? []).map((event) => ({
    ...event,
    ngoName: ngo.organizationName,
    ngoVerified: ngo.verified,
    ngoLogo: ngo.logo,
  }));

  return (
    <div>
      <section className="bg-navy-900 py-14 text-white">
        <div className="container-x">
          <Link to="/ngos" className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All NGOs
          </Link>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 to-navy-700 font-display text-3xl font-bold text-white">
              {ngo.logo ? (
                <img src={ngo.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                ngo.organizationName.trim().charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{ngo.organizationName}</h1>
                {ngo.verified ? (
                  <span className="chip bg-primary-500/20 text-primary-200">
                    <BadgeCheck className="h-4 w-4" /> Verified
                  </span>
                ) : (
                  <span className="chip bg-white/10 text-slate-300">Pending verification</span>
                )}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-slate-300">
                <MapPin className="h-4 w-4 text-primary-400" /> {ngo.location}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {ngo.causes.map((cause) => (
                  <span key={cause} className="chip bg-white/10 text-slate-200">{cause}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-x grid gap-6 py-10 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">About the organisation</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-400">{ngo.description}</p>
          <div className="mt-6 flex flex-wrap gap-5 border-t border-navy-700/10 pt-5 text-sm dark:border-white/10">
            {ngo.website && (
              <a
                href={websiteHref(ngo.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary-700 hover:underline dark:text-primary-300"
              >
                <Globe2 className="h-4 w-4" /> Website
              </a>
            )}
            {ngo.contactEmail && (
              <a href={`mailto:${ngo.contactEmail}`} className="flex items-center gap-2 text-primary-700 hover:underline dark:text-primary-300">
                <Mail className="h-4 w-4" /> Contact
              </a>
            )}
            {ngo.verifiedAt && (
              <span className="flex items-center gap-2 text-slate-500">
                <BadgeCheck className="h-4 w-4 text-primary-600" /> Verified {new Date(ngo.verifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            { Icon: Clock, label: 'Verified hours', value: ngo.stats?.verifiedHours ?? 0 },
            { Icon: CalendarCheck, label: 'Completed events', value: ngo.stats?.completedEvents ?? 0 },
            { Icon: UsersRound, label: 'Contributing volunteers', value: ngo.stats?.activeVolunteers ?? 0 },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="card flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-navy-800 dark:text-white">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-12 dark:bg-navy-900">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Get involved</p>
              <h2 className="mt-1 section-title">Upcoming opportunities</h2>
            </div>
            <Link to={`/events?ngoId=${ngo._id}`} className="btn-outline">View all events</Link>
          </div>
          {events.length === 0 ? (
            <div className="card mt-6 p-10 text-center">
              <CalendarCheck className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 font-display font-semibold text-navy-800 dark:text-white">No open opportunities right now</p>
              <p className="mt-1 text-sm text-slate-500">Check back soon or explore other NGOs making a difference.</p>
              <Link to="/events" className="btn-primary mt-5">Explore all opportunities</Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
