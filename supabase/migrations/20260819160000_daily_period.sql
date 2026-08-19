-- Add a daily leaderboard period.
--
-- Note why this migration is required rather than optional. period_start()
-- falls back to '-infinity' for any period it does not recognise, so asking the
-- current function for 'day' returns ALL-TIME rows — a Daily tab would show the
-- wrong data while looking perfectly correct. A silently wrong leaderboard is
-- worse than a missing one, so the server learns 'day' before the app offers it.

create or replace function public.period_start(p_period text)
returns timestamptz language sql immutable as $$
  select case p_period
    when 'day'   then date_trunc('day',   now())
    when 'week'  then date_trunc('week',  now())
    when 'month' then date_trunc('month', now())
    when 'year'  then date_trunc('year',  now())
    else '-infinity'::timestamptz
  end;
$$;

-- A caller can now check what the server understands, so the app never offers a
-- period the database cannot honour.
create or replace function public.supported_periods()
returns text[] language sql immutable as $$
  select array['day','week','month','year','all']::text[];
$$;

revoke all on function public.supported_periods() from public, anon;
grant execute on function public.supported_periods() to anon, authenticated;
