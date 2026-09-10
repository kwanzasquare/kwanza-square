-- Kwanza Square — the play-style profile, readable for someone other than yourself.
--
-- KZ.Grade.profile() already turns four raw counters into four readings
-- (precision, composure, dominance, consistency) and an archetype. Until now
-- those counters existed only in a player's own localStorage, built up while
-- they played. This adds the same four counters to the server side of a
-- match — worked out the same way everything else here is, by replaying the
-- game rather than trusting what the client claims — so anybody's profile can
-- be read back and handed to the very same profile() function. Nothing new is
-- measured; the grading already happens to verify and score the match.

alter table public.matches
  add column if not exists best          integer not null default 0 check (best >= 0),
  add column if not exists blunders      integer not null default 0 check (blunders >= 0),
  add column if not exists captures      integer not null default 0 check (captures >= 0),
  add column if not exists lost_soldiers integer not null default 0 check (lost_soldiers >= 0);

-- One player's lifetime totals, shaped exactly like the record profile()
-- already expects — so the client calls the same function on somebody else's
-- numbers rather than a second copy of what a trait means having to live here
-- in SQL as well.
create or replace function public.player_profile(p_handle text)
returns table (
  graded        bigint,
  decisions     bigint,
  best          bigint,
  blunders      bigint,
  captures      bigint,
  lost_soldiers bigint,
  recent        numeric[]
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.accuracy, m.decisions, m.best, m.blunders, m.captures, m.lost_soldiers, m.created_at
    from public.matches m
    join public.players p on p.id = m.player_id
    where p.handle_lower = lower(p_handle)
  ),
  recent as (
    select accuracy from mine order by created_at desc limit 50
  )
  select
    count(*),
    coalesce(sum(decisions), 0),
    coalesce(sum(best), 0),
    coalesce(sum(blunders), 0),
    coalesce(sum(captures), 0),
    coalesce(sum(lost_soldiers), 0),
    coalesce((select array_agg(accuracy) from recent), '{}')
  from mine;
$$;

-- Read-only surface for the key that ships inside the game, same as every
-- other board function.
revoke all on function public.player_profile(text)     from public, anon;
grant execute on function public.player_profile(text)  to anon, authenticated;
