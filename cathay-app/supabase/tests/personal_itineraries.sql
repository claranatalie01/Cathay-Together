begin;

insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-000000000001', 'itin-one@example.test'),
  ('d1000000-0000-0000-0000-000000000002', 'itin-two@example.test'),
  ('d1000000-0000-0000-0000-000000000003', 'itin-outsider@example.test');
insert into public.profiles (id, display_name, home_airport)
select id, email, 'HKG' from auth.users where email like 'itin-%@example.test';
insert into public.groups (id, name, start_date, end_date, creator_id, invite_code)
values ('d2000000-0000-0000-0000-000000000001', 'Itinerary changes', '2026-11-21', '2026-11-24',
  'd1000000-0000-0000-0000-000000000001', 'ITIN01');
insert into public.group_members (group_id, user_id)
select 'd2000000-0000-0000-0000-000000000001', id from auth.users
where email in ('itin-one@example.test', 'itin-two@example.test');
insert into public.itineraries (group_id, plan, updated_by, updated_at)
values ('d2000000-0000-0000-0000-000000000001', '{"days":[]}',
  'd1000000-0000-0000-0000-000000000001', '2026-11-14 00:00:00+00');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);
do $$
declare trip constant uuid := 'd2000000-0000-0000-0000-000000000001';
begin
  perform public.save_personal_itinerary(trip, '2026-11-14 00:00:00+00', null, '{"day":{"afternoon":"museum"}}');
  assert (select plan from public.itineraries where group_id = trip) = '{"days":[]}'::jsonb, 'personal edit changed the shared plan';
  begin
    perform public.save_personal_itinerary(trip, '2026-11-14 00:00:00+00', null, '{}');
    raise exception 'stale personal save accepted';
  exception when raise_exception then
    if sqlerrm <> 'itinerary_changed' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000002', true);
do $$
declare trip constant uuid := 'd2000000-0000-0000-0000-000000000001';
begin
  assert (select count(*) from public.itinerary_personal_changes where group_id = trip) = 1, 'member cannot read timeline changes';
  assert not has_table_privilege(current_user, 'public.itinerary_personal_changes', 'update'), 'member can directly edit another traveller';
  update public.itineraries set plan = '{"days":[1]}', updated_by = auth.uid(), updated_at = '2026-11-14 00:01:00+00'
    where group_id = trip;
  assert (select changes from public.itinerary_personal_changes where group_id = trip) = '{"day":{"afternoon":"museum"}}'::jsonb,
    'group edit replaced the personal change';
  begin
    perform public.save_personal_itinerary(trip, '2026-11-14 00:00:00+00', null, '{}');
    raise exception 'stale group revision accepted';
  exception when raise_exception then
    if sqlerrm <> 'itinerary_changed' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000003', true);
do $$
declare trip constant uuid := 'd2000000-0000-0000-0000-000000000001';
begin
  assert not exists (select 1 from public.itinerary_personal_changes where group_id = trip), 'outsider could see personal changes';
  begin
    perform public.save_personal_itinerary(trip, '2026-11-14 00:01:00+00', null, '{}');
    raise exception 'outsider could edit an itinerary';
  exception when raise_exception then
    if sqlerrm <> 'group_not_found' then raise; end if;
  end;
end $$;
rollback;
