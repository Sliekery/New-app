/* =========================================================================
 * VOIDSPIRE — augments.js
 * "Augment Protocols": the level-up reward pool. After each boss you draft
 * one of 3 random augments (rarity-weighted, class-flavored). Replaces the
 * old fixed +1-stat menu so the choice is interesting and not a no-brainer.
 *
 * kind:
 *   'stat'   — immediate attribute / max-HP gain (stat: 'class'|'might'|...|'maxhp', v)
 *   'heal'   — heal a % of max HP (healPct)
 *   'hook'   — permanent passive via an engine hook (hook:{k,v} or hooks:[...])
 *   'deckop' — a deck operation (deckop: 'remove'|'upgrade2'|'addCard')
 *   'pact'   — a tradeoff: a benefit (hook/hooks or stat) plus a cost (maxhpPct)
 * cls: 'any' or a class id (only offered to that class)
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.AUGMENTS = {

    /* ---------------- Commons (rarity 1) ---------------- */
    calibrate:    { name: 'Calibration', rarity: 1, cls: 'any', kind: 'stat', stat: 'class', v: 1,
      desc: '+1 to your core attribute.' },
    field_repairs:{ name: 'Field Repairs', rarity: 1, cls: 'any', kind: 'heal', healPct: 0.30,
      desc: 'Patch the hull — heal 30% of Max HP.' },
    honed_edge:   { name: 'Honed Edge', rarity: 1, cls: 'any', kind: 'hook', hook: { k: 'flatDmg', v: 3 },
      desc: 'Your attacks deal +3 damage.' },
    armor_weave:  { name: 'Armor Weave', rarity: 1, cls: 'any', kind: 'hook', hook: { k: 'plate', v: 3 },
      desc: 'Gain 3 Shield at the start of each turn.' },
    med_reserves: { name: 'Medical Reserves', rarity: 1, cls: 'any', kind: 'stat', stat: 'maxhp', v: 12,
      desc: '+12 Max HP (and heal 12).' },
    purge:        { name: 'Purge Protocol', rarity: 1, cls: 'any', kind: 'deckop', deckop: 'remove',
      desc: 'Remove a card from your deck.' },

    /* ---------------- Uncommons (rarity 2) ---------------- */
    killchain:    { name: 'Killchain', rarity: 2, cls: 'any', kind: 'hook', hook: { k: 'killDraw', v: 1 },
      desc: 'Whenever you kill an enemy, draw a card.' },
    reactive_plating: { name: 'Reactive Plating', rarity: 2, cls: 'any', kind: 'hook', hook: { k: 'reactivePlate', v: 6 },
      desc: 'The first time you take damage each combat, gain 6 Shield.' },
    overclock:    { name: 'Overclock Servos', rarity: 2, cls: 'any', kind: 'hook', hook: { k: 'firstCardFree', v: 1 },
      desc: 'The first card you play each turn costs 1 less.' },
    refit:        { name: 'Refit Bay', rarity: 2, cls: 'any', kind: 'deckop', deckop: 'upgrade2',
      desc: 'Upgrade 2 cards.' },
    requisition:  { name: 'Requisition', rarity: 2, cls: 'any', kind: 'deckop', deckop: 'addCard',
      desc: 'Add a card of your choice to your deck.' },
    breaching_rounds: { name: 'Breaching Rounds', rarity: 2, cls: 'vanguard', kind: 'hook', hook: { k: 'attackVuln', v: 1 },
      desc: 'Your attacks apply 1 Vulnerable.' },
    targeting_matrix: { name: 'Targeting Matrix', rarity: 2, cls: 'technomancer', kind: 'hook', hook: { k: 'critStr', v: 1 },
      desc: 'Whenever you land a critical hit, gain 1 Might.' },
    disruptor_field: { name: 'Disruptor Field', rarity: 2, cls: 'technomancer', kind: 'hook', hook: { k: 'shieldWeak', v: 1 },
      desc: 'Whenever you gain Shield, apply 1 Weak to a random enemy.' },
    soul_pyre:    { name: 'Soul Pyre', rarity: 2, cls: 'voidadept', kind: 'hook', hook: { k: 'attackBurn', v: 1 },
      desc: 'Your attacks also apply 1 Burn.' },

    /* ---------------- Rares (rarity 3) ---------------- */
    critical_cascade: { name: 'Critical Cascade', rarity: 3, cls: 'any', kind: 'hook', hook: { k: 'critVuln', v: 2 },
      desc: 'Your crits also apply 2 Vulnerable.' },
    warlord_doctrine: { name: 'Warlord Doctrine', rarity: 3, cls: 'vanguard', kind: 'hook', hook: { k: 'strStart', v: 3 },
      desc: 'Start each combat with 3 Might.' },
    echo_protocol:{ name: 'Echo Protocol', rarity: 3, cls: 'technomancer', kind: 'hook', hook: { k: 'echoStart', v: 1 },
      desc: 'The first Attack you play each turn is played twice.' },
    entropy_doctrine: { name: 'Entropy Doctrine', rarity: 3, cls: 'voidadept', kind: 'hook', hooks: [{ k: 'burnGrow', v: 1 }, { k: 'weakStart', v: 2 }],
      desc: 'Enemy Burn grows each turn, and all enemies start Weak.' },
    kinetic_overflow: { name: 'Kinetic Overflow', rarity: 3, cls: 'any', kind: 'hook', hooks: [{ k: 'flatDmg', v: 2 }, { k: 'firstCardFree', v: 1 }],
      desc: 'Attacks deal +2, and your first card each turn costs 1 less.' },

    /* ---------------- Pacts (tradeoffs) ---------------- */
    reckless_overdrive: { name: 'Reckless Overdrive', rarity: 2, cls: 'any', kind: 'pact', maxhpPct: 0.12, hook: { k: 'energyEveryTurn', v: 1 },
      desc: '+1 Energy every turn — but Max HP −12%.' },
    glass_doctrine: { name: 'Glass Doctrine', rarity: 3, cls: 'any', kind: 'pact', hooks: [{ k: 'dmgMult', v: 0.5 }, { k: 'vulnStart', v: 2 }],
      desc: 'Deal +50% damage — but start each combat with 2 Vulnerable.' },
    blood_pact:   { name: 'Blood Pact', rarity: 2, cls: 'any', kind: 'pact', maxhpPct: 0.10, stat: 'class', v: 2,
      desc: '+2 to your core attribute — but Max HP −10%.' },
  };

  // Cards offered by the "Requisition" deck-op, by class.
  ns.augmentAddPool = function (cls) {
    var out = [];
    Object.keys(ns.CARDS).forEach(function (id) {
      var c = ns.CARDS[id];
      if (c.rarity >= 1 && (c.cls === cls || c.cls === 'any')) out.push(id);
    });
    return out;
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
