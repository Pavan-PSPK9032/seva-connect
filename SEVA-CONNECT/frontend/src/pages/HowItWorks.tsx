import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarCheck,
  ClipboardList,
  FileBadge,
  HeartHandshake,
  Search,
  ShieldCheck,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react';

const VOLUNTEER_STEPS = [
  {
    Icon: UserRoundPlus,
    title: 'Create your profile',
    text: 'Add your skills, availability and the causes you care about. Your profile helps surface opportunities that fit.',
  },
  {
    Icon: Search,
    title: 'Discover opportunities',
    text: 'Search live opportunities by cause, location, skill or date. Every listing belongs to a registered NGO.',
  },
  {
    Icon: ClipboardList,
    title: 'Apply with a note',
    text: 'Send a short application. NGOs review requests and approve volunteers up to the event capacity.',
  },
  {
    Icon: CalendarCheck,
    title: 'Volunteer and get verified',
    text: 'After the activity, the NGO records your attendance and verified hours.',
  },
  {
    Icon: FileBadge,
    title: 'Download your certificate',
    text: 'Completed activities generate a verifiable certificate with a unique public link you can share.',
  },
];

const NGO_STEPS = [
  {
    Icon: BadgeCheck,
    title: 'Register your organisation',
    text: 'Create an NGO account and submit your organisation profile for administrator review.',
  },
  {
    Icon: CalendarCheck,
    title: 'Publish opportunities',
    text: 'Describe the role, required skills, capacity, date and application deadline.',
  },
  {
    Icon: UsersRound,
    title: 'Review applications',
    text: 'Approve or decline volunteers, message applicants and track capacity in one place.',
  },
  {
    Icon: HeartHandshake,
    title: 'Record impact',
    text: 'Mark activities complete and credit verified hours. Certificates are issued automatically.',
  },
];

function StepList({ steps }: { steps: typeof VOLUNTEER_STEPS }) {
  return (
    <ol className="mt-8 space-y-4">
      {steps.map(({ Icon, title, text }, index) => (
        <li key={title} className="flex gap-4 rounded-2xl border border-navy-700/10 bg-white p-5 dark:border-white/10 dark:bg-navy-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Step {index + 1}</p>
            <h3 className="mt-1 font-display font-semibold text-navy-800 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function HowItWorks() {
  return (
    <div>
      <section className="bg-navy-900 py-16 text-white">
        <div className="container-x">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">How it works</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            From good intentions to <span className="text-primary-400">verified impact</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Seva Connect keeps the full volunteering lifecycle in one place: discovery, application, approval,
            attendance, verified hours and certificates.
          </p>
        </div>
      </section>

      <section className="container-x grid gap-10 py-16 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-navy-800 dark:text-white">For volunteers</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Give time. Track what it achieved.</p>
            </div>
          </div>
          <StepList steps={VOLUNTEER_STEPS} />
          <Link to="/register" className="btn-primary mt-6">
            Join as a volunteer
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-700 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-navy-800 dark:text-white">For NGOs</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Run programmes with a clear audit trail.</p>
            </div>
          </div>
          <StepList steps={NGO_STEPS} />
          <Link to="/register" className="btn-outline mt-6">
            Register your NGO
          </Link>
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-navy-900">
        <div className="container-x grid gap-6 sm:grid-cols-3">
          {[
            { title: 'Verified organisations', text: 'Administrators review NGO profiles before they earn a verified badge.' },
            { title: 'Real, computed metrics', text: 'Hours and impact figures come from completed activities, never hardcoded numbers.' },
            { title: 'Shareable proof', text: 'Each certificate has a unique public verification page and can be exported as a PDF.' },
          ].map((item) => (
            <div key={item.title} className="card p-6">
              <h3 className="font-display font-semibold text-navy-800 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
