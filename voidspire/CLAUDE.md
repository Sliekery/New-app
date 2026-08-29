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
    node test/geometry.js      every sci-fi shape and every 3D solid
    node test/ux.js            the layout budget: canvas share, targets, prose
    node test/export.js        every export format, saved and then opened
    node test/tabs.js          several drawings open at once, and their seams
    node test/grid.js          snapping, and whether it makes the shape you meant
    node test/rig.js           PIVOT and REPEAT — a limb that swings, not redrawn
    node test/_shell.js        all five tools: no page scroll, no pinch zoom

The last eleven need the tools served: `python3 -m http.server 8944` from
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

## 3D in the drawing tool

The artist has a SOLID tool: drag a box, a wireframe solid fits it, TURN and
TILT aim it, BAKE SPIN turns it into frames. Seventeen solids, plus fourteen
flat sci-fi shapes on the SHAPE tool.

**No new format.** A wireframe projected to 2D IS polylines in a -1..1 box, and
a spin IS `{ fps, frames }`, so a cube flows through the renderer, the animated
SVG reel, the asset collector and LINEWORK's export without any of them
knowing. The maths is `js/dieview.js` generalised.

Four things that were got wrong first and are worth not repeating:

- **A spin must be GENERATED per frame, never tweened.** Interpolating the flat
  points between a cube at 0 degrees and the same cube at 90 squashes it
  through a flat line instead of turning it. A 2D tween cannot know the shape
  was ever three-dimensional. `test/geometry.js` checks no frame of a spin is
  narrower than half the widest, which is what that failure looks like.
- **Orient face normals from the geometry, not the winding order.** Deciding
  visibility from how a face happened to be listed meant every face had to be
  wound consistently by hand, and one that was not — the prism's top cap — was
  culled on every frame and the solid came out with its lid missing. Comparing
  each normal against the direction of its own centre fixes it for any convex
  solid without anybody having to be careful.
- **Culling is wrong for a non-convex solid.** That same centroid trick cannot
  orient a fin standing off the top of a hull, so the ship lost its fin and
  half a wing. Non-convex solids are marked `open: true` and drawn whole.
- **Normalise each solid to radius 1, not to its projected bounding box.**
  Fitting the projection would be tighter and would make a spinning object
  pulse: a cube is wider corner-on than face-on, so every frame would be
  scaled differently and the thing would breathe as it turned.

**Picking and aiming.** The solid SITS on the canvas until you press PLACE IT.
Drag it to turn it, drag a box elsewhere to move and resize it — one surface,
two gestures, told apart by where the drag starts, which is the rule every 3D
viewport has used since they had windows. The first version treated a solid
like a shape (drag a box, get strokes, aim with two sliders), so aiming meant
nudging a slider, looking, nudging it back — on something already committed,
so every attempt cost an undo. The sliders are still there and still exact;
they follow the drag now rather than being the only way in.

The picker shows a **drawing of each solid**, painted by the same projector
that draws the real one. Seventeen text labels asked you to know the difference
between a PRISM and a CRYSTAL before you had seen either. A hand-made icon set
would have been a second opinion about what a PRISM looks like and would have
gone stale the first time one was reshaped — as three were on the day they
landed.

Two things that bit while building it:

- **The thumbnails ran before the tables they read.** Function declarations
  hoist; `var SOLIDS = {…}` does not. As an IIFE where it sat, every button
  came up blank AND the page threw before it finished wiring itself, which
  presented as the *shape* tool being broken. Painted from the bootstrap now.
- **A command must not replace the status line.** `placeSolid` wrote its own
  message over the frame, layer and stroke counts, which is the same
  display-disagrees-with-data failure as always, only in the other direction.
  There is a `note()` that drawPad appends, and every command uses it.

Generated geometry also fails quietly. The suite drags out all 23 shapes and
all 17 solids and checks the numbers — a NaN (which Canvas drops silently, so
the stroke exists and never draws), a point outside the box, an odd-length
path. A picture is not enough either: the data was clean while the dish was
upside down and the turret was reusing a ring it had already consumed, so the
suite renders contact sheets too.

## Watching an animation

`⛶ BIG VIEW` in the FRAMES bar opens a full-screen player: scrub, step, speed,
FIT / BIG / SMALL, and a dark / grid / light ground for judging readability.
Escape closes it, space plays, arrows step.

