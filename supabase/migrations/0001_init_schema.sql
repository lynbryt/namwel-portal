-- =========================================================================
-- Namwel Sign Portal — initial schema
-- Migration 0001
-- =========================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- guide_versions: pin the guide text per session. v1.0 is seeded by 0004.
-- -------------------------------------------------------------------------
create table public.guide_versions (
  id              uuid primary key default gen_random_uuid(),
  version         text not null unique,
  content_json    jsonb not null,
  effective_from  timestamptz not null default now(),
  retired_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- signature_sessions: one per booking, lifecycle from creation to sign.
-- -------------------------------------------------------------------------
create table public.signature_sessions (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            text not null,
  reference_code        text not null unique,
  password_hash         text not null,
  guide_version_id      uuid not null references public.guide_versions(id),
  status                text not null default 'pending'
                          check (status in ('pending','in_progress','signed','expired','revoked','archived')),
  language              text not null default 'en' check (language in ('en','fr')),
  lead_traveller_email  text not null,
  lead_traveller_name   text not null,
  party_size            int,
  has_minor             boolean,
  retain_until          timestamptz,
  created_at            timestamptz not null default now(),
  last_activity_at      timestamptz not null default now(),
  signed_at             timestamptz,
  expires_at            timestamptz not null,
  completed_ip          inet,
  completed_user_agent  text,
  content_hash          text,
  pdf_path              text,
  archived_at           timestamptz,
  previous_session_id   uuid references public.signature_sessions(id)
);

create index signature_sessions_booking_idx on public.signature_sessions (booking_id);
create index signature_sessions_status_idx  on public.signature_sessions (status);

-- -------------------------------------------------------------------------
-- travellers: every person in the party (incl. lead). Populated in screen 1.
-- -------------------------------------------------------------------------
create table public.travellers (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.signature_sessions(id) on delete cascade,
  full_name        text not null,
  date_of_birth    date not null,
  is_minor         boolean not null,
  role             text not null check (role in ('lead','spouse','child','companion','other')),
  passport_number  text,
  passport_expiry  date,
  passport_country text,
  ordinal          int not null,
  created_at       timestamptz not null default now()
);

create index travellers_session_idx on public.travellers (session_id);

-- -------------------------------------------------------------------------
-- child_scenarios: one row per minor, captures the branch from Section 3.
-- -------------------------------------------------------------------------
create table public.child_scenarios (
  id                              uuid primary key default gen_random_uuid(),
  traveller_id                    uuid not null references public.travellers(id) on delete cascade,
  scenario                        text not null
                                    check (scenario in ('both_parents','one_parent','grandparent_guardian','unaccompanied')),
  non_travelling_parent_name      text,
  non_travelling_parent_id_last4  text,
  receiving_person_name           text,
  receiving_person_address        text,
  notes                           text,
  created_at                      timestamptz not null default now()
);

create index child_scenarios_traveller_idx on public.child_scenarios (traveller_id);

-- -------------------------------------------------------------------------
-- document_uploads: every uploaded file with metadata + sha256.
-- -------------------------------------------------------------------------
create table public.document_uploads (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.signature_sessions(id) on delete cascade,
  traveller_id       uuid references public.travellers(id) on delete set null,
  doc_type           text not null,
  storage_path       text not null,
  original_filename  text not null,
  mime_type          text not null,
  byte_size          bigint not null,
  sha256             text not null,
  uploaded_at        timestamptz not null default now(),
  verified_by_admin  boolean not null default false,
  verified_at        timestamptz,
  verified_by        text,
  rejected_reason    text
);

create index document_uploads_session_idx   on public.document_uploads (session_id);
create index document_uploads_traveller_idx on public.document_uploads (traveller_id);
create index document_uploads_doctype_idx   on public.document_uploads (doc_type);

-- -------------------------------------------------------------------------
-- checklist_state: per checklist item, per session.
-- -------------------------------------------------------------------------
create table public.checklist_state (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.signature_sessions(id) on delete cascade,
  item_key    text not null,
  checked     boolean not null default false,
  checked_at  timestamptz,
  unique (session_id, item_key)
);

create index checklist_state_session_idx on public.checklist_state (session_id);

-- -------------------------------------------------------------------------
-- section_acknowledgments: per section, per session.
-- -------------------------------------------------------------------------
create table public.section_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.signature_sessions(id) on delete cascade,
  section_key     text not null,
  acknowledged    boolean not null default false,
  acknowledged_at timestamptz,
  unique (session_id, section_key)
);

create index section_acks_session_idx on public.section_acknowledgments (session_id);

-- -------------------------------------------------------------------------
-- signature_records: the final submission. One per session, immutable.
-- -------------------------------------------------------------------------
create table public.signature_records (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null unique references public.signature_sessions(id) on delete restrict,
  signed_name          text not null,
  signature_image_path text not null,
  ip                   inet not null,
  user_agent           text not null,
  signed_at            timestamptz not null default now(),
  declarations_json    jsonb not null,
  content_hash         text not null,
  guide_version_id     uuid not null references public.guide_versions(id)
);

create index signature_records_session_idx on public.signature_records (session_id);

-- -------------------------------------------------------------------------
-- audit_log: append-only. No UPDATE policy. Insert via service_role only.
-- -------------------------------------------------------------------------
create table public.audit_log (
  id           bigserial primary key,
  session_id   uuid references public.signature_sessions(id) on delete set null,
  actor        text not null,
  event_type   text not null,
  event_data   jsonb,
  ip           inet,
  user_agent   text,
  occurred_at  timestamptz not null default now()
);

create index audit_log_session_idx  on public.audit_log (session_id, occurred_at desc);
create index audit_log_event_idx    on public.audit_log (event_type);
create index audit_log_occurred_idx on public.audit_log (occurred_at desc);

-- -------------------------------------------------------------------------
-- user_roles: founder + super_admin gating for the admin dashboard.
-- -------------------------------------------------------------------------
create table public.user_roles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('founder','super_admin')),
  granted_by   uuid references auth.users(id),
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  notes        text
);

-- -------------------------------------------------------------------------
-- deposits: gate session creation. A session is only created after deposit
-- is confirmed. decision 7.
-- -------------------------------------------------------------------------
create table public.deposits (
  id            uuid primary key default gen_random_uuid(),
  booking_id    text not null,
  amount        numeric(12,2) not null,
  currency      text not null default 'NAD',
  confirmed_at  timestamptz,
  confirmed_by  uuid references auth.users(id),
  reference     text,
  notes         text,
  created_at    timestamptz not null default now()
);

create index deposits_booking_idx on public.deposits (booking_id);
create unique index deposits_one_confirmed_per_booking on public.deposits (booking_id) where confirmed_at is not null;

-- -------------------------------------------------------------------------
-- Helpful view for the admin dashboard
-- -------------------------------------------------------------------------
create view public.v_signing_overview as
select
  s.id,
  s.booking_id,
  s.reference_code,
  s.status,
  s.lead_traveller_email,
  s.lead_traveller_name,
  s.party_size,
  s.has_minor,
  s.created_at,
  s.signed_at,
  s.expires_at,
  gv.version as guide_version,
  (select count(*) from public.travellers t where t.session_id = s.id) as traveller_count,
  (select count(*) from public.document_uploads d where d.session_id = s.id) as upload_count,
  (select count(*) from public.section_acknowledgments a where a.session_id = s.id and a.acknowledged) as ack_count
from public.signature_sessions s
join public.guide_versions gv on gv.id = s.guide_version_id;
