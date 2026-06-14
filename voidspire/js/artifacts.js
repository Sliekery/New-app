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

    /* ============ Special passive relics ============ */
    static_capacitor: { name: 'Static Capacitor', tier: 1, k: 'shieldThorns', v: 2,
      desc: 'Whenever you gain Shield, deal 2 damage to a random enemy.',
      art: { p: [[-0.1,-0.75, -0.35,-0.05, 0.02,-0.05, -0.15,0.75, 0.4,-0.1, 0.04,-0.1, 0.28,-0.75, -0.1,-0.75]], e: [] } },
    reaper_protocol: { name: 'Reaper Protocol', tier: 1, k: 'healOnKill', v: 2,
      desc: 'Whenever you kill an enemy, heal 2 HP.',
      art: { p: [[0.45,-0.75, 0.45,0.75], [0.45,-0.7, 0.05,-0.6, -0.4,-0.25, -0.62,0.25], [-0.62,0.25, -0.2,0.05, 0.15,-0.2, 0.45,-0.5]], e: [] } },
    hoarfrost_cell: { name: 'Hoarfrost Cell', tier: 1, k: 'weakStart', v: 2,
      desc: 'At the start of each combat, apply 2 Weak to all enemies.',
      art: { p: [[0,-0.82, 0,0.82], [-0.71,-0.41, 0.71,0.41], [-0.71,0.41, 0.71,-0.41], [0,-0.82, -0.18,-0.6], [0,-0.82, 0.18,-0.6], [0,0.82, -0.18,0.6], [0,0.82, 0.18,0.6], [0.71,-0.41, 0.5,-0.5], [-0.71,0.41, -0.5,0.5]], e: [] } },
    bloodlust_engine: { name: 'Bloodlust Engine', tier: 2, k: 'strOnKill', v: 1,
      desc: 'Whenever an enemy dies, gain 1 Might for the rest of combat.',
      art: { p: [[-0.42,0.6, -0.42,-0.2], [-0.62,0.0, -0.42,-0.42, -0.22,0.0], [0.42,0.6, 0.42,-0.2], [0.22,0.0, 0.42,-0.42, 0.62,0.0], [0,0.5, 0,-0.55], [-0.2,-0.15, 0,-0.62, 0.2,-0.15]], e: [] } },
    overflow_reactor: { name: 'Overflow Reactor', tier: 2, k: 'energyCarry', v: 1,
      desc: 'Unused Energy carries over to your next turn.',
      art: { p: [[-0.5,-0.5, 0.5,-0.5, 0.5,0.6, -0.5,0.6, -0.5,-0.5], [-0.22,-0.5, -0.22,-0.72, 0.22,-0.72, 0.22,-0.5], [-0.22,0.15, 0.02,-0.22, 0.02,0.05, 0.26,-0.32]], e: [] } },
    glass_cannon: { name: 'Glass Cannon', tier: 2, k: 'dmgMult', v: 0.5, special: 'glassCannon',
      desc: 'Deal 50% more damage — but your Max HP is permanently reduced by 25%.',
      art: { p: [[0.6,0, 0.42,0.42, 0,0.6, -0.42,0.42, -0.6,0, -0.42,-0.42, 0,-0.6, 0.42,-0.42, 0.6,0], [-0.72,0, 0.72,0], [0,-0.72, 0,0.72], [0.16,-0.6, 0.0,-0.2, 0.2,0.1, 0.0,0.5]], e: [] } },

    /* ============ Quest relics (complete the task → unlock the reward) ============ */
    offline_shield: { name: 'Offline Shield', tier: 2,
      quest: { track: 'noShieldWin', goal: 3, label: 'Win 3 combats without gaining any Shield' },
      done: { k: 'platedArmorStart', v: 7 },
      doneDesc: 'Start each combat with 7 Plated Armor (each turn gain Shield equal to it, then it drops by 1).',
      desc: 'QUEST — Win 3 combats without gaining any Shield. → Start each combat with 7 Plated Armor.',
      art: { p: [[0,-0.85, 0.7,-0.45, 0.7,0.35, 0,0.85, -0.7,0.35, -0.7,-0.45, 0,-0.85], [0,-0.5, 0,-0.08], [-0.28,-0.05, -0.32,0.28, 0,0.45, 0.32,0.28, 0.28,-0.05]], e: [] } },
    berserker_pact: { name: "Berserker's Pact", tier: 1,
      quest: { track: 'kills', goal: 15, label: 'Kill 15 enemies' },
      done: { k: 'strStart', v: 2 },
      doneDesc: 'Start each combat with 2 Might.',
      desc: 'QUEST — Kill 15 enemies. → Start each combat with 2 Might.',
      art: { p: [[0,-0.72, 0,0.72], [0,-0.62, 0.52,-0.72, 0.62,-0.2, 0.0,-0.1], [0,-0.62, -0.52,-0.72, -0.62,-0.2, 0.0,-0.1]], e: [] } },
    pacifist_doctrine: { name: 'Pacifist Doctrine', tier: 1,
      quest: { track: 'rewardSkip', goal: 3, label: 'Skip 3 card rewards' },
      done: { k: 'drawTurn', v: 1 },
      doneDesc: 'Draw 1 additional card each turn.',
      desc: 'QUEST — Skip 3 card rewards. → Draw 1 extra card every turn.',
      art: { p: [[0,0.7, 0,-0.7], [0,-0.7, -0.5,-0.3, -0.55,0.2], [0,-0.7, 0.5,-0.3, 0.55,0.2], [-0.3,-0.45, -0.45,-0.1], [0.3,-0.45, 0.45,-0.1]], e: [] } },
    flawless_protocol: { name: 'Flawless Protocol', tier: 2,
      quest: { track: 'flawlessWin', goal: 2, label: 'Win 2 combats without losing any HP' },
      done: { k: 'blockStart', v: 12 },
      doneDesc: 'Start each combat with 12 Shield.',
      desc: 'QUEST — Win 2 combats without losing any HP. → Start each combat with 12 Shield.',
      art: { p: [[0,-0.7, 0.6,-0.2, 0,0.8, -0.6,-0.2, 0,-0.7], [-0.6,-0.2, 0.6,-0.2], [-0.3,-0.7, -0.2,-0.2, 0,0.8], [0.3,-0.7, 0.2,-0.2, 0,0.8], [0,-0.7, 0,-0.2]], e: [] } },
    soul_ledger: { name: 'Soul Ledger', tier: 2,
      quest: { track: 'burnTotal', goal: 60, label: 'Apply 60 Burn to enemies' },
      done: { k: 'burnGrow', v: 1 },
      doneDesc: 'At the start of your turn, all Burn on enemies grows by 1.',
      desc: 'QUEST — Apply 60 Burn to enemies. → Each turn, all enemy Burn grows by 1.',
      art: { p: [[0,0.6, -0.45,0.2, -0.28,-0.22, 0.02,0.1, 0.12,-0.55, 0.32,-0.1, 0.42,0.25, 0,0.6], [-0.52,0.55, -0.52,-0.6], [-0.68,0.42, -0.68,-0.45]], e: [] } },
    war_chest: { name: 'War Chest', tier: 1,
      quest: { track: 'creditsAtOnce', goal: 220, label: 'Hold 220 credits at once' },
      done: { k: 'energyEveryTurn', v: 1 },
      doneDesc: '+1 Energy every turn.',
      desc: 'QUEST — Hold 220 credits at once. → +1 Energy every turn.',
      art: { p: [[-0.6,-0.05, 0.6,-0.05, 0.6,0.55, -0.6,0.55, -0.6,-0.05], [-0.6,-0.05, -0.5,-0.45, 0.5,-0.45, 0.6,-0.05], [-0.12,0.12, 0.12,0.12, 0.12,0.32, -0.12,0.32, -0.12,0.12], [0,-0.72, 0.18,-0.57, 0,-0.42, -0.18,-0.57, 0,-0.72]], e: [[0,-0.57]] } },
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
