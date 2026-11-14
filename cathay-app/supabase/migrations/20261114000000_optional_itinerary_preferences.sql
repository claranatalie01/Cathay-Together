-- A member explicitly finishes picking even if some or all suggestions have no vote.
-- Keep save_preferences(uuid, text[]) for older clients during deployment.
create function public.finish_picking(target_group uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := private.member_id(target_group);
begin
  update public.group_members set preferences_saved_at = now()
  where group_id = target_group and user_id = caller and preferences_saved_at is null;
end;
$$;

revoke all on function public.finish_picking(uuid) from public, anon;
grant execute on function public.finish_picking(uuid) to authenticated;
