# SEVA CONNECT

AI-powered NGO Volunteer Management and Social Impact Platform.

Seva Connect connects **volunteers, NGOs, donors and administrators** through a centralized system for managing
volunteering opportunities, events, attendance, certificates, donations and community engagement.

## Tech stack

| Layer      | Technology                                                                    |
| ---------- | ----------------------------------------------------------------------------- |
| Frontend   | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, React Router, Axios   |
| Backend    | Node.js, Express, MongoDB Atlas, Mongoose, JWT + bcrypt, Socket.IO             |
| AI         | Google Gemini (`@google/generative-ai`) with a data-driven local fallback      |
| Extras     | Recharts (analytics), React Hook Form + Zod (forms), Lucide (icons)            |

## Project layout

```
SEVA-CONNECT/
├── frontend/            # React + Vite + TypeScript application
│   ├── src/
│   │   ├── components/  # Navbar, Footer, cards, Chatbot widget, skeletons, toasts
│   │   ├── hooks/       # useChatbot (Seva AI chat state)
│   │   ├── layouts/     # PublicLayout (navbar + footer shell)
│   │   ├── pages/       # Home, NGOs, Events, Chatbot, Login, Register, About, Contact, FAQ
│   │   ├── context/     # Auth, theme and toast providers (hooks)
│   │   ├── services/    # Axios API client + interceptors
│   │   ├── types/       # Shared TypeScript interfaces
│   │   └── utils/
│   └── vite.config.ts   # /api proxy → localhost:5000
└── backend/             # Node.js + Express + MongoDB API
    ├── config/          # db.js (Atlas connection), cors.js
    ├── models/          # User, NGO, Event
    ├── controllers/     # auth, users, ngos, events, chatbot
    ├── routes/          # /api/auth, /api/users, /api/ngos, /api/events, /api/chatbot
    ├── services/        # chatbotService.js (grounding), gemini.js (LLM wrapper)
    ├── middleware/      # JWT auth (protect/authorize/optionalAuth), validation
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
GEMINI_API_KEY=<Google AI Studio key>
```

Optional: `CLIENT_URL=https://yourfrontend.com` (comma-separated allowed origins) and
`GEMINI_MODEL=gemini-2.0-flash` (defaults to `gemini-2.0-flash`).

`GEMINI_API_KEY` powers the Seva AI chatbot and is **optional** — grab a free key from
[aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it the chatbot still works,
falling back to a built-in assistant that answers from the same live data.

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
| GET    | /api/chatbot/status    | Public  | Model + whether Gemini is on    |
| GET    | /api/chatbot/suggestions | Optional | Starter prompts (personalised) |
| POST   | /api/chatbot/message   | Optional | One grounded Seva AI chat turn  |

The chatbot routes use `optionalAuth` rather than `protect`: guests can chat, and signed-in visitors
get answers tailored to their saved skills and interests.

More routes (registrations, attendance, certificates, donations, notifications, reviews, achievements,
analytics, admin) land in subsequent development phases.

## Seva AI chatbot

A Gemini-powered assistant that answers only from the live listings on the platform.

**Grounding.** `services/chatbotService.js` queries upcoming/ongoing `Event`s and all `NGO`s, ranks
them against the visitor's message *and* their profile `skills[]` / `interests[]`, and injects the
top matches as a data block in the system prompt. The model is instructed never to invent events,
NGOs, dates or availability, and to say when something is not on the platform.

**Fallback.** If `GEMINI_API_KEY` is missing, invalid or the API errors, the service answers with a
local keyword assistant over the same data. The response's `mode` field is `"ai"` or `"fallback"`,
and `/api/chatbot/status` reports `aiEnabled` — the UI shows this in the header so the behaviour is
never silently misleading.

**UI.** The same `ChatSurface` is rendered twice: as a floating launcher in `PublicLayout` (hidden on
`/chatbot` so the two do not stack) and as the full-page `/chatbot` route. Transcript state lives in
`sessionStorage`, so moving between the widget and the page keeps the conversation.

Rate limited to 40 messages per 15 minutes on top of the global `/api` limit.

Try it with `demo@sevaconnect.com` / `123456` — that profile has skills *Teaching, Healthcare,
Fundraising* and interests *Education, Child Welfare*, and asking "which events match my skills?"
returns education-focused events ranked above the rest.

## Deployment

The stack is split into two independent hosts: the API runs on **Render**, the SPA runs on **Vercel**.

### Backend → Render

The repo ships a `render.yaml` Blueprint.

1. Push this repository to GitHub (it already is).
2. In [render.com](https://render.com) dashboard: **New → Blueprint** (Blueprints can also be re-run from
   *Blueprints* so future service changes apply automatically).
3. The Blueprint reads `render.yaml` (`rootDir: SEVA-CONNECT/backend`, `npm install` / `npm start`,
   health check `/api/health`).
4. Provide the service environment variables (values from `backend/.env`):
   - `MONGODB_URI` — your Atlas connection string (**`backend/.env` is gitignored; paste the full URI here**)
   - `JWT_SECRET` — same long random string as local
   - `CLIENT_URL` — your Vercel URL(s), comma-separated, e.g. `https://seva-connect.vercel.app`
   - `GEMINI_API_KEY` — optional, enables the Seva AI chatbot (omit to use the built-in assistant)
   - `NODE_ENV=production`, `NODE_VERSION=20.11.1` are preset by the Blueprint
5. Deploy gives you `https://seva-connect-api.onrender.com`. Verify `GET /api/health` returns `{"success":true}`.

> Web Service (manual) equivalent: Root Directory **`SEVA-CONNECT/backend`**, Build `npm install`,
> Start `npm start`, health check path `/api/health`.

Notes: the free plan sleeps after ~15 minutes of inactivity (first request wakes it, ~30–60 s cold start).
WebSocket notifications work on Render, but the free instance may drop idle connections — Socket.IO reconnects
automatically on the client side.

### Frontend → Vercel

1. In [vercel.com](https://vercel.com) → **Add New Project** → import this Git repo.
2. Vercel auto-detects Vite: set **Root Directory** to `SEVA-CONNECT/frontend` (this is the directory that
   contains `package.json` and `vercel.json`). Framework **Vite**, Build `npm run build`, Output `dist`.
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