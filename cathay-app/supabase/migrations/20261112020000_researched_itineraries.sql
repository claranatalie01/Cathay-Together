-- A trip gets one stable swipe deck. Existing votes and plans keep their original deck.
create table public.group_place_decks (
  group_id uuid primary key references public.groups (id) on delete cascade,
  legacy boolean not null default false,
  places jsonb check (jsonb_typeof(places) = 'array' and jsonb_array_length(places) > 0),
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  job_token uuid,
  job_until timestamptz
);

alter table public.group_place_decks enable row level security;
revoke all on public.group_place_decks from public, anon, authenticated;
grant select (group_id, legacy, places) on public.group_place_decks to authenticated;
grant all on public.group_place_decks to service_role;
create policy "Members can read their trip's deck" on public.group_place_decks
  for select to authenticated using (private.is_member(group_id));

insert into public.group_place_decks (group_id, legacy)
select id, true from public.groups g
where exists (select 1 from public.votes where group_id = g.id)
   or exists (select 1 from public.group_members where group_id = g.id and preferences_saved_at is not null)
   or exists (select 1 from public.itineraries where group_id = g.id);

-- New plans come from the verified planner. The app can still edit saved plans.
revoke insert on public.itineraries from authenticated;
drop policy "Members can save their group's itinerary" on public.itineraries;

-- Resolve the expected IDs from the stored deck on the server. Legacy clients
-- can still save their existing decks during rollout.
create or replace function public.save_preferences(target_group uuid, place_ids text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := private.member_id(target_group);
  researched jsonb;
  wanted_ids text[] := place_ids;
begin
  select places into researched from public.group_place_decks where group_id = target_group;
  if researched is not null then
    wanted_ids := array(select place->>'id' from jsonb_array_elements(researched) place);
  end if;
  if coalesce(cardinality(wanted_ids), 0) = 0 or exists (
    select 1 from unnest(wanted_ids) wanted(place_id)
    where not exists (select 1 from public.votes v where v.group_id = target_group
      and v.user_id = caller and v.place_id = wanted.place_id)
  ) then
    raise exception 'choices_incomplete';
  end if;
  update public.group_members set preferences_saved_at = now()
  where group_id = target_group and user_id = caller;
end;
$$;

-- These RPCs are for the authenticated Python service after it verifies membership.
-- Stable ordering makes the snapshot comparable after a long model call.
create function public.trip_planner_inputs(target_group uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'destination', a.city, 'time_zone', a.time_zone, 'start', g.start_date, 'end', g.end_date,
    'budget', g.budget_per_person_jpy,
    'members', coalesce((select jsonb_agg(to_jsonb(m) order by m.user_id) from public.group_members m where m.group_id = g.id), '[]'::jsonb),
    'votes', coalesce((select jsonb_agg(to_jsonb(v) order by v.user_id, v.place_id) from public.votes v where v.group_id = g.id), '[]'::jsonb),
    'flights', coalesce((select jsonb_agg(to_jsonb(f) order by f.user_id, f.direction) from public.flight_selections f where f.group_id = g.id), '[]'::jsonb)
  ) from public.groups g join public.airports a on a.code = g.destination_airport where g.id = target_group;
$$;

create function public.claim_trip_planner_job(target_group uuid, viewer uuid, token uuid)
returns boolean language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.group_members where group_id = target_group and user_id = viewer) then
    return false;
  end if;
  insert into public.group_place_decks (group_id) values (target_group) on conflict do nothing;
  update public.group_place_decks set job_token = token, job_until = clock_timestamp() + interval '310 seconds'
    where group_id = target_group and (job_token is null or job_until <= clock_timestamp());
  return found;
end;
$$;

create function public.finish_trip_planner_job(target_group uuid, viewer uuid, token uuid, operation text, result jsonb, expected_inputs jsonb default null)
returns boolean language plpgsql set search_path = '' as $$
begin
  perform 1 from public.group_place_decks where group_id = target_group and job_token = token
    and job_until > clock_timestamp() for update;
  if not found or not exists (select 1 from public.group_members where group_id = target_group and user_id = viewer) then
    return false;
  end if;

  if operation = 'discover' then
    update public.group_place_decks set places = result->'places', sources = result->'sources'
      where group_id = target_group and places is null and not legacy;
  elsif operation = 'plan' then
    if public.trip_planner_inputs(target_group) is distinct from expected_inputs then
      return false;
    end if;
    insert into public.itineraries (group_id, plan, updated_by) values (target_group, result, viewer)
      on conflict (group_id) do nothing;
  else
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.trip_planner_inputs(uuid) from public, anon, authenticated;
revoke all on function public.claim_trip_planner_job(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_trip_planner_job(uuid, uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.trip_planner_inputs(uuid) to service_role;
grant execute on function public.claim_trip_planner_job(uuid, uuid, uuid) to service_role;
grant execute on function public.finish_trip_planner_job(uuid, uuid, uuid, text, jsonb, jsonb) to service_role;
