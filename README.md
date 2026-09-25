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

## Deployment

The stack is split into two independent hosts: the API runs on **Render**, the SPA runs on **Vercel**.

### Backend → Render

The repo ships a `render.yaml` Blueprint.

1. Push this repository to GitHub (it already is).
2. In [render.com](https://render.com) dashboard: **New → Blueprint** (or choose **Web Service** and set
   Root Directory to `backend`).
3. The Blueprint reads `render.yaml` (`rootDir: backend`, `npm install` / `npm start`, health check `/api/health`).
4. Provide the service environment variables (values from `backend/.env`):
   - `MONGODB_URI` — your Atlas connection string (**`backend/.env` is gitignored; paste the full URI here**)
   - `JWT_SECRET` — same long random string as local
   - `CLIENT_URL` — your Vercel URL(s), comma-separated, e.g. `https://seva-connect.vercel.app`
   - `NODE_ENV=production`, `NODE_VERSION=20.11.1` are preset by the Blueprint
5. Deploy gives you `https://seva-connect-api.onrender.com`. Verify `GET /api/health` returns `{"success":true}`.

Notes: the free plan sleeps after ~15 minutes of inactivity (first request wakes it, ~30–60 s cold start).
WebSocket notifications work on Render, but the free instance may drop idle connections — Socket.IO reconnects
automatically on the client side.

### Frontend → Vercel

1. In [vercel.com](https://vercel.com) → **Add New Project** → import this Git repo.
2. Vercel auto-detects Vite (`frontend/`): Framework **Vite**, Build `npm run build`, Output `dist`.
   If it does not pick up the subdirectory, set **Root Directory** to `frontend`.
3. Add the environment variable `VITE_API_URL` = `https://seva-connect-api.onrender.com/api`
   (the `frontend/vercel.json` file handles client-side routing for `/about`, `/ngos`, etc.).
4. Deploy. Build the env var into the frontend **and** keep it in sync in Render's `CLIENT_URL`.

Local development is untouched: CORS defaults to reflecting the request origin when `CLIENT_URL` is unset, and Vite's
proxy keeps `/api` pointing at `http://localhost:5000`.

## Security notes

- Passwords are hashed with bcrypt; JWT secrets come from the environment.
- Secrets and database credentials are never placed in frontend code or committed.
- `.env` files are git-ignored; `.env.example` is the only committed template.
- Helmet, CORS allow-list, input validation and rate limiting are enabled on the API.
- The register endpoint only allows `volunteer` and `ngo` roles — admin accounts cannot be self-created.