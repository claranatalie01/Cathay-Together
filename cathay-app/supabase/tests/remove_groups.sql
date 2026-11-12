-- LOCAL TESTING ONLY. Run after the earlier SQL suites and the remove_groups migration.
begin;

-- Kabe already has a selection and votes in Tokyo together. Give both users dependent rows.
insert into public.bookings (group_id, user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222');
insert into public.votes (group_id, user_id, place_id, choice) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'food', 'like');

set role anon;
do $$ begin
  assert public.t_error('select public.delete_group(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')') like 'permission denied%', 'visitor deleted a group';
  assert public.t_error('select public.leave_group(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')') like 'permission denied%', 'visitor left a group';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
do $$ begin
  assert public.t_error('select public.delete_group(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')') = 'group_not_found', 'non-member deleted a group';
  assert public.t_error('select public.leave_group(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')') = 'group_not_found', 'non-member left a group';
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$
declare
  trip constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  assert public.t_error(format('select public.delete_group(%L)', trip)) = 'creator_required', 'member deleted someone else''s group';
  perform public.leave_group(trip);
  assert public.t_error(format('select public.get_group(%L)', trip)) = 'group_not_found', 'former member can still open the group';
  assert public.t_error(format('select public.leave_group(%L)', trip)) = 'group_not_found', 'repeat leave reports no membership';
  assert not (public.preview_invitation('VFX37K')->>'isMember')::boolean, 'invite does not reflect leaving';
end $$;
reset role;

do $$
declare
  trip constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  former_member constant uuid := '22222222-2222-2222-2222-222222222222';
begin
  assert not exists (select 1 from public.flight_selections where group_id = trip and user_id = former_member), 'former member''s picks remain';
  assert not exists (select 1 from public.votes where group_id = trip and user_id = former_member), 'former member''s votes remain';
  assert not exists (select 1 from public.bookings where group_id = trip and user_id = former_member), 'former member''s booking remains';
  assert exists (select 1 from public.itineraries where group_id = trip), 'leaving removed the shared plan';
  assert exists (select 1 from public.bookings where group_id = trip and paid_at is not null), 'leaving removed the creator''s booking';
  assert exists (select 1 from public.votes where group_id = trip and place_id = 'food'), 'leaving removed the creator''s vote';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
do $$
declare
  trip constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  assert public.t_error(format('select public.leave_group(%L)', trip)) = 'creator_cannot_leave', 'creator left without deleting the group';
  perform public.delete_group(trip);
  assert public.t_error('select public.preview_invitation(''VFX37K'')') = 'invite_not_found', 'deleted group still has a valid invitation';
  assert public.t_error(format('select public.delete_group(%L)', trip)) = 'group_not_found', 'repeat delete reports the missing group';
end $$;
reset role;

do $$
declare
  trip constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  assert not exists (select 1 from public.groups where id = trip), 'deleted group remains';
  assert not exists (select 1 from public.group_members where group_id = trip), 'deleted group memberships remain';
  assert not exists (select 1 from public.flight_selections where group_id = trip), 'deleted group picks remain';
  assert not exists (select 1 from public.votes where group_id = trip), 'deleted group votes remain';
  assert not exists (select 1 from public.bookings where group_id = trip), 'deleted group bookings remain';
  assert not exists (select 1 from public.itineraries where group_id = trip), 'deleted group itinerary remains';
  assert exists (select 1 from public.groups where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 'another group was removed';
end $$;

rollback;
select 'ALL GROUP REMOVAL TESTS PASSED' as result;
