# VOIDSPIRE — The Augmented Die

**Status:** approved — core slots limited, faces 1/20 engravable, Flaws in. Building.
**Scope:** core system for the whole game. Vanguard is the testing ground.

---

## 1. The pitch

The d20 stops being a hidden damage roll and becomes **the player's second build** — a
physical object you inspect, upgrade and engrave. Relics move *inside* it. Every roll
becomes a small event with your fingerprints on it.

Today a roll resolves and, on most faces, nothing happens. After this, a roll reads:

> **14 → SOLID.** *Overcharge Cell fires: +1 Energy.*

---

## 2. Anatomy of the die

Three layers, all viewed on one screen.

| Layer | Holds | Fires |
|---|---|---|
| **Faces** (1–20) | Face Augments — effects bound to a number | when the roll lands on that face |
| **Core** | Core Modules — always-on passives | continuously |
| **Frame** | Frame Upgrades — modify the die itself | changes how rolling works |

**Faces** are the new content. **Core** is where today's relics live. **Frame** is the
small, precious category that changes the rules of rolling (Aim, reroll, crit band,
extra slots).

---

## 3. Trigger rules

These are the load-bearing decisions.

### 3.1 Effective roll steers the die
```
effective = min(20, natural + Aim)
natural 1 is ALWAYS a misfire — Aim cannot rescue it
```
Augments fire on the **effective** roll, not the raw face.

This is the single most important rule. If augments fired on the raw face they would be
a flat 5% lottery that Aim could not influence, and the two systems would never touch.
On the effective roll, **Aim becomes a steering wheel**: you stack Aim to land on the
faces you have engraved.

### 3.2 Aim is steering, not strictly power
Because `effective` clamps at 20, piling on Aim walks you *past* your low and mid
augments. A player with augments on 6, 9 and 11 actively does **not** want +8 Aim.
This is a feature — it stops Aim being a number that is always good, and makes
"where did I engrave?" and "how much Aim?" one coupled decision.

### 3.3 Every card rolls
Currently only attacks roll. That must change or a skill/power deck never touches the
system. Proposal:

- **Every card play rolls the die.** Augments fire on any card.
- **Damage bands still apply to attacks only** (misfire/graze/hit/solid/crit).

At ~4 cards a turn this means ~4 rolls a turn — the die is constantly alive.

### 3.4 Faces 1 and 20 are engravable — DECIDED
Both keep their built-in behaviour (1 misfires, 20 crits) and an augment fires **in
addition**. This creates two distinct design spaces, and they interact with Aim in
opposite directions:

- **Face 1 is Aim-proof.** A natural 1 always misfires and can never be aimed away, so a
  face-1 augment is a rock-steady 5% trigger no matter how you build. Ideal home for
  redemption effects (Jam Clearance) — the consolation you can always count on.
- **Face 20 is Aim-magnified.** Because the effective roll clamps at 20, every point of
  Aim pushes more rolls onto face 20. A face-20 augment is the natural payoff for an
  Aim-stacking build.

### 3.5 One face, one augment (initially)
Each face holds **1** augment. A Frame Upgrade can later allow a second on a face.
20 faces is deliberately more room than a run can fill; expect 5–8 engraved by the end.

### 3.6 Ranges vs points
Augments declare which faces they occupy:

- **Point augment** — a single face. Fires 5% of rolls, so effects are *chunky*.
- **Band augment** — a contiguous range (e.g. 8–12). Fires more often, so effects are *small*.

Rough maths: at ~4 rolls a turn, a single face fires ~0.2×/turn. A 5-face band fires
~1×/turn. Price the effect accordingly — this is the main balance dial.

---

## 4. Data model

```js
// js/dice.js
ns.AUGMENTS = {
  overcharge_cell: {
    name: 'Overcharge Cell', tier: 1, slot: 'face',
    span: 1,                       // faces occupied when installed
    fx: [{ k: 'energy', v: 1 }],
    desc: 'Gain 1 Energy.',
    art: { p: [...] },             // same vector format as relics
  },
  blood_tithe: {
    name: 'Blood Tithe', tier: 2, slot: 'face', span: 1,
    fx: [{ k: 'hploss', v: 2 }, { k: 'status', s: 'str', v: 1, who: 'self' }],
    desc: 'Lose 2 HP. Gain 1 Might.',
  },
};

// run state
E.run.die = {
  faces: { 10: 'overcharge_cell', 12: 'blood_tithe' },   // face -> augment id
  core:  ['aegis_core', 'war_sigil'],                     // always-on modules
  frame: ['targeting_visor'],                             // die-behaviour upgrades
};
```

