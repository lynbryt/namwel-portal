# Namwel Sign Portal

Digital signing portal for the Namwel Tours & Car Rentals Tourist Information Guide. Clients log in with a reference number + password, read the guide, complete the children-under-18 branch when applicable, upload required documents, and submit a drawn + typed signature. A signed PDF is generated and stored in a private bucket; a public verification URL is embedded in the PDF and available at `/verify/[id]`.

The full spec lives at `../namwel-spec/SPEC.md`.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (Dune design system)
- Supabase (Postgres + Auth + Storage)
- argon2id password hashing
- jose JWT for the portal session cookie
- Puppeteer (Puppeteer-core + @sparticuz/chromium on Vercel) for PDF generation
- EmailJS for transactional email (existing setup)

## Folder structure

```
app/
  (portal)/            # client-facing wizard
    login/             # ref + password login
    sign/              # the 5-screen wizard
      _actions/        # server actions
      _components/     # client components
  (admin)/             # founder dashboard
  admin-login/         # Supabase auth for admins
  verify/[signatureId]/ # public verification
  api/                 # render-pdf, download-pdf, logout

lib/
  supabase/            # client / server / admin clients
  auth/                # password, reference, session, rate-limit
  audit/               # append-only log writer
  pdf/                 # Puppeteer + stub renderer
  i18n/                # v1: EN only

supabase/
  migrations/          # 4 SQL files, apply in order
  seed/                # guide-v1.json

tests/
  unit/                # vitest
  e2e/                 # playwright
```

## Setup

1. Create a Supabase project. Run the 4 migrations in order:

   ```bash
   psql $DATABASE_URL -f supabase/migrations/0001_init_schema.sql
   psql $DATABASE_URL -f supabase/migrations/0002_rls_policies.sql
   psql $DATABASE_URL -f supabase/migrations/0003_storage_buckets.sql
   psql $DATABASE_URL -f supabase/migrations/0004_seed_guide_v1.sql
   ```

2. Create the founder user in Supabase Auth, then grant the role:

   ```sql
   insert into public.user_roles (user_id, role, notes)
   values ('<auth-user-uuid>', 'founder', 'Initial founder');
   ```

3. Copy `.env.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   PORTAL_JWT_SECRET=           # openssl rand -hex 32
   ```

4. Install + run:

   ```bash
   npm install
   npm run dev
   ```

5. To create a test signing session:

   ```sql
   insert into public.deposits (booking_id, amount, confirmed_at, confirmed_by, reference)
   values ('BOOKING-DEMO', 5000.00, now(), '<founder-user-id>', 'TRX-001');

   insert into public.signature_sessions
     (booking_id, reference_code, password_hash, guide_version_id,
      status, lead_traveller_email, lead_traveller_name, expires_at)
   values (
     'BOOKING-DEMO',
     'NMT-7K3M9X',
     '$argon2id$v=19$m=19456,t=2,p=1$...$...',  -- use lib/auth/password.ts#hashPassword
     (select id from public.guide_versions where version = 'v1.0' limit 1),
     'pending',
     '[email protected]',
     'Demo Lead',
     now() + interval '30 days'
   );
   ```

6. To run tests:

   ```bash
   npm run test:unit   # vitest, no Supabase required
   npm test            # playwright, requires dev server
   ```

## Notes for the founder

- This build is v0.1. The happy path is wired end-to-end. The Puppeteer PDF render is in place but falls back to a stub PDF when Chromium is not available — install Chromium or run on Vercel to get the real PDF.
- The admin "Create signing session" UI is the next sprint. For now, sessions are created via SQL (see above).
- v1.1 work: French UI, real-time validation, document expiry reminders, signature reminders via email 7 days before expiry.
