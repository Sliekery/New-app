# VOIDSPIRE — The Augmented Die

**Status:** design proposal, awaiting approval. No implementation yet.
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

### 3.4 One face, one augment (initially)
Each face holds **1** augment. A Frame Upgrade can later allow a second on a face.
20 faces is deliberately more room than a run can fill; expect 5–8 engraved by the end.

### 3.5 Ranges vs points
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

### 6.4 Open decision — core slots
Relics today are **unlimited and all stack**. Two options:

- **(a) Unlimited core** — pure relocation. Zero balance risk, but the core screen is
  just a list and there is no decision.
- **(b) Limited core slots (~4–6)** — creates a real "which do I mount?" choice and
  makes each pickup interesting, but it is a significant nerf to accumulation and needs
  a full balance pass.

I lean **(a) for the slice, revisit (b) later** — get the faces feeling good before
touching relic accumulation.

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

## 8. Acquisition

Augments replace relic drops 1:1, so run pacing is unchanged.

- **Elite / boss rewards** — choose 1 of 2 augments, then **choose the face**.
- **Events** — "a tech-priest offers to engrave your die." Natural fit for your idea.
- **Shops** — buy augments; pay to *move* an installed augment to another face.
- **Forge nodes** — upgrade an augment's tier in place.

Choosing the face at install time is the decision that makes this better than relics.

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

1. **Core slots** — unlimited (a) or limited (b)? See §6.4. *(Recommend a for now.)*
2. **Removing augments** — free, paid at shops, or permanent once engraved?
3. **Face 1 and 20** — reserved for misfire/crit, or fully engravable?
   *(Recommend engravable, with the misfire/crit behaviour kept on top.)*
4. **All classes at once, or Vanguard-gated first?** The system is class-agnostic; only
   the *content* need be Vanguard-flavoured initially.
5. **Curses** — should enemies or events be able to engrave a *bad* face on you? Strong
   flavour, and it gives the die a downside axis.