Augment `fx` reuses the **existing card effect vocabulary** (`dmg`, `block`, `energy`,
`draw`, `heal`, `hploss`, `status`, `special`). That means `applyCardFx` already
resolves them — no second effect engine, and every existing effect is available to
augment content on day one.

---

## 5. Starter augment set (~14, enough for a slice)

| Augment | Tier | Effect | Notes |
|---|---|---|---|
| Overcharge Cell | 1 | +1 Energy | the canonical example |
| Munition Feed | 1 | Draw 1 | |
| Repair Nanites | 1 | Heal 3 | |
| Kinetic Buffer | 1 | Gain 5 Shield | |
| Blood Tithe | 2 | −2 HP, +1 Might | your example; risk you opted into |
| Targeting Spike | 1 | Apply 2 Vulnerable | needs a target |
| Ignition Coil | 1 | Apply 3 Burn | |
| Static Discharge | 1 | 4 damage to a random enemy | |
| Scavenger Port | 1 | +6 credits | econ face |
| Momentum Tap | 2 | +2 Momentum | Vanguard flavour |
| Aim Assist | 2 | +1 Aim (this combat) | compounding, deliberately mid-band |
| Executioner's Mark | 3 | Double damage if target under 30% | point augment, high face |
| Second Chance | 3 | Reroll this die once per combat | slot on a low face |
| Jam Clearance | 2 | *(face 1 only)* gain 2 Momentum and 1 Energy | redeems the misfire |

---

## 6. Relic migration — all 49

I catalogued every relic. **The honest finding: 45 of 49 are always-on passives**
(`blockStart`, `energyEveryTurn`, `flatDmg`, `drawStart`, `healAfterCombat`…). Only 3
naturally become face triggers. So this is mostly a **change of address, not a
redesign**: relics become Core Modules, and the face content is largely *new*.

Rewriting all 45 passives as 5%-of-the-time face triggers would gut them — "Start each
combat with 8 Shield" becoming "…5% of the time" is not the same relic. I recommend
against it, and the table reflects that.

### 6.1 Becomes a FACE augment (3)
| Relic | Now | Becomes |
|---|---|---|
| Misfire Capacitor | nat 1 → +1 Energy | **face 1** augment — already a face augment in all but name |
| Omega Visor | crit → draw | **face 20** augment |
| Adrenaline Pump | +1 Energy turn 1 | generic **Overcharge Cell** face augment |

### 6.2 Becomes a FRAME upgrade (1)
| Relic | Now | Becomes |
|---|---|---|
| Targeting Visor | crit on 18+ | **Frame: Widened Crit Band** |

### 6.3 Becomes a CORE module (45)
Same effect, mounted in the die core instead of the relic bar.

**Stat & economy:** War Sigil (+1 MIGHT), Cogitator Implant (+1 TECH), Warp Shard
(+1 PSI), Dreadnought Plate (+22 Max HP), Salvager Rig (+25% credits), Tactical Uplink
(+3 event checks).

**Combat-start:** Aegis Core (8 Shield), Forge Reserve (3× TECH Shield), Power Fist
(1 Might), Hoarfrost Cell (2 Weak to all), Servo Skull (draw 2 turn 1).

**Per-turn:** Ancient Sigil (+1 Energy), Nano Mesh (2 Shield), Medic Drone (1 HP),
Singularity Engine (4 dmg to all), Overflow Reactor (Energy carries), Overcharged
Reactor (+1 Energy, 5 fights).

**Triggered passives:** Reaper Protocol (heal on kill), Bloodlust Engine (Might on
kill), Static Capacitor / Capacitive Plating (Shield → damage), Reclaimer Unit
(reshuffle → Shield), Resonance Coil (first Power draws), Void Conduit (first Power
free), Hexweaver (Weak/Vuln → Burn), Execution Protocol (execute under 25%),
Thornmail Husk (thorns).

