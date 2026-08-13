# Lovers Lane Staff Wellbeing Baseline

Vite + React frontend, Supabase for data + reviewer login, deployed on Cloudflare Pages.

## 1. Unzip and install

```
cd lovers-lane-baseline
npm install
```

## 2. Set up the Supabase table

In your Supabase project dashboard: **SQL Editor → New query**, paste the contents
of `supabase/schema.sql`, and run it. This creates the `checkins` table and locks
it down so anyone can submit a check-in, but only a signed-in reviewer can read them.

## 3. Create a reviewer login

**Authentication → Users → Add user** in the Supabase dashboard. Create one account
per Brain Performance Center coordinator (email + password). This is what they'll
use to sign in on the "Review check-ins" screen — no more shared passphrase.

## 4. Connect your env vars

```
cp .env.example .env
```

Fill in `.env` with your project's URL and anon public key, both found in
**Project Settings → API** in the Supabase dashboard.

## 5. Run it locally

```
npm run dev
```

Opens at `http://localhost:5173`.

## 6. Push to GitHub

```
git init
git add .
git commit -m "Initial staff wellbeing baseline app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/lovers-lane-baseline.git
git push -u origin main
```

## 7. Deploy on Cloudflare Pages

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**,
pick this repo, and set:

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  (same values as your `.env`)

Cloudflare will build and deploy automatically on every push to `main`.

## Notes

- Staff don't need an account to submit a check-in — the name field is just text.
  If two people type their name slightly differently, they'll show up as separate
  people in the reviewer view. Worth telling staff to use a consistent full name.
- The reviewer role check is enforced by Supabase Row Level Security, not just
  the app's UI — even a direct API call can't read check-ins without a valid
  reviewer session.
- Next reasonable additions: email reminders when someone hasn't checked in for
  a few months, CSV export for the coordinator, per-question notes.
