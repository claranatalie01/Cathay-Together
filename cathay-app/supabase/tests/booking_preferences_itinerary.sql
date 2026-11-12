-- LOCAL TESTING ONLY. Checks migrations/20261112000000_booking_preferences_itinerary.sql.
--
-- Run on a throwaway local Postgres, after every earlier migration and test file:
--   ... (see group_functions.sql for the earlier steps) ...
--   psql -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261111020000_more_airports.sql
--   psql -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261112000000_booking_preferences_itinerary.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/booking_preferences_itinerary.sql
-- It prints "ALL BOOKING, PREFERENCE AND ITINERARY TESTS PASSED", or stops at the first failure.
--
-- Starting point (left by the earlier test files)
--   Group 1 (aaaaaaaa-...): Gaudi (both flights chosen), Kabe (outbound only), Clara (none).
--   Group 2 (bbbbbbbb-...): Dana only.

-- ======================= not signed in =======================
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert public.t_error('select public.get_booking(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')') like 'permission denied%',  'visitor read a booking';
  assert public.t_error('select public.pay_booking(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')') like 'permission denied%',  'visitor paid';
  assert public.t_error('select * from public.bookings') like 'permission denied%',                                         'visitor read bookings';
  assert public.t_error('select * from public.itineraries') like 'permission denied%',                                      'visitor read itineraries';
end $$;
reset role;

-- ======================= Gaudi: both flights chosen =======================
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
declare
  g1 text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  me text := '11111111-1111-1111-1111-111111111111';
  b  jsonb;
  first_hold bigint;
begin
  -- the table itself is closed, even to the person the row belongs to
  assert public.t_error('select * from public.bookings') like 'permission denied%', 'member read bookings directly';
  assert public.t_error(format('insert into public.bookings (group_id, user_id, paid_at, reference, ticket_number, total_minor) values (%L, %L, now(), ''ABC123'', ''x'', 1)', g1, me)) like 'permission denied%', 'member marked themselves paid';

  b := public.get_booking(g1::uuid);
  assert b->>'holdExpiresAt' is null and b->>'paidAt' is null, 'starts with no hold and not paid';
  assert (b->>'serverNow')::bigint > 0, 'server time is returned';

  assert public.t_error(format('select public.pay_booking(%L)', g1)) = 'hold_expired', 'paid without a hold';

  b := public.start_booking(g1::uuid);
  first_hold := (b->>'holdExpiresAt')::bigint;
  assert first_hold - (b->>'serverNow')::bigint between 19 * 60000 and 20 * 60000 + 1000, 'hold lasts 20 minutes';
  assert (public.start_booking(g1::uuid)->>'holdExpiresAt')::bigint = first_hold, 'a running hold is kept, not restarted';

  b := public.release_booking(g1::uuid);
  assert b->>'holdExpiresAt' is null, 'release gives up the hold';
  assert public.t_error(format('select public.pay_booking(%L)', g1)) = 'hold_expired', 'paid after releasing';
end $$;
reset role;

