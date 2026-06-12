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
      technomancer: { hp: 72, might: 0, tech: 2, psi: 0 },
      voidadept: { hp: 74, might: 0, tech: 0, psi: 2 },
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
      strEverySectors: 4,
    },

    /* ---- Sector / node structure ------------------------------------ */
    sector: {
      // node script per sector; 'choice' = player picks one of two random nodes
      script: ['fight', 'choice', 'fight', 'choice', 'elite', 'choice', 'choice', 'boss'],
      // weighted pool used for 'choice' slots (two distinct options are offered)
      choiceWeights: { fight: 38, event: 30, shop: 12, rest: 20 },
      eliteChance2Enemies: 0.35, // chance an elite brings a minion (sector 3+)
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

    /* ---- Level up (after each boss) ----------------------------------- */
    levelUp: {
      attrGain: 1,               // points gained when picking an attribute
      maxHpGain: 9,              // option: +max HP (also heals this much)
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
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