The side preview panel answers ONE question — does this still read at 40
pixels — and answers it well. It is the wrong place to watch an animation,
because the thing being judged is timing and weight and neither can be judged
at thumbnail size out of the corner of your eye. The big view keeps the three
real sizes along the bottom anyway, so the small answer is not traded away for
the big one.

Three things worth keeping:

- **One play clock, two windows.** `startPlay`/`stopPlay` are shared, so
  opening one while the other runs cannot start a second animation half a
  frame out of step.
- **The fit is measured across ALL frames, never per frame.** A per-frame fit
  rescales each frame to its own extent and the animation pulses — the same
  trap the solids avoid by normalising to a fixed radius rather than to their
  projected box.
- **The real-size row is not rescaled by the fit**, and its strip is tall
  enough for the largest of the three. A cropped "boss" copy is worse than no
  copy: the row exists to answer whether the art reads at a size, and it
  cannot answer that about a picture with its feet cut off.

**A class you use and never define fails silently.** `PLACE IT` and
`⛶ BIG VIEW` were both written with `class="sm go"` and there was no `.go`
rule, so they rendered identical to the six grey buttons beside them — present,
and invisible as an affordance. "Where is make bigger?" was asked of a
screenshot with BIG VIEW in it. Nothing warns about this: CSS drops selectors
it does not recognise and unknown classes are simply inert. When a control is
meant to stand out, assert its computed colour — and assert it on the element
itself, not by comparing with a neighbour, since a neighbour the test just
clicked carries hover and focus styling and the comparison then measures the
mouse.

A testing note that cost half an hour: **sample a playing animation until it
moves, not once after a fixed wait.** Reading the frame counter twice 700ms
apart at 8fps over a 3-frame loop lands on the same frame both times, and
looks exactly like an animation that is not playing.

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

## The layout budget

Three numbers, measured against what the drawing tools everyone else uses
actually do, and now held by `test/ux.js` because every one of them regresses
silently — a panel added later, a bar that grows a row, and the canvas is
quietly smaller again with nothing to say so.

| | before | after |
|---|---|---|
| canvas, desktop | 21% of the screen | 37%, or 48% in focus |
| canvas, laptop | 19% | 27% |
| controls under 24px | 27 of 50 | 0 |
| explanation on screen | 854 characters | 443 |

What the research says, and what it changed here:

- **Procreate** gives the canvas essentially the whole display and nests
  everything else; Photoshop with default panels is around 60%. At 21% this
  was a control panel that happened to have a canvas. Tab hides the panel
  column, Shift+Tab leaves the drawing alone on screen, and both are
  remembered.
- **Corel Painter's** oldest complaint is "busy", "chaotic", stuck in the
  settings before you can start. The answer everyone converges on is
  progressive disclosure: show the eighty percent, keep the rest one clearly
  marked click away. Panels fold, the paragraph explaining each hides behind a
  ? in its own header, and the animation controls tuck themselves away for a
  still drawing — 96px, the biggest thing in the column after the canvas.
- **WCAG 2.2 SC 2.5.8** makes 24x24 CSS pixels Level AA. More than half the
  controls failed it. 26px everywhere now, 40px on a coarse pointer — not 44,
  because at 44 the shape and solid racks push the canvas off a phone, which
  trades one accessibility problem for a worse one.

Four traps met on the way:

- **`.wrap` had `margin: 0 auto` on a flex item**, and an auto cross-axis
  margin makes a flex item size to its CONTENT rather than stretch. The grid
  never spanned the window, its `1fr` column resolved against the canvas
  inside it, and hiding the panels changed the template while the column came
  out the same 967px it had been.
- **Sizing the canvas from its own column is circular.** `.mid`'s height comes
  from its content, which includes the canvas, so it walked itself down by
  seventy pixels on every view change. Measure against `.wrap`, which the
  fixed shell sizes and which does not move.
- **Measure after layout, not during it.** Called inline at boot, the fit read
  a frame strip that had not rendered, came out 72px generous, then corrected
  itself later — which looks like the canvas shrinking on its own.
