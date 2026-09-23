# Units — build brief

A web app for tracking prepaid electricity units in a shared house. One
physical meter, several housemates, each with their own sub-meter. Everyone
recharges at different times, so each person's balance is:

    units left = total loaded − current sub-meter reading

The sub-meter reading only ever counts up. A recharge adds to the loaded side.

## Who does what

**Admin (one person).** Adds people, logs recharges, updates meter readings,
and fixes anything already recorded — rename a person, correct a number typed
wrong three entries ago, delete an entry that shouldn't be there, or undo the
last thing done.

**Members (everyone else).** Log in with a PIN and see their own units. Nothing
else — no other person's figures, no write access anywhere.

## Stack

- Next.js (App Router) + TypeScript
- Supabase Postgres — database only, not Supabase Auth
- Tailwind
- Deploy to Vercel

`schema.sql` in this repo is the full database. Run it in the Supabase SQL
editor before starting. Do not add ORM migrations on top of it.

## Auth

PIN-based, rolled by hand. Members are not database users.

- PINs are 6 digits, hashed with bcrypt (cost 10), stored in `people.pin_hash`.
- Login: pick a name from a list, type the PIN. On success, generate a
  256-bit random token, store it in `sessions` with a 30-day expiry, and set it
  as an httpOnly + secure + sameSite=lax cookie.
- Five wrong attempts sets `locked_until` to 15 minutes out. The login route
  checks it and refuses early. Reset `failed_attempts` to 0 on success.
- Every server route resolves the cookie to a session, then to a person. No
  session, no data.
- Admin routes additionally check `is_admin`. Check it server-side on every
  request — hiding the UI is not access control.

A 6-digit PIN is fine for house electricity among people who already live
together. It is not fine for anything with money in it. Don't reuse this
pattern for that.

## Data access

The Supabase service role key is server-only. It must never appear in a client
component, a `NEXT_PUBLIC_` variable, or a response body. All queries live in
Next.js route handlers or server actions.

RLS is enabled with no policies, so a leaked anon key reads nothing.

## Routes

| Path | Who | Does |
|---|---|---|
| `/` | anyone | Name list + PIN entry. Redirects if already signed in. |
| `/me` | member | Their own card, read-only. |
| `/admin` | admin | Every person, with the two action buttons. |

### API

| Route | Method | Notes |
|---|---|---|
| `/api/login` | POST | `{ personId, pin }`. Rate limit per person. |
| `/api/logout` | POST | Deletes the session row, clears the cookie. |
| `/api/me` | GET | Balance, rate, and the last 8 entries for the caller. |
| `/api/admin/entry` | POST | `{ personId, kind, value }` — insert into `entries`. |
| `/api/admin/entry` | PATCH | `{ entryId, value }` — corrects a past entry in place. Sets `edited_at`. `kind` is not editable. |
| `/api/admin/entry` | DELETE | `{ entryId }`. |
| `/api/admin/undo` | POST | `{ personId }` — calls `undo_last(p_id)`. Returns the removed entry; use it for the confirmation ("Removed recharge of 50"). |
| `/api/admin/person` | POST | `{ name, pin, loaded, reading }`. Creates the person, then writes the opening figures as two entries. |
| `/api/admin/person` | PATCH | `{ personId, name?, pin?, threshold? }`. Any subset. |
| `/api/admin/person` | DELETE | `{ personId, permanent? }`. Defaults to `archive_person(p_id)`. With `permanent: true`, calls `remove_person(p_id, actorId)` — pass the signed-in admin's id so the "can't remove yourself" guard works. |
| `/api/admin/person` | PUT | `{ personId, archived: false }` — `archive_person(p_id, false)`, brings someone back. |

None of these touch `people.loaded` or `people.reading`. Those columns are
rebuilt by a database trigger from the entries log every time the log changes,
which is what makes editing history safe. Writing to them directly puts the
figures out of step with the log behind them.

Surface the database's own error messages. A reading has to sit between the
readings either side of it in time, so correcting an old one can fail on the
entry *after* it as well as the one before — the message says which. All of
these are written for a human to read; show them as-is next to the input.

## Burn rate

From the last two `reading` entries: `(v2 − v1) / days between`. Show nothing
until there are two readings more than 6 hours apart, or if usage came out at
zero or negative. Days left is `floor(balance / rate)`.

## Interface

`units.html` in this repo is the finished design — a working single-file
version of the whole thing. Port it rather than redesigning:

- Warm dark casing, amber LCD panel, ghost `8`s behind the digits at 7%
  opacity, scanline overlay.
- Archivo for text, JetBrains Mono for every number, tabular figures.
- The balance is the largest thing on the card. Everything else is quiet.
- Below `threshold`, the digits and the Low tag turn to the warning red.

Member view is the same card with the buttons and the log removed.

### Editing

The log is where corrections happen, so it needs to be more than a list.
Each row gets an inline edit: tap it, the value becomes an input, save or
delete. Show the recomputed balance immediately after — the whole point is
seeing what the fix did. Mark edited rows quietly, a small `edited` label off
the timestamp, so it's clear the log has been touched.

Renaming and changing someone's PIN or low-units threshold happen in the same
place, from a small edit control on the person's card. So does removing them —
`Archive` sits in that control; permanent deletion is behind a confirm that
says plainly that the entry history goes with it.

Archived people are excluded from the admin list, the house total and the
login name list by default. Give the admin list a way to show them — a count
in the footer that expands, not a separate page — so someone can be restored
without going near the database. An archived person's PIN stops working the
moment they're archived.

`Undo` stays as a single tap for the common case of getting the last number
wrong, and is just a delete of the newest entry.

Mobile first — the admin will be standing at the meter with a phone. Number
inputs use `inputmode="decimal"`. Visible keyboard focus. Respect
`prefers-reduced-motion`.

## Setup script

`npm run setup` — prompts for the admin's name and PIN, hashes it, inserts the
row with `is_admin = true`, prints confirmation. Needed because there's no
sign-up flow anywhere in the app.

## Environment

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Both server-only. Neither gets the `NEXT_PUBLIC_` prefix.

## Out of scope

No email, no password reset, no notifications, no payments, no multi-household
support. PIN resets happen by the admin setting a new one.
