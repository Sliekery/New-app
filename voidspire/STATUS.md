# VOIDSPIRE — Working Status (resume notes)

Read this first after a context clear. It captures the *in-flight* threads that
aren't obvious from the code. For the big picture see `README.md` (architecture,
balance targets, dev/test workflow) and `CHECKPOINTS.md` (version history +
frozen play links).

Branch: `claude/sci-fi-roguelike-cards-ycwlxz` · latest checkpoint: **v1.9-classfx**.
Everything is committed and pushed. The game is `voidspire/` (pure HTML/JS, no build).

## Dev workflow quick reference
- Sandbox has `jsdom` + `canvas` installed under `/tmp/domtest/node_modules`
  (set `NODE_PATH=/tmp/domtest/node_modules` for the screenshot/DOM tools).
- Tests: `node test/mechanics.js` (unit), `node test/sim.js 300` (difficulty
  profile vs StS targets), `node test/analyze.js 250` (class/build standings),
  `NODE_PATH=… node test/dom.js` (real-UI playthrough). Art: `test/sheet.js`,
  `test/shot.js`, `test/mapshot.js`, `test/vanguard.js`.
- Single-file bundle rebuild (after any source change) — inline css + the 10 js
  files in this order: balance, cards, artifacts, **augments**, enemies, events,
  engine, render, ui, main → write `voidspire/voidspire.html`. (See README "Single-file build".)
- Checkpoint convention: after a good change, commit, then add a row +
  frozen-link section to `CHECKPOINTS.md`. Frozen play URL pattern:
  `https://rawcdn.githack.com/Sliekery/New-app/<full-sha>/voidspire/voidspire.html`.
- Commit-message footer the harness expects: `https://claude.ai/code/session_01WQLfVV2zR2UzxSndNX7GtG`

## RESOLVED: Vanguard avatar = Void Knight (v2.0-voidknight)
The user picked the Void Knight concept (with a blaster). It is now live in
`CLASS_ART.vanguard` (js/render.js). `test/vanguard.js` still has all the
candidate boards (args 2/3/T/D/X/V) if more iteration is wanted.

## (history) Vanguard avatar pick
The user dislikes the current Vanguard avatar and we're choosing a replacement.
- `test/vanguard.js` renders candidate boards: `node test/vanguard.js out.png`
  (batch 1: designs 1-5), `… 2` (batch 2: 6-10), `… 3` (batch 3: clean
  single-silhouette designs **A-E**, shown beside the real Technomancer & Void
  Adept for scale/quality comparison).
- Current board: `node test/vanguard.js out.png T` renders the two existing
  classes + **10** vanguard candidates A-J in a grid: A Crusader(cape),
  B Guardian(planted), C Spartan(sleek), D Heavy(broad), E Ranger(tabard),
  F Sentinel(standard), G Stormbringer(aggro), H Warden(half-cloak),
  I Reaper(cowl), J Centurion(plume). A-E in `DESIGNS3`, F-J in `MORE`.
- KEY LESSON: the first attempts looked "weird/blocky" because they were built
  from disconnected limb segments. The fix (batch 3) builds each from ONE
  continuous body silhouette + a few detail lines + a clean weapon, matching how
  `CLASS_ART.technomancer` / `.voidadept` are drawn in `js/render.js`.
- TO APPLY the chosen one: copy that design's `p` / `e` / `muzzle` into
  `CLASS_ART.vanguard` in `js/render.js` (keep `color:'#5dff88'`). The muzzle-flash
  FX in `drawPlayerFx()` reads `CLASS_ART.vanguard.muzzle`, so keep that field.
  Then rebuild the bundle + new checkpoint.

## OPEN ISSUES / backlog (flagged, not yet done)
1. **Balance regression from the augment redesign (v1.6).** Difficulty sim shows
   deep-run rate (sector-5+) ~10-12% vs the 15-30% target, and the class gap
   widened: Technomancer avg ~3.5 (best 9-10) vs Vanguard ~2.8 / Void Adept ~2.7.
   Cause: the Augment Draft demoted the flat +1 stat, which the stat-reliant
   classes (Vanguard=MIGHT→dmg, Void=PSI→burn) leaned on; Technomancer is fine
   because its power is in modules. Note the bot also UNDER-drafts augments, so
   human numbers are higher — but the relative Vanguard/Void drop is real.
   Proposed fix: strengthen the scaling/stat augments for those classes (e.g.
   bump common damage augments, guarantee a solid "value" augment per draft of 3)
   in `js/augments.js`, then re-run `node test/sim.js 300` until S5+ is back in band.
2. **Rare combat stalemate.** A pure-defence build (lots of Shield + Phase Lock
   retain) vs a non-escalating enemy can loop forever (~1 in several thousand bot
   runs; sim's loop guard catches it and counts it as a "stall"). Proposed fix:
   an **enrage** — enemies gain +1 Strength per turn after ~turn 12-15. Add a
   knob in `js/balance.js` and apply in the enemy turn in `js/engine.js`.
3. Minor: user noted the Void Adept psi-motes are quite faint — could brighten
   slightly if asked (in `drawPlayerFx` in `js/render.js`).

## Recently shipped (so you don't redo it)
v1.5 quest/reactive relics · v1.6 Augment Protocol level-up draft · v1.7 event
overhaul (visible resources, choice previews, gambles, conditional options,
curse removal, +7 events) · v1.8 Space-Marine Vanguard + grounded/floating
enemies + "no Shield" quest now counts only player-PLAYED shield · v1.9 removed
unit shadows, Vanguard blaster, subtle per-class FX (turret drones, psi motes,
muzzle glow). Difficulty is otherwise in the StS band except issue #1 above.
