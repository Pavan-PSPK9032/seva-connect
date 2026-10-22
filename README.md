# SEVA CONNECT

Volunteer management and social-impact platform connecting **volunteers, NGOs and administrators**
through one system: discover opportunities, apply, get confirmed, verify hours, and issue shareable
certificates.

## Tech stack

| Layer    | Technology                                                                   |
| -------- | ---------------------------------------------------------------------------- |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, React Router, Axios  |
| Backend  | Node.js, Express, MongoDB Atlas, Mongoose, JWT + bcrypt, Socket.IO            |
| AI       | Google Gemini (`@google/generative-ai`) with a data-driven local fallback     |
| Extras   | React Hook Form + Zod (forms), Lucide (icons)                                 |

## Feature overview

**Volunteers**

- Browse verified NGOs and upcoming/ongoing/completed events with search and filters.
- Full opportunity page: capacity, required skills, eligibility, application deadline, organiser.
- Apply with an optional cover note, withdraw, and re-apply (a withdrawn application is reused).
- Personal dashboard with application statuses and verified hours.
- In-app notifications with per-user preferences.
- Printable certificate of volunteering for every completed, verified event, publicly verifiable
  by certificate ID.

**NGOs**

- Create and manage organisations and events (capacity, skills, eligibility, deadline).
- Review applicants per event, approve/reject, and mark participation completed with verified hours.
- Seat capacity is enforced atomically, so concurrent approvals cannot oversubscribe an event.
- Applicants receive notifications on every decision.

**Administrators**

- Platform overview computed from live records.
- Search users, suspend/reactivate accounts (admins cannot be suspended).
- Verify or revoke verification of organisations.
- Audit log of sensitive actions (decisions, suspensions, verification changes).

**Public**

- Honest impact statistics pulled from the database — no hardcoded numbers.
- "Seva AI" assistant grounded in live listings.
- Certificate verification page.

**Auth**

- Register/login with JWT; passwords hashed with bcrypt.
- Forgot/reset password with single-use, hashed, 30-minute tokens.

## Not implemented yet

Donations, attendance check-in, volunteer reviews/ratings, badges/achievements, and file uploads
(image URLs only) are **not** part of this build. There is no committed automated test suite; the
flows below were verified with throwaway Node smoke scripts against a seeded database.

## Project layout

```
SEVA-CONNECT/
  frontend/                    React + Vite + TypeScript application
    src/
      components/              Navbar (notification bell), Footer, cards, Chatbot, skeletons
      hooks/                   useChatbot (Seva AI chat state)
      layouts/                 PublicLayout (navbar + footer shell, document titles)
      pages/                   Home, NGOs, Events, EventDetail, Dashboard, Notifications,
                               MyNGO, Admin, Profile, CertificateView, auth pages, Chatbot
      context/                 Auth, theme and toast providers
      services/                Axios API client + interceptors
      types/                   Shared TypeScript interfaces
      utils/
  backend/                     Node.js + Express + MongoDB API
    config/                    db.js, cors.js
    models/                    User, NGO, Event, Application, Notification, AuditLog, Certificate
    controllers/               auth, users, ngos, events, applications, notifications,
                               certificates, stats, admin, chatbot
    routes/                    /api/auth, /api/users, /api/ngos, /api/events,
                               /api/applications, /api/notifications, /api/certificates,
                               /api/stats, /api/admin, /api/chatbot
    services/                  chatbotService, gemini, notificationService, auditService,
                               certificateService, mailer
    middleware/                JWT auth (protect/authorize/optionalAuth), validation
    sockets/                   Socket.IO (JWT-authenticated real-time layer)
    seeds/                     npm run seed — demo users, NGOs, events, applications, certificate
    utils/                     JWT signing, permission helpers
    app.js                     Express app (middleware + routes + errors)
    server.js                  Entry point (DB + HTTP + Socket.IO)
```

## Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB), with the connection string in hand
- npm

> Windows/PowerShell note: if `npm` is blocked by the execution policy, use `npm.cmd`.

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

