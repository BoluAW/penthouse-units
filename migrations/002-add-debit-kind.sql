-- ============================================================
--  002 — Add "debit" entry kind
--  Paste into: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1. Widen the kind check to include 'debit'
alter table entries drop constraint entries_kind_check;
alter table entries add constraint entries_kind_check
  check (kind in ('recharge', 'reading', 'debit'));

-- 2. Update recompute to subtract debits from loaded
create or replace function recompute_person(p_id uuid) returns void as $$
begin
  update people set
    loaded = coalesce((
      select sum(value) from entries
      where person_id = p_id and kind = 'recharge'
    ), 0)
    - coalesce((
      select sum(value) from entries
      where person_id = p_id and kind = 'debit'
    ), 0),
    reading = coalesce((
      select value from entries
      where person_id = p_id and kind = 'reading'
      order by created_at desc limit 1
    ), 0)
  where id = p_id;
end $$ language plpgsql;

-- 3. Update guard_entry to handle debit validation
create or replace function guard_entry() returns trigger as $$
declare
  prev_reading numeric;
  next_reading numeric;
  current_loaded numeric;
  current_debit_total numeric;
  current_reading numeric;
begin
  if tg_op = 'UPDATE' and new.kind <> old.kind then
    raise exception 'An entry cannot change between a recharge and a reading. Delete it and add the right one.'
      using errcode = 'check_violation';
  end if;

  -- Recharge: must be positive
  if new.kind = 'recharge' then
    if new.value <= 0 then
      raise exception 'A recharge must be greater than zero'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Debit: must be positive, and must not push balance below zero
  if new.kind = 'debit' then
    if new.value <= 0 then
      raise exception 'A debit must be greater than zero'
        using errcode = 'check_violation';
    end if;

    select coalesce(sum(value), 0) into current_loaded
      from entries
      where person_id = new.person_id and kind = 'recharge';

    select coalesce(sum(value), 0) into current_debit_total
      from entries
      where person_id = new.person_id and kind = 'debit'
        and id <> new.id;

    select coalesce((
      select value from entries
      where person_id = new.person_id and kind = 'reading'
      order by created_at desc limit 1
    ), 0) into current_reading;

    if (current_loaded - current_debit_total - new.value - current_reading) < 0 then
      raise exception 'Debit of % would push the balance below zero. Current balance is %.',
        new.value, (current_loaded - current_debit_total - current_reading)
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- Reading validation (unchanged logic)
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