**Tradeoff modules:** Berserker's Yoke, Recoilless Frame, Vampiric Array, Glass Cannon,
Famine Engine, Singularity Core. *(Keep their star-chart toggle.)*

**Sustain / misc:** Blood Chalice, Cryo Capsule, Void Lens.

**Warpcaller-only:** Blood Bond, Brood Womb.

**Quest-unlocked** (unlock condition unchanged, then mounts as Core): Berserker's Pact,
Pacifist Doctrine, War Chest, Flawless Protocol, Offline Shield, Soul Ledger.

**Cornerstone:** Hexheart becomes **the Heart of the Die** — a dedicated cornerstone
socket that survives the Recurrence and forges each loop. Thematically the best fit in
the whole list.

### 6.4 Core slots — DECIDED: limited
Relics today are unlimited and all stack. The die core is **limited**, which turns every
pickup into a decision instead of an accumulation.

- **Slots start at 3, +1 after each sector boss, hard cap 6.**
- Unmounted modules go to the **vault** — kept, not lost.
- **Swap freely at rest nodes and on the star chart.** The star chart already has
  enable/disable for tradeoff relics (Berserker's Yoke, Recoilless Frame, Singularity
  Core), so the interaction pattern exists; this generalises it.
- Consequence to watch: this is a real nerf to late-run power. Expect to hand some of it
  back — likely via slightly stronger modules and the face layer — and re-check parity.

---

## 7. The inspection screen

Reached from the HUD where relics live today.

```
┌──────────────────────────────────────────────┐
│  THE DIE                            AIM +2   │
│                                              │
│    1  ▣ Jam Clearance      11  ·             │
│    2  ·                    12  ▣ Blood Tithe │
│    3  ·                    13  ·             │
│    4  ·                    14  ▣ Overcharge  │
│    5  ·                    15  ·             │
│    6  ▣ Static Discharge   16  ·             │
│    7  ·                    17  ·             │
│    8  ·                    18  ·             │
│    9  ·                    19  ·             │
│   10  ·                    20  ▣ Omega Visor │
│                                              │
│  ── shaded band = where +2 Aim lands you ──  │
│                                              │
│  CORE   ◈ Aegis Core  ◈ War Sigil  ◈ ...     │
│  FRAME  ◆ Widened Crit Band                  │
└──────────────────────────────────────────────┘
```

Requirements:
- Two columns of 20 faces, each showing its augment glyph + name, empty faces dimmed.
- **The Aim band is shaded** — you can see at a glance which faces you actually hit.
  This is what makes the "where do I engrave?" decision legible.
- Tap a face → detail panel (full text, tier, option to remove if a mechanic allows).
- Core and Frame rows underneath, reusing the existing relic art and tooltips.
- Reuse the vector-art pipeline; augments carry the same `art` polyline format.

**In-combat readability:** the die already names its band. When an augment fires, it
announces itself — augment name floater + a pulse on the die. Without this the system
is invisible mid-fight, which was exactly the failure of the last pass.

---

## 7a. Flaws — the downside axis (DECIDED: yes)

Enemies and events can **engrave a Flaw** onto a face: a negative augment you did not
choose. This gives the die a downside axis and a reason to fear certain enemies.

- A Flaw **occupies its face**, so it also denies you that engraving slot.
- Effects use the same `fx` vocabulary: `hploss`, losing Shield, an enemy gaining Might,
  a card costing more next turn.
- **Removal** is a service: shops and forge nodes grind a Flaw out for credits; some
  events offer it as a reward.
- Sources fit what already exists — the Void Shard corrupts cards and the Voidling
  infects the deck today, so a warp-etcher enemy engraving the die is in keeping.

**The reason this decision is strong:** Flaws interact with Aim in a way relics never
could. A Flaw on face 6 can be *steered around* by raising Aim until you rarely roll
there. So a curse does not simply tax you — it **pressures your build**, and digging
yourself out by re-aiming is a genuine, legible decision. A Flaw parked on face 20 is
the nastiest of all, because the very Aim you have invested in is what keeps feeding it.

Starter Flaws:

| Flaw | Effect |
|---|---|
| Hairline Fracture | Lose 2 HP |
| Cold Solder | Lose 3 Shield |
| Fouled Primer | The next card you play this turn costs 1 more |
| Warp Etching | A random enemy gains 1 Might |

---

