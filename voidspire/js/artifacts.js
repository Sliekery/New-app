/* =========================================================================
 * VOIDSPIRE — artifacts.js
 * Passive relics. Each has a single declarative hook the engine checks.
 * tier: 1 = normal drops (elites, events, shop), 2 = boss rewards.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.ARTIFACTS = {
    aegis_core:      { name: 'Aegis Core',        tier: 1, k: 'blockStart',      v: 8,    desc: 'Start each combat with 8 Shield.' },
    servo_skull:     { name: 'Servo Skull',       tier: 1, k: 'drawStart',       v: 2,    desc: 'Draw 2 extra cards on your first turn.' },
    blood_chalice:   { name: 'Blood Chalice',     tier: 1, k: 'healAfterCombat', v: 5,    desc: 'Heal 5 HP after every combat.' },
    targeting_visor: { name: 'Targeting Visor',   tier: 1, k: 'critBonus',       v: 2,    desc: 'Crit on a d20 roll of 18 or higher.' },
    power_fist:      { name: 'Power Fist',        tier: 1, k: 'strStart',        v: 1,    desc: 'Start each combat with 1 Might.' },
    war_sigil:       { name: 'War Sigil',         tier: 1, k: 'attr', a: 'might', v: 1,   desc: '+1 MIGHT.' },
    cog_implant:     { name: 'Cogitator Implant', tier: 1, k: 'attr', a: 'tech',  v: 1,   desc: '+1 TECH.' },
    warp_shard:      { name: 'Warp Shard',        tier: 1, k: 'attr', a: 'psi',   v: 1,   desc: '+1 PSI.' },
    salvager_rig:    { name: 'Salvager Rig',      tier: 1, k: 'creditsMul',      v: 0.25, desc: '+25% credits from combat.' },
    adrenaline_pump: { name: 'Adrenaline Pump',   tier: 1, k: 'energyTurn1',     v: 1,    desc: '+1 Energy on your first turn.' },
    nano_mesh:       { name: 'Nano Mesh',         tier: 1, k: 'plate',           v: 2,    desc: 'Gain 2 Shield at the start of each turn.' },
    void_lens:       { name: 'Void Lens',         tier: 1, k: 'flatDmg',         v: 1,    desc: 'Your attacks deal +1 damage.' },
    medic_drone:     { name: 'Medic Drone',       tier: 1, k: 'healTurn',        v: 1,    desc: 'Heal 1 HP at the start of each turn.' },
    tactical_uplink: { name: 'Tactical Uplink',   tier: 1, k: 'checkBonus',      v: 3,    desc: '+3 to all event skill checks.' },
    thorn_husk:      { name: 'Thornmail Husk',    tier: 1, k: 'thorns',          v: 2,    desc: 'Attackers take 2 damage.' },
    cryo_capsule:    { name: 'Cryo Capsule',      tier: 1, k: 'sectorHeal',      v: 0.25, desc: 'Heal 25% HP when entering a new sector.' },

    ancient_sigil:   { name: 'Ancient Sigil',     tier: 2, k: 'energyEveryTurn', v: 1,    desc: '+1 Energy every turn.' },
    dread_plate:     { name: 'Dreadnought Plate', tier: 2, k: 'maxHp',           v: 22,   desc: '+22 Max HP.' },
    singularity:     { name: 'Singularity Engine',tier: 2, k: 'aoeTurnStart',    v: 4,    desc: 'Deal 4 damage to ALL enemies at the start of your turn.' },
    omega_visor:     { name: 'Omega Visor',       tier: 2, k: 'critBonus',       v: 4,    desc: 'Crit on a d20 roll of 16 or higher.' },
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
