/* =========================================================================
 * VOIDSPIRE — potions.js
 * One-shot consumables carried into combat. Tap a belt slot to use one;
 * targeted potions ask you to tap an enemy.
 *
 * Each potion: { name, rarity (1-3), color, target?, desc, fx:[...] }
 * fx kinds: dmg{v,all?} block{v} energy{v} draw{v} heal{v} healPct{v}
 *           status{who:'self'|'enemy'|'allEnemies', s, v}
 * `target:true` means it hits one enemy you pick (when more than one is alive).
 * Icons are drawn from a single shared vial glyph, tinted by `color`.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.POTIONS = {
    /* ---------------- common ---------------- */
    frag_charge: {
      name: 'Frag Charge', rarity: 1, color: '#ff7a4a', target: true,
      desc: 'Deal 12 damage to one enemy.',
      fx: [{ k: 'dmg', v: 12 }],
    },
    cluster_charge: {
      name: 'Cluster Charge', rarity: 1, color: '#ff9a3a',
      desc: 'Deal 8 damage to ALL enemies.',
      fx: [{ k: 'dmg', v: 8, all: true }],
    },
    shield_gel: {
      name: 'Shield Gel', rarity: 1, color: '#41d8ff',
      desc: 'Gain 14 Shield.',
      fx: [{ k: 'block', v: 14 }],
    },
    stim_shot: {
      name: 'Stim Shot', rarity: 1, color: '#5dff88',
      desc: 'Draw 3 cards.',
      fx: [{ k: 'draw', v: 3 }],
    },
    medkit: {
      name: 'Medkit', rarity: 1, color: '#56ff9c',
      desc: 'Heal 25% of your max HP.',
      fx: [{ k: 'healPct', v: 0.25 }],
    },
    targeting_optics: {
      name: 'Targeting Optics', rarity: 1, color: '#ffd23a', target: true,
      desc: 'Apply 3 Vulnerable to one enemy.',
      fx: [{ k: 'status', who: 'enemy', s: 'vuln', v: 3 }],
    },

    /* ---------------- uncommon ---------------- */
    overcharge_cell: {
      name: 'Overcharge Cell', rarity: 2, color: '#ffe14a',
      desc: 'Gain 2 Energy this turn.',
      fx: [{ k: 'energy', v: 2 }],
    },
    berserk_serum: {
      name: 'Berserk Serum', rarity: 2, color: '#ff5e7a',
      desc: 'Gain 2 Might for this combat.',
      fx: [{ k: 'status', who: 'self', s: 'str', v: 2 }],
    },
    neural_jammer: {
      name: 'Neural Jammer', rarity: 2, color: '#9a8bff',
      desc: 'Apply 3 Weak to ALL enemies.',
      fx: [{ k: 'status', who: 'allEnemies', s: 'weak', v: 3 }],
    },
    incendiary_vial: {
      name: 'Incendiary Vial', rarity: 2, color: '#ff6a2a', target: true,
      desc: 'Apply 6 Burn to one enemy.',
      fx: [{ k: 'status', who: 'enemy', s: 'burn', v: 6 }],
    },

    /* ---------------- rare ---------------- */
    adrenal_surge: {
      name: 'Adrenal Surge', rarity: 3, color: '#ffce4a',
      desc: 'Gain 1 Energy and draw 2 cards.',
      fx: [{ k: 'energy', v: 1 }, { k: 'draw', v: 2 }],
    },
    nanite_surge: {
      name: 'Nanite Surge', rarity: 3, color: '#56ffd2',
      desc: 'Heal 20% max HP and gain 20 Shield.',
      fx: [{ k: 'healPct', v: 0.20 }, { k: 'block', v: 20 }],
    },
    void_flask: {
      name: 'Void Flask', rarity: 3, color: '#c86bff',
      desc: 'Deal 10 damage and apply 3 Vulnerable to ALL enemies.',
      fx: [{ k: 'dmg', v: 10, all: true }, { k: 'status', who: 'allEnemies', s: 'vuln', v: 3 }],
    },
  };

  // Shared vial glyph (polyline format, -1..1 box) for belt slots & offers.
  ns.POTION_ICON = {
    p: [
      [-0.28, -0.62, -0.14, -0.62],            // cork lip
      [-0.2, -0.62, -0.2, -0.34, -0.5, 0.34, -0.42, 0.66, 0.42, 0.66, 0.5, 0.34, 0.2, -0.34, 0.2, -0.62],
      [-0.36, 0.06, 0.36, 0.06],               // fluid line
      [-0.2, -0.5, 0.2, -0.5],                 // neck band
    ],
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
