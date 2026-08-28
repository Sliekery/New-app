# Voidspire — working notes

## Scope: the Vanguard is the game

Balance work targets the **Vanguard only**. Do not report, tune against, or
draw conclusions from the Technomancer's or the Voidadept's numbers, and do
not treat the class-parity spread as a signal — it is not the thing being
built. `node test/sim.js <n> vanguard` is the run that counts.

This matters beyond tidiness. A mechanic was once "fixed" on the strength of
the two other classes going backwards, which moved the Vanguard from +1.8 to
-2.0 on the identical mechanic. Optimising for classes that are not the
subject makes the subject worse.

## The sim is a weak instrument, and knowing how weak matters

Win rate swings hard on seed choice alone. The same code read 2.3 and 14.0
points of spread on two different runs, and single-class figures move several
points between sample sizes. Rules that follow from that:

- **The sim is NOT deterministic, and the spread is large.** Identical code,
  vanguard, four runs at n=600: 39.3 / 34.3 / 38.8 / 29.2 — a ten-point range
  from nothing changing at all. (Three runs at n=800 gave 33.6 / 32.0 / 33.3,
  which flattered it; three samples badly underestimate this.)
  There is no such thing as a "same seeds" comparison here, and treating one
  run of A against one run of B as paired is how several confident and wrong
  conclusions got stated.
- **Compare distributions, not numbers**: repeat each side 4+ times and
  compare means with their spread. A single number says nothing.
- **Treat a delta under ~5 points as unresolved**, even across repeated runs.
  Two bot heuristics measured 35.4 and 36.3 mean over four runs each with
  almost totally overlapping ranges: indistinguishable. Confident stories were
  told about a "+1.8 lift" and a "2.6-point regression" between those same two
  builds. Both were noise.
- The sim can still see LARGE effects and structural facts — a stall, a crash,
  the fight clock, whether a mechanic fires at all. Use it for those.
- **Never characterise an effect from part of the data**, and check what a
  grep is actually matching: the per-archetype rows ("THE LONG SHOT 38.2%
  win") match the same pattern as the overall, so extract the total with an
  anchored `^   vanguard:` or you will average a blend of the two.
- Distinguish **"the bot plays it badly"** from **"the mechanic is bad."** They
  look identical in the output and are not the same finding. If a heuristic
  change flips the sign of a result, the sim has measured the heuristic.

## Comparing two versions: use a worktree, never `git stash`

`git worktree add /tmp/x <ref>` and symlink `node_modules` into it. Stashing
while a background sim is running against the same tree silently swaps the
code underneath it and produces numbers that look plausible and are garbage.
That has happened; the contaminated figure sat neatly between the two real
ones.

## Things that are measured, not guessed

The comments in `js/` carry the measurement that motivated each decision —
what was tried, what it read, why it changed. Keep that up: the reasons are
worth more than the values, because the values get retuned.

Load-bearing findings so far:

- Halving the die costs ~30% of total output (the instability's price).
- An ordinary engraving fires on ~7.5% of rolls: its own face at 5%, plus a
  quarter-strength bleed off each neighbour.
- A permanent fires on 100%, which is ~13x the frequency before any number is
  compared — hence flat damage, flat Shield or a rule change only. Anything
  that accumulates (a scaling stat, Energy, a card) compounds: 1 Stim a roll
  measured x3.96 total damage.
- Enemy art is symmetric about x=0, i.e. already drawn facing the viewer.
- Canvas silently drops any path containing NaN, so bad art data is invisible
  rather than loud.

## Verifying UI work

`test/combatfit.js` and `test/uifit.js` encode real layout invariants and have
caught genuine regressions repeatedly — an ordinary enemy flipping its health
bar above its head, a readout landing behind the cards. When one fails, the
assertion is usually right and the new layout is usually wrong.

Canvas coordinates are **not** layout coordinates: the canvas is sized by
`getBoundingClientRect` while DOM chrome sits inside a transform-scaled
`#game`. Converting between them needs `canvas.offsetHeight` (see
`R.canvasToLayout`).
