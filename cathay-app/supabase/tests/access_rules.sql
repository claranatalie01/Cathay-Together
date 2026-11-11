-- LOCAL TESTING ONLY. Checks the access rules in migrations/20261111000000_initial_schema.sql.
--
-- Run on a throwaway local Postgres, in this order:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/local_stub.sql
--   psql -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261111000000_initial_schema.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/access_rules.sql
-- It prints "ALL ACCESS TESTS PASSED" at the end, or stops at the first failed check.
--
-- The scenario
--   Group 1 "Tokyo together": Gaudi (creator) and Kabe are members.
--   Group 2 "Other trip":     Dana (creator) is the only member.
--   Clara has an account but has joined nothing.

\set gaudi '11111111-1111-1111-1111-111111111111'
\set kabe  '22222222-2222-2222-2222-222222222222'
\set clara '33333333-3333-3333-3333-333333333333'
\set dana  '44444444-4444-4444-4444-444444444444'
\set g1    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
\set g2    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

-- ---- test data, inserted as the database owner (like our server would) ----
insert into auth.users (id, email) values
  (:'gaudi', 'gaudi@example.com'), (:'kabe', 'kabe@example.com'),
  (:'clara', 'clara@example.com'), (:'dana', 'dana@example.com');

insert into public.profiles (id, display_name, home_airport) values
  (:'gaudi', 'Gaudi', 'HKG'), (:'kabe', 'Kabe', 'SIN'),
  (:'clara', 'Clara', 'SHA'), (:'dana', 'Dana', 'HKG');

insert into public.groups (id, name, start_date, end_date, creator_id, invite_code) values
  (:'g1', 'Tokyo together', '2026-11-21', '2026-11-24', :'gaudi', 'VFX37K'),
  (:'g2', 'Other trip',     '2026-11-21', '2026-11-24', :'dana',  'ZZZ999');

insert into public.group_members (group_id, user_id) values
  (:'g1', :'gaudi'), (:'g1', :'kabe'), (:'g2', :'dana');

insert into public.flight_selections
  (group_id, user_id, direction, offer_id, flight_no, cabin, fare, depart_at, arrive_at, price_minor)
values
  (:'g1', :'kabe', 'outbound', 'outbound-2026-11-21-500', 'CX500', 'economy', 'essential',
   '2026-11-21T09:55:00+08:00', '2026-11-21T16:50:00+09:00', 1012900);

insert into public.votes (group_id, user_id, place_id, choice) values (:'g1', :'kabe', 'food', 'like');

