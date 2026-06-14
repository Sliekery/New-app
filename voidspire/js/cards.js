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
    platedArmor: 'Plated Armor',
  };
  ns.STATUS_NAMES = STATUS_NAMES;

  ns.CARDS = {

    /* ---------------- Starters ---------------- */
    pulse_rifle: {
      name: 'Pulse Rifle', cls: 'any', type: 'attack', rarity: 0, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'might' }],
      up: { fx: [{ k: 'dmg', v: 9, scale: 'might' }] },
    },
    combat_shield: {
      name: 'Combat Shield', cls: 'any', type: 'skill', rarity: 0, cost: 1,
      fx: [{ k: 'block', v: 5, scale: 'tech' }],
      up: { fx: [{ k: 'block', v: 8, scale: 'tech' }] },
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
      fx: [{ k: 'block', v: 13, scale: 'tech' }, { k: 'status', s: 'thorns', v: 3, who: 'self' }],
      up: { fx: [{ k: 'block', v: 17, scale: 'tech' }, { k: 'status', s: 'thorns', v: 4, who: 'self' }] },
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
      fx: [{ k: 'block', v: 5, scale: 'tech' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'block', v: 8, scale: 'tech' }, { k: 'draw', v: 1 }] },
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
      fx: [{ k: 'block', v: 6, scale: 'tech' }],
      up: { fx: [{ k: 'block', v: 9, scale: 'tech' }] },
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
  };

  /* ---- Starter decks ------------------------------------------------- */
  ns.STARTER_DECKS = {
    vanguard:     ['pulse_rifle', 'pulse_rifle', 'pulse_rifle', 'pulse_rifle', 'pulse_rifle',
                   'combat_shield', 'combat_shield', 'combat_shield', 'combat_shield', 'bayonet_charge'],
    technomancer: ['pulse_rifle', 'pulse_rifle', 'pulse_rifle', 'pulse_rifle',
                   'combat_shield', 'combat_shield', 'combat_shield', 'combat_shield', 'combat_shield', 'overshield'],
    voidadept:    ['pulse_rifle', 'pulse_rifle', 'pulse_rifle', 'pulse_rifle',
                   'combat_shield', 'combat_shield', 'combat_shield', 'combat_shield', 'mind_spike', 'mind_spike'],
  };

  /* ---- Description generator ----------------------------------------- */
  // ctx (optional): {attrs, statuses} so descriptions show live modified numbers.
  ns.cardDesc = function (def, upgraded, ctx) {
    var fx = (upgraded && def.up && def.up.fx) ? def.up.fx : def.fx;
    var parts = [];
    var B = ns.BALANCE;
    fx.forEach(function (f) {
      if (f.k === 'dmg') {
        var v = f.v;
        var mul = f.scaleMul || 1;
        if (ctx) {
          if (f.scale === 'might') v += ctx.attrs.might * B.attrs.mightDmgPerPoint * mul;
          if (f.scale === 'tech') v += ctx.attrs.tech * mul;
          if (f.scale === 'psi') v += ctx.attrs.psi * B.attrs.psiDmgPerPoint * mul;
          if (ctx.statuses) {
            v += (ctx.statuses.str || 0);
            if (f.scale === 'psi') v += (ctx.statuses.psiPow || 0);
          }
        }
        var s = 'Deal ' + v + ' damage';
        if (f.all) s += ' to ALL enemies';
        if (f.random) s += ' to random enemies';
        if (f.xcost) s += ', X times (X = current Energy)';
        else if (f.hits && f.hits > 1) s += ' ' + f.hits + ' times';
        parts.push(s + '.');
      }
      if (f.k === 'block') {
        var b = f.v;
        if (ctx && f.scale === 'tech') b += ctx.attrs.tech * B.attrs.techBlockPerPoint;
        parts.push('Gain ' + b + ' Shield.');
      }
      if (f.k === 'heal') parts.push('Heal ' + f.v + ' HP.');
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
        else if (f.s === 'corruption') parts.push('Skills cost 0 this combat, but Exhaust when played.');
        else if (f.who === 'self') parts.push('Gain ' + f.v + ' ' + n + '.');
        else if (f.who === 'allEnemies') parts.push('Apply ' + f.v + ' ' + n + ' to ALL enemies.');
        else parts.push('Apply ' + f.v + ' ' + n + '.');
      }
    });
    var text = (upgraded && def.up && def.up.text) ? def.up.text : def.text;
    if (text) parts.push(text);
    if (def.retain) parts.push('Retain.');
    if (def.exhaust) parts.push('Exhaust.');
    return parts.join(' ');
  };

  // Does this card need an enemy target?
  ns.cardNeedsTarget = function (def, upgraded) {
    var fx = (upgraded && def.up && def.up.fx) ? def.up.fx : def.fx;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i];
      if (f.k === 'dmg' && !f.all && !f.random) return true;
      if (f.k === 'status' && f.who === 'target') return true;
      if (f.k === 'special' && (f.id === 'shieldSlam' || f.id === 'shieldSlam15' || f.id === 'catalyst' || f.id === 'catalyst3')) return true;
    }
    return false;
  };

  ns.cardCost = function (def, upgraded) {
    return (upgraded && def.up && def.up.cost !== undefined) ? def.up.cost : def.cost;
  };

  ns.cardFx = function (def, upgraded) {
    return (upgraded && def.up && def.up.fx) ? def.up.fx : def.fx;
  };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
