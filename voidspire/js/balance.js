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
      voidadept: { hp: 75, might: 0, tech: 0, psi: 2 },
    },

    /* ---- Attribute scaling ------------------------------------------ */
    attrs: {
      mightDmgPerPoint: 1,      // bonus damage per MIGHT on might-scaling attacks
      techBlockPerPoint: 1,     // bonus block per TECH on tech-scaling skills
      psiDmgPerPoint: 1,        // bonus damage per PSI on psi-scaling attacks
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
      hpMul:  function (s) { return 1 + 0.30 * (s - 1) + 0.045 * (s - 1) * (s - 1); },
      dmgMul: function (s) { return 1 + 0.20 * (s - 1) + 0.030 * (s - 1) * (s - 1); },
      // extra flat strength enemies gain every N sectors (late-game pressure)
      strEverySectors: 3,
    },

    /* ---- Sector / encounters ---------------------------------------- */
    sector: {
      eliteChance2Enemies: 0.35, // chance an elite brings a minion (sector 3+)
    },

    /* ---- Branching map (Slay-the-Spire-style star chart) ------------- */
    map: {
      rows: 7,             // content rows per sector (the boss sits above them)
      cols: 4,             // max horizontal lanes
      paths: 6,            // random-walk paths used to weave the chart
      typeWeights: { fight: 50, event: 16, random: 11, shop: 6, rest: 6, elite: 14, treasure: 5 },
      eliteFromRow: 2,     // no elite (mini-boss) nodes before this row (0-based)
      shopRestFromRow: 1,  // no shop/rest nodes before this row
      treasureRow: -1,     // -1 = no dedicated treasure row (treasure is an occasional node)
      restBeforeBoss: false, // rest is a routing choice with opportunity cost, not a freebie
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
    },

    /* ---- Run arc / win condition ---------------------------------------- */
    run: {
      finale: 4,   // the boss of this sector is THE UNMAKER (the win condition).
                   // Beat it to win; you may then keep descending endlessly.
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
