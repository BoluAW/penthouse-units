-- ============================================================
--  Units — shared prepaid meter tracker
--  Paste into: Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── people ─────────────────────────────────────────────────
-- `loaded` and `reading` are derived columns, rebuilt from the
-- entries log by trigger. Never write to them from the app.

create table people (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  pin_hash        text not null,
  is_admin        boolean not null default false,
  loaded          numeric(10,2) not null default 0,
  reading         numeric(10,2) not null default 0,
  threshold       numeric(10,2) not null default 10,
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ── entries ────────────────────────────────────────────────
-- The log is the source of truth. Rows can be edited and deleted;
-- `created_at` is what orders them, so an edit keeps its place in
-- history rather than jumping to the end.

create table entries (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references people(id) on delete cascade,
  kind       text not null check (kind in ('recharge','reading')),
  value      numeric(10,2) not null,
  note       text,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);

create index entries_person_time on entries (person_id, created_at desc);

-- ── sessions ───────────────────────────────────────────────

create table sessions (
  token      text primary key,
  person_id  uuid not null references people(id) on delete cascade,
  expires_at timestamptz not null
);

create index sessions_expiry on sessions (expires_at);

-- ── recompute ──────────────────────────────────────────────
-- One function rebuilds a person's figures from their log. Insert,
-- edit, undo and delete all end here, so the numbers can never
-- drift away from the history behind them.

create or replace function recompute_person(p_id uuid) returns void as $$
begin
  update people set
    loaded = coalesce((
      select sum(value) from entries
      where person_id = p_id and kind = 'recharge'
    ), 0),
    reading = coalesce((
      select value from entries
      where person_id = p_id and kind = 'reading'
      order by created_at desc limit 1
    ), 0)
  where id = p_id;
end $$ language plpgsql;

create or replace function sync_person() returns trigger as $$
begin
  perform recompute_person(coalesce(new.person_id, old.person_id));
  return null;
end $$ language plpgsql;

create trigger entries_sync
  after insert or update or delete on entries
  for each row execute function sync_person();

-- ── validation ─────────────────────────────────────────────
-- A sub-meter only counts up, so a reading has to sit between the
-- readings either side of it in time. On a brand new entry there's
-- nothing after it, so this reduces to the simple "not lower than
-- last" check.

create or replace function guard_entry() returns trigger as $$
declare
  prev_reading numeric;
  next_reading numeric;
begin
  if tg_op = 'UPDATE' and new.kind <> old.kind then
    raise exception 'An entry cannot change between a recharge and a reading. Delete it and add the right one.'
      using errcode = 'check_violation';
  end if;

  if new.kind = 'recharge' then
    if new.value <= 0 then
      raise exception 'A recharge must be greater than zero'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  select value into prev_reading from entries
    where person_id = new.person_id and kind = 'reading'
      and created_at < new.created_at and id <> new.id
    order by created_at desc limit 1;

  select value into next_reading from entries
    where person_id = new.person_id and kind = 'reading'
      and created_at > new.created_at and id <> new.id
    order by created_at asc limit 1;

  if prev_reading is not null and new.value < prev_reading then
    raise exception 'Reading % is below the % recorded before it. A sub-meter only counts up.',
      new.value, prev_reading using errcode = 'check_violation';
  end if;

  if next_reading is not null and new.value > next_reading then
    raise exception 'Reading % is above the % recorded after it. A sub-meter only counts up.',
      new.value, next_reading using errcode = 'check_violation';
  end if;

  return new;
end $$ language plpgsql;

create trigger entries_guard
  before insert or update on entries
  for each row execute function guard_entry();

-- The opening reading is the floor of the whole history. Losing it drops
-- the reading to zero and invents units nobody paid for, so deleting it
-- is refused the same way undoing it is.
--
-- The `exists` check exempts cascades: when a person is deleted their
-- entries go with them, and by then the people row is already gone.

create or replace function guard_entry_delete() returns trigger as $$
declare reading_count int;
begin
  if old.kind = 'reading'
     and exists (select 1 from people where id = old.person_id) then
    select count(*) into reading_count from entries
      where person_id = old.person_id and kind = 'reading';
    if reading_count = 1 then
      raise exception 'This is the opening meter reading and cannot be deleted. Edit it instead.'
        using errcode = 'check_violation';
    end if;
  end if;
  return old;
end $$ language plpgsql;

create trigger entries_guard_delete
  before delete on entries
  for each row execute function guard_entry_delete();

-- ── undo ───────────────────────────────────────────────────
-- Deletes the newest entry for a person. The sync trigger rebuilds
-- their figures afterwards, so there's no arithmetic to reverse.
-- Returns the removed row so the app can say what it just undid.

create or replace function undo_last(p_id uuid) returns entries as $$
declare
  last_entry   entries;
  reading_count int;
begin
  select * into last_entry from entries
    where person_id = p_id
    order by created_at desc limit 1;

  if last_entry is null then
    raise exception 'There is nothing to undo for this person'
      using errcode = 'no_data_found';
  end if;

  -- The opening reading is the floor of the whole history. Removing it
  -- would drop the reading to zero and invent units nobody paid for.
  if last_entry.kind = 'reading' then
    select count(*) into reading_count from entries
      where person_id = p_id and kind = 'reading';
    if reading_count = 1 then
      raise exception 'This is the opening meter reading and cannot be undone. Edit it instead.'
        using errcode = 'check_violation';
    end if;
  end if;

  delete from entries where id = last_entry.id;
  return last_entry;
end $$ language plpgsql;

-- ── removing people ────────────────────────────────────────
-- Archiving is the everyday one: someone moves out, they drop off
-- the list and out of the house total, but their history and their
-- final balance survive. Set `archived` false to bring them back.

create or replace function archive_person(p_id uuid, archived boolean default true)
returns void as $$
declare target people;
begin
  select * into target from people where id = p_id;

  if target is null then
    raise exception 'No such person' using errcode = 'no_data_found';
  end if;

  if archived and target.is_admin then
    raise exception 'An admin cannot be archived. Remove their admin access first.'
      using errcode = 'check_violation';
  end if;

  update people
    set archived_at = case when archived then now() else null end
    where id = p_id;

  -- Archiving signs them out everywhere. Their PIN stops working
  -- until they're restored.
  if archived then
    delete from sessions where person_id = p_id;
  end if;
end $$ language plpgsql;

-- Permanent. Takes every entry and session with it, so the units
-- you logged for this person are gone for good.

create or replace function remove_person(p_id uuid, actor_id uuid)
returns void as $$
declare
  target      people;
  admin_count int;
begin
  select * into target from people where id = p_id;

  if target is null then
    raise exception 'No such person' using errcode = 'no_data_found';
  end if;

  if p_id = actor_id then
    raise exception 'You cannot remove yourself. Ask another admin, or archive instead.'
      using errcode = 'check_violation';
  end if;

  if target.is_admin then
    select count(*) into admin_count from people
      where is_admin and archived_at is null;
    if admin_count <= 1 then
      raise exception 'This is the only admin. Promote someone else first.'
        using errcode = 'check_violation';
    end if;
  end if;

  delete from people where id = p_id;   -- entries and sessions cascade
end $$ language plpgsql;

-- ── lock the tables down ──────────────────────────────────────
-- RLS on with zero policies means the anon key reads nothing.
-- Every query goes through a Next.js server route using the
-- service role key, which bypasses RLS by design.

alter table people   enable row level security;
alter table entries  enable row level security;
alter table sessions enable row level security;

-- ── seed ───────────────────────────────────────────────────
-- Created by `npm run setup`, which hashes the PIN first.
-- insert into people (name, pin_hash, is_admin) values ('Bolu', '<bcrypt hash>', true);
