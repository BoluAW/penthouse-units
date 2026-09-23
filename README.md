# Units

Shared prepaid electricity meter tracker. See [BRIEF.md](./BRIEF.md) for the
full spec and [schema.sql](./schema.sql) for the database.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (GitHub login is
   fine).
2. **New project** → pick an org, name it (e.g. `units`), set a database
   password (save it somewhere — you won't need it for this app, but Supabase
   asks), pick a region close to you, create.
3. Wait ~2 minutes for it to provision.

## 2. Run the schema

1. In the project, open **SQL Editor** in the left sidebar → **New query**.
2. Paste in the entire contents of [schema.sql](./schema.sql) from this repo.
3. Click **Run**. You should see "Success. No rows returned."
4. Check **Table Editor** — you should see `people`, `entries`, and
   `sessions` tables.

## 3. Get your keys

1. Go to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** — that's `SUPABASE_URL`.
3. Under **Project API keys**, copy the **`service_role`** key (not
   `anon`/`public`) — that's `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses
   Row Level Security, so treat it like a password: never commit it, never
   put it in a `NEXT_PUBLIC_` variable.

## 4. Configure the app

```bash
cp .env.local.example .env.local
```

Paste the two values in:

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 5. Install and create the admin

```bash
npm install
npm run setup
```

This prompts for the admin's name and a 6-digit PIN, hashes it, and inserts
the row directly into `people` with `is_admin = true`. There's no sign-up
flow — this is the only way an admin gets created.

## 6. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), pick the admin's name,
enter the PIN. From `/admin` you can add the rest of the household — each
new person needs their starting **total loaded** and **current sub-meter
reading**, which get written as the first two entries in their log.

## Deploying

Push to a GitHub repo and import it on [Vercel](https://vercel.com/new). Add
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables in
the Vercel project settings (Production + Preview) — do not prefix them with
`NEXT_PUBLIC_`.

## Notes

- The entries log is the source of truth. `people.loaded` and
  `people.reading` are derived columns, rebuilt by a database trigger every
  time the log changes — nothing in the app writes to them directly. That's
  what makes correcting an old entry safe.
- Corrections happen in a person's **Log**: tap any row to edit its value or
  delete it. A reading has to sit between the readings either side of it in
  time, so a bad correction is rejected with a message naming the entry it
  clashed with. Edited rows are marked `edited`.
- **Edit** on a person's card covers renaming, setting a new PIN, and the
  low-units threshold, plus **Archive** and permanent deletion.
- Archiving takes someone off the admin list, out of the house total, and off
  the login screen, and stops their PIN working immediately — but keeps their
  history. Restore them from the archived count at the bottom of `/admin`.
  Permanent deletion takes the entry history with it.
- **Share balances** on `/admin` renders the whole house as a dated PNG and
  hands it to your phone's share sheet (or downloads it on desktop). It's a
  snapshot, not a link — nothing stays live after you send it, and members
  still can't see each other's figures in the app itself. Archived people,
  accounts with no entries, and admins are left off the image — the admin
  here is a utility login rather than a room. If an admin ever has their own
  sub-meter, drop the `is_admin` filter in `lib/board.ts` or they'll go
  missing from it.
- `units.html` in this repo is the original single-file design reference the
  UI was ported from. Fonts in `assets/` are used to render that PNG
  server-side.
