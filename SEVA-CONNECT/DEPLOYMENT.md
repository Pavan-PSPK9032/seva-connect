# Seva Connect — Deployment, Migration & Rollback Guide

This document covers the security and verification upgrade: email OTP
registration, Google sign-in, role-based access control, the admin panel,
notifications, reports and auditing.

It is written for the existing deployment topology:

- **Frontend:** React 18 + Vite on Vercel (`frontend/`)
- **Backend:** Express + Mongoose on Render (`backend/`)
- **Database:** MongoDB Atlas (database name `sevaconnect`)

> Nothing in this guide has been applied to production. Database changes are
> additive and must still be deployed with a fresh Atlas backup.

---

## 1. Environment variables

Never commit real values. Only names and purpose are listed here.

### Backend (Render)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` in production. Never `test`. |
| `PORT` | No | Render supplies it; defaults to `5000`. |
| `MONGODB_URI` | Yes | Atlas connection string including the database name. |
| `JWT_SECRET` | Yes | Long random signing secret. Rotating it signs everyone out. |
| `JWT_EXPIRES_IN` | No | Token lifetime, default `7d`. |
| `CLIENT_URL` | Yes | Comma-separated exact browser origins allowed by CORS, e.g. `https://seva-connect-eta.vercel.app`. No wildcards. |
| `SMTP_HOST` | **Yes** | SMTP host. Registration and resend return `503 EMAIL_DELIVERY_FAILED`/`EMAIL_NOT_CONFIGURED` until this is set. |
| `SMTP_PORT` | No | Default `587`. |
| `SMTP_SECURE` | No | `true` for implicit TLS (default true on port `465`). |
| `SMTP_USER` | No | SMTP username, if the provider requires one. |
| `SMTP_PASS` | No | SMTP password / API key. Use a secret store, never source control. |
| `MAIL_FROM` | No | Verified sender, e.g. `Seva Connect <no-reply@yourdomain.org>`. |
| `OTP_PEPPER` | Recommended | Separate HMAC secret for OTP digests. Falls back to `JWT_SECRET`. |
| `OTP_TTL_MINUTES` | No | Default `5`. |
| `OTP_RESEND_COOLDOWN_SECONDS` | No | Default `60`. |
| `OTP_MAX_SENDS_PER_HOUR` | No | Default `5` per address. |
| `GOOGLE_CLIENT_ID` | Recommended | Public OAuth Web client ID. When unset, Google sign-in is disabled with `503 GOOGLE_NOT_CONFIGURED`. No client secret is used. |
| `GEMINI_API_KEY` | No | Enables the Gemini-backed chatbot. |
| `GEMINI_MODEL` | No | Optional model override. |
| `ALLOW_OTP_TEST_CODE` | **Never in production** | Must be `true`, together with `NODE_ENV=test` and a six-digit `OTP_TEST_CODE`, to enable the pinned code. Production startup refuses to boot if this or `OTP_TEST_CODE` is present. |
| `OTP_TEST_CODE` | **Never in production** | Test-only fixed code; requires both switches above. |

### Frontend (Vercel)

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Deployed API base, including `/api`, e.g. `https://seva-connect-api.onrender.com/api`. `/api` only works when a proxy exists. |
| `VITE_GOOGLE_CLIENT_ID` | Recommended | Same public client ID as the backend. When empty, the Google buttons render disabled with an explanatory note. Inlined at build time, so redeploy after changing it. |

### Test-only variables (local / CI)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=test` | Required for the pinned-code branch; by itself it does **not** enable the bypass. |
| `ALLOW_OTP_TEST_CODE=true` | Second required switch for the pinned code. |
| `OTP_TEST_CODE` | Six-digit code used by the integration suite (currently `123456`). |
| `GOOGLE_CLIENT_ID` | Any syntactically valid value lets the controller's "configured" check pass; the suite stubs the verifier in-process. |
| `SMTP_HOST` | Optional in tests; the suite sets it only to let resend reach the OTP service. |

