-- Run once in: Supabase → SQL Editor → New query → Run
--
-- undo_last already refuses to remove a person's only meter reading, but a
-- direct delete (the Delete button in the log) had no such guard. Deleting
-- it dropped their reading to zero and inflated the balance by the whole
-- consumption figure. This closes that door.
--
-- Already folded into schema.sql, so a fresh install picks it up too.

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

drop trigger if exists entries_guard_delete on entries;

create trigger entries_guard_delete
  before delete on entries
  for each row execute function guard_entry_delete();
