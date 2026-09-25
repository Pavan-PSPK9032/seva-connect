import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '../utils/cn';

const FAQS = [
  {
    q: 'Is Seva Connect free to use?',
    a: 'Yes. Volunteers and NGOs can join and use the core platform for free. Donations you choose to make are processed securely through our payment gateway.',
  },
  {
    q: 'How is my volunteering verified?',
    a: 'Hours are recorded through event check-in and check-out, confirmed by the organizing NGO. Only verified records are used to calculate levels, badges and certificates.',
  },
  {
    q: 'How do I earn a certificate?',
    a: 'After an event you attended is completed and your attendance is verified, a certificate with a unique ID is issued automatically and appears in your dashboard.',
  },
  {
    q: 'Can an NGO create an account?',
    a: 'Yes. Register with the account type "NGO organization". You can then create events, manage registrations, mark attendance and issue certificates.',
  },
  {
    q: 'How are NGOs verified?',
    a: 'Organizations submit their details during registration. The platform admin reviews applications and issues a verified badge to approved organizations.',
  },
  {
    q: 'Is my personal information safe?',
    a: 'Passwords are hashed with bcrypt, tokens are signed JWTs, and sensitive data is never exposed to the frontend. All secrets live in environment variables, not in code.',
  },
  {
    q: 'What are volunteer levels and XP?',
    a: 'You earn XP from verified hours, events, causes and streaks. Levels — from New Volunteer to Community Leader — unlock as your XP grows.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="container-x mx-auto max-w-3xl py-14">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Help center</p>
        <h1 className="mt-2 section-title">Frequently asked questions</h1>
        <p className="mx-auto mt-3 section-sub">Everything you need to know about volunteering with Seva Connect.</p>
      </div>

      <div className="mt-10 space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
              >
                <span className="font-medium text-navy-800 dark:text-white">{item.q}</span>
                <ChevronDown className={cn('h-5 w-5 shrink-0 text-primary-600 transition-transform', isOpen && 'rotate-180')} />
              </button>
              <div className={cn('grid transition-all duration-300', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col items-center rounded-2xl bg-primary-50 p-8 text-center dark:bg-primary-500/10">
        <HelpCircle className="h-8 w-8 text-primary-600" />
        <h2 className="mt-3 font-display text-lg font-semibold text-navy-800 dark:text-white">Still have questions?</h2>
        <a href="/contact" className="btn-primary mt-4">Contact our team</a>
      </div>
    </div>
  );
}