# VOIDSPIRE — Working Status (resume notes)

Read this first after a context clear. It captures the *in-flight* threads that
aren't obvious from the code. For the big picture see `README.md` (architecture,
balance targets, dev/test workflow) and `CHECKPOINTS.md` (version history +
frozen play links).

Branch: `claude/sci-fi-roguelike-cards-ycwlxz` · latest checkpoint: **v2.3-recurrence**.

## RESOLVED: The Recurrence (NG+ loop) + Void Echoes (v2.3-recurrence)
Beating THE UNMAKER now offers **ENTER THE RECURRENCE**: a 3-slide narrative
screen → draft 1 of 3 **Void Echoes** → **equip up to `BALANCE.echoes.loadoutSlots`
(3)** → a full-reset fresh loop (deck/relics/augments/stats back to baseline,
Echoes + loop count kept). The world scales `BALANCE.run.loopPower` (0.12) per
loop via `worldPowerMult()` (folded into `scaledHp/scaledDmg`, also reads the
`worldPower` hook for the Unmaker's Tithe echo). `js/echoes.js` holds 11
sideways-by-design Echoes; simple ones use `hook/hooks` summed in `art()` while
EQUIPPED, rule-benders are checked via `E.hasEcho(id)`:
- hooks: hollow_crown (dmgMult+`dmgTakenMult` new), void_battery (energyCarry+drawTurn), unmaker_tithe (worldPower + extra relic in winCombat).
- flags: momentum_engine (`combat.momentum`), doubled_self (turn-1 `times=2` in playCard), hunger_void (heal gate + `healRaw` on kill), salvage_doctrine (no reward cards + `salvageKills` graft), void_touched (chain in `echoKill`), cursed_inheritance (`recurring_curse` card + `handHasCurse()` +25%), phylactery (`phylacteryUsed` revive in hurtPlayer), ascendant_core (+2 core in `resetForLoop`).
Engine: `enterRecurrence / recurrenceContinue / echoOffer / chooseEcho /
prepLoadout / echoToggle / beginLoop / claimVictory`; `E.depth()` =
`(loop-1)*finale + sector`. UI phases: `recurrence-intro / echo-draft /
echo-loadout`; HUD shows `L{n}·S{n}`. **Test harness:** sim/analyze now key off
cumulative **depth** (== sector on loop 1, climbs past the finale), bot drives
the recurrence capped at `MAX_LOOP`. Wave-2 Echoes (deferred): The Long Spiral,
Recurring Nightmare, Severed Memory, Mirror of Was, Probability Collapse.
Everything is committed and pushed. The game is `voidspire/` (pure HTML/JS, no build).

## RESOLVED: Potions & win condition (v2.1-finale)
- **Potions/consumables** — `js/potions.js` (13 items, `fx` list like cards),
  carried in a 3-slot belt (`run.potions`, cap `BALANCE.potions.slots`). Engine:
  `addPotion / usePotion / discardPotion / potionFull / potionNeedsTarget /
  rollPotion`. They drop from fights (`BALANCE.potions.dropChance`, bosses always),
  sell in shops (`shopChance`/`shopCost`), and can be grabbed on the reward screen.
  UI: `#potion-belt` beside the hand → tap a slot → USE/DISCARD menu; targeted
  potions arm a tap-an-enemy mode (`pendingPotion` in ui.js).
- **Win condition** — `BALANCE.run.finale` (=4): the boss of that sector is
  `ns.FINAL_BOSS` ('unmaker', THE UNMAKER, faction-less `color:'#b8ecff'`).
  `winCombat` detects `combat.isFinal` → `run.won=true`, `phase='victory'`.
  `showVictory()` offers `E.continueDescent()` (→ levelup, endless) or
  `E.claimVictory()` (record + end). `recordBest` now stores `won`; title shows
  a victor flourish. `render.factionColor` falls back to `def.color`.
- Build list now has 11 js files (added `potions` after `augments`). Tests cover
  potions + finale (`test/mechanics.js` cases 28-32); `sim.js`/`dom.js`/`sheet.js`
  updated to load potions and tolerate the faction-less boss.

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
1. ~~**Balance regression from the augment redesign (v1.6).**~~ **FIXED in
   v2.2-balance.** Deep-run rate (S5+) is back in band — `node test/sim.js 600`
   now reports ~20% (was ~8%), with sector-1 death 5%, median 3, spike-deaths
   66%, 0 stalls. Per-class (analyze 400/class): Technomancer 3.98 / S5+ 28%,
   Vanguard 3.39 / 16%, Void Adept 3.19 / 13% — all viable (median 3-4, best 11).
   Levers used: softened the late-game enemy quadratic
   (`scaling.hpMul` quad 0.045→0.038, `dmgMul` 0.20→0.18 / 0.030→0.020);
   raised `attrs.mightDmgPerPoint` & `psiDmgPerPoint` 1→1.4 (helps the
   stat-scaling Vanguard/Void, NOT the block-class Technomancer); +3 Void Adept
   base HP; buffed value commons `honed_edge` (+2→+3 dmg) & `armor_weave`
   (+2→+3 Shield); trimmed THE UNMAKER 124→110 HP so the finale is a fair
   capstone. Technomancer is still the structural leader (block/Echo longevity);
   that residual ~0.6-0.8 spread is left as-is rather than risk fractional
   block nerfs that hurt its identity — if revisited, target its block engine
   (`techBlockPerPoint` / Echo) from the top, not the laggards from the bottom.
2. ~~**Rare combat stalemate.**~~ **FIXED — "the count runs out"** (`BALANCE.enrage`).
   Diagnosis first: the stalls were not one bug. A Jammer can burn your last
   attack into exhaust, leaving a Barricade build literally unable to deal
   damage while also unable to die — 2500 Shield vs a 14 HP drone, forever.
   Threshold set from measurement, not taste: over **26,469 simulated fights**
   p99 = 8 turns, p99.9 = 14, bosses p99 = 12, and only **0.05% reach turn 20**.
   So past turn 20 enemies gain +2 Might per turn *and* 34% of your Shield fails
   per turn — both, because Might alone cannot chew an unbounded Barricade pool
   in any number of turns a player would sit through. An offenceless turtle now
   dies at turn ~30 with a loud warning at 20. **0 stalls in 8100 runs** (the old
   rate would have expected ~9), with every difficulty metric unchanged.
   Note: the sim's loop guard was counting *iterations* (card plays), not turns,
   so it was clipping long-but-terminating fights at ~29 turns and reporting
   them as stalls; it counts turns now.
3. Minor: user noted the Void Adept psi-motes are quite faint — could brighten
   slightly if asked (in `drawPlayerFx` in `js/render.js`).

## Recently shipped (so you don't redo it)
v1.5 quest/reactive relics · v1.6 Augment Protocol level-up draft · v1.7 event
overhaul (visible resources, choice previews, gambles, conditional options,
curse removal, +7 events) · v1.8 Space-Marine Vanguard + grounded/floating
enemies + "no Shield" quest now counts only player-PLAYED shield · v1.9 removed
unit shadows, Vanguard blaster, subtle per-class FX (turret drones, psi motes,
muzzle glow). Difficulty is otherwise in the StS band except issue #1 above.
