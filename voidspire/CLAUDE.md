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

## Setting up a situation instead of playing to one

`index.html?dev=1` opens a console (`js/dev.js`) that names the enemies for a
fight, deals a card, cuts an engraving without the bench, sets HP / Energy /
Shield / sector, ends a turn, kills an enemy and jumps to any non-combat node.
Every button calls a hook in `E.dev` that hands straight back to the real code
— `fight` goes through `startCombat`, a card through `mkCard`, a kill through
`dealToEnemy` — so relics, pressure, intents and death triggers all fire as
they normally do. A console that built its own combat state would be a second
implementation of the game and would prove nothing about the first.

The hooks are always present; only the panel is behind the flag.

## The test suites, and what each one is for

    node test/mechanics.js     rules that must hold
    node test/combatfit.js     48 combat layout invariants
    node test/uifit.js         61 screen layout invariants
    node test/devconsole.js    the dev console sets up REAL situations
    node test/artist.js        the artist tool, driven through its buttons
    node test/sampler.js       the sound tool's sample editor
    node test/animated.js      animated art, end to end through every stop
    node test/standalone.js    tools/linework.html, opened from file://
    node test/_shell.js        all five tools: no page scroll, no pinch zoom

The last five need the tools served: `python3 -m http.server 8944` from
`voidspire/`.

`artist.js` and `sampler.js` exist because of one repeated failure, not a
general wish for coverage: a handler updates the model and leaves the canvas,
the status line or the export showing what was true before it. UNDO greyed out
with points on screen; a finished shape that "was there and looked as though it
was not"; a dragged frame that moved nothing; a stale length readout that read
exactly like undo being broken. None were logic errors. All were a display that
had stopped agreeing with its data. **So assert against what the tool says
about itself** — its status line and its export — after every gesture, and the
whole class disappears. Between them these two suites found four real bugs on
the day they were written.

## Animated art: supported everywhere, used nowhere

An art block is normally one shape, `{ p, e }`. It may instead be
`{ fps, frames: [ {p,e}, … ] }` and play on a loop. **No art in the game uses
that yet** — all 49 enemies, 96 engravings and 201 card icons are a single
frame. What moves on the battlefield is the renderer's idle bob, not the art.

That gap mattered more than it looked. The battlefield canvas had always been
able to play a reel, so the capability read as present, while every other stop
along the pipe had quietly grown unable to carry one:

- `tools/build-assets.js` read `art.p` off an animated block, got `undefined`
  and dropped the asset — the first sprite we animated would have vanished
  from the artist's library with no error to say why.
- The artist's asset list pulled `a.p` / `a.e` off the record, so a surviving
  reel would have opened as a still and been saved back as one.
- `artSVG` did `art.p.forEach` and threw, which would have taken out every
  screen showing an engraving or a card icon.

All three are the same shape: **a capability that exists at one end of a pipe
and nowhere along it.** Worth checking for whenever something is supported "in
principle" but has never had a real user. `test/animated.js` walks the whole
pipe with a real four-frame block.

The DOM half plays a reel as a sprite sheet — frames laid side by side, the
strip stepped one 24-unit frame-width at a time by a CSS `steps()` animation,
frames past the first clipped by the viewBox. No script, and a browser that
will not animate shows frame one rather than a pile of overlapping frames.

## The standalone drawing tool

`node tools/build-standalone.js` turns `tools/artist.html` into
`tools/linework.html` — one file, no dependencies, nothing about this game in
it, with SAVE SVG and SAVE PNG added. It is a build rather than a fork because
a fork would be stale within the week: every artist fix would have to be made
twice, which in practice means made once.

The shim it appends is **additive** — it hides and rewords by id and by
heading text after the page has built itself, so a rename in the artist makes
it do nothing rather than something wrong. The two edits that cannot work that
way (the `assets.js` script tag, the `art:` export prefix) are asserted before
they are made, so a rename fails the build loudly.

`test/standalone.js` opens the output from **`file://`**, not from the server.
That matters: a script that 404s, a fetch that is blocked, an asset that was
never inlined — all of them only fail there, and all of them leave the page
looking almost right.

## Verifying UI work

`test/combatfit.js` and `test/uifit.js` encode real layout invariants and have
caught genuine regressions repeatedly — an ordinary enemy flipping its health
bar above its head, a readout landing behind the cards. When one fails, the
assertion is usually right and the new layout is usually wrong.

Canvas coordinates are **not** layout coordinates: the canvas is sized by
`getBoundingClientRect` while DOM chrome sits inside a transform-scaled
`#game`. Converting between them needs `canvas.offsetHeight` (see
`R.canvasToLayout`).
