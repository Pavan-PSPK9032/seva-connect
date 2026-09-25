import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, MapPin } from 'lucide-react';
import type { NGO } from '../types';

export default function NGOCard({ ngo }: { ngo: NGO }) {
  return (
    <Link
      to={`/ngos?id=${ngo._id}`}
      className="card group flex h-full flex-col p-6 transition-all hover:-translate-y-1 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 font-display text-lg font-bold text-primary-700 group-hover:bg-primary-200 dark:bg-primary-500/20 dark:text-primary-300 dark:group-hover:bg-primary-500/30">
          {ngo.organizationName.trim().charAt(0).toUpperCase()}
        </div>
        {ngo.verified ? (
          <span className="chip bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        ) : (
          <span className="chip bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400">Pending</span>
        )}
      </div>

      <h3 className="mt-4 font-display text-lg font-semibold text-navy-800 group-hover:text-primary-700 dark:text-white">
        {ngo.organizationName}
      </h3>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <MapPin className="h-4 w-4 shrink-0" /> {ngo.location}
      </p>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{ngo.description}</p>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
        {ngo.causes.slice(0, 3).map((cause) => (
          <span key={cause} className="chip bg-navy-700/5 text-navy-700 dark:bg-white/10 dark:text-slate-300">
            {cause}
          </span>
        ))}
      </div>
    </Link>
  );
}

export function NGOCardEmpty() {
  return (
    <div className="card flex h-full flex-col items-center justify-center p-10 text-center">
      <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600" />
      <p className="mt-3 font-display font-semibold text-navy-800 dark:text-white">No NGOs found</p>
      <p className="mt-1 text-sm text-slate-500">Try a different search or clear the filters.</p>
    </div>
  );
}