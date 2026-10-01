# Warzone Eternal — app

React + TypeScript + Vite app for the roster builder. So far it has the account flows from the Claude Design handoff (`Account Flows.dc.html`): Log in, Sign up, Forgot password, Set new password, and My Lists. The roster builder itself still lives in `../index.html` and has not been moved in yet.

## Run it

```sh
cd app
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build    # type-check + production build into dist/
```

With no `.env`, the app runs on the **local backend**: accounts and lists are stored in this browser's localStorage only. A demo account is seeded the first time it runs:

- email `demo@example.com`
- password `Demo1234!`

It has four sample lists. Google sign-in reports "not available" in local mode.

## Connect Supabase

1. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API). Never use the `service_role` / secret key here.
2. Run `supabase/migrations/0001_lists.sql` in the SQL Editor. It creates the `lists` table, the `updated_at` trigger, and row-level security so each player only sees their own lists.
3. Authentication → URL Configuration:
   - Site URL: `http://localhost:5173` for now.
   - Redirect URLs: add `http://localhost:5173/**`.
   - Add the production origin once hosting is decided.
4. Optional: turn on the Google provider (needs an OAuth client from Google Cloud Console).
5. Before launch, set up custom SMTP. The built-in mailer is heavily rate-limited.

The app picks Supabase automatically when both env vars are set (`src/lib/backend/index.ts`).

## Layout

| Path | What |
| --- | --- |
| `src/lib/types.ts` | `Backend` interface, `SavedList`, auth error codes |
| `src/lib/backend/local.ts` | localStorage backend (dev/demo) |
| `src/lib/backend/supabase.ts` | Supabase backend: PKCE auth, "Keep me signed in" via session/local storage, list cache for offline reads |
| `src/lib/strings.ts` | User-facing auth error messages, keyed by code (ready for a Polish locale) |
| `src/screens/*` | Screens; `MyLists` + `ListCard` + `AccountMenu` |
| `src/styles.css` | Design tokens and styles, values taken from the design file |

## Not done yet

- **Builder:** Edit and New list only show a toast until the builder is moved into this app. Duplicate and Delete work for real.
- **Supabase backend:** written and type-checked, but not yet run against a live project. The automated tests use the local backend.
- **Offline:** offline use is read-only. Supabase lists are cached, so My Lists opens without a signal. Duplicating or deleting while offline shows an error, and there is no queued sync yet.
- **Account settings:** not designed yet. The menu item shows a toast.
- **Terms and Privacy:** the links point to `#`.
- **Hosting:** uses `BrowserRouter`, so the host must rewrite unknown paths to `index.html` (Vercel, Netlify and Cloudflare Pages all do this easily). Set `base` in `vite.config.ts` if serving from a sub-path.
- **Departures from the design:**
  - The prototype's screen-switcher bar is gone. It was there only for the demo.
  - Set new password is a new screen; the design had no screen for the emailed link.
  - Below 440px the account button shows only the avatar, so the title stays on one line.
