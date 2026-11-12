-- Cathay Together: let the planner replace an out-of-date itinerary.
--
-- Why this file exists
--   The first planner migration saved a plan with "on conflict (group_id) do nothing", and the
--   planner treated "a plan row exists" as "already built". So once any itinerary was saved, it was
--   never rebuilt, even after a member joined, someone changed a swipe, or a flight changed.
--
--   The planner now stamps each plan with a fingerprint of what it was built from and builds again
--   when the group's members, swipes or flights no longer match. For that, saving must be allowed to
--   REPLACE the stored plan. This file changes only that one line of finish_trip_planner_job.
--
--   People's own edits to a plan (removing or reordering stops) are replaced when a rebuild happens.
--
-- How to run it
--   SQL Editor > New query > paste this whole file > Run. Expect "Success. No rows returned".
--   Safe to run again: it only replaces the function.

create or replace function public.finish_trip_planner_job(target_group uuid, viewer uuid, token uuid, operation text, result jsonb, expected_inputs jsonb default null)
returns boolean language plpgsql set search_path = '' as $$
begin
  perform 1 from public.group_place_decks where group_id = target_group and job_token = token
    and job_until > clock_timestamp() for update;
  if not found or not exists (select 1 from public.group_members where group_id = target_group and user_id = viewer) then
    return false;
  end if;

  if operation = 'discover' then
    update public.group_place_decks set places = result->'places', sources = result->'sources'
      where group_id = target_group and places is null and not legacy;
  elsif operation = 'plan' then
    if public.trip_planner_inputs(target_group) is distinct from expected_inputs then
      return false;
    end if;
    insert into public.itineraries (group_id, plan, updated_by) values (target_group, result, viewer)
      on conflict (group_id) do update
        set plan = excluded.plan, updated_by = excluded.updated_by, updated_at = now();
  else
    return false;
  end if;
  return true;
end;
$$;

-- The replace above keeps the function's owner and grants; restate them so a fresh project matches.
revoke all on function public.finish_trip_planner_job(uuid, uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finish_trip_planner_job(uuid, uuid, uuid, text, jsonb, jsonb) to service_role;
