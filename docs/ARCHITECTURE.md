# Architecture

GateKeeper is a multi-tenant event registration and door check-in system: organizers create
events, attendees self-register through a public link and receive a QR ticket, and door staff
scan tickets — including while offline at the venue.

Two deployable units: a React SPA (`client/`) and an Express API (`server/`), sharing type
editions from `shared/types.ts`. Supabase PostgreSQL is the only stateful dependency.

All file paths in this document are relative to the repository root.

---

## 1. Shape

```
                    ┌──────────────────────────────────────────────┐
  attendee           │  Browser (React 18 + Vite 6)                 │
  (public link) ────►│                                              │
                    │  AuthContext        OfflineSyncContext        │
  organizer ────────►│  (session)          (IndexedDB queue)         │
  (dashboard)       │                                              │
  door staff ───────►│  ApiClient (fetch, credentials: 'include')    │
  (scanner)         │  ZXing camera decode ──► IndexedDB            │
                    └───────────────────┬──────────────────────────┘
                                        │ /api/* (same origin)
                        dev: Vite proxy │ prod: nginx proxy_pass
                                        ▼
                    ┌──────────────────────────────────────────────┐
                    │  Express 4 API                                │
                    │                                               │
                    │  helmet → cors → morgan → json → cookies      │
                    │  rate limit → auth → ownership → route handler│
                    │  zod validation → models → audit log          │
                    └───────┬───────────────────────┬──────────────┘
                            │                       │
                     Supabase PostgreSQL      Gmail SMTP via Nodemailer
                                              qrcode (ticket image)
```

| Component | Owns | Does not own |
|---|---|---|
| `client/` | Session state, offline queue, camera scanning, all rendering | Authorisation decisions, capacity, ticket uniqueness |
| `server/` | Identity, tenancy, capacity, ticket issuance, audit trail | Rendering, offline buffering |
| `shared/types.ts` | Wire contract between the two | Runtime logic |
| Supabase PostgreSQL | Durable state; constraints enforce registration invariants | — |

The client is untrusted. Every rule the client enforces (capacity, one check-in per ticket,
event ownership) is enforced again server-side. That duplication is deliberate and correct.

---

## 2. Request path

Middleware runs in a fixed order (`server/src/server.ts:60-88`):

1. `helmet` — security headers. Set before CORS so CSP and CORS don't disagree.
2. `cors` — cookie-credentialed, origin allowlist.
3. `morgan` — request log.
4. `express.json` — 5 MB limit, sized for base64 event artwork in `imageDataUrl`.
5. `cookieParser` — reads the `token` cookie.
6. Per-route: rate limiter → `authMiddleware` → `requireEventOwnership` → handler.

`authMiddleware` accepts either a Bearer header or the httpOnly cookie, loads the organizer
from the database, and attaches `req.organizer`. Loading the row — rather than trusting JWT
claims — means a deleted account loses access before its token expires.

`requireEventOwnership` resolves the event from whichever param carries the id
(`:id`, `:eventId`, query, or body), then scopes the lookup by `organizerId` unless the
request carries a valid short-lived Super Admin token. Handlers downstream receive
`req.event` already authorised, so no route can forget the tenancy check.

API surface (all under `/api`):

| Prefix | Auth | Purpose |
|---|---|---|
| `/auth` | none / cookie | register, login, OTP, password reset, `/me` |
| `/events` | cookie | event CRUD, publish/start/end lifecycle, analytics, summary, CSV export, audit log |
| `/attendees` | public + cookie | public registration, ticket lookup, check-in by code, listing, resend |
| `/checkins` | cookie | batch sync of offline scans |
| `/super-admin` | cookie + OTP JWT | cross-tenant oversight, user/event/registration purge, exports |

Event lifecycle is a guarded state machine: `DRAFT → UPCOMING → LIVE → ENDED`. Every
transition re-reads the current status and rejects the call with 400 if the precondition
doesn't hold.

---

## 3. Data model

