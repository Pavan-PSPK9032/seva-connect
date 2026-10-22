import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  Bell,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { apiGetOne } from '../services/api';
import { cn } from '../utils/cn';

const LINKS: { to: string; label: string; icon?: LucideIcon }[] = [
  { to: '/', label: 'Home' },
  { to: '/ngos', label: 'NGOs' },
  { to: '/events', label: 'Events' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
  { to: '/chatbot', label: 'Seva AI', icon: Sparkles },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let active = true;
    const read = async () => {
      try {
        const res = await apiGetOne<{ unreadCount: number }>('/notifications/unread-count');
        if (active) setUnread(res.data?.unreadCount ?? 0);
      } catch {
        /* silent — the bell is non-critical */
      }
    };
    read();
    const timer = setInterval(read, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, location.pathname]);

  const initials = user
    ? user.name
        .split(' ')
        .map((p) => p.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  return (
    <header className="sticky top-0 z-50 border-b border-navy-700/10 bg-white/85 backdrop-blur-lg dark:border-white/10 dark:bg-navy-950/85 print:hidden">
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
                  'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-primary-700 dark:text-primary-400'
                    : 'text-navy-600 hover:bg-navy-700/5 hover:text-navy-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                )
              }
            >
              {link.icon && <link.icon className="h-4 w-4" />}
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {user && (
            <Link
              to="/notifications"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-navy-600 transition hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}
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
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <UserIcon className="h-4 w-4" /> Profile
                  </Link>
                  {user.role === 'volunteer' && (
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                  )}
                  <Link
                    to="/notifications"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    <Bell className="h-4 w-4" /> Notifications
                  </Link>
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      <ShieldCheck className="h-4 w-4" /> Admin
                    </Link>
                  )}
                  {(user.role === 'ngo' || user.role === 'admin') && (
                    <Link
                      to="/my-ngo"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      <HeartHandshake className="h-4 w-4" /> Manage NGO
                    </Link>
                  )}
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
          {user && (
            <Link
              to="/notifications"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-navy-600 dark:text-slate-300"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}
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
                  'flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400'
                    : 'text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10'
                )
              }
            >
              {link.icon && <link.icon className="h-4 w-4" />}
              {link.label}
            </NavLink>
            ))}
            {user && (
              <div className="mt-1 flex flex-col gap-1 border-t border-navy-700/10 pt-2 dark:border-white/10">
                {user.role === 'volunteer' && (
                  <NavLink to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10">
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </NavLink>
                )}
                <NavLink to="/notifications" onClick={() => setOpen(false)} className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10">
                  <Bell className="h-4 w-4" /> Notifications
                </NavLink>
                {user.role === 'admin' && (
                  <NavLink to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10">
                    <ShieldCheck className="h-4 w-4" /> Admin
                  </NavLink>
                )}
                {(user.role === 'ngo' || user.role === 'admin') && (
                  <NavLink to="/my-ngo" onClick={() => setOpen(false)} className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-700/5 dark:text-slate-300 dark:hover:bg-white/10">
                    <HeartHandshake className="h-4 w-4" /> Manage NGO
                  </NavLink>
                )}
              </div>
            )}
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