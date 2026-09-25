import { Eye, HeartHandshake, Leaf, Rocket, Target, Users } from 'lucide-react';

const VALUES = [
  { Icon: Target, title: 'Our mission', text: 'Make volunteering accessible, verifiable and rewarding for every person in India who wants to serve.' },
  { Icon: Eye, title: 'Our vision', text: 'A world where help is easy to give, impact is measured in lives changed, and trust powers every connection.' },
  { Icon: Leaf, title: 'Social impact goals', text: 'Drive millions of verified volunteer hours into education, health, environment, and livelihoods by 2030.' },
  { Icon: Rocket, title: 'Platform objectives', text: 'One account across volunteering, event management, attendance, certificates, donations and analytics.' },
];

const TEAM = [
  { name: 'Ananya Sharma', role: 'Founder & Product Lead', bio: 'Ex-volunteer coordinator turned technologist, championing community-led development.' },
  { name: 'Rohan Mehta', role: 'Engineering Lead', bio: 'Full-stack engineer focused on secure, scalable and observable systems.' },
  { name: 'Priya Iyer', role: 'NGO Partnerships', bio: 'Connects grassroots organizations with technology and volunteers at scale.' },
  { name: 'Kabir Singh', role: 'Design & Community', bio: 'Designs experiences that make service feel simple, warm and joyful.' },
];

export default function About() {
  return (
    <div>
      <section className="bg-navy-900 py-16 text-white">
        <div className="container-x">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">About Seva Connect</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            Technology in service of <span className="text-primary-400">service</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Seva Connect began with a simple question: why is it so hard for people who want to help to find people who
            need help? We built one platform to answer it.
          </p>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {VALUES.map(({ Icon, title, text }) => (
            <div key={title} className="card p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold text-navy-800 dark:text-white">{title}</h2>
              <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-navy-900">
        <div className="container-x">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Who we are</p>
            <h2 className="mt-2 section-title">Meet the team</h2>
            <p className="mx-auto mt-3 section-sub">A small team that believes deeply in the power of collective action.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((member) => (
              <div key={member.name} className="card p-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-navy-700 font-display text-xl font-bold text-white">
                  {member.name.split(' ').map((p) => p.charAt(0)).join('')}
                </div>
                <h3 className="mt-4 font-display font-semibold text-navy-800 dark:text-white">{member.name}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary-600">{member.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{member.bio}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center rounded-3xl bg-gradient-to-br from-primary-600 to-navy-800 px-8 py-12 text-center text-white">
            <Users className="h-10 w-10 text-primary-300" />
            <h2 className="mt-4 font-display text-2xl font-bold sm:text-3xl">Join the movement</h2>
            <p className="mt-2 max-w-xl text-primary-100">Whether you give an hour or a lifetime, Seva Connect is your home for meaningful action.</p>
            <a href="/register" className="btn-accent mt-6">
              <HeartHandshake className="h-4 w-4" /> Get started free
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}