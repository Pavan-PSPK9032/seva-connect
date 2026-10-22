import { Link } from 'react-router-dom';
import { Database, Eye, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';

const SECTIONS = [
  {
    Icon: Database,
    title: 'What we collect',
    text: 'Account details you provide (name, email, phone, role), profile information such as skills, interests, location and availability, the NGOs and opportunities you interact with, applications and verified hours, and technical logs needed to operate and secure the service.',
  },
  {
    Icon: Eye,
    title: 'How we use it',
    text: 'To authenticate you, show relevant opportunities, process applications, let NGOs manage their programmes, issue certificates, send the notifications you enable, prevent abuse and produce aggregate impact statistics.',
  },
  {
    Icon: UserRound,
    title: 'What is public',
    text: 'NGO profiles and opportunity listings are public. A volunteer name, location and verified-hours total may appear on the public leaderboard unless the volunteer opts out from their profile. Email addresses, phone numbers and application notes are not published.',
  },
  {
    Icon: Lock,
    title: 'Storage and security',
    text: 'Passwords are stored as bcrypt hashes. Authentication uses signed tokens, and access to NGO and admin actions is checked on the server. Data is stored in a managed MongoDB database. No system is perfectly secure, so use a unique password and report concerns promptly.',
  },
  {
    Icon: Mail,
    title: 'Email preferences',
    text: 'In-app notifications are part of the service. Email copies are sent only when SMTP delivery is configured and you have enabled email notifications. You can change these preferences at any time from your profile.',
  },
  {
    Icon: ShieldCheck,
    title: 'Your choices',
    text: 'You can update your profile, opt out of the public leaderboard, change notification settings and request correction or deletion of your account by contacting us. Some records may be retained where needed for certificates, audit integrity or legal obligations.',
  },
];

export default function Privacy() {
  return (
    <div>
      <section className="bg-navy-900 py-14 text-white">
        <div className="container-x">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">Privacy policy</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold">Your data, explained plainly.</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            This policy describes how Seva Connect handles personal information. It reflects the features that exist in
            the platform today. Last updated: October 2026.
          </p>
        </div>
      </section>

      <section className="container-x grid gap-6 py-12 sm:grid-cols-2">
        {SECTIONS.map(({ Icon, title, text }) => (
          <div key={title} className="card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-navy-800 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
          </div>
        ))}
      </section>

      <section className="container-x pb-16">
        <div className="rounded-2xl border border-navy-700/10 bg-white p-6 text-sm leading-relaxed text-slate-600 dark:border-white/10 dark:bg-navy-800 dark:text-slate-300">
          <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Cookies and local storage</h2>
          <p className="mt-2">
            Seva Connect uses browser local storage to keep you signed in and remember your theme. We do not use
            advertising trackers. Clearing site data signs you out.
          </p>
          <h2 className="mt-5 font-display text-lg font-semibold text-navy-800 dark:text-white">Contact</h2>
          <p className="mt-2">
            Questions or requests: <a className="text-primary-700 hover:underline dark:text-primary-300" href="mailto:hello@sevaconnect.in">hello@sevaconnect.in</a>.
            See also our <Link className="text-primary-700 hover:underline dark:text-primary-300" to="/terms">terms of use</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
