-- LOCAL TESTING ONLY. Checks migrations/20261111010000_group_functions.sql.
--
-- Run on a throwaway local Postgres, after access_rules.sql (it reuses that file's people,
-- groups and the t_refused helper):
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/local_stub.sql
--   psql -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261111000000_initial_schema.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/access_rules.sql
--   psql -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261111010000_group_functions.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/group_functions.sql
-- It prints "ALL GROUP FUNCTION TESTS PASSED" at the end, or stops at the first failed check.
--
-- Starting point (from access_rules.sql)
--   Group 1 "Tokyo together", code VFX37K: Gaudi (creator) and Kabe.
--   Group 2 "Other trip", code ZZZ999: Dana.   Clara has joined nothing.

-- The error message a statement fails with, or 'ok'.
create function public.t_error(q text) returns text language plpgsql as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;

-- An account that signed up but has no profile row.
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'noprofile@example.com');

-- ======================= not signed in =======================
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert public.t_error('select public.list_my_groups()') like 'permission denied%',                         'visitor listed groups';
  assert public.t_error('select public.preview_invitation(''VFX37K'')') like 'permission denied%',            'visitor previewed an invitation';
  assert public.t_error('select public.create_group(''X'', ''2026-11-21'', ''2026-11-24'')') like 'permission denied%', 'visitor created a group';
  assert public.t_error('select public.join_group(''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''VFX37K'')') like 'permission denied%', 'visitor joined';
end $$;
reset role;

-- ======================= signed in, but no profile =======================
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$ begin
  assert public.t_error('select public.list_my_groups()') = 'profile_not_found', 'account without profile listed groups';
  assert public.t_error('select public.create_group(''X'', ''2026-11-21'', ''2026-11-24'')') = 'profile_not_found', 'account without profile created a group';
end $$;
reset role;

-- ======================= Clara: creates a group =======================
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$
declare
  clara text := '33333333-3333-3333-3333-333333333333';
  g1    text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  made  jsonb;
  seen  jsonb;
begin
  assert public.list_my_groups() = '[]'::jsonb, 'new person starts with no groups';

  -- the helpers are not callable from the app
  assert public.t_error('select private.new_invite_code()') like 'permission denied%', 'app called new_invite_code';
  assert public.t_error(format('select private.group_json(%L, %L)', g1, clara)) like 'permission denied%', 'app called group_json';
  assert public.t_error('select private.caller_id()') like 'permission denied%', 'app called caller_id';

  -- bad input
  assert public.t_error('select public.create_group(''   '', ''2026-11-21'', ''2026-11-24'')') = 'validation_failed', 'empty name accepted';
  assert public.t_error('select public.create_group(repeat(''x'', 31), ''2026-11-21'', ''2026-11-24'')') = 'validation_failed', '31-character name accepted';
  assert public.t_error('select public.create_group(''Trip'', ''2026-11-24'', ''2026-11-21'')') = 'validation_failed', 'backwards dates accepted';

  -- a good group
  made := public.create_group('  Weekend in Tokyo ', '2026-11-21', '2026-11-24');
  assert made->>'name' = 'Weekend in Tokyo',                      'name is trimmed';
  assert made->>'creatorId' = clara,                              'caller is the creator';
  assert (made->>'isMember')::boolean,                            'creator is a member';
  assert made->>'code' ~ '^[A-HJ-NP-Z2-9]{6}$',                   'invite code has six unambiguous characters';
  assert jsonb_array_length(made->'members') = 1,                 'new group has one member';
  assert made->'members'->0->>'name' = 'Clara',                   'member name comes from the profile';
  assert made->'members'->0->'airport'->>'code' = 'SHA',          'member airport comes from the profile';
  assert made->'members'->0->>'status' = 'browsing',              'member with no flights is browsing';
  assert made->>'startDate' = '2026-11-21' and made->>'endDate' = '2026-11-24', 'dates are stored';
  assert not (made->>'inviteCopied')::boolean,                    'invite not copied yet';

  assert jsonb_array_length(public.list_my_groups()) = 1,         'creator now lists one group';
  seen := public.get_group((made->>'id')::uuid);
  assert seen->>'id' = made->>'id',                               'creator can open the group';
  assert (public.mark_invite_copied((made->>'id')::uuid)->>'inviteCopied')::boolean, 'creator marks the invite copied';

  -- group 1, which Clara has not joined
  assert public.t_error(format('select public.get_group(%L)', g1)) = 'group_not_found',           'outsider opened group 1';
  assert public.t_error(format('select public.mark_invite_copied(%L)', g1)) = 'group_not_found',  'outsider marked group 1 copied';
  assert public.t_error(format('select public.join_group(%L, ''WRONG1'')', g1)) = 'invalid_invite_code', 'joined with the wrong code';
  assert public.t_error(format('select public.join_group(%L, null)', g1)) = 'invalid_invite_code',       'joined with no code';
  assert public.t_error(format('select public.join_group(%L, ''ZZZ999'')', g1)) = 'invalid_invite_code', 'joined with another group''s code';
  assert public.t_error('select public.join_group(''cccccccc-cccc-cccc-cccc-cccccccccccc'', ''VFX37K'')') = 'group_not_found', 'joined a group that does not exist';
  assert public.t_error('select public.preview_invitation(''NOPE00'')') = 'invite_not_found',     'previewed an unknown code';

  -- the invitation flow
  seen := public.preview_invitation(' vfx37k ');
  assert seen->>'id' = g1,                                        'preview finds group 1, ignoring case and spaces';
  assert not (seen->>'isMember')::boolean,                        'preview says not a member yet';
  assert jsonb_array_length(seen->'members') = 2,                 'preview shows the two current members';
  assert (select count(*) from public.groups) = 1,                'previewing gives no direct access to the table';

  seen := public.join_group(g1::uuid, 'vfx37k');
  assert (seen->>'isMember')::boolean,                            'joined with the right code';
  assert jsonb_array_length(seen->'members') = 3,                 'group 1 now has three members';
  assert seen->'members'->2->>'name' = 'Clara',                   'newest member is listed last';
  assert jsonb_array_length(public.join_group(g1::uuid, 'WRONG1')->'members') = 3, 'joining again changes nothing';
  assert jsonb_array_length(public.list_my_groups()) = 2,         'Clara now lists two groups';
  assert (select count(*) from public.groups) = 2,                'the row-level rules now show her both groups';
end $$;
reset role;

-- ======================= Gaudi: sees Clara arrive =======================
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
declare
  g1   text := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  seen jsonb;
begin
  seen := public.get_group(g1::uuid);
  assert jsonb_array_length(seen->'members') = 3,       'creator sees the new member';
  assert seen->'members'->0->>'status' = 'browsing',    'Gaudi has one flight: still browsing';
  assert jsonb_array_length(public.list_my_groups()) = 1, 'Gaudi does not see Clara''s other group';

  insert into public.flight_selections (group_id, user_id, direction, offer_id, flight_no, cabin, fare, depart_at, arrive_at, price_minor)
  values (g1::uuid, '11111111-1111-1111-1111-111111111111', 'return', 'return-2026-11-24-549', 'CX549', 'economy', 'light',
          '2026-11-24T15:00:00+09:00', '2026-11-24T19:00:00+08:00', 669100);
  seen := public.get_group(g1::uuid);
  assert seen->'members'->0->>'status' = 'picked',      'Gaudi has both flights: picked';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

select 'ALL GROUP FUNCTION TESTS PASSED' as result;