```
Organizer 1───n Event 1───n Attendee
                        └──n AuditLog
```

`Event` carries `prefix` (human ticket prefix, e.g. `CYBER-000123`), `capacity`, and a
denormalised `registeredCount` used only for capacity reservation.

`Attendee` stores `ticketCode` (human-readable) and `qrToken` (opaque random; contains no PII,
so a photographed badge leaks nothing).

Indexes that matter:

- `{ eventId, email }` unique — one registration per person per event, enforced in the database
  rather than by a read-then-write in application code.
- `{ eventId, ticketCode }` unique — no duplicate human codes within an event.
- `{ eventId, qrToken }` — the door-scan lookup path; without it every scan is a collection scan.
- `{ eventId, checkedInAt }` — analytics and per-event counts.

`AuditLog` is append-only and records `REGISTER_ATTENDEE`, `CHECK_IN`, `DUPLICATE_CHECK_IN`,
`OFFLINE_SCAN_SYNCED`, `OFFLINE_SCAN_REJECTED`, plus super-admin destructive actions. It is the
only answer to "who let this person in, on which device, at what time" — worth its write cost.

---

## 4. Offline check-in — the load-bearing part

This is the feature the product lives or dies on, and the code handles it better than most
commercial equivalents.

**Client side** (`client/src/context/OfflineSyncContext.tsx`, `client/src/db/indexedDB.ts`):
scans that cannot reach the API are written to IndexedDB with a generated `scanId`, a device id,
and the local timestamp. The queue survives tab closes and reloads. On `online`, the client
batches the queue to `POST /api/checkins/sync`.

**Server side** (`server/src/routes/checkinRoutes.ts`):

1. Scans are sorted by capture timestamp before replay, so the earliest scan wins by wall clock
   rather than by upload order.
2. Timestamps outside ±24 h are rejected — a replay-window bound, not a formality.
3. Each scan is claimed with a single conditional update:

```js
Attendee.findOneAndUpdate(
  { _id, checkedInAt: null, offlineScanIds: { $ne: scanId } },
  { $set: { checkedInAt }, $addToSet: { offlineScanIds: scanId } }
)
```

That one statement is the whole idempotency story. A null-claim means either the attendee was
already checked in (a real duplicate) or this exact `scanId` was already applied (a retry after
a network failure the client never saw the response to). Retries are safe; two devices scanning
the same ticket cannot both succeed. Compare-and-set on a database predicate, not a read-then-write.

Per-scan results (`VALID` / `DUPLICATE` / `INVALID` / `FAILED`) are returned in the batch
response so one bad ticket doesn't fail the whole sync, and the client marks each row accordingly.

**Known gap.** Sync requires `event.status === 'LIVE'` (`checkinRoutes.ts:32`). An organizer who
ends the event while a device still holds queued scans gets a 409 and those check-ins can never
be reconciled. Attendance data is stranded until someone re-opens the event. This is the most
likely real-world data problem in the system.

---

## 5. Cross-cutting

**Auth.** One JWT in an httpOnly cookie, 8 h expiry, `sameSite=strict` in production. The
web client never touches the token — no XSS path to session theft. `authenticated` is resolved
from the database per request.

**Super admin.** Access is restricted to the one normalized email configured by
`SUPER_ADMIN_EMAIL`. After normal organizer authentication, the account requests a six-digit
one-time code delivered to that address through Nodemailer/Gmail SMTP. The code expires after
10 minutes and allows five verification attempts. Successful verification exchanges the code
for a second, short-lived JWT carrying `superAdminAuth: true`. The elevated role is not
persisted as an authorization grant. `requireSuperAdmin` and event ownership checks verify the
configured email, token signature, and that the token id matches the logged-in organizer.
Cross-tenant powers end when the elevated token expires or is locked.