The committed `backend/.env.example` and `frontend/.env.example` describe the same settings without values.

### SMTP provider examples

Any provider that offers SMTP works; the app only reads the variables below.
Port `465` is implicit TLS, `587` uses STARTTLS (`SMTP_SECURE=false`).

| Provider | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` | `SMTP_PASS` | Notes |
| --- | --- | --- | --- | --- | --- |
| Gmail / Google Workspace | `smtp.gmail.com` | `587` | full Gmail address | 16-char **App Password** | Requires 2-Step Verification; the App Password is not your login password. `MAIL_FROM` should be the same address. Good for a quick single-mailbox test, not bulk volume. |
| Brevo | `smtp-relay.brevo.com` | `587` | account login email | SMTP key (Settings → SMTP & API → SMTP) | Verify the sender or domain in Brevo first. |
| Resend | `smtp.resend.com` | `465` | `resend` | API key | `MAIL_FROM` must use a verified domain. `onboarding@resend.dev` only delivers to your own account address. |
| SendGrid | `smtp.sendgrid.net` | `587` | `apikey` | API key | Verify a sender identity or domain before sending. |
| Mailgun | `smtp.mailgun.org` | `587` | `postmaster@yourdomain` | SMTP password | Requires a verified domain. |
| Zoho Mail | `smtp.zoho.com` (or regional host) | `465` | full mailbox address | App-specific password | Enable IMAP/SMTP access and an app password in Zoho. |

Set `MAIL_FROM` to an address the provider has authorised, e.g.
`Seva Connect <no-reply@yourdomain.org>`. For deliverability, publish the
provider's **SPF** and **DKIM** records for that domain, then a starting DMARC
record (`v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.org`).

### Verify email delivery locally

After filling in `backend/.env`:

```bash
cd backend
npm run mail:test                      # checks host + credentials, sends nothing
npm run mail:test -- you@example.com   # sends one real test message
```

Both modes are non-destructive; the script never prints `SMTP_USER`/`SMTP_PASS`.
The second command proves end-to-end delivery. If it passes, restart the API
(it reads SMTP settings at boot) and register at
`http://localhost:5173/register` with a mailbox you control.

### Configure Google sign-in

The app uses the **Google Identity Services (GIS) ID-token flow**: the browser
obtains a signed ID token, the API verifies it with `google-auth-library`, and
the app issues its normal JWT. No client secret and no redirect round-trip are
used, so there is no secret to store on Render.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or
   select a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill the app
   name, support email and developer email. Add the `email` and `profile` scopes
   (the ID token uses them). Publish the consent screen when ready.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: e.g. `Seva Connect Web`
   - **Authorized JavaScript origins** — exact origins, no path, no trailing
     slash:
     - `http://localhost:5173`
     - `https://<your-vercel-app>.vercel.app`
     - any custom domain, e.g. `https://sevaconnect.org`
   - **Authorized redirect URIs**: not used by the ID-token/button flow. If you
     later add a server-side OAuth redirect flow, add the callback then.
4. Copy the **Client ID** (ends in `.apps.googleusercontent.com`). Set it as
   `GOOGLE_CLIENT_ID` on Render **and** `VITE_GOOGLE_CLIENT_ID` on Vercel.
   The client ID is public; never create or deploy a client secret.
5. Redeploy the frontend (Vite inlines `VITE_*` at build time) and restart the
   backend.

Security behaviour to expect:

- The backend trusts only fields inside the verified token (signature, issuer,
  audience, expiry, `email_verified`, `sub`). It never trusts name/email/role
  sent in the request body.
- The browser sends a random nonce; it is echoed in the token and checked.
- Google signup always creates a **volunteer**; it can never grant `admin` or
  `ngo` rights.
- If the email already belongs to a password account, sign-in returns
  `409 GOOGLE_LINK_REQUIRED`. The person must log in with the password once and
  link Google from **Profile → Google sign-in**. Email matching alone never
  auto-links accounts.
