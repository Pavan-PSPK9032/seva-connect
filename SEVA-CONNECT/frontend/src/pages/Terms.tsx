import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, FileBadge, HeartHandshake, Scale, UserCog } from 'lucide-react';

const SECTIONS = [
  {
    Icon: HeartHandshake,
    title: 'Using the platform',
    text: 'Seva Connect connects volunteers with organisations that publish service opportunities. You must provide accurate account information, use the platform lawfully, and treat other members with respect.',
  },
  {
    Icon: BadgeCheck,
    title: 'Organisation verification',
    text: 'A verified badge means an administrator reviewed the organisation profile. It is not an endorsement, a guarantee of outcomes, or a substitute for your own due diligence before participating in an activity.',
  },
  {
    Icon: UserCog,
    title: 'Accounts and access',
    text: 'You are responsible for activity under your account and for keeping your password confidential. NGO and admin capabilities are role-restricted on the server. Accounts may be suspended for abuse, fraud or repeated policy violations.',
  },
  {
    Icon: FileBadge,
    title: 'Applications, hours and certificates',
    text: 'Applying does not guarantee a place. Organisations decide who to approve. Verified hours are recorded only after an organisation marks an activity complete. Certificates reflect the information recorded at that time and include a public verification link.',
  },
  {
    Icon: Scale,
    title: 'Content and liability',
    text: 'Organisations are responsible for the accuracy of their listings and for the safe conduct of their activities. The platform is provided on an as-available basis. To the extent permitted by law, Seva Connect is not liable for indirect losses arising from participation in third-party activities.',
  },
  {
    Icon: AlertTriangle,
    title: 'Changes and termination',
    text: 'Features and these terms may change as the platform develops. Material changes will be reflected on this page. You may stop using the service at any time and request account deletion by contacting us.',
  },
];

export default function Terms() {
  return (
    <div>
      <section className="bg-navy-900 py-14 text-white">
        <div className="container-x">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">Terms of use</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold">Clear rules for shared service.</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            These terms apply to volunteers, NGOs and administrators who use Seva Connect. Last updated: October 2026.
          </p>
        </div>
      </section>

      <section className="container-x grid gap-6 py-12 sm:grid-cols-2">
        {SECTIONS.map(({ Icon, title, text }) => (
          <div key={title} className="card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-700/10 text-navy-700 dark:bg-white/10 dark:text-slate-200">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-navy-800 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
          </div>
        ))}
      </section>

      <section className="container-x pb-16">
        <div className="rounded-2xl border border-navy-700/10 bg-white p-6 text-sm leading-relaxed text-slate-600 dark:border-white/10 dark:bg-navy-800 dark:text-slate-300">
          <h2 className="font-display text-lg font-semibold text-navy-800 dark:text-white">Acceptable use</h2>
          <p className="mt-2">
            Do not submit false applications, impersonate another person or organisation, scrape personal data, upload
            malicious code, or use the platform to harass, discriminate or commit fraud. Report suspicious listings to{' '}
            <a className="text-primary-700 hover:underline dark:text-primary-300" href="mailto:hello@sevaconnect.in">hello@sevaconnect.in</a>.
          </p>
          <p className="mt-5">
            Read our <Link className="text-primary-700 hover:underline dark:text-primary-300" to="/privacy">privacy policy</Link> to
            understand how personal information is handled.
          </p>
        </div>
      </section>
    </div>
  );
}
