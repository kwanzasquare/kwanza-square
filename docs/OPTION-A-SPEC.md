# Option A — Local and Global play, with a public leaderboard

Revision 2. Incorporates Martin's rulings of 17 August.

Nothing here requires an email address, a password, or any personal
information. The purpose of A is to give players a reason to come back, and to
measure whether they do.

---

## 1. Local or Global — the player chooses

Martin's structure, adopted. This is now the top-level choice on the home screen.

**Local** — nothing leaves the phone, nothing is reported anywhere:
- One player against a chosen AI level (Beginner / Skilled / Master).
- Two players on the same phone, no AI.

**Global** — the player opts into the wider game:
- Ranking, leaderboards, and later competition.
- Only Global matches are submitted. A Local match is never sent.

This is the entry point: someone can play, enjoy it and never touch a central
system. Nothing is asked of them until they want in.

## 2. What a Global player experiences

1. Finish a match. The scoreboard appears with the grade, as it does now.
2. **"Put this on the leaderboard."** First time only, the player picks a
   display name. It's checked for availability and kept on their device.
3. The result is sent, checked, and their new position is shown.
4. A **Leaderboard** screen in the menu, readable by anyone — including players
   who have never submitted anything.

## 3. The leaderboards

Four cycles, per Martin:

- **Weekly**
- **Monthly**
- **Yearly**
- **All time** (archived, never reset)

**Separate boards per AI level** — Beginner, Skilled and Master each have their
own standings, so beating Master is never mixed in with beating Beginner.

Each board shows the **top 100**, plus a pinned row for **"You"** wherever you
rank — someone in 4,000th place still sees their own line. Each row: rank,
handle, rating, matches played, best accuracy.

## 4. How rank is calculated

Because the boards are separated by AI level (§3), rank *within* a board is
driven by result and quality of play:

```
match points = outcome multiplier × accuracy factor

outcome:   win 1.0 · draw 0.5 · loss 0.2
accuracy:  0.5 + (accuracy% / 100)     → 0.5 at 0%, 1.5 at 100%
```

Rating is the **average of a player's best 10 matches**, so nobody climbs by
grinding hundreds of games and one bad match doesn't ruin a good record. A
minimum of 3 submitted matches to appear.

An **optional combined board** across all levels can also be published. Only
there does the opponent's strength need weighting — Beginner ×10, Skilled ×25,
Master ×60 — so that a careful loss to Master can outrank a sloppy win over
Beginner. *This is what "beating a stronger opponent" meant: a harder AI level,
nothing more.*

Per Martin's 11.1: the formula lives in **one place on the server** and can be
changed at any time without touching the app.

## 5. Why a result has to be "submitted"

Martin's question, and it deserves a straight answer.

The thing that currently "already knows the result" is **the app on the
player's own phone** — not a central system. There is no central system yet;
that is what we are building.

And a phone cannot be trusted. Anyone determined can alter what their phone
sends and claim a win with a perfect grade. So the app sends the **whole game**
— every move, in order — and the server **replays it move by move** with the
identical engine and works out the result and the grade for itself. Anything
that doesn't replay exactly is thrown away.

So "submit" is not the player doing paperwork. It is one tap, and it happens
only because they chose Global. Martin's Local/Global split in §1 answers this
neatly: a Local player never submits anything at all.

## 6. Anti-abuse

- Handles: profanity filtered, reserved-word list, one claim per device.
- Duplicate detection — the same match cannot be submitted twice.
- Any match failing replay is discarded silently.
- A route to rename or remove an offensive handle.
- **Rate limiting** — a cap on how many results one phone or one internet
  connection can send in a short period. *This does not limit how much anyone
  can play.* It exists so that a script cannot fire thousands of fabricated
  games at the leaderboard in an hour.

## 7. Privacy

- No email, no password, no real name, no location.
- Stored per player: handle, ratings, match records, a random device identifier.
- A public privacy note saying exactly that.
- "Forget me" — clears the handle and hides the entries.

## 8. Measurement

Anonymous counts only:

- Matches started and finished per day, split Local vs Global.
- **Returning players: next day, day 7, day 30.**
- Accuracy and grade distribution; which AI level people actually choose.

Day-7 return is the number that decides whether B and C are worth building.

## 9. Match length — best of 3, and a quick match

Martin asked whether best of 5 is more attractive than best of 3.

**Recommendation: keep best of 3, and add a single-round Quick Match.**

At nine soldiers a side a round runs about 104 moves between the two sides. A
best-of-three match is therefore roughly 8–12 minutes of real play; best of five
would be 15–25. Phone sessions are typically five to ten minutes, so best of
five would leave a lot of matches abandoned half-finished — which is worse than
a short match, because an abandoned match produces no result and no leaderboard
entry.

Best of 5 is the right format for a **tournament** later, in C, where players
have committed to being there. For a stranger's first game, one round is plenty.

## 10. Advertising, per Martin

- A streaming banner line along the bottom of the screen.
- 10–20 second ads between games.

Two practical notes: nothing should ever appear **during** a match, and an ad
after *every* game is the most common way a good game loses its players. Every
second or third is the usual balance. Both are settings, easily tuned.

Ads pay materially better inside an app store listing than on a web page, which
makes §11 part of the same job.

## 11. Distribution

- Google Play Store — $25 once.
- Apple App Store — $99 per year.
- The existing game wraps into both without being rewritten.

## 12. Explicitly NOT in A

- No password or email; losing the phone loses the handle.
- No syncing between two devices.
- No live play against another person over the internet.
- No friends, challenges or messaging.
- No payments or subscriptions.
- No push notifications.

These are B and C.

## 13. Hosting and domain

**Account holder: RME Assoumou.** Beyond the name, a provider will want an
email address, a billing address, a telephone number and a payment card.

Kenneth is setting up **OVH Cloud**. Workable. Worth knowing that a managed
service such as Supabase or Cloudflare would need less maintenance for this
particular job, and both have free tiers at our size — but if OVH is already in
motion, we build on OVH.

**One thing to settle before the domain is registered.** Two spellings have been
used: `kwanzaa squarres` and `kwanzasquares`. Martin's own earlier ruling was
that the official name is **Kwanza Square — one A**, chosen deliberately to match
the painted board and to avoid confusion with the Kwanzaa holiday.

The domain should match the brand. Recommended, in order:

1. `kwanzasquare.com`
2. `kwanzasquares.com`
3. `.org` and `.eu` alongside, as Martin suggested, pointing at the same place

`.dom` is not a real extension — `.com` is presumably what was meant. And
`squarres` with two R's is a typo worth catching before money is spent.

## 14. Settled

| Ref | Decision |
|---|---|
| 11.1 | Rating formula accepted; must stay easy to change |
| 11.2 | Reset timing left to us — chosen: Monday 00:00 UTC |
| 11.3 | Four cycles: weekly, monthly, yearly, all-time archived |
| 11.4 | Handle changes allowed; the record transfers to the new handle |
| 11.5 | Separate boards per AI level |
| 10 | Hosting under RME Assoumou, on OVH Cloud |
| — | Local / Global choice added as the top-level structure |
| — | Best of 3 retained; single-round Quick Match added |
