/* =========================================================================
 * VOIDSPIRE — dice.js
 * The Augmented Die: the player's second build.
 *
 *   FACES (1-20) — engraved augments; fire when the effective roll lands there.
 *   CORE         — always-on modules (the old relics), limited slots.
 *   FRAME        — upgrades that change how the die itself rolls.
 *
 * Augment `fx` reuses the card effect vocabulary (dmg/block/energy/draw/heal/
 * hploss/status/special), so the engine resolves them with applyCardFx — there
 * is no second effect system.
 * ========================================================================= */
(function (ns) {
  'use strict';

  // NOTE: names are DIE_-prefixed on purpose — augments.js already owns
  // ns.AUGMENTS for the level-up draft, and an unprefixed name is silently
  // clobbered by load order.

  // How many faces a die has, and how the core grows.
  ns.DIE = {
    faces: 20,
    coreSlotsStart: 3,     // mounted Core Modules at the start of a run
    coreSlotsPerBoss: 1,   // +1 after each sector boss
    coreSlotsMax: 6,
  };

  /* ---- Face augments -------------------------------------------------
   * span: how many consecutive faces the engraving occupies (1 = point).
   * A point augment fires ~5% of rolls, so its effect is chunky; a band
   * augment fires more often and is priced down accordingly.
   * `anyFace: false` means it can only be engraved where noted.
   * ------------------------------------------------------------------ */
  ns.DIE_AUGMENTS = {
    overcharge_cell: {
      name: 'Overcharge Cell', tier: 1, span: 1,
      fx: [{ k: 'energy', v: 1 }],
      desc: 'Gain 1 Energy.',
      art: { p: [[-0.5,-0.6, 0.5,-0.6, 0.5,0.6, -0.5,0.6, -0.5,-0.6], [-0.22,-0.6, -0.22,-0.82, 0.22,-0.82, 0.22,-0.6], [0.16,-0.3, -0.18,0.08, 0.06,0.08, -0.14,0.46]] },
    },
    munition_feed: {
      name: 'Munition Feed', tier: 1, span: 1,
      fx: [{ k: 'draw', v: 1 }],
      desc: 'Draw 1 card.',
      art: { p: [[-0.55,-0.5, 0.15,-0.5, 0.15,0.55, -0.55,0.55, -0.55,-0.5], [-0.25,-0.5, -0.25,0.55], [0.15,-0.3, 0.62,-0.3, 0.62,0.4, 0.15,0.4]] },
    },
    repair_nanites: {
      name: 'Repair Nanites', tier: 1, span: 1,
      fx: [{ k: 'heal', v: 3 }],
      desc: 'Heal 3 HP.',
      art: { p: [[-0.2,-0.7, 0.2,-0.7, 0.2,-0.2, 0.7,-0.2, 0.7,0.2, 0.2,0.2, 0.2,0.7, -0.2,0.7, -0.2,0.2, -0.7,0.2, -0.7,-0.2, -0.2,-0.2, -0.2,-0.7]] },
    },
    kinetic_buffer: {
      name: 'Kinetic Buffer', tier: 1, span: 1,
      fx: [{ k: 'block', v: 5 }],
      desc: 'Gain 5 Shield.',
      art: { p: [[0,-0.8, 0.66,-0.46, 0.66,0.2, 0,0.82, -0.66,0.2, -0.66,-0.46, 0,-0.8], [0,-0.5, 0,0.5], [-0.44,-0.16, 0.44,-0.16]] },
    },
    targeting_spike: {
      name: 'Targeting Spike', tier: 1, span: 1,
      fx: [{ k: 'status', s: 'vuln', v: 2, who: 'target' }],
      desc: 'Apply 2 Vulnerable.',
      art: { p: [[-0.6,-0.6, -0.6,-0.24], [-0.6,-0.6, -0.24,-0.6], [0.6,-0.6, 0.24,-0.6], [0.6,-0.6, 0.6,-0.24], [-0.6,0.6, -0.6,0.24], [-0.6,0.6, -0.24,0.6], [0.6,0.6, 0.6,0.24], [0.6,0.6, 0.24,0.6], [-0.5,0, 0.5,0], [0,-0.5, 0,0.5]], e: [[0,0]] },
    },
    ignition_coil: {
      name: 'Ignition Coil', tier: 1, span: 1,
      fx: [{ k: 'status', s: 'burn', v: 3, who: 'target' }],
      desc: 'Apply 3 Burn.',
      art: { p: [[0,-0.85, 0.34,-0.4, 0.18,-0.06, 0.46,0.24, 0.2,0.62, 0,0.8, -0.2,0.62, -0.46,0.24, -0.18,-0.06, -0.34,-0.4, 0,-0.85]] },
    },
    static_discharge: {
      name: 'Static Discharge', tier: 1, span: 1,
      fx: [{ k: 'dmg', v: 4, random: true }],
      desc: 'Deal 4 damage to a random enemy.',
      art: { p: [[0.2,-0.86, -0.34,-0.04, 0.06,-0.04, -0.24,0.86, 0.42,-0.08, 0.02,-0.08, 0.36,-0.86, 0.2,-0.86]] },
    },
    scavenger_port: {
      name: 'Scavenger Port', tier: 1, span: 1,
      fx: [{ k: 'special', id: 'dieCredits', v: 6 }],
      desc: 'Gain 6 credits.',
      art: { p: [[-0.6,-0.34, 0.6,-0.34, 0.6,0.5, -0.6,0.5, -0.6,-0.34], [-0.26,-0.34, -0.26,-0.6, 0.26,-0.6, 0.26,-0.34], [-0.2,0.08, 0.2,0.08]] },
    },
    // -- band augments: wider, so cheaper per trigger --
    scrap_sifter: {
      name: 'Scrap Sifter', tier: 1, span: 3,
      fx: [{ k: 'block', v: 2 }],
      desc: 'Gain 2 Shield.',
      art: { p: [[0,-0.7, 0.58,-0.4, 0.58,0.18, 0,0.72, -0.58,0.18, -0.58,-0.4, 0,-0.7], [-0.3,0, 0.3,0]] },
    },
    pressure_valve: {
      name: 'Pressure Valve', tier: 2, span: 3,
      fx: [{ k: 'heal', v: 1 }, { k: 'block', v: 1 }],
      desc: 'Heal 1 HP and gain 1 Shield.',
      art: { p: [[-0.5,-0.2, 0.5,-0.2, 0.5,0.5, -0.5,0.5, -0.5,-0.2], [0,-0.2, 0,-0.7], [-0.3,-0.7, 0.3,-0.7], [-0.2,0.1, 0.2,0.1]] },
    },
    // -- Vanguard flavour --
    momentum_tap: {
      name: 'Momentum Tap', tier: 2, span: 1,
      fx: [{ k: 'status', s: 'momentum', v: 2, who: 'self' }],
      desc: 'Gain 2 Momentum.',
      art: { p: [[-0.7,0.3, -0.2,-0.3, 0.1,0.1, 0.7,-0.5], [0.7,-0.5, 0.3,-0.5], [0.7,-0.5, 0.7,-0.12]] },
    },
    blood_tithe: {
      name: 'Blood Tithe', tier: 2, span: 1,
      fx: [{ k: 'hploss', v: 2 }, { k: 'status', s: 'str', v: 1, who: 'self' }],
      desc: 'Lose 2 HP. Gain 1 Might.',
      art: { p: [[0,-0.8, 0.4,-0.1, 0.28,0.5, -0.28,0.5, -0.4,-0.1, 0,-0.8], [-0.2,0.06, 0.2,0.06]] },
    },
    aim_assist: {
      name: 'Aim Assist', tier: 2, span: 1,
      fx: [{ k: 'status', s: 'aim', v: 1, who: 'self' }],
      desc: 'Gain 1 Aim for the rest of combat.',
      art: { p: [[-0.75,0, 0.75,0], [0,-0.75, 0,0.75], [0.42,0, 0.3,-0.12], [0.42,0, 0.3,0.12]], e: [[0,0]] },
    },
    // -- face-locked --
    jam_clearance: {
      name: 'Jam Clearance', tier: 2, span: 1, onlyFace: 1,
      fx: [{ k: 'status', s: 'momentum', v: 2, who: 'self' }, { k: 'energy', v: 1 }],
      desc: 'Gain 2 Momentum and 1 Energy. Engraved on face 1 only — the shot that jams still pays.',
      art: { p: [[-0.6,-0.5, 0.6,-0.5, 0.6,0.5, -0.6,0.5, -0.6,-0.5], [-0.6,-0.5, 0.6,0.5], [0.6,-0.5, -0.6,0.5]] },
    },
    executioners_mark: {
      name: "Executioner's Mark", tier: 3, span: 1,
      fx: [{ k: 'special', id: 'dieExecute', v: 8 }],
      desc: 'Deal 8 damage to the target — doubled if it is below 30% HP.',
      art: { p: [[-0.5,0.12, -0.55,-0.4, -0.3,-0.72, 0.3,-0.72, 0.55,-0.4, 0.5,0.12, 0.3,0.24, 0.3,0.5, -0.3,0.5, -0.3,0.24, -0.5,0.12]], e: [[-0.24,-0.22], [0.24,-0.22]] },
    },
  };

  /* ---- Flaws: engravings you did NOT choose ---------------------------
   * A Flaw occupies its face, so it also denies you that slot. Because
   * augments fire on the EFFECTIVE roll, a Flaw can be steered around by
   * raising Aim — a curse pressures your build instead of just taxing it.
   * ------------------------------------------------------------------ */
  ns.DIE_FLAWS = {
    hairline_fracture: {
      name: 'Hairline Fracture', flaw: true, tier: 1, span: 1,
      fx: [{ k: 'hploss', v: 2 }],
      desc: 'Lose 2 HP.',
      art: { p: [[-0.5,-0.6, 0.5,-0.6, 0.5,0.6, -0.5,0.6, -0.5,-0.6], [-0.2,-0.6, 0.05,-0.1, -0.15,0.05, 0.15,0.6]] },
    },
    cold_solder: {
      name: 'Cold Solder', flaw: true, tier: 1, span: 1,
      fx: [{ k: 'special', id: 'dieLoseBlock', v: 3 }],
      desc: 'Lose 3 Shield.',
      art: { p: [[0,-0.75, 0.62,-0.42, 0.62,0.18, 0,0.76, -0.62,0.18, -0.62,-0.42, 0,-0.75], [-0.35,-0.25, 0.35,0.3]] },
    },
    warp_etching: {
      name: 'Warp Etching', flaw: true, tier: 2, span: 1,
      fx: [{ k: 'special', id: 'dieEnemyStr', v: 1 }],
      desc: 'A random enemy gains 1 Might.',
      art: { p: [[0,0, 0.2,-0.22, 0.06,-0.48, -0.32,-0.42, -0.48,0, -0.22,0.48, 0.32,0.52, 0.66,0.06, 0.42,-0.52, -0.2,-0.76]] },
    },
  };

  // Every engraving, chosen or not.
  ns.dieEngraving = function (id) { return ns.DIE_AUGMENTS[id] || ns.DIE_FLAWS[id] || null; };

  /* ---- Run-state helpers --------------------------------------------- */
  ns.newDie = function () {
    return { faces: {}, core: [], vault: [], frame: [], coreSlots: ns.DIE.coreSlotsStart };
  };

  // Which faces an engraving covers when installed at `face`.
  ns.dieSpan = function (id, face) {
    var d = ns.dieEngraving(id); if (!d) return [];
    var out = [];
    for (var i = 0; i < (d.span || 1); i++) {
      var f = face + i;
      if (f >= 1 && f <= ns.DIE.faces) out.push(f);
    }
    return out;
  };

  // Can `id` be engraved at `face`? Returns null if fine, else a reason.
  ns.dieCanEngrave = function (die, id, face) {
    var d = ns.dieEngraving(id);
    if (!d) return 'unknown engraving';
    if (d.onlyFace && d.onlyFace !== face) return 'only fits face ' + d.onlyFace;
    var span = ns.dieSpan(id, face);
    if (span.length < (d.span || 1)) return 'does not fit past face ' + ns.DIE.faces;
    for (var i = 0; i < span.length; i++) if (die.faces[span[i]]) return 'face ' + span[i] + ' is taken';
    return null;
  };

  ns.dieEngrave = function (die, id, face) {
    var why = ns.dieCanEngrave(die, id, face);
    if (why) return why;
    ns.dieSpan(id, face).forEach(function (f) { die.faces[f] = { id: id, root: face }; });
    return null;
  };

  ns.dieScrub = function (die, face) {
    var slot = die.faces[face]; if (!slot) return false;
    var root = slot.root;
    Object.keys(die.faces).forEach(function (f) { if (die.faces[f].root === root) delete die.faces[f]; });
    return true;
  };

  // The engraving that fires for an effective roll (null if the face is bare).
  ns.dieFaceAt = function (die, face) {
    if (!die || !die.faces) return null;
    var slot = die.faces[face];
    return slot ? ns.dieEngraving(slot.id) : null;
  };
  ns.dieFaceId = function (die, face) {
    if (!die || !die.faces) return null;
    var slot = die.faces[face];
    return slot ? slot.id : null;
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