**Rate limits.** In-process `express-rate-limit`: 30/min on public attendee registration,
20/15 min on auth routes, and 10/15 min on ticket lookup. OTP issuance also has a shared
per-email quota of five requests per hour across login, password reset, organizer registration,
and Super Admin verification. These controls are correct for a single instance; distributed
deployments need shared storage.

**Organizer registration.** `/register` does not create an account immediately. The server first
checks whether the normalized email already exists, stores the pending registration in process
memory, and sends a registration OTP. The account is created only after the six-digit code is
verified. Existing accounts receive an explicit conflict response and the client directs the
user to login.

**Email delivery.** Attendee ticket emails, ticket resends, login OTPs, password-reset OTPs,
organizer-registration OTPs, and Super Admin OTPs all use one Gmail SMTP transporter created by
Nodemailer. `SMTP_USER` and `SMTP_PASS` are required; there is no Resend, Ethereal, or silent
development fallback.

**Errors.** Central handling maps validation, duplicate-key, JWT, and malformed JSON failures
into 4xx responses, falling through to 500 otherwise. Returning `err.message` for unexpected
failures can still expose implementation details and should be tightened before production.

**DB connection** (`server/src/config/db.ts`): the API validates its Supabase connection during
startup. Production requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the service-role
key remains server-only. Apply `supabase/schema.sql` before starting the API.

---

## 6. Deployment

| Environment | Client | API | Notes |
|---|---|---|---|
| Local dev | `vite` :5173 | `tsx watch` :5001 | Vite proxies `/api` → `:5001` |
| Compose | nginx :8080 | node :5000 | `docker compose up --build` |
| Production | GHCR `…-web` | GHCR `…-api` | Images built and pushed by CI |

Images: `server/Dockerfile` (multi-stage, production deps only, non-root `USER node`, HTTP
healthcheck on `/api/health`) and `client/Dockerfile` (Vite build → nginx, `API_UPSTREAM`
substituted at container start so one image serves any environment).

Both build from the repository root, because the client imports `../shared`.

`docker-compose.yml` runs the api + web containers. Supabase PostgreSQL is managed externally,
so Docker Compose no longer starts a local database.

The API runtime is Alpine and uses Supabase over HTTPS, so it does not need a database process
inside the container.

---

## 7. CI/CD

`.github/workflows/ci.yml`, on every PR and push to main/master, plus `v*` tags:

| Job | Gate | Runs |
|---|---|---|
| `server` | **blocking** | `npm ci`, `tsc --noEmit`, `tsc` build, smoke suite |
| `client` | **blocking** | `npm ci`, `tsc -b`, `vite build`, uploads `dist` |
| `audit` | advisory | `npm audit --omit=dev --audit-level=high` on server, full on client |
| `publish` | post-merge only | builds both images, pushes to GHCR with branch/semver/sha/latest tags |

`publish` declares `needs: [server, client]`, so an image can only exist for a commit whose
tests passed. PRs never publish.

`server/test/smoke.test.ts` boots the real server against the embedded-Mongo tier and asserts
the money path end to end: register organizer → create event → publish → register attendees →
capacity refusal at the limit → start → check-in → duplicate detection → tenant isolation.

The audit job is deliberately non-blocking. With no fix path for most transitive findings, a red
audit trains the team to ignore the whole workflow. The trade: vulnerabilities appear in the log
but never stop a merge. Revisit when there is a triage habit.

Not covered: no linter (none configured), no browser E2E, no test for the offline sync endpoint
itself — the highest-risk logic in the system.

### What was actually run

This document was written against the code, then checked by executing it:

| Check | Result |
|---|---|
| `tsc --noEmit` over `src` + `test` | clean |
| `vite build` | clean, 704 kB app + 181 kB vendor chunk |
| `npm test` (4 smoke tests, embedded Mongo) | 4 passed |
| Security regression test against pre-fix `ownershipMiddleware` | fails, as intended |
| `docker build` api + web | both built |
| api container, `NODE_ENV=production`, no Mongo | started, `uid 1000`, `/api/health` 200 |
| web container | SPA fallback 200, `/api` proxy reached the API |

