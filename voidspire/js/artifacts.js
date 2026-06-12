/* =========================================================================
 * VOIDSPIRE — artifacts.js
 * Passive relics. Each has a single declarative hook the engine checks.
 * tier: 1 = normal drops (elites, events, shop), 2 = boss rewards.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.ARTIFACTS = {
    aegis_core:      { name: 'Aegis Core',        tier: 1, k: 'blockStart',      v: 8,    desc: 'Start each combat with 8 Shield.',
      art: { p: [[0,-1, 0.87,-0.5, 0.87,0.5, 0,1, -0.87,0.5, -0.87,-0.5, 0,-1]], e: [[0,0]] } },
    servo_skull:     { name: 'Servo Skull',       tier: 1, k: 'drawStart',       v: 2,    desc: 'Draw 2 extra cards on your first turn.',
      art: { p: [[-0.6,-0.1, -0.6,-0.55, -0.25,-0.85, 0.25,-0.85, 0.6,-0.55, 0.6,-0.1, 0.35,0.15, 0.35,0.5, -0.35,0.5, -0.35,0.15, -0.6,-0.1], [-0.2,0.5, -0.2,0.75], [0,0.5, 0,0.8], [0.2,0.5, 0.2,0.75], [0,-0.85, 0,-1.1]], e: [[-0.25,-0.3],[0.25,-0.3]] } },
    blood_chalice:   { name: 'Blood Chalice',     tier: 1, k: 'healAfterCombat', v: 5,    desc: 'Heal 5 HP after every combat.',
      art: { p: [[-0.6,-0.8, 0.6,-0.8, 0.45,-0.2, 0,0.05, -0.45,-0.2, -0.6,-0.8], [0,0.05, 0,0.55], [-0.4,0.8, 0.4,0.8], [-0.4,0.8, 0,0.55, 0.4,0.8]], e: [[0,-0.45]] } },
    targeting_visor: { name: 'Targeting Visor',   tier: 1, k: 'critBonus',       v: 2,    desc: 'Crit on a d20 roll of 18 or higher.',
      art: { p: [[0.5,0, 0.35,0.35, 0,0.5, -0.35,0.35, -0.5,0, -0.35,-0.35, 0,-0.5, 0.35,-0.35, 0.5,0], [0.5,0, 0.9,0], [-0.5,0, -0.9,0], [0,-0.5, 0,-0.9], [0,0.5, 0,0.9]], e: [[0,0]] } },
    power_fist:      { name: 'Power Fist',        tier: 1, k: 'strStart',        v: 1,    desc: 'Start each combat with 1 Might.',
      art: { p: [[-0.7,-0.4, 0.3,-0.6, 0.6,-0.3, 0.6,0.4, -0.3,0.6, -0.7,0.3, -0.7,-0.4], [0.6,-0.1, 0.9,-0.1], [0.6,0.2, 0.9,0.2], [-0.7,-0.05, -1.0,0]], e: [] } },
    war_sigil:       { name: 'War Sigil',         tier: 1, k: 'attr', a: 'might', v: 1,   desc: '+1 MIGHT.',
      art: { p: [[0,-1, 0,0.95], [0,-0.9, 0.85,-0.55, 0,-0.2], [-0.3,0.95, 0.3,0.95]], e: [] } },
    cog_implant:     { name: 'Cogitator Implant', tier: 1, k: 'attr', a: 'tech',  v: 1,   desc: '+1 TECH.',
      art: { p: [[-0.55,-0.55, 0.55,-0.55, 0.55,0.55, -0.55,0.55, -0.55,-0.55], [0,-0.55, 0,-0.9], [0.55,0, 0.9,0], [0,0.55, 0,0.9], [-0.55,0, -0.9,0], [0,-0.25, 0.25,0, 0,0.25, -0.25,0, 0,-0.25]], e: [] } },
    warp_shard:      { name: 'Warp Shard',        tier: 1, k: 'attr', a: 'psi',   v: 1,   desc: '+1 PSI.',
      art: { p: [[0,-1, 0.45,-0.1, 0.2,0.9, -0.2,0.7, -0.45,-0.2, 0,-1], [0,-0.7, 0.05,0.5]], e: [[0,-0.2]] } },
    salvager_rig:    { name: 'Salvager Rig',      tier: 1, k: 'creditsMul',      v: 0.25, desc: '+25% credits from combat.',
      art: { p: [[-0.6,-0.1, 0.6,-0.1, 0.6,0.8, -0.6,0.8, -0.6,-0.1], [-0.6,0.35, 0.6,0.35], [0,-0.1, 0,-0.5, 0.3,-0.7, 0.15,-0.95]], e: [] } },
    adrenaline_pump: { name: 'Adrenaline Pump',   tier: 1, k: 'energyTurn1',     v: 1,    desc: '+1 Energy on your first turn.',
      art: { p: [[0,0.8, -0.8,-0.1, -0.45,-0.65, 0,-0.25, 0.45,-0.65, 0.8,-0.1, 0,0.8], [-0.3,-0.05, 0,0.3, 0.3,-0.05]], e: [] } },
    nano_mesh:       { name: 'Nano Mesh',         tier: 1, k: 'plate',           v: 2,    desc: 'Gain 2 Shield at the start of each turn.',
      art: { p: [[0,-0.9, 0.9,0, 0,0.9, -0.9,0, 0,-0.9], [-0.45,-0.45, 0.45,0.45], [0.45,-0.45, -0.45,0.45]], e: [] } },
    void_lens:       { name: 'Void Lens',         tier: 1, k: 'flatDmg',         v: 1,    desc: 'Your attacks deal +1 damage.',
      art: { p: [[-0.9,0, -0.3,-0.5, 0.3,-0.5, 0.9,0, 0.3,0.5, -0.3,0.5, -0.9,0], [0,-0.25, 0.25,0, 0,0.25, -0.25,0, 0,-0.25]], e: [[0,0]] } },
    medic_drone:     { name: 'Medic Drone',       tier: 1, k: 'healTurn',        v: 1,    desc: 'Heal 1 HP at the start of each turn.',
      art: { p: [[-0.25,-0.7, 0.25,-0.7, 0.25,-0.25, 0.7,-0.25, 0.7,0.25, 0.25,0.25, 0.25,0.7, -0.25,0.7, -0.25,0.25, -0.7,0.25, -0.7,-0.25, -0.25,-0.25, -0.25,-0.7], [-0.7,-0.6, -0.95,-0.75], [0.7,-0.6, 0.95,-0.75]], e: [] } },
    tactical_uplink: { name: 'Tactical Uplink',   tier: 1, k: 'checkBonus',      v: 3,    desc: '+3 to all event skill checks.',
      art: { p: [[0,0.95, 0,-0.3], [-0.5,-0.35, 0,-0.85, 0.5,-0.35], [-0.27,-0.3, 0,-0.55, 0.27,-0.3], [-0.4,0.95, 0.4,0.95]], e: [[0,-0.95]] } },
    thorn_husk:      { name: 'Thornmail Husk',    tier: 1, k: 'thorns',          v: 2,    desc: 'Attackers take 2 damage.',
      art: { p: [[0,-0.6, 0.6,0, 0,0.6, -0.6,0, 0,-0.6], [0,-0.6, 0,-1], [0.6,0, 1,0], [0,0.6, 0,1], [-0.6,0, -1,0]], e: [] } },
    cryo_capsule:    { name: 'Cryo Capsule',      tier: 1, k: 'sectorHeal',      v: 0.25, desc: 'Heal 25% HP when entering a new sector.',
      art: { p: [[-0.45,-0.85, 0.45,-0.85, 0.45,0.85, -0.45,0.85, -0.45,-0.85], [-0.25,-0.55, 0.25,-0.55, 0.25,-0.05, -0.25,-0.05, -0.25,-0.55], [-0.25,0.3, 0.25,0.3], [-0.25,0.55, 0.25,0.55]], e: [[0,-0.3]] } },

    ancient_sigil:   { name: 'Ancient Sigil',     tier: 2, k: 'energyEveryTurn', v: 1,    desc: '+1 Energy every turn.',
      art: { p: [[0,-0.95, 0.95,0, 0,0.95, -0.95,0, 0,-0.95], [0,-0.5, 0.5,0, 0,0.5, -0.5,0, 0,-0.5]], e: [[0,0]] } },
    dread_plate:     { name: 'Dreadnought Plate', tier: 2, k: 'maxHp',           v: 22,   desc: '+22 Max HP.',
      art: { p: [[0,-0.9, 0.7,-0.6, 0.7,0.1, 0,0.9, -0.7,0.1, -0.7,-0.6, 0,-0.9], [-0.35,-0.2, 0,0.1, 0.35,-0.2]], e: [[-0.45,-0.5],[0.45,-0.5]] } },
    singularity:     { name: 'Singularity Engine',tier: 2, k: 'aoeTurnStart',    v: 4,    desc: 'Deal 4 damage to ALL enemies at the start of your turn.',
      art: { p: [[0.7,0, 0.5,0.5, 0,0.7, -0.5,0.5, -0.7,0, -0.45,-0.45, 0,-0.55, 0.35,-0.3, 0.4,0, 0.2,0.25, 0,0.28, -0.18,0.12, -0.15,-0.1, 0,-0.15]], e: [[0,0]] } },
    omega_visor:     { name: 'Omega Visor',       tier: 2, k: 'critBonus',       v: 4,    desc: 'Crit on a d20 roll of 16 or higher.',
      art: { p: [[-0.6,0.8, -0.25,0.8, -0.25,0.55, -0.55,0.3, -0.6,-0.2, -0.3,-0.65, 0.3,-0.65, 0.6,-0.2, 0.55,0.3, 0.25,0.55, 0.25,0.8, 0.6,0.8]], e: [[-0.2,-0.2],[0.2,-0.2]] } },
  };

  // Sum of v over owned artifacts matching hook k.
  ns.artifactSum = function (owned, k) {
    var t = 0;
    for (var i = 0; i < owned.length; i++) {
      var a = ns.ARTIFACTS[owned[i]];
      if (a && a.k === k) t += a.v;
    }
    return t;
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
