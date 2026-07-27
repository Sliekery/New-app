# Relic catalogue (pre-dice-system reference)

Snapshot of all 49 relics as they exist today, kept so each can be reworked
into the die (see DICE_SYSTEM.md §6). Columns: tier | id | name | engine hooks | text.

| T | id | name | hooks | description |
|---|---|---|---|---|
| 1 | `adrenaline_pump` | Adrenaline Pump | `energyTurn1=1` | +1 Energy on your first turn. |
| 1 | `aegis_core` | Aegis Core | `blockStart=8` | Start each combat with 8 Shield. |
| 1 | `berserker_pact` | Berserker's Pact | `(bespoke)` | QUEST — Kill 15 enemies. → Start each combat with 2 Might. |
| 1 | `berserkers_yoke` | Berserker's Yoke | `flatDmg=4 dmgTakenMult=0.2` | Your attacks deal +4, but you take 20% more damage. Switch it off on the star chart when you turn fragile. |
| 1 | `blood_bond` | Blood Bond | `petAttackHeal=1` | Whenever one of your pets attacks, heal 1 HP. |
| 1 | `blood_chalice` | Blood Chalice | `healAfterCombat=5` | Heal 5 HP after every combat. |
| 1 | `brood_womb` | Brood Womb | `petBonusHp=3` | Your summoned pets start with +3 HP. |
| 1 | `capacitive_plating` | Capacitive Plating | `shieldPingPct=34` | Whenever you gain Shield, deal 1 damage per 3 Shield gained to a random enemy. |
| 1 | `cog_implant` | Cogitator Implant | `attr=1` | +1 TECH. |
| 1 | `cryo_capsule` | Cryo Capsule | `sectorHeal=0.25` | Heal 25% HP when entering a new sector. |
| 1 | `execution_protocol` | Execution Protocol | `executeBonus=1` | Your attacks deal double damage to enemies below 25% HP. |
| 1 | `forge_reserve` | Forge Reserve | `blockStartTechMul=3` | Start each combat with Shield equal to 3× your TECH. |
| 1 | `hexheart` | Hexheart | `(bespoke)` | Cornerstone. Survives the Recurrence and forges stronger each loop you clear: +PSI, amplifies your first Burn, and at higher tiers steels you with starting Shield. |
| 1 | `hexweaver` | Hexweaver | `hexweaver=2` | Whenever you apply Weak or Vulnerable to an enemy, also apply 2 Burn. |
| 1 | `hoarfrost_cell` | Hoarfrost Cell | `weakStart=2` | At the start of each combat, apply 2 Weak to all enemies. |
| 1 | `medic_drone` | Medic Drone | `healTurn=1` | Heal 1 HP at the start of each turn. |
| 1 | `misfire_capacitor` | Misfire Capacitor | `critDie1Energy=1` | When your crit die rolls a 1, gain 1 Energy this turn. |
| 1 | `nano_mesh` | Nano Mesh | `plate=2` | Gain 2 Shield at the start of each turn. |
| 1 | `pacifist_doctrine` | Pacifist Doctrine | `(bespoke)` | QUEST — Skip 3 card rewards. → Draw 1 extra card every turn. |
| 1 | `power_fist` | Power Fist | `strStart=1` | Start each combat with 1 Might. |
| 1 | `reaper_protocol` | Reaper Protocol | `healOnKill=2` | Whenever you kill an enemy, heal 2 HP. |
| 1 | `reclaimer_unit` | Reclaimer Unit | `reshuffleShield=3` | Whenever your draw pile reshuffles, gain 3 Shield. |
| 1 | `recoilless_frame` | Recoilless Frame | `flatDmg=5 maxNonAttack=1` | Your attacks deal +5 — but you may play at most 1 non-attack card per turn. Toggle it off on the star chart when you need to set up. |
| 1 | `resonance_coil` | Resonance Coil | `firstPowerDraw=1` | The first Power you play each combat, draw a card. |
| 1 | `salvager_rig` | Salvager Rig | `creditsMul=0.25` | +25% credits from combat. |
| 1 | `servo_skull` | Servo Skull | `drawStart=2` | Draw 2 extra cards on your first turn. |
| 1 | `static_capacitor` | Static Capacitor | `shieldThorns=2` | Whenever you gain Shield, deal 2 damage to a random enemy. |
| 1 | `tactical_uplink` | Tactical Uplink | `checkBonus=3` | +3 to all event skill checks. |
| 1 | `targeting_visor` | Targeting Visor | `critBonus=2` | Crit on a d20 roll of 18 or higher. |
| 1 | `thorn_husk` | Thornmail Husk | `thorns=2` | Attackers take 2 damage. |
| 1 | `vampiric_array` | Vampiric Array | `lifestealPct=20 noShield=1` | Your attacks heal you for 20% of the damage dealt — but you can no longer gain Shield. |
| 1 | `void_conduit` | Void Conduit | `firstPowerFree=1` | The first Power you play each combat costs 0. |
| 1 | `void_lens` | Void Lens | `flatDmg=1` | Your attacks deal +1 damage. |
| 1 | `war_chest` | War Chest | `(bespoke)` | QUEST — Hold 220 credits at once. → +1 Energy every turn. |
| 1 | `war_sigil` | War Sigil | `attr=1` | +1 MIGHT. |
| 1 | `warp_shard` | Warp Shard | `attr=1` | +1 PSI. |
| 2 | `ancient_sigil` | Ancient Sigil | `energyEveryTurn=1` | +1 Energy every turn. |
| 2 | `bloodlust_engine` | Bloodlust Engine | `strOnKill=1` | Whenever an enemy dies, gain 1 Might for the rest of combat. |
| 2 | `dread_plate` | Dreadnought Plate | `maxHp=22` | +22 Max HP. |
| 2 | `famine_engine` | Famine Engine | `enemyHpScale=20 noCredits=1` | Enemies start each combat at 20% less HP — but you gain no credits from combat. |
| 2 | `flawless_protocol` | Flawless Protocol | `(bespoke)` | QUEST — Win 2 combats without losing any HP. → Start each combat with 12 Shield. |
| 2 | `glass_cannon` | Glass Cannon | `dmgMult=0.5 special:glassCannon` | Deal 50% more damage — but your Max HP is permanently reduced by 25%. |
| 2 | `offline_shield` | Offline Shield | `(bespoke)` | QUEST — Win 3 combats without gaining any Shield. → Start each combat with 7 Plated Armor. |
| 2 | `omega_visor` | Omega Visor | `critDraw=1` | Whenever you land a critical hit, draw a card. |
| 2 | `overcharged_reactor` | Overcharged Reactor | `energyEveryTurn=1` | +1 Energy each turn — but the core burns out after 5 fights. |
| 2 | `overflow_reactor` | Overflow Reactor | `energyCarry=1` | Unused Energy carries over to your next turn. |
| 2 | `singularity` | Singularity Engine | `aoeTurnStart=4` | Deal 4 damage to ALL enemies at the start of your turn. |
| 2 | `singularity_core` | Singularity Core | `energyEveryTurn=1 noShield=1` | +1 Energy every turn — but you can no longer gain Shield. Switch it off on the star chart when you need to turtle. |
| 2 | `soul_ledger` | Soul Ledger | `(bespoke)` | QUEST — Apply 60 Burn to enemies. → Each turn, all enemy Burn grows by 1. |

## Notes

- 7 relics have no simple numeric hook and need bespoke rework: `berserker_pact`, `hexheart`, `pacifist_doctrine`, `war_chest`, `flawless_protocol`, `offline_shield`, `soul_ledger`.
- Tier split: {"1":36,"2":13}.
- Class-locked relics keep their `cls` gate when they become Core Modules.
