-- Kwanza Square — KwanzaStars: the recruitment (social) leaderboard.
--
-- Martin's design, with one deliberate change and one deliberate addition.
--
-- The change: a recruit does NOT count the moment a new name finishes a single
-- match. The moment money is attached to a counter, inflating the counter
-- becomes worth doing, and one person can invent names and play one quick game
-- under each in an evening. So a recruit counts once the new player has played
-- three matches on three DIFFERENT days. Real players clear that without
-- noticing; a fraudster has to keep each invented person alive for three days.
--
-- The addition: a recruit on the same device as the recruiter never counts at
-- all. That is the cheap half of the same problem, and it costs an honest
-- player nothing — two people sharing one phone are not recruiting each other.
--
-- Everything here inherits the existing security model unchanged: the tables
-- stay unreachable by the key that ships in the game, crediting is service_role
-- only, and the public surface is read-only functions.

-- ------------------------------------------------------------------ schema

alter table public.players
  add column if not exists referred_by uuid references public.players(id) on delete set null,
  -- Null until the recruit qualifies. Storing the moment rather than
  -- recomputing it is what makes an end-of-period snapshot honest: once a point
  -- is earned it is stamped with when, and a later change of rules cannot
  -- silently move somebody's historical total.
  add column if not exists recruit_credited_at timestamptz;

-- Nobody recruits themselves.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_no_self_referral') then
    alter table public.players
      add constraint players_no_self_referral check (referred_by is null or referred_by <> id);
  end if;
end $$;

create index if not exists players_referrer_idx
  on public.players (referred_by) where referred_by is not null;

-- A referrer is recorded once, when the player first appears, and is never
-- rewritten afterwards. Without this, a bug or a stray update could move a
-- credited point from one recruiter to another after the fact.
create or replace function public.players_freeze_referrer()
returns trigger language plpgsql as $$
begin
  if old.referred_by is not null and new.referred_by is distinct from old.referred_by then
    raise exception 'referred_by cannot be changed once set';
  end if;
  return new;
end;
$$;

drop trigger if exists players_freeze_referrer on public.players;
create trigger players_freeze_referrer
  before update on public.players
  for each row execute function public.players_freeze_referrer();

-- ------------------------------------------------------------- star levels

-- Martin's ladder, in one place so the app and the database can never disagree
-- about what somebody has earned.
create or replace function public.star_level(p_recruits integer)
returns text language sql immutable as $$
  select case
    when p_recruits >= 100 then 'diamond'
    when p_recruits >=  50 then 'platinum'
    when p_recruits >=  25 then 'gold'
    when p_recruits >=  10 then 'silver'
    when p_recruits >=   5 then 'bronze'
    else null
  end;
$$;

create or replace function public.star_thresholds()
returns table (level text, recruits integer)
language sql immutable as $$
  select * from (values
    ('bronze', 5), ('silver', 10), ('gold', 25), ('platinum', 50), ('diamond', 100)
  ) as t(level, recruits);
$$;

-- --------------------------------------------------------------- crediting

