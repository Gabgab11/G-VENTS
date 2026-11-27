-- Registration links, ergonomics (Change 6, follow-up to 20261114002200/002300). ticket_tiers and
-- event_questions now require a registration_link_id (NOT NULL). The application always sets it
-- (DrizzleEventRepository / DrizzleQuestionSetRepository), but a direct INSERT — a test fixture, a
-- data-fix script, an admin query — would otherwise hit the NOT NULL. A BEFORE INSERT trigger fills a
-- NULL registration_link_id with the event's default link, mirroring events_create_default_link. In
-- production the column is never null on insert, so the trigger is a safety net, not a behaviour change.

create or replace function public.set_default_registration_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.registration_link_id is null then
    select l.id into new.registration_link_id
      from public.registration_links l
     where l.event_id = new.event_id and l.is_default
     limit 1;
  end if;
  return new;
end;
$$;

revoke execute on function public.set_default_registration_link() from public, anon, authenticated;

-- Runs before ticket_tiers_single_tier_guard (name order: set_… < single_…), though the guard only
-- checks non-default links, so a default fill passes it regardless.
drop trigger if exists ticket_tiers_set_default_link on public.ticket_tiers;
create trigger ticket_tiers_set_default_link
  before insert on public.ticket_tiers
  for each row execute function public.set_default_registration_link();

drop trigger if exists event_questions_set_default_link on public.event_questions;
create trigger event_questions_set_default_link
  before insert on public.event_questions
  for each row execute function public.set_default_registration_link();