- **Folding by position folds the wrong things.** Shutting everything but the
  first panel shut the LIVE PREVIEW, and with it the button added the week
  before so BIG VIEW could be found at all — and in the standalone it shut
  SAVE SVG, which is the whole reason that build exists. Which panels open is
  a judgement about what you look at while working.

## Exporting real files

The EXPORT panel writes what the two audiences actually need, and it does it
with no libraries — not for purity, but because LINEWORK is one file you can
email and a CDN script would end that.

    FOR A GAME    sprite sheet + JSON sidecar (Unity, Godot, Phaser, Aseprite)
                  zipped numbered PNG frames
                  SVG, still or self-animating
                  the project .json
    TO SEND       animated GIF, plays everywhere, needs nothing installed
                  MP4/WebM through MediaRecorder, which is what Instagram takes
                  PNG, square / 4:5 post / 9:16 story, transparent or on a ground

The GIF encoder and the zip writer are here in about two hundred lines. Both
are written from their specs, and both have a failure mode that no structural
check can see:

- **A GIF's LZW decoder is always ONE ENTRY BEHIND the encoder** — it cannot
  add the entry a code created until it has read the code after it. So the
  code width grows when `next` has PASSED the limit, not when it reaches it.
  Off by that one, the encoder runs a code ahead of every decoder in the world
  and the file has a perfect header, a perfect frame count, a perfect palette
  and a perfect trailer, and draws nothing. **`test/export.js` round-trips the
  encoder against a decoder written from the spec**, which says WHICH code is
  wrong where the browser only says "blank". I changed this rule to `>=`
  reasoning about it in my head, broke it, and only the round-trip harness
  settled it.
- A zip's entries are stored, not deflated: PNGs are already compressed, so
  deflating again buys a percent and costs an implementation of deflate.

Two browser-testing notes worth keeping:

- **Two `waitForEvent('download')` calls made before one click both resolve on
  the SAME event.** The sprite sheet saves a PNG and a JSON, and the test got
  two copies of the PNG. Collect from `page.on('download')` instead.
- **A page built with `setContent` has an `about:blank` origin, so a `file://`
  image never loads into it** — and a `file://` page that CAN load one taints
  the canvas, so `getImageData` throws. Pass the bytes in as a `data:` URL;
  it is neither.

## Document tabs

Several drawings open at once, one tab each. **What belongs to a tab** is the
whole design: the drawing, the current frame and layer, its own UNDO HISTORY,
and its own zoom and pan. MIRROR, GRID, the tool in your hand and the glow
colour are settings about how you work rather than about a drawing, so they
follow you across — which is what Photoshop does with its tool options.

The tool holds exactly one `doc`, one history stack, one frame index and one
viewport, so a tab is poured into those globals on the way in and poured back
on the way out. One place to get right instead of two thousand lines taught to
say `tabs[active].doc`.

**The whole risk is leakage**, and none of it crashes:

- Undo in one drawing removing a stroke from another, because both share a
  stack.
- A half-finished path following you across and being committed into a drawing
  you never touched. Everything in progress — a stroke, a marquee, a solid
  mid-drag — is dropped at the boundary.
- The status note from the last thing you did reading out over a drawing it
  did not happen in.

`test/tabs.js` checks those seams rather than the buttons.

**The migration is the part that could not be got wrong.** Whatever was in the
old single-document autosave becomes tab one. Shipping without it would have
silently emptied the canvas of anyone who had a drawing open — the one thing a
tool that autosaves must never do. Testing it needs an init script on a page of
its own: writing the old key with `evaluate()` and reloading does not work,
because the reload fires `pagehide`, the tool flushes its empty tab set on the
way out, and the migration then correctly declines to run.

Undo histories are not persisted, only the drawings — Photoshop does not
persist history either, and fifty deep per tab is the difference between a save
that fits in localStorage and one that throws.

**The strip costs 35px of height, and `test/ux.js` caught it** — the laptop
canvas fell to 23% against a 24% floor. Paid for rather than waved through: the
frame strip's heading is hidden while it is tucked, since the row under it
already says "one frame — a still drawing".

## The grid you see is the grid you snap to

A rectangle drawn with GRID on came out with a visibly sloping bottom edge, and
it was not a shaky hand: **the grid that was painted and the grid that was
snapped to were two different grids.** Points went to a fixed 0.02 while the
painted lines stepped with the zoom — 0.2 at the default view — so there were
ten invisible sub-steps between the lines you were aiming at, and the two ends
of one line could land on adjacent ones.

