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
      voidadept: { hp: 78, might: 0, tech: 0, psi: 2 },
      warpcaller: { hp: 55, might: 0, tech: 0, psi: 0, bond: 2 },  // glass-cannon pet master
    },

    /* ---- Attribute scaling ------------------------------------------ */
    attrs: {
      mightDmgPerPoint: 1.8,    // bonus damage per MIGHT on might-scaling attacks
      techBlockPerPoint: 1,     // bonus block per TECH on tech-scaling skills
      mightBlockPerPoint: 1,    // bonus block per MIGHT on primary-scaling skills
      psiBlockPerPoint: 1,      // bonus block per PSI on primary-scaling skills
      bondBlockPerPoint: 1,     // bonus block per BOND on primary-scaling skills
      psiDmgPerPoint: 1.4,      // bonus damage per PSI on psi-scaling attacks
      bondPetPerPoint: 0.2,     // bonus to a pet's action per point of BOND (the Warpcaller's scaling)
      eventCheckBonusDiv: 1,    // event check bonus = attr / this (rounded down)
    },

    /* ---- d20 / crits ------------------------------------------------ */
    dice: {
      critThreshold: 20,        // roll + Aim >= (threshold - critBonus) crits
      critMult: 2.0,            // crit damage multiplier
      misfireMult: 0.5,         // natural 1: the shot goes wide
      baseAim: 1,               // every class steers the die a little — it is a game-wide system
      vanguardAim: 1,           // the marksman sights in further on top of the base
      // MARKSMANSHIP BANDS (Vanguard only): the whole d20 face matters, not just
      // its ends. Effective roll = d20 + Aim. Averages ~1.03x at Aim 0, so this
      // is a feel change rather than a power change; Aim pushes you up the table.
      bands: [
        { min: 15, mult: 1.25, label: 'SOLID' },
        { min: 8,  mult: 1.0,  label: 'HIT' },
        { min: 2,  mult: 0.8,  label: 'GRAZE' },
      ],
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
      cols: 5,             // max horizontal lanes
      paths: 7,            // random-walk paths used to weave the chart
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

    /* ---- Level up: Augment Protocol draft (after each boss) ----------- */
    levelUp: {
      // how often each augment rarity shows up in the 3-card draft
      rarityWeights: { 1: 100, 2: 52, 3: 20 },
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
