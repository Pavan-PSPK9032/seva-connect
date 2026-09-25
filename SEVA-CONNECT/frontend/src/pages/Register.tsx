import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HeartHandshake, Loader2, UserPlus } from 'lucide-react';
import { useAuth, apiErrorMessage } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter at least 2 characters').max(60, 'Keep it under 60 characters'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/, 'Enter a valid phone number (optional)').optional().or(z.literal('')),
    role: z.enum(['volunteer', 'ngo'], { message: 'Choose an account type' }),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Keep it under 128 characters'),
    confirm: z.string(),
    skills: z.string().optional(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: registerAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'volunteer' },
  });

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    const skills = values.skills
      ? values.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    try {
      const user = await registerAccount({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
        role: values.role,
        skills,
      });
      toast('success', 'Account created!', `Welcome to Seva Connect, ${user.name.split(' ')[0]}.`);
      navigate('/');
    } catch (err) {
      const message = apiErrorMessage(err, 'Registration failed. Please try again.');
      setServerError(message);
      toast('error', 'Registration failed', message);
    }
  };

  return (
    <div className="container-x flex justify-center py-14">
      <div className="card w-full max-w-xl p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy-800 dark:text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Volunteers and NGOs both start here.</p>
        </div>

        {serverError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input id="name" type="text" autoComplete="name" className="input" placeholder="Asha Kumar" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" autoComplete="email" className="input" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="label">Phone (optional)</label>
              <input id="phone" type="tel" autoComplete="tel" className="input" placeholder="+91 98765 43210" {...register('phone')} />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
          </div>

          <div>
            <span className="label">I want to join as</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy-700/15 p-3 text-sm font-medium has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 has-[:checked]:text-primary-700 dark:border-white/15 dark:has-[:checked]:bg-primary-500/10 dark:has-[:checked]:text-primary-300">
                <input type="radio" value="volunteer" className="accent-primary-600" {...register('role')} />
                Volunteer
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-navy-700/15 p-3 text-sm font-medium has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 has-[:checked]:text-primary-700 dark:border-white/15 dark:has-[:checked]:bg-primary-500/10 dark:has-[:checked]:text-primary-300">
                <input type="radio" value="ngo" className="accent-primary-600" {...register('role')} />
                NGO organization
              </label>
            </div>
            {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
          </div>

          <div>
            <label htmlFor="skills" className="label">Skills (optional, comma separated)</label>
            <input id="skills" type="text" className="input" placeholder="Teaching, Healthcare, Design" {...register('skills')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" autoComplete="new-password" className="input" placeholder="Min 6 characters" {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <div>
              <label htmlFor="confirm" className="label">Confirm password</label>
              <input id="confirm" type="password" autoComplete="new-password" className="input" placeholder="Repeat password" {...register('confirm')} />
              {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm.message}</p>}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}