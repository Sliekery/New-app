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
        { t: 'attack', d: 6, w: 4 },
        { t: 'attack', d: 3, hits: 2, w: 3 },
        { t: 'block', b: 5, w: 2 },
      ],
      // hover drone: winged pod, central eye, underslung cannon, grav fins
      art: { p: [[-0.25,-0.3, 0.25,-0.3, 0.4,0, 0.25,0.3, -0.25,0.3, -0.4,0, -0.25,-0.3], [-0.12,-0.06, 0.12,-0.06, 0.12,0.13, -0.12,0.13, -0.12,-0.06], [-0.4,0, -0.95,-0.45, -1.0,-0.18, -0.55,0.2, -0.4,0.1], [-0.55,-0.13, -0.85,-0.34], [0.4,0, 0.95,-0.45, 1.0,-0.18, 0.55,0.2, 0.4,0.1], [0.55,-0.13, 0.85,-0.34], [0,-0.3, -0.1,-0.6, 0.1,-0.6, 0,-0.3], [-0.05,0.3, -0.05,0.58, 0.05,0.58, 0.05,0.3], [0,0.58, 0,0.72], [-0.28,0.3, -0.4,0.55], [0.28,0.3, 0.4,0.55]], e: [[0,0.04]] },
    },
    zealot_warrior: { grounded: true,
      name: 'Zealot Warrior', faction: 'hierarchy', hp: 22, size: 0.85, ai: 'random',
      moves: [
        { t: 'attack', d: 9, w: 4 },
        { t: 'attack', d: 6, w: 2 },
        { t: 'buff', s: 'str', v: 1, w: 2 },
        { t: 'block', b: 6, w: 2 },
      ],
      // elite warrior: swept crest, mandibles, energy blade, digitigrade legs
      art: { p: [[0,-1.05, 0.14,-0.95, 0.18,-0.78, 0.1,-0.66, -0.1,-0.66, -0.18,-0.85, -0.45,-1.15, -0.26,-1.2, 0,-1.05], [-0.08,-0.66, -0.15,-0.52, -0.05,-0.58], [0.08,-0.66, 0.15,-0.52, 0.05,-0.58], [-0.3,-0.55, 0.3,-0.55, 0.38,-0.15, 0.2,0.12, -0.2,0.12, -0.38,-0.15, -0.3,-0.55], [-0.18,-0.45, 0,-0.3, 0.18,-0.45], [-0.3,-0.55, -0.55,-0.62, -0.6,-0.35, -0.4,-0.28], [0.3,-0.55, 0.55,-0.62, 0.6,-0.35, 0.4,-0.28], [0.55,-0.45, 0.7,-0.25], [0.7,-0.25, 1.0,-0.75], [0.66,-0.17, 0.95,-0.65], [-0.55,-0.45, -0.62,-0.1, -0.5,0.05], [-0.15,0.12, -0.26,0.45, -0.13,0.6, -0.26,0.95, -0.08,0.95, -0.02,0.6], [0.15,0.12, 0.26,0.45, 0.13,0.6, 0.26,0.95, 0.08,0.95, 0.02,0.6]], e: [[-0.06,-0.8],[0.06,-0.8]] },
    },
    plasma_acolyte: { grounded: true,
      name: 'Plasma Acolyte', faction: 'hierarchy', hp: 16, size: 0.75, ai: 'random',
      moves: [
        { t: 'debuff', s: 'burn', v: 3, w: 3 },
        { t: 'attack', d: 7, w: 4 },
        { t: 'buff', s: 'str', v: 1, w: 1 },
      ],
      // squat acolyte: dome head, methane tank, hose, hands cupping a plasma orb
      art: { p: [[-0.2,-0.6, 0.2,-0.6, 0.3,-0.4, -0.3,-0.4, -0.2,-0.6], [-0.1,-0.4, -0.14,-0.28, 0.14,-0.28, 0.1,-0.4], [-0.35,-0.4, 0.35,-0.4, 0.5,0.35, 0.3,0.6, -0.3,0.6, -0.5,0.35, -0.35,-0.4], [-0.15,-0.6, 0,-1.0, 0.15,-0.6], [0,-1.0, 0,-0.62], [0.13,-0.78, 0.34,-0.6, 0.28,-0.42], [-0.35,-0.15, -0.55,0.05, -0.32,0.2], [0.35,-0.15, 0.55,0.05, 0.32,0.2], [-0.16,0.1, 0,-0.05, 0.16,0.1, 0,0.26, -0.16,0.1], [-0.3,0.6, -0.38,0.8, -0.14,0.8], [0.3,0.6, 0.38,0.8, 0.14,0.8]], e: [[-0.08,-0.5],[0.08,-0.5],[0,0.1]] },
    },
    // Jammer — a tripod laser turret. Its beam deals damage AND burns (exhausts)
    // a card out of your deck for the rest of the fight. Whittles your options.
    jammer: { grounded: true,
      name: 'Jammer', faction: 'hierarchy', hp: 20, size: 0.9, ai: 'random',
      moves: [
        { t: 'attack', d: 6, jam: true, w: 4 },   // jamming beam: damage + burn a card
        { t: 'attack', d: 9, w: 2 },
        { t: 'block', b: 6, w: 2 },
      ],
      // laser turret: trapezoid head, twin emitter rods, focusing lens, tripod legs
      art: { p: [[-0.55,-0.2, 0.55,-0.2, 0.4,0.25, -0.4,0.25, -0.55,-0.2], [-0.4,-0.05, 0.4,-0.05], [-0.28,-0.2, -0.28,-0.62], [-0.37,-0.62, -0.19,-0.62], [0.12,-0.2, 0.12,-0.72], [0.03,-0.72, 0.21,-0.72], [-0.4,0.25, -0.72,0.85], [0,0.25, 0,0.9], [0.4,0.25, 0.72,0.85], [-0.82,0.85, -0.62,0.85], [0.62,0.85, 0.82,0.85], [-0.1,0.9, 0.1,0.9]], e: [[0,0.06]] },
    },
    honor_guard: { grounded: true,
      name: 'Honor Guard', faction: 'hierarchy', hp: 48, size: 1.0, elite: true, ai: 'cycle',
      moves: [
        { t: 'block', b: 9 },
        { t: 'attack', d: 12 },
        { t: 'buff', s: 'str', v: 2 },
        { t: 'attack', d: 7, hits: 2 },
      ],
      // hunter-like: hulking mass, back spines, tower shield, arm cannon
      art: { p: [[-0.35,-0.75, 0.3,-0.85, 0.55,-0.5, 0.6,0.1, 0.45,0.6, -0.3,0.6, -0.4,-0.2, -0.35,-0.75], [-0.15,-0.68, 0.12,-0.73, 0.15,-0.53, -0.12,-0.48, -0.15,-0.68], [-0.3,-0.78, -0.45,-1.05], [-0.12,-0.82, -0.2,-1.12], [0.05,-0.85, 0.05,-1.15], [0.22,-0.83, 0.32,-1.05], [-0.95,-0.85, -0.55,-0.95, -0.5,0.55, -0.9,0.45, -0.95,-0.85], [-0.73,-0.88, -0.7,0.5], [0.55,-0.4, 0.85,-0.35, 0.9,-0.05, 0.6,-0.1], [0.9,-0.22, 1.05,-0.2], [-0.2,0.6, -0.25,0.95, -0.02,0.95, 0,0.6], [0.2,0.6, 0.25,0.95, 0.45,0.95, 0.4,0.6]], e: [[0,-0.6]] },
    },
    hierophant: {
      name: 'HIEROPHANT KA’RETH', faction: 'hierarchy', hp: 92, size: 1.3, boss: true, ai: 'cycle',
      // SIGNATURE — The Covenant Answers: it summons reinforcements mid-fight,
      // so you must manage the adds while it hexes and strikes.
      moves: [
        { t: 'debuff', s: 'weak', v: 2 },
        { t: 'attack', d: 13 },
        { t: 'summon', id: 'drone_skirmisher', n: 1 },
        { t: 'attack', d: 7, hits: 2 },
        { t: 'curse', card: 'void_taint' },
        { t: 'attack', d: 16 },
      ],
      // hierophant: crested head, halo ring, robed arms spread, gravity throne
      art: { p: [[0,-1.18, 0.1,-1.0, 0.08,-0.85, -0.08,-0.85, -0.1,-1.0, -0.2,-1.26, -0.04,-1.3, 0,-1.18], [0,-1.55, 0.45,-1.1, 0,-0.68, -0.45,-1.1, 0,-1.55], [-0.3,-0.8, 0.3,-0.8, 0.4,-0.45, 0.3,-0.3, -0.3,-0.3, -0.4,-0.45, -0.3,-0.8], [-0.4,-0.6, -0.75,-0.45, -0.9,-0.57, -1.0,-0.5], [0.4,-0.6, 0.75,-0.45, 0.9,-0.57, 1.0,-0.5], [-0.55,-0.3, 0.55,-0.3, 0.7,0.3, 0.45,0.65, -0.45,0.65, -0.7,0.3, -0.55,-0.3], [-0.55,-0.3, -0.85,-0.55, -0.8,0.1, -0.7,0.3], [0.55,-0.3, 0.85,-0.55, 0.8,0.1, 0.7,0.3], [-0.2,-0.3, -0.15,0.62], [0.2,-0.3, 0.15,0.62], [-0.3,0.65, -0.35,0.9], [0,0.65, 0,0.95], [0.3,0.65, 0.35,0.9]], e: [[-0.05,-0.95],[0.05,-0.95]] },
    },

    /* ============ THE RUST LEGION ============ */
    scrap_hound: { grounded: true,
      name: 'Scrap Hound', faction: 'rust', hp: 13, size: 0.65, ai: 'random',
      moves: [
        { t: 'attack', d: 7, w: 4 },
        { t: 'attack', d: 4, w: 2 },
        { t: 'debuff', s: 'vuln', v: 1, w: 2 },
      ],
      // robot hound: sensor head, jaw, spine plates, exhaust, four legs, antenna tail
      art: { p: [[0.5,-0.55, 0.95,-0.5, 1.0,-0.3, 0.75,-0.2, 0.55,-0.25, 0.5,-0.55], [0.75,-0.2, 0.95,-0.08, 0.68,-0.04, 0.58,-0.14], [0.5,-0.55, 0.35,-0.4], [-0.75,-0.35, 0.35,-0.4, 0.45,0.05, -0.65,0.15, -0.75,-0.35], [-0.65,-0.38, -0.5,-0.55, -0.35,-0.42, -0.2,-0.58, -0.05,-0.44, 0.1,-0.55, 0.25,-0.42], [-0.75,-0.35, -0.95,-0.55], [-0.72,-0.22, -0.92,-0.38], [0.35,0.05, 0.28,0.45, 0.45,0.55, 0.42,0.9, 0.56,0.9], [0.15,0.05, 0.12,0.6], [-0.55,0.15, -0.65,0.5, -0.5,0.6, -0.55,0.92, -0.4,0.92], [-0.25,0.12, -0.3,0.65], [-0.75,-0.3, -1.0,-0.12]], e: [[0.8,-0.4]] },
    },
    rust_cultist: { grounded: true,
      name: 'Rust Cultist', faction: 'rust', hp: 15, size: 0.75, ai: 'random',
      moves: [
        { t: 'attack', d: 6, w: 4 },
        { t: 'buff', s: 'str', v: 2, w: 2 },
        { t: 'curse', card: 'shrapnel', w: 2 },
      ],
      // hooded cyborg: cog amulet, mechadendrite over shoulder, cog-staff, cabling
      art: { p: [[0,-1.0, 0.24,-0.78, 0.18,-0.52, -0.18,-0.52, -0.24,-0.78, 0,-1.0], [-0.36,-0.48, 0.36,-0.48, 0.46,0.92, -0.46,0.92, -0.36,-0.48], [-0.4,0.1, 0.4,0.1], [-0.44,0.7, 0.44,0.7], [0,-0.26, 0.1,-0.19, 0.1,-0.06, 0,0.01, -0.1,-0.06, -0.1,-0.19, 0,-0.26], [-0.28,-0.55, -0.5,-0.85, -0.3,-1.08, -0.05,-1.02], [-0.05,-1.02, 0.06,-1.1], [-0.05,-1.02, 0.06,-0.94], [0.36,-0.32, 0.56,-0.36], [0.56,-0.86, 0.56,0.88], [0.56,-1.16, 0.67,-1.06, 0.67,-0.94, 0.56,-0.86, 0.45,-0.94, 0.45,-1.06, 0.56,-1.16], [-0.36,-0.3, -0.52,0.0, -0.42,0.3]], e: [[-0.07,-0.68],[0.07,-0.68]] },
    },
    forge_walker: { grounded: true,
      name: 'Forge Walker', faction: 'rust', hp: 28, size: 0.95, ai: 'random',
      moves: [
        { t: 'attack', d: 10, w: 4 },
        { t: 'block', b: 8, w: 3 },
        { t: 'attack', d: 5, w: 2 },
      ],
      // bipedal mech: visor slit, plate seams, smokestacks, claw arms, piston legs
      art: { p: [[-0.55,-0.7, 0.55,-0.7, 0.62,0.05, -0.62,0.05, -0.55,-0.7], [-0.3,-0.52, 0.3,-0.52], [-0.3,-0.4, 0.3,-0.4], [-0.62,-0.18, 0.62,-0.18], [-0.45,-0.18, -0.45,-0.08], [0,-0.18, 0,-0.08], [0.45,-0.18, 0.45,-0.08], [-0.35,-0.7, -0.35,-1.05, -0.22,-1.05, -0.22,-0.7], [0.22,-0.7, 0.22,-0.95, 0.35,-0.95, 0.35,-0.7], [-0.62,-0.5, -0.9,-0.4, -0.85,0.1], [-0.85,0.1, -0.95,0.3], [-0.85,0.1, -0.74,0.3], [0.62,-0.5, 0.9,-0.4, 0.85,0.05], [0.85,0.05, 0.95,0.25], [0.85,0.05, 0.74,0.25], [-0.4,0.05, -0.48,0.5, -0.38,0.55, -0.42,0.92, -0.2,0.92, -0.25,0.55], [0.4,0.05, 0.48,0.5, 0.38,0.55, 0.42,0.92, 0.2,0.92, 0.25,0.55]], e: [[-0.15,-0.46],[0.15,-0.46]] },
    },
    // Drone Swarm — a hub that spawns and buffs small drones, then fires a
    // barrage that lands ONCE PER LIVING DRONE. Thin the swarm or the volley grows.
    swarm_core: {
      name: 'Swarm Core', faction: 'rust', hp: 30, size: 1.0, ai: 'cycle',
      moves: [
        { t: 'summon', id: 'swarm_drone', n: 2 },
        { t: 'buff', s: 'str', v: 1, all: true },
        { t: 'attack', d: 3, hitsPer: 'swarm_drone' },
        { t: 'block', b: 7 },
      ],
      // carrier hub: central emitter eye, antenna mast, twin dish-arms, drone docking clamps
      art: { p: [[-0.55,-0.4, 0.55,-0.4, 0.72,0.12, 0.5,0.55, -0.5,0.55, -0.72,0.12, -0.55,-0.4], [-0.28,-0.22, 0.28,-0.22, 0.28,0.0, -0.28,0.0, -0.28,-0.22], [0,-0.05, 0.24,0.16, 0,0.4, -0.24,0.16, 0,-0.05], [0,-0.4, 0,-0.92], [-0.14,-0.92, 0.14,-0.92], [0,-0.92, 0,-1.02], [-0.72,0.12, -1.02,-0.08, -1.0,-0.3], [-1.0,-0.3, -0.82,-0.34], [0.72,0.12, 1.02,-0.08, 1.0,-0.3], [1.0,-0.3, 0.82,-0.34], [-0.32,0.55, -0.4,0.82], [0,0.55, 0,0.88], [0.32,0.55, 0.4,0.82]], e: [[0,0.16]] },
    },
    swarm_drone: {
      name: 'Swarm Drone', faction: 'rust', hp: 6, size: 0.42, ai: 'random',
      moves: [
        { t: 'attack', d: 3, w: 4 },
        { t: 'attack', d: 2, hits: 2, w: 2 },
        { t: 'block', b: 3, w: 1 },
      ],
      // little box drone: one sensor eye, stub antenna, stabiliser fins
      art: { p: [[-0.42,-0.28, 0.42,-0.28, 0.5,0.0, 0.42,0.32, -0.42,0.32, -0.5,0.0, -0.42,-0.28], [-0.22,0.05, 0.22,0.05, 0.22,0.22, -0.22,0.22, -0.22,0.05], [0,-0.28, 0,-0.62], [-0.1,-0.62, 0.1,-0.62], [-0.5,0.0, -0.72,-0.12], [0.5,0.0, 0.72,-0.12], [-0.5,0.0, -0.72,0.12], [0.5,0.0, 0.72,0.12]], e: [[0,-0.08]] },
    },
    // Drop Ship — deploys a random escort of bots and rides an impervious hull
    // until they are cleared; then its drop pod ARMS a self-destruct. Burst the
    // ship down before the fuse runs out, or eat the blast.
    drop_ship: {
      name: 'Drop Ship', faction: 'rust', hp: 34, size: 1.3, ai: 'cycle',
      dropship: { bot: 'drop_bot', min: 2, max: 3, turns: 3, dmg: 22, strafe: 5 },
      moves: [{ t: 'attack', d: 5 }],   // unused (handled by the dropship state machine), kept for validation
      // boxy dropship: swept hull, dorsal tower, nose cockpit, rear engine block, open drop-bay
      art: { p: [[-0.95,-0.12, -0.55,-0.45, 0.6,-0.45, 0.95,-0.08, 0.95,0.15, 0.62,0.4, -0.7,0.4, -0.95,0.12, -0.95,-0.12], [-0.5,-0.45, -0.45,-0.7, 0.25,-0.7, 0.42,-0.45], [0.5,-0.22, 0.88,-0.18, 0.88,0.04, 0.52,0.06], [-0.95,-0.04, -1.22,-0.16, -1.22,0.22, -0.95,0.12], [-1.22,0.03, -1.38,0.03], [-0.45,0.4, -0.45,0.64, 0.4,0.64, 0.4,0.4], [-0.22,0.64, -0.22,0.8], [0.18,0.64, 0.18,0.8], [-0.1,-0.45, -0.1,-0.7]], e: [[0.69,-0.08]] },
    },
    drop_bot: { grounded: true,
      name: 'Drop Bot', faction: 'rust', hp: 7, size: 0.5, ai: 'random',
      moves: [
        { t: 'attack', d: 4, w: 4 },
        { t: 'block', b: 3, w: 1 },
      ],
      // little walker: box chassis, visor, stub antenna, two stub legs, side arms
      art: { p: [[-0.45,-0.28, 0.45,-0.28, 0.45,0.22, -0.45,0.22, -0.45,-0.28], [-0.27,-0.06, 0.27,-0.06], [0,-0.28, 0,-0.58], [-0.1,-0.58, 0.1,-0.58], [-0.28,0.22, -0.28,0.52, -0.44,0.52], [0.28,0.22, 0.28,0.52, 0.44,0.52], [-0.45,-0.02, -0.66,-0.06], [0.45,-0.02, 0.66,-0.06]], e: [[0,-0.17]] },
    },
    // Siege Walker — fires a MASSIVE blow every other turn. On its wind-up turn
    // it deals nothing but is exposed: damage dealt while it charges whittles the
    // incoming hit down (to a floor). Soften it, or brace for the full payload.
    siege_walker: { grounded: true,
      name: 'Siege Walker', faction: 'rust', hp: 42, size: 1.25, ai: 'cycle',
      charge: { dmg: 28, cap: 22 },     // megahit 28; reducible by up to 22 (floor 6)
      moves: [{ t: 'attack', d: 6 }],   // unused (charge state machine drives it), kept for validation
      // striding war-walker: rounded hull + visor, twin antennae, cannon arm, four angular legs
      art: { p: [[-0.85,-0.45, 0.25,-0.55, 0.45,-0.35, 0.45,0.05, 0.25,0.25, -0.85,0.25, -0.95,0.05, -0.95,-0.25, -0.85,-0.45], [-0.8,-0.2, -0.45,-0.2], [-0.65,-0.5, -0.68,-0.82], [-0.4,-0.52, -0.4,-0.78], [0.45,-0.1, 0.86,-0.1, 0.88,0.02], [-0.55,0.25, -0.85,0.75, -0.7,0.78], [-0.15,0.25, -0.28,0.62, -0.12,0.66], [0.2,0.25, 0.28,0.62, 0.44,0.64], [0.4,0.2, 0.66,0.6, 0.8,0.62]], e: [[-0.62,-0.12]] },
    },
    iron_butcher: { grounded: true,
      name: 'Iron Butcher', faction: 'rust', hp: 52, size: 1.05, elite: true, ai: 'cycle',
      moves: [
        { t: 'attack', d: 13 },
        { t: 'block', b: 10 },
        { t: 'attack', d: 8, hits: 2 },
        { t: 'buff', s: 'str', v: 2 },
      ],
      // butcher mech: horned head, vented chest, pauldrons, cleaver arm, hook arm
      art: { p: [[-0.18,-1.0, 0.18,-1.0, 0.24,-0.78, -0.24,-0.78, -0.18,-1.0], [-0.18,-1.0, -0.35,-1.2], [0.18,-1.0, 0.35,-1.2], [-0.5,-0.75, 0.5,-0.75, 0.6,-0.1, 0.42,0.35, -0.42,0.35, -0.6,-0.1, -0.5,-0.75], [-0.25,-0.55, 0.25,-0.55], [-0.2,-0.42, 0.2,-0.42], [-0.5,-0.75, -0.85,-0.85, -0.95,-0.45, -0.62,-0.35], [0.5,-0.75, 0.85,-0.85, 0.95,-0.45, 0.62,-0.35], [0.85,-0.45, 0.93,-0.12], [0.86,-0.12, 1.1,-0.05, 1.05,0.55, 0.85,0.5, 0.86,-0.12], [1.04,0.0, 0.99,0.45], [-0.85,-0.45, -0.9,-0.05, -0.74,0.1, -0.85,0.27], [-0.42,0.35, -0.5,0.95, -0.15,0.95, -0.12,0.45], [0.42,0.35, 0.5,0.95, 0.15,0.95, 0.12,0.45]], e: [[-0.08,-0.88],[0.08,-0.88]] },
    },
    forge_tyrant: { grounded: true, enrage: 1,
      name: 'THE FORGE TYRANT', faction: 'rust', hp: 92, size: 1.35, boss: true, ai: 'cycle',
      // SIGNATURE — Enrage: gains 2 Strength whenever you damage it, and it
      // reforges (heals) itself, so chipping it away only makes it angrier.
      moves: [
        { t: 'block', b: 14 },
        { t: 'attack', d: 15 },
        { t: 'debuff', s: 'burn', v: 4 },
        { t: 'attack', d: 6, hits: 3 },
        { t: 'heal', v: 9 },
        { t: 'attack', d: 18 },
      ],
      // furnace titan: chimneys, glowing grate mouth, colossal pauldrons, crane claw
      art: { p: [[-0.7,-0.7, -0.3,-1.0, 0.3,-1.0, 0.7,-0.7, 0.8,0.3, 0.55,0.9, -0.55,0.9, -0.8,0.3, -0.7,-0.7], [-0.35,-0.25, 0.35,-0.25, 0.3,0.15, -0.3,0.15, -0.35,-0.25], [-0.18,-0.25, -0.18,0.15], [0,-0.25, 0,0.15], [0.18,-0.25, 0.18,0.15], [-0.4,-0.65, 0.4,-0.65], [-0.3,-1.0, -0.3,-1.35, -0.16,-1.35, -0.16,-1.0], [0.16,-1.0, 0.16,-1.25, 0.3,-1.25, 0.3,-1.0], [-0.26,-1.45, -0.2,-1.55], [0.2,-1.35, 0.27,-1.45], [-0.7,-0.7, -1.05,-0.6, -1.0,-0.05, -0.78,0.0], [0.7,-0.7, 1.05,-0.6, 1.0,-0.05, 0.78,0.0], [1.0,-0.35, 1.15,-0.1, 1.0,0.15], [1.0,0.15, 1.12,0.3], [1.0,0.15, 0.9,0.3], [-1.0,-0.3, -1.1,0.1, -0.95,0.25, -0.8,0.15], [-0.6,0.45, 0.6,0.45]], e: [[-0.22,-0.55],[0.22,-0.55],[0,-0.05]] },
    },

    /* ============ THE VOIDSPAWN ============ */
    void_larva: {
      name: 'Void Larva', faction: 'voidspawn', hp: 8, size: 0.5, ai: 'random',
      moves: [
        { t: 'attack', d: 5, w: 5 },
        { t: 'buff', s: 'str', v: 1, w: 2 },
      ],
      // infection form: lumpy sac, tendril legs, feelers, eye cluster
      art: { p: [[-0.6,0.1, -0.45,-0.35, -0.15,-0.55, 0.2,-0.5, 0.55,-0.25, 0.65,0.15, 0.45,0.45, 0,0.55, -0.4,0.45, -0.6,0.1], [-0.2,-0.55, -0.08,-0.75, 0.07,-0.58], [-0.4,0.45, -0.55,0.8], [-0.15,0.55, -0.2,0.9], [0.1,0.55, 0.05,0.85], [0.35,0.5, 0.5,0.8], [0.2,-0.5, 0.3,-0.85, 0.42,-0.9], [-0.32,-0.45, -0.47,-0.75]], e: [[-0.15,-0.1],[0.05,-0.18],[0.18,-0.02]] },
    },
    // Voidling — small, weak null-minion. Unblocked damage can burrow a
    // permanent curse into your deck, so let one through at your peril.
    voidling: {
      name: 'Voidling', faction: 'voidspawn', hp: 6, size: 0.46, ai: 'random',
      infect: { chance: 0.4, card: 'void_taint' },
      moves: [
        { t: 'attack', d: 3, w: 4 },
        { t: 'attack', d: 4, w: 2 },
      ],
      // void-shard: faceted body, single eye, jagged spikes and trailing tendrils
      art: { p: [[0,-0.58, 0.46,-0.12, 0.26,0.5, -0.26,0.5, -0.46,-0.12, 0,-0.58], [-0.46,-0.12, -0.72,-0.34], [0.46,-0.12, 0.72,-0.34], [-0.26,0.5, -0.36,0.82], [0.26,0.5, 0.36,0.82], [0,0.5, 0,0.84], [0,-0.58, 0.1,-0.84]], e: [[0,-0.02]] },
    },
    // Void Drone — caps every hit at its absorb threshold; an over-threshold
    // blow flings a Void Swarm curse into your deck. Chip it down with small or
    // multi-hit attacks; big single nukes are wasted AND punished.
    void_drone: {
      name: 'Void Drone', faction: 'voidspawn', hp: 24, size: 0.95, ai: 'random',
      absorb: { threshold: 8, card: 'void_swarm' },
      moves: [
        { t: 'attack', d: 6, w: 4 },
        { t: 'block', b: 6, w: 2 },
        { t: 'debuff', s: 'weak', v: 2, w: 2 },
      ],
      // void hover-drone: funnel hull, twin antenna pods, stalked eye, landing struts
      art: { p: [[-0.68,-0.55, 0.68,-0.55, 0.42,0.45, -0.42,0.45, -0.68,-0.55], [-0.5,-0.28, 0.5,-0.28], [-0.44,-0.02, 0.44,-0.02], [-0.3,-0.55, -0.3,-0.8, -0.12,-0.8, -0.12,-0.55], [0.12,-0.55, 0.12,-0.82, 0.3,-0.82, 0.3,-0.55], [-0.21,-0.8, -0.21,-0.98], [0.21,-0.82, 0.21,-1.0], [0.68,-0.16, 0.98,-0.1], [-0.42,0.45, -0.5,0.7, -0.22,0.7, -0.2,0.45], [0.2,0.45, 0.22,0.7, 0.5,0.7, 0.42,0.45]], e: [[1.0,-0.1],[0,-0.15]] },
    },
    husk_stalker: { grounded: true,
      name: 'Husk Stalker', faction: 'voidspawn', hp: 18, size: 0.8, ai: 'random',
      moves: [
        { t: 'attack', d: 8, w: 4 },
        { t: 'attack', d: 5, w: 2 },
        { t: 'debuff', s: 'weak', v: 1, w: 2 },
      ],
      // combat form: lolling head, exposed ribs, whip arm, shoulder growth
      art: { p: [[0.05,-1.0, 0.25,-0.92, 0.22,-0.74, 0.02,-0.78, 0.05,-1.0], [0.1,-0.74, 0.08,-0.58], [0.08,-0.78, 0,-0.62], [-0.25,-0.62, 0.2,-0.64, 0.3,-0.2, 0.15,0.15, -0.15,0.15, -0.35,-0.25, -0.25,-0.62], [-0.25,-0.46, 0.22,-0.49], [-0.28,-0.33, 0.25,-0.36], [-0.31,-0.2, 0.27,-0.23], [0.3,-0.5, 0.55,-0.35, 0.75,-0.5, 0.95,-0.4, 1.1,-0.55], [-0.3,-0.45, -0.5,-0.25, -0.44,-0.08], [-0.25,-0.62, -0.42,-0.82, -0.26,-0.88], [-0.12,0.15, -0.25,0.5, -0.1,0.6, -0.24,0.95, -0.06,0.95, 0.0,0.6], [0.1,0.15, 0.22,0.45, 0.1,0.6, 0.22,0.95, 0.36,0.9, 0.18,0.55]], e: [[0.13,-0.86]] },
    },
    psy_wraith: {
      name: 'Psy-Wraith', faction: 'voidspawn', hp: 16, size: 0.8, ai: 'random',
      moves: [
        { t: 'debuff', s: 'vuln', v: 2, w: 3 },
        { t: 'attack', d: 7, w: 4 },
        { t: 'curse', card: 'void_taint', w: 1 },
      ],
      // shrouded wraith: hood within shroud, hollow face, wisp arms, drifting shards
      art: { p: [[0,-0.9, 0.4,-0.5, 0.32,0.1, 0.5,0.4, 0.28,0.38, 0.38,0.85, 0.1,0.55, 0,0.95, -0.1,0.55, -0.38,0.85, -0.28,0.38, -0.5,0.4, -0.32,0.1, -0.4,-0.5, 0,-0.9], [-0.2,-0.55, 0,-0.7, 0.2,-0.55, 0.15,-0.28, -0.15,-0.28, -0.2,-0.55], [-0.06,-0.2, 0,-0.13, 0.06,-0.2], [-0.4,-0.3, -0.7,-0.15, -0.82,-0.3], [0.4,-0.3, 0.7,-0.15, 0.82,-0.3], [-0.75,-0.72, -0.63,-0.6], [0.7,-0.78, 0.58,-0.64], [0.85,0.1, 0.73,0.22]], e: [[-0.1,-0.45],[0.1,-0.45]] },
    },
    abyss_horror: {
      name: 'Abyss Horror', faction: 'voidspawn', hp: 50, size: 1.05, elite: true, ai: 'cycle',
      moves: [
        { t: 'attack', d: 5, hits: 3 },
        { t: 'debuff', s: 'vuln', v: 2 },
        { t: 'attack', d: 11 },
        { t: 'block', b: 8 },
      ],
      // tentacled mass: lumpy bulk, toothed maw, curling tentacles, eye cluster
      art: { p: [[-0.65,0.05, -0.45,-0.45, -0.1,-0.65, 0.3,-0.6, 0.6,-0.3, 0.7,0.1, 0.5,0.5, 0,0.62, -0.5,0.5, -0.65,0.05], [-0.3,0.1, -0.2,0.26, -0.1,0.1, 0,0.26, 0.1,0.1, 0.2,0.26, 0.3,0.1], [-0.65,0.05, -1.0,-0.15, -1.1,-0.45, -0.95,-0.55], [-0.5,0.5, -0.85,0.7, -1.0,0.6], [0.7,0.1, 1.05,-0.05, 1.1,-0.35, 0.95,-0.5], [0.5,0.5, 0.85,0.72, 1.0,0.6], [-0.15,0.62, -0.25,0.92, -0.1,1.02], [0.15,0.62, 0.2,0.92, 0.35,0.98], [-0.1,-0.65, -0.2,-0.98, -0.08,-1.08], [0.3,-0.6, 0.45,-0.92, 0.6,-0.98]], e: [[-0.25,-0.25],[0,-0.35],[0.25,-0.2],[-0.05,-0.1]] },
    },
    devourer: { regen: 3,
      name: 'THE DEVOURER', faction: 'voidspawn', hp: 84, size: 1.35, boss: true, ai: 'cycle',
      // SIGNATURE — It Knits Itself Whole: regenerates every turn and drains
      // your life, so a slow fight loses; you must out-pace its healing (Burn
      // ignores it, so poison builds shine here).
      moves: [
        { t: 'buff', s: 'str', v: 2 },
        { t: 'attack', d: 8, hits: 2 },
        { t: 'drain', d: 10 },
        { t: 'debuff', s: 'weak', v: 2 },
        { t: 'attack', d: 17 },
      ],
      // gravemind: vast head, double rows of teeth, crown spikes, spore sac, tentacles
      art: { p: [[-0.85,-0.1, -0.55,-0.65, -0.15,-0.9, 0.3,-0.85, 0.7,-0.55, 0.9,-0.1, 0.7,0.4, 0.2,0.65, -0.4,0.6, -0.75,0.35, -0.85,-0.1], [-0.55,0.0, -0.4,0.18, -0.25,0.0, -0.1,0.18, 0.05,0.0, 0.2,0.18, 0.35,0.0, 0.5,0.18, 0.6,0.0], [-0.45,0.42, -0.3,0.28, -0.15,0.42, 0,0.28, 0.15,0.42, 0.3,0.28, 0.45,0.42], [-0.55,-0.65, -0.7,-0.95], [-0.15,-0.9, -0.2,-1.2], [0.3,-0.85, 0.45,-1.15], [-0.5,-0.4, -0.42,-0.32, -0.5,-0.24, -0.58,-0.32, -0.5,-0.4], [-0.85,-0.1, -1.12,-0.3, -1.2,-0.05], [-0.75,0.35, -1.05,0.55, -1.15,0.45], [0.9,-0.1, 1.15,-0.27, 1.2,0.0], [0.7,0.4, 1.0,0.6, 1.1,0.5], [-0.2,0.62, -0.3,0.92, -0.15,1.02], [0.25,0.62, 0.35,0.88, 0.5,0.93]], e: [[-0.35,-0.45],[0,-0.55],[0.35,-0.4],[-0.62,-0.15],[0.64,-0.2]] },
    },
    /* ============ NEW MECHANIC ENEMIES ============ */
    // Iron Zealot (Hierarchy) — ENRAGE: gains Strength whenever you damage it.
    iron_zealot: { grounded: true, enrage: 1,
      name: 'Iron Zealot', faction: 'hierarchy', hp: 22, size: 0.88, ai: 'random',
      moves: [
        { t: 'attack', d: 7, w: 4 },
        { t: 'attack', d: 10, w: 2 },
        { t: 'buff', s: 'str', v: 1, w: 1 },
      ],
      art: { p: [[0,-1.0, 0.15,-0.88, 0.12,-0.7, -0.12,-0.7, -0.15,-0.88, 0,-1.0], [-0.3,-0.65, 0.3,-0.65, 0.4,-0.1, 0.25,0.15, -0.25,0.15, -0.4,-0.1, -0.3,-0.65], [-0.18,-0.5, 0,-0.36, 0.18,-0.5], [-0.4,-0.5, -0.7,-0.7, -0.86,-1.02], [-0.78,-0.92, -0.92,-1.05], [0.4,-0.5, 0.72,-0.3, 0.96,-0.52], [-0.2,0.15, -0.28,0.6, -0.12,0.62, -0.25,0.95, -0.06,0.95, -0.02,0.6], [0.2,0.15, 0.28,0.6, 0.12,0.62, 0.25,0.95, 0.06,0.95, 0.02,0.6]], e: [[-0.06,-0.84],[0.06,-0.84]] },
    },
    // Dominus (Hierarchy) — SUMMON: calls drone reinforcements.
    dominus: {
      name: 'Dominus', faction: 'hierarchy', hp: 20, size: 0.82, ai: 'random',
      moves: [
        { t: 'summon', id: 'drone_skirmisher', n: 1, w: 2 },
        { t: 'attack', d: 6, w: 3 },
        { t: 'debuff', s: 'weak', v: 1, w: 2 },
      ],
      art: { p: [[0,-0.92, 0.18,-0.74, 0.15,-0.55, -0.15,-0.55, -0.18,-0.74, 0,-0.92], [-0.34,-0.5, 0.34,-0.5, 0.46,0.85, -0.46,0.85, -0.34,-0.5], [-0.4,0.12, 0.4,0.12], [0,-0.5, 0,0.8], [-0.36,-0.32, -0.62,-0.56, -0.52,-0.72], [0.36,-0.32, 0.62,-0.56, 0.52,-0.72], [0,-1.32, 0.18,-1.14, 0,-0.98, -0.18,-1.14, 0,-1.32], [0,-1.14, 0,-0.92]], e: [[-0.07,-0.7],[0.07,-0.7],[0,-1.13]] },
    },
    // Rust Sentinel (Rust) — THORNS: retaliates when you attack it.
    rust_sentinel: { grounded: true, thorns: 2,
      name: 'Rust Sentinel', faction: 'rust', hp: 24, size: 0.92, ai: 'random',
      moves: [
        { t: 'block', b: 8, w: 3 },
        { t: 'attack', d: 7, w: 3 },
        { t: 'attack', d: 5, w: 2 },
      ],
      art: { p: [[-0.5,-0.6, 0.5,-0.6, 0.55,0.48, -0.55,0.48, -0.5,-0.6], [-0.3,-0.84, 0.3,-0.84, 0.3,-0.6, -0.3,-0.6], [-0.3,-0.2, 0.3,-0.2], [-0.3,0.08, 0.3,0.08], [-0.55,-0.4, -0.86,-0.46, -0.82,0.3, -0.5,0.24], [0.55,-0.4, 0.86,-0.46, 0.82,0.3, 0.5,0.24], [-0.26,0.48, -0.32,0.9, -0.06,0.9], [0.26,0.48, 0.32,0.9, 0.06,0.9]], e: [[-0.13,-0.72],[0.13,-0.72]] },
    },
    // Forge Acolyte (Rust) — REPAIR: heals all its allies each turn.
    forge_acolyte: { grounded: true,
      name: 'Forge Acolyte', faction: 'rust', hp: 16, size: 0.74, ai: 'random',
      moves: [
        { t: 'heal', v: 6, all: true, w: 2 },
        { t: 'attack', d: 6, w: 3 },
        { t: 'block', b: 6, w: 2 },
      ],
      art: { p: [[-0.22,-0.6, 0.22,-0.6, 0.32,-0.4, -0.32,-0.4, -0.22,-0.6], [-0.3,-0.4, 0.3,-0.4, 0.4,0.62, -0.4,0.62, -0.3,-0.4], [-0.1,-0.6, 0,-0.96, 0.1,-0.6], [0,-0.96, 0,-0.6], [0.3,-0.2, 0.6,-0.36, 0.72,-0.1], [0.62,-0.32, 0.62,-0.62], [-0.3,0.2, -0.56,0.36], [-0.12,-0.12, 0.12,-0.12]], e: [[-0.08,-0.5],[0.08,-0.5]] },
    },
    // Brood Maw (Voidspawn) — SUMMON: spawns void larvae.
    brood_maw: {
      name: 'Brood Maw', faction: 'voidspawn', hp: 20, size: 0.86, ai: 'random',
      moves: [
        { t: 'summon', id: 'void_larva', n: 1, w: 2 },
        { t: 'attack', d: 6, w: 3 },
        { t: 'attack', d: 3, hits: 2, w: 2 },
      ],
      art: { p: [[-0.7,-0.1, -0.5,-0.55, 0,-0.7, 0.5,-0.55, 0.7,-0.1, 0.55,0.45, 0,0.6, -0.55,0.45, -0.7,-0.1], [-0.5,-0.08, -0.4,0.12, -0.3,-0.08, -0.2,0.14, -0.1,-0.08, 0,0.14, 0.1,-0.08, 0.2,0.14, 0.3,-0.08, 0.4,0.12, 0.5,-0.08], [-0.6,-0.4, -0.86,-0.56], [0.6,-0.4, 0.86,-0.56], [-0.2,-0.55, -0.1,-0.78, 0.05,-0.6]], e: [[-0.28,-0.28],[0.28,-0.28]] },
    },
    // Revenant (Voidspawn) — REGEN: heals itself every turn and drains you.
    revenant: { regen: 2,
      name: 'Revenant', faction: 'voidspawn', hp: 22, size: 0.82, ai: 'random',
      moves: [
        { t: 'drain', d: 5, w: 3 },
        { t: 'attack', d: 7, w: 2 },
        { t: 'debuff', s: 'weak', v: 1, w: 2 },
      ],
      art: { p: [[0,-0.85, 0.4,-0.45, 0.32,0.2, 0.46,0.55, 0.2,0.45, 0.3,0.85, 0,0.6, -0.3,0.85, -0.2,0.45, -0.46,0.55, -0.32,0.2, -0.4,-0.45, 0,-0.85], [-0.2,-0.5, 0,-0.66, 0.2,-0.5, 0.15,-0.24, -0.15,-0.24, -0.2,-0.5], [-0.4,-0.3, -0.72,-0.2], [0.4,-0.3, 0.72,-0.2], [-0.06,-0.18, 0,-0.1, 0.06,-0.18]], e: [[-0.1,-0.42],[0.1,-0.42]] },
    },

    /* ============ THE FINALE ============ */
    // Faction-less cosmic entity that ends the descent. No PACK / no scaling
    // faction; uses its own `color`. Spawned only as the boss of the finale
    // sector (see BALANCE.run.finale).
    unmaker: { enrage: 1,
      name: 'THE UNMAKER', color: '#b8ecff', hp: 110, size: 1.4, boss: true, final: true, ai: 'cycle',
      // SIGNATURE — The Unmaking: every cycle it ERASES your Shield, jams a
      // curse into your deck, knits itself whole and grows in power. You can't
      // turtle the finale — you have to race it down. (It also Enrages.)
      moves: [
        { t: 'attack', d: 14 },
        { t: 'debuff', s: 'vuln', v: 2 },
        { t: 'attack', d: 8, hits: 2 },
        { t: 'unmake', v: 16, str: 2 },
        { t: 'block', b: 18 },
        { t: 'attack', d: 10, hits: 2 },
        { t: 'buff', s: 'str', v: 3 },
        { t: 'attack', d: 24 },
      ],
      // void seraph: haloed monolith body, spread wings of light, crown spikes,
      // a chest singularity and a cluster of cold eyes.
      art: { p: [
        [0,-1.15, 0.22,-0.85, 0.3,-0.2, 0.5,0.5, 0.28,1.0, -0.28,1.0, -0.5,0.5, -0.3,-0.2, -0.22,-0.85, 0,-1.15],
        [0,-1.5, 0.5,-1.05, 0,-0.6, -0.5,-1.05, 0,-1.5],
        [0,-0.85, 0,0.92],
        [-0.3,-0.2, -0.85,-0.55, -1.15,-0.32, -0.95,-0.02, -0.5,0.12],
        [0.3,-0.2, 0.85,-0.55, 1.15,-0.32, 0.95,-0.02, 0.5,0.12],
        [-0.46,0.4, -0.92,0.55, -1.06,0.86, -0.68,0.8],
        [0.46,0.4, 0.92,0.55, 1.06,0.86, 0.68,0.8],
        [0,-0.12, 0.18,0.12, 0,0.36, -0.18,0.12, 0,-0.12],
        [-0.14,-0.92, -0.18,-1.24], [0.14,-0.92, 0.18,-1.24], [0,-1.15, 0,-1.42],
        [-0.22,-0.56, 0.22,-0.56],
      ], e: [[-0.1,-0.42],[0.1,-0.42],[0,0.12],[-0.16,0.7],[0.16,0.7]] },
    },

    /* ============ THE RECURSION ECHOES (NG+5 easter-egg tributes) ============
     * Faction-less homages to four wanderers from another spire, redrawn as
     * void-warped silhouettes. Each is summoned only at the Heart on loop 6 and
     * is chosen to COUNTER the player's dominant build (see engine counterAxis).
     * Tuned to be nearly unbeatable once the loop multiplier is applied.        */

    // Homage to the red bruiser — counters BULWARK/block: escalating Strength and
    // Sundering blows that ignore your Shield, so turtling only delays the end.
    tribute_ironclad: { rampStr: 2, final: true,
      name: 'THE DREADCLAD', color: '#ff6a4a', hp: 160, size: 1.45, boss: true, ai: 'cycle',
      moves: [
        { t: 'buff', s: 'str', v: 3 },
        { t: 'attack', d: 15, pierce: true },
        { t: 'attack', d: 11, hits: 2 },
        { t: 'block', b: 24 },
        { t: 'attack', d: 24, pierce: true },
        { t: 'attack', d: 18 },
      ],
      // horned war-helm, slab pauldrons, a colossal greatsword raised high
      art: { p: [
        [-0.2,-0.95, 0.2,-0.95, 0.26,-0.7, -0.26,-0.7, -0.2,-0.95],
        [-0.2,-0.95, -0.42,-1.22], [0.2,-0.95, 0.42,-1.22],
        [-0.4,-0.65, 0.4,-0.65, 0.55,-0.1, 0.45,0.5, -0.45,0.5, -0.55,-0.1, -0.4,-0.65],
        [-0.26,-0.5, 0.26,-0.5], [0,-0.5, 0,0.4],
        [-0.4,-0.62, -0.72,-0.72, -0.74,-0.3, -0.5,-0.24],
        [0.4,-0.62, 0.72,-0.72, 0.74,-0.3, 0.5,-0.24],
        [0.62,-0.35, 0.98,-1.32], [0.8,-0.86, 1.08,-0.96], [0.8,-0.86, 0.56,-0.78],
        [-0.2,0.5, -0.28,0.95, -0.08,0.95, -0.04,0.5],
        [0.2,0.5, 0.28,0.95, 0.08,0.95, 0.04,0.5],
      ], e: [[-0.08,-0.82],[0.08,-0.82]] },
    },
    // Homage to the green knife-dancer — counters AGGRO/Strength: evades behind
    // walls of block, Weakens your blows and rots you with poison; striking it
    // hurts you (Thorns). Raw damage gets you nowhere.
    tribute_silent: { thorns: 10, final: true,
      name: 'THE NIGHTSHADE', color: '#54ffa0', hp: 160, size: 1.3, boss: true, ai: 'cycle',
      moves: [
        { t: 'block', b: 34 },
        { t: 'debuff', s: 'weak', v: 3 },
        { t: 'debuff', s: 'burn', v: 9 },
        { t: 'attack', d: 11, hits: 2 },
        { t: 'block', b: 28 },
        { t: 'debuff', s: 'weak', v: 3 },
        { t: 'attack', d: 18 },
      ],
      // deep cowl, twin envenomed blades flung wide, a tattered void-cloak
      art: { p: [
        [0,-1.0, 0.35,-0.6, 0.3,-0.2, -0.3,-0.2, -0.35,-0.6, 0,-1.0],
        [-0.16,-0.55, 0,-0.7, 0.16,-0.55, 0.12,-0.3, -0.12,-0.3, -0.16,-0.55],
        [-0.3,-0.2, -0.44,0.4, -0.28,0.5, -0.34,0.96, 0.34,0.96, 0.28,0.5, 0.44,0.4, 0.3,-0.2],
        [-0.3,-0.06, -0.7,0.1, -0.62,0.32],
        [-0.7,0.1, -1.06,-0.16], [-0.96,-0.06, -1.0,0.13],
        [0.3,-0.06, 0.7,0.1, 0.62,0.32],
        [0.7,0.1, 1.06,-0.16], [0.96,-0.06, 1.0,0.13],
      ], e: [[-0.09,-0.46],[0.09,-0.46]] },
    },
    // Homage to the orb-wielding automaton — counters ENGINE/Powers: it SHORTS
    // OUT your powers and out-scales you with lightning volleys.
    tribute_defect: { rampStr: 2, final: true,
      name: 'THE DERELICT', color: '#5ad8ff', hp: 220, size: 1.4, boss: true, ai: 'cycle',
      moves: [
        { t: 'disrupt', n: 3 },
        { t: 'attack', d: 13, hits: 3 },
        { t: 'block', b: 26 },
        { t: 'disrupt', n: 3 },
        { t: 'buff', s: 'str', v: 4 },
        { t: 'attack', d: 27 },
        { t: 'attack', d: 17, hits: 2 },
      ],
      // a hovering core: visored head, finned chassis, orbs caged around it
      art: { p: [
        [-0.25,-0.7, 0.25,-0.7, 0.32,-0.4, 0.25,-0.1, -0.25,-0.1, -0.32,-0.4, -0.25,-0.7],
        [-0.15,-0.55, 0.15,-0.55, 0.15,-0.32, -0.15,-0.32, -0.15,-0.55],
        [-0.35,-0.1, 0.35,-0.1, 0.45,0.42, 0,0.62, -0.45,0.42, -0.35,-0.1],
        [0,0.02, 0.13,0.2, 0,0.4, -0.13,0.2, 0,0.02],
        [-0.35,0.02, -0.62,0.06, -0.6,0.38],
        [0.35,0.02, 0.62,0.06, 0.6,0.38],
        [-0.86,-0.4, -0.72,-0.52, -0.58,-0.4, -0.72,-0.28, -0.86,-0.4],
        [0.86,-0.4, 0.72,-0.52, 0.58,-0.4, 0.72,-0.28, 0.86,-0.4],
        [0,-1.02, 0.13,-0.91, 0,-0.8, -0.13,-0.91, 0,-1.02],
      ], e: [[0,-0.42]] },
    },
    // Homage to the purple ascetic — counters AFFLICTION/DoT: it CLEANSES your
    // poisons each turn, mends its wounds, then unleashes a Wrath strike.
    tribute_watcher: { cleanse: 1, regen: 4, final: true,
      name: 'THE ASCENDANT', color: '#c98bff', hp: 158, size: 1.38, boss: true, ai: 'cycle',
      moves: [
        { t: 'heal', v: 15 },
        { t: 'block', b: 28 },
        { t: 'attack', d: 30 },
        { t: 'debuff', s: 'weak', v: 3 },
        { t: 'heal', v: 11 },
        { t: 'attack', d: 16, hits: 2 },
      ],
      // cowled ascetic, hands in prayer, a third eye and a broken halo overhead
      art: { p: [
        [0,-0.95, 0.28,-0.65, 0.24,-0.3, -0.24,-0.3, -0.28,-0.65, 0,-0.95],
        [-0.24,-0.3, -0.42,0.4, -0.3,0.55, -0.36,0.96, 0.36,0.96, 0.3,0.55, 0.42,0.4, 0.24,-0.3],
        [0,-0.3, 0,0.92],
        [-0.24,0.02, -0.05,0.22, 0.05,0.22, 0.24,0.02],
        [-0.05,0.22, 0,0.48, 0.05,0.22],
        [0,-1.28, 0.34,-1.12, 0.34,-0.96], [0,-1.28, -0.34,-1.12, -0.34,-0.96],
        [-0.34,-0.96, 0.34,-0.96],
      ], e: [[-0.09,-0.55],[0.09,-0.55],[0,-0.74]] },
    },
  };

  ns.FINAL_BOSS = 'unmaker';

  /* ---- Encounter packs per faction, ordered easy -> hard --------------- */
  ns.PACKS = {
    hierarchy: [
      ['drone_skirmisher', 'drone_skirmisher'],
      ['zealot_warrior'],
      ['plasma_acolyte', 'drone_skirmisher'],
      ['zealot_warrior', 'drone_skirmisher'],
      ['jammer', 'drone_skirmisher'],
      ['iron_zealot', 'drone_skirmisher'],
      ['dominus', 'zealot_warrior'],
      ['dominus', 'iron_zealot', 'drone_skirmisher'],
    ],
    rust: [
      ['scrap_hound', 'scrap_hound'],
      ['rust_cultist', 'scrap_hound'],
      ['forge_walker'],
      ['swarm_core', 'swarm_drone'],
      ['forge_walker', 'scrap_hound'],
      ['drop_ship'],
      ['siege_walker'],
      ['rust_sentinel', 'scrap_hound'],
      ['forge_acolyte', 'forge_walker'],
      ['rust_sentinel', 'forge_acolyte', 'scrap_hound'],
    ],
    voidspawn: [
      ['void_larva', 'void_larva', 'void_larva'],
      ['husk_stalker'],
      ['husk_stalker', 'void_larva'],
      ['psy_wraith', 'void_larva'],
      ['husk_stalker', 'voidling', 'voidling'],
      ['void_drone', 'void_larva'],
      ['brood_maw', 'void_larva'],
      ['revenant', 'husk_stalker'],
      ['psy_wraith', 'revenant', 'void_larva'],
    ],
  };

  ns.ELITES = { hierarchy: 'honor_guard', rust: 'iron_butcher', voidspawn: 'abyss_horror' };
  ns.BOSSES = { hierarchy: 'hierophant', rust: 'forge_tyrant', voidspawn: 'devourer' };
  ns.ELITE_MINIONS = { hierarchy: 'drone_skirmisher', rust: 'scrap_hound', voidspawn: 'void_larva' };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
