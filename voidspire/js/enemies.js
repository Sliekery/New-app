/* =========================================================================
 * VOIDSPIRE — enemies.js
 * Enemy stats, AI patterns, faction encounter packs, and vector art.
 *
 * Moves: {t:'attack',d,hits?} {t:'block',b} {t:'buff',s,v} {t:'debuff',s,v}
 *        {t:'curse',card} {t:'drain',d}   (+ optional w = weight)
 * ai: 'random' (weighted, no immediate repeats) | 'cycle' (fixed rotation)
 * Damage/HP are sector-1 values; engine scales them per sector.
 * Art: polylines in a -1..1 box, stroked with glow. e = eye points.
 * ========================================================================= */
(function (ns) {
  'use strict';

  ns.FACTIONS = {
    hierarchy: { name: 'The Hierarchy',  color: '#c86bff', desc: 'Zealot alien covenant' },
    rust:      { name: 'The Rust Legion', color: '#ffaa33', desc: 'Heretek war machines' },
    voidspawn: { name: 'The Voidspawn',  color: '#5dff88', desc: 'Things from between stars' },
  };

  ns.ENEMIES = {

    /* ============ THE HIERARCHY ============ */
    drone_skirmisher: {
      name: 'Drone Skirmisher', faction: 'hierarchy', hp: 12, size: 0.6, ai: 'random',
      moves: [
        { t: 'attack', d: 5, w: 4 },
        { t: 'attack', d: 3, hits: 2, w: 3 },
        { t: 'block', b: 5, w: 2 },
      ],
      art: { p: [[-1,0, -0.4,-0.35, 0,-0.15, 0.4,-0.35, 1,0, 0.4,0.35, 0,0.15, -0.4,0.35, -1,0], [-0.15,-0.15, 0.15,-0.15, 0.15,0.15, -0.15,0.15, -0.15,-0.15]], e: [[0,0]] },
    },
    zealot_warrior: {
      name: 'Zealot Warrior', faction: 'hierarchy', hp: 22, size: 0.85, ai: 'random',
      moves: [
        { t: 'attack', d: 8, w: 4 },
        { t: 'attack', d: 6, w: 2 },
        { t: 'buff', s: 'str', v: 1, w: 2 },
        { t: 'block', b: 6, w: 2 },
      ],
      art: { p: [[0,-1, 0.3,-0.55, 0.2,0.1, 0.45,0.9, 0.15,0.9, 0.05,0.25, -0.05,0.25, -0.15,0.9, -0.45,0.9, -0.2,0.1, -0.3,-0.55, 0,-1], [0.3,-0.55, 0.9,-0.9, 0.95,-0.2, 0.2,0.1], [-0.3,-0.55, -0.6,-0.2, -0.5,0.3]], e: [[-0.06,-0.62],[0.06,-0.62]] },
    },
    plasma_acolyte: {
      name: 'Plasma Acolyte', faction: 'hierarchy', hp: 16, size: 0.75, ai: 'random',
      moves: [
        { t: 'debuff', s: 'burn', v: 3, w: 3 },
        { t: 'attack', d: 6, w: 4 },
        { t: 'buff', s: 'str', v: 1, w: 1 },
      ],
      art: { p: [[0,-1, 0.55,0.9, -0.55,0.9, 0,-1], [-0.3,0.05, 0.3,0.05], [0,-0.45, 0.25,-0.2, 0,0.05, -0.25,-0.2, 0,-0.45]], e: [[0,-0.2]] },
    },
    honor_guard: {
      name: 'Honor Guard', faction: 'hierarchy', hp: 48, size: 1.0, elite: true, ai: 'cycle',
      moves: [
        { t: 'block', b: 9 },
        { t: 'attack', d: 12 },
        { t: 'buff', s: 'str', v: 2 },
        { t: 'attack', d: 7, hits: 2 },
      ],
      art: { p: [[0,-1, 0.45,-0.6, 0.35,0.2, 0.5,0.9, -0.5,0.9, -0.35,0.2, -0.45,-0.6, 0,-1], [-0.85,-0.5, -0.55,-0.7, -0.5,0.6, -0.85,0.4, -0.85,-0.5], [0.45,-0.6, 0.95,-1, 1,-0.3]], e: [[-0.08,-0.6],[0.08,-0.6]] },
    },
    hierophant: {
      name: 'HIEROPHANT KA’RETH', faction: 'hierarchy', hp: 92, size: 1.3, boss: true, ai: 'cycle',
      moves: [
        { t: 'debuff', s: 'weak', v: 2 },
        { t: 'attack', d: 13 },
        { t: 'block', b: 12 },
        { t: 'attack', d: 7, hits: 2 },
        { t: 'curse', card: 'void_taint' },
        { t: 'attack', d: 16 },
      ],
      art: { p: [[0,-1, 0.25,-0.5, 0.6,-0.35, 0.4,0.1, 0.55,0.9, -0.55,0.9, -0.4,0.1, -0.6,-0.35, -0.25,-0.5, 0,-1], [0,-0.85, 0.5,-0.6, 0.62,0, 0.3,0.5], [0,-0.85, -0.5,-0.6, -0.62,0, -0.3,0.5], [-0.2,0.2, 0.2,0.2]], e: [[-0.1,-0.45],[0.1,-0.45],[0,-0.3]] },
    },

    /* ============ THE RUST LEGION ============ */
    scrap_hound: {
      name: 'Scrap Hound', faction: 'rust', hp: 13, size: 0.65, ai: 'random',
      moves: [
        { t: 'attack', d: 6, w: 4 },
        { t: 'attack', d: 4, w: 2 },
        { t: 'debuff', s: 'vuln', v: 1, w: 2 },
      ],
      art: { p: [[-1,0.3, -0.6,-0.1, 0.1,-0.3, 0.5,-0.6, 0.95,-0.45, 0.8,-0.15, 0.5,-0.1, 0.6,0.5, 0.35,0.5, 0.2,0.15, -0.3,0.2, -0.45,0.55, -0.7,0.55, -1,0.3], [0.5,-0.6, 0.35,-0.75]], e: [[0.72,-0.4]] },
    },
    rust_cultist: {
      name: 'Rust Cultist', faction: 'rust', hp: 15, size: 0.75, ai: 'random',
      moves: [
        { t: 'attack', d: 5, w: 4 },
        { t: 'buff', s: 'str', v: 2, w: 2 },
        { t: 'curse', card: 'shrapnel', w: 2 },
      ],
      art: { p: [[0,-0.95, 0.4,-0.45, 0.3,0.9, -0.3,0.9, -0.4,-0.45, 0,-0.95], [0,-0.75, 0.15,-0.5, 0,-0.35, -0.15,-0.5, 0,-0.75], [0.4,-0.45, 0.75,0.9], [0.62,-0.2, 0.88,-0.2]], e: [[0,-0.55]] },
    },
    forge_walker: {
      name: 'Forge Walker', faction: 'rust', hp: 28, size: 0.95, ai: 'random',
      moves: [
        { t: 'attack', d: 9, w: 4 },
        { t: 'block', b: 8, w: 3 },
        { t: 'attack', d: 5, w: 2 },
      ],
      art: { p: [[-0.6,-0.7, 0.6,-0.7, 0.7,0.2, -0.7,0.2, -0.6,-0.7], [-0.5,0.2, -0.6,0.9, -0.3,0.9, -0.25,0.2], [0.5,0.2, 0.6,0.9, 0.3,0.9, 0.25,0.2], [-0.85,-0.5, -0.6,-0.35], [0.6,-0.35, 0.85,-0.5, 0.9,0]], e: [[-0.25,-0.45],[0.25,-0.45]] },
    },
    iron_butcher: {
      name: 'Iron Butcher', faction: 'rust', hp: 52, size: 1.05, elite: true, ai: 'cycle',
      moves: [
        { t: 'attack', d: 13 },
        { t: 'block', b: 10 },
        { t: 'attack', d: 8, hits: 2 },
        { t: 'buff', s: 'str', v: 2 },
      ],
      art: { p: [[-0.5,-0.8, 0.5,-0.8, 0.65,0.1, 0.45,0.9, -0.45,0.9, -0.65,0.1, -0.5,-0.8], [0.65,0.1, 1,-0.2, 0.95,-0.8, 0.75,-0.75, 0.8,-0.3], [-0.65,0.1, -1,0.05], [-0.25,-0.55, 0.25,-0.55]], e: [[-0.18,-0.35],[0.18,-0.35]] },
    },
    forge_tyrant: {
      name: 'THE FORGE TYRANT', faction: 'rust', hp: 105, size: 1.35, boss: true, ai: 'cycle',
      moves: [
        { t: 'block', b: 14 },
        { t: 'attack', d: 15 },
        { t: 'debuff', s: 'burn', v: 4 },
        { t: 'attack', d: 6, hits: 3 },
        { t: 'buff', s: 'str', v: 2 },
        { t: 'attack', d: 18 },
      ],
      art: { p: [[-0.7,-0.6, -0.25,-0.95, 0.25,-0.95, 0.7,-0.6, 0.8,0.4, 0.5,0.9, -0.5,0.9, -0.8,0.4, -0.7,-0.6], [-0.3,-0.3, 0.3,-0.3, 0.2,0.3, -0.2,0.3, -0.3,-0.3], [-0.25,-0.95, -0.2,-1.15], [0.25,-0.95, 0.2,-1.15], [0.8,0.4, 1.05,0.1, 1,-0.5]], e: [[-0.3,-0.6],[0.3,-0.6],[0,0]] },
    },

    /* ============ THE VOIDSPAWN ============ */
    void_larva: {
      name: 'Void Larva', faction: 'voidspawn', hp: 8, size: 0.5, ai: 'random',
      moves: [
        { t: 'attack', d: 4, w: 5 },
        { t: 'buff', s: 'str', v: 1, w: 2 },
      ],
      art: { p: [[-0.9,0.2, -0.5,-0.4, 0,-0.55, 0.5,-0.4, 0.9,0.2, 0.5,0.55, 0,0.65, -0.5,0.55, -0.9,0.2], [-0.5,-0.4, -0.6,-0.8], [0,-0.55, 0,-0.95], [0.5,-0.4, 0.6,-0.8]], e: [[-0.25,0],[0.25,0]] },
    },
    husk_stalker: {
      name: 'Husk Stalker', faction: 'voidspawn', hp: 18, size: 0.8, ai: 'random',
      moves: [
        { t: 'attack', d: 7, w: 4 },
        { t: 'attack', d: 5, w: 2 },
        { t: 'debuff', s: 'weak', v: 1, w: 2 },
      ],
      art: { p: [[0,-0.9, 0.2,-0.5, 0.15,0.1, 0.4,0.9, 0.2,0.9, 0.05,0.3, -0.05,0.3, -0.2,0.9, -0.4,0.9, -0.15,0.1, -0.2,-0.5, 0,-0.9], [0.2,-0.5, 0.7,-0.7, 0.95,-0.35, 0.8,-0.3, 0.9,-0.15], [-0.2,-0.5, -0.7,-0.7, -0.95,-0.35, -0.8,-0.3, -0.9,-0.15]], e: [[-0.05,-0.6],[0.05,-0.6]] },
    },
    psy_wraith: {
      name: 'Psy-Wraith', faction: 'voidspawn', hp: 16, size: 0.8, ai: 'random',
      moves: [
        { t: 'debuff', s: 'vuln', v: 2, w: 3 },
        { t: 'attack', d: 6, w: 4 },
        { t: 'curse', card: 'void_taint', w: 1 },
      ],
      art: { p: [[0,-0.9, 0.45,-0.4, 0.35,0.2, 0.55,0.5, 0.3,0.45, 0.4,0.9, 0.1,0.6, 0,0.95, -0.1,0.6, -0.4,0.9, -0.3,0.45, -0.55,0.5, -0.35,0.2, -0.45,-0.4, 0,-0.9]], e: [[-0.12,-0.4],[0.12,-0.4]] },
    },
    abyss_horror: {
      name: 'Abyss Horror', faction: 'voidspawn', hp: 50, size: 1.05, elite: true, ai: 'cycle',
      moves: [
        { t: 'attack', d: 5, hits: 3 },
        { t: 'debuff', s: 'vuln', v: 2 },
        { t: 'attack', d: 11 },
        { t: 'block', b: 8 },
      ],
      art: { p: [[-0.6,0.1, -0.3,-0.5, 0,-0.65, 0.3,-0.5, 0.6,0.1, 0.4,0.6, -0.4,0.6, -0.6,0.1], [-0.6,0.1, -1,-0.3, -0.85,-0.7], [0.6,0.1, 1,-0.3, 0.85,-0.7], [-0.4,0.6, -0.6,0.95], [0,0.6, 0,1], [0.4,0.6, 0.6,0.95], [0,-0.65, -0.15,-1], [0,-0.65, 0.15,-1]], e: [[-0.2,-0.15],[0.2,-0.15],[0,-0.35]] },
    },
    devourer: {
      name: 'THE DEVOURER', faction: 'voidspawn', hp: 98, size: 1.35, boss: true, ai: 'cycle',
      moves: [
        { t: 'buff', s: 'str', v: 2 },
        { t: 'attack', d: 8, hits: 2 },
        { t: 'drain', d: 10 },
        { t: 'debuff', s: 'weak', v: 2 },
        { t: 'attack', d: 17 },
      ],
      art: { p: [[-0.8,-0.2, -0.4,-0.7, 0,-0.85, 0.4,-0.7, 0.8,-0.2, 0.6,0.5, 0,0.8, -0.6,0.5, -0.8,-0.2], [-0.55,0, -0.35,0.3, -0.15,0.05, 0,0.35, 0.15,0.05, 0.35,0.3, 0.55,0], [-0.4,-0.7, -0.55,-1.1], [0.4,-0.7, 0.55,-1.1], [0,-0.85, 0,-1.2], [-0.8,-0.2, -1.15,0.1], [0.8,-0.2, 1.15,0.1]], e: [[-0.3,-0.4],[0.3,-0.4],[0,-0.55],[-0.55,-0.35],[0.55,-0.35]] },
    },
  };

  /* ---- Encounter packs per faction, ordered easy -> hard --------------- */
  ns.PACKS = {
    hierarchy: [
      ['drone_skirmisher', 'drone_skirmisher'],
      ['zealot_warrior'],
      ['plasma_acolyte', 'drone_skirmisher'],
      ['zealot_warrior', 'drone_skirmisher'],
      ['plasma_acolyte', 'zealot_warrior'],
      ['zealot_warrior', 'zealot_warrior'],
      ['plasma_acolyte', 'zealot_warrior', 'drone_skirmisher'],
    ],
    rust: [
      ['scrap_hound', 'scrap_hound'],
      ['rust_cultist', 'scrap_hound'],
      ['forge_walker'],
      ['forge_walker', 'scrap_hound'],
      ['rust_cultist', 'forge_walker'],
      ['scrap_hound', 'scrap_hound', 'rust_cultist'],
      ['forge_walker', 'rust_cultist', 'scrap_hound'],
    ],
    voidspawn: [
      ['void_larva', 'void_larva', 'void_larva'],
      ['husk_stalker'],
      ['husk_stalker', 'void_larva'],
      ['psy_wraith', 'void_larva', 'void_larva'],
      ['psy_wraith', 'husk_stalker'],
      ['husk_stalker', 'husk_stalker'],
      ['psy_wraith', 'husk_stalker', 'void_larva'],
    ],
  };

  ns.ELITES = { hierarchy: 'honor_guard', rust: 'iron_butcher', voidspawn: 'abyss_horror' };
  ns.BOSSES = { hierarchy: 'hierophant', rust: 'forge_tyrant', voidspawn: 'devourer' };
  ns.ELITE_MINIONS = { hierarchy: 'drone_skirmisher', rust: 'scrap_hound', voidspawn: 'void_larva' };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