- A Google account already linked to another profile returns
  `409 GOOGLE_ACCOUNT_CONFLICT`.
- Google-created accounts are stored with `authProvider: 'google'`, a sparse
  unique `googleId` (`sub`) and no password.

Local check (without a browser): the API returns `503 GOOGLE_NOT_CONFIGURED`
when `GOOGLE_CLIENT_ID` is unset, which is the expected safe default.

---

## 1.1 Hosting settings (Render + Vercel)

These are the settings for the existing topology. Adjust names to your actual
services; nothing here was applied for you.

**Render — backend web service**

| Setting | Value |
| --- | --- |
| Root Directory | `SEVA-CONNECT/backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Node version | 18 or newer (repository runs on Node 24 locally) |

Environment: every required variable from section 1, including
`NODE_ENV=production`, `CLIENT_URL=https://<your-vercel-domain>`,
`SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM`,
`GOOGLE_CLIENT_ID`, and a distinct `OTP_PEPPER`. Never set `OTP_TEST_CODE` or
`ALLOW_OTP_TEST_CODE` — the API refuses to start in production if either exists.

**Vercel — frontend**

| Setting | Value |
| --- | --- |
| Root Directory | `SEVA-CONNECT/frontend` |
| Framework Preset | Vite (already declared in `frontend/vercel.json`) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment: `VITE_API_URL=https://<your-render-service>.onrender.com/api` and
`VITE_GOOGLE_CLIENT_ID=<same public client ID as the backend>`.
Vite inlines both at build time, so **redeploy after changing either**.

**MongoDB Atlas**

- Allow the Render egress (simplest: `0.0.0.0/0` network access with a strong,
  unique database password and a least-privilege database user).
- Confirm the database name in `MONGODB_URI` is `sevaconnect` (or your chosen
  name) and that the URI includes `retryWrites=true&w=majority` if Atlas
  generated it.

**CORS**

`CLIENT_URL` on Render must contain the exact Vercel origin, without a trailing
slash. Multiple origins are comma-separated:

```
CLIENT_URL=https://seva-connect-eta.vercel.app,https://www.yourdomain.org
```

If you add a custom domain later, add it here **before** switching DNS.

---

## 1.2 Step-by-step release runbook

1. **Back up Atlas** (snapshot, or `mongodump` as shown in section 2).
2. **Commit and push** the current working tree to the repository Render and
   Vercel track (all changes are currently uncommitted).
3. **Create/point the Render service** at `SEVA-CONNECT/backend` with the
   settings above. Add every environment variable.
4. **Run the index migration** against the target database, either from a
   machine with the production `MONGODB_URI` in the environment:
   `cd backend && npm run migrate:indexes`, or from the Render shell with the
   same command.
5. **Verify mail** with `npm run mail:test -- you@example.com` using the
   production SMTP values (locally, or in the Render shell).
6. **Deploy the backend**, then open `https://<service>.onrender.com/api/health`.
7. **Create the Vercel project** at `SEVA-CONNECT/frontend`, set
   `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`, and deploy.
8. **Update `CLIENT_URL`** to the final Vercel origin if it differs, and restart
   the Render service.
9. **Smoke test** using section 5, including a real registration with a mailbox
   you control.
10. **Optional:** run `npm run migrate:legacy-verified -- --before=<release-time>`
    (dry run) and add `--apply` only if you want pre-OTP accounts recorded as
    explicitly verified.


---

## 2. Database changes

All changes are additive. No existing collection, document or field is dropped.

### New collections

| Collection | Model | Notes |
| --- | --- | --- |
| `emailverifications` | `EmailVerification` | OTP challenges. Stores only an HMAC-SHA256 digest, never plaintext codes. For a **new** registration it also carries `pendingRegistration` (name, bcrypt password hash, role, phone, skills, interests, profile image, terms timestamp) so no `User` exists until the code succeeds. TTL index removes challenges a day after expiry. |
| `announcements` | `Announcement` | Admin notices with `draft`/`published`/`archived` status. |
| `platformsettings` | `PlatformSetting` | Singleton-style platform configuration. |