-- An expired hold (set by the database owner, as if 21 minutes had passed).
insert into public.bookings (group_id, user_id, hold_expires_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', now() - interval '1 minute')
on conflict (group_id, user_id) do update set hold_expires_at = excluded.hold_expires_at;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
declare
  g1 text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  me text := '11111111-1111-1111-1111-111111111111';
  b  jsonb;
  grp jsonb;
begin
  assert public.t_error(format('select public.pay_booking(%L)', g1)) = 'hold_expired', 'paid on an expired hold';
  assert (public.get_group(g1::uuid)->'members'->0->>'status') = 'picked', 'not booked yet';

  b := public.start_booking(g1::uuid);
  assert (b->>'holdExpiresAt')::bigint > (b->>'serverNow')::bigint, 'an expired hold can be started again';

  b := public.pay_booking(g1::uuid);
  assert b->>'paidAt' is not null,                              'payment is recorded';
  assert b->>'holdExpiresAt' is null,                           'the hold is cleared by paying';
  assert b->>'reference' ~ '^[A-Z0-9]{6}$',                     'a booking reference is made';
  assert b->>'ticketNumber' ~ '^160 [0-9]{10}$',                'a ticket number is made';
  -- Gaudi's two saved flights are 6,691.00 each (access_rules.sql and group_functions.sql).
  assert (b->>'totalMinor')::int = 669100 + 669100,             'the total is added up in the database';

  grp := public.get_group(g1::uuid);
  assert grp->'members'->0->>'status' = 'booked',               'the group now shows Gaudi as booked';
  assert grp->'members'->1->>'status' = 'browsing',             'Kabe is unchanged';

  assert public.t_error(format('select public.start_booking(%L)', g1)) = 'already_booked', 'started again after paying';
  assert public.t_error(format('select public.pay_booking(%L)', g1)) = 'already_booked',   'paid twice';
  assert public.release_booking(g1::uuid)->>'paidAt' is not null,                         'release does not undo a payment';

  -- a group Gaudi is not in
  assert public.t_error('select public.get_booking(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'')') = 'group_not_found',   'read a booking in another group';
  assert public.t_error('select public.start_booking(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'')') = 'group_not_found', 'booked in another group';
end $$;
reset role;

-- ======================= Kabe: only one flight chosen =======================
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare
  g1 text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  assert public.t_error(format('select public.start_booking(%L)', g1)) = 'no_flights', 'held a fare with one flight';
  assert public.t_error(format('select public.pay_booking(%L)', g1)) = 'no_flights',   'paid with one flight';
  assert public.get_booking(g1::uuid)->>'paidAt' is null,                              'Kabe cannot see Gaudi''s payment as his own';
end $$;
reset role;

-- ======================= preferences =======================
-- Clear the votes left by earlier tests so the counts below are exact.
delete from public.votes;

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare
  g1 text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  me text := '22222222-2222-2222-2222-222222222222';
  saved boolean;
begin
  assert public.t_error(format('select public.save_preferences(%L, array[''food'',''culture''])', g1)) = 'choices_incomplete', 'saved with nothing chosen';
  insert into public.votes (group_id, user_id, place_id, choice) values (g1::uuid, me::uuid, 'food', 'like');
  assert public.t_error(format('select public.save_preferences(%L, array[''food'',''culture''])', g1)) = 'choices_incomplete', 'saved with one place missing';
  assert public.t_error(format('select public.save_preferences(%L, array[]::text[])', g1)) = 'choices_incomplete',            'saved against an empty list';
  insert into public.votes (group_id, user_id, place_id, choice) values (g1::uuid, me::uuid, 'culture', 'pass');

  perform public.save_preferences(g1::uuid, array['food', 'culture']);
  select (m->>'preferencesSaved')::boolean into saved from jsonb_array_elements(public.get_group(g1::uuid)->'members') m where m->>'userId' = me;
  assert saved, 'Kabe is ready after saving';

  -- changing a swipe un-marks it
  update public.votes set choice = 'like' where group_id = g1::uuid and user_id = me::uuid and place_id = 'culture';
  select (m->>'preferencesSaved')::boolean into saved from jsonb_array_elements(public.get_group(g1::uuid)->'members') m where m->>'userId' = me;
  assert not saved, 'changing a swipe means saving again';

  perform public.save_preferences(g1::uuid, array['food', 'culture']);
  delete from public.votes where group_id = g1::uuid and user_id = me::uuid and place_id = 'food';
  select (m->>'preferencesSaved')::boolean into saved from jsonb_array_elements(public.get_group(g1::uuid)->'members') m where m->>'userId' = me;
  assert not saved, 'removing a swipe means saving again';

  assert public.t_error('select public.save_preferences(''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', array[''food''])') = 'group_not_found', 'saved preferences in another group';
  assert public.t_error('select private.unsave_preferences()') like 'permission denied%', 'app called the trigger function';
end $$;
reset role;

-- ======================= itinerary =======================
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare
  g1 text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  g2 text := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  me text := '22222222-2222-2222-2222-222222222222';
  gaudi text := '11111111-1111-1111-1111-111111111111';
begin
  assert public.t_rows('select * from public.itineraries') = 0, 'no itinerary yet';
  assert public.t_rows(format('insert into public.itineraries (group_id, plan, updated_by) values (%L, ''{"days": []}'', %L)', g1, me)) = 1, 'member saves the itinerary';
  assert public.t_rows(format('update public.itineraries set plan = ''{"days": [1]}'', updated_by = %L where group_id = %L', me, g1)) = 1, 'member changes the itinerary';
  assert public.t_refused(format('insert into public.itineraries (group_id, plan, updated_by) values (%L, ''{}'', %L)', g2, me)), 'saved an itinerary for another group';
  assert public.t_refused(format('update public.itineraries set updated_by = %L where group_id = %L', gaudi, g1)), 'signed a change with someone else''s name';
  assert public.t_refused(format('update public.itineraries set plan = ''[]'' where group_id = %L', g1)), 'saved a plan that is not an object';
  assert public.t_refused(format('delete from public.itineraries where group_id = %L', g1)), 'member deleted the itinerary';
end $$;
reset role;

-- Dana (group 2 only) cannot see group 1's itinerary; Gaudi (group 1) can.
set role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$ begin
  assert public.t_rows('select * from public.itineraries') = 0, 'outsider read the itinerary';
  assert public.t_rows('update public.itineraries set plan = ''{"x": 1}''') = 0, 'outsider changed the itinerary';
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert public.t_rows('select * from public.itineraries') = 1, 'another member reads the same itinerary';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

select 'ALL BOOKING, PREFERENCE AND ITINERARY TESTS PASSED' as result;
