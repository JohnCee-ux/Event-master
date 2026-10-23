# Architecture

GateKeeper is a multi-tenant event registration and door check-in system: organizers create
events, attendees self-register through a public link and receive a QR ticket, and door staff
scan tickets — including while offline at the venue.

Two deployable units: a React SPA (`client/`) and an Express API (`server/`), sharing type
editions from `shared/types.ts`. MongoDB is the only stateful dependency.

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
                     MongoDB (Atlas)          Resend (email)
                                              qrcode (ticket image)
```

| Component | Owns | Does not own |
|---|---|---|
| `client/` | Session state, offline queue, camera scanning, all rendering | Authorisation decisions, capacity, ticket uniqueness |
| `server/` | Identity, tenancy, capacity, ticket issuance, audit trail | Rendering, offline buffering |
| `shared/types.ts` | Wire contract between the two | Runtime logic |
| MongoDB | Durable state; compound uniqueness enforces registration invariants | — |

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
account holds the `superadmin` role. Handlers downstream receive `req.event` already
authorised, so no route can forget the tenancy check.

API surface (all under `/api`):

| Prefix | Auth | Purpose |
|---|---|---|
| `/auth` | none / cookie | register, login, OTP, password reset, `/me` |
| `/events` | cookie | event CRUD, publish/start/end lifecycle, analytics, summary, CSV export, audit log |
| `/attendees` | public + cookie | public registration, ticket lookup, check-in by code, listing, resend |
| `/checkins` | cookie | batch sync of offline scans |
| `/super-admin` | cookie + passcode JWT | cross-tenant oversight, user/event/registration purge, exports |

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

**Super admin.** A separate passcode (`SUPER_ADMIN_PASSWORD`) exchanged for a second,
short-lived JWT carrying `superAdminAuth: true`. `requireSuperAdmin` verifies that token's
signature *and* that the id matches the logged-in organizer. Cross-tenant powers do not
leak from the organizer session.

**Rate limits.** In-process `express-rate-limit`: 30/min on public registration, 20/15 min on
auth, 10/15 min on ticket lookup. Correct for a single instance; meaningless across replicas.

**Errors.** Central handler maps Mongoose validation, cast, duplicate-key, JWT, and malformed
JSON into 4xx with a message, falling through to 500 otherwise. Rotation of `err.message` into
the response body means internal failures can leak driver text.

**DB resolution** (`server/src/config/db.ts`): four tiers — `MONGO_URI` → local `27017` →
embedded `MongoMemoryServer` → an in-process JS store (`memoryDb.ts`, 234 lines reimplementing
a Mongo query subset). The intent is a zero-setup dev experience. In production it is a
liability: a failed Atlas connection still starts the server successfully on an ephemeral store.
See finding C2.

---

## 6. Deployment

| Environment | Client | API | Notes |
|---|---|---|---|
| Local dev | `vite` :5173 | `tsx watch` :5000 | Vite proxies `/api` → `:5000` |
| Compose | nginx :8080 | node :5000 | `docker compose up --build` |
| Production | GHCR `…-web` | GHCR `…-api` | Images built and pushed by CI |

Images: `server/Dockerfile` (multi-stage, production deps only, non-root `USER node`, HTTP
healthcheck on `/api/health`) and `client/Dockerfile` (Vite build → nginx, `API_UPSTREAM`
substituted at container start so one image serves any environment).

Both build from the repository root, because the client imports `../shared`.

`docker-compose.yml` runs api + web + mongo with health-gated startup ordering — a local
production rehearsal, not a production topology (single replica, no TLS).

Note on the API runtime: it is Alpine, and `mongodb-memory-server` ships in `dependencies`
but cannot run there — no official mongod build for musl. The embedded tier is a dev-machine
convenience, not a container fallback. See C2.

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

**C1 — Cross-tenant read/write via forged passcode header. *(fixed)***
`ownershipMiddleware.ts` treated the mere *presence* of `x-super-admin-token` (header or cookie)
as superadmin, without verifying the JWT. Any authenticated organizer could send
`x-super-admin-token: anything` and read or delete another organizer's event — attendee list, CSV
export, audit log included. Fixed: the bypass now requires a DB-backed `role === 'superadmin'`;
passcode verification stays in `requireSuperAdmin`. Covered by a regression test that fails
against the old code.

**C2 — Silent fallback to a non-durable store.**
`config/db.ts` starts the API successfully on an in-process store when Mongo is unreachable.
Symptoms: indistinguishable from a working server, `/api/health` still returns `healthy`,
and all writes vanish on restart. In development this is a feature. In production it converts a
transient database outage into permanent data loss.

Reproduced in the built image, not argued from reading: `NODE_ENV=production`, no reachable
Mongo, embedded tier unavailable on Alpine (`Unknown/unsupported linux "alpine"`) — the
container still came up, answered `/api/health` with `200 healthy`, and accepted writes into
`memoryDb`. Exactly the failure mode that produces "the event ran fine and now every ticket is
gone".

Fix: fail closed when `NODE_ENV === 'production'`, report the active store in the health payload,
and drop `mongodb-memory-server` from production dependencies.

**C3 — `node_modules` is committed to git (14,779 tracked files).**
Root cause: `.gitignore` was UTF-16LE, so git never parsed `node_modules/` — verified with
`od -c`. Fixed the file. Untracking is a separate, unavoidable-large commit:
`git rm -r --cached client/node_modules server/node_modules` then commit. Coordinate it — every
collaborator must re-clone or their next commit resurrects the directory.

**C4 — The super-admin passcode fallback is published in the repo.**
`getSuperAdminPasscode()` (`superAdminMiddleware.ts:10`) returns
`process.env.SUPER_ADMIN_PASSWORD || 'GateKeeper#SuperAdmin2026!'`. That literal is the same value
in `server/.env.example` and in this repository's history (`git log -S` finds it in `c88b0d9`).
A deployment that forgets the env var is protected by a password anyone reading the repo can see.
Fix: no default — throw on startup when unset, exactly as `JWT_SECRET` already does in
`server.ts:96`. Rotate the value wherever it has been used.

Related, lower severity: an earlier `.env` was committed with a `JWT_SECRET`
(`gatekeeper_jwt_super_secret_production_key_2026`, removed in `9e79d3e`). It is not the current
secret, but any environment that reused it needs rotation and the current value kept out of
history.

### Major

**M1 — Offline scans become unsyncable once an event ends** (§4). 409 on sync, no recovery path
in the UI. Fix: allow sync for `ENDED` events while the scan timestamp precedes `endedAt`.

**M2 — OTP state is process memory** (`authRoutes.ts:14-15`). Restart drops in-flight codes;
two replicas means a 50% chance the verifying instance never saw the code. Expired entries are
never evicted — unbounded growth. Fix: Redis with TTL, which the stack already runs.

**M3 — Two sources of truth for registration count.** Capacity is reserved against the
`registeredCount` counter; every read path recomputes from `aggregate`. Drift (a rollback that
failed mid-flight, a manual delete) makes an event permanently unsellable while the dashboard
shows free seats. Fix: derive capacity from the attendee collection inside a transaction, or
reconcile the counter on every list read.

**M4 — Health check proves liveness, not readiness** (`server.ts:74`). It reports nothing about
the database, the active store tier, or email configuration. Consequence: C2 is invisible, and
orchestrators keep routing traffic to an instance that cannot persist.

**M5 — Client ships one 704 kB bundle.** Verified `vite build`: 704 kB app chunk + 181 kB vendor
(236 kB gzip). ZXing, the super-admin dashboard, and the scanner all load for a visitor who
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
- `memoryDb.ts` reimplements a Mongo query subset. Every future query feature risks behavioural
  divergence between dev and production.

---

## 9. Improvement roadmap

Ordered by risk removed per hour spent.

**Now (this week)**
1. Fail closed on production DB connection (C2). ~1 h. Eliminates the only plausible
   silent data-loss mode.
2. No default super-admin passcode; fail on startup when unset, and rotate (C4). ~30 min.
3. Health endpoint reports store tier and DB ping (M4). ~1 h. Makes C2 observable.
4. Untrack `node_modules` (C3). ~15 min plus coordination.
5. Sync allowed after `ENDED` with a timestamp bound (M1). ~2 h. Prevents stranded attendance.

**Next (this month)**
5. Move OTP store to Redis with TTL (M2). ~3 h. Prerequisite for running more than one replica.
6. Route-level code splitting + lazy camera import (M5). ~4 h. Largest user-visible win.
7. Capacity via transaction, drop the counter (M3). ~4 h. Removes a whole class of "sold out but
   not sold out" support tickets.
8. Test the sync endpoint: concurrent duplicate scans, retry after timeout, post-end sync (M7).
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

1. **Configuration decides the architecture.** The DB tier ladder and the passcode default mean
   a production deploy can be running something nobody intended and report itself healthy.
   The distance between "works on my machine" and "silently losing writes in production" is one
   unset environment variable.
2. **The single-instance assumption is load-bearing and undocumented.** Rate limiters, OTP
   codes, and any in-memory state mean the horizontal-scaling story is "don't". That's a fine
   choice for this product size — it just has to be written down so nobody scales it and
   discovers it in production.
3. **The frontend has grown by accretion, not by design.** Nine pages, two of them over 900
   lines, one 704 kB bundle. Nothing here is unsalvageable; it's the shape that makes features
   slower to add over time.

What I'd cut if it were mine: the `memoryDb.ts` reimplementation. It exists to make `npm run dev`
need zero setup, and the embedded `MongoMemoryServer` tier already delivers that with the real
engine. Two substitutes for the same problem is one too many, and only one of them can drift.

Verdict: a genuinely well-reasoned backend core with a hardening backlog, not a rewrite. The
four "Now" items are the difference between a demo that impresses and a system I'd let run a
real door.

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
