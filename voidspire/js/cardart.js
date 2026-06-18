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
    rifle: { p: [[-0.92,0.08, 0.34,0.08, 0.34,-0.1, 0.96,-0.1, 0.96,-0.24, 0.34,-0.24, 0.34,-0.34, -0.58,-0.34, -0.92,0.08], [-0.5,-0.34, -0.46,-0.56, -0.08,-0.56, -0.08,-0.34], [-0.5,0.08, -0.56,0.52, -0.22,0.52, -0.16,0.08], [0.06,0.08, 0.06,0.28, -0.14,0.28]] },
    burst: { p: [[-0.6,-0.5, -0.22,-0.5, -0.04,-0.38, -0.22,-0.26, -0.6,-0.26, -0.6,-0.5], [-0.98,-0.38, -0.66,-0.38], [-0.42,-0.12, -0.04,-0.12, 0.14,0, -0.04,0.12, -0.42,0.12, -0.42,-0.12], [-0.82,0, -0.48,0], [-0.6,0.26, -0.22,0.26, -0.04,0.38, -0.22,0.5, -0.6,0.5, -0.6,0.26], [-0.98,0.38, -0.66,0.38]] },
    blade: { p: [[-0.78,0.78, 0.5,-0.5, 0.78,-0.78, 0.52,-0.46, 0.62,-0.2], [-0.5,0.36, -0.82,0.6, -0.66,0.78, -0.36,0.52], [-0.66,0.78, -0.88,0.92]] },
    shell: { p: [[-0.4,-0.32, 0.4,-0.32, 0.52,0.05, 0.4,0.5, -0.4,0.5, -0.52,0.05, -0.4,-0.32], [-0.44,-0.08, 0.44,-0.08], [-0.5,0.2, 0.5,0.2], [-0.18,-0.32, -0.18,-0.54, 0.18,-0.54, 0.18,-0.32], [0.18,-0.5, 0.5,-0.66], [0.4,-0.74, 0.62,-0.74, 0.62,-0.52]] },
    cannon: { p: [[-0.92,0.42, -0.92,-0.14, 0.42,-0.52, 0.92,-0.32, 0.92,0.1, -0.24,0.46, -0.92,0.42], [-0.56,0.0, -0.56,0.44], [0.5,-0.42, 0.66,-0.7, 0.88,-0.58], [-0.92,0.14, 0.4,-0.24]] },
    // --- defence ---
    shield: { p: [[0,-0.85, 0.7,-0.52, 0.7,0.16, 0,0.86, -0.7,0.16, -0.7,-0.52, 0,-0.85], [0,-0.55, 0,0.55], [-0.5,-0.18, 0.5,-0.18]] },
    shieldStrike: { p: [[-0.12,-0.8, 0.5,-0.5, 0.5,0.14, -0.12,0.8, -0.74,0.14, -0.74,-0.5, -0.12,-0.8], [-0.12,-0.5, -0.12,0.5], [0.34,-0.78, 0.92,-0.2], [0.92,-0.2, 0.66,-0.28, 0.84,-0.52]] },
    // --- energy / tech ---
    bolt: { p: [[0.18,-0.86, -0.36,-0.04, 0.06,-0.04, -0.26,0.86, 0.42,-0.1, 0.02,-0.1, 0.36,-0.86, 0.18,-0.86]] },
    core: { p: [[0,-0.78, 0.68,0, 0,0.78, -0.68,0, 0,-0.78], [0,-0.42, 0.37,0, 0,0.42, -0.37,0, 0,-0.42], [0,-0.78, 0,-1.0], [0.68,0, 0.92,0], [0,0.78, 0,1.0], [-0.68,0, -0.92,0]], e: [[0,0]] },
    turret: { p: [[-0.55,0.6, -0.42,0.38, 0.42,0.38, 0.55,0.6], [-0.36,0.38, -0.36,0.02, -0.12,-0.24, 0.24,-0.24, 0.36,0.02, 0.36,0.38], [0.26,-0.12, 0.78,-0.32], [0.78,-0.32, 0.92,-0.26]], e: [[-0.04,-0.04]] },
    reload: { p: [[-0.28,-0.4, 0.28,-0.4, 0.28,0.46, -0.28,0.46, -0.28,-0.4], [-0.13,-0.4, -0.13,-0.58, 0.13,-0.58, 0.13,-0.4], [-0.13,-0.16, 0.13,-0.16], [-0.13,0.06, 0.13,0.06], [-0.13,0.28, 0.13,0.28], [0.46,-0.34, 0.72,-0.06, 0.55,0.22], [0.72,-0.06, 0.82,-0.36]] },
    // --- psi / void ---
    eye: { p: [[-0.86,0, -0.45,-0.46, 0.45,-0.46, 0.86,0, 0.45,0.46, -0.45,0.46, -0.86,0], [-0.3,0, 0,-0.3, 0.3,0, 0,0.3, -0.3,0]], e: [[0,0]] },
    psiBolt: { p: [[0,-0.88, 0.18,-0.18, 0,0.88, -0.18,-0.18, 0,-0.88], [-0.6,-0.38, -0.2,-0.06], [0.6,-0.38, 0.2,-0.06], [-0.52,0.42, -0.16,0.12], [0.52,0.42, 0.16,0.12]], e: [[0,-0.04]] },
    grasp: { p: [[-0.58,-0.52, -0.36,-0.12, -0.52,0.48], [-0.22,-0.66, -0.12,-0.1, -0.24,0.58], [0.22,-0.66, 0.12,-0.1, 0.24,0.58], [0.58,-0.52, 0.36,-0.12, 0.52,0.48], [-0.46,-0.08, 0.46,-0.08]] },
    vortex: { p: [[0,0, 0.2,-0.22, 0.06,-0.48, -0.32,-0.42, -0.48,0.0, -0.22,0.48, 0.32,0.52, 0.66,0.06, 0.42,-0.52, -0.2,-0.76, -0.74,-0.32], [-0.74,-0.32, -0.92,-0.08]] },
    // --- status / utility ---
    flame: { p: [[0,-0.86, 0.34,-0.4, 0.18,-0.08, 0.46,0.22, 0.22,0.62, 0,0.8, -0.22,0.62, -0.46,0.22, -0.18,-0.08, -0.34,-0.4, 0,-0.86], [0,-0.22, 0.18,0.12, 0,0.48, -0.18,0.12, 0,-0.22]] },
    hex: { p: [[0,-0.74, 0.64,-0.37, 0.64,0.37, 0,0.74, -0.64,0.37, -0.64,-0.37, 0,-0.74], [-0.34,-0.36, 0.34,0.36], [0.34,-0.36, -0.34,0.36], [-0.42,0, 0.42,0]] },
    heal: { p: [[-0.22,-0.74, 0.22,-0.74, 0.22,-0.22, 0.74,-0.22, 0.74,0.22, 0.22,0.22, 0.22,0.74, -0.22,0.74, -0.22,0.22, -0.74,0.22, -0.74,-0.22, -0.22,-0.22, -0.22,-0.74], [-0.9,0.62, -0.55,0.62, -0.4,0.36, -0.18,0.78, 0.0,0.5, 0.12,0.62, 0.9,0.62]] },
    might: { p: [[-0.46,-0.18, -0.48,-0.5, 0.3,-0.56, 0.46,-0.28, 0.46,0.34, -0.28,0.5, -0.48,0.24, -0.46,-0.18], [0.46,-0.12, 0.66,-0.12], [0.46,0.1, 0.66,0.1], [-0.3,-0.32, -0.04,-0.4, -0.04,0.42], [-0.04,-0.4, 0.2,-0.46]] },
    scan: { p: [[-0.58,-0.58, -0.58,-0.22], [-0.58,-0.58, -0.22,-0.58], [0.58,-0.58, 0.22,-0.58], [0.58,-0.58, 0.58,-0.22], [-0.58,0.58, -0.58,0.22], [-0.58,0.58, -0.22,0.58], [0.58,0.58, 0.58,0.22], [0.58,0.58, 0.22,0.58], [-0.52,0, 0.52,0], [0,-0.52, 0,0.52]], e: [[0,0]] },
    drain: { p: [[-0.34,-0.6, 0.34,-0.6, 0.3,0.12, 0,0.54, -0.3,0.12, -0.34,-0.6], [-0.2,-0.7, 0.2,-0.7], [0.12,-0.7, 0.34,-0.92, 0.54,-0.82], [-0.16,-0.06, 0.16,-0.06], [-0.08,0.16, 0.08,0.16]] },
    skull: { p: [[-0.5,0.12, -0.55,-0.4, -0.3,-0.72, 0.3,-0.72, 0.55,-0.4, 0.5,0.12, 0.3,0.24, 0.3,0.5, 0.12,0.5, 0.12,0.26, -0.12,0.26, -0.12,0.5, -0.3,0.5, -0.3,0.24, -0.5,0.12], [0,-0.06, -0.13,0.16, 0.13,0.16, 0,-0.06]], e: [[-0.25,-0.22], [0.25,-0.22]] },
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
    entropy_field: 'flame', iron_resolve: 'shield', reckless_protocol: 'might',
    overload_capacitor: 'core', echo_core: 'core', mind_array: 'hex', plague_engine: 'flame',
    salvage_protocol: 'core',
    void_taint: 'vortex', shrapnel: 'shell', recurring_curse: 'skull', void_swarm: 'hex',
    // expansion
    war_cry: 'might', cluster_munitions: 'drain', bunker_down: 'shield', suppressing_barrage: 'shield',
    arc_welder: 'bolt', static_lance: 'bolt', shield_battery: 'core',
    void_bolt: 'psiBolt', wither: 'flame', blood_sacrifice: 'drain',
    orbital_bombardment: 'cannon', omega_protocol: 'core', singularity_bloom: 'vortex', juggernaut_core: 'core',
    salvaged_ordnance: 'cannon', stim_overdose: 'bolt', forbidden_lore: 'eye',
    shield_bash: 'shieldStrike', reckless_charge: 'blade', suppressing_barrage: 'shell', rallying_shout: 'shield',
    frenzy: 'burst', bloodlust: 'drain', riposte_protocol: 'shieldStrike',
    rapid_fire: 'rifle', trigger_discipline: 'reload', hail_of_lead: 'burst', full_auto: 'might', unload: 'cannon',
    blood_rage: 'might', deflect: 'shieldStrike', counterstrike: 'blade', crimson_pact: 'drain', whet_the_blade: 'blade', bloodbath: 'skull', vengeance: 'drain',
    salvo: 'shell', reload: 'reload', breaching_charge: 'cannon', field_strip: 'reload', cluster_charge: 'shell', quartermaster: 'core',
    // technomancer overhaul
    reinforced_hull: 'core', hold_the_line: 'shield', fortified_strike: 'shieldStrike', aegis_matrix: 'shield',
    hive_protocol: 'turret', assault_drone: 'turret', mortar_array: 'turret', targeting_uplink: 'turret', salvage_servitor: 'bolt', munitions_factory: 'turret',
    flux_capacitor: 'core', surge_protocol: 'reload', capacitor_discharge: 'bolt', recompile: 'reload', singularity_drive: 'core',
    tesla_conduit: 'bolt', disruptor_pulse: 'bolt', short_circuit: 'bolt', system_shock: 'scan', feedback_loop: 'scan', ion_storm: 'bolt', emp_mine: 'bolt', overcharged_capacitor: 'bolt', overload_surge: 'bolt',
    shock_coil: 'reload',
    // voidadept overhaul
    immolate: 'flame', cinder_burst: 'flame', ember_storm: 'hex', wildfire_engine: 'flame', conflagration: 'flame',
    ascendant_mind: 'eye', mind_lance: 'psiBolt', cerebral_spike: 'psiBolt', psionic_nova: 'vortex',
    bloodletting: 'drain', crimson_rite: 'drain',
    void_rupture: 'vortex', null_field: 'hex', dread_whisper: 'eye',
    vital_lance: 'drain', sanguine_ward: 'shield', martyrs_gift: 'drain', mind_burn: 'flame',
    entropic_lash: 'flame', dimensional_rift: 'vortex', psionic_scream: 'psiBolt', spectral_grasp: 'grasp',
    // mechanically-distinct: wards / conversions / triggers
    ember_ward: 'flame', backdraft: 'flame', mind_bulwark: 'shield',
    static_ward: 'shield', swarm_uplink: 'turret', subroutine: 'core',
    spiked_bulwark: 'shieldStrike', demolition_train: 'shell',
  };
  var TYPE_DEFAULT = { attack: 'rifle', skill: 'shield', power: 'core', curse: 'skull' };

  ns.cardGlyph = function (id, def) {
    var g = GLYPH_OF[id] || (def && TYPE_DEFAULT[def.type]) || 'core';
    return ns.CARD_GLYPHS[g] || ns.CARD_GLYPHS.core;
  };

  // Big faint per-class motif sat behind the card art for instant faction read.
  ns.CLASS_MOTIF = {
    vanguard: { p: [[-0.62,0.45, 0,-0.05, 0.62,0.45], [-0.62,0.05, 0,-0.45, 0.62,0.05], [-0.62,-0.35, 0,-0.85, 0.62,-0.35]] },
    technomancer: { p: [[0,-0.82, 0.71,-0.41, 0.71,0.41, 0,0.82, -0.71,0.41, -0.71,-0.41, 0,-0.82], [0,-0.4, 0.35,-0.2, 0.35,0.2, 0,0.4, -0.35,0.2, -0.35,-0.2, 0,-0.4], [0,-0.4, 0,0.4], [-0.35,-0.2, 0.35,0.2]], e: [[0,0]] },
    voidadept: { p: [[0,-0.88, 0.72,0, 0,0.88, -0.72,0, 0,-0.88], [-0.5,0, -0.25,-0.32, 0.25,-0.32, 0.5,0, 0.25,0.32, -0.25,0.32, -0.5,0]], e: [[0,0]] },
    warpcaller: { p: [[-0.5,-0.72, -0.28,-0.2, -0.52,0.62], [0.04,-0.8, 0.12,-0.2, -0.08,0.7], [0.58,-0.72, 0.32,-0.2, 0.56,0.62]] },
    shared: { p: [[0,-0.85, 0.22,-0.62, 0.55,-0.6, 0.6,-0.28, 0.85,0, 0.6,0.28, 0.55,0.6, 0.22,0.62, 0,0.85, -0.22,0.62, -0.55,0.6, -0.6,0.28, -0.85,0, -0.6,-0.28, -0.55,-0.6, -0.22,-0.62, 0,-0.85], [0,-0.32, 0.32,0, 0,0.32, -0.32,0, 0,-0.32]] },
  };
  ns.cardClass = function (id) {
    var c = ns.CARDS && ns.CARDS[id], x = c && c.cls;
    return (x === 'vanguard' || x === 'technomancer' || x === 'voidadept' || x === 'warpcaller') ? x : 'shared';
  };
  ns.cardMotif = function (cls) { return ns.CLASS_MOTIF[cls] || ns.CLASS_MOTIF.shared; };

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