Unverified: the GitHub Actions workflow has not executed on GitHub. It mirrors the commands run
locally, but the first push is the real test of the workflow YAML.

---

## 8. Findings

### Critical

**C1 — Cross-tenant read/write via forged Super Admin token. *(fixed)***
`ownershipMiddleware.ts` treated the mere *presence* of `x-super-admin-token` (header or cookie)
as superadmin, without verifying the JWT. Any authenticated organizer could send
`x-super-admin-token: anything` and read or delete another organizer's event — attendee list, CSV
export, audit log included. Fixed: the bypass now requires a valid, signed, short-lived
OTP-issued Super Admin token. Covered by a regression test that fails against the old code.

**C2 — Database readiness must be observable.**
Supabase PostgreSQL is the required durable store; the API must not be treated as ready merely
because the process is listening. The health endpoint should include a database readiness check
and make configuration or connectivity failures visible to the deployment platform.

**C3 — `node_modules` is committed to git (14,779 tracked files).**
Root cause: `.gitignore` was UTF-16LE, so git never parsed `node_modules/` — verified with
`od -c`. Fixed the file. Untracking is a separate, unavoidable-large commit:
`git rm -r --cached client/node_modules server/node_modules` then commit. Coordinate it — every
collaborator must re-clone or their next commit resurrects the directory.

**C4 — OTP delivery and verification state are process-local.**
The application fails closed when SMTP configuration is missing, and Nodemailer is the sole
delivery provider. OTP codes and pending registrations remain in process memory, however; a
restart drops in-flight codes and multiple replicas do not share them. Move these stores and
the quota to Redis or another shared TTL store before horizontal scaling.

Related, lower severity: an earlier `.env` was committed with a `JWT_SECRET`
(`gatekeeper_jwt_super_secret_production_key_2026`, removed in `9e79d3e`). It is not the current
secret, but any environment that reused it needs rotation and the current value kept out of
history.

### Major

**M1 — Offline scans become unsyncable once an event ends** (§4). 409 on sync, no recovery path
in the UI. Fix: allow sync for `ENDED` events while the scan timestamp precedes `endedAt`.

**M2 — OTP state is process memory** (`authRoutes.ts`, `superAdminRoutes.ts`). Restart drops
in-flight codes; two replicas may route verification to an instance that never issued the code.
Expired entries and the shared quota should move to Redis with TTL before multi-instance deploys.

**M3 — Two sources of truth for registration count.** Capacity is reserved against the
`registeredCount` counter while some read paths recompute totals. Drift after a failed rollback
or manual delete can make an event appear sold out or available incorrectly. Fix: derive
capacity from one transactional source of truth, or reconcile the counter on every list read.

**M4 — Health check proves liveness, not readiness** (`server.ts`). It should report database
readiness and SMTP configuration status so orchestrators do not route traffic to an instance
that cannot persist data or deliver required messages.

**M5 — Client ships a large shared bundle.** The production build reports a large app/vendor
chunk. ZXing, the super-admin dashboard, and the scanner all load for a visitor who
touches nothing but the public registration form. This contradicts the product's own premise —
door staff run this on a phone, at a venue, on congested mobile data, possibly the moment they
need offline mode to have already warmed. Route-level `lazy()` and a dynamic ZXing import is the
single highest-leverage frontend change.

**M6 — God components.** `Login.tsx` 1,865 lines, `SuperAdminDashboard.tsx` 1,123,
`LiveMode.tsx` 906, `attendeeRoutes.ts` 703. These are not style complaints: the check-in and
registration paths can't be tested without rendering or booting the whole module.

**M7 — No test for the offline sync endpoint.** The idempotency claim in §4 is asserted by
reading the code, not by a test. It is the one place where a regression silently loses
attendance records.

### Minor

- 500 responses return `err.message` verbatim — driver and stack-adjacent detail to the client.
- `origin.includes('localhost')` accepts any origin containing that substring; `sameSite=strict`
  in production is what actually contains the risk.
