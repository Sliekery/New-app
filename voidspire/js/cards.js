/* =========================================================================
 * VOIDSPIRE — cards.js
 * Card definitions. Effects are declarative; descriptions auto-generate.
 *
 * fx ops:
 *   {k:'dmg', v, hits?, scale?:'might'|'tech'|'psi', scaleMul?, all?, random?}
 *   {k:'block', v, scale?:'tech'}
 *   {k:'heal', v} {k:'hploss', v} {k:'draw', v} {k:'energy', v}
 *   {k:'status', s, v, who:'self'|'target'|'allEnemies'}
 *   {k:'special', id}
 * Card flags: exhaust, unplayable
 * `up` patches cost/fx/flags for the upgraded version.
 * ========================================================================= */
(function (ns) {
  'use strict';

  var STATUS_NAMES = {
    str: 'Might', vuln: 'Vulnerable', weak: 'Weak', burn: 'Burn',
    regen: 'Regen', plate: 'Plating', thorns: 'Thorns', psiPow: 'Psi Focus',
    strPerTurn: 'Warlord', turret: 'Turret', entropy: 'Entropy',
    reactor: 'Reactor', retain: 'Phase Lock',
    feelNoPain: 'Resolve', darkEmbrace: 'Salvage', thousandCuts: 'Blade Array',
    afterImage: 'Mirror Field', plague: 'Contagion', echo: 'Echo', corruption: 'Corruption',
    platedArmor: 'Plated Armor', barricade: 'Barricade', bloodPact: 'Blood Pact',
    pack: 'Pack Fury', symbiosis: 'Symbiosis', brood: 'Brood', slots: 'Kennel',
    bulwark: 'Bulwark', bloodscent: 'Bloodscent', feast: 'Savage Feast',
  };

  // The Warpcaller's pets (targetable ally units). act: what they do each turn.
  // `models` = candidate visual models (picked at random on summon) so the pack
  // looks like a varied menagerie. Art lives in ns.PET_MODELS.
  ns.PETS = {
    // -- generic / Butcher fuel --
    maw:      { name: 'Maw',     hp: 4,  act: { t: 'attack', d: 2 }, color: '#7b8cff', models: ['wretch'] },
    spawnling:{ name: 'Spawnling', hp: 2, act: { t: 'attack', d: 1 }, onDie: { dmg: 4 }, color: '#8d9bff', models: ['crawler'] },  // cheap body that bursts for 4 on death
    stinger:  { name: 'Stinger', hp: 3,  act: { t: 'burn', v: 2 },   color: '#9b7bff', models: ['stinger', 'spore'] },
    // -- Wall --
    warden:   { name: 'Warden',  hp: 7,  act: { t: 'block', v: 3 },  color: '#6bd8ff', models: ['sentinel'] },
    leech:    { name: 'Leech',   hp: 5,  act: { t: 'heal', v: 2 },   color: '#6bff9d', models: ['leech'] },
    behemoth: { name: 'Behemoth', hp: 13, act: { t: 'block', v: 4 }, size: 2, color: '#6bd8ff', models: ['warden_beast'] },
    // -- support (all) --
    totem:    { name: 'Totem',   hp: 7,  act: { t: 'support', v: 2 }, color: '#ffd24a', models: ['totem'] },
    // -- Alpha apex (tanky bruiser: takes the hits AND deals them) --
    dire_maw: { name: 'Dire Maw', hp: 14, act: { t: 'attack', d: 4 }, size: 2, color: '#5e6bff', models: ['wretch'] },
  };

  // 9 distinct void-beast silhouettes (+ the Warpcaller avatar = 10 models).
  // Polylines in a ~-0.7..0.7 box; e = glowing eye points.
  ns.PET_MODELS = {
    maw_hound: { name: 'Maw-Hound', art: {
      p: [[-0.6,-0.32, -0.2,-0.46, 0.12,-0.34, 0.06,-0.02, -0.32,0.04, -0.62,-0.12, -0.6,-0.32],
          [-0.5,-0.06, -0.44,0.14], [-0.3,-0.1, -0.26,0.12], [-0.08,-0.1, -0.04,0.08],
          [0.06,-0.2, 0.56,-0.16, 0.66,0.14, 0.16,0.18, 0.06,-0.02],
          [0.16,0.18, 0.14,0.5], [0.5,0.14, 0.5,0.5], [-0.34,0.02, -0.36,0.46], [-0.04,0.06, -0.06,0.46],
          [0.66,0.0, 0.92,-0.16, 0.84,-0.34]],
      e: [[-0.34,-0.28]] } },
    crawler: { name: 'Crawler', art: {
      p: [[-0.34,-0.08, 0.0,-0.28, 0.34,-0.08, 0.34,0.12, 0.0,0.26, -0.34,0.12, -0.34,-0.08],
          [-0.1,-0.2, -0.06,-0.02], [0.1,-0.2, 0.06,-0.02],
          [-0.34,0.0, -0.7,-0.2], [-0.34,0.06, -0.72,0.1], [-0.3,0.12, -0.62,0.38],
          [0.34,0.0, 0.7,-0.2], [0.34,0.06, 0.72,0.1], [0.3,0.12, 0.62,0.38],
          [0.0,0.26, 0.0,0.5]],
      e: [[-0.12,-0.05],[0.12,-0.05]] } },
    wretch: { name: 'Wretch', art: {
      p: [[0,-0.55, 0.18,-0.4, 0.14,-0.18, -0.14,-0.18, -0.18,-0.4, 0,-0.55],
          [-0.2,-0.16, 0.2,-0.16, 0.3,0.2, 0.12,0.46, -0.12,0.46, -0.3,0.2, -0.2,-0.16],
          [-0.2,-0.1, -0.5,-0.02, -0.44,0.24], [-0.5,-0.02, -0.62,-0.12], [-0.5,-0.02, -0.58,0.1],
          [0.2,-0.1, 0.5,-0.02, 0.44,0.24], [0.5,-0.02, 0.62,-0.12], [0.5,-0.02, 0.58,0.1],
          [-0.12,0.46, -0.16,0.62], [0.12,0.46, 0.16,0.62]],
      e: [[-0.06,-0.36],[0.06,-0.36]] } },
    stinger: { name: 'Stinger', art: {
      p: [[-0.3,-0.2, 0.3,-0.2, 0.34,0.06, 0,0.18, -0.34,0.06, -0.3,-0.2],
          [-0.22,0.12, -0.28,0.5], [0,0.18, 0.0,0.56], [0.22,0.12, 0.28,0.5],
          [0,0.56, 0.1,0.66, 0,0.72, -0.1,0.66, 0,0.56],
          [-0.3,-0.2, -0.2,-0.42], [0.3,-0.2, 0.2,-0.42]],
      e: [[-0.1,-0.06],[0.1,-0.06]] } },
    spore: { name: 'Spore', art: {
      p: [[0,-0.4, 0.34,-0.22, 0.4,0.16, 0.12,0.4, -0.12,0.4, -0.4,0.16, -0.34,-0.22, 0,-0.4],
          [-0.18,-0.1, 0.18,-0.1], [-0.12,0.06, 0.12,0.06], [-0.06,0.2, 0.06,0.2],
          [0,-0.4, 0,-0.58], [-0.18,-0.34, -0.3,-0.5], [0.18,-0.34, 0.3,-0.5]],
      e: [[0,-0.22]] } },
    warden_beast: { name: 'Warden-Beast', art: {
      p: [[0,-0.5, 0.44,-0.34, 0.5,0.18, 0.28,0.46, -0.28,0.46, -0.5,0.18, -0.44,-0.34, 0,-0.5],
          [-0.28,-0.28, 0.28,-0.28], [-0.34,-0.05, 0.34,-0.05], [-0.3,0.2, 0.3,0.2],
          [0,-0.5, 0,0.42],
          [-0.5,0.0, -0.66,-0.12], [0.5,0.0, 0.66,-0.12],
          [-0.2,0.46, -0.22,0.62], [0.2,0.46, 0.22,0.62]],
      e: [[-0.12,-0.4],[0.12,-0.4]] } },
    sentinel: { name: 'Sentinel', art: {
      p: [[0,-0.5, 0.4,-0.28, 0.4,0.28, 0,0.5, -0.4,0.28, -0.4,-0.28, 0,-0.5],
          [0,-0.32, 0.22,-0.16, 0.22,0.16, 0,0.32, -0.22,0.16, -0.22,-0.16, 0,-0.32],
          [0,-0.12, 0.12,0, 0,0.12, -0.12,0, 0,-0.12],
          [0.4,0.0, 0.62,0.0], [-0.4,0.0, -0.62,0.0]],
      e: [[0,0]] } },
    leech: { name: 'Leech', art: {
      p: [[-0.3,-0.28, 0.3,-0.28, 0.36,0.1, 0,0.28, -0.36,0.1, -0.3,-0.28],
          [-0.16,-0.18, -0.12,-0.02], [0.16,-0.18, 0.12,-0.02], [-0.06,0.04, 0.06,0.04],
          [0,0.28, -0.08,0.5, 0.04,0.62], [-0.2,0.2, -0.34,0.46], [0.2,0.2, 0.34,0.46]],
      e: [[-0.1,-0.1],[0.1,-0.1]] } },
    totem: { name: 'Totem', art: {
      p: [[-0.3,-0.5, 0.3,-0.5, 0.3,-0.3, -0.3,-0.3, -0.3,-0.5],
          [-0.36,-0.3, 0.36,-0.3, 0.34,0.0, -0.34,0.0, -0.36,-0.3],
          [-0.3,0.0, 0.3,0.0, 0.24,0.42, -0.24,0.42, -0.3,0.0],
          [-0.12,-0.44, 0.12,-0.44, 0.12,-0.36, -0.12,-0.36],
          [0,-0.2, 0.12,-0.12, 0,-0.04, -0.12,-0.12, 0,-0.2],
          [-0.36,-0.26, -0.52,-0.34], [0.36,-0.26, 0.52,-0.34],
          [-0.22,0.42, -0.24,0.58], [0.22,0.42, 0.24,0.58]],
      e: [[-0.07,-0.4],[0.07,-0.4]] } },
    dire_maw: { name: 'Dire Maw', art: {
      p: [[-0.66,-0.4, -0.1,-0.56, 0.24,-0.36, 0.14,0.04, -0.36,0.1, -0.7,-0.14, -0.66,-0.4],
          [-0.58,-0.04, -0.5,0.2], [-0.4,-0.1, -0.34,0.18], [-0.2,-0.12, -0.14,0.16], [0.0,-0.12, 0.06,0.12],
          [-0.5,-0.36, -0.46,-0.18], [-0.3,-0.42, -0.26,-0.22], [-0.08,-0.42, -0.04,-0.24],
          [0.14,-0.18, 0.62,-0.16, 0.74,0.18, 0.2,0.24, 0.14,0.04],
          [0.2,0.24, 0.18,0.56], [0.58,0.18, 0.58,0.56], [-0.36,0.1, -0.4,0.5], [0.0,0.12, -0.04,0.5],
          [0.74,0.0, 1.02,-0.2, 0.92,-0.42]],
      e: [[-0.4,-0.34],[-0.16,-0.36]] } },
  };
  ns.STATUS_NAMES = STATUS_NAMES;

  // HP paid each time a Void-Touched card is played.
  ns.VTOUCH_HP = 3;
  // "Void-Touched": empower a card's numbers (it costs HP to play, see engine).
  function voidBoost(fx) {
    return fx.map(function (f) {
      var g = {}; for (var k in f) g[k] = f[k];
      if (g.k === 'dmg' || g.k === 'block' || g.k === 'heal') g.v = Math.ceil(g.v * 1.5);
      else if (g.k === 'status' || g.k === 'draw' || g.k === 'energy') g.v = g.v + 1;
      return g;
    });
  }
  ns.voidBoost = voidBoost;

  ns.CARDS = {

    /* ---------------- Starters ---------------- */
    pulse_rifle: {
      name: 'Pulse Rifle', cls: 'any', type: 'attack', rarity: 0, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'might' }],
      up: { fx: [{ k: 'dmg', v: 9, scale: 'might' }] },
    },
    combat_shield: {
      name: 'Combat Shield', cls: 'any', type: 'skill', rarity: 0, cost: 1,
      fx: [{ k: 'block', v: 5, scale: 'pri' }],
      up: { fx: [{ k: 'block', v: 8, scale: 'pri' }] },
    },
    bayonet_charge: {
      name: 'Bayonet Charge', cls: 'vanguard', type: 'attack', rarity: 0, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'might' }, { k: 'status', s: 'vuln', v: 1, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 8, scale: 'might' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }] },
    },
    overshield: {
      name: 'Overshield', cls: 'technomancer', type: 'skill', rarity: 0, cost: 1,
      fx: [{ k: 'block', v: 4, scale: 'tech' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'block', v: 7, scale: 'tech' }, { k: 'draw', v: 1 }] },
    },
    mind_spike: {
      name: 'Mind Spike', cls: 'voidadept', type: 'attack', rarity: 0, cost: 1,
      fx: [{ k: 'dmg', v: 4, scale: 'psi' }, { k: 'status', s: 'weak', v: 1, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 6, scale: 'psi' }, { k: 'status', s: 'weak', v: 2, who: 'target' }] },
    },

    /* ---------------- Vanguard ---------------- */
    burst_fire: {
      name: 'Burst Fire', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 3, hits: 2, scale: 'might' }],
      up: { fx: [{ k: 'dmg', v: 3, hits: 3, scale: 'might' }] },
    },
    suppressing_fire: {
      name: 'Suppressing Fire', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 5, scale: 'might' }, { k: 'status', s: 'weak', v: 2, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 8, scale: 'might' }, { k: 'status', s: 'weak', v: 2, who: 'target' }] },
    },
    frag_grenade: {
      name: 'Frag Grenade', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 5, all: true }],
      up: { fx: [{ k: 'dmg', v: 8, all: true }] },
    },
    shield_slam: {
      name: 'Shield Slam', cls: 'vanguard', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'shieldSlam' }],
      text: 'Deal damage equal to your Shield.',
      up: { fx: [{ k: 'special', id: 'shieldSlam15' }], text: 'Deal damage equal to 150% of your Shield.' },
    },
    bulwark: {
      name: 'Bulwark', cls: 'vanguard', type: 'skill', rarity: 2, cost: 2,
      fx: [{ k: 'block', v: 13, scale: 'pri' }, { k: 'status', s: 'thorns', v: 3, who: 'self' }],
      up: { fx: [{ k: 'block', v: 17, scale: 'pri' }, { k: 'status', s: 'thorns', v: 4, who: 'self' }] },
    },
    combat_stims: {
      name: 'Combat Stims', cls: 'vanguard', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'str', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'str', v: 3, who: 'self' }] },
    },
    adrenal_surge: {
      name: 'Adrenal Surge', cls: 'vanguard', type: 'skill', rarity: 2, cost: 0, exhaust: true,
      fx: [{ k: 'energy', v: 2 }, { k: 'hploss', v: 2 }],
      up: { fx: [{ k: 'energy', v: 2 }] },
    },
    executioner: {
      name: 'Executioner Round', cls: 'vanguard', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 10, scale: 'might' }, { k: 'special', id: 'execute' }],
      text: 'Double damage if the target is below 30% HP.',
      up: { fx: [{ k: 'dmg', v: 14, scale: 'might' }, { k: 'special', id: 'execute' }] },
    },
    orbital_strike: {
      name: 'Orbital Strike', cls: 'vanguard', type: 'attack', rarity: 3, cost: 3,
      fx: [{ k: 'dmg', v: 22, all: true, scale: 'might' }],
      up: { fx: [{ k: 'dmg', v: 30, all: true, scale: 'might' }] },
    },
    warlord_protocol: {
      name: 'Warlord Protocol', cls: 'vanguard', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'strPerTurn', v: 1, who: 'self' }],
      up: { cost: 1 },
    },

    /* ---------------- Technomancer ---------------- */
    shock_coil: {
      name: 'Shock Coil', cls: 'technomancer', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'tech' }],
      up: { fx: [{ k: 'dmg', v: 9, scale: 'tech' }] },
    },
    fortify_matrix: {
      name: 'Fortify Matrix', cls: 'technomancer', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'block', v: 8, scale: 'tech' }],
      up: { fx: [{ k: 'block', v: 11, scale: 'tech' }] },
    },
    nano_repair: {
      name: 'Nano Repair', cls: 'technomancer', type: 'skill', rarity: 1, cost: 1, exhaust: true,
      fx: [{ k: 'heal', v: 4 }],
      up: { fx: [{ k: 'heal', v: 7 }] },
    },
    overclock: {
      name: 'Overclock', cls: 'technomancer', type: 'skill', rarity: 1, cost: 0,
      fx: [{ k: 'draw', v: 2 }, { k: 'hploss', v: 2 }],
      up: { fx: [{ k: 'draw', v: 2 }, { k: 'hploss', v: 1 }] },
    },
    leech_coil: {
      name: 'Leech Coil', cls: 'technomancer', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 5, scale: 'tech' }, { k: 'special', id: 'leech' }],
      text: 'Gain Shield equal to damage dealt.',
      up: { fx: [{ k: 'dmg', v: 8, scale: 'tech' }, { k: 'special', id: 'leech' }] },
    },
    deploy_turret: {
      name: 'Deploy Turret', cls: 'technomancer', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'turret', v: 4, who: 'self' }],
      text: 'At the end of your turn, the turret fires at a random enemy.',
      up: { fx: [{ k: 'status', s: 'turret', v: 6, who: 'self' }] },
    },
    emp_blast: {
      name: 'EMP Blast', cls: 'technomancer', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 7, all: true, scale: 'tech' }, { k: 'status', s: 'weak', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 10, all: true, scale: 'tech' }, { k: 'status', s: 'weak', v: 2, who: 'allEnemies' }] },
    },
    railgun: {
      name: 'Railgun', cls: 'technomancer', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 13, scale: 'tech' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 17, scale: 'tech' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }] },
    },
    phase_bulwark: {
      name: 'Phase Bulwark', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'retain', v: 1, who: 'self' }],
      up: { cost: 1 },
    },
    aux_reactor: {
      name: 'Auxiliary Reactor', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'reactor', v: 1, who: 'self' }],
      up: { cost: 1 },
    },

    /* ---------------- Void Adept ---------------- */
    psy_lance: {
      name: 'Psy Lance', cls: 'voidadept', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 7, scale: 'psi' }],
      up: { fx: [{ k: 'dmg', v: 10, scale: 'psi' }] },
    },
    soul_burn: {
      name: 'Soul Burn', cls: 'voidadept', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'burn', v: 4, who: 'target' }],
      up: { fx: [{ k: 'status', s: 'burn', v: 7, who: 'target' }] },
    },
    hex_weave: {
      name: 'Hex Weave', cls: 'voidadept', type: 'skill', rarity: 1, cost: 0,
      fx: [{ k: 'status', s: 'burn', v: 2, who: 'target' }],
      up: { fx: [{ k: 'status', s: 'burn', v: 4, who: 'target' }] },
    },
    premonition: {
      name: 'Premonition', cls: 'voidadept', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'draw', v: 2 }, { k: 'block', v: 3 }],
      up: { fx: [{ k: 'draw', v: 2 }, { k: 'block', v: 6 }] },
    },
    mind_fracture: {
      name: 'Mind Fracture', cls: 'voidadept', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'vuln', v: 1, who: 'target' }, { k: 'status', s: 'weak', v: 1, who: 'target' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'status', s: 'vuln', v: 2, who: 'target' }, { k: 'status', s: 'weak', v: 2, who: 'target' }, { k: 'draw', v: 1 }] },
    },
    void_grasp: {
      name: 'Void Grasp', cls: 'voidadept', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 9, scale: 'psi' }, { k: 'special', id: 'drain' }],
      text: 'Heal for half the damage dealt.',
      up: { fx: [{ k: 'dmg', v: 13, scale: 'psi' }, { k: 'special', id: 'drain' }] },
    },
    tk_crush: {
      name: 'Telekinetic Crush', cls: 'voidadept', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 5, scale: 'psi', scaleMul: 3 }],
      up: { fx: [{ k: 'dmg', v: 9, scale: 'psi', scaleMul: 3 }] },
    },
    psionic_focus: {
      name: 'Psionic Focus', cls: 'voidadept', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'psiPow', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'psiPow', v: 3, who: 'self' }] },
    },
    eldritch_storm: {
      name: 'Eldritch Storm', cls: 'voidadept', type: 'attack', rarity: 3, cost: 3,
      fx: [{ k: 'dmg', v: 4, hits: 4, scale: 'psi', random: true }],
      up: { fx: [{ k: 'dmg', v: 5, hits: 5, scale: 'psi', random: true }] },
    },
    entropy_field: {
      name: 'Entropy Field', cls: 'voidadept', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'entropy', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'entropy', v: 3, who: 'self' }] },
    },

    /* ---------------- Neutral ---------------- */
    scrap_shot: {
      name: 'Scrap Shot', cls: 'any', type: 'attack', rarity: 1, cost: 0,
      fx: [{ k: 'dmg', v: 3 }],
      up: { fx: [{ k: 'dmg', v: 5 }] },
    },
    med_stim: {
      name: 'Med Stim', cls: 'any', type: 'skill', rarity: 1, cost: 1, exhaust: true,
      fx: [{ k: 'heal', v: 5 }],
      up: { fx: [{ k: 'heal', v: 8 }] },
    },
    brace: {
      name: 'Brace', cls: 'any', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'block', v: 5, scale: 'pri' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'block', v: 8, scale: 'pri' }, { k: 'draw', v: 1 }] },
    },
    combat_scan: {
      name: 'Combat Scan', cls: 'any', type: 'skill', rarity: 1, cost: 0,
      fx: [{ k: 'status', s: 'vuln', v: 1, who: 'target' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'status', s: 'vuln', v: 2, who: 'target' }, { k: 'draw', v: 1 }] },
    },
    reload: {
      name: 'Reload', cls: 'any', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'draw', v: 3 }],
      up: { cost: 0 },
    },

    /* ============ Archetype cards (Slay-the-Spire-style builds) ============ */

    /* -- Vanguard: STRENGTH + EXHAUST berserker -- */
    heavy_ordnance: {
      name: 'Heavy Ordnance', cls: 'vanguard', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 8, scale: 'might', scaleMul: 3 }],
      text: 'MIGHT counts three times.',
      up: { fx: [{ k: 'dmg', v: 12, scale: 'might', scaleMul: 3 }] },
    },
    limit_break: {
      name: 'Limit Break', cls: 'vanguard', type: 'skill', rarity: 2, cost: 1, exhaust: true,
      fx: [{ k: 'special', id: 'limitBreak' }],
      text: 'Double your Might.',
      up: { cost: 0, fx: [{ k: 'special', id: 'limitBreak' }], text: 'Double your Might.' },
    },
    whirlwind: {
      name: 'Whirlwind', cls: 'vanguard', type: 'attack', rarity: 2, cost: 0, xcost: true,
      fx: [{ k: 'dmg', v: 5, all: true, scale: 'might', xcost: true }],
      up: { fx: [{ k: 'dmg', v: 8, all: true, scale: 'might', xcost: true }] },
    },
    iron_resolve: {
      name: 'Iron Resolve', cls: 'vanguard', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'feelNoPain', v: 3, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'feelNoPain', v: 4, who: 'self' }] },
    },
    reckless_protocol: {
      name: 'Reckless Protocol', cls: 'vanguard', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'corruption', v: 1, who: 'self' }],
      up: { cost: 1, fx: [{ k: 'status', s: 'corruption', v: 1, who: 'self' }] },
    },

    /* -- Technomancer: SHIELD + ORB/TURRET + POWER stacking -- */
    kinetic_discharge: {
      name: 'Kinetic Discharge', cls: 'technomancer', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'shieldSlam' }],
      text: 'Deal damage equal to your Shield.',
      up: { fx: [{ k: 'special', id: 'shieldSlam15' }], text: 'Deal damage equal to 150% of your Shield.' },
    },
    entrench_field: {
      name: 'Entrench Field', cls: 'technomancer', type: 'skill', rarity: 2, cost: 2,
      fx: [{ k: 'special', id: 'doubleBlock' }],
      text: 'Double your Shield.',
      up: { cost: 1, fx: [{ k: 'special', id: 'doubleBlock' }], text: 'Double your Shield.' },
    },
    overload_capacitor: {
      name: 'Overload Capacitor', cls: 'technomancer', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'afterImage', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'afterImage', v: 2, who: 'self' }] },
    },
    echo_core: {
      name: 'Echo Core', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'echo', v: 1, who: 'self' }],
      up: { cost: 1, fx: [{ k: 'status', s: 'echo', v: 1, who: 'self' }] },
    },

    /* -- Void Adept: BURN(POISON) + card-spam -- */
    catalyst: {
      name: 'Catalyst', cls: 'voidadept', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'catalyst' }],
      text: 'Double the Burn on the target.',
      up: { fx: [{ k: 'special', id: 'catalyst3' }], text: 'Triple the Burn on the target.' },
    },
    mind_array: {
      name: 'Mind Array', cls: 'voidadept', type: 'power', rarity: 3, cost: 1,
      fx: [{ k: 'status', s: 'thousandCuts', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'thousandCuts', v: 3, who: 'self' }] },
    },
    plague_engine: {
      name: 'Plague Engine', cls: 'voidadept', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'plague', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'plague', v: 2, who: 'self' }] },
    },

    /* -- Neutral enablers -- */
    salvage_protocol: {
      name: 'Salvage Protocol', cls: 'any', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'darkEmbrace', v: 1, who: 'self' }],
      up: { cost: 0, fx: [{ k: 'status', s: 'darkEmbrace', v: 1, who: 'self' }] },
    },
    guard_protocol: {
      name: 'Guard Protocol', cls: 'any', type: 'skill', rarity: 2, cost: 1, retain: true,
      fx: [{ k: 'block', v: 6, scale: 'pri' }],
      up: { fx: [{ k: 'block', v: 9, scale: 'pri' }] },
    },

    /* ============ Expansion: new class cards ============ */
    /* -- Vanguard -- */
    war_cry: {
      name: 'War Cry', cls: 'vanguard', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'str', v: 2, who: 'self' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'status', s: 'str', v: 3, who: 'self' }, { k: 'draw', v: 1 }] },
    },
    cluster_munitions: {
      name: 'Cluster Munitions', cls: 'vanguard', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 4, all: true, hits: 2, scale: 'might' }],
      up: { fx: [{ k: 'dmg', v: 6, all: true, hits: 2, scale: 'might' }] },
    },
    bunker_down: {
      name: 'Bunker Down', cls: 'vanguard', type: 'skill', rarity: 2, cost: 2,
      fx: [{ k: 'block', v: 8, scale: 'pri' }, { k: 'status', s: 'platedArmor', v: 3, who: 'self' }],
      up: { fx: [{ k: 'block', v: 12, scale: 'pri' }, { k: 'status', s: 'platedArmor', v: 4, who: 'self' }] },
    },

    /* -- Technomancer -- */
    arc_welder: {
      name: 'Arc Welder', cls: 'technomancer', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 7, scale: 'tech' }, { k: 'block', v: 4, scale: 'tech' }],
      up: { fx: [{ k: 'dmg', v: 10, scale: 'tech' }, { k: 'block', v: 6, scale: 'tech' }] },
    },
    static_lance: {
      name: 'Static Lance', cls: 'technomancer', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 8, scale: 'tech' }, { k: 'status', s: 'weak', v: 2, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 11, scale: 'tech' }, { k: 'status', s: 'weak', v: 3, who: 'target' }] },
    },
    shield_battery: {
      name: 'Shield Battery', cls: 'technomancer', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'plate', v: 4, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'plate', v: 6, who: 'self' }] },
    },

    /* -- Void Adept -- */
    void_bolt: {
      name: 'Void Bolt', cls: 'voidadept', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 5, scale: 'psi' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 7, scale: 'psi' }, { k: 'status', s: 'vuln', v: 3, who: 'target' }] },
    },
    wither: {
      name: 'Wither', cls: 'voidadept', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'burn', v: 3, who: 'target' }, { k: 'status', s: 'weak', v: 2, who: 'target' }],
      up: { fx: [{ k: 'status', s: 'burn', v: 5, who: 'target' }, { k: 'status', s: 'weak', v: 2, who: 'target' }] },
    },
    blood_sacrifice: {
      name: 'Blood Sacrifice', cls: 'voidadept', type: 'skill', rarity: 2, cost: 0, exhaust: true,
      fx: [{ k: 'hploss', v: 4 }, { k: 'status', s: 'psiPow', v: 2, who: 'self' }],
      up: { fx: [{ k: 'hploss', v: 3 }, { k: 'status', s: 'psiPow', v: 3, who: 'self' }] },
    },

    /* ============ Archetype depth: 4 builds per class ============ */

    /* -- Vanguard: ORDNANCE (exhaust) + BULWARK (block) + SUPPRESSION -- */
    scorched_earth: {
      name: 'Scorched Earth', cls: 'vanguard', type: 'attack', rarity: 3, cost: 2, exhaust: true,
      fx: [{ k: 'special', id: 'fiendFire', v: 6 }],
      text: 'Exhaust your hand. Deal 6 damage to the target for each card Exhausted.',
      up: { fx: [{ k: 'special', id: 'fiendFire', v: 9 }], text: 'Exhaust your hand. Deal 9 damage to the target for each card Exhausted.' },
    },
    munitions_dump: {
      name: 'Munitions Dump', cls: 'vanguard', type: 'skill', rarity: 2, cost: 1, exhaust: true,
      fx: [{ k: 'energy', v: 2 }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'energy', v: 2 }, { k: 'draw', v: 2 }] },
    },
    barricade_protocol: {
      name: 'Barricade Protocol', cls: 'vanguard', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'barricade', v: 1, who: 'self' }],
      up: { cost: 1, fx: [{ k: 'status', s: 'barricade', v: 1, who: 'self' }] },
    },
    riot_shield: {
      name: 'Riot Shield', cls: 'vanguard', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'block', v: 6, scale: 'pri' }, { k: 'status', s: 'thorns', v: 3, who: 'self' }],
      up: { fx: [{ k: 'block', v: 9, scale: 'pri' }, { k: 'status', s: 'thorns', v: 4, who: 'self' }] },
    },
    breach: {
      name: 'Breach', cls: 'vanguard', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'reap', v: 5 }],
      text: 'Deal 5 damage for each Vulnerable, Weak, and Burn on the target.',
      up: { fx: [{ k: 'special', id: 'reap', v: 8 }], text: 'Deal 8 damage for each Vulnerable, Weak, and Burn on the target.' },
    },

    /* -- Technomancer: CONSTRUCTS (turrets) + OVERCLOCK (powers) + TESLA -- */
    sentry_protocol: {
      name: 'Sentry Protocol', cls: 'technomancer', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'turret', v: 3, who: 'self' }, { k: 'status', s: 'plate', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'turret', v: 4, who: 'self' }, { k: 'status', s: 'plate', v: 3, who: 'self' }] },
    },
    drone_swarm: {
      name: 'Drone Swarm', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'turret', v: 6, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'turret', v: 8, who: 'self' }] },
    },
    cogwork_surge: {
      name: 'Cogwork Surge', cls: 'technomancer', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'powerSurge', v: 3 }],
      text: 'Gain 3 Shield for each Power you have played this combat.',
      up: { fx: [{ k: 'special', id: 'powerSurge', v: 5 }], text: 'Gain 5 Shield for each Power you have played this combat.' },
    },
    chain_lightning: {
      name: 'Chain Lightning', cls: 'technomancer', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 4, hits: 3, random: true, scale: 'tech' }],
      up: { fx: [{ k: 'dmg', v: 6, hits: 3, random: true, scale: 'tech' }] },
    },
    static_field: {
      name: 'Static Field', cls: 'technomancer', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'weak', v: 2, who: 'allEnemies' }, { k: 'block', v: 4, scale: 'pri' }],
      up: { fx: [{ k: 'status', s: 'weak', v: 2, who: 'allEnemies' }, { k: 'block', v: 7, scale: 'pri' }] },
    },

    /* -- Void Adept: HEXWEAVER + MAELSTROM (spam) + BLOOD PACT (sacrifice) -- */
    blood_pact: {
      name: 'Blood Pact', cls: 'voidadept', type: 'power', rarity: 3, cost: 1,
      fx: [{ k: 'status', s: 'bloodPact', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'bloodPact', v: 2, who: 'self' }] },
    },
    exsanguinate: {
      name: 'Exsanguinate', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'hploss', v: 3 }, { k: 'dmg', v: 10, scale: 'psi' }, { k: 'special', id: 'drain' }],
      text: 'Heal for half the damage dealt.',
      up: { fx: [{ k: 'hploss', v: 3 }, { k: 'dmg', v: 14, scale: 'psi' }, { k: 'special', id: 'drain' }] },
    },
    void_siphon: {
      name: 'Void Siphon', cls: 'voidadept', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'psi' }, { k: 'status', s: 'vuln', v: 1, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 8, scale: 'psi' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }] },
    },
    unravel: {
      name: 'Unravel', cls: 'voidadept', type: 'attack', rarity: 3, cost: 1,
      fx: [{ k: 'special', id: 'reap', v: 4 }],
      text: 'Deal 4 damage for each Vulnerable, Weak, and Burn on the target.',
      up: { fx: [{ k: 'special', id: 'reap', v: 6 }], text: 'Deal 6 damage for each Vulnerable, Weak, and Burn on the target.' },
    },
    mind_storm: {
      name: 'Mind Storm', cls: 'voidadept', type: 'attack', rarity: 2, cost: 0,
      fx: [{ k: 'special', id: 'overdrive', v: 3 }],
      text: 'Deal 3 damage for each other card played this turn.',
      up: { fx: [{ k: 'special', id: 'overdrive', v: 4 }], text: 'Deal 4 damage for each other card played this turn.' },
    },
    hemorrhage: {
      name: 'Hemorrhage', cls: 'voidadept', type: 'skill', rarity: 1, cost: 0, exhaust: true,
      fx: [{ k: 'hploss', v: 2 }, { k: 'energy', v: 2 }],
      up: { fx: [{ k: 'hploss', v: 1 }, { k: 'energy', v: 2 }] },
    },

    /* =================== Warpcaller (the ship captain & their crew) ===================
     * Three self-sufficient builds — each carries its OWN defense + offense, so no
     * single archetype hoards survival:
     *   THE WALL    — DEF hard block (warden/behemoth + Bulwark/Aegis); OFF slow BOND chip
     *   THE ALPHA   — DEF lifesteal (Savage Feast) + tanky apex; OFF one buffed beast, raced
     *   THE BUTCHER — DEF a body-wall that shields you as it dies (Symbiosis); OFF Bloodscent + Cull
     * ------------------------------------------------------------------------------------ */

    /* ---- shared core ---- */
    claw_swipe: {   // weak personal attack — the Warpcaller can barely fight alone
      name: 'Claw Swipe', cls: 'warpcaller', type: 'attack', rarity: 0, cost: 1,
      fx: [{ k: 'dmg', v: 4, scale: 'bond' }],
      up: { fx: [{ k: 'dmg', v: 6, scale: 'bond' }] },
    },
    summon_maw: {
      name: 'Summon Maw', cls: 'warpcaller', type: 'skill', rarity: 0, cost: 1,
      fx: [{ k: 'pet', id: 'maw', n: 1 }],
      text: 'Summon a Maw (bites a random enemy each turn).',
      up: { fx: [{ k: 'pet', id: 'maw', n: 1 }, { k: 'status', s: 'pack', v: 1, who: 'self' }], text: 'Summon a Maw. Gain 1 Pack Fury.' },
    },
    howl: {
      name: 'Howl', cls: 'warpcaller', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'pack', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'pack', v: 2, who: 'self' }] },
    },
    summon_totem: {
      name: 'Raise Totem', cls: 'warpcaller', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'pet', id: 'totem', n: 1 }],
      text: 'Summon a Totem — the pets on EITHER SIDE of it deal +2 with their actions. Place it in the middle of the line.',
      up: { cost: 0, fx: [{ k: 'pet', id: 'totem', n: 1 }], text: 'Summon a Totem — the pets on either side of it deal +2 with their actions.' },
    },
    kennel: {
      name: 'Kennel', cls: 'warpcaller', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'slots', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'slots', v: 3, who: 'self' }] },
    },

    /* ---- THE WALL — DEFENSE: hard block & sustain. OFFENSE: slow BOND chip.
     *      Survive forever, win by attrition. (Strongest build, so tuned down.) ---- */
    summon_warden: {
      name: 'Summon Warden', cls: 'warpcaller', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'pet', id: 'warden', n: 1 }],
      text: 'Summon a Warden — your tank. Put it FRONT to body single-target hits; it shields you each turn.',
      up: { fx: [{ k: 'pet', id: 'warden', n: 1 }, { k: 'block', v: 4, scale: 'bond' }], text: 'Summon a Warden (tank). Gain Shield.' },
    },
    summon_leech: {
      name: 'Summon Leech', cls: 'warpcaller', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'pet', id: 'leech', n: 1 }],
      text: 'Summon a Leech — each turn it heals the pet in FRONT of it. Place it behind your tank.',
      up: { fx: [{ k: 'pet', id: 'leech', n: 1 }, { k: 'draw', v: 1 }], text: 'Summon a Leech. Draw 1.' },
    },
    entrench: {   // the Wall's payoff: a planted front tank digs in, escalating
      name: 'Entrench', cls: 'warpcaller', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'bulwark', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'bulwark', v: 3, who: 'self' }] },
    },
    aegis: {   // formation-wide defensive burst
      name: 'Aegis', cls: 'warpcaller', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'packshield', v: 4 }],
      text: 'Every pet gains 4 Block.',
      up: { fx: [{ k: 'special', id: 'packshield', v: 6 }], text: 'Every pet gains 6 Block.' },
    },
    summon_behemoth: {
      name: 'Summon Behemoth', cls: 'warpcaller', type: 'skill', rarity: 3, cost: 2,
      fx: [{ k: 'pet', id: 'behemoth', n: 1 }],
      text: 'Summon a Behemoth — a huge tank (16 HP, big self-block). Fills 2 slots; the ultimate front-line wall.',
      up: { fx: [{ k: 'pet', id: 'behemoth', n: 1 }, { k: 'block', v: 5, scale: 'bond' }], text: 'Summon a Behemoth (2 slots). Gain Shield.' },
    },

    /* ---- THE ALPHA — DEFENSE: lifesteal off the hunt (Savage Feast) + a tanky
     *      apex. OFFENSE: funnel every buff into one beast and race them down. ---- */
    summon_dire: {
      name: 'Summon Dire Maw', cls: 'warpcaller', type: 'skill', rarity: 2, cost: 2,
      fx: [{ k: 'pet', id: 'dire_maw', n: 1 }],
      text: 'Summon a Dire Maw (2 slots, 14 HP) — a huge beast that savages a random enemy each turn. Your apex; it can take hits AND deal them.',
      up: { fx: [{ k: 'pet', id: 'dire_maw', n: 1 }, { k: 'status', s: 'pack', v: 2, who: 'self' }], text: 'Summon a Dire Maw (2 slots, 14 HP). Gain 2 Pack Fury.' },
    },
    savage_feast: {   // the Alpha's defense — the captain heals off every kill-blow
      name: 'Savage Feast', cls: 'warpcaller', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'feast', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'feast', v: 3, who: 'self' }] },
    },
    feed_the_alpha: {
      name: 'Feed the Alpha', cls: 'warpcaller', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'feed', v: 4 }],
      text: 'Sacrifice your weakest pet; your strongest pet permanently gains +4 to its action.',
      up: { fx: [{ k: 'special', id: 'feed', v: 7 }], text: 'Sacrifice your weakest pet; your strongest pet permanently gains +7 to its action.' },
    },
    pack_frenzy: {
      name: 'Pack Frenzy', cls: 'warpcaller', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'frenzy' }],
      text: 'Your whole pack acts again immediately.',
      up: { cost: 0, fx: [{ k: 'special', id: 'frenzy' }], text: 'Your whole pack acts again immediately.' },
    },
    apex_predator: {   // pure buff, no sacrifice — the Alpha's payoff power
      name: 'Apex Predator', cls: 'warpcaller', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'special', id: 'empower', v: 6 }, { k: 'status', s: 'pack', v: 1, who: 'self' }],
      text: 'Your strongest pet permanently gains +6 to its action. Gain 1 Pack Fury.',
      up: { fx: [{ k: 'special', id: 'empower', v: 9 }, { k: 'status', s: 'pack', v: 2, who: 'self' }], text: 'Your strongest pet permanently gains +9 to its action. Gain 2 Pack Fury.' },
    },

    /* ---- THE BUTCHER — DEFENSE: a churning body-wall that shields you as it
     *      dies (Symbiosis). OFFENSE: Bloodscent escalation + Cull burst. ---- */
    summon_stinger: {
      name: 'Summon Stinger', cls: 'warpcaller', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'pet', id: 'stinger', n: 1 }],
      text: 'Summon a Stinger (spits Burn at a random enemy each turn).',
      up: { fx: [{ k: 'pet', id: 'stinger', n: 1 }, { k: 'draw', v: 1 }], text: 'Summon a Stinger. Draw 1.' },
    },
    bloodbond: {   // pay HP for a fast pack of fragile bodies
      name: 'Blood Bond', cls: 'warpcaller', type: 'skill', rarity: 1, cost: 0,
      fx: [{ k: 'hploss', v: 3 }, { k: 'pet', id: 'spawnling', n: 2 }],
      text: 'Lose 3 HP. Summon 2 Spawnlings.',
      up: { fx: [{ k: 'hploss', v: 2 }, { k: 'pet', id: 'spawnling', n: 3 }], text: 'Lose 2 HP. Summon 3 Spawnlings.' },
    },
    spawn_brood: {
      name: 'Spawn Brood', cls: 'warpcaller', type: 'skill', rarity: 2, cost: 2,
      fx: [{ k: 'pet', id: 'spawnling', n: 3 }],
      text: 'Summon 3 Spawnlings (1 HP; each bursts for 3 when it dies).',
      up: { fx: [{ k: 'pet', id: 'spawnling', n: 4 }], text: 'Summon 4 Spawnlings (1 HP; each bursts for 3 when it dies).' },
    },
    symbiotic_bond: {   // the Butcher's defense: each body that dies armors you
      name: 'Symbiotic Bond', cls: 'warpcaller', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'symbiosis', v: 6, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'symbiosis', v: 9, who: 'self' }] },
    },
    feeding_frenzy: {   // escalating rage as the pack is fed into the grinder
      name: 'Feeding Frenzy', cls: 'warpcaller', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'bloodscent', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'bloodscent', v: 3, who: 'self' }] },
    },
    overgrowth: {
      name: 'Overgrowth', cls: 'warpcaller', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'brood', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'brood', v: 2, who: 'self' }] },
    },
    cull_the_weak: {
      name: 'Cull the Weak', cls: 'warpcaller', type: 'attack', rarity: 3, cost: 1, exhaust: true,
      fx: [{ k: 'special', id: 'cull', v: 7 }],
      text: 'Sacrifice your whole pack. Deal 7 damage to the target for each pet culled.',
      up: { fx: [{ k: 'special', id: 'cull', v: 10 }], text: 'Sacrifice your whole pack. Deal 10 damage to the target for each pet culled.' },
    },
    the_swarmlord: {   // Butcher capstone (boss reward)
      name: 'The Swarmlord', cls: 'warpcaller', type: 'power', rarity: 4, pool: 'boss', cost: 3,
      fx: [{ k: 'pet', id: 'spawnling', n: 3 }, { k: 'status', s: 'brood', v: 1, who: 'self' }, { k: 'status', s: 'bloodscent', v: 2, who: 'self' }],
      text: 'Summon 3 Spawnlings. Gain Brood 1 and 2 Bloodscent.',
      up: { fx: [{ k: 'pet', id: 'spawnling', n: 4 }, { k: 'status', s: 'brood', v: 1, who: 'self' }, { k: 'status', s: 'bloodscent', v: 3, who: 'self' }], text: 'Summon 4 Spawnlings. Gain Brood 1 and 3 Bloodscent.' },
    },

    /* ============ Legendaries (boss rewards only) ============ */
    orbital_bombardment: {
      name: 'Orbital Bombardment', cls: 'vanguard', type: 'attack', rarity: 4, pool: 'boss', cost: 3,
      fx: [{ k: 'dmg', v: 12, all: true, scale: 'might' }, { k: 'status', s: 'vuln', v: 2, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 16, all: true, scale: 'might' }, { k: 'status', s: 'vuln', v: 3, who: 'allEnemies' }] },
    },
    omega_protocol: {
      name: 'Omega Protocol', cls: 'technomancer', type: 'power', rarity: 4, pool: 'boss', cost: 3,
      fx: [{ k: 'status', s: 'retain', v: 1, who: 'self' }, { k: 'status', s: 'echo', v: 1, who: 'self' }],
      up: { cost: 2, fx: [{ k: 'status', s: 'retain', v: 1, who: 'self' }, { k: 'status', s: 'echo', v: 1, who: 'self' }] },
    },
    singularity_bloom: {
      name: 'Singularity Bloom', cls: 'voidadept', type: 'power', rarity: 4, pool: 'boss', cost: 2,
      fx: [{ k: 'status', s: 'plague', v: 1, who: 'self' }, { k: 'status', s: 'entropy', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'plague', v: 2, who: 'self' }, { k: 'status', s: 'entropy', v: 2, who: 'self' }] },
    },
    juggernaut_core: {
      name: 'Juggernaut Core', cls: 'any', type: 'power', rarity: 4, pool: 'boss', cost: 2,
      fx: [{ k: 'status', s: 'plate', v: 3, who: 'self' }, { k: 'status', s: 'strPerTurn', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'plate', v: 4, who: 'self' }, { k: 'status', s: 'strPerTurn', v: 1, who: 'self' }] },
    },

    /* ============ Event-only cards (never in normal rewards/shops) ============ */
    salvaged_ordnance: {
      name: 'Salvaged Ordnance', cls: 'any', type: 'attack', rarity: 2, pool: 'event', cost: 1, exhaust: true,
      fx: [{ k: 'dmg', v: 11 }],
      up: { fx: [{ k: 'dmg', v: 16 }] },
    },
    stim_overdose: {
      name: 'Stim Overdose', cls: 'any', type: 'skill', rarity: 2, pool: 'event', cost: 0, exhaust: true,
      fx: [{ k: 'energy', v: 2 }, { k: 'draw', v: 2 }, { k: 'hploss', v: 3 }],
      up: { fx: [{ k: 'energy', v: 2 }, { k: 'draw', v: 2 }, { k: 'hploss', v: 1 }] },
    },
    forbidden_lore: {
      name: 'Forbidden Lore', cls: 'any', type: 'skill', rarity: 3, pool: 'event', cost: 1, exhaust: true,
      fx: [{ k: 'draw', v: 3 }, { k: 'status', s: 'psiPow', v: 1, who: 'self' }],
      up: { fx: [{ k: 'draw', v: 4 }, { k: 'status', s: 'psiPow', v: 1, who: 'self' }] },
    },

    /* ---------------- Curses ---------------- */
    void_taint: {
      name: 'Void Taint', cls: 'curse', type: 'curse', rarity: -1, cost: 0, unplayable: true,
      fx: [], text: 'Unplayable. A whisper gnaws at the edge of your mind.',
    },
    shrapnel: {
      name: 'Shrapnel', cls: 'curse', type: 'curse', rarity: -1, cost: 0, unplayable: true,
      fx: [], text: 'Unplayable. Lose 2 HP if this is in your hand at end of turn.',
    },
    recurring_curse: {
      name: 'Recurring Dread', cls: 'curse', type: 'curse', rarity: -1, cost: 0, unplayable: true, retain: true,
      fx: [], text: 'Unplayable. A fragment of the loop, lodged in your mind — it will not leave.',
    },
  };

  /* ---- Starter decks ------------------------------------------------- */
  ns.STARTER_DECKS = {
    vanguard:     ['pulse_rifle', 'pulse_rifle', 'pulse_rifle', 'pulse_rifle', 'pulse_rifle',
                   'combat_shield', 'combat_shield', 'combat_shield', 'combat_shield', 'bayonet_charge'],
    technomancer: ['pulse_rifle', 'pulse_rifle', 'pulse_rifle', 'pulse_rifle',
                   'combat_shield', 'combat_shield', 'combat_shield', 'combat_shield', 'combat_shield', 'overshield'],
    voidadept:    ['pulse_rifle', 'pulse_rifle',
                   'combat_shield', 'combat_shield', 'combat_shield', 'combat_shield',
                   'mind_spike', 'mind_spike', 'mind_spike', 'mind_spike'],
    warpcaller:   ['claw_swipe', 'claw_swipe', 'claw_swipe', 'claw_swipe',
                   'summon_maw', 'summon_maw', 'combat_shield', 'combat_shield',
                   'summon_warden', 'summon_leech'],
  };

  /* ---- Description generator ----------------------------------------- */
  // ctx (optional): {attrs, statuses} so descriptions show live modified numbers.
  ns.cardDesc = function (def, upgraded, ctx, vtouch) {
    var fx = (upgraded && def.up && def.up.fx) ? def.up.fx : def.fx;
    if (vtouch) fx = voidBoost(fx);
    var parts = [];
    var B = ns.BALANCE;
    fx.forEach(function (f) {
      if (f.k === 'dmg') {
        var v = f.v;
        var mul = f.scaleMul || 1;
        if (ctx) {
          var dsc = f.scale === 'pri' ? (ctx.pri || 'might') : f.scale;
          if (dsc === 'might') v += ctx.attrs.might * B.attrs.mightDmgPerPoint * mul;
          if (dsc === 'tech') v += ctx.attrs.tech * mul;
          if (dsc === 'psi') v += ctx.attrs.psi * B.attrs.psiDmgPerPoint * mul;
          if (dsc === 'bond') v += (ctx.attrs.bond || 0) * B.attrs.bondPetPerPoint * mul;
          v += (ctx.flatDmg || 0);   // relic/augment flat damage (e.g. Honed Edge)
          if (ctx.statuses) {
            v += (ctx.statuses.str || 0);
            if (dsc === 'psi') v += (ctx.statuses.psiPow || 0);
          }
        }
        var s = 'Deal ' + Math.round(v) + ' damage';
        if (f.all) s += ' to ALL enemies';
        if (f.random) s += ' to random enemies';
        if (f.xcost) s += ', X times (X = current Energy)';
        else if (f.hits && f.hits > 1) s += ' ' + f.hits + ' times';
        parts.push(s + '.');
      }
      if (f.k === 'block') {
        var b = f.v;
        if (ctx) {
          var bsc = f.scale === 'pri' ? (ctx.pri || 'might') : f.scale;
          if (bsc === 'tech') b += ctx.attrs.tech * B.attrs.techBlockPerPoint;
          else if (bsc === 'might') b += ctx.attrs.might * B.attrs.mightBlockPerPoint;
          else if (bsc === 'psi') b += ctx.attrs.psi * B.attrs.psiBlockPerPoint;
        }
        parts.push('Gain ' + Math.round(b) + ' Shield.');
      }
      if (f.k === 'heal') parts.push('Heal ' + f.v + ' HP.');
      if (f.k === 'pet') { var pd = ns.PETS[f.id] || {}, pn = pd.name || f.id, szt = (pd.size || 1) > 1 ? ' [' + pd.size + ' slots]' : ''; parts.push('Summon ' + (f.n > 1 ? f.n + ' ' + pn + 's' : 'a ' + pn) + szt + '.'); }
      if (f.k === 'hploss') parts.push('Lose ' + f.v + ' HP.');
      if (f.k === 'draw') parts.push('Draw ' + f.v + ' card' + (f.v > 1 ? 's' : '') + '.');
      if (f.k === 'energy') parts.push('Gain ' + f.v + ' Energy.');
      if (f.k === 'status') {
        var n = STATUS_NAMES[f.s] || f.s;
        if (f.s === 'turret') parts.push('Turret: deal ' + (f.v + (ctx ? ctx.attrs.tech : 0)) + ' damage each turn.');
        else if (f.s === 'entropy') parts.push('At end of turn, apply ' + f.v + ' Burn to ALL enemies.');
        else if (f.s === 'reactor') parts.push('Gain +' + f.v + ' Energy at the start of each turn.');
        else if (f.s === 'retain') parts.push('Shield no longer expires.');
        else if (f.s === 'strPerTurn') parts.push('Gain ' + f.v + ' Might at the start of each turn.');
        else if (f.s === 'feelNoPain') parts.push('Whenever a card is Exhausted, gain ' + f.v + ' Shield.');
        else if (f.s === 'darkEmbrace') parts.push('Whenever a card is Exhausted, draw ' + f.v + ' card' + (f.v > 1 ? 's' : '') + '.');
        else if (f.s === 'thousandCuts') parts.push('Whenever you play a card, deal ' + f.v + ' damage to ALL enemies.');
        else if (f.s === 'afterImage') parts.push('Whenever you play a card, gain ' + f.v + ' Shield.');
        else if (f.s === 'plague') parts.push('Whenever you apply Burn, apply ' + f.v + ' Burn to ALL enemies.');
        else if (f.s === 'echo') parts.push('The first Attack you play each turn is played twice.');
        else if (f.s === 'plate') parts.push('Gain ' + f.v + ' Shield at the start of each turn.');
        else if (f.s === 'platedArmor') parts.push('Plated Armor ' + f.v + ': each turn gain that much Shield, then it drops by 1.');
        else if (f.s === 'corruption') parts.push('Skills cost 0 this combat, but Exhaust when played.');
        else if (f.s === 'barricade') parts.push('Your Shield no longer expires at the start of your turn.');
        else if (f.s === 'bloodPact') parts.push('Whenever you lose HP to your own cards, gain ' + f.v + ' Psi Focus.');
        else if (f.s === 'pack') parts.push('Your pets deal +' + f.v + ' with their actions (Pack Fury).');
        else if (f.s === 'symbiosis') parts.push('Whenever a pet dies, gain ' + f.v + ' Shield and draw a card.');
        else if (f.s === 'bloodscent') parts.push('Your pets deal +' + f.v + ' with their actions, and +1 more for every pet that dies (Bloodscent).');
        else if (f.s === 'bulwark') parts.push('At the start of each turn, your FRONT pet gains ' + f.v + ' Block (Bulwark).');
        else if (f.s === 'feast') parts.push('Whenever one of your pets attacks, heal ' + f.v + ' HP (Savage Feast).');
        else if (f.s === 'brood') parts.push('At the start of each turn, summon ' + (f.v > 1 ? f.v + ' Spawnlings' : 'a Spawnling') + '.');
        else if (f.s === 'slots') parts.push('+' + f.v + ' formation slot' + (f.v > 1 ? 's' : '') + ' (room for more or bigger pets).');
        else if (f.who === 'self') parts.push('Gain ' + f.v + ' ' + n + '.');
        else if (f.who === 'allEnemies') parts.push('Apply ' + f.v + ' ' + n + ' to ALL enemies.');
        else parts.push('Apply ' + f.v + ' ' + n + '.');
      }
    });
    var text = (upgraded && def.up && def.up.text) ? def.up.text : def.text;
    if (text) parts.push(text);
    if (def.retain) parts.push('Retain.');
    if (def.exhaust) parts.push('Exhaust.');
    if (vtouch) parts.push('Void-Touched: lose ' + ns.VTOUCH_HP + ' HP when played.');
    return parts.join(' ');
  };

  // Does this card need an enemy target?
  ns.cardNeedsTarget = function (def, upgraded) {
    var fx = (upgraded && def.up && def.up.fx) ? def.up.fx : def.fx;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i];
      if (f.k === 'dmg' && !f.all && !f.random) return true;
      if (f.k === 'status' && f.who === 'target') return true;
      if (f.k === 'special' && (f.id === 'shieldSlam' || f.id === 'shieldSlam15' || f.id === 'catalyst' || f.id === 'catalyst3' || f.id === 'reap' || f.id === 'overdrive' || f.id === 'fiendFire' || f.id === 'cull')) return true;
    }
    return false;
  };

  ns.cardCost = function (def, upgraded) {
    return (upgraded && def.up && def.up.cost !== undefined) ? def.up.cost : def.cost;
  };

  ns.cardFx = function (def, upgraded, vtouch) {
    var fx = (upgraded && def.up && def.up.fx) ? def.up.fx : def.fx;
    return vtouch ? voidBoost(fx) : fx;
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