### Changed collections

| Collection | Change | Compatibility |
| --- | --- | --- |
| `users` | `emailVerified`, `emailVerifiedAt`, `tokenVersion`, `lastLoginAt`, `termsAcceptedAt`, `notificationPrefs`, `accountStatus`, `authProvider`, `googleId`, `lastGoogleLoginAt` | Additive. The schema deliberately has **no default** for `emailVerified`, so legacy documents stay `undefined` and are treated as verified (`emailVerified !== false`). New email registrations write `true` only after OTP success; Google accounts write `true` because Google has already verified the address. `googleId` is a **sparse unique** index, so legacy documents without it do not collide. `password` becomes conditionally required (absent for Google-only accounts). |
| `ngos` | `status: active \| suspended` | Defaults to `active`. Suspended NGOs are hidden from public listings. |
| `events` | Status enum extended with `draft` and `archived` | Existing values remain valid. |

### Applying the schema

Mongoose creates declared indexes automatically on first connection, but run the
explicit, non-destructive index migration once per environment to be sure:

```bash
cd backend
npm run migrate:indexes
```

The script only calls `Model.createIndexes()`; it never drops indexes and never
modifies documents.

**Google identity index.** `users.googleId` is declared `unique` + `sparse`, so
the migration creates a unique index that only applies to documents where the
field exists. Existing accounts have no `googleId` and are unaffected. Verify it
exists before enabling Google sign-in:

```js
db.users.getIndexes().find((i) => i.key && i.key.googleId);
// expect: { unique: true, sparse: true, ... }
```

No backfill is needed for the new fields. `authProvider` defaults to
`password`, and Google fields stay absent until an account is linked.

**Optional legacy backfill.** Not required for access: a missing `emailVerified`
value is already treated as verified at runtime. To make the data explicit (and
to repair any pre-release account written as `false`), use the included,
dry-run-first script:

```bash
cd backend
npm run migrate:legacy-verified -- --before=2026-10-27T00:00:00Z
npm run migrate:legacy-verified -- --before=2026-10-27T00:00:00Z --apply
```

Choose `--before` as the moment OTP registration goes live; accounts created
after it must verify normally. The script only sets `emailVerified` and
`emailVerifiedAt` on matching documents, and never deletes data.

Dry run executed against the current dev Atlas database on 2026-10-27:

```
Accounts created before 2026-10-27T00:00:00.000Z that are still unverified: 5
Dry run only. Re-run with --apply to mark these accounts verified.
```

All five are pre-OTP accounts that store no `emailVerified` value; they already
log in successfully, so `--apply` is optional (it only records the state
explicitly).

Alternatively, in `mongosh`:

```js
// Only after a backup, and only for accounts created before the release.
db.users.updateMany(
  { emailVerified: { $ne: true }, createdAt: { $lt: ISODate('2026-10-27T00:00:00Z') } },
  { $set: { emailVerified: true, emailVerifiedAt: new Date() } }
);
```

Do **not** backfill accounts created after the release; they must complete OTP
verification.

### Backup before deployment

Take an Atlas snapshot (recommended), or:

```bash
mongodump --uri="<ATLAS_URI>" --db sevaconnect --out ./backup-$(date +%Y%m%d)
```

Restore only if a rollback requires it:

```bash
mongorestore --uri="<ATLAS_URI>" --db sevaconnect --drop ./backup-YYYYMMDD/sevaconnect
```

`--drop` is destructive. Prefer restoring into a new database and switching the
URI if you are unsure.

---

## 3. Deployment order

1. **Take a database backup.**
2. **Configure backend environment variables** (section 1). Verify `SMTP_HOST`,
   `MAIL_FROM`, `GOOGLE_CLIENT_ID`, and sender-domain authentication with your
   provider before announcing the release.
