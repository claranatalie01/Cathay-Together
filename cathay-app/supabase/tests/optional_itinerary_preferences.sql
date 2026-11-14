-- Run after the full migration chain on a throwaway local database.
begin;

insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000001', 'picks-one@example.test'),
  ('c1000000-0000-0000-0000-000000000002', 'picks-two@example.test'),
  ('c1000000-0000-0000-0000-000000000003', 'picks-outsider@example.test');

insert into public.profiles (id, display_name, home_airport)
select id, split_part(email, '@', 1), 'HKG' from auth.users where email like 'picks-%@example.test';

insert into public.groups (id, name, start_date, end_date, creator_id, invite_code)
values ('c2000000-0000-0000-0000-000000000001', 'Optional picks', '2026-11-21', '2026-11-24',
  'c1000000-0000-0000-0000-000000000001', 'PICKS1');

insert into public.group_members (group_id, user_id)
select 'c2000000-0000-0000-0000-000000000001', id from auth.users
where email in ('picks-one@example.test', 'picks-two@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000001', true);
do $$
declare
  trip constant uuid := 'c2000000-0000-0000-0000-000000000001';
  saved_revision uuid;
begin
  perform public.finish_picking(trip);
  assert (select preferences_saved_at is not null from public.group_members where group_id = trip and user_id = auth.uid()),
    'member could not finish with no votes';
  assert not exists (select 1 from public.votes where group_id = trip), 'finishing created votes';
  select revision into saved_revision from public.trip_preference_updates where group_id = trip;
  assert saved_revision is not null, 'finishing did not notify the trip';
  perform public.finish_picking(trip);
  assert (select revision from public.trip_preference_updates where group_id = trip) = saved_revision,
    'retrying a finish created another notification';
end $$;

select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000002', true);
do $$
declare
  trip constant uuid := 'c2000000-0000-0000-0000-000000000001';
  first_revision uuid := (select revision from public.trip_preference_updates where group_id = trip);
begin
  assert first_revision is not null, 'other trip member cannot see readiness notification';
  insert into public.votes (group_id, user_id, place_id, choice) values (trip, auth.uid(), 'first', 'pass');
  assert (select preferences_saved_at is null from public.group_members where group_id = trip and user_id = auth.uid()),
    'a swipe marked the traveller ready';
  perform public.finish_picking(trip);
  assert (select count(*) from public.group_members where group_id = trip and preferences_saved_at is not null) = 2,
    'member could not finish with partial votes';
  assert (select revision from public.trip_preference_updates where group_id = trip) <> first_revision,
    'second finish did not notify the trip';
  update public.votes set choice = 'like' where group_id = trip and user_id = auth.uid() and place_id = 'first';
  assert (select preferences_saved_at is null from public.group_members where group_id = trip and user_id = auth.uid()),
    'changing a swipe did not clear readiness';
end $$;

select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-000000000003', true);
do $$
declare trip constant uuid := 'c2000000-0000-0000-0000-000000000001';
begin
  assert not exists (select 1 from public.trip_preference_updates where group_id = trip), 'outsider can read notification';
  begin
    perform public.finish_picking(trip);
    raise exception 'outsider could finish';
  exception when raise_exception then
    if sqlerrm <> 'group_not_found' then raise; end if;
  end;
end $$;
rollback;