One step now, it is the one that gets drawn, and it is chooseable: 0.2, 0.1,
0.05 or 0.02. Every fifth line is brighter, the way graph paper is ruled,
because a hundred identical lines is a texture rather than something you can
count along. Under three pixels a step, the fine lines are dropped and only the
fifths drawn — at that density they are noise and you are too far out to be
aiming at one.

**ANGLE** locks a straight line to 0/45/90 and rounds its length to a whole
number of steps, so both ends land on the grid AND on the axis. Shift does it
for one line without leaving the toggle on. Even on a shared grid a long line's
ends can land a step apart; this is the only way a rectangle comes out square
by hand.

Two things `test/ux.js` caught in this change within a minute of writing it:
the four step buttons had `min-width: 0` so they could fit four across a 74px
rail, which is simply opting out of the 24px floor — two by two clears it. And
the chosen step was styled `on`, i.e. filled, so it shouted as loudly as the
tool in your hand; a setting gets the quiet outline.

A test note: **detect canvas marks against the BACKGROUND, not an absolute
threshold.** The pad's ground is rgb(10,16,20), so a "brighter than 12" test
counted every pixel in the row as lit and the grid-line count came back as 1
every time. The commonest value in a row is the background by definition.

## Animating a limb without redrawing it

The report: "when animating we are removing some lines and redrawing them in a
different position — I wanna make the arms go up and down." Two additions, and
they only pay off together.

**PIVOT** places a joint. Turning a selection about its own middle is the wrong
motion for a limb: an arm's centre is halfway down it, not at the shoulder, so
the top end swings backwards and the shoulder walks away from the body. Drop a
pivot on the shoulder and the shoulder is the one point that does not move.
The pivot is a world point and it **outlives the selection**, because the whole
use of it is turning the same joint over and over.

**REPEAT** does the last movement again across N new frames. Each frame is a
clone of the whole frame with the transform applied one step further to the
selected strokes only, so the body stays exactly where it is and the arm walks
round the joint. Turns, scales and hand-drags all count as a movement; FLIP
deliberately does not, because repeating it just alternates — a blink, not a
motion, and "each one step further" would be a lie about that button.

**The stroke order is the reason to generate rather than redraw.** TWEEN pairs
strokes BY INDEX. Deleting an arm and drawing it again sends it to the end of
the list, so a hand-redrawn animation tweens a body into an arm. A cloned frame
keeps every index, so it still tweens against its neighbours.

Two things that had to be got right:

- **The transform captures its pivot at the time it is made**, not when REPEAT
  reads it. Move the pivot afterwards and the frames already made should not
  change their minds about where they turned.
- **The pivot and the last movement belong to a drawing, not to the tool.** A
  shoulder is a point in a picture; carried into the next tab it sits in the
  middle of nothing, and a REPEAT there would build frames out of a movement
  made in a drawing you are no longer looking at. Both are dropped in
  `adoptTab`, alongside the stroke in hand and the marquee.

`test/rig.js` asserts the GEOMETRY rather than the buttons, because a rotation
about a pivot has two signatures nothing else can stand in for: the point on
the pivot does not move at all, and every other point keeps its distance from
it. It also checks that the body is byte-identical across all generated frames
and that every frame keeps the same stroke count in the same order.

A test-writing note: **the pad is not square, and the world is stretched to its
aspect**, so the two axes have different scales and "the middle of the arm" is
not a screen fraction that can be guessed. Grabbing it by eye missed the
selection entirely and read as the drag doing nothing. Fit screen-to-world from
points the tool actually drew — their fractions and their exported coordinates
are both known.

## Verifying UI work

`test/combatfit.js` and `test/uifit.js` encode real layout invariants and have
caught genuine regressions repeatedly — an ordinary enemy flipping its health
bar above its head, a readout landing behind the cards. When one fails, the
assertion is usually right and the new layout is usually wrong.

Canvas coordinates are **not** layout coordinates: the canvas is sized by
`getBoundingClientRect` while DOM chrome sits inside a transform-scaled
`#game`. Converting between them needs `canvas.offsetHeight` (see
`R.canvasToLayout`).
