# WatsTheMove

See what your friends are doing at Waterloo and join with one tap.

React + Vite front end. Supabase (Postgres + email-code login) for the real backend. With no keys set it runs
in **demo mode**: everything stays in the browser and the login code is `123456`.

## Run it on your computer

```bash
npm install
npm run dev        # http://localhost:5173 in demo mode
npm test           # 53 tests
npm run build
```

## What the tests cover

- `src/lib/*.test.ts`: who can see which move, class clash and free/busy logic, .ics import.
- `src/test/schema.test.ts`: runs `supabase/schema.sql` in a real in-memory Postgres and checks the privacy
  rules: strangers cannot see close-only moves, nobody can join a move they cannot see, friends cannot read each
  other's class times, only `@uwaterloo.ca` emails can create an account.
- `src/App.test.tsx`: sign in, one-tap join, posting, filters, invite links, schedule (demo backend).

**Not yet tested:** the live Supabase client (`src/api/supabase.ts`) against a real Supabase project. It
typechecks and the SQL it depends on is tested, but expect to fix a small thing or two on first run.

## Go live for testers

1. **Supabase** (free): create a project at supabase.com.
2. SQL editor: paste and run `supabase/schema.sql`.
3. Authentication > Sign In / Providers > Email: enable it. Authentication > Email Templates > *Magic Link*:
   make sure the body contains `{{ .Token }}` (the 6-digit code), for example
   `<p>Your WatsTheMove code is {{ .Token }}</p>`. Without this, users get a link, not a code.
4. Supabase's built-in email sender allows only a few emails per hour. Set up a custom SMTP sender
   (Authentication > Emails > SMTP Settings), for example a free Resend account, before inviting testers.
5. Project Settings > API: copy the Project URL and the `anon` public key.
6. **Vercel** (free): import this GitHub repo. Add environment variables `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. Deploy. Add the Vercel URL under Authentication > URL Configuration > Site URL.
7. Seed some campus events with `supabase/seed_events.sql`.
8. Open the site on your phone, sign in, and use *Friends > Invite a friend* to send your link to testers.
   Tell them to use Share > Add to Home Screen so it opens like an app.

## What is and is not in v1

- In: UW email + code login, post a move, one-tap join, close/friends/Waterloo audiences, free-now, class clash
  warning, .ics schedule import, invite links, share-a-move links, campus events, add to calendar.
- Out on purpose: per-move chat, push notifications, live (instant) updates. The feed refreshes every 20 seconds
  and when you reopen the app.
- Privacy: the app stores weekday and time of busy blocks only, never course names. Friends can learn whether
  a friend is free right now, never what the class is. Names and programs are visible to other signed-in UW
  students; emails are not.
