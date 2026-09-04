# Kwanza Square

*The African Strategy Game* — a playable digital version of Martin Assoumou's board.

**Play it: https://steph6702.github.io/kwanza-square/**

No sign-in, no install. Works on phones and desktop.

A mystical African traditional game of wit and strategic thinking.
Three concentric squares, 24 intersections, nine soldiers a side, and a sacred
centre no one may hold.

---

## Running it

Double-click **Kwanza Square.app**. That's the launcher — it opens the game in
your default browser.

The app looks for `index.html` beside itself first, so you can move or copy the
whole folder anywhere and it keeps working. If you drag just the launcher out to
the Desktop or the Dock, it falls back to this folder. Either way is fine.

You can also just open `index.html` directly. That is the whole install — no
build step, no package manager, no network access required.

### Sending it to someone

Send the link above — https://steph6702.github.io/kwanza-square/. It is served by
GitHub Pages straight from `main`, so pushing a change updates the live game and
the URL never changes.

If you'd rather send a file than a link, `dist/kwanza-square.html` is the entire game — board, artwork, AI, all of it — in
one 87 KB file with no external requests. Email it, drop it in a message, or put
it on any web host. The recipient opens it and plays; nothing else is needed.

Rebuild it after changing anything in `js/` or `css/`:

```bash
node build-single.js
```

That also writes `dist/artifact-page.html`, the same page without the
doctype/html/body wrapper, for publishing as a Claude Artifact.

To serve it over HTTP instead (useful for testing on a phone on the same wifi):

```bash
python3 -m http.server 8777
```

Then visit `http://localhost:8777` — or `http://<your-computer's-ip>:8777` from
the phone.

## Running the tests

```bash
node test/engine.test.js
```

45 checks covering board geometry, every rule, round/match progression, and the
AI. The engine is pure and has no DOM dependency, so it tests headlessly.

---

## Architecture

Plain JavaScript and SVG, loaded as classic scripts so the file opens straight
from disk. No framework, no bundler, no image files — the board, the 24 motif
tiles, the soldiers and the centre medallion are all generated in code.

| File | Role |
|---|---|
| `js/geometry.js` | Node coordinates, adjacency, the 16 trios, board segments |
| `js/engine.js` | Pure rules engine — legality, trios, capture, rounds, match |
| `js/ai.js` | Kwanza AI — alpha-beta search over the engine, three strengths |
| `js/render.js` | All SVG generation and animation |
| `js/app.js` | Screens, input, AI turns, undo, tutorial, scoreboard |
| `css/styles.css` | Two palettes, layout, animations, phone/landscape tuning |
| `test/engine.test.js` | Headless checks |
| `build-single.js` | Bundles everything into one self-contained HTML file |
| `dist/icon.html` | Renders the launcher icon from the game's own emblem |
| `Kwanza Square.app` | Double-click launcher (AppleScript, custom icon) |

The engine never touches the DOM and the renderer never decides legality. The AI
plays through exactly the same `legalActions` / `apply` calls the UI uses, so the
two can never disagree about the rules.

### Why classic scripts, not ES modules

ES modules are blocked by CORS on `file://`. Classic scripts mean double-clicking
`index.html` just works, which matters for sending the game to someone.

---

## The rules, as implemented

**Board.** Three concentric squares — Territory (outer), Strategy (middle),
Mastery (inner) — eight intersections each, 24 in total. Four radial connectors
join the squares at north, east, south and west. The centre is sacred and never
playable.

**Phase 1, placement.** Nine soldiers a side, placed one at a time, one per
intersection. A placement that would complete a trio is refused — the app marks
those intersections with a red ✕ and asks you to choose another. Nothing scores
during placement, so all 18 soldiers are on the board when it ends, leaving six
free intersections.

The count is adjustable (10, 9 or 8) on the start screen. It began at 10, which
left only four free intersections and made rounds end by trapping rather than by
capturing — in testing, 14 of 14 rounds at 10 a side ended that way and none by
capture. Nine is now the standard game.

