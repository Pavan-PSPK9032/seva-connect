import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container-x flex flex-col items-center py-24 text-center">
      <Compass className="h-16 w-16 text-primary-600" />
      <h1 className="mt-6 font-display text-6xl font-extrabold text-navy-800 dark:text-white">404</h1>
      <p className="mt-3 max-w-md text-slate-500">
        The page you&apos;re looking for drifted off course. Let&apos;s get you back to where the good work happens.
      </p>
      <Link to="/" className="btn-primary mt-8">
        Back to home
      </Link>
    </div>
  );
}