# Aligned Protocol

A real, working rebuild of the client-facing Aligned Audit — same dark
navy/gold design you already built, but now actually backed by a database
instead of being a static demo.

## What changed from the old static version

- **The whole client journey now saves for real.** Sign in, start the audit,
  answer all ten areas, pick your focus area, see your score — every step
  writes to Supabase and survives a refresh or a new device.
- **Login is fixed.** The old `login.html` routed real client sign-ins to a
  `client.html` file that didn't exist in the repo (a guaranteed 404 on every
  client login). This version's login goes to a route that's actually there.
- **Every table is protected by real security rules (Row-Level Security)** —
  you can only ever read or write your own data. A coach role exists in the
  schema and can see their assigned clients' data, but nothing coach-facing
  is built into the app yet (see "What's next" below).
- **The visual design is untouched.** Same colours, same fonts (Sora + DM
  Sans), same components — this is the exact CSS from your prototype, ported
  into real, reusable page templates instead of one giant static file.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Apply the database schema

This project already has a Supabase project from the old prototype
(`yeedrmvikdjcrjvfyceo`). To use it here:

1. Open that project's **SQL Editor** in the Supabase dashboard.
2. Paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   and run it. This creates every table (`profiles`, `life_areas`, `audits`,
   `audit_responses`, `clear_plans`, `goals`, `weekly_checkins`,
   `session_notes`), all the security rules, and seeds the ten life areas
   with the exact copy from your original prototype.
3. **If you already have real rows in that project from the old prototype's
   coach.html testing**, check they don't conflict with this schema before
   running it — this migration assumes a clean slate. Ask me first if you're
   not sure.

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Then fill in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
from **Settings → API** in your Supabase project dashboard. The service role
key is only ever read on the server — never commit it, never put it in a
`NEXT_PUBLIC_` variable.

### 4. Run it

```bash
npm run dev
```

## What's built (this milestone)

- `/login` — sign in, create account, and request a password reset, as three
  tabs on one page. New accounts are always created with `role: 'client'` —
  there's no self-serve way to become a coach.
- `/` — dashboard. Shows your latest Alignment Score once you've completed an
  audit, or a prompt to start one if you haven't.
- `/audit` — resumes an in-progress audit at the first unanswered area, or
  starts a new one.
- `/audit/[1-10]` — one life area per screen, autosaving on every change. The
  two rating questions (satisfaction 1–10, importance 1–5) use visibly
  different controls on purpose — a design decision carried over from the
  original brief, and just good practice: two identical-looking scales get
  mis-answered.
- `/audit/leverage` — the "if one area improved, which would help the others
  most" question.
- `/audit/results` — the score reveal.
- `/coach` — a coach who signs in lands here. It's currently a placeholder;
  see "What's next."

## What's next (not built yet, on purpose — not an oversight)

- **CLEAR Process, My Goals, My Summary** — the nav links exist and go to
  clearly-labelled "not built yet" pages rather than 404ing. The database
  schema for all three already exists (`clear_plans`, `goals`,
  `weekly_checkins`) so this is UI work, not schema work.
- **The coach dashboard.** This is the big one from the original audit —
  porting coach.html's client roster, per-client detail, and session notes
  into this app as real Server Components. The database schema for it
  (`profiles.role`/`coach_id`, `session_notes`) is already in this migration,
  written to match exactly what coach.html was already querying, so nothing
  about the schema needs to change when this gets built.
- **The "add client" flow's security bug is designed around, not yet
  wired up.** The old coach.html created a new client by calling
  `supabase.auth.signUp()` directly from the coach's own browser tab — which
  silently signs the *coach* out and signs them in as the new client, because
  that's how the Supabase JS client's signUp works. `lib/supabase/admin.ts`
  is already set up to do this safely (server-side, via the service role
  key, never touching the coach's session) — the coach-side UI to call it is
  part of the coach dashboard work above.

## A note on the database

The old prototype had two disconnected Supabase projects: one used by
`login.html`/`coach.html` (`yeedrmvikdjcrjvfyceo` — this one), and a
completely separate one used by the other build Steve did
(`sxwmtevohcgkajouwubg`). This app uses your own project, since this is the
one you have full dashboard access to and control independently.
