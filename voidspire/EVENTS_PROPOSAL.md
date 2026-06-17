# VOIDSPIRE — Event System Revamp Proposal

Goal: bring the **old events** up to the bar set by the four new ones
(Asteroid Trade Hub, Relic Broker, Distress Beacon, Refueling Station).
More interaction, more risk, **less free stuff**, real decisions —
space-themed throughout.

This is a **menu to trim**. Cut, merge, or downgrade anything. Nothing here
is coded yet. Per-event entries give the *mechanic* + a one-line fiction hook;
final flavor text comes at implementation.

---

## 1. The bar (every event must clear at least one)

An event earns its slot if it has **at least one** of:

1. **A real decision** — mutually-exclusive options where the road not taken
   actually costs you (you can't grab everything).
2. **Risk you opt into knowingly** — commit-blind, push-your-luck, or a check
   where *failure actually hurts* (not "nothing happens").
3. **Trade / math** — give something to get something (card, relic, HP, credits,
   a curse, a deck slot).
4. **A build-changing choice** — void-touch, a permanent mutation, a follower,
   a once-per-run payoff.

What's **banned**: a no-strings "click → free credits / free card / free heal"
branch sitting next to the risky ones (it makes the risk pointless).

---

## 2. Interaction toolkit

### Already built (free to use)
- `check` — d20 + attr vs DC (now with real fail consequences)
- `gamble` — commit-blind weighted outcomes
- `cost` — pay credits up front
- `cond` — gated "blue" options: `hasCurse`, `hasRelic`, `minCards`, `credits`, `attr`, `hasArtifact`
- `tradeCard` — scrap a card → forge one a rarity tier higher
- `tradeRelic` — surrender a relic → choose 1 of 2 unknowns
- `pick` — remove / upgrade / dupe / **vtouch** (void-touch)
- `removeCurse`
- mutually-exclusive single-service (the Refuel pattern)

### Proposed new (engine work — greenlight or cut each)
- **`pressLuck`** ⭐ *(biggest, most reusable)* — a press-your-luck loop: each
  "push" adds escalating reward and raises a bust chance; "bank & leave" any
  time; busting forfeits the accrued pot and deals a consequence. Powers the
  moon/asteroid cache fantasy. Reused by **3–4** events below.
- **`stake`** — a gamble that wagers something *other than credits* (a card, HP,
  or taking a curse) for a shot at a bigger prize.
- **`sell`** — convert one of your cards/relics **into** credits (inverse trade;
  a real "do I cash this out?" decision).
- **`follower`** *(optional, can fake with "a strong card" for v1)* — an ally that
  rides along as a passive or a unique card.
- **`reveal`** *(optional)* — a check that *unlocks/improves* a follow-up choice
  instead of resolving immediately (true "scan, then decide").

My recommendation: build **`pressLuck`** and **`sell`** now (high reuse, cheap),
fake **`follower`** as a card for v1, defer **`reveal`** and **`stake`** unless
you love them.

---

## 3. Keep as-is (already at the bar)

These five already embody the new design — I'd leave them untouched:

- **Distress Beacon**, **Asteroid Trade Hub**, **Relic Broker**, **Refueling
  Station** (the new four)
- **Stranded Drifter** (already escape-pod friend/foe with a ruthless-salvage curse)
- **Void Forge** (already void-touch-a-card)
- **The Warm Dark / Void Egg** (relic+curse tradeoff, gated alternatives)
- **Black-Market Broker** (gamble crate + curse-offload + haggle)
- **Stellar Convulsion / Supernova** (skim gamble vs. tech-harvest risk)

---

## 4. Per-event rewrites

Grouped by setting. **Bold** = the core new hook. "Cut?" flags merge/removal candidates.

### Derelicts & wrecks

| Event | Today (problem) | Proposed rewrite | Primitives |
|---|---|---|---|
| **Derelict Cryopod** | hack→relic / pry→¢ / leave. One-and-done. | **Commit-blind thaw**: crack the seal blind → a fleet relic, a living ally (card/follower), or a parasite (curse + damage). A TECH "slow-thaw" converts the gamble into a known, lesser-but-safe reward. | gamble + check (+follower) |
| **Salvage Drone** | buy colorless ¢40 / strip(tech)→colorless. | **Barter**: it wants a card it values — **scrap one to receive off-doctrine tech a tier up**; or pay ¢; or strip it by force (MIGHT/TECH) and it retaliates (combat debuff/curse on fail). | tradeCard + check |
| **Wounded Marine** | stabilize(−8hp)→card / **take rig (+40 free)** / honor(psi). | **Moral commit**: burn stims (HP) to save her → she joins as a **follower/strong card**; OR loot her rig now → credits **but a guilt curse**; OR a PSI rite for an attr. Free rig deleted. | hp/card/curse (+follower) |
| **Smuggler Cache** | disarm(tech)→¢+card / **grab loose (+25 free)**. | **Press-your-luck disarm**: cut tamper-wires one at a time, each adds loot, each raises the slag chance (damage + forfeit pot). Bank & run anytime. | **pressLuck** |
| **Abandoned Depot** | **two free cards** + strip(tech)→¢. | **Booby-trapped & monitored**: the ordnance is live → commit-blind (strong card, or it cooks off for damage); the med-locker trips an alarm → take it but start the next fight Weak, or disarm (TECH). | gamble + check |

### Stations & traders

| Event | Today (problem) | Proposed rewrite | Primitives |
|---|---|---|---|
| **Rogue AI Terminal** | optimize(tech)→upgrade / **directions (+30 free)** / unplug. | **It bargains for data**: feed it a card to "study" → get a better one back (trade); "let it optimize" upgrades a card but installs a backdoor (curse) unless you pass TECH. Free directions deleted. | tradeCard + pick + check |
| **The Rogue Trader** | buy relic ¢65 / buy ordnance ¢30 / **war stories (+20 free)**. | **Trade vessel, not a handout**: buy with credits; **haggle (PSI) to cut prices**; and **`sell` a card/relic for credits** (cash out an asset). Free chatter deleted. | cost + sell + check + tradeRelic |
| **Forge-Shrine** | commission ¢40→card / tune(tech)→upgrade. | **A forge needs material**: **feed it a card to forge a stronger one** (perfect thematic fit), or pay, or tune (TECH, fail = damage). | tradeCard + cost + pick |
| **Freelance Gunhand** | pay ¢40→rare / armwrestle(might)→card / decline. *(decent)* | Light touch: the arm-wrestle becomes a **wager** — stake credits; win → card + pot, lose → lose stake + HP. | gamble/check |
| **The Salt Circle** | purge curse(¢25) / talk(psi)→psi / keep. *(decent)* | Light touch: **press-your-luck cleansing** — purge curses one at a time, each cheaper, each with a rising chance the whispers seed a *new* curse. | **pressLuck** |

### Anomalies & the void

| Event | Today (problem) | Proposed rewrite | Primitives |
|---|---|---|---|
| **The Caged Thing** | speak(psi)→psi / **sell (+60 free)** / free(−7hp→relic). | **A living prize**: "sell to the broker" → it breaks loose mid-deal (commit-blind: credits, or a fight/curse); "commune" (PSI) → attr or a unique card; "free it" → relic at HP cost (done). The +60 free is the single worst branch — gone. | gamble + check + hp |
| **Temporal Shear** | dupe (free) / remove (free) / leave. **Zero risk.** | **Causality bites**: dupe a card → the copy returns **Ethereal/Void-Touched**, or also spawns a time-curse, unless a TECH check stabilizes it. Make at least one path risky. | pick + check |
| **Altar of the Void** | blood(−12hp)→rare / commune(psi) / smash(might)→relic. *(decent)* | Light touch: **"choose your price"** — escalating reward for escalating sacrifice (HP < a card < a curse), so the offering is a *scaling* decision, not three fixed buttons. | hp/pick/curse |

### Stellar & hazard

| Event | Today (problem) | Proposed rewrite | Primitives |
|---|---|---|---|
| **Vein of Starmetal** | bore(might)→¢ / rig(tech)→¢. Stat-check→cash, flat. | **Press-your-luck mining**: drill deeper for escalating ore; each level raises the cave-in chance (damage / rockfall / forfeit). The canonical asteroid-cache mini-game. | **pressLuck** |
| **Abandoned Gene-Lab** | inject(psi)→maxhp / synth(tech)→heal / **torch (+20 free)**. | **Unlabeled augment = commit-blind**: inject blind → good mutation (maxhp/attr) or bad (curse / maxhp loss / damage); a TECH "analyze first" improves the odds. Torch deleted or made pure opportunity-cost. | gamble + check |
| **Chapel of the Burnt Star** | **rest → free 30% heal** / confess(remove) / candles(¢+curse). | **Sanctuary with a price**: respite costs a *tithe* (credits) or **leaving a card on the altar** (you choose what to give up); confession removes a curse; greed (candles) → a curse. No free heal (rest nodes already do that). | cost/pick/removeCurse/curse |
| **Probability Engine** | feed ¢25 (gamble) / feed ¢60 (gamble). **Redundant w/ Sabacc.** | **Cut or repurpose.** It's a second money-slot-machine. Option A: delete. Option B: re-theme to **`stake`** — wager a *card / HP / a curse* (not credits) for a relic shot, so it's distinct from the Sabacc Den. | **stake** *(or cut)* |

---

## 5. Engine work, if you greenlight everything

| Primitive | Used by | Effort | Recommend |
|---|---|---|---|
| `pressLuck` | Smuggler Cache, Salt Circle, Vein of Starmetal (+future moon caches) | Medium (one reusable loop + UI) | **Build** |
| `sell` | Rogue Trader (+future) | Small | **Build** |
| `follower` | Cryopod, Wounded Marine | Medium | Fake as "strong card" for v1 |
| `stake` | Probability Engine | Small–Med | Optional |
| `reveal` (scan-then-decide) | Cryopod, Gene-Lab, Depot | Medium | Defer |

Everything else reuses primitives that already exist.

---

## 6. Net effect on the count & economy

- Today: 27 events. This rewrites ~17, keeps ~9, and flags **Probability Engine**
  for cut/merge → likely **~26**, all clearing the bar.
- Every former free-reward branch gains a cost, a risk, or a trade — which should
  push the bot's "free relics/cards from events" numbers down further from the
  0.95 / 0.98 we just measured, without starving the *interesting* rewards.

---

## 7. Decisions I need from you

1. **Trim the list** — cross out any rewrite you don't want, or any "keep" you'd
   rather I also touch.
2. **Probability Engine** — cut it, or repurpose via `stake`?
3. **New primitives** — greenlight `pressLuck` + `sell` (my rec)? Build `follower`
   real, or fake it as a card for now? Want `stake` / `reveal` at all?
4. **Phasing** — do all ~17 in one pass, or a first batch (e.g. the 8 with free
   branches + the press-your-luck trio) so you can react before I do the rest?
