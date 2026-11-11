-- Cathay Together: creating, joining and reading groups.
--
-- Why this file exists
--   The first migration lets a signed-in person READ the groups they belong to, and nothing
--   else. Nobody can insert a row into `groups` or `group_members` from the app. That is on
--   purpose: if the app could insert a membership row directly, anyone could add themselves
--   to any group without knowing its invite code.
--
--   So creating and joining go through the six database functions below. A function is a
--   small program stored in the database. The app calls it by name; the function checks
--   who is calling and whether they are allowed, and only then changes the tables.
--
-- "security definer" means the function runs with the rights of its owner (the database
-- owner) and so skips the row-level rules. That is why EVERY function here starts by working
-- out who is calling (private.caller_id) and checks permission itself.
--
-- How to run it
--   SQL Editor > New query > paste this whole file > Run. Expect "Success. No rows returned".
--   Run it once. A second run stops at "function ... already exists" and changes nothing.
--
-- Errors
--   A function refuses by raising an exception whose message is one of the codes in
--   docs/api-contract.md: unauthenticated, profile_not_found, group_not_found,
--   invite_not_found, invalid_invite_code, validation_failed.

-- ---------------------------------------------------------------------------
-- Helpers (schema `private`: the app cannot call these directly)
-- ---------------------------------------------------------------------------

-- The signed-in caller's id. Refuses visitors and accounts without a profile.
create function private.caller_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'unauthenticated';
  end if;
  if not exists (select 1 from public.profiles p where p.id = caller) then
    raise exception 'profile_not_found';
  end if;
  return caller;
end;
$$;

-- One group as JSON, including its member list. It does NOT check permission:
-- only the functions below call it, after they have checked.
-- A member's status is 'picked' once they have chosen both flights, otherwise 'browsing'.
create function private.group_json(target_group uuid, viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',                 g.id,
    'name',               g.name,
    'destinationAirport', g.destination_airport,
    'startDate',          g.start_date,
    'endDate',            g.end_date,
    'code',               g.invite_code,
    'creatorId',          g.creator_id,
    'inviteCopied',       g.invite_copied,
    'createdAt',          g.created_at,
    'isMember',           exists (
                            select 1 from public.group_members m
                            where m.group_id = g.id and m.user_id = viewer
                          ),
    'members',            coalesce((
                            select jsonb_agg(
                              jsonb_build_object(
                                'userId',  m.user_id,
                                'name',    p.display_name,
                                'airport', jsonb_build_object('code', a.code, 'city', a.city),
                                'status',  case
                                             when (select count(*) from public.flight_selections s
                                                   where s.group_id = m.group_id and s.user_id = m.user_id) = 2
                                             then 'picked' else 'browsing'
                                           end
                              )
                              order by m.joined_at, m.user_id
                            )
                            from public.group_members m
                            join public.profiles p on p.id = m.user_id
                            join public.airports a on a.code = p.home_airport
                            where m.group_id = g.id
                          ), '[]'::jsonb)
  )
  from public.groups g
  where g.id = target_group;
$$;

-- A new six-character invite code that no other group uses.
-- Letters and digits that are easy to confuse (0/O, 1/I) are left out.
create function private.new_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 characters
  random_bytes bytea;
  code text;
begin
  loop
    -- gen_random_uuid() is built in and unpredictable; its first six bytes are fully random.
    random_bytes := uuid_send(gen_random_uuid());
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, 1 + (get_byte(random_bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.groups g where g.invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- The caller's groups, newest first.
create function public.list_my_groups()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := private.caller_id();
begin
  return coalesce((
    select jsonb_agg(private.group_json(g.id, caller) order by g.created_at desc, g.id)
    from public.groups g
    join public.group_members m on m.group_id = g.id
    where m.user_id = caller
  ), '[]'::jsonb);
end;
$$;

-- One group. Members only: to everyone else the group does not exist.
create function public.get_group(target_group uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := private.caller_id();
begin
  if not exists (
    select 1 from public.group_members m
    where m.group_id = target_group and m.user_id = caller
  ) then
    raise exception 'group_not_found';
  end if;
  return private.group_json(target_group, caller);
end;
$$;

-- The group behind an invite link. Any signed-in person who knows the code may look:
-- knowing the code is what an invitation is.
create function public.preview_invitation(code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := private.caller_id();
  found_group uuid;
begin
  select g.id into found_group
  from public.groups g
  where g.invite_code = upper(trim(coalesce(code, '')));
  if found_group is null then
    raise exception 'invite_not_found';
  end if;
  return private.group_json(found_group, caller);
end;
$$;

-- Creates a group. The caller becomes its creator and first member.
create function public.create_group(group_name text, trip_start date, trip_end date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.caller_id();
  clean_name text := trim(coalesce(group_name, ''));
  new_group uuid;
begin
  if char_length(clean_name) not between 1 and 30
     or trip_start is null or trip_end is null or trip_end < trip_start then
    raise exception 'validation_failed';
  end if;

  insert into public.groups (name, start_date, end_date, creator_id, invite_code)
  values (clean_name, trip_start, trip_end, caller, private.new_invite_code())
  returning id into new_group;

  insert into public.group_members (group_id, user_id) values (new_group, caller);

  return private.group_json(new_group, caller);
end;
$$;

-- Joins a group. Allowed only with that group's invite code.
-- Joining twice is harmless: the second call changes nothing.
create function public.join_group(target_group uuid, code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.caller_id();
  real_code text;
begin
  select g.invite_code into real_code from public.groups g where g.id = target_group;
  if real_code is null then
    raise exception 'group_not_found';
  end if;

  if not exists (
    select 1 from public.group_members m
    where m.group_id = target_group and m.user_id = caller
  ) then
    if upper(trim(coalesce(code, ''))) <> real_code then
      raise exception 'invalid_invite_code';
    end if;
    insert into public.group_members (group_id, user_id)
    values (target_group, caller)
    on conflict do nothing;
  end if;

  return private.group_json(target_group, caller);
end;
$$;

-- Records that a member copied the invite link. Members only.
create function public.mark_invite_copied(target_group uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := private.caller_id();
begin
  if not exists (
    select 1 from public.group_members m
    where m.group_id = target_group and m.user_id = caller
  ) then
    raise exception 'group_not_found';
  end if;
  update public.groups set invite_copied = true where id = target_group;
  return private.group_json(target_group, caller);
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
-- Postgres lets everyone run a new function by default, and Supabase also grants it to
-- visitors. Take all of that away, then allow only signed-in people to call the six
-- public functions. The three helpers stay uncallable from the app.

revoke all on function private.caller_id()               from public, anon, authenticated;
revoke all on function private.group_json(uuid, uuid)    from public, anon, authenticated;
revoke all on function private.new_invite_code()         from public, anon, authenticated;

revoke all on function public.list_my_groups()               from public, anon;
revoke all on function public.get_group(uuid)                from public, anon;
revoke all on function public.preview_invitation(text)       from public, anon;
revoke all on function public.create_group(text, date, date) from public, anon;
revoke all on function public.join_group(uuid, text)         from public, anon;
revoke all on function public.mark_invite_copied(uuid)       from public, anon;

grant execute on function public.list_my_groups()               to authenticated, service_role;
grant execute on function public.get_group(uuid)                to authenticated, service_role;
grant execute on function public.preview_invitation(text)       to authenticated, service_role;
grant execute on function public.create_group(text, date, date) to authenticated, service_role;
grant execute on function public.join_group(uuid, text)         to authenticated, service_role;
grant execute on function public.mark_invite_copied(uuid)       to authenticated, service_role;
