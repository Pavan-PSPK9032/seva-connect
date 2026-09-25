import { useState, type FormEvent } from 'react';
import { Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Contact() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast('error', 'Missing details', 'Please fill in your name, email and message.');
      return;
    }
    toast('info', 'Message received', 'Contact messages are delivered as soon as the notifications service is wired up (a later phase).');
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  const channels = [
    { Icon: Mail, label: 'Email us', value: 'hello@sevaconnect.in' },
    { Icon: Phone, label: 'Call us', value: '+91 98765 43210' },
    { Icon: MapPin, label: 'Head office', value: 'Mumbai, Maharashtra, India' },
  ];

  return (
    <div className="container-x py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Contact</p>
        <h1 className="mt-2 section-title">We&apos;d love to hear from you</h1>
        <p className="section-sub">Questions, partnership ideas, or feedback — reach out and we will get back to you.</p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          {channels.map(({ Icon, label, value }) => (
            <div key={label} className="card flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-0.5 font-medium text-navy-800 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live support</p>
              <p className="mt-0.5 font-medium text-navy-800 dark:text-white">Ask the Seva AI chatbot anytime</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6 lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="c-name" className="label">Your name</label>
              <input id="c-name" value={form.name} onChange={set('name')} className="input" placeholder="Asha Kumar" />
            </div>
            <div>
              <label htmlFor="c-email" className="label">Your email</label>
              <input id="c-email" type="email" value={form.email} onChange={set('email')} className="input" placeholder="you@example.com" />
            </div>
          </div>
          <div>
            <label htmlFor="c-subject" className="label">Subject</label>
            <input id="c-subject" value={form.subject} onChange={set('subject')} className="input" placeholder="Partnership inquiry" />
          </div>
          <div>
            <label htmlFor="c-message" className="label">Message</label>
            <textarea id="c-message" rows={5} value={form.message} onChange={set('message')} className="input resize-none" placeholder="Tell us how we can help…" />
          </div>
          <button type="submit" className="btn-primary">
            <Send className="h-4 w-4" /> Send message
          </button>
        </form>
      </div>
    </div>
  );
}