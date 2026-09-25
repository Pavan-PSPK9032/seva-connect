import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Send,
  Twitter,
  Youtube,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Footer() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');

  const subscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast('info', 'Newsletter noted', 'Email sending arrives with the notifications phase.');
    setEmail('');
  };

  const quickLinks = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About Us' },
    { to: '/ngos', label: 'Explore NGOs' },
    { to: '/events', label: 'Explore Events' },
  ];
  const supportLinks = [
    { to: '/faq', label: 'FAQ' },
    { to: '/contact', label: 'Contact Us' },
    { to: '/login', label: 'Log in' },
    { to: '/register', label: 'Join as Volunteer' },
  ];

  const socials = [
    { Icon: Facebook, label: 'Facebook' },
    { Icon: Twitter, label: 'Twitter / X' },
    { Icon: Instagram, label: 'Instagram' },
    { Icon: Linkedin, label: 'LinkedIn' },
    { Icon: Youtube, label: 'YouTube' },
  ];

  return (
    <footer className="bg-navy-950 text-slate-300">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-xl font-bold text-white">
            Seva<span className="text-primary-400">Connect</span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
            One platform to discover opportunities, track your impact, and connect NGOs, volunteers, donors and
            administrators.
          </p>
          <div className="mt-5 flex gap-2">
            {socials.map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 transition hover:bg-primary-600 hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-white">Platform</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {quickLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="text-slate-400 transition hover:text-primary-400">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-white">Get involved</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {supportLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="text-slate-400 transition hover:text-primary-400">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-wider text-white">Contact</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" /> Mumbai, Maharashtra, India
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-primary-400" /> hello@sevaconnect.in
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary-400" /> +91 98765 43210
            </li>
          </ul>
          <form onSubmit={subscribe} className="mt-5">
            <label htmlFor="newsletter" className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Stay updated
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="newsletter"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              />
              <button type="submit" aria-label="Subscribe" className="btn-primary !rounded-xl !px-3.5">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-xs text-slate-500 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Seva Connect. Built for a better tomorrow.</p>
          <p>
            Made with <span className="text-primary-400">love</span> by volunteers, for volunteers.
          </p>
        </div>
      </div>
    </footer>
  );
}