-- Let people use their own names.
--
-- The handle rule was ^[A-Za-z0-9_]{3,16}$, which rejects Kouamé, Stéphane,
-- Aké, Zoë and Müller. For a game made by an Ivorian family, largely for
-- French speakers, that is a bad moment to hit: it lands at the exact instant
-- someone commits to a name, and it tells them their own name is invalid.
--
-- WHY NOT SIMPLY ALLOW ANY UNICODE. The leaderboard enforces uniqueness, so a
-- handle is an identity, and identities invite impersonation. "Kwaku" written
-- with a Cyrillic а is a different string that renders identically; allowing
-- all letters would let somebody register a perfect visual copy of the player
-- at the top of the board. So this widens to Latin letters with diacritics and
-- stops there — no Cyrillic, no Greek, no emoji, no zero-width characters.
--
-- The ranges skip U+00D7 and U+00F7 deliberately: those are the multiplication
-- and division signs, which sit inside the Latin-1 letter block and are not
-- letters.
--
-- NORMALISATION is handled in the submit edge function rather than here. é can
-- be written as one code point or as e plus a combining accent — visually
-- identical, different strings, so both could be claimed. The edge function is
-- the ONLY thing that ever writes to this table (row level security leaves the
-- public key no access at all), so normalising there is sufficient and there is
-- no need to rebuild the generated uniqueness column.

alter table public.players drop constraint if exists players_handle_check;

alter table public.players add constraint players_handle_check
  check (handle ~ '^[A-Za-z0-9_À-ÖØ-öø-ɏ]{3,16}$');

-- Let the app ask what the rule actually is, rather than carrying its own copy.
--
-- The app cannot simply widen its own validation the day this file is written:
-- until the constraint above is applied, a player could claim "Kouamé", play
-- three matches and only then be refused at submit — worse than being told no
-- at the start. So the app reads the rule from here instead. Before this
-- migration runs it falls back to the old ASCII pattern and nothing changes;
-- afterwards accented names start working on their own, with no coordinated
-- release and no window where the two disagree.

create or replace function public.handle_pattern()
returns text language sql immutable as $$
  select '^[A-Za-z0-9_À-ÖØ-öø-ɏ]{3,16}$';
$$;

revoke all on function public.handle_pattern() from public, anon;
grant execute on function public.handle_pattern() to anon, authenticated;
