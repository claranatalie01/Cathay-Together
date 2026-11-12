-- Creator deletion removes the entire trip through the existing foreign keys.
-- Leaving removes only the caller's membership and its dependent rows.
create function public.delete_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.member_id(target_group);
begin
  delete from public.groups g
  where g.id = target_group and g.creator_id = caller;

  -- Another creator session may already have deleted it after the membership check.
  if not found and exists (select 1 from public.groups g where g.id = target_group) then
    raise exception 'creator_required';
  end if;
end;
$$;

create function public.leave_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := private.member_id(target_group);
begin
  if exists (select 1 from public.groups g where g.id = target_group and g.creator_id = caller) then
    raise exception 'creator_cannot_leave';
  end if;

  delete from public.group_members m
  where m.group_id = target_group and m.user_id = caller;
end;
$$;

revoke all on function public.delete_group(uuid) from public, anon;
revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated, service_role;
grant execute on function public.leave_group(uuid) to authenticated, service_role;
