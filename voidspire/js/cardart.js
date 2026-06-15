/* =========================================================================
 * VOIDSPIRE — cardart.js
 * Vector glyphs for cards (polylines in a -1..1 box, same format as enemy /
 * relic art). A shared library keeps every card readable without authoring a
 * unique drawing for all 57; ns.cardGlyph(id, def) resolves the best glyph.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.CARD_GLYPHS = {
    // --- weapons / attacks ---
    rifle: { p: [[-0.95,0.25, 0.25,0.25, 0.25,0.05, 0.95,0.05, 0.95,-0.2, 0.25,-0.2, 0.25,-0.4, -0.7,-0.4, -0.95,0.25], [-0.45,-0.4, -0.6,0.05], [0.4,-0.2, 0.4,0.05]] },
    burst: { p: [[-0.9,-0.35, 0.2,-0.35], [-0.9,0, 0.2,0], [-0.9,0.35, 0.2,0.35], [0.2,-0.35, 0.6,-0.5], [0.2,0, 0.7,0], [0.2,0.35, 0.6,0.5]] },
    blade: { p: [[-0.6,0.75, 0.55,-0.5, 0.8,-0.78, 0.5,-0.5, 0.66,-0.2], [-0.45,0.6, -0.72,0.52, -0.6,0.78]] },
    shell: { p: [[0,-0.55, 0.45,-0.35, 0.6,0.1, 0.35,0.55, -0.35,0.55, -0.6,0.1, -0.45,-0.35, 0,-0.55], [-0.18,-0.62, 0.18,-0.62], [0.12,-0.62, 0.3,-0.85, 0.5,-0.78]] },
    cannon: { p: [[-0.85,0.5, -0.85,-0.1, 0.5,-0.5, 0.85,-0.3, 0.85,0.1, -0.2,0.5, -0.85,0.5], [-0.55,0.0, -0.55,0.5], [0.55,-0.4, 0.7,-0.65, 0.9,-0.55]] },
    // --- defence ---
    shield: { p: [[0,-0.82, 0.7,-0.5, 0.7,0.18, 0,0.85, -0.7,0.18, -0.7,-0.5, 0,-0.82], [0,-0.5, 0,0.5]] },
    shieldStrike: { p: [[-0.1,-0.78, 0.55,-0.5, 0.55,0.15, -0.1,0.78, -0.72,0.15, -0.72,-0.5, -0.1,-0.78], [0.35,-0.7, 0.9,-0.25], [0.9,-0.25, 0.7,-0.3, 0.85,-0.5]] },
    // --- energy / tech ---
    bolt: { p: [[0.15,-0.85, -0.35,-0.05, 0.05,-0.05, -0.25,0.85, 0.4,-0.1, 0.02,-0.1, 0.35,-0.85, 0.15,-0.85]] },
    core: { p: [[0,-0.75, 0.65,0, 0,0.75, -0.65,0, 0,-0.75], [0,-0.4, 0.35,0, 0,0.4, -0.35,0, 0,-0.4]], e: [[0,0]] },
    turret: { p: [[-0.45,0.6, 0.45,0.6, 0.3,0.1, -0.3,0.1, -0.45,0.6], [-0.2,0.1, -0.2,-0.2, 0.55,-0.45], [0.55,-0.45, 0.85,-0.55], [-0.55,0.6, 0.55,0.6]], e: [[-0.2,-0.05]] },
    reload: { p: [[0.62,-0.2, 0.5,-0.55, 0.18,-0.62], [0.62,-0.2, 0.78,-0.5], [-0.62,0.2, -0.5,0.55, -0.18,0.62], [-0.62,0.2, -0.78,0.5], [0.62,-0.2, 0.35,0.0, 0.0,0.18, -0.35,0.1, -0.62,0.2]] },
    // --- psi / void ---
    eye: { p: [[-0.85,0, -0.42,-0.42, 0.42,-0.42, 0.85,0, 0.42,0.42, -0.42,0.42, -0.85,0], [-0.26,0, 0,-0.26, 0.26,0, 0,0.26, -0.26,0]], e: [[0,0]] },
    psiBolt: { p: [[0,-0.85, 0.12,-0.3, 0.5,-0.5, 0.2,-0.05, 0.7,0.15, 0.18,0.2, 0.28,0.7, 0,0.32, -0.28,0.7, -0.18,0.2, -0.7,0.15, -0.2,-0.05, -0.5,-0.5, -0.12,-0.3, 0,-0.85]], e: [[0,-0.05]] },
    grasp: { p: [[-0.7,-0.5, -0.3,-0.1, -0.5,0.5], [0,-0.6, 0.05,-0.1, -0.1,0.6], [0.7,-0.5, 0.35,-0.1, 0.55,0.55], [-0.4,-0.12, 0.45,-0.12]] },
    vortex: { p: [[0,0, 0.18,-0.2, 0.05,-0.45, -0.3,-0.4, -0.45,0.0, -0.2,0.45, 0.3,0.5, 0.62,0.05, 0.4,-0.5, -0.2,-0.72, -0.7,-0.3]] },
    // --- status / utility ---
    flame: { p: [[0,-0.85, 0.32,-0.4, 0.18,-0.1, 0.45,0.2, 0.22,0.6, 0,0.78, -0.22,0.6, -0.45,0.2, -0.18,-0.1, -0.32,-0.4, 0,-0.85], [0,-0.25, 0.16,0.1, 0,0.45, -0.16,0.1, 0,-0.25]] },
    hex: { p: [[0,-0.72, 0.62,-0.36, 0.62,0.36, 0,0.72, -0.62,0.36, -0.62,-0.36, 0,-0.72], [-0.4,-0.4, 0.4,0.4], [0.4,-0.4, -0.4,0.4]] },
    heal: { p: [[-0.22,-0.72, 0.22,-0.72, 0.22,-0.22, 0.72,-0.22, 0.72,0.22, 0.22,0.22, 0.22,0.72, -0.22,0.72, -0.22,0.22, -0.72,0.22, -0.72,-0.22, -0.22,-0.22, -0.22,-0.72]] },
    might: { p: [[-0.55,0.15, 0,-0.6, 0.55,0.15], [-0.55,0.55, 0,-0.2, 0.55,0.55], [0,-0.6, 0,0.72]] },
    scan: { p: [[-0.55,-0.55, -0.55,-0.2], [-0.55,-0.55, -0.2,-0.55], [0.55,-0.55, 0.2,-0.55], [0.55,-0.55, 0.55,-0.2], [-0.55,0.55, -0.55,0.2], [-0.55,0.55, -0.2,0.55], [0.55,0.55, 0.55,0.2], [0.55,0.55, 0.2,0.55], [-0.5,0, 0.5,0]], e: [[0,0]] },
    drain: { p: [[0,-0.7, 0.4,-0.25, 0.25,0.3, -0.25,0.3, -0.4,-0.25, 0,-0.7], [-0.25,0.3, -0.3,0.65, 0.3,0.65, 0.25,0.3], [-0.18,-0.1, 0.18,-0.1]] },
    skull: { p: [[-0.5,0.12, -0.55,-0.4, -0.3,-0.72, 0.3,-0.72, 0.55,-0.4, 0.5,0.12, 0.3,0.24, 0.3,0.5, 0.12,0.5, 0.12,0.26, -0.12,0.26, -0.12,0.5, -0.3,0.5, -0.3,0.24, -0.5,0.12], [0,-0.06, -0.12,0.14, 0.12,0.14, 0,-0.06]], e: [[-0.24,-0.22], [0.24,-0.22]] },
  };

  // Explicit card -> glyph mapping. Anything unmapped falls back by type.
  var GLYPH_OF = {
    pulse_rifle: 'rifle', burst_fire: 'burst', suppressing_fire: 'burst', scrap_shot: 'rifle',
    bayonet_charge: 'blade', whirlwind: 'blade',
    frag_grenade: 'shell', orbital_strike: 'shell', heavy_ordnance: 'cannon',
    shield_slam: 'shieldStrike', kinetic_discharge: 'shieldStrike',
    executioner: 'skull',
    shock_coil: 'bolt', emp_blast: 'bolt', railgun: 'cannon',
    leech_coil: 'drain',
    mind_spike: 'psiBolt', psy_lance: 'psiBolt', eldritch_storm: 'vortex',
    tk_crush: 'grasp',
    combat_shield: 'shield', overshield: 'shield', bulwark: 'shield', brace: 'shield',
    guard_protocol: 'shield', fortify_matrix: 'shield', entrench_field: 'shieldStrike',
    adrenal_surge: 'bolt', overclock: 'bolt', reload: 'reload', combat_scan: 'scan', premonition: 'eye',
    nano_repair: 'heal', med_stim: 'heal',
    soul_burn: 'flame', catalyst: 'flame', hex_weave: 'hex', mind_fracture: 'eye', limit_break: 'might',
    combat_stims: 'might', warlord_protocol: 'might',
    deploy_turret: 'turret', phase_bulwark: 'shield', aux_reactor: 'core', psionic_focus: 'eye',
    entropy_field: 'flame', iron_resolve: 'shield', reckless_protocol: 'core',
    overload_capacitor: 'core', echo_core: 'core', mind_array: 'hex', plague_engine: 'flame',
    salvage_protocol: 'core',
    void_taint: 'vortex', shrapnel: 'shell', recurring_curse: 'skull',
    // expansion
    war_cry: 'might', cluster_munitions: 'shell', bunker_down: 'shield',
    arc_welder: 'bolt', static_lance: 'bolt', shield_battery: 'core',
    void_bolt: 'psiBolt', wither: 'hex', blood_sacrifice: 'drain',
    orbital_bombardment: 'cannon', omega_protocol: 'core', singularity_bloom: 'vortex', juggernaut_core: 'core',
    salvaged_ordnance: 'cannon', stim_overdose: 'bolt', forbidden_lore: 'eye',
    shield_bash: 'shieldStrike', reckless_charge: 'blade', suppressing_barrage: 'shell', rallying_shout: 'might',
    frenzy: 'burst', bloodlust: 'drain', riposte_protocol: 'shieldStrike',
    rapid_fire: 'rifle', trigger_discipline: 'reload', hail_of_lead: 'burst', full_auto: 'might', unload: 'cannon',
  };
  var TYPE_DEFAULT = { attack: 'rifle', skill: 'shield', power: 'core', curse: 'skull' };

  ns.cardGlyph = function (id, def) {
    var g = GLYPH_OF[id] || (def && TYPE_DEFAULT[def.type]) || 'core';
    return ns.CARD_GLYPHS[g] || ns.CARD_GLYPHS.core;
  };

  // Per-class draw/discard pile icons (a "full" charge vs a "spent" one).
  ns.PILE_ICONS = {
    vanguard: {
      // a live cartridge vs a spent casing
      draw: { p: [[-0.27,-0.12, 0,-0.72, 0.27,-0.12, 0.27,0.66, -0.27,0.66, -0.27,-0.12], [-0.27,0.16, 0.27,0.16], [-0.27,0.42, 0.27,0.42]] },
      discard: { p: [[-0.44,-0.52, 0.44,-0.52, 0.3,-0.34, 0.3,0.66, -0.3,0.66, -0.3,-0.34, -0.44,-0.52], [-0.3,-0.08, 0.3,-0.08]] },
    },
    technomancer: {
      // a charged energy cell vs a drained, cracked one
      draw: { p: [[-0.32,-0.52, 0.32,-0.52, 0.32,0.66, -0.32,0.66, -0.32,-0.52], [-0.14,-0.52, -0.14,-0.7, 0.14,-0.7, 0.14,-0.52], [-0.18,-0.22, 0.18,-0.22], [-0.18,0.08, 0.18,0.08], [-0.18,0.38, 0.18,0.38]] },
      discard: { p: [[-0.32,-0.52, 0.32,-0.52, 0.32,0.66, -0.32,0.66, -0.32,-0.52], [-0.14,-0.52, -0.14,-0.7, 0.14,-0.7, 0.14,-0.52], [-0.06,-0.28, 0.12,0.04, -0.1,0.1, 0.08,0.44]] },
    },
    voidadept: {
      // a live void shard (eye) vs a cracked, dead one
      draw: { p: [[0,-0.7, 0.42,-0.04, 0,0.72, -0.42,-0.04, 0,-0.7], [0,-0.36, 0,0.42]], e: [[0,0.02]] },
      discard: { p: [[0,-0.7, 0.42,-0.04, 0,0.72, -0.42,-0.04, 0,-0.7], [-0.18,-0.3, 0.1,-0.02, -0.08,0.06, 0.16,0.4]] },
    },
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