**Phase 2, movement.** One step along a line to an adjacent free intersection.
Vertical and horizontal only, never diagonal, never skipping. You may not
immediately move back where you came from. Every move can score, including the
first.

**Scoring.** Three soldiers in a straight line is a trio — along any square's
edge, or straight down a radial connector. Diagonals never count. There are
exactly 16 possible trios.

**Capture.** A trio grants the right to remove any one enemy soldier, including
one standing inside a trio of its own.

**Winning.** A round ends when a side has no soldiers left, or cannot move. The
match is best of three.

A round with no capture in 100 moves is declared drawn and neither side scores —
a safety valve so a match can never run forever. It is not part of the
traditional rules; remove `DRAW_LIMIT` in `js/engine.js` if you'd rather it
didn't exist.

---

## Colour

Two palettes, deliberately kept apart.

**Board — Martin's original painted colours**

| | |
|---|---|
| Royal blue | `#1B4BA8` (deep `#10306B`) |
| Orange | `#E4711E` (light `#F79438`) |
| Black | `#101010` |
| White | `#FFFFFF` |

**UI — the modern shell**

| | |
|---|---|
| Emerald | `#0F6F4F` |
| Royal gold | `#D4A017` |
| Ivory | `#F7F3E9` |
| Charcoal | `#1A1A1A` |
| Crimson | `#B02020` |

Typography is Montserrat / Inter / Ubuntu where available, falling back to the
system font stack. No webfont is loaded, so the game works offline; add a font
`<link>` in `index.html` if you want the exact faces.

---

## On phones

- Portrait-first, sized in `dvh` with safe-area insets for notched screens.
- Tap to select, tap to move — no dragging.
- Each intersection has an invisible 56-unit tap target, far larger than the
  visible tile.
- Short landscape screens switch to side rails so the board keeps the full height.
- The side mottos are hidden below 480px, where they'd be unreadable.
- **Tap to confirm** (Options) adds a confirmation step before a move commits,
  for smaller screens.
- Sound is generated with the Web Audio API — no audio files.

---

## Replacing the artwork

The 24 motif tiles are abstract geometric stand-ins for Martin's own paintings.
They are generated by `motif(index, ink, accent)` in `js/render.js`: twelve
figures in two colourways. To use the real artwork, replace the body of
`motifFor(id)` with an `<image href="art/tile-<id>.png" .../>` per intersection —
nothing else needs to change.

---

## Online leaderboard and KwanzaStars

Kwanza Square now has a live Supabase-backed competition layer.

### Verified skill leaderboard

Finished matches can be submitted to the online leaderboard.

The client does not decide its own result or score. The `submit` Edge Function
receives the full action log and replays the game server-side using the same
Kwanza engine before storing the result.

Invalid or impossible games are rejected.

### KwanzaStars recruitment leaderboard

Players can invite new players with a referral link:

`https://kwanzasquare.com/?ref=theirhandle`

The recruiter is recorded when the new player first appears and cannot be
changed afterwards.

A recruit counts only after the new player has played three matches on three
different days.

A recruit playing on the same device as the recruiter does not count.

Each qualified recruit is credited once only.

The KwanzaStars levels are:

- Bronze — 5 qualified recruits
- Silver — 10
- Gold — 25
- Platinum — 50
- Diamond — 100

The social leaderboard ranks players by qualified recruits. Players with no
qualified recruits yet can still see how many recruits they need to reach their
next star.

### Invitational status

The backend exposes the Invitational requirements separately so the game can
show a player exactly what they are still missing:

- days played
- matches played
- skill leaderboard rank
- recruitment leaderboard rank

### Deployment

The KwanzaStars database migration is:

`supabase/migrations/20260902180000_kwanzastars.sql`

The production `submit` Edge Function is located at:

`supabase/functions/submit/`

The KwanzaStars migration and the updated `submit` function are currently
deployed on the production Supabase project.

---

## What is not built

These wider product features are still outside the current implementation:

- online human-vs-human multiplayer
- monetization such as ads, skins or subscriptions
- store / wider commercial site
- native app-store packaging

The core game, AI, verified online leaderboard and KwanzaStars recruitment
system are built.
