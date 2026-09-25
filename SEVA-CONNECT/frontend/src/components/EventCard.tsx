import { CalendarDays, Clock, MapPin, UsersRound, Video } from 'lucide-react';
import type { EventItem } from '../types';

export default function EventCard({ event }: { event: EventItem }) {
  const date = new Date(event.date);
  const required = event.requiredVolunteers ?? 0;
  const registered = event.registeredVolunteers ?? 0;
  const spots = required - registered;
  const day = Number.isNaN(date.getTime()) ? '–' : date.getDate();
  const month = Number.isNaN(date.getTime())
    ? '–'
    : date.toLocaleString('en', { month: 'short' });

  return (
    <article className="card group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-card">
      <div className="relative flex h-32 items-end bg-gradient-to-br from-primary-600 via-primary-700 to-navy-800 px-5 pb-4">
        <div className="flex items-baseline gap-2 text-white">
          <span className="font-display text-4xl font-bold leading-none">{day}</span>
          <span className="text-sm font-semibold uppercase tracking-widest">{month}</span>
        </div>
        <div className="absolute right-4 top-4 flex gap-2">
          {event.online && (
            <span className="chip bg-white/20 text-white backdrop-blur">
              <Video className="h-3.5 w-3.5" /> Online
            </span>
          )}
          {event.status === 'completed' && <span className="chip bg-navy-900/60 text-white">Completed</span>}
        </div>
        {Number.isFinite(spots) && spots > 0 && spots <= 5 && (
          <span className="chip absolute bottom-4 right-4 bg-accent-500 text-white">Only {spots} seats left</span>
        )}
        {Number.isFinite(spots) && spots <= 0 && (
          <span className="chip absolute bottom-4 right-4 bg-red-600 text-white">Full</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold text-navy-800 group-hover:text-primary-700 dark:text-white">
          {event.title}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <UsersRound className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" /> {event.ngoName}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <MapPin className="h-4 w-4 shrink-0" /> {event.location}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Clock className="h-4 w-4 shrink-0" /> {event.time}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {Number.isNaN(date.getTime())
            ? ''
            : date.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <p className="mt-auto pt-4 text-sm font-medium text-navy-700 dark:text-slate-300">
          {Number.isFinite(spots) ? `${spots} of ${required} seats left` : ''}
        </p>
      </div>
    </article>
  );
}