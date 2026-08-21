# Deploy to info.namwel.com.na

One-time setup, then `npm run deploy:prod` for every future deploy.

## Prerequisites

- [x] Node.js 22.x installed
- [x] A Vercel account (free): https://vercel.com/signup
- [x] Admin access to the DNS for `namwel.com.na` (your registrar)
- [x] All Supabase migrations applied (migrations 0001–0004 + guide content seeded)
- [x] All 10 environment variables ready (don't paste them in chat — type them into Vercel)

## Step 1 — Install Vercel CLI (5 min once)

```powershell
cd C:\xampp\htdocs\sign-portal
npm install -g vercel
vercel login
```

The login command opens a browser. Sign in with the same email you used for your Vercel account. After login, return to the terminal.

## Step 2 — Set environment variables in Vercel (5 min)

You can either do this before or after the first deploy. Doing it before is cleaner.

1. Open https://vercel.com/dashboard
2. You should see your account but no project yet (we haven't deployed). After step 3, your project will appear.
3. For now, skip ahead to **Step 3** (deploy), then come back to **Step 4** (env vars) once the project exists.

## Step 3 — First deploy (preview, 5–10 min)

In your project folder:

```powershell
cd C:\xampp\htdocs\sign-portal
npm run deploy:preview
```

This runs `vercel` (the Vercel CLI's preview deploy). It will ask a few questions the first time:

| Question | Answer |
|---|---|
| Set up and deploy? | **Y** |
| Which scope? | your account |
| Link to existing project? | **N** |
| Project name? | `namwel-portal` (or anything you like) |
| In which directory is your code located? | `./` (just press Enter) |
| Override settings? | **N** |

Vercel will:
- Detect Next.js
- Run `npm install` (downloads all your deps)
- Run `next build`
- Give you a URL like `https://namwel-portal-xxxxx.vercel.app`

Save that URL — that's your preview. Don't share it with clients yet.

## Step 4 — Add environment variables in Vercel (5 min)

1. Open https://vercel.com/dashboard → click your new `namwel-portal` project
2. **Settings** → **Environment Variables**
3. Add each of these 10 variables. Apply to **Production**, **Preview**, and **Development** (all three checkboxes).

| Name | Where you got it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from your local `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from your local `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | from your local `.env.local` (most sensitive — keep private) |
| `PORTAL_JWT_SECRET` | the 64-char hex from your local `.env.local` |
| `PORTAL_COOKIE_DOMAIN` | `.namwel.com.na` (with leading dot) |
| `NEXT_PUBLIC_APP_URL` | `https://info.namwel.com.na` |
| `STORAGE_BUCKET` | `sign-portal` |
| `SIGNED_URL_TTL_SECONDS` | `3600` |
| `SIGNING_WINDOW_DAYS` | `30` |
| `RETENTION_YEARS` | `5` |

**Security note:** Never paste these in chat, never commit them to GitHub, never email them unencrypted. The Vercel dashboard encrypts them at rest.

## Step 5 — Deploy to production + add custom domain (10 min)

### 5a. Production deploy

```powershell
npm run deploy:prod
```

This runs `vercel --prod`. Your production URL is `https://namwel-portal.vercel.app` (or the one Vercel assigns).

### 5b. Add your custom domain in Vercel

1. Vercel dashboard → your project → **Settings** → **Domains**
2. Type `info.namwel.com.na` → click **Add**
3. Vercel will show you the DNS records you need. Most likely:

| Type | Name | Value |
|---|---|---|
| CNAME | `info` | `cname.vercel-dns.com` |

### 5c. Add the DNS record at your registrar

1. Log in to your `.com.na` registrar (where you registered `namwel.com.na`)
2. Open DNS management for `namwel.com.na`
3. Add a new record:
   - **Type**: CNAME
   - **Host / Name**: `info`
   - **Value / Target**: `cname.vercel-dns.com`
   - **TTL**: 3600 (or auto)
4. Save

DNS propagation can take 5 min to 48 hours depending on the registrar. For `.na` domains, typically 5–30 min.

### 5d. Wait for Vercel to issue the SSL cert

Vercel watches for the DNS record to point correctly. Once it does (within minutes of DNS propagating), Vercel auto-issues a free Let's Encrypt SSL cert. The domain status in the Vercel dashboard changes from "Invalid Configuration" to **"Valid"**.

## Step 6 — Update Supabase to trust the new domain (2 min)

The wizard's Supabase Auth (used for the admin login) needs to know your production URL is allowed.

1. Open your Supabase project → **Authentication** → **URL Configuration**
2. Under **Site URL**, change `http://localhost:3000` to `https://info.namwel.com.na`
3. Under **Redirect URLs**, add: `https://info.namwel.com.na/**` (allows any path)

## Step 7 — Test the live site (5 min)

Open `https://info.namwel.com.na/login` in your browser. Test:

- [ ] Login page renders with the Namwel logo
- [ ] Admin login works at `/admin-login`
- [ ] Admin dashboard shows existing sessions
- [ ] Create a new session via `/admin/sessions/new`
- [ ] Log in to that session and go through the wizard
- [ ] Download the signed PDF — should be the real multi-page Puppeteer render now
- [ ] QR code in the PDF → verify page

## Step 8 — Set up GitHub (recommended, for v1.1)

For automatic deploys when you change code:

```powershell
git init
git add .
git commit -m "Initial commit"
```

Then create a new repo on github.com and:

```powershell
git remote add origin https://github.com/your-username/namwel-portal.git
git branch -M main
git push -u origin main
```

Connect the repo to Vercel at https://vercel.com/dashboard → Add New → Project → Import. From then on, every `git push` triggers a deploy.

---

## Future deploys (after first time)

CLI path:
```powershell
cd C:\xampp\htdocs\sign-portal
npm run deploy:prod
```

GitHub path (after setup):
```powershell
git add .
git commit -m "your message"
git push
```

Vercel auto-builds and deploys. ~2 min from push to live.

---

## If something breaks

**"Build failed"** — check the build logs. Most often it's a missing env var or a TypeScript error. Run `npm run build` locally to reproduce.

**"Domain not working"** — confirm the CNAME record exists at your registrar and Vercel shows "Valid Configuration". DNS can take time; be patient.

**"Login doesn't work"** — confirm `NEXT_PUBLIC_APP_URL` is set to your production URL (not localhost). Confirm the Supabase Site URL is also set to your production URL.

**"PDF is still a stub"** — confirm the `app/api/render-pdf` route is on the Node.js runtime (it is, in our code). Check the Vercel function logs for the actual error.

**Need to roll back** — Vercel → Project → Deployments → click an older deployment → "Promote to Production".
