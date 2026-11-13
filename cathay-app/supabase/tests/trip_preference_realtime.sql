-- Run after the full migration chain on a throwaway local database.
begin;

insert into auth.users (id, email) values
  ('b1000000-0000-0000-0000-000000000001', 'realtime-one@example.test'),
  ('b1000000-0000-0000-0000-000000000002', 'realtime-two@example.test'),
  ('b1000000-0000-0000-0000-000000000003', 'realtime-outsider@example.test');
insert into public.profiles (id, display_name, home_airport)
select id, split_part(email, '@', 1), 'HKG' from auth.users where email like 'realtime-%@example.test';
insert into public.groups (id, name, start_date, end_date, creator_id, invite_code)
values ('b2000000-0000-0000-0000-000000000001', 'Realtime test', '2026-11-21', '2026-11-24',
  'b1000000-0000-0000-0000-000000000001', 'REALT1');
insert into public.group_members (group_id, user_id)
select 'b2000000-0000-0000-0000-000000000001', id from auth.users
where id in ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');
insert into public.group_place_decks (group_id, places)
values ('b2000000-0000-0000-0000-000000000001', '[{"id":"test-venue"}]');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000001', true);
do $$
declare trip constant uuid := 'b2000000-0000-0000-0000-000000000001';
begin
  begin
    perform public.save_preferences(trip, array['test-venue']);
    raise exception 'incomplete choices were accepted';
  exception when raise_exception then
    if sqlerrm <> 'choices_incomplete' then raise; end if;
  end;
  insert into public.votes (group_id, user_id, place_id, choice)
    values (trip, auth.uid(), 'test-venue', 'like');
  assert not exists (select 1 from public.trip_preference_updates), 'failed save or individual swipe published an update';
  perform public.save_preferences(trip, array['test-venue']);
  assert (select count(*) from public.trip_preference_updates) = 1, 'successful save did not publish an update';
  assert not has_table_privilege(current_user, 'public.trip_preference_updates', 'insert'), 'client can forge an update';
  assert not has_table_privilege(current_user, 'public.trip_preference_updates', 'update'), 'client can change an update';
end $$;

select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', true);
do $$
declare
  trip constant uuid := 'b2000000-0000-0000-0000-000000000001';
  first_revision uuid := (select revision from public.trip_preference_updates);
begin
  assert first_revision is not null, 'second member cannot see the update';
  insert into public.votes (group_id, user_id, place_id, choice)
    values (trip, auth.uid(), 'test-venue', 'pass');
  assert (select revision from public.trip_preference_updates) = first_revision, 'a swipe changed the revision';
  perform public.save_preferences(trip, array['test-venue']);
  assert (select revision from public.trip_preference_updates) <> first_revision, 'second save did not advance the revision';
end $$;

select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000003', true);
do $$ begin
  assert not exists (select 1 from public.trip_preference_updates), 'outsider can read the notification row';
end $$;

reset role;
do $$ begin
  assert exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_preference_updates'),
    'table is missing from the Realtime publication';
end $$;
rollback;