3. **Run `npm run migrate:indexes`** against the target database (this also
   creates the sparse unique `users.googleId` index).
4. **Deploy the backend** (`backend/`, Render). Confirm
   `GET /api/health` returns `200`.
5. **Deploy the frontend** (`frontend/`, Vercel) with `VITE_API_URL` and
   `VITE_GOOGLE_CLIENT_ID` pointing at the backend/client. The Vercel rewrite
   already handles SPA routes.
6. **Smoke test** (section 5).
7. **Seed users:** the seed script marks demo accounts verified. Do not re-run
   seeding against production unless you intend to reset demo data.

### CORS

`CLIENT_URL` must list the exact production frontend origin(s). Unknown origins
do not receive CORS headers. Local development origins are allowed only when
`CLIENT_URL` is unset; arbitrary origins are never reflected.

---

## 4. Rollback

Because every schema change is additive, application rollback is safe:

1. **Frontend:** promote the previous Vercel deployment (Deployments → previous
   build → Promote). No database change needed.
2. **Backend:** redeploy the previous Render commit. Old code ignores the new
   collections and fields. Users created with `emailVerified: false` by the new
   release would no longer be blocked by the old middleware, so roll back only
   for operational recovery, then redeploy the fix.
3. **Database:** restore the backup only if data was corrupted. Application
   rollback does not require a restore.

Rollback does **not** delete OTP challenges or announcements; they are inert
under the old code.

---

## 5. Post-deployment smoke test

Record the actual results in the release ticket.

1. `GET /api/health` → `200`, `status: "ok"`.
2. `GET /api/settings` → `200`, public fields only (no SMTP/JWT values).
3. `GET /api/announcements` → `200` array.
4. Register with a **real mailbox you control** → `201`, no token in response,
   no `users` document yet, OTP email arrives, code works once, wrong code
   decrements attempts.
5. Confirm a duplicate registration for the same pending address → `409
   EMAIL_NOT_VERIFIED` with `verificationRequired: true`; after success a
   repeat → `409 EMAIL_TAKEN`.
6. Log in before verifying (if an unverified legacy account exists) → `403
   EMAIL_NOT_VERIFIED` only after the correct password.
7. Verify → account created, token issued, dashboard accessible.
8. Resend after the cooldown → new code works, old code is rejected.
9. **Google signup** with a Google account that has no Seva Connect account →
   signed in as `volunteer`, no OTP challenge created.
10. **Google login** again → same user, `isNewUser: false`.
11. **Google conflict:** a Google account whose email matches a password account
    → `409 GOOGLE_LINK_REQUIRED`, no token, no automatic link; log in with the
    password and link from Profile, then Google login works and preserves the
    original role.
12. Admin login → `/admin` loads; overview numbers match database counts.
13. Suspend a test volunteer → their existing session is rejected; reactivate.
14. Try suspending/demoting your own admin account → blocked; audit entry exists.
15. Publish an announcement → visible on the home page and in notifications.
16. Open Reports, change the range, download a CSV.
17. Check CORS from the production frontend origin and one disallowed origin.
18. Confirm the Google button renders on the deployed frontend (not the
    "not configured" fallback) and that the origin appears in Google Cloud
    Console's authorized JavaScript origins.

---

## 6. Actual test results (this workspace, 2026-10-27)

These are real results from this repository, not projected outcomes.

### Backend integration suite

Command: `cd backend && npm test`

```
tests 27
pass 27
fail 0
duration_ms ~4470
```

Coverage:

- registration stores only a pending `EmailVerification` (bcrypt hash, name,
  role, terms) and creates **no** `User`; response has no token and no OTP
- server-side validation of email, password, role and required terms
- unverified login and forged-token access blocked by middleware
- a legacy account with **no** `emailVerified` value (simulated with `$unset`)
  hydrates as `undefined` and can still log in
- wrong OTP decrements attempts; correct OTP creates exactly one account;
  replay is rejected
