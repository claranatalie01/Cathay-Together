-- Run after the earlier SQL suites and the researched_itineraries migration.
begin;

do $$ begin
  assert exists (select 1 from public.group_place_decks
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and legacy), 'existing trip was not marked legacy';
  assert exists (select 1 from public.itineraries
    where group_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'migration removed the existing itinerary';
end $$;

insert into public.groups (id, name, start_date, end_date, creator_id, invite_code)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Researched trip', '2026-11-21', '2026-11-24',
  '11111111-1111-1111-1111-111111111111', 'RES123');
insert into public.group_members (group_id, user_id)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');

set role service_role;
do $$
declare
  trip constant uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  traveller constant uuid := '11111111-1111-1111-1111-111111111111';
  token constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  assert not public.claim_trip_planner_job(trip, '44444444-4444-4444-4444-444444444444', token), 'outsider claimed a job';
  assert public.claim_trip_planner_job(trip, traveller, token), 'could not claim research';
  assert not public.claim_trip_planner_job(trip, traveller, gen_random_uuid()), 'second job claimed the same lease';
  assert public.finish_trip_planner_job(trip, traveller, token, 'discover',
    '{"places":[{"id":"card_a"},{"id":"card_b"}],"sources":[]}'), 'could not save a deck';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
do $$ begin
  assert not exists (select group_id from public.group_place_decks where group_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 'outsider read a deck';
  assert not has_function_privilege(current_user, 'public.trip_planner_inputs(uuid)', 'execute'), 'browser can read service inputs';
  assert not has_table_privilege(current_user, 'public.itineraries', 'insert'), 'browser can create an unreviewed plan';
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
do $$
declare
  trip constant uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  traveller constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  assert exists (select places from public.group_place_decks where group_id = trip), 'member could not read the deck';
  insert into public.votes (group_id, user_id, place_id, choice) values (trip, traveller, 'card_a', 'like');
  assert public.t_error(format('select public.save_preferences(%L, array[''card_a''])', trip)) = 'choices_incomplete', 'client bypassed the full deck';
  insert into public.votes (group_id, user_id, place_id, choice) values (trip, traveller, 'card_b', 'pass');
  perform public.save_preferences(trip, array['card_a','card_b']);
end $$;
reset role;

set role service_role;
do $$
declare
  trip constant uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  traveller constant uuid := '11111111-1111-1111-1111-111111111111';
  token constant uuid := '00000000-0000-0000-0000-000000000001';
  before jsonb := public.trip_planner_inputs(trip);
begin
  assert before->'members'->0->>'preferences_saved_at' is not null, 'complete preferences did not save';
  update public.votes set choice = 'pass' where group_id = trip and place_id = 'card_a';
  assert not public.finish_trip_planner_job(trip, traveller, token, 'plan', '{"days":[]}', before), 'stale inputs were accepted';
  before := public.trip_planner_inputs(trip);
  assert before->'members'->0->>'preferences_saved_at' is null, 'changing a vote did not clear readiness';
  update public.group_members set preferences_saved_at = now() where group_id = trip;
  before := public.trip_planner_inputs(trip);
  assert public.finish_trip_planner_job(trip, traveller, token, 'plan', '{"days":[]}', before), 'could not save the plan';
  perform public.finish_trip_planner_job(trip, traveller, token, 'plan', '{"days":[1]}', before);
  assert (select plan from public.itineraries where group_id = trip) = '{"days":[]}'::jsonb, 'existing plan was overwritten';
end $$;
reset role;

rollback;
select 'ALL RESEARCHED ITINERARY TESTS PASSED' as result;
