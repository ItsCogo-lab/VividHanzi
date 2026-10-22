# Accounts and sync

Accounts are optional. Signed out, everything stays in localStorage as
before. Signed in (Google or an email link, from Profile), the user's data is
kept in sync across devices.

## Where the data lives

Supabase, in the `user_data` table (`supabase/schema.sql`): one row per user
holding the same JSON the app keeps in localStorage (progress, My Studies,
custom sets and settings) plus an `updated_at`. The table policies only let
each user read and write their own row, so the project URL and publishable key
can ship to the browser (`.env.production` and `.env.development`). Without a
key there are no accounts and the Profile card is hidden. Tests never have a
project configured.

`@supabase/supabase-js` is loaded with `import()` only when a project is
configured, so it is a separate chunk that signed-out users only download if
accounts are enabled.

## How syncing works

Code: `features/account/AccountProvider.tsx` and `features/sync/`.

- The data Providers save through an observed storage (`observeStorage`).
  Every real change is marked as pending and uploaded a few seconds later,
  batched.
- On sign-in, when returning to the app and when coming back online,
  `syncUserData` runs. `planSync` compares the cloud `updated_at` with the last
  one seen on this device and decides whether to push, pull, merge or do
  nothing.
- Downloaded data is normalized (`normalizeSnapshot`) so the Providers' first
  save doesn't look like a new change (jsonb reorders keys).
- When a sync changes what is stored, the data Providers are remounted (a new
  `key`) to load it.

## Merging

`merge.ts` runs only when both sides changed, or the first time a device uses
the account:

- each character or word keeps the version reviewed most recently;
- each day keeps the record with the most answers (never added up);
- study sets and custom sets are joined; a custom set on both sides keeps the
  one edited most recently;
- settings from the current device win.

Known limitation: a set removed on one device comes back if another device
still had it and both changed before syncing.

## Signing out

Signing out uploads anything pending and leaves the data in the browser. The
next account that signs in on that browser merges its data with it.

The localStorage keys (`hanzivocab.*`, plus `hanzivocab.sync` for the sync
state) keep the app's old name on purpose, so saved progress survives.

## Private readings

Readings (Profile → Readings, `/readings`) are texts split into words with
pinyin, meanings and sentence translations, read Du Chinese style. They can
come from copyrighted textbooks, so they are never in the repository: each one
is a row of the `readings` table (`supabase/readings.sql`), whose policies only
let its owner read or change it. The section is shown only to one account
(`isReadingsOwner` in `features/readings/reading.ts`, which compares a SHA-256
of the email so the address isn't published). Readings are added from that
page with a JSON file in the format described in `parseReadings`.

## Setup (one time)

1. Run `supabase/schema.sql` and `supabase/readings.sql` in Supabase → SQL Editor.
2. Supabase → Authentication → Sign In / Providers → Google: client ID and
   secret from Google Cloud. The secret lives only in Supabase.
3. Google Cloud OAuth client: authorized JavaScript origins
   `https://itscogo-lab.github.io` and `http://localhost:5173`; redirect URI
   `https://<project>.supabase.co/auth/v1/callback`.
4. Supabase → Authentication → URL Configuration: site URL
   `https://itscogo-lab.github.io/VividHanzi/`; redirect URLs
   `https://itscogo-lab.github.io/VividHanzi/**` and `http://localhost:5173/**`.
