create extension if not exists pgcrypto;

create table if not exists organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'organizer' check (role in ('organizer', 'superadmin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references organizers(id) on delete cascade,
  name text not null,
  description text not null default '',
  image_data_url text,
  date text not null,
  start_time text not null,
  venue text not null,
  capacity integer not null default 100 check (capacity > 0),
  registered_count integer not null default 0 check (registered_count >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'UPCOMING', 'LIVE', 'ENDED')),
  prefix text not null default 'EVT',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text not null,
  ticket_type text not null default 'General',
  ticket_code text not null,
  qr_token text not null,
  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by text,
  email_sent boolean not null default false,
  email_last_attempt_at timestamptz,
  offline_scan_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, email),
  unique (event_id, ticket_code),
  unique (event_id, qr_token)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  attendee_id uuid references attendees(id) on delete set null,
  organizer_id uuid references organizers(id) on delete set null,
  action text not null,
  timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}',
  attendee_name text not null default '',
  ticket_code text not null default ''
);

create index if not exists events_organizer_id_idx on events(organizer_id);
create index if not exists attendees_event_id_idx on attendees(event_id);
create index if not exists attendees_qr_token_idx on attendees(qr_token);
create index if not exists audit_logs_event_timestamp_idx on audit_logs(event_id, timestamp desc);

create or replace function reserve_event_capacity(p_event_id uuid)
returns events
language sql
security definer
as $$
  update events
  set registered_count = registered_count + 1, updated_at = now()
  where id = p_event_id and registered_count < capacity
  returning *;
$$;

create or replace function claim_attendee_checkin(
  p_attendee_id uuid,
  p_checked_in_at timestamptz,
  p_checked_in_by text,
  p_scan_id text default null
)
returns attendees
language plpgsql
security definer
as $$
declare
  updated_attendee attendees;
begin
  update attendees
  set checked_in_at = p_checked_in_at,
      checked_in_by = p_checked_in_by,
      offline_scan_ids = case
        when p_scan_id is null then offline_scan_ids
        when p_scan_id = any(offline_scan_ids) then offline_scan_ids
        else array_append(offline_scan_ids, p_scan_id)
      end,
      updated_at = now()
  where id = p_attendee_id
    and checked_in_at is null
    and (p_scan_id is null or not (p_scan_id = any(offline_scan_ids)))
  returning * into updated_attendee;

  return updated_attendee;
end;
$$;
