-- =========================================================================
-- Storage buckets.
-- Migration 0003
--
-- Run via the Supabase SQL editor or supabase-cli. The sign-portal bucket
-- holds all client uploads and signed PDFs. It is private; access is via
-- signed URLs only (1h TTL by default).
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sign-portal',
  'sign-portal',
  false,
  15728640, -- 15 MB
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Path convention enforced in server actions:
--   sign-portal/uploads/{session_id}/{doc_type}/{uuid}.{ext}     (raw client uploads)
--   sign-portal/signatures/{session_id}/signature.png            (drawn signature)
--   sign-portal/signed/{session_id}/guide.pdf                    (final PDF)
--
-- No storage RLS policies: only the service_role key writes to this
-- bucket, so no client-side reads or writes are possible. All browser
-- access is proxied through /api routes that mint signed URLs.
