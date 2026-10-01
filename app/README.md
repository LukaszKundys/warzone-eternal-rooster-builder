# Warzone Eternal — app

React + TypeScript + Vite app for the Warzone Eternal roster builder. It has the account flows from the Claude Design handoff (`Account Flows.dc.html`): Log in, Sign up, Forgot password, Set new password and My Lists. It also has the roster builder from `Catalogue.dc.html` (phone) and `Catalogue - Wide.dc.html` (desktop), which used to be a single bundled page at `../index.html`.

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

It has four sample lists, built from real game data. Silent Circuit is 5 DP over its limit on purpose.

## Connect Supabase

1. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API). Never use the `service_role` / secret key here.
2. Run the files in `supabase/migrations/` in order in the SQL Editor:
   - `0001_lists.sql` creates the `lists` table, the `updated_at` trigger, and row-level security so each player only sees their own lists.
   - `0002_game_allegiances.sql` only matters for databases created before 0001 used the game's allegiances (`agents_of_light` / `servants_of_darkness`); on a new database it changes nothing.
3. Authentication → URL Configuration:
   - Site URL: `http://localhost:5173` for now.
   - Redirect URLs: add `http://localhost:5173/**`.
   - Add the production origin once hosting is decided.
4. Later: turn on the Google provider (needs an OAuth client from Google Cloud Console), then set `GOOGLE_ENABLED` to `true` in `src/screens/GoogleButton.tsx`.
5. At release: set up custom SMTP. The built-in mailer is heavily rate-limited.

The app picks Supabase automatically when both env vars are set (`src/lib/backend/index.ts`).

## Layout

| Path | What |
| --- | --- |
| `src/lib/types.ts` | `Backend` interface, `SavedList`, auth error codes |
| `src/lib/backend/local.ts` | localStorage backend (dev/demo) |
| `src/lib/backend/supabase.ts` | Supabase backend: PKCE auth, "Keep me signed in" via session/local storage, list cache for offline reads |
| `src/lib/strings.ts` | User-facing auth error messages, keyed by code (ready for a Polish locale) |
| `src/screens/*` | Screens; `MyLists` + `ListCard` + `AccountMenu`, and `Builder` (`/lists/new` and `/lists/:id`) |
| `src/builder/data.json` | Game data extracted from the design bundle: factions, units, assets, game sizes, ally rules |
| `src/builder/rulesText.json` | Rules text for the abilities and weapon traits the bundle had (5 abilities, 3 traits so far) |
| `src/builder/rules.ts` | Typed game rules: ally eligibility, asset targets, force validation |
| `src/builder/force.ts` | The force being built (reducer), and how it's saved into a list's `roster` |
| `src/builder/*.tsx` | Builder panels: `Catalogue`, `ForcePanel`, `StatusPanel`, `UnitProfile`, unit/asset sheets |
| `src/builder/builder.css` | Builder styles, values taken from the design files |
| `src/styles.css` | Design tokens and styles, values taken from the design file |

## Not done yet

- **Builder:**
  - Below 1100px wide it uses the phone layout, with Catalogue, Force and Status tabs. At 1100px and wider it uses the three-column desktop layout.
  - Lists are saved with the Save button; there is no autosave. Leaving with unsaved changes asks first.
  - Export: TXT and JSON download. PDF is shown but disabled ("coming soon"), and there is no JSON import yet.
  - Most abilities and weapon traits have no rules text yet; the builder says so when one is opened.
  - Rules not enforced yet: the Dark Cult `singleSourceFaction` rule from the data.
  - Data problems carried over from the design bundle:
    - Dr Diana's Leader and Specialist profiles share the id `cybertronic_dr_diana_base`, so only the Leader can be added.
    - The Mirrorman Leader needs Troopers of type `mirrormen`, but the Mirrorman Trooper is type `mirrormans`, so it always shows a requirement issue.
    - Cartel is marked partial and isn't offered as a faction; its Agents still appear as Advisor allies.
- **Supabase backend:** tested by hand against a live project. Sign-up with email confirmation, log-in, loading lists, Duplicate and Delete all work. Row-level security was also checked in the database. Password reset links must be opened in the same browser that requested them; the link carries no secret of its own (Supabase PKCE), so a link opened on another device or browser shows the "invalid or expired" message. The automated tests still use the local backend.
- **Offline:** offline use is read-only. Supabase lists are cached, so My Lists and the builder open without a signal. Saving, duplicating or deleting while offline shows an error, and there is no queued sync yet.
- **Google sign-in:** the button is shown but disabled ("coming soon") until the provider is set up. See step 4 under Connect Supabase.
- **Custom email (SMTP):** to be set up at release. Until then, sign-up and reset emails use Supabase's rate-limited built-in mailer.
- **Account settings:** not designed yet. The menu item shows a toast.
- **Terms and Privacy:** the links point to `#`.
- **Hosting:** uses `BrowserRouter`, so the host must rewrite unknown paths to `index.html` (Vercel, Netlify and Cloudflare Pages all do this easily). Set `base` in `vite.config.ts` if serving from a sub-path.
- **Departures from the design:**
  - The prototype's screen-switcher bar is gone (account flows and the builder's Mobile/Desktop toggle). It was there only for the demo; the builder picks its layout from the screen width.
  - The builder has a top bar with a back link, the list name and Save. The design had no way to name or save a list.
  - Changing faction asks before clearing the force.
  - Set new password is a new screen; the design had no screen for the emailed link.
  - Below 440px the account button shows only the avatar, so the title stays on one line.
