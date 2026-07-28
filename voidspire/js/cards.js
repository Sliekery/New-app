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
    strPerTurn: 'Warlord', turret: 'Turret', drone: 'Drone Swarm', entropy: 'Entropy',
    retaliate: 'Riposte', momentum: 'Momentum', fullauto: 'Full Auto',
    parry: 'Parry', bloodrage: 'Blood Rage', vengeance: 'Vengeance', salvo: 'Salvo', restock: 'Quartermaster',
    reactor: 'Reactor', retain: 'Phase Lock',
    feelNoPain: 'Resolve', darkEmbrace: 'Salvage', thousandCuts: 'Blade Array',
    afterImage: 'Mirror Field', plague: 'Contagion', echo: 'Echo', corruption: 'Corruption',
    wildfire: 'Wildfire', psiRamp: 'Ascendant', hive: 'Hive', conduit: 'Conduit', plating: 'Plating',
    emberward: 'Ember Ward', staticward: 'Static Ward', spikeward: 'Spiked Bulwark',
    aim: 'Aim', aimPerTurn: 'Steady Aim', critFury: 'Killing Rage', deadeyeDraw: 'Deadeye', misfireGuard: 'Misfire Protocol',
    demoCharge: 'Demolition', subroutine: 'Subroutine', aegisLink: 'Swarm Uplink',
    platedArmor: 'Plated Armor', barricade: 'Barricade', bloodPact: 'Blood Pact',
    pack: 'Pack Fury', symbiosis: 'Symbiosis', brood: 'Brood', slots: 'Kennel',
    bulwark: 'Bulwark', bloodscent: 'Bloodscent', feast: 'Savage Feast',
  };

  ns.STATUS_NAMES = STATUS_NAMES;

  // Keyword glossary — shown ONLY when a card is inspected, never on the card
  // face. Keys match the keyword names that appear in card text.
  ns.KEYWORDS = {
    'Shield': 'Absorbs incoming damage. Expires at the start of your next turn unless stated otherwise.',
    'Plated Armor': 'At the start of your turn, gain Shield equal to your Plated Armor, then lose 1 of it.',
    'Plating': 'Gain Shield at the start of each turn.',
    'Barricade': 'Your Shield no longer expires at the start of your turn.',
    'Phase Lock': 'Your Shield no longer expires.',
    'Vulnerable': 'The unit takes 50% more attack damage. Ticks down 1 each turn.',
    'Weak': 'The unit deals 25% less attack damage. Ticks down 1 each turn.',
    'Burn': 'At the end of the turn the burning unit takes damage equal to its Burn, then it halves.',
    'Might': 'Increases the damage of your attacks by its value.',
    'Psi Focus': 'Increases the damage of your Psi attacks.',
    'Energy': 'Spent to play cards. Refills at the start of your turn.',
    'Exhaust': 'When played, this card is removed for the rest of combat.',
    'Retain': 'This card stays in your hand at the end of turn instead of being discarded.',
    'Regen': 'Heal HP equal to its value at the start of your turn. Ticks down.',
    'Thorns': 'When an enemy attacks you, it takes damage equal to your Thorns.',
    'Echo': 'The first Attack you play each turn is played twice.',
    'Momentum': 'Your attacks deal +1 damage for each Momentum. Resets each turn.',
    'Parry': 'Absorbs damage like Shield; each blow you parry strikes the attacker back (scales with Might).',
    'Riposte': 'Whenever you gain Shield, deal damage equal to your Riposte to a random enemy.',
    'Salvo': 'Whenever you Exhaust a card, deal damage equal to your Salvo to a random enemy.',
    'Quartermaster': 'At the start of each turn, return that many random exhausted Attacks to your hand.',
    'Full Auto': 'Whenever you play an Attack, gain Momentum.',
    'Blood Rage': 'Whenever you lose HP to your own cards, gain Might.',
    'Blood Pact': 'Whenever you lose HP to your own cards, gain Psi Focus.',
    'Vengeance': 'After you take a hit or parry a blow, your next Attack heals you.',
    'Entropy': 'At the end of your turn, apply Burn to ALL enemies.',
    'Wildfire': "Burn no longer fades — at the end of the turn it GROWS by your Wildfire and spreads to another enemy.",
    'Ascendant': 'Gain that much Psi Focus at the start of each turn.',
    'Detonate': "Consume all of the target's Burn to deal a burst of damage, splashing fresh Burn to another enemy.",
    'Hive': 'Every Turret and Drone Swarm you control fires one extra time each turn per stack.',
    'Conduit': 'Whenever you apply Weak or Vulnerable to an enemy, it also takes that much damage.',
    'Ember Ward': 'Whenever an enemy attacks you, it gains that much Burn (even through your Shield).',
    'Static Ward': 'Whenever an enemy attacks you, it gains that much Weak (even through your Shield).',
    'Spiked Bulwark': 'Whenever an enemy attacks you, it takes damage equal to your Might plus this value.',
    'Demolition': 'Whenever you Exhaust a card, deal that much damage to ALL enemies.',
    'Subroutine': 'Whenever you play a Power, draw a card.',
    'Swarm Uplink': 'Whenever one of your constructs fires, gain that much Shield.',
    'Aim': 'Added to the d20 you roll for every attack — it makes crits and roll thresholds far more likely.',
    'Steady Aim': 'Gain that much Aim at the start of each turn.',
    'Killing Rage': 'Whenever an attack crits, gain that much Might.',
    'Deadeye': 'Whenever an attack crits, draw that many cards.',
    'Misfire Protocol': 'When an attack misfires (a natural 1), gain that much Momentum and 1 Energy.',
    'Misfire': 'A natural 1 on the die — the shot goes wide and deals half damage.',
    'Crit': 'Roll + Aim meeting the crit mark (a natural 20 always crits) doubles the damage.',
    'Reactor': 'Gain +1 Energy at the start of each turn per stack.',
    'Warlord': 'Gain Might at the start of each turn.',
    'Resolve': 'Whenever a card is Exhausted, gain Shield.',
    'Salvage': 'Whenever a card is Exhausted, draw a card.',
    'Blade Array': 'Whenever you play a card, deal damage to ALL enemies.',
    'Mirror Field': 'Whenever you play a card, gain Shield.',
    'Contagion': 'Whenever you apply Burn, also apply Burn to ALL enemies.',
    'Corruption': 'Skills cost 0 this combat, but Exhaust when played.',
    'Turret': 'A deployed unit that attacks a random enemy for its damage at the end of each of your turns.',
    'Drone Swarm': 'A deployed unit that hits ALL enemies for its damage each turn.',
    'Siphon': 'Heal for half of the damage this card deals.',
    'Scry': 'Look at that many cards from the top of your draw pile and discard any number of them.',
    'Discover': 'Choose one of 3 random cards and add it to your hand.',
    'Primed': 'Counts down at the end of each of your turns, then detonates.',
    'Pack Fury': 'Your pets deal extra damage with their actions.',
    'Bloodscent': "Your pets deal extra damage, and +1 more for every pet that dies.",
    'Bulwark': 'At the start of each turn, your front pet gains Block.',
    'Savage Feast': 'Whenever one of your pets attacks, you heal.',
    'Symbiosis': 'Whenever a pet dies, gain Shield and draw a card.',
    'Brood': 'At the start of each turn, summon a Spawnling.',
    'Kennel': 'Adds formation slots (room for more or bigger pets).',
    'Spawnling': 'A fragile pet that bursts for damage when it dies.',
    'Void-Touched': 'Lose ' + (ns.VTOUCH_HP || 3) + ' HP each time this card is played, but its effect is boosted.',
  };

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
      fx: [{ k: 'dmg', v: 3, hits: 2, scale: 'might' }, { k: 'onRoll', min: 15, fx: [{ k: 'dmg', v: 3, scale: 'might' }] }],
      up: { fx: [{ k: 'dmg', v: 3, hits: 3, scale: 'might' }, { k: 'onRoll', min: 13, fx: [{ k: 'dmg', v: 3, scale: 'might' }] }] },
    },
    suppressing_fire: {   // a raking burst — hammers one target, pins it, and carries through the pack
      name: 'Raking Fire', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'special', id: 'cleave', v: 6, splash: 3 }, { k: 'status', s: 'weak', v: 1, who: 'target' }],
      text: 'Deal 6 damage, and 3 to every other enemy.',
      up: { fx: [{ k: 'special', id: 'cleave', v: 8, splash: 5 }, { k: 'status', s: 'weak', v: 2, who: 'target' }], text: 'Deal 8 damage, and 5 to every other enemy.' },
    },
    frag_grenade: {   // AoE setup — chips the pack and cracks their armour for the follow-up
      name: 'Frag Grenade', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 4, all: true, scale: 'might' }, { k: 'status', s: 'vuln', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 6, all: true, scale: 'might' }, { k: 'status', s: 'vuln', v: 2, who: 'allEnemies' }] },
    },
    shield_slam: {
      name: 'Shield Slam', cls: 'vanguard', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'shieldSlam' }],
      text: 'Deal damage equal to your Shield.',
      up: { fx: [{ k: 'special', id: 'shieldSlam15' }], text: 'Deal damage equal to 150% of your Shield.' },
    },
    bulwark: {   // heavy block + tempo (Riot Shield = thorns, Bunker Down = engine)
      name: 'Bulwark', cls: 'vanguard', type: 'skill', rarity: 2, cost: 2,
      fx: [{ k: 'block', v: 12, scale: 'pri' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'block', v: 16, scale: 'pri' }, { k: 'draw', v: 1 }] },
    },
    combat_stims: {   // aggressive Might spike at an HP cost (War Cry = safe Str + draw)
      name: 'Combat Stims', cls: 'vanguard', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'str', v: 3, who: 'self' }, { k: 'hploss', v: 3 }],
      up: { fx: [{ k: 'status', s: 'str', v: 4, who: 'self' }, { k: 'hploss', v: 2 }] },
    },
    adrenal_surge: {
      name: 'Adrenal Surge', cls: 'vanguard', type: 'skill', rarity: 2, cost: 0, exhaust: true,
      fx: [{ k: 'energy', v: 2 }, { k: 'hploss', v: 2 }],
      up: { fx: [{ k: 'energy', v: 2 }] },
    },
    executioner: {
      name: 'Executioner Round', cls: 'vanguard', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 10, scale: 'might' }, { k: 'special', id: 'execute' }],
      text: 'Doubled if the target is below 30% HP.',
      up: { fx: [{ k: 'dmg', v: 14, scale: 'might' }, { k: 'special', id: 'execute' }] },
    },
    orbital_strike: {   // the finisher — flattens the field and leaves the survivors cracked open
      name: 'Orbital Strike', cls: 'vanguard', type: 'attack', rarity: 3, cost: 3,
      fx: [{ k: 'dmg', v: 16, all: true, scale: 'might' }, { k: 'status', s: 'vuln', v: 2, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 22, all: true, scale: 'might' }, { k: 'status', s: 'vuln', v: 3, who: 'allEnemies' }] },
    },
    warlord_protocol: {
      name: 'Warlord Protocol', cls: 'vanguard', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'strPerTurn', v: 1, who: 'self' }],
      up: { cost: 1 },
    },

    /* ---------------- Technomancer ---------------- */
    shock_coil: {   // the tech enabler — a chip that pays for itself in cards (fuels combo turns)
      name: 'Live Wire', cls: 'technomancer', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'tech' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'dmg', v: 8, scale: 'tech' }, { k: 'draw', v: 1 }] },
    },
    fortify_matrix: {
      name: 'Fortify Matrix', cls: 'technomancer', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'block', v: 8, scale: 'tech' }],
      up: { fx: [{ k: 'block', v: 11, scale: 'tech' }] },
    },
    nano_repair: {   // patch up — and if a construct is covering you, bolt on some armour too
      name: 'Repair Bay', cls: 'technomancer', type: 'skill', rarity: 1, cost: 1, exhaust: true,
      fx: [{ k: 'special', id: 'repairBay', v: 4, block: 6 }],
      text: 'Heal 4 HP. Gain 6 Shield if a Turret or Drone is out.',
      up: { fx: [{ k: 'special', id: 'repairBay', v: 7, block: 9 }], text: 'Heal 7 HP. Gain 9 Shield if a Turret or Drone is out.' },
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
    psy_lance: {   // the Psi enabler — every strike sharpens the next (builds Focus)
      name: 'Psi Lance', cls: 'voidadept', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 5, scale: 'psi' }, { k: 'status', s: 'psiPow', v: 1, who: 'self' }],
      up: { fx: [{ k: 'dmg', v: 7, scale: 'psi' }, { k: 'status', s: 'psiPow', v: 1, who: 'self' }] },
    },
    soul_burn: {
      name: 'Soul Burn', cls: 'voidadept', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'burn', v: 4, who: 'target' }],
      up: { fx: [{ k: 'status', s: 'burn', v: 7, who: 'target' }] },
    },
    hex_weave: {   // a concentrated hex on one foe that leaks fire into the whole pack (Ember Storm = flat field-seed + draw)
      name: 'Hex Weave', cls: 'voidadept', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'burn', v: 4, who: 'target' }, { k: 'status', s: 'burn', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'status', s: 'burn', v: 6, who: 'target' }, { k: 'status', s: 'burn', v: 2, who: 'allEnemies' }] },
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
      fx: [{ k: 'status', s: 'feelNoPain', v: 4, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'feelNoPain', v: 5, who: 'self' }] },
    },
    reckless_protocol: {   // BUILD-AROUND — bleed for Might (Blood Rage) AND armour up off your Exhausts (Resolve)
      name: 'Berserker Engine', cls: 'vanguard', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'bloodrage', v: 1, who: 'self' }, { k: 'status', s: 'feelNoPain', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'bloodrage', v: 2, who: 'self' }, { k: 'status', s: 'feelNoPain', v: 2, who: 'self' }] },
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
    cluster_munitions: {   // AoE with bite — strafe the pack and drink back the spillage (Bloodforge sustain)
      name: 'Reaping Volley', cls: 'vanguard', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 5, all: true, scale: 'might' }, { k: 'special', id: 'drain' }],
      up: { fx: [{ k: 'dmg', v: 7, all: true, scale: 'might' }, { k: 'special', id: 'drain' }] },
    },
    bunker_down: {
      name: 'Bunker Down', cls: 'vanguard', type: 'skill', rarity: 2, cost: 2,
      fx: [{ k: 'block', v: 8, scale: 'pri' }, { k: 'status', s: 'platedArmor', v: 3, who: 'self' }],
      up: { fx: [{ k: 'block', v: 12, scale: 'pri' }, { k: 'status', s: 'platedArmor', v: 4, who: 'self' }] },
    },
    // --- new commons: deepen the layer you draft most (each a distinct niche) ---
    shield_bash: {   // the hybrid: only common that hits AND blocks (tempo + survivability)
      name: 'Shield Bash', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'might' }, { k: 'block', v: 4, scale: 'pri' }, { k: 'onRoll', min: 13, fx: [{ k: 'block', v: 4, scale: 'pri' }] }],
      up: { fx: [{ k: 'dmg', v: 8, scale: 'might' }, { k: 'block', v: 6, scale: 'pri' }, { k: 'onRoll', min: 11, fx: [{ k: 'block', v: 5, scale: 'pri' }] }] },
    },
    reckless_charge: {   // 0-cost burst & Exhaust-fuel (feeds Resolve/Salvage/combos)
      name: 'Reckless Charge', cls: 'vanguard', type: 'attack', rarity: 1, cost: 0, exhaust: true,
      fx: [{ k: 'dmg', v: 7, scale: 'might' }],
      up: { fx: [{ k: 'dmg', v: 10, scale: 'might' }] },
    },
    suppressing_barrage: {   // defensive suppression — hunker down while you pin the whole pack
      name: 'Covering Fire', cls: 'vanguard', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'block', v: 6, scale: 'pri' }, { k: 'status', s: 'weak', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'block', v: 9, scale: 'pri' }, { k: 'status', s: 'weak', v: 2, who: 'allEnemies' }] },
    },
    rallying_shout: {   // Might as defence — forge your stacked Strength into a wall
      name: 'Bulwark Stance', cls: 'vanguard', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'str', v: 1, who: 'self' }, { k: 'block', v: 3, scale: 'pri' }, { k: 'special', id: 'forgeBarrier', v: 2 }],
      text: 'Then gain Shield equal to twice your Might.',
      up: { fx: [{ k: 'status', s: 'str', v: 2, who: 'self' }, { k: 'block', v: 4, scale: 'pri' }, { k: 'special', id: 'forgeBarrier', v: 2 }], text: 'Then gain Shield equal to twice your Might.' },
    },
    // --- new rares: each anchors a different Vanguard build ---
    frenzy: {   // the Strength payoff — multi-hit, every hit rides your MIGHT
      name: 'Frenzy', cls: 'vanguard', type: 'attack', rarity: 3, cost: 2,
      fx: [{ k: 'dmg', v: 3, hits: 3, scale: 'might' }],
      up: { fx: [{ k: 'dmg', v: 3, hits: 4, scale: 'might' }] },
    },
    bloodlust: {   // glass-cannon engine: permanent extra energy bought with HP
      name: 'Bloodlust', cls: 'vanguard', type: 'power', rarity: 3, cost: 1,
      fx: [{ k: 'status', s: 'reactor', v: 1, who: 'self' }, { k: 'hploss', v: 6 }],
      up: { fx: [{ k: 'status', s: 'reactor', v: 1, who: 'self' }, { k: 'hploss', v: 3 }] },
    },
    riposte_protocol: {   // turtle-and-punish engine: block becomes offense
      name: 'Riposte Protocol', cls: 'vanguard', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'retaliate', v: 3, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'retaliate', v: 5, who: 'self' }] },
    },
    // --- FUSILLADE: the full-auto tempo engine. Cheap shots build Momentum
    //     (+1 dmg per stack to your attacks, resets each turn); spend it on a payoff. ---
    rapid_fire: {   // ⚡0 chain-starter — cheap shot that gets the Momentum rolling
      name: 'Rapid Fire', cls: 'vanguard', type: 'attack', rarity: 1, cost: 0,
      fx: [{ k: 'dmg', v: 3 }, { k: 'status', s: 'momentum', v: 1, who: 'self' }],
      up: { fx: [{ k: 'dmg', v: 4 }, { k: 'status', s: 'momentum', v: 1, who: 'self' }] },
    },
    trigger_discipline: {   // the draw enabler — keep the chain fed
      name: 'Trigger Discipline', cls: 'vanguard', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'draw', v: 2 }, { k: 'status', s: 'momentum', v: 1, who: 'self' }],
      up: { fx: [{ k: 'draw', v: 2 }, { k: 'status', s: 'momentum', v: 2, who: 'self' }] },
    },
    hail_of_lead: {   // multi-hit payoff — every shot rides your Momentum (and Might)
      name: 'Hail of Lead', cls: 'vanguard', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 2, hits: 3, scale: 'might' }],
      text: 'Each hit also scales with Momentum.',
      up: { fx: [{ k: 'dmg', v: 3, hits: 3, scale: 'might' }] },
    },
    full_auto: {   // the engine anchor — every attack now snowballs Momentum
      name: 'Full Auto', cls: 'vanguard', type: 'power', rarity: 3, cost: 1,
      fx: [{ k: 'status', s: 'fullauto', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'fullauto', v: 2, who: 'self' }] },
    },
    unload: {   // the cashout — dump a turn of built-up Momentum into one hit
      name: 'Unload', cls: 'vanguard', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 4, scale: 'might' }, { k: 'special', id: 'unload', v: 2 }],
      text: 'Deal 2 more damage per Momentum.',
      up: { fx: [{ k: 'dmg', v: 5, scale: 'might' }, { k: 'special', id: 'unload', v: 3 }], text: 'Deal 3 more damage per Momentum.' },
    },
    // --- BLOODFORGE: spend life to stoke Might; defend by parrying (deflect + riposte),
    //     not turtling. Stacked Strength powers your attacks, your parries, and the cashout. ---
    blood_rage: {   // the anchor — every drop of your own blood makes you stronger
      name: 'Blood Rage', cls: 'vanguard', type: 'power', rarity: 3, cost: 1,
      fx: [{ k: 'status', s: 'bloodrage', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'bloodrage', v: 2, who: 'self' }] },
    },
    deflect: {   // the parry stance — Bloodforge's defence, and it bites back
      name: 'Deflect', cls: 'vanguard', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'parry', v: 8, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'parry', v: 11, who: 'self' }] },
    },
    vengeance: {   // the sustain anchor — trade blows and feed on the exchange
      name: 'Vengeance', cls: 'vanguard', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'vengeance', v: 4, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'vengeance', v: 6, who: 'self' }] },
    },
    counterstrike: {   // parry + a jab — defend forward
      name: 'Counterstrike', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 4, scale: 'might' }, { k: 'status', s: 'parry', v: 4, who: 'self' }],
      up: { fx: [{ k: 'dmg', v: 6, scale: 'might' }, { k: 'status', s: 'parry', v: 5, who: 'self' }] },
    },
    crimson_pact: {   // ⚡0 blood-fuelled jab — cheap, and it feeds Blood Rage
      name: 'Crimson Pact', cls: 'vanguard', type: 'attack', rarity: 1, cost: 0,
      fx: [{ k: 'hploss', v: 3 }, { k: 'dmg', v: 6, scale: 'might' }],
      up: { fx: [{ k: 'hploss', v: 2 }, { k: 'dmg', v: 8, scale: 'might' }] },
    },
    whet_the_blade: {   // pure HP -> Might conversion (doubles with Blood Rage)
      name: 'Whet the Blade', cls: 'vanguard', type: 'skill', rarity: 2, cost: 0,
      fx: [{ k: 'hploss', v: 2 }, { k: 'status', s: 'str', v: 2, who: 'self' }],
      up: { fx: [{ k: 'hploss', v: 1 }, { k: 'status', s: 'str', v: 2, who: 'self' }] },
    },
    bloodbath: {   // the cashout — pour all your stacked Might into one brutal blow, and drink deep
      name: 'Bloodbath', cls: 'vanguard', type: 'attack', rarity: 3, cost: 2,
      fx: [{ k: 'special', id: 'bloodbath', v: 5 }, { k: 'special', id: 'drain' }],
      up: { fx: [{ k: 'special', id: 'bloodbath', v: 6 }, { k: 'special', id: 'drain' }] },
    },
    // --- BANDOLIER: heavy ordnance, spent & reloaded. Big shots Exhaust (spent
    //     shells); payoffs reward spending them; Reload racks them back. ---
    salvo: {   // the anchor — every spent shell detonates
      name: 'Salvo', cls: 'vanguard', type: 'power', rarity: 3, cost: 1,
      fx: [{ k: 'status', s: 'salvo', v: 4, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'salvo', v: 6, who: 'self' }] },
    },
    reload: {   // the reuse engine — rack a spent shell back into the chamber
      name: 'Reload', cls: 'vanguard', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'reload' }, { k: 'draw', v: 1 }],
      text: 'Return a random exhausted Attack to your hand.',
      up: { cost: 0, fx: [{ k: 'special', id: 'reload' }, { k: 'draw', v: 1 }], text: 'Return a random exhausted Attack to your hand.' },
    },
    quartermaster: {   // the restock anchor — a self-feeding reload loop
      name: 'Quartermaster', cls: 'vanguard', type: 'power', rarity: 3, cost: 1,
      fx: [{ k: 'status', s: 'restock', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'restock', v: 2, who: 'self' }] },
    },
    breaching_charge: {   // a heavy shell — big single shot, spent on firing
      name: 'Breaching Charge', cls: 'vanguard', type: 'attack', rarity: 1, cost: 1, exhaust: true,
      fx: [{ k: 'dmg', v: 11, scale: 'might' }, { k: 'onRoll', min: 16, fx: [{ k: 'draw', v: 1 }] }],
      up: { fx: [{ k: 'dmg', v: 15, scale: 'might' }, { k: 'onRoll', min: 14, fx: [{ k: 'draw', v: 1 }] }] },
    },
    field_strip: {   // cheap exhaust-fuel — cycles and feeds the spent-shell payoffs
      name: 'Field Strip', cls: 'vanguard', type: 'skill', rarity: 1, cost: 0, exhaust: true,
      fx: [{ k: 'draw', v: 2 }],
      up: { fx: [{ k: 'draw', v: 3 }] },
    },
    cluster_charge: {   // an AoE shell
      name: 'Cluster Charge', cls: 'vanguard', type: 'attack', rarity: 2, cost: 1, exhaust: true,
      fx: [{ k: 'dmg', v: 5, all: true, scale: 'might' }],
      up: { fx: [{ k: 'dmg', v: 7, all: true, scale: 'might' }] },
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
    wither: {   // a burn PAYOFF that doesn't consume — cash the stack while the fire keeps burning
      name: 'Parch', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'parch' }],
      text: "Deal damage equal to the target's Burn. It is not consumed.",
      up: { fx: [{ k: 'status', s: 'burn', v: 2, who: 'target' }, { k: 'special', id: 'parch' }], text: "Deal damage equal to the target's Burn. It is not consumed." },
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
      text: 'Exhaust your hand. Deal 6 damage per card Exhausted.',
      up: { fx: [{ k: 'special', id: 'fiendFire', v: 9 }], text: 'Exhaust your hand. Deal 9 damage per card Exhausted.' },
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
    drone_swarm: {   // an AoE turret — strafes every enemy (Deploy Turret hits one)
      name: 'Drone Swarm', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'drone', v: 4, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'drone', v: 6, who: 'self' }] },
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
      up: { fx: [{ k: 'hploss', v: 3 }, { k: 'dmg', v: 14, scale: 'psi' }, { k: 'special', id: 'drain' }] },
    },
    void_siphon: {   // the class's only AoE — drains life from the whole field
      name: 'Void Siphon', cls: 'voidadept', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 4, scale: 'psi', all: true }, { k: 'special', id: 'drain' }],
      up: { fx: [{ k: 'dmg', v: 6, scale: 'psi', all: true }, { k: 'special', id: 'drain' }] },
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
    hemorrhage: {   // bleed for tempo — and if the die was already hungry, the
                    // void takes the offering and pays you back in Psi.
      name: 'Hemorrhage', cls: 'voidadept', type: 'skill', rarity: 1, cost: 0, exhaust: true,
      fx: [{ k: 'hploss', v: 2 }, { k: 'energy', v: 2 }, { k: 'onRoll', max: 6, fx: [{ k: 'status', s: 'psiPow', v: 2, who: 'self' }] }],
      up: { fx: [{ k: 'hploss', v: 1 }, { k: 'energy', v: 2 }, { k: 'onRoll', max: 7, fx: [{ k: 'status', s: 'psiPow', v: 2, who: 'self' }] }] },
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
    /* ---------------- THE FIRST MARK ----------------
     * One of these comes down with you, chosen at the mouth of the Spire
     * alongside the engraving it belongs to (see ns.FIRST_MARKS in dice.js).
     * `pool: 'mark'` keeps them out of every reward and shop, so the one you
     * pick stays the only one you will see all run.
     *
     * None of them is a big number. Each one turns a pile of cards you might
     * otherwise never draft into a plan — they are archetype seeds, and they
     * are deliberately weak on their own.
     * ---------------------------------------------- */
    sighting_round: {   // MARKSMANSHIP: a free shot that climbs the table
      name: 'Sighting Round', cls: 'vanguard', type: 'attack', rarity: 2, pool: 'mark', cost: 0, retain: true,
      fx: [{ k: 'dmg', v: 4, scale: 'might' }, { k: 'status', s: 'aim', v: 1, who: 'self' }],
      up: { fx: [{ k: 'dmg', v: 6, scale: 'might' }, { k: 'status', s: 'aim', v: 1, who: 'self' }] },
    },
    red_ledger: {   // MIGHT/BLOOD: every HP you spend on yourself is paid back
      name: 'Red Ledger', cls: 'vanguard', type: 'power', rarity: 2, pool: 'mark', cost: 1,
      fx: [{ k: 'hploss', v: 3 }, { k: 'status', s: 'str', v: 2, who: 'self' }, { k: 'status', s: 'bloodrage', v: 2, who: 'self' }],
      up: { fx: [{ k: 'hploss', v: 3 }, { k: 'status', s: 'str', v: 3, who: 'self' }, { k: 'status', s: 'bloodrage', v: 3, who: 'self' }] },
    },
    set_against_it: {   // BLOCK/THORNS: turn the turtle into a hazard
      name: 'Set Against It', cls: 'vanguard', type: 'power', rarity: 2, pool: 'mark', cost: 1,
      fx: [{ k: 'status', s: 'thorns', v: 2, who: 'self' }, { k: 'status', s: 'plate', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'thorns', v: 4, who: 'self' }, { k: 'status', s: 'plate', v: 3, who: 'self' }] },
    },

    assembly_line: {   // CONSTRUCTS: one turret, and everything fires twice
      name: 'Assembly Line', cls: 'technomancer', type: 'power', rarity: 2, pool: 'mark', cost: 1,
      fx: [{ k: 'status', s: 'turret', v: 2, who: 'self' }, { k: 'status', s: 'hive', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'turret', v: 3, who: 'self' }, { k: 'status', s: 'hive', v: 1, who: 'self' }] },
    },
    surge_routing: {   // POWER: Powers pay for themselves
      name: 'Surge Routing', cls: 'technomancer', type: 'power', rarity: 2, pool: 'mark', cost: 1,
      fx: [{ k: 'status', s: 'reactor', v: 1, who: 'self' }, { k: 'status', s: 'subroutine', v: 1, who: 'self' }],
      text: 'Whenever you play a Power, draw a card.',
      up: { fx: [{ k: 'status', s: 'reactor', v: 1, who: 'self' }, { k: 'status', s: 'subroutine', v: 2, who: 'self' }],
            text: 'Whenever you play a Power, draw 2 cards.' },
    },
    null_lattice: {   // CONTROL: every hex you apply also bites
      name: 'Null Lattice', cls: 'technomancer', type: 'power', rarity: 2, pool: 'mark', cost: 1,
      fx: [{ k: 'status', s: 'conduit', v: 1, who: 'self' }, { k: 'status', s: 'plate', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'conduit', v: 2, who: 'self' }, { k: 'status', s: 'plate', v: 2, who: 'self' }] },
    },

    kindling: {   // BURN: the field is alight from turn one
      name: 'Kindling', cls: 'voidadept', type: 'power', rarity: 2, pool: 'mark', cost: 1,
      fx: [{ k: 'status', s: 'entropy', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'entropy', v: 3, who: 'self' }] },
    },
    red_thread: {   // BLOOD: what the void takes, it pays interest on
      name: 'Red Thread', cls: 'voidadept', type: 'power', rarity: 2, pool: 'mark', cost: 1,
      fx: [{ k: 'status', s: 'bloodPact', v: 2, who: 'self' }, { k: 'status', s: 'psiPow', v: 2, who: 'self' }, { k: 'status', s: 'regen', v: 3, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'bloodPact', v: 3, who: 'self' }, { k: 'status', s: 'psiPow', v: 3, who: 'self' }, { k: 'status', s: 'regen', v: 4, who: 'self' }] },
    },
    long_whisper: {   // PSI/CONTROL: the ramp, and a reason to hex
      name: 'Long Whisper', cls: 'voidadept', type: 'power', rarity: 2, pool: 'mark', cost: 1,
      fx: [{ k: 'status', s: 'psiRamp', v: 1, who: 'self' }, { k: 'status', s: 'conduit', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'psiRamp', v: 2, who: 'self' }, { k: 'status', s: 'conduit', v: 1, who: 'self' }] },
    },

    forbidden_lore: {
      name: 'Forbidden Lore', cls: 'any', type: 'skill', rarity: 3, pool: 'event', cost: 1, exhaust: true,
      fx: [{ k: 'draw', v: 3 }, { k: 'status', s: 'psiPow', v: 1, who: 'self' }],
      up: { fx: [{ k: 'draw', v: 4 }, { k: 'status', s: 'psiPow', v: 1, who: 'self' }] },
    },

    /* ============ TECHNOMANCER — archetype overhaul (4 cross-feeding lines) ============
     * FORTRESS   — stack Shield/Plating and cash it into damage (Slam payoffs).
     * CONSTRUCTS — deploy Turrets & Drones; Hive Protocol makes the whole board fire twice.
     * OVERCHARGE — Energy & Echo engines that let you chain a huge turn.
     * DISRUPTION — field-wide Weak/Vulnerable; Conduit turns every debuff into a jolt of damage.
     * ------------------------------------------------------------------------------------ */

    /* -- FORTRESS -- */
    reinforced_hull: {   // Plated Armor engine — Shield that regenerates each turn
      name: 'Reinforced Hull', cls: 'technomancer', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'platedArmor', v: 3, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'platedArmor', v: 4, who: 'self' }] },
    },
    hold_the_line: {   // a kept guard — bank Shield for a Slam next turn
      name: 'Hold the Line', cls: 'technomancer', type: 'skill', rarity: 1, cost: 1, retain: true,
      fx: [{ k: 'block', v: 7, scale: 'tech' }],
      up: { fx: [{ k: 'block', v: 10, scale: 'tech' }] },
    },
    fortified_strike: {   // the defensive hybrid — mostly brace, a little punch (Arc Welder leans the other way)
      name: 'Fortified Strike', cls: 'technomancer', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 5, scale: 'tech' }, { k: 'block', v: 9, scale: 'tech' }],
      up: { fx: [{ k: 'dmg', v: 7, scale: 'tech' }, { k: 'block', v: 12, scale: 'tech' }] },
    },
    aegis_matrix: {   // BUILD-AROUND — your Shield stops expiring; stack it forever
      name: 'Aegis Matrix', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'barricade', v: 1, who: 'self' }],
      up: { cost: 1, fx: [{ k: 'status', s: 'barricade', v: 1, who: 'self' }] },
    },

    /* -- CONSTRUCTS -- */
    hive_protocol: {   // BUILD-AROUND — every construct fires an extra time each turn
      name: 'Hive Protocol', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'hive', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'hive', v: 2, who: 'self' }] },
    },
    assault_drone: {   // a cheap starter construct — small swarm to get the board rolling (Drone Swarm = the heavy one)
      name: 'Assault Drone', cls: 'technomancer', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'drone', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'drone', v: 3, who: 'self' }] },
    },
    mortar_array: {   // one heavy single-target turret
      name: 'Mortar Array', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'turret', v: 8, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'turret', v: 11, who: 'self' }] },
    },
    targeting_uplink: {   // construct enabler — deploy a small turret and keep drawing
      name: 'Targeting Uplink', cls: 'technomancer', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'turret', v: 2, who: 'self' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'status', s: 'turret', v: 3, who: 'self' }, { k: 'draw', v: 1 }] },
    },
    salvage_servitor: {   // chip now, board later
      name: 'Salvage Servitor', cls: 'technomancer', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 5, scale: 'tech' }, { k: 'status', s: 'turret', v: 1, who: 'self' }],
      up: { fx: [{ k: 'dmg', v: 7, scale: 'tech' }, { k: 'status', s: 'turret', v: 2, who: 'self' }] },
    },
    munitions_factory: {   // a balanced board — one turret, one drone
      name: 'Munitions Factory', cls: 'technomancer', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'turret', v: 2, who: 'self' }, { k: 'status', s: 'drone', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'turret', v: 3, who: 'self' }, { k: 'status', s: 'drone', v: 3, who: 'self' }] },
    },

    /* -- OVERCHARGE -- */
    flux_capacitor: {   // overclocked core — double the Energy of Aux Reactor, paid for in integrity
      name: 'Flux Capacitor', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'reactor', v: 2, who: 'self' }, { k: 'hploss', v: 5 }],
      up: { fx: [{ k: 'status', s: 'reactor', v: 2, who: 'self' }, { k: 'hploss', v: 3 }] },
    },
    surge_protocol: {   // dig deep into a power-turn — and cash in a real SURGE
      name: 'Surge Protocol', cls: 'technomancer', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'energy', v: 1 }, { k: 'draw', v: 2 }, { k: 'onRoll', min: 15, fx: [{ k: 'energy', v: 1 }] }],
      up: { fx: [{ k: 'energy', v: 2 }, { k: 'draw', v: 2 }, { k: 'onRoll', min: 13, fx: [{ k: 'energy', v: 1 }] }] },
    },
    capacitor_discharge: {   // cheap tempo attack that refunds itself
      name: 'Capacitor Discharge', cls: 'technomancer', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'tech' }, { k: 'energy', v: 1 }],
      up: { fx: [{ k: 'dmg', v: 9, scale: 'tech' }, { k: 'energy', v: 1 }] },
    },
    recompile: {   // ⚡0 cantrip that RECALIBRATES: the worse the reactor sagged,
                   // the more the machine steers. The Technomancer's only route
                   // to Aim, and it self-corrects — a bad face buys the fix.
      name: 'Recompile', cls: 'technomancer', type: 'skill', rarity: 1, cost: 0,
      fx: [{ k: 'energy', v: 1 }, { k: 'draw', v: 1 }, { k: 'onRoll', max: 7, fx: [{ k: 'status', s: 'aim', v: 1, who: 'self' }] }],
      up: { fx: [{ k: 'energy', v: 1 }, { k: 'draw', v: 2 }, { k: 'onRoll', max: 9, fx: [{ k: 'status', s: 'aim', v: 1, who: 'self' }] }] },
    },
    singularity_drive: {   // BUILD-AROUND — repeat your first Attack and bank Energy
      name: 'Singularity Drive', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'echo', v: 1, who: 'self' }, { k: 'status', s: 'reactor', v: 1, who: 'self' }],
      up: { cost: 1, fx: [{ k: 'status', s: 'echo', v: 1, who: 'self' }, { k: 'status', s: 'reactor', v: 1, who: 'self' }] },
    },

    /* -- DISRUPTION -- */
    tesla_conduit: {   // BUILD-AROUND — every debuff you apply arcs for damage
      name: 'Tesla Conduit', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'conduit', v: 5, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'conduit', v: 7, who: 'self' }] },
    },
    overcharged_capacitor: {   // OVERCHARGE filler payoff — a cheap repeatable jolt that loves Echo
      name: 'Overcharged Capacitor', cls: 'technomancer', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 4, hits: 2, scale: 'tech' }],
      text: 'Doubles under Echo.',
      up: { fx: [{ k: 'dmg', v: 6, hits: 2, scale: 'tech' }] },
    },
    disruptor_pulse: {   // cheap enabler — chip + a Weak to trip the Conduit
      name: 'Disruptor Pulse', cls: 'technomancer', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 4, scale: 'tech' }, { k: 'status', s: 'weak', v: 1, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 6, scale: 'tech' }, { k: 'status', s: 'weak', v: 2, who: 'target' }] },
    },
    short_circuit: {   // strike + a heavy Vulnerable (double-dips with Conduit)
      name: 'Short Circuit', cls: 'technomancer', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 5, scale: 'tech' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 7, scale: 'tech' }, { k: 'status', s: 'vuln', v: 3, who: 'target' }] },
    },
    system_shock: {   // mass debuff — lights up the whole field for the Conduit
      name: 'System Shock', cls: 'technomancer', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'weak', v: 1, who: 'allEnemies' }, { k: 'status', s: 'vuln', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'status', s: 'weak', v: 2, who: 'allEnemies' }, { k: 'status', s: 'vuln', v: 1, who: 'allEnemies' }] },
    },
    feedback_loop: {   // control cantrip — soften and cycle
      name: 'Feedback Loop', cls: 'technomancer', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'status', s: 'vuln', v: 2, who: 'target' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'status', s: 'vuln', v: 3, who: 'target' }, { k: 'draw', v: 1 }] },
    },
    ion_storm: {   // the Disruption payoff — paints the whole field with BOTH debuffs (double Conduit arc)
      name: 'Ion Storm', cls: 'technomancer', type: 'attack', rarity: 3, cost: 2,
      fx: [{ k: 'dmg', v: 5, all: true, scale: 'tech' }, { k: 'status', s: 'weak', v: 1, who: 'allEnemies' }, { k: 'status', s: 'vuln', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 7, all: true, scale: 'tech' }, { k: 'status', s: 'weak', v: 2, who: 'allEnemies' }, { k: 'status', s: 'vuln', v: 1, who: 'allEnemies' }] },
    },
    emp_mine: {   // ⚡0 exhaust enabler — a cheap field-wide jolt
      name: 'EMP Mine', cls: 'technomancer', type: 'attack', rarity: 1, cost: 0, exhaust: true,
      fx: [{ k: 'dmg', v: 3, all: true, scale: 'tech' }, { k: 'status', s: 'weak', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 4, all: true, scale: 'tech' }, { k: 'status', s: 'weak', v: 1, who: 'allEnemies' }] },
    },
    overload_surge: {   // Disruption payoff — hit one target with BOTH debuffs (double Conduit arc)
      name: 'Overload Surge', cls: 'technomancer', type: 'attack', rarity: 2, cost: 2,
      fx: [{ k: 'dmg', v: 6, scale: 'tech' }, { k: 'status', s: 'weak', v: 2, who: 'target' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 9, scale: 'tech' }, { k: 'status', s: 'weak', v: 3, who: 'target' }, { k: 'status', s: 'vuln', v: 3, who: 'target' }] },
    },

    /* ============ VOID ADEPT — archetype overhaul (4 cross-feeding lines) ============
     * AFFLICTION  — seed Burn, then DETONATE it for burst; Wildfire makes Burn snowball.
     * PSI FOCUS   — stack Psi Focus and scale every psychic strike; Ascendant Mind ramps it.
     * HEMORRHAGE  — pay HP for tempo & power (feeds Blood Pact / drain sustain).
     * VOID/ENTROPY— field-wide debuffs + spam payoffs (Vulnerable/Weak feed reap & detonate).
     * ------------------------------------------------------------------------------------ */

    /* -- AFFLICTION -- */
    immolate: {   // cheap enabler — chip + a Burn stack to build on
      name: 'Immolate', cls: 'voidadept', type: 'attack', rarity: 1, cost: 1,
      fx: [{ k: 'dmg', v: 3, scale: 'psi' }, { k: 'status', s: 'burn', v: 3, who: 'target' }],
      up: { fx: [{ k: 'dmg', v: 4, scale: 'psi' }, { k: 'status', s: 'burn', v: 5, who: 'target' }] },
    },
    cinder_burst: {   // the Detonate payoff — cash a Burn stack in for a burst
      name: 'Cinder Burst', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'detonate', v: 2 }],
      text: "Detonate the target's Burn for 200% damage.",
      up: { fx: [{ k: 'special', id: 'detonate', v: 2.5 }], text: "Detonate the target's Burn for 250% damage." },
    },
    ember_storm: {   // field seed — Burn everything and keep the hand flowing
      name: 'Ember Storm', cls: 'voidadept', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'burn', v: 2, who: 'allEnemies' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'status', s: 'burn', v: 3, who: 'allEnemies' }, { k: 'draw', v: 1 }] },
    },
    wildfire_engine: {   // BUILD-AROUND — Burn stops decaying and starts spreading
      name: 'Wildfire Engine', cls: 'voidadept', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'wildfire', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'wildfire', v: 2, who: 'self' }] },
    },
    conflagration: {   // the heavy Detonate — pay big, blow the whole stack
      name: 'Conflagration', cls: 'voidadept', type: 'attack', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'burn', v: 5, who: 'target' }, { k: 'special', id: 'detonate', v: 2 }],
      text: 'Then Detonate it all for 200% damage.',
      up: { fx: [{ k: 'status', s: 'burn', v: 8, who: 'target' }, { k: 'special', id: 'detonate', v: 2.5 }], text: 'Then Detonate it all for 250% damage.' },
    },

    /* -- PSI FOCUS -- */
    ascendant_mind: {   // BUILD-AROUND — Psi Focus that climbs on its own every turn
      name: 'Ascendant Mind', cls: 'voidadept', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'psiRamp', v: 2, who: 'self' }, { k: 'status', s: 'psiPow', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'psiRamp', v: 3, who: 'self' }, { k: 'status', s: 'psiPow', v: 2, who: 'self' }] },
    },
    mind_lance: {   // multi-hit psi payoff — every shard rides your Focus
      name: 'Mind Lance', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 4, hits: 2, scale: 'psi' }],
      text: 'Both hits are boosted by your Psi Focus.',
      up: { fx: [{ k: 'dmg', v: 5, hits: 2, scale: 'psi' }] },
    },
    cerebral_spike: {   // the budget psi-scaler — cheap, and your Focus still counts twice (Tk Crush = the heavy version)
      name: 'Cerebral Spike', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 4, scale: 'psi', scaleMul: 2 }],
      text: 'Your Psi Focus counts twice.',
      up: { fx: [{ k: 'dmg', v: 6, scale: 'psi', scaleMul: 2 }] },
    },
    psionic_nova: {   // the psi AoE — scales with Focus across the whole field
      name: 'Psionic Nova', cls: 'voidadept', type: 'attack', rarity: 3, cost: 2,
      fx: [{ k: 'dmg', v: 5, all: true, scale: 'psi' }],
      up: { fx: [{ k: 'dmg', v: 8, all: true, scale: 'psi' }] },
    },

    /* -- HEMORRHAGE -- */
    bloodletting: {   // cheap blood-cantrip — bleed for a card and a little Shield
      name: 'Bloodletting', cls: 'voidadept', type: 'skill', rarity: 1, cost: 0,
      fx: [{ k: 'hploss', v: 2 }, { k: 'draw', v: 1 }, { k: 'block', v: 3 }],
      up: { fx: [{ k: 'hploss', v: 1 }, { k: 'draw', v: 1 }, { k: 'block', v: 5 }] },
    },
    crimson_rite: {   // a bleeding strike that marks the prey — smaller than Exsanguinate, but it sets up the kill
      name: 'Crimson Rite', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'hploss', v: 2 }, { k: 'dmg', v: 5, scale: 'psi' }, { k: 'status', s: 'vuln', v: 2, who: 'target' }, { k: 'special', id: 'drain' }],
      up: { fx: [{ k: 'hploss', v: 2 }, { k: 'dmg', v: 7, scale: 'psi' }, { k: 'status', s: 'vuln', v: 3, who: 'target' }, { k: 'special', id: 'drain' }] },
    },

    /* -- VOID / ENTROPY -- */
    void_rupture: {   // AoE control — soften the whole pack for reap & detonate
      name: 'Void Rupture', cls: 'voidadept', type: 'attack', rarity: 3, cost: 2,
      fx: [{ k: 'dmg', v: 4, all: true, scale: 'psi' }, { k: 'status', s: 'vuln', v: 2, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 6, all: true, scale: 'psi' }, { k: 'status', s: 'vuln', v: 2, who: 'allEnemies' }] },
    },
    null_field: {   // pure field control — stacks the debuffs reap/breach feed on
      name: 'Null Field', cls: 'voidadept', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'weak', v: 2, who: 'allEnemies' }, { k: 'status', s: 'vuln', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'status', s: 'weak', v: 2, who: 'allEnemies' }, { k: 'status', s: 'vuln', v: 2, who: 'allEnemies' }] },
    },
    dread_whisper: {   // cross-feeder — control + Focus + a card (Psi <-> Void glue)
      name: 'Dread Whisper', cls: 'voidadept', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'vuln', v: 2, who: 'target' }, { k: 'status', s: 'psiPow', v: 1, who: 'self' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'status', s: 'vuln', v: 3, who: 'target' }, { k: 'status', s: 'psiPow', v: 2, who: 'self' }, { k: 'draw', v: 1 }] },
    },

    /* ---- Void Adept depth: cross-feeders & a fuller Hemorrhage line ---- */
    vital_lance: {   // pay a little life for a big psychic strike (Hemorrhage)
      name: 'Vital Lance', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'hploss', v: 2 }, { k: 'dmg', v: 8, scale: 'psi' }],
      up: { fx: [{ k: 'hploss', v: 2 }, { k: 'dmg', v: 11, scale: 'psi' }] },
    },
    sanguine_ward: {   // bleed for a heavy ward — Hemorrhage's defence, feeds Blood Pact
      name: 'Sanguine Ward', cls: 'voidadept', type: 'skill', rarity: 1, cost: 1,
      fx: [{ k: 'hploss', v: 2 }, { k: 'block', v: 8 }],
      up: { fx: [{ k: 'hploss', v: 1 }, { k: 'block', v: 11 }] },
    },
    martyrs_gift: {   // BUILD-AROUND — bleed becomes Psi Focus AND that Focus climbs each turn
      name: "Martyr's Gift", cls: 'voidadept', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'bloodPact', v: 1, who: 'self' }, { k: 'status', s: 'psiRamp', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'bloodPact', v: 1, who: 'self' }, { k: 'status', s: 'psiRamp', v: 2, who: 'self' }] },
    },
    mind_burn: {   // a blast that scales with how WIDE your fire has spread (every Burning foe)
      name: 'Soulflare', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'soulflare', v: 4 }],
      text: 'Deal 4 damage to every Burning enemy.',
      up: { fx: [{ k: 'special', id: 'soulflare', v: 6 }], text: 'Deal 6 damage to every Burning enemy.' },
    },
    entropic_lash: {   // a strike that seeds the whole field with fire (Affliction enabler)
      name: 'Entropic Lash', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 5, scale: 'psi' }, { k: 'status', s: 'burn', v: 2, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 7, scale: 'psi' }, { k: 'status', s: 'burn', v: 3, who: 'allEnemies' }] },
    },
    dimensional_rift: {   // single-target control payoff — crack one open and dig for more
      name: 'Dimensional Rift', cls: 'voidadept', type: 'attack', rarity: 3, cost: 2,
      fx: [{ k: 'dmg', v: 6, scale: 'psi' }, { k: 'status', s: 'vuln', v: 3, who: 'target' }, { k: 'draw', v: 1 }],
      up: { fx: [{ k: 'dmg', v: 9, scale: 'psi' }, { k: 'status', s: 'vuln', v: 4, who: 'target' }, { k: 'draw', v: 1 }] },
    },
    psionic_scream: {   // Psi AoE control — soften the whole pack with the mind
      name: 'Psionic Scream', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 4, all: true, scale: 'psi' }, { k: 'status', s: 'weak', v: 1, who: 'allEnemies' }],
      up: { fx: [{ k: 'dmg', v: 6, all: true, scale: 'psi' }, { k: 'status', s: 'weak', v: 2, who: 'allEnemies' }] },
    },
    spectral_grasp: {   // tempo control that reads BOTH ends of the Hunger: the
                        // void grips harder when the die is at an extreme, and
                        // lets go in the middle where it is bored.
      name: 'Spectral Grasp', cls: 'voidadept', type: 'skill', rarity: 1, cost: 0,
      fx: [{ k: 'status', s: 'weak', v: 1, who: 'target' }, { k: 'status', s: 'vuln', v: 1, who: 'target' },
           { k: 'onRoll', min: 15, max: 6, fx: [{ k: 'status', s: 'weak', v: 1, who: 'target' }, { k: 'status', s: 'vuln', v: 1, who: 'target' }] }],
      up: { fx: [{ k: 'status', s: 'weak', v: 2, who: 'target' }, { k: 'status', s: 'vuln', v: 2, who: 'target' },
           { k: 'onRoll', min: 13, max: 7, fx: [{ k: 'status', s: 'weak', v: 1, who: 'target' }, { k: 'status', s: 'vuln', v: 1, who: 'target' }] }] },
    },

    /* ============ VANGUARD — MARKSMAN: the d20 as a resource ============
     * Aim is added to every attack roll, so the die stops being a 5% lottery and
     * becomes something you build. Cards read the roll at thresholds, crits pay
     * out, and even a misfire can be turned into fuel.
     * ------------------------------------------------------------------------ */
    take_aim: {   // the cheap enabler — bank Aim for the shots that follow
      name: 'Take Aim', cls: 'vanguard', type: 'skill', rarity: 1, cost: 0,
      fx: [{ k: 'status', s: 'aim', v: 2, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'aim', v: 3, who: 'self' }] },
    },
    steady_aim: {   // the engine — marksmanship sharpens on its own every turn
      name: 'Steady Aim', cls: 'vanguard', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'aimPerTurn', v: 1, who: 'self' }, { k: 'status', s: 'aim', v: 1, who: 'self' }],
      text: 'Gain 1 more Aim at the start of each turn.',
      up: { fx: [{ k: 'status', s: 'aimPerTurn', v: 2, who: 'self' }, { k: 'status', s: 'aim', v: 1, who: 'self' }], text: 'Gain 2 more Aim at the start of each turn.' },
    },
    marksman_round: {   // a shot that rewards a good roll with a cracked-open target
      name: 'Marksman Round', cls: 'vanguard', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'dmg', v: 6, scale: 'might' },
           { k: 'onRoll', min: 14, fx: [{ k: 'status', s: 'vuln', v: 2, who: 'target' }, { k: 'draw', v: 1 }] }],
      up: { fx: [{ k: 'dmg', v: 8, scale: 'might' }, { k: 'onRoll', min: 12, fx: [{ k: 'status', s: 'vuln', v: 2, who: 'target' }, { k: 'draw', v: 1 }] }] },
    },
    hair_trigger: {   // ⚡0 chip that pays for itself when the die runs hot
      name: 'Hair Trigger', cls: 'vanguard', type: 'attack', rarity: 1, cost: 0,
      fx: [{ k: 'dmg', v: 4, scale: 'might' }, { k: 'onRoll', min: 13, fx: [{ k: 'energy', v: 1 }] }],
      up: { fx: [{ k: 'dmg', v: 6, scale: 'might' }, { k: 'onRoll', min: 11, fx: [{ k: 'energy', v: 1 }] }] },
    },
    deadeye_protocol: {   // BUILD-AROUND — every crit feeds the next one
      name: 'Deadeye Protocol', cls: 'vanguard', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'critFury', v: 2, who: 'self' }, { k: 'status', s: 'deadeyeDraw', v: 1, who: 'self' }],
      up: { fx: [{ k: 'status', s: 'critFury', v: 3, who: 'self' }, { k: 'status', s: 'deadeyeDraw', v: 1, who: 'self' }] },
    },
    misfire_protocol: {   // BUILD-AROUND — a jammed round becomes momentum
      name: 'Misfire Protocol', cls: 'vanguard', type: 'power', rarity: 2, cost: 1,
      fx: [{ k: 'status', s: 'misfireGuard', v: 3, who: 'self' }],
      text: 'When an attack misfires, gain 3 Momentum and 1 Energy.',
      up: { fx: [{ k: 'status', s: 'misfireGuard', v: 5, who: 'self' }], text: 'When an attack misfires, gain 5 Momentum and 1 Energy.' },
    },
    killshot: {   // the cashout — dump every point of banked Aim into one round
      name: 'Killshot', cls: 'vanguard', type: 'attack', rarity: 3, cost: 2,
      fx: [{ k: 'special', id: 'spendAim', base: 6, v: 4 }],
      text: 'Consume all your Aim. Deal 6 damage plus 4 for each Aim consumed.',
      up: { fx: [{ k: 'special', id: 'spendAim', base: 8, v: 5 }], text: 'Consume all your Aim. Deal 8 damage plus 5 for each Aim consumed.' },
    },

    /* ============ MECHANICALLY-DISTINCT cards — new verbs, not new numbers ============
     * Reactive WARDS (punish attackers), CONVERSIONS (turn one resource into another),
     * and TRIGGERS (whenever you do X, also Y). These make an archetype PLAY differently
     * instead of restating "apply Burn / deal damage" with new numbers.
     * --------------------------------------------------------------------------------- */

    /* -- Voidadept -- */
    ember_ward: {   // tanky Burn — let them break on you and catch fire doing it
      name: 'Ember Ward', cls: 'voidadept', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'block', v: 8 }, { k: 'status', s: 'emberward', v: 2, who: 'self' }],
      text: 'This combat, enemies that attack you gain 2 Burn.',
      up: { fx: [{ k: 'block', v: 11 }, { k: 'status', s: 'emberward', v: 3, who: 'self' }], text: 'This combat, enemies that attack you gain 3 Burn.' },
    },
    backdraft: {   // vent the wall — turn your Shield into a fire on one foe (then Detonate it)
      name: 'Backdraft', cls: 'voidadept', type: 'attack', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'backdraft', v: 1 }],
      text: 'Lose all your Shield. Apply that much Burn to the target.',
      up: { fx: [{ k: 'special', id: 'backdraft', v: 1.5 }], text: 'Lose all your Shield. Apply 150% of it as Burn to the target.' },
    },
    mind_bulwark: {   // psi as defence — your Focus becomes a wall
      name: 'Mind Bulwark', cls: 'voidadept', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'special', id: 'psiBarrier', v: 2 }],
      text: 'Gain Shield equal to twice your Psi Focus.',
      up: { fx: [{ k: 'special', id: 'psiBarrier', v: 3 }], text: 'Gain Shield equal to three times your Psi Focus.' },
    },

    /* -- Technomancer -- */
    static_ward: {   // defensive Disruption — attackers Weaken themselves (and trip the Conduit)
      name: 'Static Ward', cls: 'technomancer', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'block', v: 6, scale: 'tech' }, { k: 'status', s: 'staticward', v: 2, who: 'self' }],
      text: 'This combat, enemies that attack you gain 2 Weak.',
      up: { fx: [{ k: 'block', v: 9, scale: 'tech' }, { k: 'status', s: 'staticward', v: 2, who: 'self' }] },
    },
    swarm_uplink: {   // BUILD-AROUND — your constructs shield you every time they fire
      name: 'Swarm Uplink', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'aegisLink', v: 2, who: 'self' }],
      text: 'Whenever one of your constructs fires, gain 2 Shield.',
      up: { fx: [{ k: 'status', s: 'aegisLink', v: 3, who: 'self' }], text: 'Whenever one of your constructs fires, gain 3 Shield.' },
    },
    subroutine: {   // BUILD-AROUND — a power-heavy deck becomes a draw engine
      name: 'Subroutine', cls: 'technomancer', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'subroutine', v: 1, who: 'self' }],
      text: 'Whenever you play a Power, draw a card.',
      up: { cost: 1, fx: [{ k: 'status', s: 'subroutine', v: 1, who: 'self' }], text: 'Whenever you play a Power, draw a card.' },
    },

    /* -- Vanguard -- */
    spiked_bulwark: {   // a turtle that bites — attackers gore themselves on your Might
      name: 'Spiked Bulwark', cls: 'vanguard', type: 'skill', rarity: 2, cost: 1,
      fx: [{ k: 'block', v: 8, scale: 'pri' }, { k: 'status', s: 'spikeward', v: 3, who: 'self' }],
      text: 'This combat, attackers take your Might + 3 damage.',
      up: { fx: [{ k: 'block', v: 11, scale: 'pri' }, { k: 'status', s: 'spikeward', v: 5, who: 'self' }], text: 'This combat, attackers take your Might + 5 damage.' },
    },
    demolition_train: {   // BUILD-AROUND — every spent shell shrapnels the whole pack
      name: 'Demolition Train', cls: 'vanguard', type: 'power', rarity: 3, cost: 2,
      fx: [{ k: 'status', s: 'demoCharge', v: 4, who: 'self' }],
      text: 'Whenever you Exhaust a card, deal 4 damage to ALL enemies.',
      up: { fx: [{ k: 'status', s: 'demoCharge', v: 6, who: 'self' }], text: 'Whenever you Exhaust a card, deal 6 damage to ALL enemies.' },
    },

    /* ====== Colorless salvage-tech (shop & event only — never in fight rewards) ====== */
    recon: {   // Scry — sculpt your next draws
      name: 'Recon', cls: 'any', type: 'skill', rarity: 1, pool: 'colorless', cost: 0,
      fx: [{ k: 'special', id: 'scry', v: 3, draw: 1 }],
      text: 'Scry 3. Draw 1.',
      up: { fx: [{ k: 'special', id: 'scry', v: 5, draw: 1 }], text: 'Scry 5. Draw 1.' },
    },
    requisition: {   // Tutor — find your combo piece
      name: 'Requisition', cls: 'any', type: 'skill', rarity: 2, pool: 'colorless', cost: 1,
      fx: [{ k: 'special', id: 'tutor' }],
      text: 'Search your draw pile and put any card into your hand.',
      up: { cost: 0, fx: [{ k: 'special', id: 'tutor' }], text: 'Search your draw pile and put any card into your hand.' },
    },
    salvage_cache: {   // Discover — generate a choice of cards
      name: 'Salvage Cache', cls: 'any', type: 'skill', rarity: 2, pool: 'colorless', cost: 1, exhaust: true,
      fx: [{ k: 'special', id: 'discover' }],
      text: 'Discover a card.',
      up: { fx: [{ k: 'special', id: 'discover' }, { k: 'draw', v: 1 }], text: 'Discover a card.' },
    },
    fusion_charge: {   // Primed — a ticking delayed bomb
      name: 'Fusion Charge', cls: 'any', type: 'skill', rarity: 3, pool: 'colorless', cost: 1,
      fx: [{ k: 'special', id: 'primed', v: 30, t: 3 }],
      text: 'Primed 3: then 30 damage to ALL enemies.',
      up: { fx: [{ k: 'special', id: 'primed', v: 45, t: 3 }], text: 'Primed 3: then 45 damage to ALL enemies.' },
    },

    /* ---------------- Curses ---------------- */
    void_taint: {
      name: 'Void Taint', cls: 'curse', type: 'curse', rarity: -1, cost: 0, unplayable: true,
      fx: [], text: 'Unplayable. A whisper gnaws at the edge of your mind.',
    },
    shrapnel: {
      name: 'Shrapnel', cls: 'curse', type: 'curse', rarity: -1, cost: 0, unplayable: true,
      fx: [], text: 'Unplayable. Lose 2 HP if still in hand at end of turn.',
    },
    recurring_curse: {
      name: 'Recurring Dread', cls: 'curse', type: 'curse', rarity: -1, cost: 0, unplayable: true, retain: true,
      fx: [], text: 'Unplayable. A fragment of the loop, lodged in your mind.',
    },
    void_swarm: {
      name: 'Void Swarm', cls: 'curse', type: 'curse', rarity: -1, cost: 0, unplayable: true, disableNeighbors: true,
      fx: [], text: 'Unplayable. Its neighbours in hand cannot be played.',
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
  };

  /* ---- Description generator ----------------------------------------- */
  // `special` ops are card-specific and normally described by the card's own
  // text, but a few are shared riders with a keyword name.
  var SPECIAL_KW = { drain: 'Siphon.' };
  // Specials whose whole description is a number the card already carries.
  var SPECIAL_FMT = { bloodbath: function (f) { return 'Deal ' + f.v + '\u00d7 your Might as damage.'; } };

  // ctx (optional): {attrs, statuses} so descriptions show live modified numbers.
  ns.cardDesc = function (def, upgraded, ctx, vtouch) {
    var fx = (upgraded && def.up && def.up.fx) ? def.up.fx : def.fx;
    if (vtouch) fx = voidBoost(fx);
    var B = ns.BALANCE;
    // Each entry is either a plain string or {s, aoe} — `aoe` is the short form
    // used when a run of consecutive board-wide effects gets folded into one
    // clause (see collapse() below).
    var parts = [];
    parts.grp = function (long, short, g) { this.push({ s: long, short: short, g: g }); };
    fx.forEach(function (f) {
      if (f.k === 'dmg') {
        var v = f.v;
        var mul = f.scaleMul || 1;
        if (ctx) {
          var dsc = f.scale === 'pri' ? (ctx.pri || 'might') : f.scale;
          if (dsc === 'might') v += ctx.attrs.might * B.attrs.mightDmgPerPoint * mul;
          if (dsc === 'tech') v += ctx.attrs.tech * mul;
          if (dsc === 'psi') v += ctx.attrs.psi * B.attrs.psiDmgPerPoint * mul;
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
        if (f.all && !f.random && !f.xcost && !(f.hits > 1)) parts.grp(s + '.', Math.round(v) + ' damage', 'all');
        else parts.push(s + '.');
      }
      if (f.k === 'block') {
        var b = f.v;
        if (ctx) {
          var bsc = f.scale === 'pri' ? (ctx.pri || 'might') : f.scale;
          if (bsc === 'tech') b += ctx.attrs.tech * B.attrs.techBlockPerPoint;
          else if (bsc === 'might') b += ctx.attrs.might * B.attrs.mightBlockPerPoint;
          else if (bsc === 'psi') b += ctx.attrs.psi * B.attrs.psiBlockPerPoint;
        }
        parts.grp('Gain ' + Math.round(b) + ' Shield.', Math.round(b) + ' Shield', 'self');
      }
      if (f.k === 'onRoll') {
        var inner = ns.cardDesc({ fx: f.fx || [] }, false, ctx, false);
        var lead = (f.max != null && f.min != null) ? 'Roll ' + f.min + '+ or ' + f.max + '-: '
                 : f.max != null ? 'Roll ' + f.max + ' or less: '
                 : 'Roll ' + f.min + '+: ';
        parts.push(lead + inner);
      }
      // Riders that every card spelled out longhand ("Heal for half the damage
      // dealt." on five different cards) are keywords instead — one word on the
      // card, the full rule in the inspect glossary.
      if (f.k === 'special' && SPECIAL_KW[f.id]) parts.push(SPECIAL_KW[f.id]);
      if (f.k === 'special' && SPECIAL_FMT[f.id]) parts.push(SPECIAL_FMT[f.id](f));
      if (f.k === 'heal') parts.push('Heal ' + f.v + ' HP.');
      if (f.k === 'hploss') parts.push('Lose ' + f.v + ' HP.');
      if (f.k === 'draw') parts.push('Draw ' + f.v + ' card' + (f.v > 1 ? 's' : '') + '.');
      if (f.k === 'energy') parts.push('Gain ' + f.v + ' Energy.');
      if (f.k === 'status') {
        var n = STATUS_NAMES[f.s] || f.s;
        // Concise keyword references only — the rules live in the inspect glossary.
        if (f.s === 'turret') parts.push('Deploy a Turret (' + (f.v + (ctx ? ctx.attrs.tech : 0)) + ' dmg/turn).');
        else if (f.s === 'drone') parts.push('Deploy a Drone Swarm (' + (f.v + (ctx ? ctx.attrs.tech : 0)) + ' to all/turn).');
        else if (f.s === 'brood') parts.push('Each turn, summon ' + (f.v > 1 ? f.v + ' Spawnlings' : 'a Spawnling') + '.');
        else if (f.s === 'slots') parts.push('+' + f.v + ' formation slot' + (f.v > 1 ? 's' : '') + ' (Kennel).');
        else if (f.s === 'echo' || f.s === 'corruption' || f.s === 'barricade' || f.s === 'retain') parts.grp('Gain ' + n + '.', n, 'self');
        else if (f.s === 'emberward' || f.s === 'staticward' || f.s === 'spikeward' || f.s === 'demoCharge' || f.s === 'subroutine' || f.s === 'aegisLink' || f.s === 'aimPerTurn' || f.s === 'misfireGuard') { /* the card's own text describes these reactive/trigger effects */ }
        else if (f.who === 'self') parts.grp('Gain ' + f.v + ' ' + n + '.', f.v + ' ' + n, 'self');
        else if (f.who === 'allEnemies') parts.grp('Apply ' + f.v + ' ' + n + ' to ALL enemies.', f.v + ' ' + n, 'all');
        else parts.grp('Apply ' + f.v + ' ' + n + '.', f.v + ' ' + n, 'tgt');
      }
    });
    var out = collapse(parts);
    var text = (upgraded && def.up && def.up.text) ? def.up.text : def.text;
    if (text) out.push(text);
    if (def.retain) out.push('Retain.');
    if (def.exhaust) out.push('Exhaust.');
    if (vtouch) out.push('Void-Touched: lose ' + ns.VTOUCH_HP + ' HP when played.');
    return out.join(' ');
  };

  /* "Deal 5 damage to ALL enemies. Apply 1 Weak to ALL enemies. Apply 1
     Vulnerable to ALL enemies." states the scope three times to say one thing,
     and repetition like it was the single biggest source of card text that
     would not fit. Card games state a shared subject once and list what lands,
     so a run of two or more consecutive effects with the same subject folds:

       ALL enemies: 5 damage, 1 Weak, 1 Vulnerable.
       Apply 1 Weak, 1 Vulnerable.
       Gain 1 Might, 3 Shield.

     A lone effect keeps its full sentence — a list of one reads worse. Only
     CONSECUTIVE effects fold, so nothing is ever reordered. */
  var GROUP_LEAD = { all: 'ALL enemies: ', tgt: 'Apply ', self: 'Gain ' };
  function collapse(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var g = parts[i].g;
      if (!g) { out.push(parts[i].s || parts[i]); continue; }
      var j = i;
      while (j + 1 < parts.length && parts[j + 1].g === g) j++;
      if (j === i) out.push(parts[i].s);
      else {
        var shorts = [];
        for (var k = i; k <= j; k++) shorts.push(parts[k].short);
        out.push(GROUP_LEAD[g] + shorts.join(', ') + '.');
      }
      i = j;
    }
    return out;
  }

  // Does this card need an enemy target?
  ns.cardNeedsTarget = function (def, upgraded) {
    var fx = (upgraded && def.up && def.up.fx) ? def.up.fx : def.fx;
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i];
      if (f.k === 'dmg' && !f.all && !f.random) return true;
      if (f.k === 'status' && f.who === 'target') return true;
      if (f.k === 'special' && (f.id === 'shieldSlam' || f.id === 'shieldSlam15' || f.id === 'catalyst' || f.id === 'catalyst3' || f.id === 'reap' || f.id === 'overdrive' || f.id === 'fiendFire' || f.id === 'cull' || f.id === 'detonate' || f.id === 'backdraft' || f.id === 'parch' || f.id === 'cleave' || f.id === 'spendAim')) return true;
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