## 8. Acquisition

Augments replace relic drops 1:1, so run pacing is unchanged.

- **Elite / boss rewards** — choose 1 of 2 augments, then **choose the face**.
- **Events** — "a tech-priest offers to engrave your die." Natural fit for your idea.
- **Shops** — buy augments; pay to *move* an installed augment to another face.
- **Forge nodes** — upgrade an augment's tier in place.

Choosing the face at install time is the decision that makes this better than relics.

### 7b. Three readings of one d20 — BUILT

The Vanguard shipped first as the testing ground. Copying his damage bands onto
the other two would have been a restat, not a design, so each class instead gets
its own answer to the one question the die actually asks:

> **What does a BAD roll mean?**

A 20 always crits and the top of every table is the same. The bottom is where
they part ways.

| | VANGUARD — *Marksmanship* | TECHNOMANCER — *Load Balance* | VOIDADEPT — *The Hunger* |
|---|---|---|---|
| Shape | rising ramp, tight | rising ramp, **wide** | **a U** |
| 20 | CRIT ×2.0 | CRIT ×2.0 | CRIT ×2.0 |
| high | SOLID ×1.25 | SURGE ×1.35 | ATTUNED ×1.2 |
| middle | HIT ×1.0 | NOMINAL ×1.0 | **WHISPER ×0.9** |
| low | GRAZE ×0.8 | SAG ×0.7 | **HUNGER ×1.2, −1 HP** |
| natural 1 | MISFIRE ×0.5 | BREAKER ×0.6, **+1 Energy** | RAVENOUS ×1.5, **−4 HP** |
| scales | damage | **damage AND Shield** | damage |
| starting Aim | **+2** (base +1, marksman +1) | +1 | +1 |
| a bad roll is | wasted | **converted to tempo** | **converted to power, billed in blood** |

What each one buys:

- **The Vanguard steers.** He is the only class with extra Aim, and Aim is
  unambiguously good for him — every step up his table is an improvement.
- **The Technomancer swings.** The widest spread of the three, and it is the only
  table that scales *Shield*, so the die decides defensive turns as well as
  offensive ones — his read of the face fires on most of his deck rather than
  only on attacks. He gets no extra Aim; his answer to variance is redundancy,
  and a tripped breaker is never dead because it dumps its charge back as Energy.
- **The Voidadept is hungry.** His curve is a U: WHISPER, the single most common
  outcome at 35%, is his *worst*, and both extremes pay. The bottom bills him in
  HP through the same `spendLife` path his cards use, so **the blood engines
  drink from a bad roll**. That makes Aim a genuine trade for him alone — climb
  the table and you starve the band your build feeds on. Nothing else in the game
  makes a stat you want into a stat you must think about.

The Warpcaller has no table by design; he still rolls, so engravings and roll
riders fire, but the face does not modulate his cards.

Supporting work:

- `onRoll` gained a **`max`** form (fires on a LOW effective roll) — the bottom of
  the table needed riders as much as the top. Mirror-symmetric with `min`: a
  natural 20 always counts as high, a natural 1 always counts as low.
- Four filler cards were reworked in place to speak to their table: **Recompile**
  (a sag grants Aim — the machine recalibrates, and it is the Technomancer's only
  route to Aim), **Surge Protocol** (a high face refunds Energy), **Hemorrhage**
  (a hungry face pays back Psi), **Spectral Grasp** (grips harder at *both* ends
  and lets go in the middle).
- Four engravings joined the pool: **Coolant Bleed**, **Psi Bloom**, and two more
  face-1 anchors — **Earthing Strap** (Technomancer) and **Blood Sigil**
  (Voidadept) — alongside the Vanguard's Jam Clearance. All three are `onlyFace: 1`
  and therefore mutually exclusive: the anchor you cut is a statement about your die.
- The HUD colours rolls by **tone** (derived from the multiplier), never by band
  name, so a new class table styles itself. A Voidadept RAVENOUS reads green on
  the die (it hit hard) with a red −4 HP floater beside it (and it cost you).
- The die settles on any card the face modulated, not on attacks only, because
  the Technomancer's shield turns have to announce themselves.

Measured: 1600-run sims put class parity spread at **5.3 pts** (target ≤ 8) with
aggregate win rate unmoved. Both new tables were A/B'd in isolation against
themselves disabled — the Hunger came in within noise, Load Balance up ~3 pts on
a class that sat at the bottom of the ladder.