- wrong code ×5 locks and burns the challenge; even the right code is refused
- expired challenge returns `400 OTP_EXPIRED`, is consumed, creates no user
- resend cooldown `429 OTP_COOLDOWN`; unknown address gets a generic response
- resend invalidates the previous challenge and preserves pending details;
  hourly send cap returns `429 OTP_RATE_LIMITED`
- concurrent registrations leave no account and one usable challenge; two
  concurrent verifications produce exactly one account/login
- SMTP-unavailable registration returns `503 EMAIL_DELIVERY_FAILED` and leaves
  no user **or** challenge behind
- the test-code bypass is off unless `NODE_ENV=test` **and**
  `ALLOW_OTP_TEST_CODE=true`; it is always off in production
- Google signup creates a verified `volunteer`, no OTP, and exposes no
  `googleId`; repeat Google login reuses the same account; password login on a
  Google-only account fails with `INVALID_CREDENTIALS`
- Google invalid / expired / unverified-email credentials are rejected;
  malformed credentials fail validation
- Google never auto-links an existing password account (`GOOGLE_LINK_REQUIRED`)
- authenticated Google linking works, preserves the existing role, and rejects
  an email mismatch or anonymous caller
- concurrent Google signups create one account
- logout invalidates the current token
- admin overview rejects anonymous (`401`) and volunteer (`403`) callers
- every admin read endpoint (overview, users, volunteers, NGOs, events,
  applications, announcements, audit, reports, settings, security, CSV export)
  returns `200` with its documented shape
- suspend/reactivate invalidates the live session and writes an audit entry
- repeating an identical NGO verification decision returns success **without**
  sending a duplicate notification or writing a second audit entry
- admins cannot change their own status or role (`SELF_ROLE`)
- password change invalidates old tokens and issues a working fresh token
- public settings and announcements are readable and leak no secrets

The suite uses `mongodb-memory-server`; it never touches the configured Atlas
database. Google's verifier is replaced in-process for those tests; there is no
production bypass in the application code.

### Frontend

```bash
cd frontend
npx tsc -b --pretty false   # passed, no output
npm run build               # passed
```

Vite build: 2,689 modules transformed, built in 5.40 s (latest run).

### Manual smoke test (real dev API)

The backend was started against the configured Atlas database and the following
requests were made.

Public surface (no token):

| Endpoint | Result |
| --- | --- |
| `GET /api/health` | `200`, `success=true` |
| `GET /api/settings` | `200`, `platformName,supportEmail,registrationOpen,maintenanceNotice,announcementBanner` |
| `GET /api/announcements` | `200`, array |
| `GET /api/stats/public` | `200`, live stats object |
| `GET /api/events?limit=2` | `200`, 2 records |
| `GET /api/ngos?limit=2&verified=true` | `200`, 2 records |
| `GET /api/admin/overview` (no token) | `401`, not authorized |

Admin surface (real login as the existing seed admin, which has **no**
`emailVerified` value stored — it logged in successfully, confirming legacy
accounts are not locked out):

| Endpoint | Result |
| --- | --- |
| `POST /api/auth/login` | `200`, `role=admin` |
| `GET /api/admin/overview` | `200`, `users,ngos,events,applications,verifiedHours,certificates,recentUsers,recentActivity` |
| `GET /api/admin/users?page=1&limit=2` | `200`, 2 records |
| `GET /api/admin/volunteers?page=1&limit=2` | `200`, 2 records |
| `GET /api/admin/ngos?page=1&limit=2` | `200`, 2 records |
| `GET /api/admin/events?page=1&limit=2` | `200`, 2 records |
| `GET /api/admin/applications?page=1&limit=2` | `200`, 2 records |
| `GET /api/admin/announcements?page=1&limit=2` | `200`, array |
| `GET /api/admin/audit?page=1&limit=2` | `200`, 2 records |
| `GET /api/admin/reports` | `200`, `range,registrations,participation,activities,ngos,series` |
| `GET /api/admin/settings` | `200`, `platformName,supportEmail,registrationOpen,maintenanceNotice,announcementBanner` |
| `GET /api/admin/security` | `200`, `email,emailVerified,emailVerifiedAt,lastLoginAt,createdAt,tokenVersion,accountStatus,sessionsSupported` |

