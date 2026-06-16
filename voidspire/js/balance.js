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
      critThreshold: 20,        // natural roll >= (threshold - critBonus) crits
      critMult: 2.0,            // crit damage multiplier
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
      actWeights: {
        approach: { fight: 54, event: 28, rift: 6, treasure: 6 },
        push:     { fight: 24, event: 11, random: 6, elite: 15, beacon: 8, shop: 9, market: 5, rest: 8, forge: 7, rift: 4, treasure: 4 },
        final:    { fight: 34, event: 13, random: 6, shop: 8, market: 4, rest: 11, elite: 6, forge: 7, rift: 3, treasure: 6 },
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