- Super-admin token lives in `sessionStorage`/`localStorage`, unlike the main session cookie.
- No `engines` field; CI pins Node 22 but local contributors are unpinned.
- OTP and rate-limit state is in process memory. Every additional replica or restart can lose
  in-flight authentication state until these stores use shared TTL-backed storage.

---

## 9. Improvement roadmap

Ordered by risk removed per hour spent.

**Now (this week)**
1. Health endpoint reports database readiness and SMTP configuration (C2/M4). ~1 h.
2. Move OTP and quota state to Redis with TTL (C4/M2). ~3 h. Prerequisite for more than one
   API replica.
3. Untrack `node_modules` (C3) if generated dependencies remain in repository history. ~15 min
   plus coordination.
4. Sync allowed after `ENDED` with a timestamp bound (M1). ~2 h. Prevents stranded attendance.

**Next (this month)**
5. Route-level code splitting + lazy camera import (M5). ~4 h. Largest user-visible win.
6. Capacity via transaction, drop the counter (M3). ~4 h. Removes a whole class of "sold out but
   not sold out" support tickets.
7. Test the sync endpoint: concurrent duplicate scans, retry after timeout, post-end sync (M7).
   ~4 h.

**Later (this quarter)**
9. Add ESLint + Prettier and make lint a blocking CI job. Without it, CI reviews formatting by
   accident and semantics by omission.
10. Split `attendeeRoutes` and `LiveMode` along their seams (M6).
11. Request ids + structured JSON logs; `/metrics` for check-in rate and sync failures. Today
    "how many check-ins in the last hour" requires the audit log.

**Deliberately not recommended**: microservices, GraphQL, an ORM migration, or a queue broker.
Single-digit-thousands-of-attendees events do not need them, and every one of them costs more
operability than it returns at this size.

---

## 10. My read

The offline check-in design is the reason this project is worth taking seriously. Idempotency
via a conditional update on a database predicate, a client-side queue that survives reloads,
per-scan result codes, and an append-only audit log — that is a coherent answer to a hard
problem, and it is the part I would defend in a review of a much larger system.

The risk is concentrated in three places, and none of them are the code:

1. **Configuration decides the architecture.** Supabase and Gmail SMTP are required production
   dependencies. The distance between "works on my machine" and a working deployment is the
   completeness of `SUPABASE_*`, `SMTP_*`, `JWT_SECRET`, and `SUPER_ADMIN_EMAIL`.
2. **The single-instance assumption is load-bearing and undocumented.** Rate limiters, OTP
   codes, and any in-memory state mean the horizontal-scaling story is "don't". That's a fine
   choice for this product size — it just has to be written down so nobody scales it and
   discovers it in production.
3. **The frontend has grown by accretion, not by design.** Nine pages, two of them over 900
   lines, one 704 kB bundle. Nothing here is unsalvageable; it's the shape that makes features
   slower to add over time.

What I'd address first: move OTP and rate-limit state out of process memory and add readiness
checks for the database and SMTP configuration. Those changes preserve the current simple
deployment model while removing the main operational risks.

Verdict: a well-reasoned backend core with a hardening backlog, not a rewrite. The "Now" items
are the difference between a demo that impresses and a system I'd let run a real door.

---

## 11. Decisions worth recording

These have enough consequence to deserve an ADR in `decisions/`, in the format:

```
# ADR: <title>
Status: proposed | accepted | superseded by ADR-<n>
Date: <date>

## Context
## Decision
## Alternatives considered
## Consequences
```

1. **Single instance, in-process state** (rate limits, OTP). Reversal cost: high — touches auth.
2. **Offline queue in IndexedDB, not server-side draft scans.** Reversal cost: medium.
3. **Denormalised `registeredCount` for capacity.** Reversal cost: low code, but the data needs
   reconciling first.
4. **Container images to GHCR rather than a PaaS buildpack.** Reversal cost: low.