These were read-only `GET` requests: no production data was modified by the
smoke test. The temporary API process was stopped afterwards.

**Not tested here, by necessity:**

- Real SMTP delivery — no SMTP credentials exist in `backend/.env`. Until they
  are configured, registration correctly fails with `503` and no account is
  created. Configure `SMTP_*`/`MAIL_FROM` to enable it.
- Real Google sign-in — no OAuth client ID or Google Cloud Console access exists
  in this workspace. The integration tests stub Google's verifier; the real
  signature/audience/issuer path has **not** been exercised against Google.
  Configure `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` and follow section 5.
- Production deployment to Render/Vercel — no deployment credentials were
  available, so nothing was deployed.
- Browser end-to-end flows against a deployed environment beyond the production
  build and the API smoke test above.

### Local development with OTP

Without SMTP credentials, registration cannot complete locally. Three supported
options:

1. Configure `SMTP_*` in `backend/.env`, run `npm run mail:test -- you@example.com`
   to confirm delivery, then use a real mailbox.
2. Use a local capture server (for example
   [MailHog](https://github.com/mailhog/MailHog) or
   [Mailpit](https://github.com/axllent/mailpit)): set `SMTP_HOST=127.0.0.1`,
   `SMTP_PORT=1025`, leave `SMTP_USER`/`SMTP_PASS` empty, and read the code from
   its web UI. No credentials leave your machine.
3. Run the automated test suite (`npm test`). The pinned code requires
   `NODE_ENV=test`, `ALLOW_OTP_TEST_CODE=true` and a six-digit `OTP_TEST_CODE`.
   Never set any of these in production; the server refuses to start there if
   the test variables exist.

On 2026-10-27 `npm run mail:test` was executed in this workspace with SMTP
unconfigured and correctly refused to send, printing the missing variables and
exiting non-zero. It has **not** been run against a real provider because no
SMTP credentials exist here yet. Likewise, no Google OAuth client has been
created or tested against Google.

---

## 7. Operational notes

- **Audit log:** privileged actions (user status/role, NGO verification, event
  moderation, reports/exports, announcements, settings) are appended to
  `auditlogs`. Entries are not editable from the admin UI.
- **Sessions:** logout, password change/reset, and "sign out everywhere"
  increment `tokenVersion`, invalidating all previously issued tokens.
- **OTP lockout:** after five wrong attempts the challenge is burned. The next
  attempt returns a generic invalid-code error until the resend cooldown passes
  and a fresh code is requested.
- **No account before verification:** a pending registration lives only in
  `emailverifications`; the `users` document is inserted atomically after a
  successful code. If SMTP fails, the challenge is removed and no account
  exists, so the address remains reusable. The unique email index resolves
  concurrent verification races.
- **Google linking:** a Google identity is never attached to a password account
  by matching email alone. Sign in with the password once, then link from
  Profile. Google signup always creates a `volunteer`. `googleId` is never
  serialized to the browser; only `googleLinked` is exposed.
- **Google tokens:** signature, issuer, audience, expiry, `email_verified` and
  the browser nonce are checked server-side. The client secret, if one exists
  in Console, is neither needed nor stored by this application.
- **Notifications:** in-app notifications are always persisted unless the user
  has disabled in-app delivery; email copies are best-effort and require SMTP
  plus the user's email preference.
- **Idempotent decisions:** re-applying a user's current status/role, an NGO's
  current verification/status, or an activity's current status returns success
  without sending a duplicate notification or writing another audit entry.
- **Reports:** computed live from collections for the selected range; CSV
  exports are server-scoped and audited.
- **Last admin:** the server blocks suspending or demoting the final active
  administrator, and blocks self-status/self-role changes.