Optional:

- `CLIENT_URL` — comma-separated allowed browser origins (also used to build reset links).
- `GEMINI_API_KEY` — enables the Seva AI chatbot; without it a local assistant answers from live data.
- `GEMINI_MODEL` — defaults to `gemini-2.0-flash`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — real password-reset email.
  Without SMTP the reset link is printed to the server log, and outside production returned as
  `devResetUrl` so the flow can be tested locally.

Seed demo data:

```bash
npm run seed
```

Demo accounts:

| Role      | Email                 | Password |
| --------- | --------------------- | -------- |
| Volunteer | demo@sevaconnect.com  | 123456   |
| NGO staff | ngo@sevaconnect.com   | ngo456   |
| Admin     | admin@sevaconnect.com | admin123 |

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

## API overview

| Method | Endpoint                              | Auth            | Description                              |
| ------ | ------------------------------------- | --------------- | ---------------------------------------- |
| GET    | /api/health                           | Public          | Health check                             |
| POST   | /api/auth/register                    | Public          | Volunteer/NGO signup (JWT)               |
| POST   | /api/auth/login                       | Public          | Login (JWT)                              |
| POST   | /api/auth/forgot-password             | Public          | Send a reset link (generic response)     |
| POST   | /api/auth/reset-password              | Public          | Consume token, set new password          |
| GET    | /api/stats/public                     | Public          | Live impact statistics                   |
| GET    | /api/ngos                             | Public          | NGO directory (search/filter)            |
| GET    | /api/ngos/:id                         | Public          | NGO detail                               |
| GET    | /api/events                           | Public          | Event listing (search/filter)            |
| GET    | /api/events/:id                       | Public          | Event detail + organiser                 |
| POST   | /api/applications                     | Volunteer       | Apply (optional cover note)              |
| GET    | /api/applications/mine                | Volunteer       | Own applications + summary               |
| PATCH  | /api/applications/:id/withdraw        | Volunteer       | Withdraw; releases the seat              |
| GET    | /api/applications/event/:eventId      | NGO/admin       | Applicants for an event                  |
| PATCH  | /api/applications/:id/status          | NGO/admin       | approve / reject / completed (+hours)    |
| GET    | /api/notifications                    | Any signed-in   | Paginated inbox + unread count           |
| GET    | /api/notifications/unread-count       | Any signed-in   | Bell badge count                         |
| PATCH  | /api/notifications/:id/read           | Any signed-in   | Mark one read                            |
| PATCH  | /api/notifications/read-all           | Any signed-in   | Mark all read                            |
| GET    | /api/notifications/preferences        | Any signed-in   | Read preferences                         |
| PATCH  | /api/notifications/preferences        | Any signed-in   | Update preferences                       |
| GET    | /api/certificates/mine                | Any signed-in   | Own certificates                         |
| GET    | /api/certificates/:code               | Public          | Verify a certificate by ID               |
| GET    | /api/admin/overview                   | Admin           | Platform metrics                         |
| GET    | /api/admin/users                      | Admin           | Search/filter users (no passwords)       |
| PATCH  | /api/admin/users/:id/status           | Admin           | Suspend / reactivate                     |
| GET    | /api/admin/ngos                       | Admin           | All organisations                        |
| PATCH  | /api/admin/ngos/:id/verify            | Admin           | Verify / revoke                          |
| GET    | /api/admin/audit                      | Admin           | Audit log                                |
| GET    | /api/chatbot/status                   | Public          | Model + whether Gemini is on             |
| GET    | /api/chatbot/suggestions              | Optional        | Starter prompts (personalised)           |
| POST   | /api/chatbot/message                  | Optional        | One grounded Seva AI chat turn           |

Responses follow `{ success, message?, data?, ... }`. Validation failures return
`{ success: false, message: 'Validation failed', errors: [{ field, message }] }`.

## Data model notes

- `Application` is the source of truth for participation; unique per `(eventId, volunteerId)`.
- `Event.registeredVolunteers` remains a cached counter for fast listing. Approvals increment it with
  a conditional atomic update (`$lt` capacity), and withdrawal decrements it clamped at zero.
