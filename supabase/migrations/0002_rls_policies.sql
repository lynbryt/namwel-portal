-- =========================================================================
-- Row Level Security — deny all direct client access.
-- Migration 0002
--
-- All portal tables deny anon/authenticated reads and writes. The browser
-- never has direct database access. Every mutation goes through a Next.js
-- server action that uses the service-role client.
-- =========================================================================

alter table public.guide_versions               enable row level security;
alter table public.signature_sessions           enable row level security;
alter table public.travellers                   enable row level security;
alter table public.child_scenarios              enable row level security;
alter table public.document_uploads             enable row level security;
alter table public.checklist_state              enable row level security;
alter table public.section_acknowledgments      enable row level security;
alter table public.signature_records            enable row level security;
alter table public.audit_log                    enable row level security;
alter table public.user_roles                   enable row level security;
alter table public.deposits                     enable row level security;

-- guide_versions: any role can SELECT a non-retired version. Writes are service-role only.
create policy "anyone can read active guide version"
  on public.guide_versions for select
  using (retired_at is null);

-- All other tables: deny all to anon and authenticated. Server actions
-- use the service_role key which bypasses RLS.
create policy "no direct client access" on public.signature_sessions
  for all to anon, authenticated using (false) with check (false);

create policy "no direct client access" on public.travellers
  for all to anon, authenticated using (false) with check (false);

create policy "no direct client access" on public.child_scenarios
  for all to anon, authenticated using (false) with check (false);

create policy "no direct client access" on public.document_uploads
  for all to anon, authenticated using (false) with check (false);

create policy "no direct client access" on public.checklist_state
  for all to anon, authenticated using (false) with check (false);

create policy "no direct client access" on public.section_acknowledgments
  for all to anon, authenticated using (false) with check (false);

create policy "no direct client access" on public.signature_records
  for all to anon, authenticated using (false) with check (false);

create policy "no direct client access" on public.audit_log
  for all to anon, authenticated using (false) with check (false);

-- user_roles: a user can see their own role; only service_role can write.
create policy "users can read their own role"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create policy "no direct client write" on public.user_roles
  for all to anon, authenticated using (false) with check (false);

-- deposits: no client access at all in v1.
create policy "no direct client access" on public.deposits
  for all to anon, authenticated using (false) with check (false);
