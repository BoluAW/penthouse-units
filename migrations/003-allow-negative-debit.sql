-- ============================================================
--  003 — Allow debits even when balance is negative
--  Paste into: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Remove the balance-below-zero guard from debit validation.
-- Debits still must be positive, but they are now allowed
-- regardless of the person's current balance.

create or replace function guard_entry() returns trigger as $$
declare
  prev_reading numeric;
  next_reading numeric;
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

  -- Debit: must be positive (no balance floor enforced)
  if new.kind = 'debit' then
    if new.value <= 0 then
      raise exception 'A debit must be greater than zero'
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
