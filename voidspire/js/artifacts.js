/* =========================================================================
 * VOIDSPIRE — artifacts.js
 * Passive relics. Each has a single declarative hook the engine checks.
 * tier: 1 = normal drops (elites, events, shop), 2 = boss rewards.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.ARTIFACTS = {
    aegis_core:      { name: 'Aegis Core',        tier: 1, k: 'blockStart',      v: 8,    desc: 'Start each combat with 8 Shield.',
      art: { p: [[0,-1, 0.87,-0.5, 0.87,0.5, 0,1, -0.87,0.5, -0.87,-0.5, 0,-1]], e: [[0,0]] } },
    overcharged_reactor: { name: 'Overcharged Reactor', tier: 2, hooks: [{ k: 'energyEveryTurn', v: 1 }], uses: 5, desc: '+1 Energy each turn — but the core burns out after 5 fights.',
      art: { p: [[0,-0.72, 0.62,-0.36, 0.62,0.36, 0,0.72, -0.62,0.36, -0.62,-0.36, 0,-0.72], [0,-0.34, 0,0.34], [-0.28,-0.16, 0.28,0.16], [-0.28,0.16, 0.28,-0.16]], e: [[0,0]] } },
    berserkers_yoke: { name: "Berserker's Yoke", tier: 1, hooks: [{ k: 'flatDmg', v: 4 }, { k: 'dmgTakenMult', v: 0.2 }], desc: 'Your attacks deal +4, but you take 20% more damage. Switch it off on the star chart when you turn fragile.',
      art: { p: [[-0.75,0.1, 0.75,0.1], [-0.5,0.1, -0.5,-0.32], [0,0.1, 0,-0.4], [0.5,0.1, 0.5,-0.32], [-0.75,0.1, -0.62,0.4], [0.75,0.1, 0.62,0.4]], e: [[0,-0.55]] } },
    servo_skull:     { name: 'Servo Skull',       tier: 1, k: 'drawStart',       v: 2,    desc: 'Draw 2 extra cards on your first turn.',
      art: { p: [[-0.6,-0.1, -0.6,-0.55, -0.25,-0.85, 0.25,-0.85, 0.6,-0.55, 0.6,-0.1, 0.35,0.15, 0.35,0.5, -0.35,0.5, -0.35,0.15, -0.6,-0.1], [-0.2,0.5, -0.2,0.75], [0,0.5, 0,0.8], [0.2,0.5, 0.2,0.75], [0,-0.85, 0,-1.1]], e: [[-0.25,-0.3],[0.25,-0.3]] } },
    targeting_visor: { name: 'Targeting Visor',   tier: 1, k: 'critBonus',       v: 2,    desc: 'Crit on a d20 roll of 18 or higher.',
      art: { p: [[0.5,0, 0.35,0.35, 0,0.5, -0.35,0.35, -0.5,0, -0.35,-0.35, 0,-0.5, 0.35,-0.35, 0.5,0], [0.5,0, 0.9,0], [-0.5,0, -0.9,0], [0,-0.5, 0,-0.9], [0,0.5, 0,0.9]], e: [[0,0]] } },
    hexheart:        { name: 'Hexheart',          tier: 1, cornerstone: 'voidadept', cls: 'voidadept', noRemove: true,
      desc: 'Cornerstone. Survives the Recurrence and forges stronger each loop you clear: +PSI, amplifies your first Burn, and at higher tiers steels you with starting Shield.',
      art: { p: [[0,0.9, -0.8,-0.2, -0.45,-0.7, 0,-0.35, 0.45,-0.7, 0.8,-0.2, 0,0.9], [0,-0.35, 0,0.5]], e: [[0,-0.05]] } },
    adrenaline_pump: { name: 'Adrenaline Pump',   tier: 1, k: 'energyTurn1',     v: 1,    desc: '+1 Energy on your first turn.',
      art: { p: [[0,0.8, -0.8,-0.1, -0.45,-0.65, 0,-0.25, 0.45,-0.65, 0.8,-0.1, 0,0.8], [-0.3,-0.05, 0,0.3, 0.3,-0.05]], e: [] } },
    /* ---- absorbed from the old Augment draft --------------------------
     * These were "Augment Protocols": a second pool of permanent passives,
     * drafted after every boss from its own screen, with its own name. They
     * were relics in everything but the word — 14 of the 23 were a single
     * engine hook, which is the definition of a relic here. The draft is gone
     * and these live in the one pool now.
     * -------------------------------------------------------------- */
    armor_weave: { name: 'Armor Weave', tier: 1, k: 'plate', v: 3, desc: 'Gain 3 Shield at the start of each turn.',
      art: { p: [[0,-0.8,0.7,-0.4,0.7,0.35,0,0.8,-0.7,0.35,-0.7,-0.4,0,-0.8], [-0.45,-0.1,0.45,-0.1], [-0.3,0.25,0.3,0.25]] } },
    killchain: { name: 'Killchain', tier: 1, k: 'killDraw', v: 1, desc: 'Whenever you kill an enemy, draw a card.',
      art: { p: [[-0.7,-0.35,-0.1,-0.35,-0.1,0.2,-0.7,0.2,-0.7,-0.35], [0.1,-0.2,0.7,-0.2,0.7,0.4,0.1,0.4,0.1,-0.2], [-0.1,-0.08,0.1,-0.08]] } },
    reactive_plating: { name: 'Reactive Plating', tier: 1, k: 'reactivePlate', v: 6, desc: 'The first time you take damage each combat, gain 6 Shield.',
      art: { p: [[-0.7,-0.5,0.7,-0.5,0.7,0.15,0,0.7,-0.7,0.15,-0.7,-0.5], [-0.7,-0.15,0.7,-0.15], [-0.2,-0.5,-0.2,-0.15], [0.2,-0.5,0.2,-0.15]] } },
    overclock: { name: 'Overclock Servos', tier: 1, k: 'firstCardFree', v: 1, desc: 'The first card you play each turn costs 1 less.',
      art: { p: [[0.2,-0.85,-0.35,-0.05,0.05,-0.05,-0.25,0.85,0.4,-0.1,0,-0.1,0.35,-0.85,0.2,-0.85]] } },
    breaching_rounds: { name: 'Breaching Rounds', tier: 1, cls: 'vanguard', k: 'attackVuln', v: 1, desc: 'Your attacks apply 1 Vulnerable.',
      art: { p: [[-0.85,0,0.5,0], [0.5,0,0.25,-0.25], [0.5,0,0.25,0.25], [-0.5,-0.45,-0.5,0.45], [0,-0.35,0,0.35]] } },
    targeting_matrix: { name: 'Targeting Matrix', tier: 1, cls: 'technomancer', k: 'critStr', v: 1, desc: 'Whenever you land a critical hit, gain 1 Might.',
      art: { p: [[-0.6,-0.6,-0.6,-0.25], [-0.6,-0.6,-0.25,-0.6], [0.6,-0.6,0.25,-0.6], [0.6,-0.6,0.6,-0.25], [-0.6,0.6,-0.6,0.25], [-0.6,0.6,-0.25,0.6], [0.6,0.6,0.6,0.25], [0.6,0.6,0.25,0.6], [-0.4,0,0.4,0], [0,-0.4,0,0.4]] } },
    disruptor_field: { name: 'Disruptor Field', tier: 1, cls: 'technomancer', k: 'shieldWeak', v: 1, desc: 'Whenever you gain Shield, apply 1 Weak to a random enemy.',
      art: { p: [[0,-0.75,0.62,-0.4,0.62,0.2,0,0.76,-0.62,0.2,-0.62,-0.4,0,-0.75], [-0.35,-0.2,0.1,0.05,-0.15,0.15,0.3,0.4]] } },
    soul_pyre: { name: 'Soul Pyre', tier: 1, cls: 'voidadept', k: 'attackBurn', v: 1, desc: 'Your attacks also apply 1 Burn.',
      art: { p: [[0,-0.85,0.34,-0.4,0.18,-0.06,0.46,0.24,0.2,0.62,0,0.8,-0.2,0.62,-0.46,0.24,-0.18,-0.06,-0.34,-0.4,0,-0.85]] } },
    critical_cascade: { name: 'Critical Cascade', tier: 2, k: 'critVuln', v: 2, desc: 'Your crits also apply 2 Vulnerable.',
      art: { p: [[0,-0.8,0.2,-0.25,0.78,-0.15,0.32,0.2,0.45,0.75,0,0.45,-0.45,0.75,-0.32,0.2,-0.78,-0.15,-0.2,-0.25,0,-0.8]] } },
    warlord_doctrine: { name: 'Counterscarp', tier: 2, cls: 'vanguard', k: 'wallFloor', v: 6, desc: 'Your Bulwark never falls below 6.',
      art: { p: [[-0.45,-0.2,-0.5,-0.55,0.3,-0.6,0.45,-0.3,0.45,0.35,-0.3,0.5,-0.5,0.25,-0.45,-0.2], [0.45,-0.1,0.7,-0.1], [0.45,0.12,0.7,0.12]] } },
    echo_protocol: { name: 'Echo Protocol', tier: 2, cls: 'technomancer', k: 'echoStart', v: 1, desc: 'The first Attack you play each turn is played twice.',
      art: { p: [[0,-0.75,0.65,0,0,0.75,-0.65,0,0,-0.75], [0,-0.4,0.35,0,0,0.4,-0.35,0,0,-0.4]] } },
    entropy_doctrine: { name: 'Entropy Doctrine', tier: 2, cls: 'voidadept', hooks: [{ k: 'burnGrow', v: 1 }, { k: 'weakStart', v: 2 }], desc: 'Enemy Burn grows each turn, and all enemies start Weak.',
      art: { p: [[0,-0.8,0.3,-0.3,0.14,0,0.4,0.3,0.16,0.66,0,0.78,-0.16,0.66,-0.4,0.3,-0.14,0,-0.3,-0.3,0,-0.8], [-0.5,0.3,-0.75,0.55], [0.5,0.3,0.75,0.55]] } },
    kinetic_overflow: { name: 'Kinetic Overflow', tier: 2, hooks: [{ k: 'flatDmg', v: 2 }, { k: 'firstCardFree', v: 1 }], desc: 'Attacks deal +2, and your first card each turn costs 1 less.',
      art: { p: [[-0.8,0.4,-0.2,-0.3,0.15,0.15,0.8,-0.55], [0.8,-0.55,0.4,-0.55], [0.8,-0.55,0.8,-0.15]] } },
    reckless_overdrive: { name: 'Reckless Overdrive', tier: 1, hooks: [{ k: 'energyEveryTurn', v: 1 }, { k: 'maxHpPct', v: -0.12 }], desc: '+1 Energy every turn — but Max HP −12%.',
      art: { p: [[-0.55,-0.55,0.55,-0.55,0.55,0.55,-0.55,0.55,-0.55,-0.55], [0.15,-0.35,-0.15,0.05,0.05,0.05,-0.1,0.4], [-0.55,0,-0.85,0], [0.55,0,0.85,0]] } },
    glass_doctrine: { name: 'Glass Doctrine', tier: 2, hooks: [{ k: 'dmgMult', v: 0.5 }, { k: 'vulnStart', v: 2 }], desc: 'Deal +50% damage — but start each combat with 2 Vulnerable.',
      art: { p: [[0,-0.85,0.5,-0.3,0.35,0.5,-0.35,0.5,-0.5,-0.3,0,-0.85], [0,-0.85,0,0.5], [-0.5,-0.3,0.35,0.5], [0.5,-0.3,-0.35,0.5]] } },

    /* ---- archetype anchors ------------------------------------------
     * 30 of the 34 relic hooks in this file are used by exactly one relic, and
     * almost all of them are flat numbers (+1 damage, +22 max HP). That makes a
     * relic pool of small bonuses rather than one that points at builds — and
     * constructs, the Exhaust engine, Momentum and the blood engine had nothing
     * pointing at them at all. These four do, one per orphaned archetype.
     * -------------------------------------------------------------- */
    resonance_node: { name: 'Resonance Node',   tier: 1, cls: 'voidadept', k: 'psiPowStart', v: 2, desc: 'Start each combat with 2 Psi Focus.',
      art: { p: [[0,-0.8, 0.3,-0.26, 0.8,-0.14, 0.42,0.24, 0.48,0.74, 0,0.48, -0.48,0.74, -0.42,0.24, -0.8,-0.14, -0.3,-0.26, 0,-0.8], [-0.2,-0.05, 0.2,-0.05]], e: [[0,0.06]] } },
    foundry_spine:   { name: 'Foundry Spine',     tier: 1, cls: 'technomancer', k: 'turretStart', v: 3, desc: 'Start each combat with a Turret (3 dmg/turn).',
      art: { p: [[-0.6,0.7, -0.3,0.1, 0.3,0.1, 0.6,0.7], [-0.3,0.1, 0.3,0.1, 0.24,-0.35, -0.24,-0.35, -0.3,0.1], [0.24,-0.22, 0.8,-0.22], [-0.5,0.7, 0.5,0.7]], e: [[0,-0.14]] } },
    /* Salvo was the Exhaust archetype's anchor and that line is retired, so
     * this pointed at a mechanic with no cards behind it. It opens the WALL
     * instead, which had exactly one relic of twenty-one. */
    ash_reliquary:   { name: 'The Bastion',       tier: 1, cls: 'vanguard', k: 'wallStart', v: 8, desc: 'Start each combat with 8 Bulwark.',
      art: { p: [[-0.45,0.7, -0.3,-0.3, 0.3,-0.3, 0.45,0.7, -0.45,0.7], [-0.35,-0.3, -0.5,-0.55, 0.5,-0.55, 0.35,-0.3], [-0.15,-0.75, 0,-0.95, 0.15,-0.75], [-0.2,0.1, 0.2,0.35], [0.2,0.1, -0.2,0.35]] } },
    iron_leech:      { name: 'Iron Leech',        tier: 1, cls: 'vanguard', k: 'bloodrageStart', v: 2, desc: 'Start each combat with 2 Blood Rage — your own wounds feed your Might.',
      art: { p: [[0,-0.85, 0.4,-0.2, 0.26,0.5, -0.26,0.5, -0.4,-0.2, 0,-0.85], [-0.26,0.5, -0.16,0.82], [0.26,0.5, 0.16,0.82], [-0.24,-0.1, 0.24,-0.1], [-0.14,0.16, 0.14,0.16]] } },
    /* ---- VANGUARD: relics that shape the die -------------------------
     * 55 of the 62 relics had nothing to do with the die, so "relics live
     * inside the die" was flavour text over a slot limit. These change the
     * curve you roll on, which makes taking one a build decision rather than
     * a stat comparison — and makes a relic worth more or less depending on
     * how you have cut your faces.
     * ---------------------------------------------------------------- */
    /* Tier 1 is where the relic pool is thickest and it had NOTHING that
     * touched the die — every early relic was a flat hook, so a run could
     * reach sector 3 without ever meeting the system. These are cheap, early,
     * and each one gives you a reason to look at your faces. */
    ranging_wedge: { name: 'Ranging Wedge', tier: 1, cls: 'vanguard', k: 'aimStart', v: 2,
      desc: 'Start each combat with 2 Aim.',
      art: { p: [[-0.8,0.3, 0.6,0.3], [-0.8,0.3, 0.2,-0.4], [0.2,-0.4, 0.6,0.3], [-0.3,0.3, 0.1,0.0], [0.1,0.3, 0.35,0.1], [-0.8,0.44, 0.6,0.44]], e: [[0.2,-0.46]] } },
    /* Deliberate anti-synergy with steering: Marksmanship spends Aim to AVOID
     * bare faces, so this pays the build that does not steer. */
    dry_fire: { name: 'Dry Fire', tier: 1, cls: 'vanguard', k: 'bareRefund', v: 1,
      desc: 'Rolling a BARE face gives 1 Energy and 1 Stim — an empty die still pays.',
      art: { p: [[-0.6,-0.4, 0.3,-0.4, 0.3,0.1, -0.6,0.1, -0.6,-0.4], [-0.6,-0.15, 0.3,-0.15], [0.3,-0.28, 0.7,-0.28], [-0.35,0.1, -0.4,0.5], [-0.15,0.1, -0.15,0.5], [0.55,-0.5, 0.7,-0.66], [0.62,-0.1, 0.8,0.0]], e: [[0.8,-0.28]] } },
    hot_barrel: { name: 'Hot Barrel', tier: 1, cls: 'vanguard', k: 'critRelay', v: 1,
      desc: 'On a crit, the faces beside the one you rolled fire at FULL.',
      art: { p: [[-0.7,0.2, 0.5,0.2], [-0.7,0.35, 0.5,0.35], [0.5,0.1, 0.8,0.1, 0.8,0.45, 0.5,0.45], [-0.5,0.1, -0.44,-0.2], [-0.1,0.1, -0.02,-0.3], [0.28,0.1, 0.36,-0.2], [-0.44,-0.4, -0.36,-0.56], [-0.02,-0.5, 0.06,-0.68]], e: [[-0.4,-0.66],[0.1,-0.8],[0.4,-0.36]] } },
    votive_shim: { name: 'Votive Shim', tier: 1, cls: 'vanguard', k: 'taintWard', v: 1,
      desc: 'The first scar the void tries to cut each sector is turned aside.',
      art: { p: [[0,-0.7, 0.55,-0.4, 0.55,0.16, 0,0.66, -0.55,0.16, -0.55,-0.4, 0,-0.7], [0,-0.5, 0.38,-0.28, 0.38,0.1, 0,0.46, -0.38,0.1, -0.38,-0.28, 0,-0.5], [-0.7,-0.6, 0.7,0.5], [-0.3,-0.06, 0.3,-0.06]], e: [[0,-0.02]] } },

    machined_barrel: { name: 'Sapper Charge', tier: 2, cls: 'vanguard', k: 'wallBurst', v: 1,
      desc: 'Detonating your Bulwark also stuns: all enemies gain 2 Vulnerable.',
      art: { p: [[-0.86,-0.2, 0.5,-0.2], [-0.86,0.1, 0.5,0.1], [-0.86,-0.2, -0.86,0.1], [-0.5,-0.2, -0.5,0.1], [-0.1,-0.2, -0.1,0.1], [0.3,-0.2, 0.3,0.1], [0.5,-0.3, 0.86,-0.3, 0.86,0.2, 0.5,0.2], [0.68,-0.3, 0.68,0.2], [-0.7,0.1, -0.7,0.5], [-0.3,0.1, -0.3,0.5], [-0.86,0.5, -0.14,0.5]], e: [[0.9,-0.05]] } },
    /* THE SPREAD IS BOUGHT WITH COST NOW, so widening it is what a chain relic
     * is FOR. The neighbour bleed used to be free, universal and the biggest
     * multiplier in the game — moving the big chains here makes "ping ping
     * ping" something you assemble rather than the background hum. */
    shock_couplers: { name: 'Shock Couplers', tier: 2, k: 'bleedReach', v: 1,
      desc: 'Every card carries one step further into the die. A 1-cost now shakes a neighbour; a 2-cost shakes both.',
      art: { p: [[-0.7,0.2, -0.3,-0.3], [-0.3,-0.3, 0.1,0.3], [0.1,0.3, 0.5,-0.3], [0.5,-0.3, 0.8,0.1]], e: [[-0.7,0.2],[0.8,0.1]] } },
    /* TIER 2, not 3. Eleven tier-3 relics exist and NONE of them drop — normal
     * rewards only ever offer tier 1 and 2 — so the pre-existing chain relic
     * (Distribution Frame) turned up in 0 of 250 runs and this one would have
     * too. A payoff on an unreachable relic is a payoff nowhere.
     *
     * It also had to get much bigger. A neighbour fires at 25% of a face, and
     * the die is only ~20% of your damage now, so widening the spread was worth
     * 0.8 points of face share — nothing. Now that the big chains live here,
     * they have to actually be big: this doubles what every step lands for. */
    resonance_cascade: { name: 'Resonance Cascade', tier: 2,
      hooks: [{ k: 'bleedReach', v: 1 }, { k: 'bleedPct', v: 0.35 }],
      desc: 'Every card carries one step further into the die, and every step lands more than twice as hard.',
      art: { p: [[-0.8,0, -0.5,-0.4], [-0.5,-0.4, -0.2,0.4], [-0.2,0.4, 0.1,-0.5], [0.1,-0.5, 0.4,0.5], [0.4,0.5, 0.7,-0.3], [0.7,-0.3, 0.9,0.1]], e: [[-0.8,0],[0.9,0.1]] } },
    /* ============ THE DIE AS AN OBJECT ============
     * Twenty-odd relics already touch ROLLING (reroll, advantage, bonuses) and
     * BANDS (crit and misfire windows). Three parts of the die had nothing at
     * all: the LAYOUT (what sits next to what), the die's MEMORY (it never
     * cared what you rolled last) and BLANK faces (a dead roll, so there was
     * never a reason to run a sparse die). These are those three.
     *
     * All tier 2 or 1 on purpose. Rewards only ever offer tiers 1-2, so a
     * tier-3 die relic is a design that never reaches a player. */
    harmonic_pair: { name: 'Harmonic Pair', tier: 2, k: 'twinFire', v: 1,
      desc: 'If two neighbouring faces carry the same engraving, rolling either fires both at full — but that roll does not spread.',
      art: { p: [[-0.55,-0.6, -0.15,-0.6, -0.15,0.6, -0.55,0.6, -0.55,-0.6], [0.15,-0.6, 0.55,-0.6, 0.55,0.6, 0.15,0.6, 0.15,-0.6], [-0.15,-0.25, 0.15,-0.25], [-0.15,0.25, 0.15,0.25]], e: [[-0.35,0],[0.35,0]] } },
    face_lathe: { name: 'Face Lathe', tier: 1, k: 'freeReseat', v: 1,
      desc: 'The reseat jig at the bench is free and never spent. Move engravings as often as you like.',
      art: { p: [[-0.8,0.45, 0.8,0.45], [-0.5,0.45, -0.5,-0.2, 0.1,-0.2, 0.1,0.45], [0.35,-0.5, 0.75,-0.5, 0.75,0.1, 0.35,0.1, 0.35,-0.5], [0.1,-0.2, 0.35,-0.2], [-0.2,-0.5, -0.2,-0.2]], e: [[-0.2,-0.58],[0.55,-0.2]] } },
    cold_etch: { name: 'Cold Etch', tier: 2, k: 'coldEtch', v: 1,
      desc: 'The first bare face you roll each combat takes a copy of the last engraving that fired, until the fight ends.',
      art: { p: [[0,-0.75, 0,0.35], [-0.3,-0.45, 0,-0.75, 0.3,-0.45], [-0.5,0.35, 0.5,0.35], [-0.35,0.6, 0.35,0.6], [-0.62,-0.15, -0.42,-0.15], [0.42,-0.15, 0.62,-0.15]], e: [[0,0.35]] } },
    empty_chamber: { name: 'Empty Chamber', tier: 2, k: 'blankDraw', v: 1,
      desc: 'Rolling a bare face draws a card. An empty die is a hand instead of a wasted roll.',
      art: { p: [[0,-0.7, 0.6,-0.35, 0.6,0.35, 0,0.7, -0.6,0.35, -0.6,-0.35, 0,-0.7], [-0.26,-0.26, 0.26,0.26], [0.26,-0.26, -0.26,0.26]], e: [] } },
    ballistic_computer: { name: 'Ballistic Computer', tier: 2, k: 'foresight', v: 1,
      desc: 'You always know what your next roll will be. It is printed above the die.',
      art: { p: [[-0.7,-0.55, 0.7,-0.55, 0.7,0.3, -0.7,0.3, -0.7,-0.55], [-0.45,0.55, 0.45,0.55], [-0.3,0.3, -0.3,0.55], [0.3,0.3, 0.3,0.55], [-0.45,-0.3, -0.05,-0.3], [-0.25,-0.3, -0.25,0.05], [0.1,-0.3, 0.45,-0.3, 0.45,0.05, 0.1,0.05, 0.1,-0.3]], e: [] } },
    failsafe_governor: { name: 'Failsafe Governor', tier: 2, k: 'misfireReroll', v: 1,
      desc: 'The first roll each turn that would jam is rerolled once. The second one stands.',
      art: { p: [[0,-0.62, 0.44,-0.36, 0.44,0.16, 0,0.42, -0.44,0.16, -0.44,-0.36, 0,-0.62], [0,-0.62, 0,-0.86], [-0.2,-0.78, 0,-0.86, 0.1,-0.66], [-0.6,0.5, 0.6,0.5], [-0.44,0.16, -0.6,0.5], [0.44,0.16, 0.6,0.5]], e: [[0,-0.1]] } },
    manual_override: { name: 'Manual Override', tier: 2, k: 'openHigh', v: 1,
      desc: 'The opening roll of every combat is not rolled — it lands on your highest engraved face.',
      art: { p: [[-0.15,0.7, -0.15,-0.2, -0.4,-0.2, 0,-0.7, 0.4,-0.2, 0.15,-0.2, 0.15,0.7], [-0.65,0.7, 0.65,0.7]], e: [[0,-0.7]] } },
    stutter_bearing: { name: 'Stutter Bearing', tier: 2, k: 'stutter', v: 1,
      desc: 'Roll the same face twice in a row and it fires a third time, free.',
      art: { p: [[0,-0.6, 0.52,-0.3, 0.52,0.3, 0,0.6, -0.52,0.3, -0.52,-0.3, 0,-0.6], [-0.22,-0.22, 0.22,-0.22, 0.22,0.22, -0.22,0.22, -0.22,-0.22], [-0.8,-0.15, -0.62,-0.15], [0.62,-0.15, 0.8,-0.15], [-0.8,0.15, -0.62,0.15], [0.62,0.15, 0.8,0.15]], e: [[0,0]] } },
    /* THE CHAIN, BOTH DIRECTIONS. The spread is bought with the card's cost
     * now, so these are the two ways to argue with that: pay the floor up, or
     * refuse the spread entirely and put everything into one face. They are
     * deliberately incompatible builds. */
    hair_trigger: { name: 'Hair Trigger', tier: 2, k: 'cheapReach', v: 1,
      desc: 'Your 0- and 1-cost cards spread as though they cost 2 — one neighbour, upward. Cheap decks chain again.',
      art: { p: [[-0.6,0.35, -0.15,0.35, -0.15,-0.15, 0.25,-0.15], [-0.15,-0.15, -0.42,-0.5], [0.25,-0.15, 0.6,-0.15, 0.6,0.35], [-0.75,0.6, 0.75,0.6]], e: [[-0.42,-0.5],[0.6,0.35]] } },
    solid_slug: { name: 'Solid Slug', tier: 2, k: 'noSpreadDouble', v: 1,
      desc: 'Any roll that would spread does not — the face you land on fires twice instead. A tall die, not a wide one.',
      art: { p: [[-0.3,0.65, -0.3,-0.15, 0,-0.6, 0.3,-0.15, 0.3,0.65, -0.3,0.65], [-0.3,0.3, 0.3,0.3], [-0.72,0.1, -0.52,0.1], [0.52,0.1, 0.72,0.1]], e: [[0,-0.6]] } },
    deadman_regulator: { name: 'Deadman Regulator', tier: 2, k: 'noTails', v: 1,
      desc: 'You can no longer misfire — and you can no longer crit. Both tails come off the table.',
      art: { p: [[-0.8,0.3, -0.4,0.3, -0.15,-0.3, 0.15,-0.3, 0.4,0.3, 0.8,0.3], [-0.8,-0.5, -0.55,-0.5], [0.55,-0.5, 0.8,-0.5], [-0.68,-0.62, -0.68,-0.38], [0.68,-0.62, 0.68,-0.38]], e: [] } },
    /* THE ONE THAT CHANGES THE DIE'S SHAPE. Growth only: toggling it off would
     * otherwise strand whatever you had engraved on the new faces, so the grind
     * is permanent and the slot is yours again afterwards. */
    facet_grinder: { name: 'Facet Grinder', tier: 2, k: 'extraFaces', v: 2,
      desc: 'Grinds two new bare faces into your die, permanently. More room to cut — and longer odds on every face you own.',
      art: { p: [[0,-0.8, 0.55,-0.5, 0.7,0.1, 0.3,0.62, -0.3,0.62, -0.7,0.1, -0.55,-0.5, 0,-0.8], [-0.3,-0.3, 0.3,-0.3, 0.42,0.2, 0,0.45, -0.42,0.2, -0.3,-0.3], [0.55,-0.5, 0.3,-0.3], [-0.55,-0.5, -0.3,-0.3], [0.7,0.1, 0.42,0.2]], e: [[0.62,-0.68],[-0.62,-0.68]] } },
    counterweight: { name: 'Counterweight', tier: 2, cls: 'vanguard', k: 'rerollOnes', v: 1,
      desc: 'A natural 1 is rerolled once. Turns off anything you built on face 1.',
      art: { p: [[0,-0.7, 0.2,-0.3, 0,0.1, -0.2,-0.3, 0,-0.7], [-0.5,0.1, 0.5,0.1, 0.36,0.6, -0.36,0.6, -0.5,0.1], [-0.42,0.35, 0.42,0.35], [0,-0.7, 0,-0.86], [-0.66,0.1, -0.5,0.1], [0.66,0.1, 0.5,0.1]], e: [[0,-0.3],[0,0.48]] } },
    bandolier_rig: { name: 'Bandolier Rig', tier: 2, cls: 'vanguard', k: 'burstBoost', v: 0.2,
      desc: 'Every face your BURST reaches fires 20% harder.',
      art: { p: [[-0.86,-0.5, 0.86,0.3], [-0.86,-0.2, 0.86,0.6], [-0.7,-0.44, -0.66,-0.2], [-0.4,-0.3, -0.36,-0.06], [-0.1,-0.16, -0.06,0.08], [0.2,-0.02, 0.24,0.22], [0.5,0.12, 0.54,0.36]], e: [[-0.68,-0.32],[-0.38,-0.18],[-0.08,-0.04],[0.22,0.1],[0.52,0.24]] } },
    spent_brass: { name: 'Spent Brass', tier: 2, cls: 'vanguard', k: 'bankRoll', v: 1,
      desc: 'Every roll banks its number. At end of turn, bank becomes that much Bulwark.',
      art: { p: [[-0.5,0.6, -0.4,-0.2, -0.16,-0.5, 0.16,-0.5, 0.4,-0.2, 0.5,0.6, -0.5,0.6], [-0.46,0.2, 0.46,0.2], [-0.44,-0.05, 0.44,-0.05], [-0.16,-0.5, -0.16,-0.66, 0.16,-0.66, 0.16,-0.5], [-0.7,0.6, 0.7,0.6]], e: [[0,0.4],[0,0.08]] } },
    trench_ledger: { name: 'Trench Ledger', tier: 2, cls: 'vanguard', k: 'lowMight', v: 1,
      desc: 'Every roll under 6 grants 1 Stim.',
      art: { p: [[-0.4,-0.7, 0.4,-0.7, 0.5,-0.5, 0.5,0.6, -0.5,0.6, -0.5,-0.5, -0.4,-0.7], [-0.5,-0.36, 0.5,-0.36], [-0.34,-0.16, -0.34,0.16], [-0.18,-0.16, -0.18,0.16], [-0.02,-0.16, -0.02,0.16], [0.14,-0.16, 0.14,0.16], [-0.42,-0.2, 0.22,0.2], [-0.34,0.38, 0.34,0.38]], e: [[0,-0.82]] } },
    ranging_tables: { name: 'Ranging Tables', tier: 2, cls: 'vanguard', k: 'everyThird', v: 1,
      desc: 'Every third roll each combat is automatically a 20.',
      art: { p: [[-0.6,-0.6, 0.6,-0.6, 0.6,0.6, -0.6,0.6, -0.6,-0.6], [-0.6,-0.3, 0.6,-0.3], [-0.6,0.0, 0.6,0.0], [-0.6,0.3, 0.6,0.3], [-0.2,-0.6, -0.2,0.6], [0.2,-0.6, 0.2,0.6], [-0.86,-0.44, -0.6,-0.44], [0.86,0.44, 0.6,0.44]], e: [[0.4,0.45],[0.4,-0.15]] } },
    /* `rollBonus` added to the effective roll, which under steering IS the
     * landed face — so it moved your band without moving your die, and read as
     * a rule that contradicted the class. It buys travel now. */
    long_shots_debt: { name: "The Long Shot's Debt", tier: 2, cls: 'vanguard',
      hooks: [{ k: 'steerCap', v: 2 }, { k: 'misfireWiden', v: 2 }],
      desc: 'Your Aim steers 2 faces further — but a misfire now triggers on 1-3.',
      art: { p: [[-0.86,0.3, 0.3,-0.4], [0.3,-0.4, 0.1,-0.36], [0.3,-0.4, 0.26,-0.2], [-0.5,-0.5, -0.5,-0.14], [-0.5,-0.5, -0.14,-0.5], [0.66,0.5, 0.66,0.14], [0.66,0.5, 0.3,0.5], [-0.3,0.5, 0.0,0.5]], e: [[0.5,-0.55],[-0.7,0.6]] } },
    stripped_rifling: { name: 'Stripped Rifling', tier: 2, cls: 'vanguard',
      hooks: [{ k: 'critWiden', v: 1 }, { k: 'bandShift', v: -1 }],
      desc: 'Crit on 19 as well as 20 — but every other band triggers 1 higher.',
      art: { p: [[-0.7,-0.3, 0.7,-0.3], [-0.7,0.2, 0.7,0.2], [-0.7,-0.3, -0.7,0.2], [0.7,-0.3, 0.7,0.2], [-0.5,-0.3, -0.34,0.2], [-0.1,-0.3, 0.06,0.2], [0.3,-0.3, 0.46,0.2], [0.7,-0.05, 0.86,-0.05]], e: [[0.9,-0.05]] } },
    twinned_pin: { name: 'Twinned Firing Pin', tier: 2, cls: 'vanguard', k: 'burstPlusRelic', v: 2,
      desc: 'Your BURSTs walk 2 faces further.',
      art: { p: [[-0.24,-0.7, -0.24,0.4], [0.24,-0.7, 0.24,0.4], [-0.24,0.4, -0.16,0.66, 0.16,0.66, 0.24,0.4], [-0.4,-0.7, -0.08,-0.7], [0.08,-0.7, 0.4,-0.7], [-0.66,-0.1, -0.4,-0.1], [0.66,-0.1, 0.4,-0.1]], e: [[0,0.66],[-0.72,-0.1],[0.72,-0.1]] } },
    deadeye_reticle: { name: 'Deadeye Reticle', tier: 2, cls: 'vanguard',
      hooks: [{ k: 'rollAdv', v: 1 }, { k: 'maxHpPct', v: 0.15 }],
      desc: 'Roll twice and take the higher — paid for out of your Max HP.',
      art: { p: [[0,-0.86, 0,-0.4], [0,0.86, 0,0.4], [-0.86,0, -0.4,0], [0.86,0, 0.4,0], [-0.4,-0.4, 0.4,-0.4, 0.4,0.4, -0.4,0.4, -0.4,-0.4], [-0.16,-0.16, 0.16,-0.16, 0.16,0.16, -0.16,0.16, -0.16,-0.16], [-0.56,-0.56, -0.4,-0.4], [0.56,0.56, 0.4,0.4]], e: [[0,0]] } },

    /* ---- VANGUARD: aim, walk, commit --------------------------------
     * His verb is STEERING — the die moves, the number does not. So his die
     * relics are about what the walk costs, how far it reaches, and what you
     * get for giving it up entirely. */
    double_feed: { name: 'Double Feed', tier: 2, cls: 'vanguard',
      hooks: [{ k: 'twinRoll', v: 1 }, { k: 'steerCap', v: -99 }],
      desc: 'Every attack rolls a second time. The second round deals damage only — it does not chain — and your Aim can no longer steer.',
      art: { p: [[-0.35,-0.7, -0.35,0.5], [0.35,-0.7, 0.35,0.5], [-0.55,0.5, -0.15,0.5, -0.15,0.72, -0.55,0.72, -0.55,0.5], [0.15,0.5, 0.55,0.5, 0.55,0.72, 0.15,0.72, 0.15,0.5], [-0.35,-0.7, -0.62,-0.4], [0.35,-0.7, 0.62,-0.4]], e: [[-0.35,-0.7],[0.35,-0.7]] } },
    reversible_sear: { name: 'Reversible Sear', tier: 2, cls: 'vanguard', k: 'burstBack', v: 1,
      desc: 'Your BURSTs walk both ways around the die at once, not just forward.',
      art: { p: [[-0.75,0, 0.75,0], [-0.75,0, -0.45,-0.28], [-0.75,0, -0.45,0.28], [0.75,0, 0.45,-0.28], [0.75,0, 0.45,0.28], [0,-0.55, 0,0.55]], e: [[0,-0.55],[0,0.55]] } },
    overrun_cam: { name: 'Overrun Cam', tier: 2, cls: 'vanguard', k: 'wrapSteer', v: 1,
      desc: 'Steering off the top of the die wraps around to the bottom — and the face you went over fires too.',
      art: { p: [[0,-0.65, 0.56,-0.32, 0.56,0.32, 0,0.65, -0.56,0.32, -0.56,-0.32, 0,-0.65], [0,-0.86, 0.3,-0.6], [0,-0.86, -0.02,-0.5], [-0.25,0.15, 0.25,-0.15]], e: [[-0.25,0.15],[0.25,-0.15]] } },
    zeroing_stake: { name: 'Zeroing Stake', tier: 2, cls: 'vanguard', k: 'stakeFace', v: 1,
      desc: 'Your highest engraved face is staked at the start of each combat. Your first attack each turn grazes it, wherever you actually land.',
      art: { p: [[0,0.75, 0,-0.45], [0,-0.45, 0.5,-0.6, 0.5,-0.15, 0,-0.3], [-0.4,0.75, 0.4,0.75], [-0.62,-0.6, -0.42,-0.6], [-0.62,-0.3, -0.42,-0.3]], e: [[0,-0.45]] } },
    trench_sweep: { name: 'Trench Sweep', tier: 1, cls: 'vanguard', k: 'steerWall', v: 1,
      desc: 'Every face your steer walks over grants 1 Bulwark. A long climb builds the wall on the way.',
      art: { p: [[-0.85,0.45, -0.5,0.45, -0.5,0.05, -0.15,0.05, -0.15,-0.3, 0.2,-0.3, 0.2,-0.6, 0.85,-0.6], [-0.85,0.68, 0.85,0.68]], e: [[-0.5,0.45],[-0.15,0.05],[0.2,-0.3]] } },
    fumble_drill: { name: 'Fumble Drill', tier: 1, cls: 'vanguard',
      hooks: [{ k: 'misfireStim', v: 2 }, { k: 'misfireWall', v: 6 }],
      desc: 'A jam grants 2 Stim and 6 Bulwark. The worst roll on the die becomes the one you drilled for.',
      art: { p: [[-0.6,-0.55, 0.6,-0.55, 0.6,0.15, 0,0.65, -0.6,0.15, -0.6,-0.55], [-0.35,-0.3, 0.35,-0.3], [-0.2,-0.05, 0.2,-0.05], [-0.6,-0.75, 0.6,-0.75]], e: [[0,0.65]] } },
    overpressure_load: { name: 'Overpressure Load', tier: 2, cls: 'vanguard', k: 'heavyReach', v: 1,
      desc: 'Your 3-cost cards shake four faces instead of two. The heaviest rounds finally earn their price.',
      art: { p: [[0,-0.5, 0,0.5], [-0.28,-0.42, -0.28,0.42], [0.28,-0.42, 0.28,0.42], [-0.56,-0.28, -0.56,0.28], [0.56,-0.28, 0.56,0.28], [-0.8,0.62, 0.8,0.62]], e: [[0,-0.5],[-0.56,-0.28],[0.56,-0.28],[-0.28,-0.42],[0.28,-0.42]] } },

    /* ---- TECHNOMANCER: relics that shape the die ---------------------
     * His table is LOAD BALANCE — the widest spread of the three, it scales
     * Shield as well as damage, and he gets no Aim to steer with. So his die
     * relics are not accuracy: they are REDUNDANCY. Every one of them either
     * pays him for the sag he cannot avoid, widens what a single roll touches,
     * or turns a tripped BREAKER from a loss into a resource. A machine does
     * not aim better; it routes around the fault.
     * ---------------------------------------------------------------- */
    trip_coil: { name: 'Trip Coil', tier: 1, cls: 'technomancer', k: 'breakerBlock', v: 4,
      desc: 'A tripped BREAKER also plates you for 4 Shield.',
      art: { p: [[-0.8,-0.3, -0.3,-0.3], [-0.3,-0.3, -0.1,-0.6, 0.1,0.0, 0.3,-0.3], [0.3,-0.3, 0.8,-0.3], [-0.5,0.2, 0,0.4, 0.5,0.2, 0.5,0.5, 0,0.75, -0.5,0.5, -0.5,0.2], [-0.5,0.2, 0.5,0.2]], e: [[0,0.44]] } },
    bus_primer: { name: 'Bus Primer', tier: 1, cls: 'technomancer', k: 'sagEnergy', v: 1,
      desc: 'Every roll that SAGs refunds 1 Energy — a slow bus is not a dead one.',
      art: { p: [[-0.8,0.4, -0.4,0.4, -0.2,0.1, 0.1,0.5, 0.3,0.2, 0.8,0.2], [-0.6,-0.6, -0.6,-0.15], [-0.2,-0.6, -0.2,-0.15], [0.2,-0.6, 0.2,-0.15], [0.6,-0.6, 0.6,-0.15], [-0.8,-0.15, 0.8,-0.15]], e: [[-0.6,-0.72],[0.2,-0.72]] } },
    parity_pin: { name: 'Parity Pin', tier: 1, cls: 'technomancer', k: 'evenMirror', v: 1,
      desc: 'An EVEN roll also fires the face opposite it, at the bleed.',
      art: { p: [[0,-0.85, 0,0.85], [-0.5,-0.6, 0.5,-0.6], [-0.5,0.6, 0.5,0.6], [-0.5,-0.6, -0.75,0], [-0.5,0.6, -0.75,0], [0.5,-0.6, 0.75,0], [0.5,0.6, 0.75,0], [-0.3,0, 0.3,0]], e: [[-0.75,0],[0.75,0]] } },
    annealing_jig: { name: 'Annealing Jig', tier: 1, cls: 'technomancer', k: 'weldWard', v: 1,
      desc: 'Cold Welds never take. Every scar the void cuts can still be ground out.',
      art: { p: [[-0.7,0.55, 0.7,0.55], [-0.5,0.55, -0.5,0.1, 0.5,0.1, 0.5,0.55], [-0.25,0.1, -0.25,-0.35, 0.25,-0.35, 0.25,0.1], [0,-0.35, 0,-0.7], [-0.35,-0.7, 0.35,-0.7], [-0.2,-0.86, 0.2,-0.86]], e: [[0,-0.12]] } },

    cascade_coupler: { name: 'Cascade Coupler', tier: 2, cls: 'technomancer', k: 'bleedSpan', v: 1,
      desc: 'The bleed carries two faces further either way, at half again.',
      art: { p: [[-0.86,0.5, -0.5,0.5, -0.5,0.1], [-0.5,0.1, -0.15,0.1, -0.15,-0.3], [-0.15,-0.3, 0.2,-0.3, 0.2,0.1], [0.2,0.1, 0.55,0.1, 0.55,0.5], [0.55,0.5, 0.86,0.5], [-0.15,-0.3, -0.15,-0.7], [-0.4,-0.7, 0.1,-0.7]], e: [[-0.5,0.1],[0.2,0.1]] } },
    heat_ledger: { name: 'Heat Ledger', tier: 2, cls: 'technomancer', k: 'surgeShield', v: 3,
      desc: 'Every roll that SURGEs plates you for 3 Shield. Waste heat is armour.',
      art: { p: [[-0.55,0.7, -0.4,-0.3, 0.4,-0.3, 0.55,0.7, -0.55,0.7], [-0.46,0.25, 0.46,0.25], [-0.3,-0.3, -0.3,-0.55, 0.3,-0.55, 0.3,-0.3], [-0.2,-0.7, -0.12,-0.86], [0.05,-0.7, 0.13,-0.86], [-0.24,0.5, 0.24,0.5]], e: [[0,-0.05]] } },
    duty_cycle: { name: 'Duty Cycle', tier: 2, cls: 'technomancer', k: 'parityBand', v: 3,
      desc: 'ODD rolls read 3 higher on the table. EVEN rolls read 3 lower.',
      art: { p: [[-0.86,0.3, -0.6,0.3, -0.6,-0.3, -0.2,-0.3, -0.2,0.3, 0.2,0.3, 0.2,-0.3, 0.6,-0.3, 0.6,0.3, 0.86,0.3], [-0.86,0.6, 0.86,0.6], [-0.6,0.6, -0.6,0.72], [0.2,0.6, 0.2,0.72]], e: [[-0.4,-0.42],[0.4,-0.42]] } },
    sacrificial_fuse: { name: 'Sacrificial Fuse', tier: 2, cls: 'technomancer',
      hooks: [{ k: 'misfireWiden', v: 2 }, { k: 'breakerEnergy', v: 2 }],
      desc: 'Breakers now trip on 1-3 — and every one of them dumps 2 extra Energy.',
      art: { p: [[-0.8,0, -0.5,0], [-0.5,-0.3, 0.5,-0.3, 0.5,0.3, -0.5,0.3, -0.5,-0.3], [0.5,0, 0.8,0], [-0.35,0.15, -0.1,-0.15, 0.1,0.15, 0.35,-0.15], [-0.5,-0.45, 0.5,-0.45]], e: [[-0.8,0],[0.8,0]] } },
    hot_spare: { name: 'Hot Spare', tier: 2, cls: 'technomancer', k: 'rerollSag', v: 1,
      desc: 'A roll under 8 is rerolled once. You keep the second, whatever it is.',
      art: { p: [[-0.45,-0.55, 0.15,-0.55, 0.15,0.05, -0.45,0.05, -0.45,-0.55], [-0.15,-0.25, 0.45,-0.25, 0.45,0.35, -0.15,0.35], [-0.15,0.35, -0.15,0.05], [0.15,-0.25, 0.15,0.05], [-0.6,0.6, 0.6,0.6], [-0.3,-0.7, -0.3,-0.86], [0.3,0.5, 0.3,0.7]], e: [[-0.3,-0.86]] } },

    regulator_clamp: { name: 'Regulator Clamp', tier: 3, cls: 'technomancer', k: 'bandFloor', v: 8,
      desc: 'Every roll reads as at least 8 on the table. Your die cannot SAG.',
      art: { p: [[-0.7,-0.6, -0.7,0.2, 0.7,0.2, 0.7,-0.6], [-0.7,0.2, -0.86,0.5], [0.7,0.2, 0.86,0.5], [-0.86,0.5, 0.86,0.5], [-0.35,-0.6, -0.35,-0.2], [0,-0.6, 0,-0.2], [0.35,-0.6, 0.35,-0.2], [-0.5,-0.75, 0.5,-0.75]], e: [[0,0.36]] } },
    distribution_frame: { name: 'Distribution Frame', tier: 3, cls: 'technomancer',
      hooks: [{ k: 'relayAll', v: 1 }, { k: 'rootHalf', v: 1 }],
      desc: 'Neighbouring faces fire at FULL — but the face you actually rolled fires at half.',
      art: { p: [[0,-0.15, -0.7,-0.15, -0.7,0.6], [0,-0.15, 0.7,-0.15, 0.7,0.6], [0,-0.15, 0,-0.75], [-0.86,0.6, -0.54,0.6], [0.54,0.6, 0.86,0.6], [-0.3,-0.75, 0.3,-0.75], [-0.2,0.15, 0.2,0.15]], e: [[-0.7,0.6],[0.7,0.6],[0,-0.15]] } },
    substation: { name: 'Substation', tier: 3, cls: 'technomancer', k: 'faceEcho', v: 1,
      desc: 'The first face you fire each turn fires again at the end of that turn.',
      art: { p: [[-0.6,0.7, -0.6,-0.5, -0.2,-0.75, -0.2,0.7], [0.2,0.7, 0.2,-0.75, 0.6,-0.5, 0.6,0.7], [-0.75,0.7, 0.75,0.7], [-0.4,-0.62, -0.4,0.7], [0.4,-0.62, 0.4,0.7], [-0.2,-0.3, 0.2,-0.3], [-0.2,0.1, 0.2,0.1]], e: [[-0.4,-0.86],[0.4,-0.86]] } },

    /* ---- VOID ADEPT: relics that shape the die -----------------------
     * His table is THE HUNGER, and it is a U: the BOTTOM hits harder than the
     * middle and bills him in HP, so WHISPER — the most common face — is his
     * worst outcome. Every relic here is written for one of the two ENDS and
     * none for the middle, because the middle is the thing he is supposed to be
     * escaping. Where the Vanguard buys accuracy and the Technomancer buys
     * redundancy, the Adept buys DEPTH: he pays in blood to fall further.
     * ---------------------------------------------------------------- */
    ashen_tithe: { name: 'Ashen Tithe', tier: 1, cls: 'voidadept', k: 'hungerDraw', v: 1,
      desc: 'Every roll that lands in HUNGER draws a card. The low road pays.',
      art: { p: [[-0.5,-0.5, 0.1,-0.5, 0.1,0.35, -0.5,0.35, -0.5,-0.5], [-0.25,-0.7, 0.35,-0.7, 0.35,0.15], [-0.35,-0.2, -0.05,-0.2], [-0.35,0.0, -0.05,0.0], [-0.3,0.55, 0.3,0.75], [-0.3,0.75, 0.3,0.55]], e: [[0,0.65]] } },
    bloodletters_nail: { name: "Bloodletter's Nail", tier: 1, cls: 'voidadept', k: 'hplossPsi', v: 1,
      desc: 'Whenever the die bills you in HP, gain 1 Psi Focus. The wound focuses.',
      art: { p: [[0,-0.8, 0.1,-0.5, 0.1,0.35, 0,0.75, -0.1,0.35, -0.1,-0.5, 0,-0.8], [-0.28,-0.5, 0.28,-0.5], [-0.5,0.1, -0.34,-0.1], [0.5,0.1, 0.34,-0.1], [-0.42,0.5, -0.34,0.32], [0.42,0.5, 0.34,0.32]], e: [[-0.5,0.16],[0.5,0.16]] } },
    twin_maw: { name: 'Twin Maw', tier: 1, cls: 'voidadept', k: 'extremeRelay', v: 1,
      desc: 'A natural 20 — or a misfire — also fires the face opposite it, at FULL.',
      art: { p: [[-0.85,-0.4, -0.35,0, -0.85,0.4], [-0.85,-0.4, -0.5,-0.15, -0.85,0.05], [0.85,-0.4, 0.35,0, 0.85,0.4], [0.85,-0.4, 0.5,-0.15, 0.85,0.05], [-0.35,0, 0.35,0], [-0.1,-0.3, 0.1,-0.3], [-0.1,0.3, 0.1,0.3]], e: [[0,0]] } },
    scarfeeder: { name: 'Scarfeeder', tier: 1, cls: 'voidadept', k: 'taintMight', v: 1,
      desc: 'Start each combat with 1 Might for every scar cut into your die.',
      art: { p: [[0,-0.8, 0.55,-0.45, 0.55,0.35, 0,0.75, -0.55,0.35, -0.55,-0.45, 0,-0.8], [-0.4,-0.5, 0.35,0.3], [-0.35,0.35, 0.3,-0.45], [-0.45,0.05, 0.15,0.55], [-0.15,-0.65, 0.45,-0.05]], e: [[0,-0.05]] } },

    crimson_ledger: { name: 'Crimson Ledger', tier: 2, cls: 'voidadept', k: 'hplossDmg', v: 2,
      desc: 'Every HP the die bills you adds 2 damage to that card.',
      art: { p: [[-0.4,-0.7, 0.4,-0.7, 0.5,-0.5, 0.5,0.6, -0.5,0.6, -0.5,-0.5, -0.4,-0.7], [-0.5,-0.36, 0.5,-0.36], [-0.32,-0.1, 0.32,-0.1], [-0.32,0.12, 0.32,0.12], [-0.32,0.34, 0.05,0.34], [0,-0.86, 0,-0.7], [-0.16,-0.78, 0.16,-0.78]], e: [[0.3,0.34]] } },
    widening_maw: { name: 'Widening Maw', tier: 2, cls: 'voidadept', k: 'lowWiden', v: 3,
      desc: 'The HUNGER band reaches 3 higher. Your middle shrinks; your blood pays for it.',
      art: { p: [[-0.86,-0.55, -0.2,-0.05, -0.86,0.45], [0.86,-0.55, 0.2,-0.05, 0.86,0.45], [-0.2,-0.05, 0.2,-0.05], [-0.5,0.6, 0.5,0.6], [-0.5,0.6, -0.62,0.42], [0.5,0.6, 0.62,0.42], [-0.35,-0.7, 0.35,-0.7]], e: [[0,-0.05]] } },
    second_mouth: { name: 'Second Mouth', tier: 2, cls: 'voidadept', k: 'bleedEnds', v: 1,
      desc: 'A face in the TOP or BOTTOM band bleeds at FULL instead of a quarter.',
      art: { p: [[-0.75,-0.35, 0,-0.6, 0.75,-0.35], [-0.75,-0.35, 0,-0.1, 0.75,-0.35], [-0.55,0.35, 0,0.15, 0.55,0.35], [-0.55,0.35, 0,0.6, 0.55,0.35], [-0.4,-0.35, 0.4,-0.35], [-0.3,0.35, 0.3,0.35]], e: [[0,-0.35],[0,0.35]] } },
    the_long_fast: { name: 'The Long Fast', tier: 2, cls: 'voidadept',
      hooks: [{ k: 'rollBonus', v: -4 }, { k: 'dmgMult', v: 0.15 }],
      desc: '-4 to every roll — and +15% damage. The void feeds those who fall toward it.',
      art: { p: [[-0.5,-0.75, 0.5,-0.75], [0,-0.75, 0,0.5], [-0.3,0.5, 0.3,0.5, 0.2,0.8, -0.2,0.8, -0.3,0.5], [-0.35,-0.4, 0,-0.15], [0.35,-0.4, 0,-0.15], [-0.35,0.0, 0,0.25], [0.35,0.0, 0,0.25]], e: [[0,0.66]] } },
    gorge: { name: 'Gorge', tier: 2, cls: 'voidadept', k: 'lowHeal', v: 2,
      desc: 'A roll in HUNGER or RAVENOUS heals 2 HP once the card has resolved.',
      art: { p: [[0,0.75, -0.7,-0.15, -0.4,-0.6, 0,-0.25, 0.4,-0.6, 0.7,-0.15, 0,0.75], [-0.4,-0.15, 0.4,-0.15], [-0.25,0.1, 0.25,0.1], [-0.86,-0.5, -0.7,-0.35], [0.86,-0.5, 0.7,-0.35]], e: [[0,0.35]] } },

    wound_echo: { name: 'Wound Echo', tier: 3, cls: 'voidadept', k: 'ravenousEcho', v: 1,
      desc: 'A RAVENOUS misfire resolves the card TWICE. It costs what it costs.',
      art: { p: [[-0.7,-0.6, -0.15,0, -0.7,0.6], [-0.35,-0.6, 0.2,0, -0.35,0.6], [0,-0.6, 0.55,0, 0,0.6], [0.35,-0.6, 0.9,0, 0.35,0.6], [-0.86,-0.3, -0.7,-0.3], [-0.86,0.3, -0.7,0.3]], e: [[-0.86,0]] } },
    the_devouring: { name: 'The Devouring', tier: 3, cls: 'voidadept', k: 'lowCrit', v: 4,
      desc: 'A natural 2, 3 or 4 crits as surely as a 20. Both ends of the die bite.',
      art: { p: [[0,-0.85, 0.25,-0.3, 0.85,-0.25, 0.4,0.15, 0.55,0.75, 0,0.45, -0.55,0.75, -0.4,0.15, -0.85,-0.25, -0.25,-0.3, 0,-0.85], [-0.25,-0.3, 0.25,-0.3], [-0.4,0.15, 0.4,0.15], [-0.15,-0.05, 0.15,-0.05]], e: [[0,-0.05]] } },
    hollow_crown: { name: 'Hollow Crown', tier: 3, cls: 'voidadept', k: 'hpBand', v: 2,
      desc: 'Every 20% of Max HP you are missing shifts every band 2 lower. Ruin reads well.',
      art: { p: [[-0.7,0.45, -0.7,-0.5, -0.4,-0.15, -0.15,-0.6, 0.15,-0.15, 0.4,-0.6, 0.7,-0.15, 0.7,0.45, -0.7,0.45], [-0.7,0.2, 0.7,0.2], [-0.7,0.6, 0.7,0.6], [-0.35,0.3, -0.35,0.45], [0.35,0.3, 0.35,0.45]], e: [[0,0.34]] } },

    /* Momentum is gone from the class, so this pointed at nothing. It holds
     * the OTHER thing that burns off between turns instead. */
    cycling_breech:  { name: 'Cycling Breech',    tier: 2, cls: 'vanguard', k: 'stimHold', v: 1, desc: 'Your Stim no longer burns off between turns.',
      art: { p: [[-0.7,-0.25, 0.7,-0.25], [-0.7,0.25, 0.7,0.25], [-0.7,-0.25, -0.7,0.25], [0.7,-0.25, 0.7,0.25], [-0.35,-0.25, -0.35,0.25], [0,-0.25, 0,0.25], [0.35,-0.25, 0.35,0.25], [0.5,-0.55, 0.8,-0.55, 0.8,-0.25], [-0.5,0.55, -0.8,0.55, -0.8,0.25]] } },
    thorn_husk:      { name: 'Thornmail Husk',    tier: 1, k: 'thorns',          v: 2,    desc: 'Attackers take 2 damage.',
      art: { p: [[0,-0.6, 0.6,0, 0,0.6, -0.6,0, 0,-0.6], [0,-0.6, 0,-1], [0.6,0, 1,0], [0,0.6, 0,1], [-0.6,0, -1,0]], e: [] } },
    cryo_capsule:    { name: 'Cryo Capsule',      tier: 1, k: 'sectorHeal',      v: 0.25, desc: 'Heal 25% HP when entering a new sector.',
      art: { p: [[-0.45,-0.85, 0.45,-0.85, 0.45,0.85, -0.45,0.85, -0.45,-0.85], [-0.25,-0.55, 0.25,-0.55, 0.25,-0.05, -0.25,-0.05, -0.25,-0.55], [-0.25,0.3, 0.25,0.3], [-0.25,0.55, 0.25,0.55]], e: [[0,-0.3]] } },

    ancient_sigil:   { name: 'Ancient Sigil',     tier: 2, k: 'energyEveryTurn', v: 1,    desc: '+1 Energy every turn.',
      art: { p: [[0,-0.95, 0.95,0, 0,0.95, -0.95,0, 0,-0.95], [0,-0.5, 0.5,0, 0,0.5, -0.5,0, 0,-0.5]], e: [[0,0]] } },
    singularity:     { name: 'Singularity Engine',tier: 2, k: 'aoeTurnStart',    v: 4,    desc: 'Deal 4 damage to ALL enemies at the start of your turn.',
      art: { p: [[0.7,0, 0.5,0.5, 0,0.7, -0.5,0.5, -0.7,0, -0.45,-0.45, 0,-0.55, 0.35,-0.3, 0.4,0, 0.2,0.25, 0,0.28, -0.18,0.12, -0.15,-0.1, 0,-0.15]], e: [[0,0]] } },
    omega_visor:     { name: 'Omega Visor',       tier: 2, k: 'critDraw',        v: 1,    desc: 'Whenever you land a critical hit, draw a card.',
      art: { p: [[-0.6,0.8, -0.25,0.8, -0.25,0.55, -0.55,0.3, -0.6,-0.2, -0.3,-0.65, 0.3,-0.65, 0.6,-0.2, 0.55,0.3, 0.25,0.55, 0.25,0.8, 0.6,0.8]], e: [[-0.2,-0.2],[0.2,-0.2]] } },

    /* ============ Special passive relics ============ */
    static_capacitor: { name: 'Static Capacitor', tier: 1, k: 'shieldThorns', v: 2,
      desc: 'Whenever you gain Shield, deal 2 damage to a random enemy.',
      art: { p: [[-0.1,-0.75, -0.35,-0.05, 0.02,-0.05, -0.15,0.75, 0.4,-0.1, 0.04,-0.1, 0.28,-0.75, -0.1,-0.75]], e: [] } },
    reaper_protocol: { name: 'Reaper Protocol', tier: 1, k: 'healOnKill', v: 2,
      desc: 'Whenever you kill an enemy, heal 2 HP.',
      art: { p: [[0.45,-0.75, 0.45,0.75], [0.45,-0.7, 0.05,-0.6, -0.4,-0.25, -0.62,0.25], [-0.62,0.25, -0.2,0.05, 0.15,-0.2, 0.45,-0.5]], e: [] } },
    hoarfrost_cell: { name: 'Hoarfrost Cell', tier: 1, k: 'weakStart', v: 2,
      desc: 'At the start of each combat, apply 2 Weak to all enemies.',
      art: { p: [[0,-0.82, 0,0.82], [-0.71,-0.41, 0.71,0.41], [-0.71,0.41, 0.71,-0.41], [0,-0.82, -0.18,-0.6], [0,-0.82, 0.18,-0.6], [0,0.82, -0.18,0.6], [0,0.82, 0.18,0.6], [0.71,-0.41, 0.5,-0.5], [-0.71,0.41, -0.5,0.5]], e: [] } },
    bloodlust_engine: { name: 'Bloodlust Engine', tier: 2, k: 'strOnKill', v: 1,
      desc: 'Whenever an enemy dies, gain 1 Might for the rest of combat.',
      art: { p: [[-0.42,0.6, -0.42,-0.2], [-0.62,0.0, -0.42,-0.42, -0.22,0.0], [0.42,0.6, 0.42,-0.2], [0.22,0.0, 0.42,-0.42, 0.62,0.0], [0,0.5, 0,-0.55], [-0.2,-0.15, 0,-0.62, 0.2,-0.15]], e: [] } },
    overflow_reactor: { name: 'Overflow Reactor', tier: 2, k: 'energyCarry', v: 1,
      desc: 'Unused Energy carries over to your next turn.',
      art: { p: [[-0.5,-0.5, 0.5,-0.5, 0.5,0.6, -0.5,0.6, -0.5,-0.5], [-0.22,-0.5, -0.22,-0.72, 0.22,-0.72, 0.22,-0.5], [-0.22,0.15, 0.02,-0.22, 0.02,0.05, 0.26,-0.32]], e: [] } },
    glass_cannon: { name: 'Glass Cannon', tier: 2, rarity: 'boss', k: 'dmgMult', v: 0.5, special: 'glassCannon',
      desc: 'Deal 50% more damage — but your Max HP is permanently reduced by 25%.',
      art: { p: [[0.6,0, 0.42,0.42, 0,0.6, -0.42,0.42, -0.6,0, -0.42,-0.42, 0,-0.6, 0.42,-0.42, 0.6,0], [-0.72,0, 0.72,0], [0,-0.72, 0,0.72], [0.16,-0.6, 0.0,-0.2, 0.2,0.1, 0.0,0.5]], e: [] } },

    /* ============ New tradeoff / engine relics (rework batch 1) ============ */
    singularity_core: { name: 'Singularity Core', tier: 2, rarity: 'boss',
      hooks: [{ k: 'energyEveryTurn', v: 1 }, { k: 'noShield', v: 1 }],
      desc: '+1 Energy every turn — but you can no longer gain Shield. Switch it off on the star chart when you need to turtle.',
      art: { p: [[0,-0.95, 0.95,0, 0,0.95, -0.95,0, 0,-0.95], [0,-0.45, 0,0.45], [-0.45,0, 0.45,0], [-0.72,-0.72, 0.72,0.72]], e: [[0,0]] } },
    vampiric_array: { name: 'Vampiric Array', tier: 1, rarity: 'rare',
      hooks: [{ k: 'lifestealPct', v: 20 }, { k: 'noShield', v: 1 }],
      desc: 'Your attacks heal you for 20% of the damage dealt — but you can no longer gain Shield.',
      art: { p: [[-0.55,-0.7, 0,-0.2, 0.55,-0.7], [-0.55,-0.7, -0.3,0.1, 0,0.7, 0.3,0.1, 0.55,-0.7], [0,0.1, 0,0.7]], e: [[0,-0.35]] } },
    famine_engine: { name: 'Famine Engine', tier: 2, rarity: 'boss',
      hooks: [{ k: 'enemyHpScale', v: 20 }, { k: 'noCredits', v: 1 }],
      desc: 'Enemies start each combat at 20% less HP — but you gain no credits from combat.',
      art: { p: [[0,-0.85, 0.7,-0.45, 0.7,0.35, 0,0.75, -0.7,0.35, -0.7,-0.45, 0,-0.85], [-0.3,-0.25, 0.3,-0.25], [-0.2,0.05, 0.2,0.05], [-0.1,0.32, 0.1,0.32]], e: [] } },
    misfire_capacitor: { name: 'Misfire Capacitor', tier: 1, rarity: 'common', k: 'critDie1Energy', v: 1,
      desc: 'When your crit die rolls a 1, gain 1 Energy this turn.',
      art: { p: [[-0.5,-0.5, 0.5,-0.5, 0.5,0.5, -0.5,0.5, -0.5,-0.5], [0.1,-0.55, -0.2,-0.05, 0.15,-0.05, -0.15,0.55]], e: [[-0.28,-0.28],[0.28,0.28]] } },
    reclaimer_unit: { name: 'Reclaimer Unit', tier: 1, rarity: 'common', k: 'reshuffleShield', v: 3,
      desc: 'Whenever your draw pile reshuffles, gain 3 Shield.',
      art: { p: [[0.55,-0.2, 0.55,-0.55, 0.2,-0.55], [0.55,-0.55, 0.1,-0.1, -0.35,-0.45], [-0.55,0.2, -0.55,0.55, -0.2,0.55], [-0.55,0.55, -0.1,0.1, 0.35,0.45]], e: [] } },
    resonance_coil: { name: 'Resonance Coil', tier: 1, rarity: 'common', k: 'firstPowerDraw', v: 1,
      desc: 'The first Power you play each combat, draw a card.',
      art: { p: [[-0.7,0, -0.5,-0.4, -0.1,-0.4, 0.1,0, -0.1,0.4, -0.5,0.4, -0.7,0, 0.7,0], [0.7,0, 0.5,-0.35, 0.2,-0.35]], e: [[-0.3,0]] } },

    /* ============ Class-specific relics ============ */
    recoilless_frame: { name: 'Recoilless Frame', tier: 1, rarity: 'class', cls: 'vanguard', 
      hooks: [{ k: 'flatDmg', v: 5 }, { k: 'maxNonAttack', v: 1 }],
      desc: 'Your attacks deal +5 — but you may play at most 1 non-attack card per turn. Toggle it off on the star chart when you need to set up.',
      art: { p: [[-0.75,0.05, 0.75,0.05], [-0.75,0.05, -0.6,0.4], [0.75,0.05, 0.6,0.4], [-0.4,0.05, -0.4,-0.4, 0.4,-0.4, 0.4,0.05], [0,-0.4, 0,-0.65]], e: [[0,-0.5]] } },
    execution_protocol: { name: 'Execution Protocol', tier: 1, rarity: 'class', cls: 'vanguard', k: 'executeBonus', v: 1,
      desc: 'Your attacks deal double damage to enemies below 25% HP, and to any enemy while YOU are below 25%.',
      art: { p: [[0,-0.7, 0,0.7], [-0.45,-0.45, 0,-0.7, 0.45,-0.45], [-0.3,0.3, 0.3,0.3], [-0.45,0.55, 0.45,0.55]], e: [[0,0]] } },
    forge_reserve: { name: 'Forge Reserve', tier: 1, rarity: 'class', cls: 'technomancer', k: 'blockStartTechMul', v: 3,
      desc: 'Start each combat with Shield equal to 3× your TECH.',
      art: { p: [[0,-0.8, 0.7,-0.4, 0.7,0.4, 0,0.8, -0.7,0.4, -0.7,-0.4, 0,-0.8], [-0.35,-0.2, 0.35,-0.2, 0.35,0.3, -0.35,0.3, -0.35,-0.2], [-0.35,0.05, 0.35,0.05]], e: [[0,-0.5]] } },
    capacitive_plating: { name: 'Capacitive Plating', tier: 1, rarity: 'class', cls: 'technomancer', k: 'shieldPingPct', v: 34,
      desc: 'Whenever you gain Shield, deal 1 damage per 3 Shield gained to a random enemy.',
      art: { p: [[-0.6,-0.5, 0.6,-0.5, 0.6,0.5, -0.6,0.5, -0.6,-0.5], [-0.6,-0.15, 0.6,-0.15], [-0.6,0.2, 0.6,0.2], [0.15,-0.5, -0.1,-0.1, 0.1,-0.1, -0.15,0.2]], e: [] } },
    hexweaver: { name: 'Hexweaver', tier: 1, rarity: 'class', cls: 'voidadept', k: 'hexweaver', v: 2,
      desc: 'Whenever you apply Weak or Vulnerable to an enemy, also apply 2 Burn.',
      art: { p: [[0,-0.75, 0.65,-0.38, 0.65,0.38, 0,0.75, -0.65,0.38, -0.65,-0.38, 0,-0.75], [0,-0.4, 0,0.4], [-0.35,-0.2, 0.35,0.2], [0.35,-0.2, -0.35,0.2]], e: [[0,0]] } },
    void_conduit: { name: 'Void Conduit', tier: 1, rarity: 'class', cls: 'voidadept', k: 'firstPowerFree', v: 1,
      desc: 'The first Power you play each combat costs 0.',
      art: { p: [[0,-0.85, 0.4,-0.05, 0.18,0.85, -0.18,0.65, -0.4,-0.15, 0,-0.85], [0,-0.55, 0.05,0.5]], e: [[0,-0.15]] } },
  };

  // Sum of v over owned artifacts matching hook k.
  ns.artifactSum = function (owned, k) {
    var t = 0;
    for (var i = 0; i < owned.length; i++) {
      var a = ns.ARTIFACTS[owned[i]];
      if (a && a.k === k) t += a.v;
    }
    return t;
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
