import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const SERVER_ROOT = path.resolve(__dirname, '..');
const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}`;

let server: ChildProcess | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await sleep(500);
  }
  throw new Error(`Server never became healthy within ${timeoutMs}ms (${String(lastError)})`);
}

class Session {
  private cookie = '';
  private token?: string;

  async call(
    method: string,
    endpoint: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; body: any }> {
    const res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const pair = raw.split(';')[0];
      if (pair) {
        this.cookie = this.cookie ? `${this.cookie}; ${pair}` : pair;
      }
    }

    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    if (parsed?.token) this.token = parsed.token;
    return { status: res.status, body: parsed };
  }
}

const uniqueEmail = (label: string) =>
  `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.test`;

describe('GateKeeper API smoke', () => {
  before(async () => {
    const tsx = path.join(SERVER_ROOT, 'node_modules', '.bin', 'tsx');
    server = spawn(tsx, ['src/server.ts'], {
      cwd: SERVER_ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(PORT),
        MONGO_URI: '',
        JWT_SECRET: 'smoke_test_secret_at_least_32_chars_long',
        SUPER_ADMIN_PASSWORD: 'smoke-test-passcode',
        RESEND_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`));
    server.stderr?.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`));
    await waitForHealth();
  });

  after(() => {
    server?.kill('SIGTERM');
  });

  test('health endpoint reports healthy', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'healthy');
  });

  test('rejects unauthenticated access to organizer data', async () => {
    const res = await fetch(`${BASE}/api/events`);
    assert.equal(res.status, 401);
  });

  test('full flow: organizer -> event -> registration -> capacity -> check-in', async () => {
    const organizer = new Session();

    const registered = await organizer.call('POST', '/api/auth/register', {
      name: 'Smoke Organizer',
      email: uniqueEmail('organizer'),
      password: 'password123',
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));

    const me = await organizer.call('GET', '/api/auth/me');
    assert.equal(me.status, 200);

    const created = await organizer.call('POST', '/api/events', {
      name: 'Smoke Test Summit',
      description: 'Created by the smoke suite',
      date: '2027-01-15',
      startTime: '09:00 AM',
      venue: 'Test Pavilion',
      capacity: 2,
      prefix: 'SMOKE',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const eventId: string = created.body.event.id;

    const published = await organizer.call('POST', `/api/events/${eventId}/publish`);
    assert.equal(published.status, 200, JSON.stringify(published.body));

    const first = await organizer.call('POST', '/api/attendees', {
      eventId,
      name: 'Ada Lovelace',
      email: uniqueEmail('ada'),
      ticketType: 'General',
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const ticketCode: string = first.body.attendee.ticketCode;
    assert.match(ticketCode, /^SMOKE-/, 'ticket code should carry the event prefix');

    const second = await organizer.call('POST', '/api/attendees', {
      eventId,
      name: 'Grace Hopper',
      email: uniqueEmail('grace'),
    });
    assert.equal(second.status, 201, JSON.stringify(second.body));

    const third = await organizer.call('POST', '/api/attendees', {
      eventId,
      name: 'Alan Turing',
      email: uniqueEmail('alan'),
    });
    assert.equal(third.status, 400, 'third registration should be rejected as sold out');

    const started = await organizer.call('POST', `/api/events/${eventId}/start`);
    assert.equal(started.status, 200, JSON.stringify(started.body));

    const checkIn = await organizer.call('POST', '/api/attendees/checkin-code', {
      eventId,
      code: ticketCode,
    });
    assert.equal(checkIn.status, 200, JSON.stringify(checkIn.body));
    assert.equal(checkIn.body.status, 'VALID');

    const duplicate = await organizer.call('POST', '/api/attendees/checkin-code', {
      eventId,
      code: ticketCode,
    });
    assert.equal(duplicate.body.status, 'DUPLICATE');
  });

  test('tenant isolation: another organizer cannot read the event', async () => {
    const owner = new Session();
    await owner.call('POST', '/api/auth/register', {
      name: 'Owner',
      email: uniqueEmail('owner'),
      password: 'password123',
    });
    const created = await owner.call('POST', '/api/events', {
      name: 'Private Event',
      date: '2027-02-01',
      startTime: '10:00 AM',
      venue: 'Owner Only Hall',
      capacity: 10,
      prefix: 'PRIV',
    });
    const eventId: string = created.body.event.id;

    const intruder = new Session();
    await intruder.call('POST', '/api/auth/register', {
      name: 'Intruder',
      email: uniqueEmail('intruder'),
      password: 'password123',
    });

    const direct = await intruder.call('GET', `/api/events/${eventId}`);
    assert.equal(direct.status, 404, 'event must not be visible to a non-owner');

    const forged = await intruder.call('GET', `/api/events/${eventId}`, undefined, {
      'x-super-admin-token': 'forged-token-value',
    });
    assert.equal(forged.status, 404, 'unverified passcode header must not grant cross-tenant access');

    const forgedAttendees = await intruder.call('GET', `/api/attendees?eventId=${eventId}`, undefined, {
      'x-super-admin-token': 'forged-token-value',
    });
    assert.equal(forgedAttendees.status, 404, 'attendee list must stay scoped to the owner');
  });
});
