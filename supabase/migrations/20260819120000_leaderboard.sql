-- Kwanza Square — leaderboard schema (Option A)
--
-- Security model, in one line: the app is never believed. Nothing here is
-- writable by the public key that ships in the game. Every match arrives
-- through the `submit` edge function, which replays the whole game with the
-- same engine the app uses and works out the result for itself. The only
-- public surface is a set of read-only leaderboard functions.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- players
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  handle       text not null check (handle ~ '^[A-Za-z0-9_]{3,16}$'),
  handle_lower text generated always as (lower(handle)) stored unique,
  device_id    text not null,
  created_at   timestamptz not null default now(),
  seen_at      timestamptz not null default now()
);

create index if not exists players_device_idx on public.players (device_id);

-- ---------------------------------------------------------------- matches
create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  level         text not null check (level in ('easy','normal','hard')),
  pawns         smallint not null check (pawns between 5 and 12),
  rounds_to_win smallint not null check (rounds_to_win between 1 and 3),
  result        text not null check (result in ('win','loss','draw')),
  accuracy      numeric(5,2) not null check (accuracy between 0 and 100),
  decisions     integer not null check (decisions >= 0),
  points        numeric(8,3) not null,
  moves         jsonb not null,
  -- the same game can never be counted twice
  fingerprint   text not null unique,
  created_at    timestamptz not null default now()
);

create index if not exists matches_board_idx  on public.matches (level, created_at desc);
create index if not exists matches_player_idx on public.matches (player_id, level);

-- Locked down. No policies are defined, so with RLS on, the anon key can do
-- nothing at all here. The edge function uses the service role, which bypasses
-- RLS — that is the only way in.
alter table public.players enable row level security;
alter table public.matches enable row level security;

-- ------------------------------------------------------------ leaderboards
-- A player's rating is the mean of their best 10 matches on that board, so
-- nobody climbs by grinding hundreds of games and one bad match cannot ruin a
-- good record. Three matches minimum before appearing.

create or replace function public.period_start(p_period text)
returns timestamptz language sql immutable as $$
  select case p_period
    when 'week'  then date_trunc('week',  now())
    when 'month' then date_trunc('month', now())
    when 'year'  then date_trunc('year',  now())
    else '-infinity'::timestamptz
  end;
$$;

create or replace function public.leaderboard(
  p_level text,
  p_period text default 'all',
  p_limit int default 100
)
returns table (
  rank bigint,
  handle text,
  rating numeric,
  matches bigint,
  best_accuracy numeric
)
language sql stable security definer set search_path = public as $$
  with scoped as (
    select m.player_id, m.points, m.accuracy,
           row_number() over (partition by m.player_id order by m.points desc) as rn
    from public.matches m
    where m.level = p_level
      and m.created_at >= public.period_start(p_period)
  ),
  agg as (
    select player_id,
           avg(points) filter (where rn <= 10) as rating,
           count(*)                            as matches,
           max(accuracy)                       as best_accuracy
    from scoped
    group by player_id
    having count(*) >= 3
  )
  select rank() over (order by a.rating desc),
         p.handle,
         round(a.rating, 2),
         a.matches,
         a.best_accuracy
  from agg a
  join public.players p on p.id = a.player_id
  order by a.rating desc
  limit greatest(1, least(p_limit, 200));
$$;

-- One player's own standing, so somebody ranked 4000th still sees their line.
create or replace function public.my_standing(
  p_handle text,
  p_level text,
  p_period text default 'all'
)
returns table (
  rank bigint,
  handle text,
  rating numeric,
  matches bigint,
  best_accuracy numeric
)
language sql stable security definer set search_path = public as $$
  with scoped as (
    select m.player_id, m.points, m.accuracy,
           row_number() over (partition by m.player_id order by m.points desc) as rn
    from public.matches m
    where m.level = p_level
      and m.created_at >= public.period_start(p_period)
  ),
  agg as (
    select player_id,
           avg(points) filter (where rn <= 10) as rating,
           count(*)                            as matches,
           max(accuracy)                       as best_accuracy
    from scoped
    group by player_id
    having count(*) >= 3
  ),
  ranked as (
    select rank() over (order by a.rating desc) as rank,
           p.handle, round(a.rating, 2) as rating,
           a.matches, a.best_accuracy
    from agg a join public.players p on p.id = a.player_id
  )
  select * from ranked where lower(handle) = lower(p_handle);
$$;

-- Is a handle free? Returns true when nobody holds it.
create or replace function public.handle_available(p_handle text)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_handle ~ '^[A-Za-z0-9_]{3,16}$'
     and not exists (select 1 from public.players where handle_lower = lower(p_handle));
$$;

-- Read-only surface for the key that ships inside the game.
revoke all on function public.leaderboard(text, text, int)     from public, anon;
revoke all on function public.my_standing(text, text, text)    from public, anon;
revoke all on function public.handle_available(text)           from public, anon;
grant execute on function public.leaderboard(text, text, int)  to anon, authenticated;
grant execute on function public.my_standing(text, text, text) to anon, authenticated;
grant execute on function public.handle_available(text)        to anon, authenticated;
