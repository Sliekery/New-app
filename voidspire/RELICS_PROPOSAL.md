# VOIDSPIRE — Relic Rework Proposal (draft for approval)

Goal: relics should feel **scarce, exciting, and build-defining** — fewer of them, each
a real decision, many carrying a **positive + negative** tradeoff you manage with the
existing **toggle / durability / charge** systems. Hold base relics to the same bar the
NG+ *Echoes* already set ("changes HOW you play, never a flat +power forever").

Legend: **[E]** = uses an existing engine hook (cheap to build) · **[N]** = needs a new
engine hook/special · 🔌 togglable · ⏳ durability (`uses`) · 🔋 charges · ⚠ has a downside.

---

## 1. Acquisition redesign (cut the faucet, add choice)

Today relics are auto-granted by **every** elite, beacon, treasure, many events, and shops
→ 15+ per run, zero scarcity. Proposed:

| Source | Now | Proposed |
|---|---|---|
| Treasure node | auto-grant 1 | **pick 1 of 3** |
| Elite | auto-grant 1 | **pick 1 of 2** |
| Beacon | auto-grant 1 | no relic (keeps its colorless-card payoff) |
| Events | several give a relic | ~half as many; still take/skip |
| Shop | 1 for sale | 1 for sale (pricier) |
| Boss | pick 1 of 3 | **pick 1 of 3** (unchanged — this one's good) |

Target: **~5–8 chosen relics per run**, each one an event.

Rarity weighting on drops: Common 55 / Uncommon 30 / Rare 15; Boss pool is separate.

---

## 2. Rarity framework

- **Common** — a clean build nudge. Mostly upside.
- **Uncommon** — a synergy enabler or a small tradeoff.
- **Rare** — a build-defining *engine*; usually a tradeoff. 🔌 often.
- **Boss** — powerful **with a real drawback** (the Sozu/Ectoplasm pattern). 🔌/⏳.
- **Charge / one-shot** — limited but dramatic. 🔋/⏳.
- **Quest** — keep; they already change play via their task.

---

## 3. Proposed roster

### Common (8)
| Relic | Effect | Build |
|---|---|---|
| Power Fist | Start combat with **1 Might**. | [E] |
| Aegis Core | Start combat with **8 Shield**. | [E] |
| Servo Skull | Draw **2 extra** cards on turn 1. | [E] |
| Void Lens | Attacks deal **+2**. | [E] |
| Targeting Visor | Crit on a d20 of **17+**. | [E] |
| Thornmail Husk | Attackers take **3**. | [E] |
| Salvager Rig | **+25% credits** from combat. | [E] |
| Med-Bay Tap | Heal **6 HP** after each combat. | [E] (consolidates the 4 heal relics into one) |

### Uncommon (8)
| Relic | Effect | Build |
|---|---|---|
| Static Capacitor | Gain Shield → deal **2** to a random enemy. | [E] enables shield-spam |
| Hoarfrost Cell | Start combat: **2 Weak** to all enemies. | [E] |
| Reaper Protocol | Kill an enemy → **heal 3**. | [E] |
| Bloodlust Engine | Enemy dies → **+1 Might** (rest of combat). | [E] snowball |
| Omega Visor | Land a crit → **draw a card**. | [E] |
| Neural Lattice | **+1 to your core attribute** (class-aware). | [E] replaces the 3 attribute clones |
| Kindler ⭐NEW | Whenever you apply Burn, apply **+1 more**. | [N] void/burn synergy |
| Pack Harness ⭐NEW | Your summoned pets start with **+3 HP**. | [N] Warpcaller-only |

### Rare (8) — engines & tradeoffs
| Relic | Effect | Build |
|---|---|---|
| Echo Chamber ⭐NEW ⚠ | The **first card you play each turn is played twice** — but you draw **1 fewer** card each turn. | [N] 🔌 |
| Riptide Protocol ⭐NEW | Every **3rd attack each turn deals double**. | [N] |
| Vampiric Array ⭐NEW ⚠ | Attacks **heal you for 20%** of damage dealt — but you **can't gain Shield**. | [N] 🔌 |
| Phase Engine ⭐NEW | End your turn with an **empty hand** → **+2 Energy** next turn. | [N] |
| Munitions Loop ⭐NEW | First time each turn you play **3 attacks**, gain **1 Energy**. | [N] |
| Singularity Engine | Deal **4** to ALL enemies at the start of your turn. | [E] |
| Glass Cannon ⚠ | **+50% damage**, but **−25% Max HP** (permanent). | [E] |
| Berserker's Yoke ⚠ | Attacks deal **+4**, but you take **+20% damage**. | [E] 🔌 |

### Boss (6) — power with a price
| Relic | Effect | Build |
|---|---|---|
| Singularity Core ⭐(reworks Ancient Sigil) ⚠ | **+1 Energy every turn** — but you **can't gain Shield**. | [N] 🔌 |
| Overcharged Reactor ⏳⚠ | **+1 Energy each turn**; burns out after **5 fights**. | [E] ⏳ |
| Dreadnought Plate ⚠ | **+25 Max HP** — but start each combat with **1 Vulnerable**. | [E] |
| Titan Servo ⭐NEW ⚠ | Attacks deal **+6** — but draw **1 fewer** card each turn. | [E] 🔌 |
| Famine Engine ⭐NEW ⚠ | Enemies start each combat at **−20% HP** — but you gain **no credits** from combat. | [N] 🔌 |
| Null Reactor ⭐NEW ⚠ | Start each combat with **+2 Energy** — but lose a **random card** at the start of every turn after the first. | [N] |

### Charge / one-shot (3)
| Relic | Effect | Build |
|---|---|---|
| Failsafe Core ⭐NEW 🔋 | **Once per run**: when you'd die, survive at **1 HP** and wipe enemy intents. | [N] 🔋(1) |
| Overload Cell ⭐NEW 🔋 | **3 charges** — spend one to make your next attack deal **triple**. +1 charge per boss. | [N] 🔋 |
| Phoenix Protocol ⭐NEW 🔋 | **2 charges** — drop below 25% HP → **heal 15** and spend a charge. | [N] 🔋 |

### Quest (keep, lightly retuned) (5)
Offline Shield · Berserker's Pact · Pacifist Doctrine · Flawless Protocol · Soul Ledger.
(War Chest folds into the economy theme; can keep or cut.)

---

## 4. Removed / consolidated
- **Cut clones:** War Sigil, Cogitator Implant, Warp Shard → one **Neural Lattice**.
- **Cut clones:** Medic Drone, Cryo Capsule, Blood Chalice → one **Med-Bay Tap**.
- **Cut redundant energy:** Ancient Sigil reworked into **Singularity Core** (now a tradeoff).
- **Reworked weak passives:** Adrenaline Pump, Nano Mesh, Tactical Uplink — fold into the
  above or drop (Tactical Uplink → could survive as a niche event-check relic).

Net: ~30 active relics + 5 quests, far less overlap, ~15 of them carrying a real downside.

---

## 5. New engine work required (the **[N]** items)
Grouped so we can build incrementally:
- **Triggers:** first-card-doubles, Nth-attack-doubles, lifesteal %, end-turn-empty-hand,
  play-N-attacks counter, on-apply-burn bonus, pet start-HP.
- **Negatives:** can't-gain-Shield, no-combat-credits, enemy start −HP%, random-card-loss
  per turn, vuln-start (already exists).
- **Charges/specials:** survive-lethal (Phylactery echo already does this — reuse),
  banked triple-attack, low-HP auto-heal.

Most ride the existing `art(k)` sum or a small `special` handler, plus the toggle/uses
systems we already shipped.

---

## 6. Open questions for you
1. Roster size OK (~30 + 5 quests), or do you want it tighter/bigger?
2. Keep healing relics at all, or lean fully into aggression/tempo?
3. Want **faction-flavored** boss relics (a different boss pool per enemy faction)?
4. Any specific relic fantasy you want in (e.g. a signature class-defining relic each)?
