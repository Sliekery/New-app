# VOIDSPIRE — Codex

_Auto-generated from the game data (`node test/cardsdoc.js`). Effect text is exactly what the game shows; numbers are the base values **before** any MIGHT/TECH/PSI scaling._

**201 cards · 3 classes.** Jump to: [The Die](#the-die) · [Classes](#the-classes) · [Keywords](#keywords) · [Vanguard cards](#vanguard) · [Technomancer cards](#technomancer) · [Void Adept cards](#void-adept) · [Neutral (any class) cards](#neutral-any-class) · [Curses cards](#curses)


---

## The Die

Every attack rolls a d20. All three classes roll the same die and **read it differently** — that table is the class identity more than the cards are.

| Roll | Vanguard — MARKSMANSHIP | Technomancer — LOAD BALANCE | Void Adept — THE HUNGER |
| --- | --- | --- | --- |
| **15+** | SOLID ×1.25 | SURGE ×1.35 | ATTUNED ×1.2 |
| **8+** | HIT ×1 | NOMINAL ×1 | WHISPER ×0.9 |
| **2+** | GRAZE ×0.8 | SAG ×0.7 | HUNGER ×1.2 _(−1 HP)_ |
| **nat 1** | MISFIRE ×0.5 | BREAKER ×0.6 _(+1 Energy)_ | RAVENOUS ×1.5 _(−4 HP)_ |

The Vanguard's is a **ramp**, and he is the only class with Aim, so he can climb it. The Technomancer's is the **widest spread** and he cannot steer at all — his answer is redundancy, and a tripped breaker refunds Energy rather than being dead. The Void Adept's is a **U**: the bottom of his die hits harder than the middle and bills him in HP, so his most common outcome is his worst one.


---

## The Classes


---

### VANGUARD — _Shock trooper of the 9th Voidborne_

> High HP. Brutal weapons that scale with MIGHT. Hits first, asks never.

**80 HP · MIGHT 2 · 66 cards**  
Opening deck: 5× Pulse Rifle, 4× Combat Shield, 1× Bayonet Charge

**MARKSMANSHIP** — _A low face grazes and a natural 1 goes wide. Aim climbs the table._

| Roll | Band | Damage |
| --- | --- | --- |
| 15+ | SOLID | ×1.25 |
| 8+ | HIT | ×1 |
| 2+ | GRAZE | ×0.8 |
| nat 1 | MISFIRE | ×0.5 |

**Openings.** One is cut into the die before the first jump — a statement of which part of the table you are building for.

- **THE LONG SHOT** — _HIGH FACES · 15–20_. You cut it near the top of the table, where the shot is already going.  
  Cuts _Ranging Mark_: Gain 1 Aim. Draw 1 card. Adds **Sighting Round** to the deck.
- **THE RED DEBT** — _LOW FACES · 2–7_. A bad face is still a face. You give the bottom of the die something to do.  
  Cuts _Whetstone Mark_: Deal 3 damage. Gain 3 Might. Adds **Red Ledger** to the deck.
- **THE SET SHIELD** — _MIDDLE FACES · 8–14_. You cut it where the die spends most of its time, and stop trying to steer.  
  Cuts _Anvil Mark_: Gain 5 Shield, 1 Thorns. Adds **Set Against It** to the deck.

**Archetypes.**

| Build | Cards | Reads |
| --- | --- | --- |
| **Marksman**<br>_opens THE LONG SHOT_ | 10 | Aim is added to every attack roll, so he is the only class that can climb his own die table. Crit payoffs sit on top of it. |
| **Momentum** | 3 | Every attack makes the next one bigger, and it all resets at end of turn — so the payoff is one long turn, not a long fight. |
| **Blood engine** | 3 | Wounds you inflict on yourself feed your Might. The cards that cost HP stop being a price and start being the engine. |
| **Exhaust / Salvo** | 10 | Burning a card through Exhaust is itself the effect — shrapnel, Shield or a fresh draw every time one goes. |
| **Counter-punch**<br>_opens THE SET SHIELD_ | 7 | Parry absorbs like Shield but hits back, and it scales with Might — defence that is not a wasted turn. |

**Class-locked relics.**

- **Breaching Rounds** — Your attacks apply 1 Vulnerable.
- **Warlord Doctrine** — Start each combat with 3 Might.
- **Ash Reliquary** — Start each combat with 2 Salvo — burning a card spits shrapnel at a random enemy.
- **Iron Leech** — Start each combat with 2 Blood Rage — your own wounds feed your Might.
- **Cycling Breech** — Your Momentum no longer resets at the start of your turn.
- **Recoilless Frame** — Your attacks deal +5 — but you may play at most 1 non-attack card per turn. Toggle it off on the star chart when you need to set up.
- **Execution Protocol** — Your attacks deal double damage to enemies below 25% HP.


---

### TECHNOMANCER — _Machine-priest of the Forge Choir_

> Shields, turrets and reactors that scale with TECH. Out-build the enemy.

**68 HP · TECH 2 · 59 cards**  
Opening deck: 4× Pulse Rifle, 5× Combat Shield, 1× Overshield

**LOAD BALANCE** — _The band scales Shield as well as damage. A tripped breaker dumps its charge back as Energy._

| Roll | Band | Damage |
| --- | --- | --- |
| 15+ | SURGE | ×1.35 |
| 8+ | NOMINAL | ×1 |
| 2+ | SAG | ×0.7 |
| nat 1 | BREAKER | ×0.6 _(+1 Energy)_ |

**Openings.** One is cut into the die before the first jump — a statement of which part of the table you are building for.

- **THE STANDING LINE** — _ANYWHERE · THE MACHINE DOES NOT AIM_. Something should be working while you are not. You give it a place to stand.  
  Cuts _Assembly Mark_: Deploy a Turret (3 dmg/turn). Adds **Assembly Line** to the deck.
- **THE CLOSED CIRCUIT** — _ANYWHERE · IT ALL COMES BACK TO THE BUS_. Nothing is wasted if the charge has somewhere to go. You give it somewhere.  
  Cuts _Bus Tap_: Gain 1 Energy. Draw 1 card. Adds **Surge Routing** to the deck.
- **THE DAMPING FIELD** — _MIDDLE FACES · 8–14_. You cut it flat across the middle, where a machine lives, and let it hum.  
  Cuts _Damping Mark_: Gain 5 Shield. Apply 1 Weak to ALL enemies. Adds **Null Lattice** to the deck.

**Archetypes.**

| Build | Cards | Reads |
| --- | --- | --- |
| **Constructs**<br>_opens THE STANDING LINE_ | 10 | Turrets and drone swarms fire at the end of every turn whether you did anything or not. Something works while you do not. |
| **Reactor**<br>_opens THE CLOSED CIRCUIT_ | 4 | Energy economy. He cannot steer his die, so he builds a bus that makes every roll pay for something. |
| **Conduit control**<br>_opens THE DAMPING FIELD_ | 13 | He carries more Weak and Vulnerable than anyone. Conduit turns each application into damage, so control IS the damage. |
| **Bulwark** | 8 | His die band scales Shield as well as damage, which is why the defensive turn still reads on the roll. |
| **Powers** | 5 | Powers are permanent for the fight; Subroutine draws off each one, so the setup turns pay themselves back. |

**Class-locked relics.**

- **Targeting Matrix** — Whenever you land a critical hit, gain 1 Might.
- **Disruptor Field** — Whenever you gain Shield, apply 1 Weak to a random enemy.
- **Echo Protocol** — The first Attack you play each turn is played twice.
- **Foundry Spine** — Start each combat with a Turret (3 dmg/turn).
- **Forge Reserve** — Start each combat with Shield equal to 3× your TECH.
- **Capacitive Plating** — Whenever you gain Shield, deal 1 damage per 3 Shield gained to a random enemy.


---

### VOID ADEPT — _Sanctioned psyker, mostly stable_

> Burns, hexes and psionic blasts that scale with PSI. The void answers.

**80 HP · PSI 2 · 56 cards**  
Opening deck: 2× Pulse Rifle, 4× Combat Shield, 4× Mind Spike

**THE HUNGER** — _The bottom of the die hits HARDER than the middle — and bills you in HP._

| Roll | Band | Damage |
| --- | --- | --- |
| 15+ | ATTUNED | ×1.2 |
| 8+ | WHISPER | ×0.9 |
| 2+ | HUNGER | ×1.2 _(−1 HP)_ |
| nat 1 | RAVENOUS | ×1.5 _(−4 HP)_ |

**Openings.** One is cut into the die before the first jump — a statement of which part of the table you are building for.

- **THE FIRST EMBER** — _LOW FACES · 2–7_. You cut it low, in the part of the table that is already hungry.  
  Cuts _Ember Mark_: Apply 5 Burn. Adds **Kindling** to the deck.
- **THE OPEN VEIN** — _EITHER END · 2–7 OR 15–20_. The void answers at both ends. You only decide which end it bills.  
  Cuts _Vein Mark_: Lose 2 HP. Deal 16 damage. Adds **Red Thread** to the deck.
- **THE LONG WHISPER** — _MIDDLE FACES · 8–14_. You cut it through the middle, where the void gets bored, and give it a reason.  
  Cuts _Whisper Mark_: Gain 2 Psi Focus. Apply 2 Vulnerable. Adds **Long Whisper** to the deck.

**Archetypes.**

| Build | Cards | Reads |
| --- | --- | --- |
| **Burn**<br>_opens THE FIRST EMBER_ | 12 | Burn normally halves each turn. Wildfire makes it GROW and spread instead, which turns a slow fight into his best case. |
| **Psi ramp**<br>_opens THE LONG WHISPER_ | 9 | Psi Focus compounds. It is the payoff for surviving the middle of the die, where he is weakest. |
| **Blood Pact**<br>_opens THE OPEN VEIN_ | 3 | Spending HP grants Psi Focus — and the bottom of his die already bills him in HP, so a bad roll feeds the engine. |
| **Plague** | 14 | Hexes stacked across the whole encounter, so the damage arrives from every direction at once rather than from a card. |

**Class-locked relics.**

- **Hexheart** — Cornerstone. Survives the Recurrence and forges stronger each loop you clear: +PSI, amplifies your first Burn, and at higher tiers steels you with starting Shield.
- **Soul Pyre** — Your attacks also apply 1 Burn.
- **Entropy Doctrine** — Enemy Burn grows each turn, and all enemies start Weak.
- **Resonance Node** — Start each combat with 2 Psi Focus.
- **Hexweaver** — Whenever you apply Weak or Vulnerable to an enemy, also apply 2 Burn.
- **Void Conduit** — The first Power you play each combat costs 0.


---

## Keywords

_Every status and mechanic the cards below refer to (67)._

- **Shield** — Absorbs incoming damage. Expires at the start of your next turn unless stated otherwise.
- **Plated Armor** — At the start of your turn, gain Shield equal to your Plated Armor, then lose 1 of it.
- **Plating** — Gain Shield at the start of each turn.
- **Barricade** — Your Shield no longer expires at the start of your turn.
- **Phase Lock** — Your Shield no longer expires.
- **Vulnerable** — The unit takes 50% more attack damage. Ticks down 1 each turn.
- **Weak** — The unit deals 25% less attack damage. Ticks down 1 each turn.
- **Burn** — At the end of the turn the burning unit takes damage equal to its Burn, then it halves.
- **Might** — Increases the damage of your attacks by its value.
- **Psi Focus** — Increases the damage of your Psi attacks.
- **Energy** — Spent to play cards. Refills at the start of your turn.
- **Exhaust** — When played, this card is removed for the rest of combat.
- **Retain** — This card stays in your hand at the end of turn instead of being discarded.
- **Regen** — Heal HP equal to its value at the start of your turn. Ticks down.
- **Thorns** — When an enemy attacks you, it takes damage equal to your Thorns.
- **Echo** — The first Attack you play each turn is played twice.
- **Momentum** — Your attacks deal +1 damage for each Momentum. Resets each turn.
- **Parry** — Absorbs damage like Shield; each blow you parry strikes the attacker back (scales with Might).
- **Riposte** — Whenever you gain Shield, deal damage equal to your Riposte to a random enemy.
- **Salvo** — Whenever you Exhaust a card, deal damage equal to your Salvo to a random enemy.
- **Quartermaster** — At the start of each turn, return that many random exhausted Attacks to your hand.
- **Full Auto** — Whenever you play an Attack, gain Momentum.
- **Blood Rage** — Whenever you lose HP to your own cards, gain Might.
- **Blood Pact** — Whenever you lose HP to your own cards, gain Psi Focus.
- **Vengeance** — After you take a hit or parry a blow, your next Attack heals you.
- **Entropy** — At the end of your turn, apply Burn to ALL enemies.
- **Wildfire** — Burn no longer fades — at the end of the turn it GROWS by your Wildfire and spreads to another enemy.
- **Ascendant** — Gain that much Psi Focus at the start of each turn.
- **Detonate** — Consume all of the target's Burn to deal a burst of damage, splashing fresh Burn to another enemy.
- **Hive** — Every Turret and Drone Swarm you control fires one extra time each turn per stack.
- **Conduit** — Whenever you apply Weak or Vulnerable to an enemy, it also takes that much damage.
- **Ember Ward** — Whenever an enemy attacks you, it gains that much Burn (even through your Shield).
- **Static Ward** — Whenever an enemy attacks you, it gains that much Weak (even through your Shield).
- **Spiked Bulwark** — Whenever an enemy attacks you, it takes damage equal to your Might plus this value.
- **Demolition** — Whenever you Exhaust a card, deal that much damage to ALL enemies.
- **Subroutine** — Whenever you play a Power, draw a card.
- **Swarm Uplink** — Whenever one of your constructs fires, gain that much Shield.
- **Aim** — Added to the d20 you roll for every attack — it makes crits and roll thresholds far more likely.
- **Steady Aim** — Gain that much Aim at the start of each turn.
- **Killing Rage** — Whenever an attack crits, gain that much Might.
- **Deadeye** — Whenever an attack crits, draw that many cards.
- **Misfire Protocol** — When an attack misfires (a natural 1), gain that much Momentum and 1 Energy.
- **Misfire** — A natural 1 on the die — the shot goes wide and deals half damage.
- **Crit** — Roll + Aim meeting the crit mark (a natural 20 always crits) doubles the damage.
- **Reactor** — Gain +1 Energy at the start of each turn per stack.
- **Warlord** — Gain Might at the start of each turn.
- **Resolve** — Whenever a card is Exhausted, gain Shield.
- **Salvage** — Whenever a card is Exhausted, draw a card.
- **Blade Array** — Whenever you play a card, deal damage to ALL enemies.
- **Mirror Field** — Whenever you play a card, gain Shield.
- **Contagion** — Whenever you apply Burn, also apply Burn to ALL enemies.
- **Corruption** — Skills cost 0 this combat, but Exhaust when played.
- **Turret** — A deployed unit that attacks a random enemy for its damage at the end of each of your turns.
- **Drone Swarm** — A deployed unit that hits ALL enemies for its damage each turn.
- **Siphon** — Heal for half of the damage this card deals.
- **Scry** — Look at that many cards from the top of your draw pile and discard any number of them.
- **Discover** — Choose one of 3 random cards and add it to your hand.
- **Primed** — Counts down at the end of each of your turns, then detonates.
- **Pack Fury** — Your pets deal extra damage with their actions.
- **Bloodscent** — Your pets deal extra damage, and +1 more for every pet that dies.
- **Bulwark** — At the start of each turn, your front pet gains Block.
- **Savage Feast** — Whenever one of your pets attacks, you heal.
- **Symbiosis** — Whenever a pet dies, gain Shield and draw a card.
- **Brood** — At the start of each turn, summon a Spawnling.
- **Kennel** — Adds formation slots (room for more or bigger pets).
- **Spawnling** — A fragile pet that bursts for damage when it dies.
- **Void-Touched** — Lose 3 HP each time this card is played, but its effect is boosted.


---

## The Cards


---

### Vanguard

_Shock trooper — MIGHT weapons & raw aggression. (66 cards)_


#### Starter

- **Bayonet Charge**  — Attack · ⚡1  _(starting card)_
    - Base: Deal 6 damage. Apply 1 Vulnerable.
    - Upgraded: Deal 8 damage. Apply 2 Vulnerable.

#### Common

- **Breaching Charge**  — Attack · ⚡1  _(Exhaust)_
    - Base: Deal 11 damage. Roll 16+: Draw 1 card. Exhaust.
    - Upgraded: Deal 15 damage. Roll 14+: Draw 1 card. Exhaust.
- **Bulwark Stance**  — Skill · ⚡1
    - Base: Then gain Shield equal to twice your Might.
    - Upgraded: _(no change)_
- **Burst Fire**  — Attack · ⚡1
    - Base: Deal 3 damage 2 times. Roll 15+: Deal 3 damage.
    - Upgraded: Deal 3 damage 3 times. Roll 13+: Deal 3 damage.
- **Counterstrike**  — Attack · ⚡1
    - Base: Deal 4 damage. Gain 4 Parry.
    - Upgraded: Deal 6 damage. Gain 5 Parry.
- **Covering Fire**  — Skill · ⚡1
    - Base: Gain 6 Shield. Apply 1 Weak to ALL enemies.
    - Upgraded: Gain 9 Shield. Apply 2 Weak to ALL enemies.
- **Crimson Pact**  — Attack · ⚡0
    - Base: Lose 3 HP. Deal 6 damage.
    - Upgraded: Lose 2 HP. Deal 8 damage.
- **Deflect**  — Skill · ⚡1
    - Base: Gain 8 Parry.
    - Upgraded: Gain 11 Parry.
- **Field Strip**  — Skill · ⚡0  _(Exhaust)_
    - Base: Draw 2 cards. Exhaust.
    - Upgraded: Draw 3 cards. Exhaust.
- **Follow Through**  — Attack · ⚡1
    - Base: Deal 1 more damage per Momentum.
    - Upgraded: Deal 2 more damage per Momentum.
- **Frag Grenade**  — Attack · ⚡1
    - Base: ALL enemies: 4 damage, 1 Vulnerable.
    - Upgraded: ALL enemies: 6 damage, 2 Vulnerable.
- **Hair Trigger**  — Attack · ⚡0
    - Base: Deal 4 damage. Roll 13+: Gain 1 Energy.
    - Upgraded: Deal 6 damage. Roll 11+: Gain 1 Energy.
- **Raking Fire**  — Attack · ⚡1
    - Base: Deal 6 damage, and 3 to every other enemy.
    - Upgraded: Deal 8 damage, and 5 to every other enemy.
- **Rapid Fire**  — Attack · ⚡0
    - Base: Deal 3 damage. Gain 1 Momentum.
    - Upgraded: Deal 4 damage. Gain 1 Momentum.
- **Reckless Charge**  — Attack · ⚡0  _(Exhaust)_
    - Base: Deal 7 damage. Exhaust.
    - Upgraded: Deal 10 damage. Exhaust.
- **Riot Shield**  — Skill · ⚡1
    - Base: Gain 6 Shield, 3 Thorns.
    - Upgraded: Gain 9 Shield, 4 Thorns.
- **Shield Bash**  — Attack · ⚡1
    - Base: Deal 6 damage. Gain 4 Shield. Roll 13+: Gain 4 Shield.
    - Upgraded: Deal 8 damage. Gain 6 Shield. Roll 11+: Gain 5 Shield.
- **Take Aim**  — Skill · ⚡0
    - Base: Gain 2 Aim.
    - Upgraded: Gain 3 Aim.
- **Trigger Discipline**  — Skill · ⚡1
    - Base: Draw 2 cards. Gain 1 Momentum.
    - Upgraded: Draw 2 cards. Gain 2 Momentum.
- **War Cry**  — Skill · ⚡1
    - Base: Gain 2 Might. Draw 1 card.
    - Upgraded: Gain 3 Might. Draw 1 card.

#### Uncommon

- **Adrenal Surge**  — Skill · ⚡0  _(Exhaust)_
    - Base: Gain 2 Energy. Lose 2 HP. Exhaust.
    - Upgraded: Gain 2 Energy. Exhaust.
- **Breach**  — Attack · ⚡1
    - Base: Deal 5 damage for each Vulnerable, Weak, and Burn on the target.
    - Upgraded: Deal 8 damage for each Vulnerable, Weak, and Burn on the target.
- **Bulwark**  — Skill · ⚡2
    - Base: Gain 12 Shield. Draw 1 card.
    - Upgraded: Gain 16 Shield. Draw 1 card.
- **Bunker Down**  — Skill · ⚡2
    - Base: Gain 8 Shield, 3 Plated Armor.
    - Upgraded: Gain 12 Shield, 4 Plated Armor.
- **Cluster Charge**  — Attack · ⚡1  _(Exhaust)_
    - Base: Deal 5 damage to ALL enemies. Exhaust.
    - Upgraded: Deal 7 damage to ALL enemies. Exhaust.
- **Combat Stims**  — Power · ⚡1
    - Base: Gain 3 Might. Lose 3 HP.
    - Upgraded: Gain 4 Might. Lose 2 HP.
- **Executioner Round**  — Attack · ⚡2
    - Base: Doubled if the target is below 30% HP.
    - Upgraded: Deal 14 damage. Doubled if the target is below 30% HP.
- **Hail of Lead**  — Attack · ⚡1
    - Base: Each hit also scales with Momentum.
    - Upgraded: Deal 3 damage 3 times. Each hit also scales with Momentum.
- **Heavy Ordnance**  — Attack · ⚡2
    - Base: MIGHT counts three times.
    - Upgraded: Deal 12 damage. MIGHT counts three times.
- **Iron Resolve**  — Power · ⚡1
    - Base: Gain 4 Resolve.
    - Upgraded: Gain 5 Resolve.
- **Limit Break**  — Skill · ⚡1 → 0  _(Exhaust)_
    - Base: Double your Might.
    - Upgraded: _(no change)_
- **Marksman Round**  — Attack · ⚡1
    - Base: Deal 6 damage. Roll 14+: Apply 2 Vulnerable. Draw 1 card.
    - Upgraded: Deal 8 damage. Roll 12+: Apply 2 Vulnerable. Draw 1 card.
- **Misfire Protocol**  — Power · ⚡1
    - Base: When an attack misfires, gain 3 Momentum and 1 Energy.
    - Upgraded: When an attack misfires, gain 5 Momentum and 1 Energy.
- **Munitions Dump**  — Skill · ⚡1  _(Exhaust)_
    - Base: Gain 2 Energy. Draw 1 card. Exhaust.
    - Upgraded: Gain 2 Energy. Draw 2 cards. Exhaust.
- **Reaping Volley**  — Attack · ⚡1
    - Base: Deal 5 damage to ALL enemies. Siphon.
    - Upgraded: Deal 7 damage to ALL enemies. Siphon.
- **Red Ledger**  — Power · ⚡1
    - Base: Lose 3 HP. Gain 2 Might, 2 Blood Rage.
    - Upgraded: Lose 3 HP. Gain 3 Might, 3 Blood Rage.
- **Reload**  — Skill · ⚡1 → 0
    - Base: Return a random exhausted Attack to your hand.
    - Upgraded: _(no change)_
- **Ricochet**  — Attack · ⚡1
    - Base: Deal 6 damage. Roll 14+: Deal 6 damage to ALL enemies.
    - Upgraded: Deal 8 damage. Roll 12+: Deal 8 damage to ALL enemies.
- **Set Against It**  — Power · ⚡1
    - Base: Gain 2 Thorns, 2 Plating.
    - Upgraded: Gain 4 Thorns, 3 Plating.
- **Shield Slam**  — Attack · ⚡1
    - Base: Deal damage equal to your Shield.
    - Upgraded: Deal damage equal to 150% of your Shield.
- **Sighting Round**  — Attack · ⚡0  _(Retain)_
    - Base: Deal 4 damage. Gain 1 Aim. Retain.
    - Upgraded: Deal 6 damage. Gain 1 Aim. Retain.
- **Spiked Bulwark**  — Skill · ⚡1
    - Base: This combat, attackers take your Might + 3 damage.
    - Upgraded: This combat, attackers take your Might + 5 damage.
- **Steady Aim**  — Power · ⚡1
    - Base: Gain 1 more Aim at the start of each turn.
    - Upgraded: Gain 2 more Aim at the start of each turn.
- **Unload**  — Attack · ⚡2
    - Base: Deal 2 more damage per Momentum.
    - Upgraded: Deal 3 more damage per Momentum.
- **Vengeance**  — Power · ⚡1
    - Base: Gain 4 Vengeance.
    - Upgraded: Gain 6 Vengeance.
- **Whet the Blade**  — Skill · ⚡0
    - Base: Lose 2 HP. Gain 2 Might.
    - Upgraded: Lose 1 HP. Gain 2 Might.
- **Whirlwind**  — Attack · ⚡X
    - Base: Deal 5 damage to ALL enemies, X times (X = current Energy).
    - Upgraded: Deal 8 damage to ALL enemies, X times (X = current Energy).

#### Rare

- **Barricade Protocol**  — Power · ⚡2 → 1
    - Base: Gain Barricade.
    - Upgraded: _(no change)_
- **Berserker Engine**  — Power · ⚡2
    - Base: Gain 1 Blood Rage, 2 Resolve.
    - Upgraded: Gain 2 Blood Rage, 2 Resolve.
- **Blood Rage**  — Power · ⚡1
    - Base: Gain 1 Blood Rage.
    - Upgraded: Gain 2 Blood Rage.
- **Bloodbath**  — Attack · ⚡2
    - Base: Deal 5× your Might as damage. Siphon.
    - Upgraded: Deal 6× your Might as damage. Siphon.
- **Bloodlust**  — Power · ⚡1
    - Base: Gain 1 Reactor. Lose 6 HP.
    - Upgraded: Gain 1 Reactor. Lose 3 HP.
- **Deadeye Protocol**  — Power · ⚡2
    - Base: Gain 2 Killing Rage, 1 Deadeye.
    - Upgraded: Gain 3 Killing Rage, 1 Deadeye.
- **Demolition Train**  — Power · ⚡2
    - Base: Whenever you Exhaust a card, deal 4 damage to ALL enemies.
    - Upgraded: Whenever you Exhaust a card, deal 6 damage to ALL enemies.
- **Frenzy**  — Attack · ⚡2
    - Base: Deal 3 damage 3 times.
    - Upgraded: Deal 3 damage 4 times.
- **Full Auto**  — Power · ⚡1
    - Base: Gain 1 Full Auto.
    - Upgraded: Gain 2 Full Auto.
- **Killshot**  — Attack · ⚡2
    - Base: Consume all your Aim. Deal 6 damage plus 4 for each Aim consumed.
    - Upgraded: Consume all your Aim. Deal 8 damage plus 5 for each Aim consumed.
- **One in the Chamber**  — Attack · ⚡1  _(Exhaust)_
    - Base: Roll 8+: Deal 24 damage. Exhaust.
    - Upgraded: Roll 6+: Deal 30 damage. Exhaust.
- **Orbital Strike**  — Attack · ⚡3
    - Base: ALL enemies: 16 damage, 2 Vulnerable.
    - Upgraded: ALL enemies: 22 damage, 3 Vulnerable.
- **Overrun**  — Attack · ⚡2
    - Base: Deal 4 more damage per Momentum.
    - Upgraded: Deal 5 more damage per Momentum.
- **Quartermaster**  — Power · ⚡1
    - Base: Gain 1 Quartermaster.
    - Upgraded: Gain 2 Quartermaster.
- **Riposte Protocol**  — Power · ⚡2
    - Base: Gain 3 Riposte.
    - Upgraded: Gain 5 Riposte.
- **Salvo**  — Power · ⚡1
    - Base: Gain 4 Salvo.
    - Upgraded: Gain 6 Salvo.
- **Scorched Earth**  — Attack · ⚡2  _(Exhaust)_
    - Base: Exhaust your hand. Deal 6 damage per card Exhausted.
    - Upgraded: Exhaust your hand. Deal 9 damage per card Exhausted.
- **Warlord Protocol**  — Power · ⚡2 → 1
    - Base: Gain 1 Warlord.
    - Upgraded: _(no change)_

#### Legendary

- **Orbital Bombardment**  — Attack · ⚡3  _(boss reward only)_
    - Base: ALL enemies: 12 damage, 2 Vulnerable.
    - Upgraded: ALL enemies: 16 damage, 3 Vulnerable.

---

### Technomancer

_Machine-priest — TECH shields, turrets & reactors. (59 cards)_


#### Starter

- **Overshield**  — Skill · ⚡1  _(starting card)_
    - Base: Gain 4 Shield. Draw 1 card.
    - Upgraded: Gain 7 Shield. Draw 1 card.

#### Common

- **Arc Welder**  — Attack · ⚡1
    - Base: Deal 7 damage. Gain 4 Shield.
    - Upgraded: Deal 10 damage. Gain 6 Shield.
- **Bootstrap**  — Power · ⚡0
    - Base: Draw 1 card.
    - Upgraded: Draw 2 cards.
- **Brace Plate**  — Skill · ⚡1
    - Base: Gain 4 Shield, 2 Plating.
    - Upgraded: Gain 6 Shield, 3 Plating.
- **Disruptor Pulse**  — Attack · ⚡1
    - Base: Deal 4 damage. Apply 1 Weak.
    - Upgraded: Deal 6 damage. Apply 2 Weak.
- **EMP Mine**  — Attack · ⚡0  _(Exhaust)_
    - Base: ALL enemies: 3 damage, 1 Weak. Exhaust.
    - Upgraded: ALL enemies: 4 damage, 1 Weak. Exhaust.
- **Feedback Loop**  — Skill · ⚡1
    - Base: Apply 2 Vulnerable. Draw 1 card.
    - Upgraded: Apply 3 Vulnerable. Draw 1 card.
- **Fortify Matrix**  — Skill · ⚡1
    - Base: Gain 8 Shield.
    - Upgraded: Gain 11 Shield.
- **Hold the Line**  — Skill · ⚡1  _(Retain)_
    - Base: Gain 7 Shield. Retain.
    - Upgraded: Gain 10 Shield. Retain.
- **Live Wire**  — Attack · ⚡1
    - Base: Deal 6 damage. Draw 1 card.
    - Upgraded: Deal 8 damage. Draw 1 card.
- **Overclock**  — Skill · ⚡0
    - Base: Draw 2 cards. Lose 2 HP.
    - Upgraded: Draw 2 cards. Lose 1 HP.
- **Recompile**  — Skill · ⚡0
    - Base: Gain 1 Energy. Draw 1 card. Roll 7 or less: Gain 1 Aim.
    - Upgraded: Gain 1 Energy. Draw 2 cards. Roll 9 or less: Gain 1 Aim.
- **Repair Bay**  — Skill · ⚡1  _(Exhaust)_
    - Base: Heal 4 HP. Gain 6 Shield if a Turret or Drone is out.
    - Upgraded: Heal 7 HP. Gain 9 Shield if a Turret or Drone is out.
- **Salvage Servitor**  — Attack · ⚡1
    - Base: Deal 5 damage. Deploy a Turret (1 dmg/turn).
    - Upgraded: Deal 7 damage. Deploy a Turret (2 dmg/turn).
- **Targeting Uplink**  — Skill · ⚡1
    - Base: Deploy a Turret (2 dmg/turn). Draw 1 card.
    - Upgraded: Deploy a Turret (3 dmg/turn). Draw 1 card.

#### Uncommon

- **Assault Drone**  — Power · ⚡1
    - Base: Deploy a Drone Swarm (2 to all/turn).
    - Upgraded: Deploy a Drone Swarm (3 to all/turn).
- **Assembly Line**  — Power · ⚡1
    - Base: Deploy a Turret (2 dmg/turn). Gain 1 Hive.
    - Upgraded: Deploy a Turret (3 dmg/turn). Gain 1 Hive.
- **Brownout**  — Attack · ⚡1
    - Base: Deal 9 damage. Roll 6 or less: Gain 2 Energy.
    - Upgraded: Deal 12 damage. Roll 7 or less: Gain 2 Energy.
- **Capacitor Discharge**  — Attack · ⚡1
    - Base: Deal 6 damage. Gain 1 Energy.
    - Upgraded: Deal 9 damage. Gain 1 Energy.
- **Chain Lightning**  — Attack · ⚡2
    - Base: Deal 4 damage to random enemies 3 times.
    - Upgraded: Deal 6 damage to random enemies 3 times.
- **Cogwork Surge**  — Skill · ⚡1
    - Base: Gain 3 Shield for each Power you have played this combat.
    - Upgraded: Gain 5 Shield for each Power you have played this combat.
- **Deploy Turret**  — Power · ⚡1
    - Base: Deploy a Turret (4 dmg/turn).
    - Upgraded: Deploy a Turret (6 dmg/turn).
- **EMP Blast**  — Attack · ⚡2
    - Base: ALL enemies: 7 damage, 1 Weak.
    - Upgraded: ALL enemies: 10 damage, 2 Weak.
- **Entrench Field**  — Skill · ⚡2 → 1
    - Base: Double your Shield.
    - Upgraded: _(no change)_
- **Fortified Strike**  — Attack · ⚡1
    - Base: Deal 5 damage. Gain 9 Shield.
    - Upgraded: Deal 7 damage. Gain 12 Shield.
- **Kinetic Discharge**  — Attack · ⚡1
    - Base: Deal damage equal to your Shield.
    - Upgraded: Deal damage equal to 150% of your Shield.
- **Leech Coil**  — Attack · ⚡1
    - Base: Gain Shield equal to damage dealt.
    - Upgraded: Deal 8 damage. Gain Shield equal to damage dealt.
- **Mains Surge**  — Skill · ⚡1
    - Base: Gain 7 Shield. Roll 15+: Double your Shield.
    - Upgraded: Gain 9 Shield. Roll 13+: Double your Shield.
- **Munitions Factory**  — Power · ⚡1
    - Base: Deploy a Turret (2 dmg/turn). Deploy a Drone Swarm (2 to all/turn).
    - Upgraded: Deploy a Turret (3 dmg/turn). Deploy a Drone Swarm (3 to all/turn).
- **Munitions Link**  — Power · ⚡1
    - Base: Whenever one of your constructs fires, gain 1 Shield.
    - Upgraded: Whenever one of your constructs fires, gain 2 Shield.
- **Null Lattice**  — Power · ⚡1
    - Base: Gain 1 Conduit, 2 Plating.
    - Upgraded: Gain 2 Conduit, 2 Plating.
- **Overcharged Capacitor**  — Attack · ⚡1
    - Base: Doubles under Echo.
    - Upgraded: Deal 6 damage 2 times. Doubles under Echo.
- **Overload Capacitor**  — Power · ⚡1
    - Base: Gain 1 Mirror Field.
    - Upgraded: Gain 2 Mirror Field.
- **Overload Surge**  — Attack · ⚡2
    - Base: Deal 6 damage. Apply 2 Weak, 2 Vulnerable.
    - Upgraded: Deal 9 damage. Apply 3 Weak, 3 Vulnerable.
- **Railgun**  — Attack · ⚡2
    - Base: Deal 13 damage. Apply 2 Vulnerable.
    - Upgraded: Deal 17 damage. Apply 2 Vulnerable.
- **Reinforced Hull**  — Power · ⚡1
    - Base: Gain 3 Plated Armor.
    - Upgraded: Gain 4 Plated Armor.
- **Sentry Protocol**  — Power · ⚡1
    - Base: Deploy a Turret (3 dmg/turn). Gain 2 Plating.
    - Upgraded: Deploy a Turret (4 dmg/turn). Gain 3 Plating.
- **Shield Battery**  — Power · ⚡1
    - Base: Gain 4 Plating.
    - Upgraded: Gain 6 Plating.
- **Short Circuit**  — Attack · ⚡1
    - Base: Deal 5 damage. Apply 2 Vulnerable.
    - Upgraded: Deal 7 damage. Apply 3 Vulnerable.
- **Static Field**  — Skill · ⚡1
    - Base: Apply 2 Weak to ALL enemies. Gain 4 Shield.
    - Upgraded: Apply 2 Weak to ALL enemies. Gain 7 Shield.
- **Static Lance**  — Attack · ⚡2
    - Base: Deal 8 damage. Apply 2 Weak.
    - Upgraded: Deal 11 damage. Apply 3 Weak.
- **Static Ward**  — Skill · ⚡1
    - Base: This combat, enemies that attack you gain 2 Weak.
    - Upgraded: Gain 9 Shield. This combat, enemies that attack you gain 2 Weak.
- **Surge Protocol**  — Skill · ⚡1
    - Base: Gain 1 Energy. Draw 2 cards. Roll 15+: Gain 1 Energy.
    - Upgraded: Gain 2 Energy. Draw 2 cards. Roll 13+: Gain 1 Energy.
- **Surge Routing**  — Power · ⚡1
    - Base: Whenever you play a Power, draw a card.
    - Upgraded: Whenever you play a Power, draw 2 cards.
- **System Shock**  — Skill · ⚡1
    - Base: ALL enemies: 1 Weak, 1 Vulnerable.
    - Upgraded: ALL enemies: 2 Weak, 1 Vulnerable.

#### Rare

- **Aegis Matrix**  — Power · ⚡2 → 1
    - Base: Gain Barricade.
    - Upgraded: _(no change)_
- **Auxiliary Reactor**  — Power · ⚡2 → 1
    - Base: Gain 1 Reactor.
    - Upgraded: _(no change)_
- **Drone Swarm**  — Power · ⚡2
    - Base: Deploy a Drone Swarm (4 to all/turn).
    - Upgraded: Deploy a Drone Swarm (6 to all/turn).
- **Echo Core**  — Power · ⚡2 → 1
    - Base: Gain Echo.
    - Upgraded: _(no change)_
- **Flux Capacitor**  — Power · ⚡2
    - Base: Gain 2 Reactor. Lose 5 HP.
    - Upgraded: Gain 2 Reactor. Lose 3 HP.
- **Hive Protocol**  — Power · ⚡2
    - Base: Gain 1 Hive.
    - Upgraded: Gain 2 Hive.
- **Ion Storm**  — Attack · ⚡2
    - Base: ALL enemies: 5 damage, 1 Weak, 1 Vulnerable.
    - Upgraded: ALL enemies: 7 damage, 2 Weak, 1 Vulnerable.
- **Mortar Array**  — Power · ⚡2
    - Base: Deploy a Turret (8 dmg/turn).
    - Upgraded: Deploy a Turret (11 dmg/turn).
- **Phase Bulwark**  — Power · ⚡2 → 1
    - Base: Gain Phase Lock.
    - Upgraded: _(no change)_
- **Singularity Drive**  — Power · ⚡2 → 1
    - Base: Gain Echo, 1 Reactor.
    - Upgraded: _(no change)_
- **Subroutine**  — Power · ⚡2 → 1
    - Base: Whenever you play a Power, draw a card.
    - Upgraded: _(no change)_
- **Swarm Uplink**  — Power · ⚡2
    - Base: Whenever one of your constructs fires, gain 2 Shield.
    - Upgraded: Whenever one of your constructs fires, gain 3 Shield.
- **Tesla Conduit**  — Power · ⚡2
    - Base: Gain 5 Conduit.
    - Upgraded: Gain 7 Conduit.

#### Legendary

- **Omega Protocol**  — Power · ⚡3 → 2  _(boss reward only)_
    - Base: Gain Phase Lock, Echo.
    - Upgraded: _(no change)_

---

### Void Adept

_Sanctioned psyker — PSI burns, hexes & blasts. (56 cards)_


#### Starter

- **Mind Spike**  — Attack · ⚡1  _(starting card)_
    - Base: Deal 4 damage. Apply 1 Weak.
    - Upgraded: Deal 6 damage. Apply 2 Weak.

#### Common

- **Bloodletting**  — Skill · ⚡0
    - Base: Lose 2 HP. Draw 1 card. Gain 3 Shield.
    - Upgraded: Lose 1 HP. Draw 1 card. Gain 5 Shield.
- **Hemorrhage**  — Skill · ⚡0  _(Exhaust)_
    - Base: Lose 2 HP. Gain 2 Energy. Roll 6 or less: Gain 2 Psi Focus. Exhaust.
    - Upgraded: Lose 1 HP. Gain 2 Energy. Roll 7 or less: Gain 2 Psi Focus. Exhaust.
- **Hex Weave**  — Skill · ⚡1
    - Base: Apply 4 Burn. Apply 1 Burn to ALL enemies.
    - Upgraded: Apply 6 Burn. Apply 2 Burn to ALL enemies.
- **Immolate**  — Attack · ⚡1
    - Base: Deal 3 damage. Apply 3 Burn.
    - Upgraded: Deal 4 damage. Apply 5 Burn.
- **Premonition**  — Skill · ⚡1
    - Base: Draw 2 cards. Gain 3 Shield.
    - Upgraded: Draw 2 cards. Gain 6 Shield.
- **Psi Lance**  — Attack · ⚡1
    - Base: Deal 5 damage. Gain 1 Psi Focus.
    - Upgraded: Deal 7 damage. Gain 1 Psi Focus.
- **Sanguine Ward**  — Skill · ⚡1
    - Base: Lose 2 HP. Gain 8 Shield.
    - Upgraded: Lose 1 HP. Gain 11 Shield.
- **Soul Burn**  — Skill · ⚡1
    - Base: Apply 4 Burn.
    - Upgraded: Apply 7 Burn.
- **Spectral Grasp**  — Skill · ⚡0
    - Base: Apply 1 Weak, 1 Vulnerable. Roll 15+ or 6-: Apply 1 Weak, 1 Vulnerable.
    - Upgraded: Apply 2 Weak, 2 Vulnerable. Roll 13+ or 7-: Apply 1 Weak, 1 Vulnerable.
- **Void Bolt**  — Attack · ⚡1
    - Base: Deal 5 damage. Apply 2 Vulnerable.
    - Upgraded: Deal 7 damage. Apply 3 Vulnerable.
- **Void Siphon**  — Attack · ⚡1
    - Base: Deal 4 damage to ALL enemies. Siphon.
    - Upgraded: Deal 6 damage to ALL enemies. Siphon.
- **Worry the Wound**  — Attack · ⚡1
    - Base: Deal 2 damage for each Vulnerable, Weak, and Burn on the target.
    - Upgraded: Deal 3 damage for each Vulnerable, Weak, and Burn on the target.

#### Uncommon

- **Ashes, Ashes**  — Skill · ⚡1
    - Base: Apply 3 Burn. Roll 15+ or 6-: Apply 4 Burn.
    - Upgraded: Apply 4 Burn. Roll 14+ or 7-: Apply 5 Burn.
- **Backdraft**  — Attack · ⚡1
    - Base: Lose all your Shield. Apply that much Burn to the target.
    - Upgraded: Lose all your Shield. Apply 150% of it as Burn to the target.
- **Blood Sacrifice**  — Skill · ⚡0  _(Exhaust)_
    - Base: Lose 4 HP. Gain 2 Psi Focus. Exhaust.
    - Upgraded: Lose 3 HP. Gain 3 Psi Focus. Exhaust.
- **Catalyst**  — Skill · ⚡1
    - Base: Double the Burn on the target.
    - Upgraded: Triple the Burn on the target.
- **Cerebral Spike**  — Attack · ⚡1
    - Base: Your Psi Focus counts twice.
    - Upgraded: Deal 6 damage. Your Psi Focus counts twice.
- **Cinder Burst**  — Attack · ⚡1
    - Base: Detonate the target's Burn for 200% damage.
    - Upgraded: Detonate the target's Burn for 250% damage.
- **Crimson Rite**  — Attack · ⚡1
    - Base: Lose 2 HP. Deal 5 damage. Apply 2 Vulnerable. Siphon.
    - Upgraded: Lose 2 HP. Deal 7 damage. Apply 3 Vulnerable. Siphon.
- **Dread Whisper**  — Skill · ⚡1
    - Base: Apply 2 Vulnerable. Gain 1 Psi Focus. Draw 1 card.
    - Upgraded: Apply 3 Vulnerable. Gain 2 Psi Focus. Draw 1 card.
- **Ember Storm**  — Skill · ⚡1
    - Base: Apply 2 Burn to ALL enemies. Draw 1 card.
    - Upgraded: Apply 3 Burn to ALL enemies. Draw 1 card.
- **Ember Ward**  — Skill · ⚡1
    - Base: This combat, enemies that attack you gain 2 Burn.
    - Upgraded: This combat, enemies that attack you gain 3 Burn.
- **Entropic Lash**  — Attack · ⚡1
    - Base: Deal 5 damage. Apply 2 Burn to ALL enemies.
    - Upgraded: Deal 7 damage. Apply 3 Burn to ALL enemies.
- **Exsanguinate**  — Attack · ⚡1
    - Base: Lose 3 HP. Deal 10 damage. Siphon.
    - Upgraded: Lose 3 HP. Deal 14 damage. Siphon.
- **Kindling**  — Power · ⚡1
    - Base: Gain 2 Entropy.
    - Upgraded: Gain 3 Entropy.
- **Long Whisper**  — Power · ⚡1
    - Base: Gain 1 Ascendant, 1 Conduit.
    - Upgraded: Gain 2 Ascendant, 1 Conduit.
- **Mind Bulwark**  — Skill · ⚡1
    - Base: Gain Shield equal to twice your Psi Focus.
    - Upgraded: Gain Shield equal to three times your Psi Focus.
- **Mind Fracture**  — Skill · ⚡1
    - Base: Apply 1 Vulnerable, 1 Weak. Draw 1 card.
    - Upgraded: Apply 2 Vulnerable, 2 Weak. Draw 1 card.
- **Mind Lance**  — Attack · ⚡1
    - Base: Both hits are boosted by your Psi Focus.
    - Upgraded: Deal 5 damage 2 times. Both hits are boosted by your Psi Focus.
- **Mind Storm**  — Attack · ⚡0
    - Base: Deal 3 damage for each other card played this turn.
    - Upgraded: Deal 4 damage for each other card played this turn.
- **Null Field**  — Skill · ⚡1
    - Base: ALL enemies: 2 Weak, 1 Vulnerable.
    - Upgraded: ALL enemies: 2 Weak, 2 Vulnerable.
- **Parch**  — Attack · ⚡1
    - Base: Deal damage equal to the target's Burn. It is not consumed.
    - Upgraded: _(no change)_
- **Psionic Focus**  — Power · ⚡1
    - Base: Gain 2 Psi Focus.
    - Upgraded: Gain 3 Psi Focus.
- **Psionic Scream**  — Attack · ⚡1
    - Base: ALL enemies: 4 damage, 1 Weak.
    - Upgraded: ALL enemies: 6 damage, 2 Weak.
- **Red Thread**  — Power · ⚡1
    - Base: Gain 2 Blood Pact, 2 Psi Focus, 3 Regen.
    - Upgraded: Gain 3 Blood Pact, 3 Psi Focus, 4 Regen.
- **Soulflare**  — Attack · ⚡1
    - Base: Deal 4 damage to every Burning enemy.
    - Upgraded: Deal 6 damage to every Burning enemy.
- **Sympathetic Ache**  — Power · ⚡1
    - Base: Gain 2 Conduit.
    - Upgraded: Gain 3 Conduit.
- **Telekinetic Crush**  — Attack · ⚡2
    - Base: Deal 5 damage.
    - Upgraded: Deal 9 damage.
- **The Hungry Dark**  — Skill · ⚡1
    - Base: Lose 2 HP. ALL enemies: 2 Weak, 2 Vulnerable.
    - Upgraded: Lose 2 HP. ALL enemies: 2 Weak, 3 Vulnerable.
- **Vital Lance**  — Attack · ⚡1
    - Base: Lose 2 HP. Deal 8 damage.
    - Upgraded: Lose 2 HP. Deal 11 damage.

#### Rare

- **Ascendant Mind**  — Power · ⚡2
    - Base: Gain 2 Ascendant, 2 Psi Focus.
    - Upgraded: Gain 3 Ascendant, 2 Psi Focus.
- **Blood Pact**  — Power · ⚡1
    - Base: Gain 1 Blood Pact.
    - Upgraded: Gain 2 Blood Pact.
- **Conflagration**  — Attack · ⚡2
    - Base: Then Detonate it all for 200% damage.
    - Upgraded: Then Detonate it all for 250% damage.
- **Dimensional Rift**  — Attack · ⚡2
    - Base: Deal 6 damage. Apply 3 Vulnerable. Draw 1 card.
    - Upgraded: Deal 9 damage. Apply 4 Vulnerable. Draw 1 card.
- **Eldritch Storm**  — Attack · ⚡3
    - Base: Deal 4 damage to random enemies 4 times.
    - Upgraded: Deal 5 damage to random enemies 5 times.
- **Entropy Field**  — Power · ⚡2
    - Base: Gain 2 Entropy.
    - Upgraded: Gain 3 Entropy.
- **Feast or Famine**  — Attack · ⚡1
    - Base: Roll 15+ or 6-: Deal 22 damage.
    - Upgraded: Roll 13+ or 8-: Deal 26 damage.
- **Martyr's Gift**  — Power · ⚡2
    - Base: Gain 1 Blood Pact, 1 Ascendant.
    - Upgraded: Gain 1 Blood Pact, 2 Ascendant.
- **Mind Array**  — Power · ⚡1
    - Base: Gain 2 Blade Array.
    - Upgraded: Gain 3 Blade Array.
- **Plague Engine**  — Power · ⚡1
    - Base: Gain 1 Contagion.
    - Upgraded: Gain 2 Contagion.
- **Psionic Nova**  — Attack · ⚡2
    - Base: Deal 5 damage to ALL enemies.
    - Upgraded: Deal 8 damage to ALL enemies.
- **Unravel**  — Attack · ⚡1
    - Base: Deal 4 damage for each Vulnerable, Weak, and Burn on the target.
    - Upgraded: Deal 6 damage for each Vulnerable, Weak, and Burn on the target.
- **Void Rupture**  — Attack · ⚡2
    - Base: ALL enemies: 4 damage, 2 Vulnerable.
    - Upgraded: ALL enemies: 6 damage, 2 Vulnerable.
- **Wildfire Engine**  — Power · ⚡2
    - Base: Gain 1 Wildfire.
    - Upgraded: Gain 2 Wildfire.

#### Legendary

- **Singularity Bloom**  — Power · ⚡2  _(boss reward only)_
    - Base: Gain 1 Contagion, 2 Entropy.
    - Upgraded: Gain 2 Contagion, 2 Entropy.

---

### Neutral (any class)

_Colourless cards any class can draft (starters, boss & event pool). (16 cards)_


#### Starter

- **Combat Shield**  — Skill · ⚡1  _(starter: Vanguard, Technomancer, Void Adept)_
    - Base: Gain 5 Shield.
    - Upgraded: Gain 8 Shield.
- **Pulse Rifle**  — Attack · ⚡1  _(starter: Vanguard, Technomancer, Void Adept)_
    - Base: Deal 6 damage.
    - Upgraded: Deal 9 damage.

#### Common

- **Brace**  — Skill · ⚡1
    - Base: Gain 5 Shield. Draw 1 card.
    - Upgraded: Gain 8 Shield. Draw 1 card.
- **Combat Scan**  — Skill · ⚡0
    - Base: Apply 1 Vulnerable. Draw 1 card.
    - Upgraded: Apply 2 Vulnerable. Draw 1 card.
- **Med Stim**  — Skill · ⚡1  _(Exhaust)_
    - Base: Heal 5 HP. Exhaust.
    - Upgraded: Heal 8 HP. Exhaust.
- **Recon**  — Skill · ⚡0
    - Base: Scry 3. Draw 1.
    - Upgraded: Scry 5. Draw 1.
- **Scrap Shot**  — Attack · ⚡0
    - Base: Deal 3 damage.
    - Upgraded: Deal 5 damage.

#### Uncommon

- **Guard Protocol**  — Skill · ⚡1  _(Retain)_
    - Base: Gain 6 Shield. Retain.
    - Upgraded: Gain 9 Shield. Retain.
- **Requisition**  — Skill · ⚡1 → 0
    - Base: Search your draw pile and put any card into your hand.
    - Upgraded: _(no change)_
- **Salvage Cache**  — Skill · ⚡1  _(Exhaust)_
    - Base: Discover a card.
    - Upgraded: _(no change)_
- **Salvage Protocol**  — Power · ⚡1 → 0
    - Base: Gain 1 Salvage.
    - Upgraded: _(no change)_
- **Salvaged Ordnance**  — Attack · ⚡1  _(event reward only; Exhaust)_
    - Base: Deal 11 damage. Exhaust.
    - Upgraded: Deal 16 damage. Exhaust.
- **Stim Overdose**  — Skill · ⚡0  _(event reward only; Exhaust)_
    - Base: Gain 2 Energy. Draw 2 cards. Lose 3 HP. Exhaust.
    - Upgraded: Gain 2 Energy. Draw 2 cards. Lose 1 HP. Exhaust.

#### Rare

- **Forbidden Lore**  — Skill · ⚡1  _(event reward only; Exhaust)_
    - Base: Draw 3 cards. Gain 1 Psi Focus. Exhaust.
    - Upgraded: Draw 4 cards. Gain 1 Psi Focus. Exhaust.
- **Fusion Charge**  — Skill · ⚡1
    - Base: Primed 3: then 30 damage to ALL enemies.
    - Upgraded: Primed 3: then 45 damage to ALL enemies.

#### Legendary

- **Juggernaut Core**  — Power · ⚡2  _(boss reward only)_
    - Base: Gain 3 Plating, 1 Warlord.
    - Upgraded: Gain 4 Plating, 1 Warlord.

---

### Curses

_Unplayable junk that clogs your deck. (4 cards)_


#### Curse

- **Recurring Dread**  — Curse · ⚡0  _(Retain; Unplayable)_
    - Base: Unplayable. A fragment of the loop, lodged in your mind.
    - Upgraded: _(cannot be upgraded)_
- **Shrapnel**  — Curse · ⚡0  _(Unplayable)_
    - Base: Unplayable. Lose 2 HP if still in hand at end of turn.
    - Upgraded: _(cannot be upgraded)_
- **Void Swarm**  — Curse · ⚡0  _(Unplayable)_
    - Base: Unplayable. Its neighbours in hand cannot be played.
    - Upgraded: _(cannot be upgraded)_
- **Void Taint**  — Curse · ⚡0  _(Unplayable)_
    - Base: Unplayable. A whisper gnaws at the edge of your mind.
    - Upgraded: _(cannot be upgraded)_

