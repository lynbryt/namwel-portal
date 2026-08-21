-- =========================================================================
-- Seed the v1.0 guide.
-- Migration 0004
--
-- The full JSON lives in supabase/seed/guide-v1.json. To load it:
--   psql $DATABASE_URL -c "\copy (select pg_read_file('supabase/seed/guide-v1.json')) to stdout" \
--     | psql $DATABASE_URL -c "insert into public.guide_versions (version, content_json) values ('v1.0', jsonb_read_file_or_stdin);"
--
-- Or, more simply, run `npm run seed:guide` which calls the helper in
-- lib/guide/seed.ts via the supabase service-role key.
-- =========================================================================

insert into public.guide_versions (version, content_json, effective_from)
select
  'v1.0',
  pg_read_file('supabase/seed/guide-v1.json')::jsonb,
  now()
where not exists (
  select 1 from public.guide_versions where version = 'v1.0'
);
