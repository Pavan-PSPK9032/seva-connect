# SEVA CONNECT

AI-powered NGO Volunteer Management and Social Impact Platform.

Seva Connect connects **volunteers, NGOs, donors and administrators** through a centralized system for managing
volunteering opportunities, events, attendance, certificates, donations and community engagement.

## Tech stack

| Layer      | Technology                                                                    |
| ---------- | ----------------------------------------------------------------------------- |
| Frontend   | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, React Router, Axios   |
| Backend    | Node.js, Express, MongoDB Atlas, Mongoose, JWT + bcrypt, Socket.IO             |
| Extras     | Recharts (analytics), React Hook Form + Zod (forms), Lucide (icons)            |

## Project layout

```
SEVA-CONNECT/
├── frontend/            # React + Vite + TypeScript application
│   ├── src/
│   │   ├── components/  # Navbar, Footer, cards, skeletons, toasts
│   │   ├── layouts/     # PublicLayout (navbar + footer shell)
│   │   ├── pages/       # Home, NGOs, Events, Login, Register, About, Contact, FAQ
│   │   ├── context/     # Auth, theme and toast providers (hooks)
│   │   ├── services/    # Axios API client + interceptors
│   │   ├── types/       # Shared TypeScript interfaces
│   │   └── utils/
│   └── vite.config.ts   # /api proxy → localhost:5000
└── backend/             # Node.js + Express + MongoDB API
    ├── config/          # db.js (Atlas connection), cors.js
    ├── models/          # User, NGO, Event (more in later phases)
    ├── controllers/     # auth, ngos, events
    ├── routes/          # /api/auth, /api/ngos, /api/events
    ├── middleware/      # JWT auth, role authorization, validation
    ├── sockets/         # Socket.IO (JWT-authenticated real-time layer)
    ├── seeds/           # npm run seed — demo users, NGOs, events
    ├── utils/           # JWT signing
    ├── app.js           # Express app (middleware + routes + errors)
    └── server.js        # Entry point (DB + HTTP + Socket.IO)
```

## Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB on `localhost:27017`), with the connection string in hand
- npm

## Setup — backend

```bash
cd backend
npm install
copy .env.example .env     # then edit .env
```

`.env` needs:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/sevaconnect?retryWrites=true&w=majority
JWT_SECRET=<long random string>
```

Optional: `CLIENT_URL=https://yourfrontend.com` (comma-separated allowed origins).

Seed demo data (users, NGOs, events):

```bash
npm run seed
```

Demo accounts:

| Role       | Email                  | Password   |
| ---------- | ---------------------- | ---------- |
| Volunteer  | demo@sevaconnect.com   | 123456     |
| NGO staff  | ngo@sevaconnect.com    | ngo456     |
| Admin      | admin@sevaconnect.com  | admin123   |

Start the API:

```bash
npm run dev      # nodemon, auto-reload
npm start        # production mode
```

## Setup — frontend

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173` and proxies `/api` (and `/socket.io`) to
`http://localhost:5000`, so no CORS configuration is needed in development.

Production build:

```bash
npm run build
npm run preview
```

## API overview (current phases)

| Method | Endpoint               | Auth    | Description                     |
| ------ | ---------------------- | ------- | ------------------------------- |
| GET    | /api/health            | Public  | Health check                    |
| POST   | /api/auth/register     | Public  | Volunteer/NGO signup (JWT)      |
| POST   | /api/auth/login        | Public  | Login (JWT)                     |
| GET    | /api/ngos              | Public  | NGO directory (search/filter)   |
| GET    | /api/events            | Public  | Event listing (search/filter)   |

More routes (users, NGO CRUD, events CRUD, registrations, attendance, certificates, donations, notifications,
reviews, achievements, analytics, admin, AI chatbot) land in subsequent development phases.

## Security notes

- Passwords are hashed with bcrypt; JWT secrets come from the environment.
- Secrets and database credentials are never placed in frontend code or committed.
- `.env` files are git-ignored; `.env.example` is the only committed template.
- Helmet, CORS allow-list, input validation and rate limiting are enabled on the API.
- The register endpoint only allows `volunteer` and `ngo` roles — admin accounts cannot be self-created.