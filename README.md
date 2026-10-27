A full-stack event check-in web app. Attendees self-register for an event and receive a QR-coded ticket by email. Organizers log in, manage events, and check attendees in at the door by scanning (or manually entering) their ticket code.

Built as an industrial training (SIWES) project.

## Features

- **Public registration** — attendees register with name/email/ticket type and receive a QR-coded ticket by email, with an on-screen backup ticket (QR + selectable plain-text code) in case email is slow or undelivered
- **Organizer auth** — JWT-based login and protected routes, with email OTP verification required before a new organizer account is created
- **Super Admin security** — the configured Super Admin email must verify a six-digit OTP before cross-tenant access is granted
- **Multi-event dashboard** — organizers can manage and switch between every event they own, with live stats, a check-in-over-time chart, and a searchable/filterable attendee table with CSV export
- **QR check-in** — camera-based scanning (`@zxing/browser`) with a manual code-entry fallback, duplicate-scan protection, and an undo action for mis-scans
- **Offline-resilient scanning** — scans queue locally (IndexedDB) if the network drops, and sync automatically once connectivity returns
- **Rate-limited public endpoint** — the open registration endpoint is protected against abuse
- **Resend ticket email** — organizers can re-trigger the ticket email for any attendee whose email failed to send
- **Shared OTP abuse protection** — login, password reset, organizer registration, and Super Admin OTP requests share a five-per-email-per-hour quota

## Tech Stack

- **Client:** React + Vite (TypeScript/TSX), Tailwind CSS
- **Server:** Express + Supabase PostgreSQL (TypeScript)
- **Auth:** JSON Web Tokens (JWT)
- **Email:** Nodemailer with Gmail SMTP
- **QR generation:** `qrcode`
- **QR scanning:** `@zxing/browser`

## Local setup

1. Install dependencies with `npm install`, `npm install --prefix server`, and `npm install --prefix client`.
2. Copy `server/.env.example` to `server/.env` and set `JWT_SECRET` to a random value of at least 32 characters.
3. Create the database by running [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor.
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_URL`, `SUPER_ADMIN_EMAIL`, `SMTP_USER`, and a Gmail App Password in the server environment.
5. Run both applications with `npm run dev`. The API uses port `5001` and the Vite client uses port `5173`.

Organizer login supports password and email OTP. New organizer registration requires email OTP
verification. Google login is intentionally disabled until server-side OAuth token verification
is configured.
