import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, HeartHandshake, Loader2, LogIn } from 'lucide-react';
import { useAuth, apiErrorMessage } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import type { Role } from '../types';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

function homeForRole(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'ngo') return '/my-ngo';
  return '/dashboard';
}

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const destination = (userRole: Role) => {
    const from = (location.state as { from?: string } | null)?.from;
    return from || homeForRole(userRole);
  };

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      toast('success', `Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(destination(user.role), { replace: true });
    } catch (err) {
      const message = apiErrorMessage(err, 'Login failed. Please try again.');
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const email = (err as { response?: { data?: { email?: string } } })?.response?.data?.email;

      if (code === 'EMAIL_NOT_VERIFIED') {
        toast('info', 'Email not verified', message);
        navigate('/verify-email', { state: { email: email || values.email } });
        return;
      }

      setServerError(message);
      toast('error', 'Login failed', message);
    }
  };

  const handleGoogle = async (credential: string, nonce: string) => {
    setServerError(null);
    try {
      const result = await loginWithGoogle(credential, nonce);
      toast(
        'success',
        result.isNewUser ? 'Account created' : `Welcome${result.isNewUser ? '' : ' back'}`,
        result.isNewUser
          ? `You are signed in as ${result.user.email}.`
          : `Signed in as ${result.user.email}.`
      );
      navigate(destination(result.user.role), { replace: true });
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const message = apiErrorMessage(err, 'Google sign-in failed. Please try again.');

      if (code === 'GOOGLE_LINK_REQUIRED') {
        toast('info', 'Use your password once', message);
      } else if (code === 'GOOGLE_ACCOUNT_CONFLICT') {
        toast('error', 'Google account conflict', message);
      } else {
        toast('error', 'Google sign-in failed', message);
      }
      setServerError(message);
    }
  };

  return (
    <div className="container-x flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800 dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Log in to track your impact and discover events.</p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            {serverError}
          </div>
        )}

        {import.meta.env.PROD ? (
          <p className="mt-6 rounded-xl bg-navy-50 px-4 py-3 text-center text-xs text-navy-600 dark:bg-white/5 dark:text-slate-400">
            Accounts are created via registration. Use your email and password, or continue with
            Google.
          </p>
        ) : (
          <p className="mt-6 rounded-xl bg-primary-50 px-4 py-3 text-center text-xs text-primary-800 dark:bg-primary-500/10 dark:text-primary-200">
            Demo credentials — <b>demo@sevaconnect.com / 123456</b> (volunteer) or <b>admin@sevaconnect.com / admin123</b> (admin).
            Passwords are stored hashed; no password is kept in LocalStorage.
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label">Password</label>
              <Link to="/forgot-password" className="mb-1.5 text-xs font-medium text-primary-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="input pr-11"
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {isSubmitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-navy-700/10 dark:bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
          <span className="h-px flex-1 bg-navy-700/10 dark:bg-white/10" />
        </div>

        <GoogleSignInButton onCredential={handleGoogle} disabled={isSubmitting} />

        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
          If you already have a password account with the same email, log in with your password
          first. For your security, Google is never linked automatically.
        </p>

        <p className="mt-4 text-center text-sm text-slate-500">
          New to Seva Connect?{' '}
          <Link to="/register" className="font-semibold text-primary-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
