-- Kwanza Square — My Circle: a player's own board of the people they invited.
--
-- Martin's idea: tap your own name and a second, smaller leaderboard opens with
-- you and everybody you brought to the game, ranked the same way the skill
-- board ranks everyone. "Beat the people I recruited" is a reason to invite
-- more of them.
--
-- Nothing new is stored. `players.referred_by` already records who invited
-- whom, and the rating is the skill board's own rule (mean of the best 10
-- matches on a level, three matches before a rating exists).
--
-- Two choices worth stating:
--
-- The circle is everybody the player invited, not only the recruits that have
-- earned a KwanzaStars point. A friend who joined yesterday is still in your
-- circle; `counted` says whether they have also become a point yet, and
-- `days_played` shows how close they are.
--
-- Only the owner can read it. Who invited whom is not shown anywhere else in
-- the game, so this asks for the device id the name was claimed on — the same
-- check the submit function uses before it accepts a match under a name.
-- Anyone else asking gets an empty result, not an error.

create or replace function public.my_circle(
  p_handle    text,
  p_device_id text,
  p_level     text default 'normal'
)
returns table (
  rank        bigint,
  handle      text,
  is_me       boolean,
  rating      numeric,
  matches     bigint,
  counted     boolean,
  days_played integer
)
language sql stable security definer set search_path = public as $$
  with me as (
    select id
    from public.players
    where handle_lower = lower(p_handle)
      and device_id = p_device_id
  ),
  circle as (
    select p.id, p.handle, true as is_me, null::boolean as counted
    from public.players p join me on me.id = p.id
    union all
    select p.id, p.handle, false, p.recruit_credited_at is not null
    from public.players p join me on p.referred_by = me.id
  ),
  scoped as (
    select m.player_id, m.points,
           row_number() over (partition by m.player_id order by m.points desc) as rn
    from public.matches m
    join circle c on c.id = m.player_id
    where m.level = p_level
  ),
  agg as (
    select player_id,
           avg(points) filter (where rn <= 10) as rating,
           count(*)                            as matches
    from scoped
    group by player_id
  ),
  days as (
    select m.player_id, count(distinct date_trunc('day', m.created_at))::int as d
    from public.matches m
    join circle c on c.id = m.player_id
    group by m.player_id
  ),
  scored as (
    select c.handle, c.is_me, c.counted,
           coalesce(a.matches, 0) as matches,
           coalesce(d.d, 0)       as days_played,
           case when coalesce(a.matches, 0) >= 3 then round(a.rating, 2) end as rating
    from circle c
    left join agg a  on a.player_id = c.id
    left join days d on d.player_id = c.id
  )
  select case when s.rating is not null
              then rank() over (order by s.rating desc nulls last)
         end,
         s.handle, s.is_me, s.rating, s.matches, s.counted, s.days_played
  from scored s
  order by s.rating desc nulls last, s.matches desc, lower(s.handle)
  limit 201;
$$;

-- Read-only surface for the key that ships inside the game, same as every
-- other board function.
revoke all on function public.my_circle(text, text, text)    from public, anon;
grant execute on function public.my_circle(text, text, text) to anon, authenticated;
