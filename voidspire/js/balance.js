/* =========================================================================
 * VOIDSPIRE — balance.js
 * Every tunable number in the game lives here. Tweak freely.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.BALANCE = {

    /* ---- Player ----------------------------------------------------- */
    player: {
      baseEnergy: 3,            // energy gained at the start of each turn
      drawPerTurn: 5,           // cards drawn at the start of each turn
      maxHand: 10,              // cards beyond this are not drawn
      startCredits: 30,
    },

    /* ---- Classes ---------------------------------------------------- */
    classes: {
      vanguard:  { hp: 80, might: 2, tech: 0, psi: 0 },
      technomancer: { hp: 68, might: 0, tech: 2, psi: 0 },
      voidadept: { hp: 80, might: 0, tech: 0, psi: 2 },
    },

    /* ---- Attribute scaling ------------------------------------------ */
    attrs: {
      mightDmgPerPoint: 1.7,    // bonus damage per MIGHT (trimmed: Vanguard led parity by ~10pts)
      techBlockPerPoint: 1,     // bonus block per TECH on tech-scaling skills
      mightBlockPerPoint: 1,    // bonus block per MIGHT on primary-scaling skills
      psiBlockPerPoint: 1,      // bonus block per PSI on primary-scaling skills
      psiDmgPerPoint: 1.55,     // bonus damage per PSI (raised: Voidadept trailed parity)
      eventCheckBonusDiv: 1,    // event check bonus = attr / this (rounded down)
    },

    /* ---- d20 / crits ------------------------------------------------
     * One die, read three ways. A 20 always crits and the top of the table is
     * the same for everyone — what separates the classes is what a BAD roll
     * MEANS. The Vanguard wastes it, the Technomancer converts it to tempo, the
     * Voidadept converts it to power and pays in blood. That is the whole
     * design: three answers to the same question, not three sets of numbers.
     * ---------------------------------------------------------------- */
    dice: {
      critThreshold: 20,        // roll + Aim >= (threshold - critBonus) crits
      critMult: 2.0,            // crit damage multiplier
      misfireMult: 0.5,         // legacy fallback for a class with no table
      baseAim: 1,               // every class steers the die a little — it is a game-wide system

      classes: {
        /* MARKSMANSHIP — accuracy. The shot lands well or it goes wide. */
        vanguard: {
          name: 'MARKSMANSHIP',
          read: 'A low face grazes and a natural 1 goes wide. Aim climbs the table.',
          aim: 1,               // the marksman sights in further on top of the base
          misfire: { mult: 0.5, label: 'MISFIRE' },
          bands: [
            { min: 15, mult: 1.25, label: 'SOLID' },
            { min: 8,  mult: 1.0,  label: 'HIT' },
            { min: 2,  mult: 0.8,  label: 'GRAZE' },
          ],
        },

        /* LOAD BALANCE — throughput. A machine does not miss, it sags. The band
         * scales Shield as well as damage, so the die reads on a defensive turn
         * too, and a tripped breaker dumps its charge back as Energy. */
        technomancer: {
          name: 'LOAD BALANCE',
          read: 'The band scales Shield as well as damage. A tripped breaker dumps its charge back as Energy.',
          blocks: true,
          // A wider spread than the Vanguard's: a reactor swings. The answer is
          // not to steer (he gets no extra Aim) but to build redundancy, and a
          // tripped breaker is never dead — it dumps its charge back as Energy.
          misfire: { mult: 0.6, label: 'BREAKER', energy: 1 },
          bands: [
            { min: 15, mult: 1.35, label: 'SURGE' },
            { min: 8,  mult: 1.0,  label: 'NOMINAL' },
            { min: 2,  mult: 0.7,  label: 'SAG' },
          ],
        },

        /* THE HUNGER — appetite. The void always answers; the only question is
         * who pays. The bottom of the die is STRONGER than the middle and bills
         * you in HP, so Aim is a genuine trade for the Voidadept: climb the
         * table and you starve the blood engines that feed on the bottom. */
        voidadept: {
          name: 'THE HUNGER',
          read: 'The bottom of the die hits HARDER than the middle — and bills you in HP.',
          // A U, not a ramp. The void answers at either extreme and is bored by
          // the middle — WHISPER, the most common face, is his WORST outcome.
          // The bottom pays in blood, and it pays through spendLife, so the
          // blood engines drink from a bad roll.
          misfire: { mult: 1.5, label: 'RAVENOUS', hploss: 4 },
          bands: [
            { min: 15, mult: 1.2, label: 'ATTUNED' },
            { min: 8,  mult: 0.9, label: 'WHISPER' },
            { min: 2,  mult: 1.2, label: 'HUNGER', hploss: 1 },
          ],
        },
      },
    },

    /* ---- The count runs out ------------------------------------------
     * A fight with no clock can run forever: Barricade / Phase Lock stop your
     * Shield expiring, so a defensive build that has lost its offence (a Jammer
     * burning out the last attack, say) becomes both unkillable and unable to
     * kill. It happened in roughly 1 bot run in 900.
     *
     * `turn` is set from measurement, not taste: over 26,469 simulated fights
     * the 99th percentile is 8 turns and the 99.9th is 14, and bosses — the
     * longest legitimate fights — sit at p99 = 12. Only 0.05% of fights reach
     * turn 20 at all, and essentially all of those are the pathology.
     *
     * Past that line the Spire stops waiting. Enemies gain Might every turn AND
     * your Shield starts sloughing off, because raising damage alone does not
     * beat an unbounded Shield pool in any sensible number of turns.
     * ------------------------------------------------------------------ */
    enrage: {
      turn: 20,          // last patient turn; escalation begins on the next one
      str: 2,            // Might each enemy gains per turn, cumulative
      shieldDecay: 0.34, // fraction of your Shield that fails each turn
      shieldFloor: 5,    // ...and at least this much, so small pools still drain
    },

    /* ---- Status effects ---------------------------------------------- */
    status: {
      vulnMult: 1.5,            // damage taken multiplier while Vulnerable
      weakMult: 0.75,           // damage dealt multiplier while Weakened
      burnTick: 1,              // burn stacks lost per turn (damage = stacks)
    },

    /* ---- Enemy scaling per sector (s = sector, 1-based) -------------- */
    scaling: {
      hpMul:  function (s) { return 1 + 0.30 * (s - 1) + 0.034 * (s - 1) * (s - 1); },
      dmgMul: function (s) { return 1 + 0.165 * (s - 1) + 0.017 * (s - 1) * (s - 1); },
      // extra flat strength enemies gain every N sectors (late-game pressure)
      strEverySectors: 3,
      // within-sector ramp: enemies at the top of a (now 12-row) sector hit this
      // much harder than at the entry, to match the deck you've assembled.
      depthBonus: 0.18,
    },

    /* ---- Sector / encounters ---------------------------------------- */
    sector: {
      eliteChance2Enemies: 0.35, // chance an elite brings a minion (sector 3+)
    },

    /* ---- Branching map (Slay-the-Spire-style star chart) ------------- */
    map: {
      rows: 12,            // content rows per sector (the boss sits above them)
      // Three lanes, because a row is 2-3 nodes and rows SPAN the lanes rather
      // than sliding across them. Five lanes meant a row covered part of the
      // width and slid sideways to vary — which swept the chart diagonally. At
      // three, a lane IS a highway: gauntlet, supply and frontier run the length
      // of the sector and you can follow one with your eye.
      cols: 3,
      // ROW SHAPE. The chart is sized directly rather than woven from random
      // walks — see generateMap. Rows of 2-3 across 5 lanes fill 49% of the
      // grid, which is where Slay the Spire's 7x15 sits; the old weave filled
      // 74% and read as a lattice rather than as a route you pick.
      entryWidth: 3,       // ways into the sector (Slay the Spire opens with 3-4)
      minWidth: 2,         // at least two places to be at every depth
      maxWidth: 3,
      weave: 1,            // how often a row-join branches instead of running straight
      // a sector reads as three acts: a safe Approach, the dangerous Push, and
      // a Final Approach that ends on a guaranteed rest before the boss.
      act1End: 3,          // rows 1..act1End  = Approach (fights/events only)
      act2End: 8,          // rows act1End+1..act2End = The Push (elites/shops/forges...)
      // NODE DIET: 11 types -> 7. `market` folded into `shop`, `rift` cut (its
      // "boon with a price" is what events already do), `treasure` made rare so a
      // free relic is an event rather than routine. Combat pushed to ~60% of the
      // map, in line with the genre, so rewards are things you fought for.
      actWeights: {
        approach: { fight: 66, event: 18, treasure: 4, rest: 6 },
        push:     { fight: 34, elite: 18, beacon: 7, event: 14, shop: 8, rest: 10, forge: 6, treasure: 3 },
        final:    { fight: 40, elite: 10, event: 14, shop: 8, rest: 14, forge: 7, treasure: 3 },
      },
      restBeforeBoss: true, // the top content row is always a rest (catch your breath)
    },

    /* ---- Rewards ------------------------------------------------------ */
    rewards: {
      creditsFight: [18, 30],   // [min, max] credits from a normal fight
      creditsElite: [40, 60],
      creditsBoss:  [70, 95],
      creditsPerSectorMul: 0.10, // +10% credits per sector beyond the first
      cardChoices: 3,            // cards offered after a fight
      rareChance: 0.08,          // chance an offered card is rare
      uncommonChance: 0.32,      // chance an offered card is uncommon (else common)
      eliteRareChance: 0.25,     // rarity boost for elite rewards
      bossHealPct: 0.28,         // heal option after beating a boss
      restHealPct: 0.30,         // heal at a rest node
    },

    /* ---- Shop ---------------------------------------------------------- */
    shop: {
      cardCost:     { 1: 35, 2: 55, 3: 90 },  // by rarity
      artifactCost: 80,
      removeCost: 40,            // remove a card from the deck
      removeCostInc: 15,         // increase per purchase this run
      healCost: 30,
      healAmount: 18,
    },

    /* ---- The die economy ------------------------------------------------
     * Fights hand you engravings; the bench is where you buy the ones you
     * actually want and undo the ones you didn't choose. A Flaw is only a real
     * curse if grinding it out costs something, so the prices below are the
     * counterplay tax — deliberately steep enough that you weigh moving a Flaw
     * out of reach (cheap) against destroying it (dear).
     * ------------------------------------------------------------------ */
    dieShop: {
      stock: 2,                            // engravings a bench carries
      // an engraving is worth about a relic (¢80) — a shade under, because a
      // relic is unconditional and a face only fires when the die lands there.
      engravingCost: { 1: 70, 2: 105, 3: 150 },
      grindCost: 50,                       // destroy a Flaw outright
      grindCostInc: 25,                    // per grind this run
      reseatCost: 30,                      // move an installed engraving
    },

    /* ---- Combat feel (UI timings, ms) ---------------------------------- */
    feel: {
      enemyActDelay: 520,        // stagger between enemy actions
      cardPlayDelay: 260,        // pause after playing a card
      floaterLife: 900,
      shakeMag: 7,
      swipeThreshold: 64,        // px of upward drag needed to play a card
    },

    /* ---- Score ---------------------------------------------------------- */
    score: {
      perSector: 100,
      perNode: 12,
      perKill: 4,
      perLoop: 600,   // bonus per completed Recurrence loop
    },

    /* ---- Run arc / win condition ---------------------------------------- */
    run: {
      finale: 4,   // the boss of this sector is THE UNMAKER (the win condition).
                   // Beat it to win; you may then enter the Recurrence (NG+ loop).
      loopPower: 0.12, // each Recurrence loop multiplies enemy HP & damage by
                       // (1 + loopPower*(loop-1)) on top of normal sector scaling.
      heartLoop: 6,    // NG+5 (loop 6): the secret Heart gauntlet — a single
                       // Heart node then a build-countering tribute boss.
    },

    /* ---- VOID PRESSURE: the difficulty ladder -------------------------
     * Each rating is a designed hazard, not a bigger number — the Recurrence
     * already handles flat scaling. Modifiers are CUMULATIVE: at pressure 5 you
     * carry 1 through 5. Clear a rating to unlock the next.
     * ------------------------------------------------------------------ */
    ladder: [
      { name: 'DRIFT',         desc: 'Standard descent. Nothing out there but the Spire.', mods: {} },
      { name: 'COLD VACUUM',   desc: 'Hostiles run 10% harder to kill.',                  mods: { enemyHp: 1.10 } },
      // more elites alone made the game EASIER (elites pay in relics and
      // engravings), so this rating makes elites nastier rather than commoner.
      { name: 'DEBRIS FIELD',  desc: 'Elites never travel alone, and there are more of them.', mods: { eliteWeight: 4, eliteMinion: 1 } },
      { name: 'SOLAR FLARE',   desc: 'Your die runs hot: a 1 or a 2 misfires, and misfires bite harder.', mods: { misfireOn: 2, misfireMult: 0.7 } },
      { name: 'GRAVITY WELL',  desc: 'The die frame buckles — one less core slot, now and forever.', mods: { coreSlots: -1, coreSlotsMax: -1 } },
      { name: 'RADIATION BELT',desc: 'Field repairs take poorly. Rest heals 30% less.',   mods: { restHeal: 0.70 } },
      { name: 'ION STORM',     desc: 'Hostiles hit 10% harder.',                          mods: { enemyDmg: 1.10 } },
      { name: 'HULL BREACH',   desc: 'You launch with a Flaw already cut into your die.', mods: { startFlaw: 1 } },
      { name: 'DEAD RECKONING',desc: 'Salvage is thin — 2 cards offered, not 3.',         mods: { cardChoices: -1 } },
      { name: 'EVENT HORIZON', desc: 'Hostiles run 10% harder to kill again.',            mods: { enemyHp: 1.10 } },
      { name: 'SINGULARITY',   desc: 'Markets gouge (+30%) and stims are scarce.',        mods: { shopCost: 1.30, potionDrop: 0.6 } },
      { name: 'THE LONG DARK', desc: 'Hostiles hit 10% harder, and every boss wakes angry.', mods: { enemyDmg: 1.10, bossStr: 1 } },
    ],

    /* ---- Void Echoes (Recurrence / NG+ special relics) ------------------ */
    echoes: {
      loadoutSlots: 3,  // how many owned Echoes you may equip per loop
    },

    /* ---- Potions & consumables ------------------------------------------ */
    potions: {
      slots: 3,            // how many potions you can carry at once
      dropChance: 0.40,    // chance a normal/elite fight also drops a potion
      bossDropChance: 1.0, // a sector boss always offers a potion
      shopChance: 0.7,     // chance a shop stocks a potion
      shopCost: { 1: 35, 2: 55, 3: 85 },  // shop price by rarity
      rarityWeights: { 1: 100, 2: 46, 3: 15 },
    },
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
