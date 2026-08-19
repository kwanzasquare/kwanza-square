-- Grant the server role access to the leaderboard tables.
--
-- The first migration relied on Supabase's default privileges to give
-- service_role access to new tables in `public`. On this project they did not
-- apply, so the edge function — which holds the service role — was refused with
-- "permission denied for table players" and every genuine match failed to save.
--
-- Being explicit is better practice anyway: it states exactly who may touch
-- these tables instead of depending on a setting that can differ per project.
--
-- Note what is NOT granted. `anon` and `authenticated` get nothing at all, so
-- the publishable key shipped inside the game is refused twice over: once by
-- the missing grant, and again by row level security having no policies. The
-- only ways in remain the three read-only functions and the submit endpoint.

grant usage on schema public to service_role;

grant select, insert, update on table public.players to service_role;
grant select, insert          on table public.matches to service_role;

-- Say it out loud rather than leaving it to chance.
revoke all on table public.players from anon, authenticated;
revoke all on table public.matches from anon, authenticated;