---

### 8.1 The bench — BUILT

Every shop carries a bench, opened from the shop screen and presented on the die screen
itself, so you are looking at the faces you are buying into. Three services:

| Service | Price | Limit |
|---|---|---|
| Buy an engraving | ¢70 / ¢105 / ¢150 by tier | 2 in stock per shop |
| **Grind out a Flaw** | ¢50, **+¢25 per grind this run** | once per shop |
| **Reseat** an engraving | ¢30 | once per shop |

Rules the implementation settles:

- **You pay on placement, not on purchase.** You pick the item, then tap a face; the
  charge lands when the cut succeeds. So you can never buy something that will not fit.
- The case never stocks a **face-locked** augment whose one face is already taken.
- **Reseating is the cheap answer to a Flaw, grinding is the certain one.** Because
  augments fire on the *effective* roll, moving a Flaw below your Aim floor means it
  never fires again — for ¢30 rather than ¢50-and-rising. That only works while your
  Aim is high enough to have a floor, which is exactly the tension we wanted: Aim is a
  build commitment that quietly doubles as insurance.
- The grinder's price **rises per use in a run**, so a scarred die stays a real problem
  rather than a credit-denominated inconvenience.
- A band augment that will not fit at the new seat is refused and put back *exactly*
  where it was, and the reseat is not consumed.
- Everything scales with `pressureMods().shopCost`, so SINGULARITY gouges the bench too.

Deliberately **not** built: selling or scrapping your own augments. A face you engraved
is a commitment; the jig lets you move it, not undo it.

---

## 9. Balance model

- Expected value per roll = `Σ P(face) × value(face)`. Uniform 5% per face.
- At ~4 rolls/turn: a point augment fires ~0.2×/turn; a 5-wide band ~1×/turn.
- Budget a tier-1 point augment at roughly **5× a tier-1 per-turn relic effect**, since
  it fires ~1/5 as often.
- Aim interacts multiplicatively — validate that a maxed-Aim build stacking top-face
  augments is not degenerate. Cap Aim or add diminishing returns if the sim says so.
- Regression targets: class parity spread ≤ 8 pts; no archetype ceiling above ~35%.

---

## 10. Build stages

1. **Engine** — `dice.js` data model, roll-to-face resolution, augment `fx` via
   `applyCardFx`, roll on every card play.
2. **Content** — the ~14 starter augments.
3. **UI** — the inspection screen; augment-fired floaters.
4. **Acquisition** — reward/event/shop hooks with face selection.
5. **Migration** — relics → Core/Frame; keep ids so saves and quests survive.
6. **Balance** — sim sweep, tune, re-check parity.

Stages 1–3 are the playable slice.

---

## 11. Open questions

**Resolved:**
1. ~~Core slots~~ → **limited**: 3 slots, +1 per sector boss, cap 6, vault + free swap
   at rest/star chart. See §6.4.
2. ~~Faces 1 and 20~~ → **engravable**, keeping misfire/crit on top. See §3.4.
3. ~~Curses~~ → **yes**, Flaws are in. See §7a.

**Deferred — revisit later, not being built now:**
4. ~~Removing augments~~ — deferred. Engravings are permanent for now.
5. ~~Slot growth pacing~~ — deferred. +1 per boss stands until play says otherwise.

**Still open:**
6. **All classes at once, or Vanguard-gated first?** The system is class-agnostic; only
   the *content* need be Vanguard-flavoured initially.

---

## 12. Implementation notes (things the build changed)

**A natural 1 always lands on face 1.** §3.4 claims face 1 is the Aim-proof anchor, but
the first implementation resolved the face from the effective roll — so with the
Vanguard's baseline Aim of 1, `eff = min(20, 1+1) = 2` and **face 1 was unreachable**,
making Jam Clearance dead content. The engine now pins a natural 1 to face 1 regardless
of Aim, which is what the design intended.

**Reach, precisely.** With Aim *A* you land on `{1}` (via a natural 1) plus
`{min(20, 2+A) … 20}`. The inspection screen dims everything outside that set, which is
what makes "raising Aim strands my low faces" legible at a glance rather than a hidden
rule.
