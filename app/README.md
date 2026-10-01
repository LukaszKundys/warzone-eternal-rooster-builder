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
   - `0003_delete_account.sql` adds `delete_my_account()`, which lets a signed-in player delete their own account (their lists go with it). Account settings needs it.
   - `0004_list_sharing.sql` adds `lists.share_id` and `get_shared_list()`, which lets anyone with a share link read that one list (signed out too).
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
| `src/screens/*` | Screens; `MyLists` + `ListCard` + `AccountMenu`, `Account` (`/account`), `SharedList` (`/shared/:shareId`), and `Builder` (`/lists/new` and `/lists/:id`) |
| `src/builder/data.json` | Game data extracted from the design bundle: factions, units, assets, game sizes, ally rules |
| `src/builder/rulesText.json` | Rules text for the abilities and weapon traits the bundle had (5 abilities, 3 traits so far) |
| `src/builder/rules.ts` | Typed game rules: ally eligibility, asset targets, force validation |
| `src/builder/force.ts` | The force being built (reducer), and how it's saved into a list's `roster` |
| `src/builder/*.tsx` | Builder panels: `Catalogue`, `ForcePanel`, `StatusPanel`, `UnitProfile`, unit/asset sheets, `ShareDialog`, `PrintSheet` |
| `src/builder/builder.css` | Builder styles, values taken from the design files |
| `src/styles.css` | Design tokens and styles, values taken from the design file |

## Not done yet

- **Builder:**
  - Below 1100px wide it uses the phone layout, with Catalogue, Force and Status tabs. At 1100px and wider it uses the three-column desktop layout.
  - Lists are saved with the Save button; there is no autosave. Leaving with unsaved changes asks first.
  - Export: TXT and JSON download, and PDF via a printable force sheet (`src/builder/PrintSheet.tsx`, `print.css`): the browser's print dialog opens, where "Save as PDF" makes the file. Identical units are grouped; abilities and traits with rules text are printed in full.
  - Import: "Import list" on My Lists reads a JSON export and saves it as a new list. The force is rebuilt through the builder's rules, so units or assets this version doesn't know, or that break the rules (a second Unique, an asset on a unit that can't carry it), are left out and counted.
  - Most abilities and weapon traits have no rules text yet; the builder says so when one is opened.
  - Rules not enforced yet: the Dark Cult `singleSourceFaction` rule from the data.
  - Game data notes:
    - Ally designations (Dark Cult, Seconding, Advisor) only apply when a unit joins another faction's force. In its own faction it's an ordinary unit and doesn't count toward the ally cap.
    - A requirement of `any_<group>` (Fury Elite Guard Leader: `any_brotherhood`) means a Trooper of any type from that faction group.
    - Fixed from the design bundle: Dr. Diana's Specialist has its own id (`cybertronic_dr_diana_specialist`; the Leader keeps `cybertronic_dr_diana_base`), and the Mirrorman Leader's requirement typo (`mirrormen`) is now `mirrormans`.
    - Cartel is marked partial and isn't offered as a faction; its Agents still appear as Advisor allies.
- **Supabase backend:** tested by hand against a live project. Sign-up with email confirmation, log-in, loading lists, Duplicate and Delete all work. Row-level security was also checked in the database. Password reset links must be opened in the same browser that requested them; Supabase's PKCE flow completes the link with a value stored in that browser when the reset was requested, so a link opened on another device or browser shows the "invalid or expired" message. The automated tests still use the local backend.
- **Offline:** offline use is read-only. Supabase lists are cached, so My Lists and the builder open without a signal. Saving, duplicating or deleting while offline shows an error, and there is no queued sync yet.
- **Google sign-in:** the button is shown but disabled ("coming soon") until the provider is set up. See step 4 under Connect Supabase.
- **Custom email (SMTP):** to be set up at release. Until then, sign-up and reset emails use Supabase's rate-limited built-in mailer.
- **Sharing:** Share in the builder's top bar (saved lists only) creates a link anyone can open read-only, without an account. Signed-in viewers can copy it to their own lists; signed-out viewers are sent to log in and brought back. Stop sharing breaks the link; sharing again makes a new one. The link shows the last saved version. In local mode, links only open in the same browser.
- **Account settings** (`/account`, from the account menu): display name, email, password and delete account. Not in the design; built from the auth screens' styles.
  - Changing email sends a confirmation link to the new address (with Supabase's "Secure email change" on, to the old one too). Like reset links, it must be opened in the same browser.
  - Changing the password or deleting the account asks for the current password first.
- **Terms and Privacy:** the links point to `#`.
- **Hosting:** uses `BrowserRouter`, so the host must rewrite unknown paths to `index.html` (Vercel, Netlify and Cloudflare Pages all do this easily). Set `base` in `vite.config.ts` if serving from a sub-path.
- **Departures from the design:**
  - The prototype's screen-switcher bar is gone (account flows and the builder's Mobile/Desktop toggle). It was there only for the demo; the builder picks its layout from the screen width.
  - The builder has a top bar with a back link, the list name and Save. The design had no way to name or save a list.
  - Changing faction asks before clearing the force.
  - Set new password is a new screen; the design had no screen for the emailed link.
  - Below 440px the account button shows only the avatar, so the title stays on one line.
