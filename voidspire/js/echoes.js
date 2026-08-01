/* =========================================================================
 * VOIDSPIRE — echoes.js
 * THE PACTS. Eleven double-edged relics — each one changes HOW you play or is
 * a self-balancing bargain, never a flat "+power forever".
 *
 * They used to be "Void Echoes": drafted one per Recurrence loop and equipped
 * three at a time, which meant they existed only after you had already won. The
 * Recurrence is gone — difficulty lives on one ladder now, climbed by starting
 * again — so rather than delete eleven good relics they became what they always
 * resembled: BOSS RELICS WITH A COST. Same names, reachable in a first run —
 * and the kill-payoff ones trimmed for it, because they were priced for NG+
 * worlds running 12-36% stronger. Measured: reachable untrimmed, they moved
 * the Void Adept +18.8 points, whose many-small-kills Burn pattern cashes a
 * per-kill trigger far more often than a single-target class can.
 *
 * Simple Pacts carry hook:{k,v} / hooks:[...] that fold into engine.art(k)
 * exactly like any other relic. Rule-bending ones carry no hook; the engine
 * checks E.hasEcho(id) at the relevant trigger — which now reads your relics.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.ECHOES = {
    /* Renamed from hollow_crown: an unrelated relic already owns that id and
     * name, and two different things called Hollow Crown is how a save file
     * quietly grants the wrong effect. Its tag was always GLASS. */
    glass_crown: {
      name: 'Glass Crown', tag: 'GLASS',
      desc: 'Deal +30% damage — and take +30% damage.',
      flavor: 'A crown of absence, worn by every version of you.',
      hooks: [{ k: 'dmgMult', v: 0.30 }, { k: 'dmgTakenMult', v: 0.30 }],
    },
    void_battery: {
      name: 'Void Battery', tag: 'TEMPO',
      desc: 'Unspent Energy carries to your next turn — but you draw 1 fewer card each turn.',
      flavor: 'It hums with a charge you never quite spend.',
      hooks: [{ k: 'energyCarry', v: 1 }, { k: 'drawTurn', v: -1 }],
    },
    momentum_engine: {
      name: 'Momentum Engine', tag: 'COMBO',
      desc: 'Each card you play adds +1 damage to your next card this turn (resets each turn).',
      flavor: 'Every motion remembers the last.',
    },
    hunger_void: {
      name: 'Hunger of the Void', tag: 'AGGRO',
      desc: 'You can no longer be healed — instead heal 4 whenever you kill an enemy.',
      flavor: 'The void does not mend. It feeds.',
    },
    doubled_self: {
      name: 'Doubled Self', tag: 'BURST',
      desc: 'On the first turn of every combat, everything you do happens twice.',
      flavor: 'An echo of you, half a step ahead.',
    },
    salvage_doctrine: {
      name: 'Salvage Doctrine', tag: 'DECK',
      desc: 'No card rewards after combat — instead every 3rd kill grafts a random card into your deck.',
      flavor: 'You build yourself from what you break.',
    },
    void_touched: {
      name: 'Void-Touched', tag: 'CHAIN',
      desc: 'Killing an enemy deals 4 damage to a random other enemy.',
      flavor: 'Death spreads like a rumour.',
    },
    unmaker_tithe: {
      name: "The Unmaker's Tithe", tag: 'PACT',
      desc: 'Enemies are 25% stronger — but every elite and boss drops an extra relic.',
      flavor: 'It always collects. You only decide the price.',
      hook: { k: 'worldPower', v: 0.25 },
    },
    cursed_inheritance: {
      name: 'Cursed Inheritance', tag: 'PACT',
      desc: 'Start each combat with an unplayable curse stuck in hand — while it lingers, deal +25% damage.',
      flavor: 'Some debts follow you across every life.',
    },
    phylactery: {
      name: 'Phylactery', tag: 'WARD',
      desc: 'Once per run, the first blow that would kill you instead leaves you at 30% HP and clears your debuffs.',
      flavor: 'You have died here before. It did not take.',
    },
    ascendant_core: {
      name: 'Ascendant Core', tag: 'LEGACY',
      desc: '+1 to your core attribute.',
      flavor: 'The one part of you the void cannot strip away.',
    },
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
