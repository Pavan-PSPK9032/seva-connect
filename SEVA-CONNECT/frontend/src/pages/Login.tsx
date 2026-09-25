import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HeartHandshake, Loader2, LogIn } from 'lucide-react';
import { useAuth, apiErrorMessage } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      toast('success', `Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/');
    } catch (err) {
      const message = apiErrorMessage(err, 'Login failed. Please try again.');
      setServerError(message);
      toast('error', 'Login failed', message);
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
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {serverError}
          </div>
        )}

        {import.meta.env.PROD ? (
          <p className="mt-6 rounded-xl bg-navy-50 px-4 py-3 text-center text-xs text-navy-600 dark:bg-white/5 dark:text-slate-400">
            Accounts are created via registration. Use your email and password to sign in.
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
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {isSubmitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          New to Seva Connect?{' '}
          <Link to="/register" className="font-semibold text-primary-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}