- Completed applications snapshot names into a `Certificate` so the certificate stays stable if an
  event or organisation is renamed.
- Suspended users can authenticate but every protected request returns `403`; `optionalAuth` treats
  them as anonymous.

## Seva AI chatbot

A Gemini-powered assistant that answers only from the live listings on the platform.

**Grounding.** `services/chatbotService.js` queries upcoming/ongoing `Event`s and all `NGO`s, ranks
them against the visitor's message *and* their profile `skills[]` / `interests[]`, and injects the
top matches as a data block in the system prompt. The model is instructed never to invent events,
NGOs, dates or availability, and to say when something is not on the platform.

**Fallback.** If `GEMINI_API_KEY` is missing, invalid or the API errors, the service answers with a
local keyword assistant over the same data. The response's `mode` field is `"ai"` or `"fallback"`,
and `/api/chatbot/status` reports `aiEnabled`.

**UI.** The same `ChatSurface` is rendered twice: as a floating launcher in `PublicLayout` (hidden on
`/chatbot`) and as the full-page `/chatbot` route. Transcript state lives in `sessionStorage`.
Rate limited to 40 messages per 15 minutes on top of the global `/api` limit.

## Verification performed

Against the seeded database (backend on an alternate port):

- 31 checks: apply, duplicate/full rejection, role guards, approve, double-approve rejection,
  counter increments, withdraw + seat release, re-apply reuse, validation, notifications, preferences.
- 23 checks: public stats, event detail 404/400, admin auth guards, user/NGO/audit listing,
  NGO verify toggle, suspend → login blocked → reactivate, password fields never exposed.
- 14 checks: reset link issuance, hashed single-use token, expiry, invalid/short input, old password
  rejected, new password accepted.
- 15 checks: certificate verification, case-insensitivity, unknown code, issuance on completion,
  hour snapshot, ownership listing.
- `npm run build` (TypeScript + Vite) passes with no errors.

## Deployment

The stack is split into two independent hosts: the API runs on **Render**, the SPA on **Vercel**.

### Backend → Render

The repo ships a `render.yaml` Blueprint.

1. Push this repository to GitHub.
2. In [render.com](https://render.com): **New → Blueprint**.
3. The Blueprint reads `render.yaml` (`rootDir: SEVA-CONNECT/backend`, `npm install` / `npm start`,
   health check `/api/health`).
4. Provide the environment variables:
   - `MONGODB_URI` — Atlas connection string (**`backend/.env` is gitignored**)
   - `JWT_SECRET` — same long random string as local
   - `CLIENT_URL` — your Vercel URL(s), comma-separated
   - `GEMINI_API_KEY` — optional
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — optional but required for real
     password-reset emails
5. Verify `GET /api/health` returns `{"success":true}`.

> Free plan sleeps after inactivity (first request wakes it). Socket.IO reconnects automatically.

### Frontend → Vercel

1. Import the Git repo in [vercel.com](https://vercel.com).
2. Root Directory `SEVA-CONNECT/frontend`; Framework **Vite**; build `npm run build`; output `dist`.
3. Set `VITE_API_URL=https://<your-api>.onrender.com/api`.
4. Keep Render's `CLIENT_URL` in sync with the deployed frontend URL.

## Security notes

- Passwords hashed with bcrypt; JWT secrets come from the environment.
- Password-reset tokens are hashed at rest, expire in 30 minutes, are single-use, and the endpoint
  never reveals whether an email exists.
- Suspended accounts are rejected on login and on every protected request.
- Admin routes are guarded by `protect` + `authorize('admin')`; no one can suspend their own account.
- NGO actions are scoped to organisations the caller owns (admins exempt).
- Helmet, CORS allow-list, input validation and rate limiting are enabled on the API.
- `.env` files are git-ignored; `.env.example` is the only committed template.
- The register endpoint only allows `volunteer` and `ngo` roles — admin accounts cannot be
  self-created.