-- ---- helpers: run a statement as the current person and report what happened ----
-- "refused" means the database raised an error (permission denied, rule violated, ...).
create function public.t_refused(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return false;
exception when others then
  return true;
end $$;

-- How many rows a statement returned or changed.
create function public.t_rows(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;

-- ======================= not signed in =======================
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert public.t_refused('select * from public.airports'),          'visitor read airports';
  assert public.t_refused('select * from public.profiles'),          'visitor read profiles';
  assert public.t_refused('select * from public.groups'),            'visitor read groups';
  assert public.t_refused('select * from public.group_members'),     'visitor read members';
  assert public.t_refused('select * from public.flight_selections'), 'visitor read flight choices';
  assert public.t_refused('select * from public.votes'),             'visitor read votes';
  assert public.t_refused('select private.is_member(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'')'), 'visitor called helper';
end $$;
reset role;

-- ======================= Gaudi: member and creator of group 1 =======================
set role authenticated;
select set_config('request.jwt.claim.sub', :'gaudi', false);
do $$
declare
  me   text := '11111111-1111-1111-1111-111111111111';
  kabe text := '22222222-2222-2222-2222-222222222222';
  g1   text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  g2   text := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  sel  text := '''outbound'', ''outbound-2026-11-21-548'', ''CX548'', ''economy'', ''light'', ''2026-11-21T08:55:00+08:00'', ''2026-11-21T13:45:00+09:00'', 669100';
begin
  -- reading
  assert public.t_rows('select * from public.airports') = 4,                'member sees 4 airports';
  assert public.t_rows('select * from public.groups') = 1,                  'member sees only their own group';
  assert public.t_rows('select * from public.group_members') = 2,           'member sees both members of group 1';
  assert public.t_rows('select * from public.profiles') = 2,                'member sees self and group-mate only';
  assert public.t_rows('select * from public.flight_selections') = 1,       'member sees group-mate''s flight (the board)';
  assert public.t_rows('select * from public.votes') = 1,                   'member sees group-mate''s vote';

  -- changing their own things: allowed
  assert public.t_rows(format('insert into public.flight_selections (group_id, user_id, direction, offer_id, flight_no, cabin, fare, depart_at, arrive_at, price_minor) values (%L, %L, %s)', g1, me, sel)) = 1, 'member adds own flight';
  assert public.t_rows(format('update public.flight_selections set fare = ''flex'' where group_id = %L and user_id = %L', g1, me)) = 1, 'member changes own flight';
  assert public.t_rows(format('insert into public.votes (group_id, user_id, place_id, choice) values (%L, %L, ''food'', ''like'')', g1, me)) = 1, 'member adds own vote';
  assert public.t_rows(format('insert into public.votes (group_id, user_id, place_id, choice) values (%L, %L, ''food'', ''pass'') on conflict (group_id, user_id, place_id) do update set choice = excluded.choice', g1, me)) = 1, 'member changes own vote';
  assert public.t_rows(format('update public.profiles set display_name = ''Gaudi A'' where id = %L', me)) = 1, 'member edits own profile';

  -- changing someone else's things: refused, or silently affects nothing
  assert public.t_refused(format('insert into public.flight_selections (group_id, user_id, direction, offer_id, flight_no, cabin, fare, depart_at, arrive_at, price_minor) values (%L, %L, ''return'', ''x'', ''CX1'', ''economy'', ''light'', ''2026-11-24T10:00:00+09:00'', ''2026-11-24T14:00:00+08:00'', 1)', g1, kabe)), 'member added a flight for someone else';
  assert public.t_rows(format('update public.flight_selections set fare = ''light'' where user_id = %L', kabe)) = 0, 'member changed someone else''s flight';
  assert public.t_rows(format('delete from public.flight_selections where user_id = %L', kabe)) = 0,              'member deleted someone else''s flight';
  assert public.t_rows(format('update public.votes set choice = ''pass'' where user_id = %L', kabe)) = 0,         'member changed someone else''s vote';
  assert public.t_rows(format('update public.profiles set display_name = ''Hacked'' where id = %L', kabe)) = 0,  'member edited someone else''s profile';
  assert public.t_refused(format('update public.flight_selections set user_id = %L where user_id = %L', kabe, me)), 'member reassigned own flight to someone else';

  -- groups and memberships cannot be changed from the app at all
  assert public.t_refused(format('insert into public.groups (name, start_date, end_date, creator_id, invite_code) values (''Mine'', ''2026-11-21'', ''2026-11-24'', %L, ''ABC123'')', me)), 'member created a group directly';
  assert public.t_refused(format('update public.groups set name = ''Renamed'' where id = %L', g1)),                'member renamed a group directly';
  assert public.t_refused(format('delete from public.groups where id = %L', g1)),                                 'member deleted a group directly';
  assert public.t_refused(format('insert into public.group_members (group_id, user_id) values (%L, %L)', g2, me)), 'member added themselves to another group';
  assert public.t_refused(format('delete from public.group_members where group_id = %L and user_id = %L', g1, kabe)), 'member removed someone from the group';
  assert public.t_refused('insert into public.airports (code, city, time_zone) values (''NRT'', ''Tokyo'', ''Asia/Tokyo'')'), 'member added an airport';

  -- a group they do not belong to
  assert public.t_refused(format('insert into public.votes (group_id, user_id, place_id, choice) values (%L, %L, ''food'', ''like'')', g2, me)), 'member voted in a group they are not in';
end $$;
reset role;

-- ======================= Dana: not a member of group 1 =======================
set role authenticated;
select set_config('request.jwt.claim.sub', :'dana', false);
do $$
declare
  me text := '44444444-4444-4444-4444-444444444444';
  g1 text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  assert public.t_rows('select * from public.groups') = 1,                                                   'outsider sees only her own group';
  assert public.t_rows(format('select * from public.groups where id = %L', g1)) = 0,                         'outsider read group 1';
  assert public.t_rows(format('select * from public.group_members where group_id = %L', g1)) = 0,            'outsider read group 1 members';
  assert public.t_rows(format('select * from public.flight_selections where group_id = %L', g1)) = 0,        'outsider read group 1 flights';
  assert public.t_rows(format('select * from public.votes where group_id = %L', g1)) = 0,                    'outsider read group 1 votes';
  assert public.t_rows('select * from public.profiles') = 1,                                                 'outsider sees only her own profile';
  assert public.t_refused(format('insert into public.group_members (group_id, user_id) values (%L, %L)', g1, me)), 'outsider joined without an invitation';
  assert public.t_refused(format('insert into public.votes (group_id, user_id, place_id, choice) values (%L, %L, ''food'', ''like'')', g1, me)), 'outsider voted in group 1';
  assert public.t_refused(format('insert into public.flight_selections (group_id, user_id, direction, offer_id, flight_no, cabin, fare, depart_at, arrive_at, price_minor) values (%L, %L, ''outbound'', ''x'', ''CX1'', ''economy'', ''light'', ''2026-11-21T08:00:00+08:00'', ''2026-11-21T13:00:00+09:00'', 1)', g1, me)), 'outsider added a flight in group 1';
end $$;
reset role;

-- ======================= Clara: signed in, no groups yet =======================
set role authenticated;
select set_config('request.jwt.claim.sub', :'clara', false);
do $$ begin
  assert public.t_rows('select * from public.groups') = 0,            'new person sees no groups';
  assert public.t_rows('select * from public.group_members') = 0,     'new person sees no memberships';
  assert public.t_rows('select * from public.flight_selections') = 0, 'new person sees no flights';
  assert public.t_rows('select * from public.votes') = 0,             'new person sees no votes';
  assert public.t_rows('select * from public.profiles') = 1,          'new person sees only her own profile';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ======================= rules that apply even to our own server =======================
do $$
declare
  gaudi text := '11111111-1111-1111-1111-111111111111';
  clara text := '33333333-3333-3333-3333-333333333333';
  g1    text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  assert public.t_refused(format('insert into public.group_members (group_id, user_id) values (%L, %L)', g1, gaudi)), 'joined the same group twice';
  assert public.t_refused(format('insert into public.flight_selections (group_id, user_id, direction, offer_id, flight_no, cabin, fare, depart_at, arrive_at, price_minor) values (%L, %L, ''return'', ''x'', ''CX1'', ''economy'', ''light'', ''2026-11-24T14:00:00+09:00'', ''2026-11-24T10:00:00+09:00'', 1)', g1, gaudi)), 'saved a flight that lands before it leaves';
  assert public.t_refused(format('insert into public.flight_selections (group_id, user_id, direction, offer_id, flight_no, cabin, fare, depart_at, arrive_at, price_minor) values (%L, %L, ''outbound'', ''x'', ''CX1'', ''economy'', ''light'', ''2026-11-21T08:00:00+08:00'', ''2026-11-21T13:00:00+09:00'', 1)', g1, clara)), 'saved a flight for a non-member';
  assert public.t_refused(format('insert into public.votes (group_id, user_id, place_id, choice) values (%L, %L, ''culture'', ''maybe'')', g1, gaudi)), 'saved a vote that is neither like nor pass';
  assert public.t_refused(format('insert into public.groups (name, start_date, end_date, creator_id, invite_code) values (''Bad dates'', ''2026-11-24'', ''2026-11-21'', %L, ''DATE01'')', gaudi)), 'saved a trip that ends before it starts';
  assert public.t_refused(format('insert into public.groups (name, start_date, end_date, creator_id, invite_code) values (''Same code'', ''2026-11-21'', ''2026-11-24'', %L, ''VFX37K'')', gaudi)), 'reused an invite code';
end $$;

-- The overnight case from the technical guide: 23:55 on the 21st and 00:25 on the 22nd are 30 minutes apart.
do $$ begin
  assert extract(epoch from ('2026-11-22T00:25:00+09:00'::timestamptz - '2026-11-21T23:55:00+09:00'::timestamptz)) / 60 = 30, 'overnight gap is 30 minutes';
end $$;

select 'ALL ACCESS TESTS PASSED' as result;
