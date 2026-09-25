import { useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { HeartHandshake, LogOut, Menu, User as UserIcon, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/ngos', label: 'NGOs' },
  { to: '/events', label: 'Events' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = user
    ? user.name
        .split(' ')
        .map((p) => p.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  return (
    <header className="sticky top-0 z-50 border-b border-navy-700/10 bg-white/85 backdrop-blur-lg dark:border-white/10 dark:bg-navy-950/85">
      <nav className="container-x flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm">
            <HeartHandshake className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-navy-800 dark:text-white">
            Seva<span className="text-primary-600">Connect</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-primary-700 dark:text-primary-400'
                    : 'text-navy-600 hover:bg-navy-700/5 hover:text-navy-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 ring-2 ring-transparent transition hover:ring-primary-500/40 dark:bg-primary-500/20 dark:text-primary-300"
              >
                {initials}
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-navy-700/10 bg-white shadow-card dark:border-white/10 dark:bg-navy-800">
                  <div className="border-b border-navy-700/10 px-4 py-3 dark:border-white/10">
                    <p className="truncate text-sm font-semibold text-navy-800 dark:text-white">{user.name}</p>
                    <p className="truncate text-xs capitalize text-slate-500">{user.role}</p>
                  </div>
                  <Link
                    to="/"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <UserIcon className="h-4 w-4" /> Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                Log in
              </Link>
              <Link to="/register" className="btn-primary">
                Join now
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost h-10 w-10 rounded-full !px-0"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-navy-700/10 bg-white px-4 pb-5 pt-2 lg:hidden dark:border-white/10 dark:bg-navy-950">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400'
                      : 'text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="mt-2 flex gap-2 border-t border-navy-700/10 pt-3 dark:border-white/10">
              {user ? (
                <button type="button" onClick={() => { logout(); setOpen(false); }} className="btn-outline w-full">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="btn-outline flex-1">
                    Log in
                  </Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="btn-primary flex-1">
                    Join now
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}