-- Has this player proved they are a real returning player rather than a name
-- created to be counted? Three matches on three distinct days.
create or replace function public.recruit_qualified(p_player uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select count(distinct date_trunc('day', created_at)) >= 3
  from public.matches where player_id = p_player;
$$;

-- Credit the player's recruiter, if they have one, if they now qualify, and if
-- they are not on the recruiter's own device. Returns true only on the call
-- that actually awards the point, so it is safe to call after every match.
create or replace function public.credit_recruit(p_player uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_ref uuid;
  v_done timestamptz;
  v_same_device boolean;
begin
  select referred_by, recruit_credited_at into v_ref, v_done
  from public.players where id = p_player;

  if v_ref is null or v_done is not null then return false; end if;
  if not public.recruit_qualified(p_player) then return false; end if;

  select r.device_id = p.device_id into v_same_device
  from public.players p join public.players r on r.id = v_ref
  where p.id = p_player;

  if coalesce(v_same_device, false) then return false; end if;

  update public.players set recruit_credited_at = now()
  where id = p_player and recruit_credited_at is null;

  return found;
end;
$$;

-- ------------------------------------------------------- the social board

-- Recruitment ranking. `p_period` reuses the same period vocabulary as the
-- skill board, measured on when the point was earned.
create or replace function public.stars_leaderboard(
  p_period text default 'all',
  p_limit int default 100
)
returns table (
  rank bigint,
  handle text,
  recruits bigint,
  level text
)
language sql stable security definer set search_path = public as $$
  with counted as (
    select r.referred_by as player_id, count(*) as recruits
    from public.players r
    where r.referred_by is not null
      and r.recruit_credited_at is not null
      and r.recruit_credited_at >= public.period_start(p_period)
    group by r.referred_by
  )
  select rank() over (order by c.recruits desc),
         p.handle,
         c.recruits,
         public.star_level(c.recruits::int)
  from counted c
  join public.players p on p.id = c.player_id
  order by c.recruits desc
  limit greatest(1, least(p_limit, 200));
$$;

-- One player's own standing on the social board, so somebody ranked 4000th
-- still sees their line — and, importantly, sees it before they have any
-- recruits at all, which is when they most need telling how it works.
create or replace function public.my_stars(
  p_handle text,
  p_period text default 'all'
)
returns table (
  rank bigint,
  handle text,
  recruits bigint,
  level text,
  next_level text,
  to_next integer
)
language sql stable security definer set search_path = public as $$
  with counted as (
    select r.referred_by as player_id, count(*) as recruits
    from public.players r
    where r.referred_by is not null
      and r.recruit_credited_at is not null
      and r.recruit_credited_at >= public.period_start(p_period)
    group by r.referred_by
  ),
  ranked as (
    select rank() over (order by c.recruits desc) as rank, p.handle, c.recruits
    from counted c join public.players p on p.id = c.player_id
  ),
  me as (
    select p.handle,
           coalesce(rk.rank, 0)     as rank,
           coalesce(rk.recruits, 0) as recruits
    from public.players p
    left join ranked rk on lower(rk.handle) = lower(p.handle)
    where p.handle_lower = lower(p_handle)
  )
  select me.rank, me.handle, me.recruits,
         public.star_level(me.recruits::int),
         nxt.level,
         (nxt.recruits - me.recruits)::int
  from me
  left join lateral (
    select t.level, t.recruits from public.star_thresholds() t
    where t.recruits > me.recruits order by t.recruits limit 1
  ) nxt on true;
$$;

-- ------------------------------------------ invitational tournament status

-- The three conditions from Kwanza stars 3, answered as data rather than as a
-- yes/no, so the app can show a player exactly which one they are short on.
--
-- "Play every other day" is read as distinct DAYS played in the last 30 — not
-- fifteen matches, which somebody could finish in a single sitting and which
-- would not mean what Martin means by it.
create or replace function public.kit_status(
  p_handle text,
  p_level text default 'normal'
)
returns table (
  handle text,
  days_played integer,
  days_required integer,
  active boolean,
  matches_played bigint,
  matches_required integer,
  skill_rank bigint,
  skill_ok boolean,
  social_rank bigint,
  social_ok boolean,
  eligible boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select id, handle from public.players where handle_lower = lower(p_handle)
  ),
  activity as (
    select count(distinct date_trunc('day', m.created_at))::int as days,
           count(*) as played
    from public.matches m join me on me.id = m.player_id
    where m.created_at >= now() - interval '30 days'
  ),
  total as (
    select count(*) as played
    from public.matches m join me on me.id = m.player_id
    where m.level = p_level
  ),
  skill as (
    select rank from public.my_standing(p_handle, p_level, 'all')
  ),
  social as (
    select rank from public.my_stars(p_handle, 'all')
  )
  select me.handle,
         activity.days,
         15,
         activity.days >= 15,
         total.played,
         100,
         coalesce(skill.rank, 0),
         coalesce(skill.rank, 0) between 1 and 50 and total.played >= 100,
         coalesce(social.rank, 0),
         coalesce(social.rank, 0) between 1 and 50,
         activity.days >= 15
           and coalesce(skill.rank, 0) between 1 and 50 and total.played >= 100
           and coalesce(social.rank, 0) between 1 and 50
  from me, activity, total
  left join skill on true
  left join social on true;
$$;

-- ------------------------------------------------------------------ grants

-- Read-only surface for the key that ships inside the game.
revoke all on function public.star_level(integer)                from public, anon;
revoke all on function public.star_thresholds()                  from public, anon;
revoke all on function public.stars_leaderboard(text, int)       from public, anon;
revoke all on function public.my_stars(text, text)               from public, anon;
revoke all on function public.kit_status(text, text)             from public, anon;
grant execute on function public.star_level(integer)             to anon, authenticated;
grant execute on function public.star_thresholds()               to anon, authenticated;
grant execute on function public.stars_leaderboard(text, int)    to anon, authenticated;
grant execute on function public.my_stars(text, text)            to anon, authenticated;
grant execute on function public.kit_status(text, text)          to anon, authenticated;

-- Crediting is never a public act. Only the edge function, which holds the
-- service role and is the only code that has proved a match is real, may award
-- a point.
revoke all on function public.recruit_qualified(uuid) from public, anon, authenticated;
revoke all on function public.credit_recruit(uuid)    from public, anon, authenticated;
grant execute on function public.recruit_qualified(uuid) to service_role;
grant execute on function public.credit_recruit(uuid)    to service_role;
