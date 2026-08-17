# Option A — Public leaderboard, no sign-in

Agreed scope for the first central system. Nothing here requires an email
address, a password, or any personal information.

The purpose of A is twofold: give players a reason to come back, and measure
whether they do.

---

## 1. What the player experiences

1. **Play as now.** Nothing about the game itself changes.
2. **Finish a match.** The scoreboard appears with the grade, exactly as today.
3. **"Put this on the leaderboard".** The first time, the player picks a display
   name (a handle). It is checked for availability and stored on their device.
4. **The result is submitted** and the player sees where they now rank.
5. **A Leaderboard screen** is added to the main menu, open to everyone —
   including players who have never submitted anything.

## 2. The leaderboard screens

- **This week** — resets Monday 00:00 UTC.
- **This month** — resets on the 1st.
- **All time.**
- Each shows the **top 100**, plus a pinned row for **"You"** with your position,
  wherever you sit — a player ranked 4,000th still sees their own line.
- Each row: rank, handle, rating, matches played, best accuracy.
- Filter by AI level (Beginner / Skilled / Master), because beating Master is a
  different achievement from beating Beginner.

## 3. How rank is calculated

A rating per completed match, rewarding **beating a stronger opponent** and
**playing well**, so that a careful loss against Master can outrank a sloppy win
against Beginner:

```
match points = base(AI level) × outcome multiplier × accuracy factor

base:        Beginner 10 · Skilled 25 · Master 60
outcome:     win 1.0 · draw 0.5 · loss 0.2
accuracy:    0.5 + (accuracy% / 100)      → 0.5 at 0%, 1.5 at 100%
```

Leaderboard rating is the **average of a player's best 10 matches**, so someone
cannot climb purely by playing hundreds of games, and a single bad match does
not ruin a good record. A minimum of 3 submitted matches is required to appear.

*This formula is a starting proposal and is trivial to change — it lives in one
place on the server.*

## 4. What the server does

1. **Receives a finished match**: the full move list, the claimed result, the
   claimed grade, the AI level, the handle.
2. **Replays it** with the identical game engine the app uses, move by move.
3. **Confirms** the result and the grade independently. Anything that does not
   replay exactly is rejected and never stored.
4. **Stores** the player, the match and the rating.
5. **Serves** the three leaderboards.

Step 2 is the reason this leaderboard can be trusted. The app is never believed;
the game is re-proved on the server. The engine is already pure JavaScript with
no browser dependencies, so the same file runs on the server unchanged — there
is no second implementation to keep in step.

## 5. Anti-abuse

- Handles: profanity filtered, reserved-word list, one claim per device.
- Rate limiting per device and per address.
- Duplicate detection — the same match cannot be submitted twice.
- Any match that fails replay is discarded silently.
- A simple moderation route to rename or remove an offensive handle.

## 6. Privacy

- No email, no password, no name, no location.
- Stored per player: handle, ratings, match records, a random device identifier.
- A public privacy note explaining exactly the above.
- "Forget me" — clears the handle and hides the entries.

## 7. Measurement (the number that decides B and C)

Anonymous counts only, no tracking of individuals:

- Matches started and finished per day.
- **Returning players: next day, day 7, day 30.**
- Average accuracy and grade distribution.
- Which AI level people actually choose.

Day-7 return is the number that determines whether B and C are worth building.

## 8. Explicitly NOT in A

Listed so there is no misunderstanding:

- No password or email; **losing the phone loses the handle**.
- No syncing between a phone and a tablet.
- No live play against another person.
- No friends, challenges or messaging.
- No payments, subscriptions or in-app purchases.
- No push notifications.
- No web admin console (moderation is done directly at first).

These arrive in B and C.

## 9. What the app needs added

- Handle picker.
- Submit-result step on the scoreboard, with retry if the phone is offline.
- Leaderboard screens (week / month / all-time, with the AI filter).
- A small "your rank" line on the home screen.
- Privacy note and "forget me" in Options.

## 10. What is needed outside the code

- A hosting account (in a named person's control) and its monthly bill.
- A domain name, if we want something better than a provider URL.
- Someone to look at reported handles now and then.

## 11. Open decisions

1. Is the rating formula in §3 right, or should rank simply be **best accuracy**?
2. Weekly board resets Monday UTC — or should it follow US time?
3. Should the all-time board ever reset, or run forever?
4. Should a player be allowed to change their handle later?
5. Do we show the AI level beside each entry, or keep separate boards per level?
