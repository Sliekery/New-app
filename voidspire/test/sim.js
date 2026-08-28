/* =========================================================================
 * VOIDSPIRE — headless run simulator.
 * Usage: node test/sim.js [runs]
 * Plays full runs with a simple greedy bot. Crashes loudly on engine bugs
 * and prints balance statistics (sector reached, death causes).
 * ========================================================================= */
'use strict';

global.VS = global.VS || {};
require('../js/balance.js');
require('../js/cards.js');
require('../js/artifacts.js');
require('../js/dice.js');
require('../js/reforge.js');
require('../js/chassis.js');
require('../js/potions.js');
require('../js/echoes.js');
require('../js/enemies.js');
require('../js/events.js');
require('../js/engine.js');

var VS = global.VS;
var E = VS.engine;

var RUNS = parseInt(process.argv[2] || '60', 10);
var MAX_SECTOR = 10; // stop "endless" runs here for stats
var rand = Math.random;

/* ====================================================================
 * "Decent player" bot: estimates incoming damage, blocks when needed,
 * finishes kills, targets attackers, and makes sane meta choices.
 * It is a proxy for a competent-but-not-expert human, used to calibrate
 * the difficulty curve against Slay-the-Spire-like targets.
 * ==================================================================== */

function attrOf(scale) {
  if (!scale) return 0;
  return VS.engine.attr(scale);
}

// includeDot: also credit damage-over-time (Burn) as expected damage. Used for
// ranking/priority so the Burn archetype isn't invisible to the bot; left OFF
// for lethal detection (Burn can't kill *this* turn).
function estCardDamage(card, target, includeDot) {
  var def = VS.CARDS[card.id];
  var fx = VS.cardFx(def, card.up);
  var c = VS.engine.combat;
  var str = (c.player.statuses.str || 0);
  var total = 0, dot = 0;
  fx.forEach(function (f) {
    if (f.k === 'dmg') {
      var v = f.v + attrOf(f.scale) * (f.scaleMul || 1) + str;
      if (f.scale === 'psi') v += (c.player.statuses.psiPow || 0);
      var hits = f.hits || 1;
      if (target && (target.statuses.vuln || 0) > 0) v = Math.floor(v * VS.BALANCE.status.vulnMult);
      total += v * hits;
    }
    // Burn ticks for its full stack each turn, decaying by 1 — i.e. applying b
    // stacks deals ~b*(b+1)/2 over the fight (ignores block). Value it as a
    // multi-tick DoT, capped so huge single stacks don't read as instant lethal.
    if (includeDot && f.k === 'status' && f.s === 'burn') {
      var b = f.v + ((f.scale === 'psi') ? attrOf('psi') : 0);
      var ticks = Math.min(b, 4);              // realistic turns before death/decay
      dot += Math.round(b * ticks - ticks * (ticks - 1) / 2);
    }
    if (f.k === 'special' && (f.id === 'shieldSlam' || f.id === 'shieldSlam15')) {
      total += Math.floor(c.player.block * (f.id === 'shieldSlam15' ? 1.5 : 1));
    }
    if (f.k === 'special' && f.id === 'reap' && target) {
      var st = (target.statuses.vuln || 0) + (target.statuses.weak || 0) + (target.statuses.burn || 0);
      total += st * f.v + str;
    }
    if (f.k === 'special' && f.id === 'overdrive') {
      total += f.v * (c.cardsThisTurn || 0) + str;
    }
    if (f.k === 'special' && f.id === 'fiendFire') {
      total += (f.v + str) * Math.max(0, c.hand.length - 1); // ~cards left to exhaust
    }
    if (f.k === 'special' && f.id === 'unload') {
      total += f.v * (c.player.statuses.momentum || 0);  // Fusillade cashout scales with built Momentum
    }
    if (f.k === 'special' && f.id === 'bloodbath') {
      total += f.v * (c.player.statuses.str || 0);        // Bloodforge cashout scales with stacked Strength
    }
  });
  if ((c.player.statuses.weak || 0) > 0) total = Math.floor(total * VS.BALANCE.status.weakMult);
  return total + dot;
}

var PRI_ATTR = { vanguard: 'might', technomancer: 'tech', voidadept: 'psi' };
function estCardBlock(card) {
  var def = VS.CARDS[card.id];
  var fx = VS.cardFx(def, card.up);
  var total = 0;
  fx.forEach(function (f) {
    if (f.k === 'block') {
      var sc = f.scale === 'pri' ? PRI_ATTR[VS.engine.run.cls] : f.scale;
      total += f.v + ((sc === 'tech' || sc === 'might' || sc === 'psi') ? VS.engine.attr(sc) : 0);
    }
    if (f.k === 'status' && f.s === 'parry') total += f.v;   // Parry deflects like block (Bloodforge)
    if (f.k === 'special' && f.id === 'powerSurge') {
      var c = VS.engine.combat, pw = 0;
      c.consumed.forEach(function (cc) { if (VS.CARDS[cc.id].type === 'power') pw++; });
      total += f.v * pw;
    }
  });
  return total;
}

/* The bot has to be able to SEE a boss law, or it plays straight into one and
 * the difficulty reading is of a player who cannot read. Only the two laws that
 * change what a competent player would do are modelled. */
function lawInForce() { return (VS.engine.bossLaw && VS.engine.bossLaw()) || null; }

function incomingDamage() {
  var c = VS.engine.combat;
  var total = 0;
  c.enemies.forEach(function (en) {
    if (!en.alive || !en.intent) return;
    var m = en.intent;
    if (m.t === 'attack' || m.t === 'drain') {
      var info = VS.engine.intentInfo(en);
      var d = parseInt(info.label, 10) || 0;
      total += d * (m.hits || 1);
    }
  });
  if ((c.player.statuses.vuln || 0) > 0) total = Math.floor(total * VS.BALANCE.status.vulnMult);
  return total;
}

function aliveIdx() {
  var out = [];
  VS.engine.combat.enemies.forEach(function (e, i) { if (e.alive) out.push(i); });
  return out;
}

function pickTarget() {
  var c = VS.engine.combat;
  var alive = aliveIdx();
  // prefer killable lowest-hp, then attackers
  alive.sort(function (a, b) { return c.enemies[a].hp - c.enemies[b].hp; });
  return alive[0];
}

// A decent player keeps their best modules mounted. When the core is full and a
// better module turns up, swap the weakest one out for it.
function botManageDie() {
  var r = VS.engine.run, d = r && r.die; if (!d) return;
  var slots = d.coreSlots || VS.DIE.coreSlotsStart;
  var tier = function (id) { var a = VS.ARTIFACTS[id]; return (a && a.tier) || 1; };
  // fill empty slots first
  r.artifacts.forEach(function (id) {
    if (d.core.length >= slots) return;
    if (d.core.indexOf(id) < 0 && d.frame.indexOf(id) < 0) d.core.push(id);
  });
  // then upgrade: swap the weakest mounted for a stronger benched one
  var bench = r.artifacts.filter(function (id) { return d.core.indexOf(id) < 0 && d.frame.indexOf(id) < 0; });
  bench.sort(function (a, b) { return tier(b) - tier(a); });
  bench.forEach(function (id) {
    if (!d.core.length) return;
    var worstI = 0;
    for (var i = 1; i < d.core.length; i++) if (tier(d.core[i]) < tier(d.core[worstI])) worstI = i;
    if (tier(id) > tier(d.core[worstI])) d.core[worstI] = id;
  });
}

/* Place any queued engravings. A decent player cuts them where the die actually
 * lands, i.e. high on the table, and keeps face 1 for its own anchor.
 *
 * THIS SCORES THE WHOLE SPAN, not the anchor. It used to walk anchors from 20
 * downwards and take the first legal one, which was correct only while a span
 * grew UPWARD from its anchor and could not wrap. Under a centred, wrapping
 * span that same walk anchors every band at 20 — covering 19, 20 and face 1 —
 * so a third of every band the bot cut landed on the misfire face. Measured:
 * Vanguard 26.1% -> 15.7% win, entirely from the harness, not the game. */
function botFaceValue(f, lo) {
  if (f === 1) return 0.5;        // fires only on a jam; the anchor faces want it
  return f >= lo ? f : 1;
}
function botPlaceScore(id, face) {
  var d = VS.engine.run.die, p = VS.diePlacement(d, id, face);
  if (p.why) return null;
  var lo = Math.min(20, 2 + VS.engine.startAim(VS.engine.run.cls));
  var s = 0;
  p.span.forEach(function (f) { s += botFaceValue(f, lo); });
  // a shared face is 60% for BOTH occupants — worth it when the die is full,
  // never worth it while a clean face of similar value is going spare
  if (p.seam != null) s -= 14;
  return s;
}
function botBestFace(id) {
  var g = VS.DIE_AUGMENTS[id];
  if (g && g.onlyFace) return VS.dieCanEngrave(VS.engine.run.die, id, g.onlyFace) ? -1 : g.onlyFace;
  var best = -1, bestS = -Infinity;
  for (var f = 1; f <= VS.dieSides(VS.engine.run.die); f++) {
    var sc = botPlaceScore(id, f);
    if (sc != null && sc > bestS) { bestS = sc; best = f; }
  }
  return best;
}
function botPlaceEngravings() {
  var E = VS.engine, r = E.run, d = r && r.die; if (!d || !d.pending || !d.pending.length) return;
  var left = [];
  var dice = [d];
  d.pending.forEach(function (id) {
    var bestD = null, bestF = 0, bestGain = -1e9;
    dice.forEach(function (dd) {
      var was = r.die; r.die = dd;                 // botBestFace reads run.die
      var f = botBestFace(id);
      r.die = was;
      if (f <= 0) return;
      var before = dieRollEV(dd, false, null);
      var probe = { faces: {}, seams: dd.seams, welds: dd.welds };
      for (var k in dd.faces) probe.faces[k] = dd.faces[k];
      VS.dieEngrave(probe, id, f);
      var gain = dieRollEV(probe, false, null) - before;
      if (gain > bestGain) { bestGain = gain; bestD = dd; bestF = f; }
    });
    if (bestD) VS.dieEngrave(bestD, id, bestF); else left.push(id);
  });
  d.pending = left;
}

// THE BENCH. A competent player pays to undo a Flaw before buying anything new
// — a Flaw is pure downside on a face they would rather sell to an augment —
// and prefers moving one out of Aim's reach when the jig is the cheaper answer.
function botBench() {
  var E = VS.engine, r = E.run, d = r.die; if (!d || !r.shop) return;
  var roots = Object.keys(d.faces).filter(function (f) { return d.faces[f].root === +f; });
  var flaw = roots.filter(function (f) {
    var g = VS.dieEngraving(d.faces[f].id); return g && g.flaw;
  }).map(Number).sort(function (a, b) { return b - a; })[0];   // the one highest up the die hurts most
  if (flaw != null) {
    var lo = Math.min(20, 2 + E.startAim(r.cls));
    // if a bare face below the Aim floor exists, shunting it there is cheaper
    var dump = -1;
    for (var f2 = 2; f2 < lo && dump < 0; f2++) if (!d.faces[f2]) dump = f2;
    if (flaw >= lo && dump > 0 && r.credits >= E.reseatCost() && !r.shop.reseatUsed) E.shopReseat(flaw, dump);
    else if (r.credits >= E.grindCost() && !r.shop.grindUsed) E.shopGrindFlaw(flaw);
  }
  (r.shop.engravings || []).forEach(function (it, i) {
    if (it.sold || r.credits < it.cost) return;
    var face = botBestFace(it.id);
    if (face > 0) E.shopBuyEngraving(i, face);
  });
  /* THE TORCH. Welding is a real spend and a real power gain, so the bot has
   * to buy it or the sim reports a die weaker than the one a player builds.
   * It welds the highest boundary between two DIFFERENT engravings, which is
   * where the full-strength bleed is worth the most on a ramp table. */
  var opts = E.weldOptions().filter(function (o) { return Math.min(o.a, o.b) > 1; });
  opts.sort(function (x, y) { return (y.a + y.b) - (x.a + x.b); });
  while (opts.length && r.credits >= E.weldCost() * 2) {   // never spend the last of it
    if (E.shopWeld(opts[0].a, opts[0].b)) break;
    opts = E.weldOptions().filter(function (o) { return Math.min(o.a, o.b) > 1; });
    opts.sort(function (x, y) { return (y.a + y.b) - (x.a + x.b); });
  }
}

/* THE COMBAT CLOCK, reported rather than assumed. A hallway fight used to run
 * a median of 2 turns against a genre norm of 4-6, which is why 62% of a
 * drafted deck was never drawn and why rarity was anti-correlated with
 * winning. It is the number the clock retune is aimed at, so it is measured
 * every run. `seen` is how much of your deck a fight actually shows you —
 * drawPerTurn x turns against deck size — which is the figure that decides
 * whether deckbuilding is a real activity. */
var TURNS = [], TURNS_BY = { fight: [], elite: [], boss: [], beacon: [] }, SEEN = [];
function botCombat() {
  var E = VS.engine;
  var guard = 0;
  var maxTurn = 0;
  botManageDie();
  botPlaceEngravings();
  while (E.run.phase === 'combat' && guard++ < 400) {
    var c = E.combat;
    if (c) maxTurn = Math.max(maxTurn, c.turn || 0);
    if (c.over || aliveIdx().length === 0) break;
    var playable = [];
    for (var i = 0; i < c.hand.length; i++) if (E.canPlay(i)) playable.push(i);
    /* THE NUDGE. Taken whenever the face one step round the ring is worth more
     * than the Energy it costs — an Energy buys roughly one cheap card, so the
     * bar is a face scoring above a cheap card's output. Without this the sim
     * would play as if the mechanic did not exist and report a balance figure
     * for a game nobody is playing. */
    var nst = E.nudgeState && E.nudgeState();
    if (nst && nst.afford) {
      var best = null, bestDir = 0;
      [[nst.left, -1], [nst.right, 1]].forEach(function (pair) {
        if (!pair[0] || pair[0].flaw) return;      // never pay to fire a Flaw
        var g = VS.DIE_AUGMENTS[pair[0].id];
        // both lenses, same rule as the instability cull: a face is worth
        // what it is best at, and the bot should not decline a shield face
        // merely because it is not also a damage face
        var val = Math.max(engFaceValue(g, false), engFaceValue(g, true));
        if (val > (best === null ? NUDGE_BAR : best)) { best = val; bestDir = pair[1]; }
      });
      if (bestDir) { E.nudge(bestDir); continue; }
    }
    if (playable.length === 0) { E.endTurn(); continue; }

    if (RANDOM_PLAY) {
      if (!E.playCard(playable[Math.floor(probeRnd() * playable.length)], pickTarget())) E.endTurn();
      continue;
    }
    var incoming = incomingDamage();
    var needBlock = Math.max(0, incoming - c.player.block);
    var hpDanger = E.run.hp < E.run.maxHp * 0.6 || needBlock >= E.run.hp * 0.25;
    var choice = -1, target = pickTarget();

    // 1. finish a kill if possible (immediate damage only — Burn can't kill now)
    var best = -1, bestOver = 1e9;
    playable.forEach(function (idx) {
      var card = c.hand[idx];
      if (VS.CARDS[card.id].type !== 'attack') return;
      var tEn = c.enemies[target];
      var dmg = estCardDamage(card, tEn, false);
      if (dmg >= tEn.hp + tEn.block && dmg - tEn.hp < bestOver) { best = idx; bestOver = dmg - tEn.hp; }
    });
    if (best >= 0) choice = best;

    // 2. block when meaningful damage is incoming
    if (choice < 0 && needBlock > 3 && (hpDanger || needBlock > 8)) {
      var bb = -1, bv = 0;
      playable.forEach(function (idx) {
        var v = estCardBlock(c.hand[idx]);
        var cost = Math.max(1, E.cardInfo(c.hand[idx]).cost);
        if (v > 0 && v / cost > bv) { bv = v / cost; bb = idx; }
      });
      if (bb >= 0) choice = bb;
    }

    // 3. powers early, then best attack, then anything
    if (choice < 0) {
      var pw = playable.filter(function (idx) { return VS.CARDS[c.hand[idx].id].type === 'power'; });
      if (pw.length && c.turn <= 3) choice = pw[0];
    }
    if (choice < 0) {
      var ba = -1, bd = -1;
      playable.forEach(function (idx) {
        var cdef = VS.CARDS[c.hand[idx].id];
        if (cdef.type !== 'attack') return;
        // DoT-aware: lay/stack Burn proactively instead of treating it as 0 dmg
        var dmg = estCardDamage(card0(c, idx), c.enemies[target], true);
        if (dmg > bd) { bd = dmg; ba = idx; }
      });
      if (ba >= 0) choice = ba;
    }
    /* SWAT A SWARM that is actually gagging something. Void Swarm is playable
     * now precisely so a hand can never lock, and a bot that only ever reached
     * one through the last-resort fallback below would under-measure the fix —
     * it would play filler while a real card sat gagged next door. */
    if (choice < 0) {
      var sw = playable.filter(function (idx) {
        if (!VS.CARDS[c.hand[idx].id].disableNeighbors) return false;
        return [idx - 1, idx + 1].some(function (n) {
          return c.hand[n] && !VS.CARDS[c.hand[n].id].disableNeighbors
                 && E.whyCantPlay(n) === 'VOID SWARM — ITS NEIGHBOURS IN HAND ARE GAGGED';
        });
      });
      if (sw.length) choice = sw[0];
    }
    if (choice < 0) {
      // avoid pointless self-damage cards when low
      var safe = playable.filter(function (idx) {
        var fx = VS.cardFx(VS.CARDS[c.hand[idx].id], c.hand[idx].up);
        var loses = fx.some(function (f) { return f.k === 'hploss'; });
        return !(loses && E.run.hp < 20);
      });
      choice = (safe.length ? safe : playable)[0];
    }

    var ok = E.playCard(choice, target);
    if (!ok) E.endTurn();
  }
  // Turns, not iterations: a defensive deck plays several cards a turn, so an
  // iteration budget silently clipped long-but-terminating fights. The clock in
  // BALANCE.enrage ends any real fight well inside this.
  if (E.combat && E.combat.turn >= 150) throw new Error('combat loop guard tripped (sector ' + E.run.sector + ')');
  if (guard >= 4000) throw new Error('combat loop guard tripped (sector ' + E.run.sector + ')');

  TURNS.push(maxTurn);
  var _k = (VS.engine.run && VS.engine.run.nodeType) || 'fight';
  if (TURNS_BY[_k]) TURNS_BY[_k].push(maxTurn);
  // how much of the deck this fight actually showed you
  var _d = VS.engine.run && VS.engine.run.deck ? VS.engine.run.deck.length : 0;
  if (_d > 0) SEEN.push(Math.min(3, (maxTurn * VS.BALANCE.player.drawPerTurn) / _d));
}
function card0(c, idx) { return c.hand[idx]; }

var CLASS_ATTR = { vanguard: 'might', technomancer: 'tech', voidadept: 'psi' };

// ---- Archetype piloting (for measuring per-build ceilings) -----------------
// Class build engines: { cls, core (draft toward), flex (welcome) }. When PILOT
// names one, the bot commits to it so we can measure the build's ceiling instead
// of the greedy grab-bag. Reusable across classes.
var ENGINES = {
  // Vanguard engines
  /* MARKSMANSHIP replaced the old Momentum line: load Aim, let the die steer
   * onto an engraved run, walk a BURST along it, hold the RETAIN cashout until
   * the magazine is full. */
  marksmanship: { cls: 'vanguard', core: ['take_aim', 'boresight', 'steady_aim', 'ranging_shot', 'sighting_round',
                                          'burst_fire', 'suppressing_burst', 'hail_of_lead', 'walking_fire', 'ricochet',
                                          'full_auto', 'long_shot', 'killshot', 'empty_the_magazine', 'called_high',
                                          'deadeye_protocol', 'one_in_the_chamber', 'misfire_protocol'],
                  flex: ['pulse_rifle', 'combat_shield', 'war_cry', 'bayonet_charge', 'brace', 'hair_trigger',
                         'breaching_charge', 'marksman_round', 'firing_step', 'loophole'] },
  bloodforge: { cls: 'vanguard', core: ['blood_rage', 'deflect', 'vengeance', 'counterstrike', 'crimson_pact', 'whet_the_blade', 'bloodbath', 'frenzy', 'limit_break', 'heavy_ordnance', 'combat_stims', 'bloodlust'],
                flex: ['pulse_rifle', 'war_cry', 'rallying_shout', 'bayonet_charge', 'executioner', 'adrenal_surge'] },
  /* BULWARK: the wall does not expire, its build cards scale with the face you
   * land on, and it can be fired. Shares the high-roll want with Marksmanship,
   * which is what the bridges are for. */
  bulwark: { cls: 'vanguard', core: ['riot_shield', 'shield_bash', 'suppressing_barrage', 'rallying_shout',
                                     'bulwark', 'bunker_down', 'spiked_bulwark', 'casemate', 'buttress',
                                     'embrasure', 'shield_slam', 'iron_resolve', 'detonate',
                                     'barricade_protocol', 'riposte_protocol', 'set_against_it'],
             flex: ['pulse_rifle', 'combat_shield', 'brace', 'bayonet_charge', 'firing_step', 'loophole',
                    'sandbag', 'scar_tissue', 'blood_cement'] },
  /* STIM: buy power with HP, and the bottom of the die — the jam Marksmanship
   * cannot save — is what pays for it. */
  stim: { cls: 'vanguard', core: ['whet_the_blade', 'crimson_pact', 'gutshot', 'overdose', 'field_amputation',
                                  'adrenal_surge', 'combat_stims', 'red_ledger', 'blood_rage', 'executioner',
                                  'last_round', 'running_on_empty', 'fever', 'heavy_ordnance', 'frenzy',
                                  'limit_break', 'bloodlust', 'bloodbath', 'reckless_protocol', 'second_wind'],
          flex: ['pulse_rifle', 'combat_shield', 'brace', 'bayonet_charge', 'mainline', 'steady_hands',
                 'dead_mans_trigger', 'sandbag', 'scar_tissue'] },
  // kept as a NARROWER marksman pilot: the pure Aim line with no burst support,
  // so the two can be measured against each other
  marksman: { cls: 'vanguard', core: ['take_aim', 'boresight', 'steady_aim', 'sighting_round', 'ranging_shot',
                                      'long_shot', 'killshot', 'called_high', 'deadeye_protocol', 'misfire_protocol'],
              flex: ['pulse_rifle', 'combat_shield', 'war_cry', 'brace', 'bayonet_charge', 'hair_trigger'] },
  bandolier: { cls: 'vanguard', core: ['salvo', 'reload', 'quartermaster', 'breaching_charge', 'field_strip', 'cluster_charge', 'scorched_earth', 'iron_resolve', 'salvage_protocol', 'reckless_charge', 'limit_break', 'adrenal_surge'],
               flex: ['pulse_rifle', 'combat_shield', 'munitions_dump', 'bayonet_charge', 'brace', 'reload'] },
  // Voidadept affliction/Burn engine
  hex: { cls: 'voidadept', core: ['soul_burn', 'hex_weave', 'wither', 'catalyst', 'entropy_field', 'plague_engine', 'singularity_bloom', 'psionic_focus', 'mind_array', 'unravel', 'void_bolt', 'mind_fracture'],
         flex: ['mind_spike', 'premonition', 'blood_sacrifice', 'exsanguinate', 'psy_lance', 'combat_shield'] },
  // Voidadept DETONATE engine — seed Burn, grow it, blow it up
  affliction: { cls: 'voidadept', core: ['immolate', 'ember_storm', 'cinder_burst', 'conflagration', 'wildfire_engine', 'soul_burn', 'hex_weave', 'catalyst', 'plague_engine', 'unravel'],
                flex: ['mind_spike', 'premonition', 'mind_fracture', 'combat_shield', 'void_bolt'] },
  psi: { cls: 'voidadept', core: ['psy_lance', 'void_bolt', 'tk_crush', 'eldritch_storm', 'psionic_focus', 'mind_array', 'mind_storm', 'exsanguinate', 'unravel', 'forbidden_lore'],
         flex: ['mind_spike', 'premonition', 'blood_sacrifice', 'combat_shield', 'mind_fracture'] },
  // Voidadept PSI-FOCUS scaling engine — ramp Focus, cash it in
  psiramp: { cls: 'voidadept', core: ['ascendant_mind', 'mind_lance', 'cerebral_spike', 'psionic_nova', 'psionic_focus', 'mind_array', 'dread_whisper', 'tk_crush', 'void_rupture', 'null_field'],
             flex: ['mind_spike', 'psy_lance', 'premonition', 'combat_shield', 'bloodletting'] },
  // Voidadept HEMORRHAGE engine — pay HP for power & sustain
  bloodadept: { cls: 'voidadept', core: ['bloodletting', 'crimson_rite', 'vital_lance', 'sanguine_ward', 'blood_pact', 'exsanguinate', 'void_siphon', 'blood_sacrifice', 'hemorrhage', 'martyrs_gift'],
                flex: ['mind_spike', 'psy_lance', 'premonition', 'combat_shield', 'psionic_focus'] },
  // Technomancer engines
  fortress: { cls: 'technomancer', core: ['fortify_matrix', 'arc_welder', 'shield_battery', 'reinforced_hull', 'fortified_strike', 'aegis_matrix', 'kinetic_discharge', 'entrench_field', 'hold_the_line', 'railgun'],
              flex: ['overshield', 'shock_coil', 'combat_shield', 'guard_protocol', 'static_field'] },
  turret: { cls: 'technomancer', core: ['deploy_turret', 'sentry_protocol', 'drone_swarm', 'aux_reactor', 'echo_core', 'overload_capacitor', 'omega_protocol', 'chain_lightning', 'railgun'],
            flex: ['overshield', 'shock_coil', 'fortify_matrix', 'arc_welder'] },
  // Technomancer CONSTRUCTS — deploy a board and amplify it with Hive
  constructs: { cls: 'technomancer', core: ['hive_protocol', 'mortar_array', 'assault_drone', 'munitions_factory', 'sentry_protocol', 'deploy_turret', 'drone_swarm', 'targeting_uplink', 'salvage_servitor', 'aux_reactor'],
                flex: ['overshield', 'fortify_matrix', 'shock_coil', 'combat_shield', 'arc_welder'] },
  // Technomancer OVERCHARGE — Energy/Echo chain engine
  overcharge: { cls: 'technomancer', core: ['singularity_drive', 'flux_capacitor', 'aux_reactor', 'echo_core', 'surge_protocol', 'capacitor_discharge', 'recompile', 'overclock', 'railgun', 'arc_welder'],
                flex: ['overshield', 'shock_coil', 'fortify_matrix', 'combat_shield', 'leech_coil'] },
  // Technomancer DISRUPTION — Conduit turns debuffs into damage
  disruption: { cls: 'technomancer', core: ['tesla_conduit', 'short_circuit', 'system_shock', 'disruptor_pulse', 'feedback_loop', 'ion_storm', 'emp_mine', 'static_field', 'static_lance', 'emp_blast'],
                flex: ['overshield', 'shock_coil', 'fortify_matrix', 'combat_shield', 'arc_welder'] },
};
var FLEX_OF = {};  // per-class default flex
var PILOT = null;   // an ENGINES key — null = default greedy draft

/* ---- THE DECISION PROBE ------------------------------------------------
 * The question this answers is the one that matters most and is the hardest
 * to answer by playing: DOES CHOOSING ANYTHING MATTER? Run the same seeds
 * with a decision removed and compare.
 *
 *   VS_RANDOM_DRAFT=1   take a random card from every reward, always
 *   VS_RANDOM_PLAY=1    play a random legal card until nothing is legal
 *
 * The target is simple and falsifiable: a deliberate draft should beat a
 * random one by 10+ points. Measured before the Vanguard card pass it LOST
 * by 15 (random 41.3% vs greedy 26.7% over 240 Vanguard runs) — the game was
 * rewarding you for not thinking, which is the numeric form of "anything
 * works". Combat was fine over the same runs: removing play skill cost 21
 * points of finale rate, so the depth was all in the fight and none in the
 * build.
 * --------------------------------------------------------------------- */
var RANDOM_DRAFT = !!process.env.VS_RANDOM_DRAFT;
var RANDOM_PLAY = !!process.env.VS_RANDOM_PLAY;
/* VS_ALWAYS_TAKE isolates the two things the greedy arm was doing at once. It
 * picks the BEST of the three offered but never declines, so "random" vs
 * "always take" is a clean read on whether CHOOSING matters, with deck size
 * held equal — and "always take" vs "greedy" is a clean read on whether
 * DECLINING is worth anything. Without this the control arm varies two
 * things and neither result means what it looks like. */
var ALWAYS_TAKE = !!process.env.VS_ALWAYS_TAKE;
/* VS_PREFER=<axis> drafts on ONE axis and nothing else, which is how the
 * rarity inversion was found: over 150 Vanguard runs with deck size held
 * equal, preferring COMMONS won 56.0% and preferring RARES won 28.7%. The
 * game's own signal for "this card is better" is pointing the wrong way. */
var PREFER = process.env.VS_PREFER || null;
function preferScore(cid) {
  var d = VS.CARDS[cid], cls = VS.engine.run.cls;
  switch (PREFER) {
    case 'class':   return d.cls === cls ? 10 : 0;
    case 'neutral': return d.cls === 'any' ? 10 : 0;
    case 'common':  return -(d.rarity || 0);
    case 'rare':    return d.rarity || 0;
    case 'nopower': return d.type === 'power' ? 0 : 10;
    case 'cheap':   return -(d.cost || 0);
    default:        return scoreRewardCard(cid);
  }
}
// the probe's own randomness, seeded per run so the arms stay comparable
var _probeRs = 12345;
function probeRnd() { _probeRs = (_probeRs * 1103515245 + 12345) & 0x7fffffff; return _probeRs / 0x7fffffff; }
function setPilot(a) { PILOT = a; }
function pilotSpec() {
  if (!PILOT || !ENGINES[PILOT]) return null;
  var e = ENGINES[PILOT];
  return { cls: e.cls, core: e.core, flex: e.flex || FLEX_OF[e.cls] || [] };
}

// the bot can't manage relic toggles, so it values clean upside and shuns
// downsides it can't switch off.
function scoreRelic(id) {
  var a = VS.ARTIFACTS[id]; if (!a) return 0;
  var s = 5;
  var hooks = a.hooks || (a.k ? [{ k: a.k, v: a.v }] : []);
  hooks.forEach(function (h) {
    if (h.k === 'noShield' || h.k === 'noCredits' || h.k === 'dmgTakenMult') s -= 9;
    if (h.k === 'enemyHpScale' || h.k === 'lifestealPct' || h.k === 'flatDmg' || h.k === 'energyEveryTurn' || h.k === 'blockStart' || h.k === 'strStart') s += 3;
  });
  if (a.special === 'glassCannon') s -= 4;
  if (a.uses) s -= 2;
  return s;
}
function bestRelic(ids) {
  var bi = 0, bs = -1e9;
  ids.forEach(function (id, i) { var sc = scoreRelic(id); if (sc > bs) { bs = sc; bi = i; } });
  return { idx: bi, score: bs };
}
function scoreRewardCard(cid) {
  var def = VS.CARDS[cid];
  var s = def.rarity * 3;
  if (def.cls === VS.engine.run.cls) s += 2;
  if (VS.engine.run.deck.length > 22 && def.rarity === 1) s -= 6;
  var sp = pilotSpec();
  if (sp && def.cls === sp.cls) {
    if (sp.core.indexOf(cid) >= 0) s += 12;              // commit hard to the build
    else if (sp.flex.indexOf(cid) >= 0) s += 3;          // flex cards are welcome
    else s -= 8;                                         // shun off-engine cards of this class
  }
  return s;
}

function pickRemoveIdx() {
  var deck = VS.engine.run.deck;
  for (var i = 0; i < deck.length; i++) if (VS.CARDS[deck[i].id].type === 'curse') return i;
  for (i = 0; i < deck.length; i++) if (deck[i].id === 'pulse_rifle' && !deck[i].up) return i;
  for (i = 0; i < deck.length; i++) if (deck[i].id === 'combat_shield' && !deck[i].up) return i;
  return 0;
}

function pickUpgradeIdx() {
  var deck = VS.engine.run.deck;
  // prefer un-upgraded class/rare cards, then anything un-upgraded
  var bi = -1, bs = -1;
  deck.forEach(function (card, i) {
    var def = VS.CARDS[card.id];
    if (card.up || def.type === 'curse') return;
    var s = def.rarity * 2 + (def.cls === VS.engine.run.cls ? 1 : 0);
    if (s > bs) { bs = s; bi = i; }
  });
  return bi < 0 ? 0 : bi;
}

function scoreFx(fx, low) {
  fx = fx || {};
  var s = 0;
  if (fx.artifact) s += 8;
  if (fx.card) s += 5;
  if (fx.addCardChoice) s += 5;
  if (fx.tradeCard) s += 5;
  if (fx.tradeRelic) s += 2;
  if (fx.attr) s += 6;
  if (fx.maxhp) s += 5;
  if (fx.removeCurse) s += 4;
  if (fx.credits > 0) s += fx.credits / 12;
  if (fx.healPct) s += low ? 10 : 2;
  if (fx.hp < 0) s += low ? -12 : fx.hp / 4;
  if (fx.curse) s -= 8;
  if (fx.curse2) s -= 8;

  /* THE DIE VERBS. Without these every reforge, swap and blanking scored zero
   * and the bot took a quarter of its own health for nothing — which read as a
   * class-balance regression when it was really the model not knowing the new
   * currency existed. */
  if (fx.reforge || fx.bandCollapse || fx.unlisten) s += 6;
  if (fx.grantEngraving) s += 7;
  if (fx.cutPerBlanks) s += 5;
  if (fx.creditsPerBlank) s += 5;
  if (fx.stealFace) s += 5;
  if (fx.fuseFaces || fx.mirrorFace) s += 4;
  if (fx.teachAway) s += 3;
  if (fx.swapFaces || fx.migrateFace) s += 2;
  if (fx.swapRandom) s -= 1;
  if (fx.weldSeam || fx.seamCopy) s += 2;
  if (fx.fireFace) s += 2;
  if (fx.tierUpScarred) s += 6;
  if (fx.returnUpgraded) s += 5;
  if (fx.coreSlots) s += fx.coreSlots > 0 ? 6 : -4;
  if (fx.blankPick) s -= 6 * fx.blankPick;
  if (fx.blankBest) s -= 10;
  if (fx.sellFaces || fx.giveFace) s += (VS.engine.run.credits < 60 ? 3 : -2);
  if (fx.sellScarred) s += 3;
  if (fx.scarRandom) s -= 5;
  if (fx.scarBest || fx.scarMostFired) s -= 7;
  if (fx.scarSpread) s -= 8;

  // the costs the evil events are actually priced in
  if (fx.hpPct) s += low ? -14 : -6;
  if (fx.creditsAll) s -= VS.engine.run.credits / 12;
  if (fx.skipRewards) s -= 5;
  if (fx.doubleNextReward) s += 5;
  if (fx.skipEvents) s -= 4 * fx.skipEvents;
  if (fx.sectorMaxHpPct) s += low ? -12 : -5;
  if (fx.sectorEnergy) s += 7;
  if (fx.fightElite) s += low ? -12 : -3;
  return s;
}

function eventChoiceIdx(ev) {
  var r = VS.engine.run;
  var low = r.hp < r.maxHp * 0.45;
  var bestI = 0, bestS = -1e9;
  ev.choices.forEach(function (ch, i) {
    if (ch.cost && r.credits < ch.cost) return;
    if (!VS.engine.eventChoiceAvailable(ch)) return; // skip locked "blue" options
    var s = 0;
    // gambles: average the outcomes so the bot weighs them reasonably
    if (ch.gamble) {
      var tot = 0, sum = 0;
      ch.gamble.forEach(function (g) { var w = g.w || 1; tot += w; sum += w * scoreFx(g.fx, low); });
      s = (tot ? sum / tot : 0) - (ch.cost ? ch.cost / 12 : 0);
      if (s > bestS) { bestS = s; bestI = i; }
      return;
    }
    if (ch.pressLuck) {
      // value ~ the safe-ish steps minus the bust downside; the bot is cautious
      var psum = 0; (ch.pressLuck.steps || []).slice(0, 2).forEach(function (st) { psum += scoreFx(st, low); });
      s = psum * 0.6 + scoreFx(ch.pressLuck.bustFx, low) * 0.4;
      if (s > bestS) { bestS = s; bestI = i; }
      return;
    }
    if (ch.sell) {
      s = r.credits < 40 ? 3 : -1;   // only sell when genuinely broke
      if (s > bestS) { bestS = s; bestI = i; }
      return;
    }
    var out = ch.outcome || ch.success;
    var fx = (out && out.fx) || {};
    s = scoreFx(fx, low);
    if (fx.pick === 'remove' || fx.pick === 'upgrade') s += 5;
    if (ch.die) {
      // weigh both branches by the odds — which for a die check are the build
      var d = ch.die;
      var p = d.read === 'seam' ? 0.1
            : d.read === 'face' ? 0.5
            : VS.engine.dieOdds('cut').pct / 100;
      var goodFx = (d.onCut || d.onWin || {}).fx || {};
      var badFx = (d.onBlank || d.onLose || {}).fx || {};
      s = scoreFx(goodFx, low) * p + scoreFx(badFx, low) * (1 - p) - (ch.cost ? ch.cost / 12 : 0);
    }
    if (ch.op) s = -0.5;   // the lottery is break-even by design; the bot does not chase it
    if (s > bestS) { bestS = s; bestI = i; }
  });
  return bestI;
}

function step() {
  var E = VS.engine;
  var r = E.run;
  switch (r.phase) {
    case 'map': {
      var reach = E.mapReachable();
      var hurt = r.hp < r.maxHp * 0.5;
      var find = function (t) { return reach.filter(function (n) { return n.type === t; })[0]; };
      var node = null;
      if (hurt) node = find('rest');               // heal up when low
      if (!node) node = find('treasure');          // free relics are great
      if (!node && hurt) node = reach.filter(function (n) { return n.type !== 'elite'; })[0]; // dodge elites when low
      if (!node) node = find('shop') || find('event');
      if (!node) node = reach[Math.floor(rand() * reach.length)];
      E.enterNode(node);
      break;
    }
    case 'treasure':
      if (r.treasure && r.treasure.choices && r.treasure.choices.length) {
        var tp = bestRelic(r.treasure.choices);
        if (tp.score > 0) E.takeTreasureArtifact(tp.idx);
      }
      E.finishTreasure();
      break;
    case 'combat': botCombat(); break;
    case 'reward': {
      if (r.reward.artifactChoices && r.reward.artifactChoices.length && !r.reward.artifactPicked) {
        var rp = bestRelic(r.reward.artifactChoices);
        if (rp.score > 0) E.takeRewardArtifact(rp.idx);
      }
      // take the offered engraving and actually cut it into the die — the face
      // layer is where the power that used to sit in spare relics now lives
      if (r.reward.engChoices && r.reward.engChoices.length && !r.reward.engPicked) {
        var best = null, bestT = -1;
        r.reward.engChoices.forEach(function (id) {
          var g = VS.DIE_AUGMENTS[id]; if (!g) return;
          if ((g.tier || 1) > bestT) { bestT = g.tier || 1; best = id; }
        });
        if (best) { E.takeEngraving(best); botPlaceEngravings(); }
      }
      var bi = -1, bs = 0;
      if (RANDOM_DRAFT) {
        bi = r.reward.cards.length ? Math.floor(probeRnd() * r.reward.cards.length) : -1;
      } else {
        if (ALWAYS_TAKE || PREFER) bs = -1e9;
        r.reward.cards.forEach(function (cid, i) {
          var s = PREFER ? preferScore(cid) : scoreRewardCard(cid);
          if (s > bs) { bs = s; bi = i; }
        });
      }
      if (bi >= 0) E.takeRewardCard(bi);
      E.finishReward();
      break;
    }
    case 'event': {
      /* BALANCE PROBE. VS_FORCE_EVENT pins every event node to one event and
       * VS_FORCE_CHOICE pins the branch, so a single event's cost to a run can
       * be measured against a control instead of argued about. The events that
       * need this are the ones that change your die WITHOUT you choosing how —
       * a random swap, a scar landing where it likes. */
      if (process.env.VS_FORCE_EVENT) {
        r.currentEvent = process.env.VS_FORCE_EVENT;
        r.eventResult = null;
      }
      var ev = E.getEvent();
      if (!ev) throw new Error('no current event');
      if (ev.gambleDen) {   // bet 25% when flush, else walk
        var gi = E.gambleInfo();
        if (r.credits >= 60) { E.gamblePlay(0.25); E.gambleClaim(); }
        E.gambleFinish();
        break;
      }
      var forcedCi = process.env.VS_FORCE_CHOICE != null ? parseInt(process.env.VS_FORCE_CHOICE, 10) : null;
      var ci = (forcedCi != null && ev.choices[forcedCi] && E.eventChoiceAvailable(ev.choices[forcedCi]) &&
                !(ev.choices[forcedCi].cost && r.credits < ev.choices[forcedCi].cost))
             ? forcedCi : eventChoiceIdx(ev);
      var res = E.eventChoose(ci);
      if (!res) throw new Error('eventChoose returned null');
      // A betting table parks a second input before it will roll.
      if (res.op) E.betResolve(r.pendingOp.k === 'betRegion' ? 'mid' : 11);
      break;
    }
    case 'press-luck': {
      var info = E.pressLuckInfo();
      // cautious bot: push only while the bust risk is low and the pot is modest
      if (!info.done && info.bustChance <= 0.28 && info.accrued.length < 3) {
        var pr = E.pressLuckPush();
        if (pr && pr.busted) E.pressLuckBank();   // bust -> resolve the bad outcome
      } else {
        E.pressLuckBank();
      }
      break;
    }
    case 'event-result':
      /* The die verbs come first — a face pick can cascade into a reforge pick,
       * and the node will not close until both have landed. The bot plays them
       * straight: first legal face, first rewrite. */
      var dieGuard = 0;
      while ((r.pendingFace || r.pendingReforge) && dieGuard++ < 10) {
        if (r.pendingFace) {
          var fc = E.faceCandidates();
          if (!fc.length) { r.pendingFace = null; break; }
          E.facePick(fc[0]);
        } else {
          var ro = E.reforgeOptionsAt(r.pendingReforge.face);
          if (!ro.length) { r.pendingReforge = null; break; }
          // avoid the blood-priced rewrites when already hurt
          var hurt = r.hp < r.maxHp * 0.5, bestRo = 0;
          for (var roi = 0; roi < ro.length; roi++) {
            var costsHp = (ro[roi].fx || []).some(function (q) { return q.k === 'hploss'; });
            if (!(hurt && costsHp)) { bestRo = roi; break; }
          }
          E.reforgeApply(r.pendingReforge.face, bestRo);
        }
      }
      if (r.pendingRelic) E.takeEventRelic();   // a competent player takes the free relic
      if (r.pendingAddCard) E.eventAddCard(r.pendingAddCard[0]);
      if (r.pendingPick) {
        E.applyPick(r.pendingPick === 'remove' ? pickRemoveIdx() : r.pendingPick === 'upgrade' ? pickUpgradeIdx() : 0);
      }
      if (r.pendingSell) {
        var so = E.sellOptions();
        // sell the cheapest non-essential card when broke, else keep everything
        if (r.credits < 40 && so.length) {
          so.sort(function (a, b) { return a.value - b.value; });
          E.sellPick(r.pendingSell.kind === 'relic' ? so[0].id : so[0].idx);
        } else E.skipSell();
      }
      if (r.pendingTrade) {
        if (r.pendingTrade.kind === 'card') {
          var ti = -1;  // scrap the cheapest non-curse card to forge up
          r.deck.forEach(function (c, i) { if (VS.CARDS[c.id].type !== 'curse' && (ti < 0 || (VS.CARDS[c.id].rarity || 1) < (VS.CARDS[r.deck[ti].id].rarity || 1))) ti = i; });
          if (ti >= 0) E.tradeCardPick(ti); else E.skipTrade();
        } else E.skipTrade();   // relic-for-relic: play it safe
      }
      E.finishEvent();
      break;
    case 'shop': {
      if (E.shopBuyRemove()) E.applyPick(pickRemoveIdx());
      botManageDie(); botPlaceEngravings(); botBench();
      if (r.shop.artifact && !r.shop.artifact.sold && r.credits >= r.shop.artifact.cost) E.shopBuyArtifact();
      var cards = r.shop.cards.slice().sort(function (a, b) { return scoreRewardCard(b.id) - scoreRewardCard(a.id); });
      cards.forEach(function (it) {
        if (!it.sold && scoreRewardCard(it.id) >= 4 && r.credits >= it.cost) E.shopBuyCard(r.shop.cards.indexOf(it));
      });
      if (r.hp < r.maxHp * 0.6) E.shopBuyHeal();
      E.leaveShop();
      break;
    }
    case 'rest':
      if (r.hp < r.maxHp * 0.65) E.restHeal();
      else { E.restUpgrade(); E.restFinishUpgrade(pickUpgradeIdx()); }
      break;
    case 'forge': {
      // strip junk if any, else upgrade a strong card
      var junk = r.deck.some(function (c) { return VS.CARDS[c.id].type === 'curse' || (c.id === 'pulse_rifle' && !c.up); });
      if (junk) { E.forgePick('remove'); E.applyPick(pickRemoveIdx()); }
      else { E.forgePick('upgrade'); E.applyPick(pickUpgradeIdx()); }
      E.finishForge();
      break;
    }
    case 'rift': E.finishRift(); break;
    case 'boss-artifact': {
      // a competent player avoids the downside relic when its drawback isn't earned
      var opts = r.bossArtifacts || [];
      var idx = 0;
      for (var bi = 0; bi < opts.length; bi++) {
        if (VS.ARTIFACTS[opts[bi]].special === 'glassCannon') continue;
        idx = bi; break;
      }
      E.takeBossArtifact(idx);
      break;
    }
    // THE FIRST MARK: cycle the three offers across runs so a batch measures
    // all of them, not whichever one the bot happens to like.
    /* THE OPENING KIT. Scored the same way the bot scores everything else on
     * this class — expected value of a roll — so the kit it opens with is the
     * one that most improves the dice it will actually be rolling. Under
     * VS_RANDOM_DRAFT it takes one blind, which is what makes the opening
     * choice measurable rather than assumed. */
    /* THE INSTABILITY. Two decisions the bot has to actually make: WHICH
     * engravings to give back, and HOW MANY — the bid buys a better permanent,
     * so a bot that always paid the floor would measure the ritual as a pure
     * tax and never see the interesting half of it.
     *
     * It burns worst-first by the same expected-roll score it uses everywhere
     * else, and it keeps bidding past the floor while the next engraving it
     * would give up is worth less than the tier it buys. Under VS_RANDOM_DRAFT
     * it burns blind, which is what makes the choice measurable at all. */
    case 'unstable': {
      var ust = E.instabilityState();
      if (!ust) { break; }
      if (ust.stage === 'cull') {
        var ranked = ust.roots.slice();
        if (RANDOM_DRAFT) {
          ranked.sort(function () { return probeRnd() - 0.5; });
        } else {
          ranked.sort(function (a, b) { return faceWorth(a) - faceWorth(b); });
        }
        // the floor, then keep feeding while the next one up is cheap
        var take = ust.required;
        while (take + 2 <= ranked.length && faceWorth(ranked[take]) + faceWorth(ranked[take + 1]) < BID_STEP) take += 2;
        for (var ui = 0; ui < take; ui++) E.instabilityToggle(ranked[ui]);
        var uwhy = E.instabilityCommit();
        if (uwhy) {          // under-bid somehow: top up to the floor and retry
          var st2 = E.instabilityState();
          for (var uj = 0; uj < st2.roots.length && E.instabilityState().chosen.length < st2.required; uj++) {
            E.instabilityToggle(st2.roots[uj]);
          }
          E.instabilityCommit();
        }
        break;
      }
      if (ust.stage === 'pick') {
        E.instabilityPick(RANDOM_DRAFT
          ? ust.offer[Math.floor(probeRnd() * ust.offer.length)]
          : ust.offer[0]);
        break;
      }
      // place it: the highest legal face, where a steering class will reach it
      var placed = false;
      for (var uf = VS.dieSides(E.run.die); uf >= 1; uf--) {
        if (!VS.dieCanEngrave(E.run.die, ust.picked, uf) && !E.instabilityPlace(uf)) { placed = true; break; }
      }
      if (!placed) {   // nowhere legal at all: scrub a face to make room
        var rr = E.cullableRoots();
        if (rr.length) { VS.dieScrub(E.run.die, rr[0]); }
        else { E.run.unstable = null; E.run.phase = 'sector-intro'; }
      }
      break;
    }
    case 'first-mark': E.takeFirstMark(FIRST_MARK_PICK % Math.max(1, E.firstMarkOffers().length)); break;
    case 'sector-intro': E.beginSector(); break;
    /* Victory ENDS the run now — one ladder, climbed by starting again. The bot
     * takes the Heart when it is offered, because that is the interesting path
     * and the rating has already cleared either way. */
    case 'victory':
      /* claimVictory() nulls E.run, and everything downstream reads it for
       * stats — so the sim marks the run finished instead. The win is already
       * recorded by then: winCombat sets r.won and clears the rating. */
      if (E.heartOpen && E.heartOpen()) E.enterHeart();
      else E.run.over = true;
      break;
    default:
      throw new Error('unknown phase: ' + r.phase);
  }
}

function sanity() {
  var r = E.run;
  if (r.hp > r.maxHp) throw new Error('hp > maxHp');
  if (r.credits < 0) throw new Error('negative credits');
  if (E.combat) {
    if (E.combat.energy < 0) throw new Error('negative energy');
    E.combat.enemies.forEach(function (e) {
      if (e.alive && e.hp <= 0) throw new Error('alive enemy with hp<=0');
    });
  }
}

/* What one roll of a barrel is worth. Deliberately crude — it must be no
 * cleverer than the card bot it is measured against, or the draft gate stops
 * comparing like with like. Bulwark counts nearly full because it does not
 * expire; block only counts when a hit is actually coming. */
function engFaceValue(g, wantD) {
  if (!g) return 0;
  var v = 0;
  (g.fx || []).forEach(function (f) {
    if (f.k === 'dmg') v += (f.v || 0) * (f.all ? 1.6 : 1);
    else if (f.k === 'block') v += (f.v || 0) * (wantD ? 1.1 : 0.2);
    else if (f.k === 'status' && f.s === 'bulwark') v += (f.v || 0) * 0.95;
    else if (f.k === 'status' && (f.s === 'vuln' || f.s === 'weak')) v += (f.v || 0) * 3;
    else if (f.k === 'status' && f.who === 'self') v += (f.v || 0) * 2;
    else if (f.k === 'draw') v += 3;
    else if (f.k === 'energy') v += 5;
    else if (f.k === 'heal') v += (f.v || 0) * 0.8;
    else if (f.k === 'hploss') v -= (f.v || 0) * 1.2;
    else if (f.k === 'special') v += 6;      // cash-outs and wall tricks, unpriced
  });
  return v;
}
/* What one engraved ROOT is worth, for the instability's burn-worst-first.
 * Scored as the drop in the die's expected roll if that face went away, which
 * counts the bleed it feeds its neighbours as well as the face itself. */
function faceWorth(face) {
  var die = E.run.die, slot = die.faces[face];
  if (!slot) return 0;
  var probe = { sides: die.sides, role: die.role, seams: JSON.parse(JSON.stringify(die.seams || {})),
                welds: (die.welds || []).slice(), faces: JSON.parse(JSON.stringify(die.faces)) };
  VS.dieScrub(probe, face);
  /* BOTH LENSES, AND THE FACE IS WORTH WHAT IT IS BEST AT.
   *
   * This scored the offence lens only (wantD false), under which engFaceValue
   * prices `block` at 0.2x — a five-fold penalty. The Technomancer's die table
   * SCALES Shield, so his defensive cuts are the build, and a bot culling on
   * an offence-only lens burned his best faces first at every sector boundary.
   * He measured five points behind on the mixed 900-run because of it.
   *
   * Taking the max rather than averaging is deliberate: you do not sacrifice
   * your best shield face merely because it is not also a good damage face. */
  var worst = 0;
  [false, true].forEach(function (wantD) {
    var drop = dieRollEV(die, wantD, null) - dieRollEV(probe, wantD, null);
    if (drop > worst) worst = drop;
  });
  return worst;
}
// How much expected roll the bot will give up to climb one permanent tier.
var BID_STEP = 3.5;
// What a face has to be worth before the bot spends an Energy to reach it.
// An Energy is roughly one cheap card, so this is that card's output.
var NUDGE_BAR = 7;

function dieRollEV(die, wantD, target) {
  var E = VS.engine, c = E.combat;
  // base payload, read through the class table the same way the engine will.
  // Also called from the reward screen, where there is no combat to read.
  var dread = E.dieRead(E.run.cls) || {};
  var bands = (dread.bands || []).slice();
  var isDef = die.role === 'defence';
  // the guard's base payload is wall, and it neither bands nor jams
  var base = isDef ? 3 : (9 + VS.engine.attr('might') + ((c && c.player.statuses.str) || 0));
  // per-die: a d6 has six faces, read on the d20 scale the tables are written for
  var total = 0, n = VS.dieSides(die);
  for (var f = 1; f <= n; f++) {
    var sc = VS.dieScale(die, f), mult = 1;
    if (isDef) mult = 1;                                    // no bands on the guard
    else if (f === 1) mult = (dread.misfire && dread.misfire.mult) || 0.5;
    else {
      for (var i = 0; i < bands.length; i++) if (sc >= bands[i].min) { mult = bands[i].mult; break; }
    }
    total += base * mult;
    var slot = die.faces[f];
    if (slot) total += engFaceValue(VS.dieEngraving(slot.id), wantD);
  }
  return total / n;
}

/* ---- one full bot run; returns the finished run state ------------------ */
var FIRST_MARK_PICK = 0;
function playOneRun(cls, seed, markPick) {
  FIRST_MARK_PICK = markPick || 0;
  _probeRs = (seed >>> 0) || 1;
  E.seed(seed >>> 0);
  E.newRun(cls);
  var steps = 0, s1min = 1, s1fight = 1;
  while (E.run.phase !== 'dead' && !E.run.over && E.run.sector <= MAX_SECTOR && steps++ < 8000) {
    step();
    sanity();
    // lowest HP fraction in sector 1 (loop 1): overall, and in regular fights only
    if (E.run.sector === 1) {
      var frac = E.run.hp / E.run.maxHp;
      s1min = Math.min(s1min, frac);
      if (E.run.nodeType === 'fight') s1fight = Math.min(s1fight, frac);
    }
    E.events.length = 0; // drain
  }
  if (steps >= 8000) {
    // "guard tripped" on its own tells you nothing — a stall is always the bot
    // sitting in one phase unable to act, so say which one and what it saw.
    var rr = E.run, cn = E.currentNode && E.currentNode();
    throw new Error('run loop guard tripped: phase=' + rr.phase + ' sector=' + rr.sector +
      ' mapRow=' + rr.mapRow + ' mapCol=' + rr.mapCol + ' nodeType=' + rr.nodeType +
      ' reachable=' + JSON.stringify((E.mapReachable() || []).map(function (n) { return n.row + ',' + n.col + ':' + n.type; })) +
      ' at=' + (cn ? cn.row + ',' + cn.col + ' edges=' + JSON.stringify(cn.edges) : 'null'));
  }
  E.run._s1min = s1min; E.run._s1fight = s1fight;
  // cumulative depth: each cleared loop counts as `finale` sectors
  E.run._depth = E.run.sector;
  return E.run;
}

var CLASSES = Object.keys(VS.BALANCE.classes);
module.exports = { playOneRun: playOneRun, botCombat: botCombat, classes: CLASSES, MAX_SECTOR: MAX_SECTOR, setPilot: setPilot, VS: VS, E: E };

// Only run the integrity checks + CLI stats when invoked directly.
if (require.main !== module) return;

/* ---- validate data integrity ------------------------------------------- */
Object.keys(VS.CARDS).forEach(function (id) {
  var c = VS.CARDS[id];
  if (!c.name || c.cost === undefined || !c.fx) throw new Error('bad card ' + id);
  VS.cardDesc(c, false, null);
  VS.cardDesc(c, true, null);
});
Object.keys(VS.ENEMIES).forEach(function (id) {
  var e = VS.ENEMIES[id];
  if (!e.moves || !e.moves.length || !e.art) throw new Error('bad enemy ' + id);
  e.moves.forEach(function (m) {
    if (m.t === 'curse' && !VS.CARDS[m.card]) throw new Error('enemy ' + id + ' curses unknown card');
  });
});
Object.keys(VS.STARTER_DECKS).forEach(function (cls) {
  VS.STARTER_DECKS[cls].forEach(function (cid) {
    if (!VS.CARDS[cid]) throw new Error('starter deck ' + cls + ' has unknown card ' + cid);
  });
});
VS.EVENTS.forEach(function (ev) {
  if (!ev.art) throw new Error('event ' + ev.id + ' has no portrait art');
  if (ev.gambleDen) return;   // custom gamble screen, no text choices
  ev.choices.forEach(function (ch) {
    if (ch.pressLuck || ch.sell || ch.op) return; // interactive loops resolve their own outcomes
    // A die check branches instead of resolving: every branch is an outcome.
    var outs = [ch.outcome, ch.success, ch.fail].filter(Boolean).concat(ch.gamble || []);
    if (ch.die) {
      ['onCut', 'onBlank', 'onWin', 'onLose', 'low', 'mid', 'high'].forEach(function (k) {
        if (ch.die[k]) outs.push(ch.die[k]);
      });
    }
    if (outs.length === 0) throw new Error('event ' + ev.id + ' choice with no outcome');
    outs.forEach(function (o) {
      if (o.fx && o.fx.card && o.fx.card !== 'random' && o.fx.card !== 'rare' && o.fx.card !== 'colorless' && !VS.CARDS[o.fx.card])
        throw new Error('event ' + ev.id + ' grants unknown card ' + o.fx.card);
      if (o.fx && o.fx.curse && !VS.CARDS[o.fx.curse])
        throw new Error('event ' + ev.id + ' grants unknown curse ' + o.fx.curse);
    });
  });
});
console.log('data integrity: OK');

/* ---- run simulations (only when invoked directly, not when require()d) ----- */
if (require.main === module) {
/* VS_PILOT pins every run to one archetype's draft, so a class deficit can be
 * read per BUILD rather than per class — which is the difference between "this
 * class is weak" and "two of its five builds are". */
if (process.env.VS_PILOT) setPilot(process.env.VS_PILOT);
// `node test/sim.js 800 voidadept` narrows the pool, so a table change to one
// class can be measured without spending 3/4 of the runs on classes it cannot
// touch. Seeds stay keyed to the run index, so two filtered runs are comparable.
var only = (process.argv[3] || '').split(',').filter(function (c) { return CLASSES.indexOf(c) >= 0; });
var classes = only.length ? only : CLASSES;
var stats = {};
var stalls = 0;
var markStats = {};
var s1mins = [], s1fights = [];   // lowest HP fraction reached in sector 1 (overall / hallway fights)
classes.forEach(function (c) { stats[c] = { sectors: [], deaths: {}, wins: 0, runs: 0 }; });

// PAIRED SEEDS: the three First Marks of a class run the SAME seeds, so a gap
// between them is the mark and not which maps and drops each happened to draw.
// Without this the mark-to-mark noise is wider than the effects being measured.
for (var run = 0; run < RUNS; run++) {
  var cls = classes[run % classes.length];
  var rep = Math.floor(run / classes.length);
  var markPick = rep % 3;
  var pairSeed = ((Math.floor(rep / 3) * 3 + classes.indexOf(cls)) * 2654435761) >>> 0;
  try {
    playOneRun(cls, pairSeed, markPick);
  } catch (e) {
    // a defensive build can stalemate a non-escalating enemy forever; the bot's
    // loop guard surfaces it. Count it rather than aborting the whole batch.
    if (e.message.indexOf('combat loop') >= 0 || e.message.indexOf('loop guard') >= 0) { stalls++; }
    else throw e;
  }
  var s = stats[cls];
  s.runs++;
  var mk = (VS.firstMarks(cls)[markPick] || {}).name || '(none)';
  var mrow = markStats[mk] || (markStats[mk] = { runs: 0, wins: 0, depth: 0, cls: cls });
  mrow.runs++;
  if (E.run.won) mrow.wins++;
  mrow.depth += (E.run._depth != null) ? E.run._depth : E.run.sector;
  if (E.run._s1min != null) s1mins.push(E.run._s1min);
  if (E.run._s1fight != null) s1fights.push(E.run._s1fight);
  // cumulative depth (== sector until you beat the Unmaker, then climbs by loop)
  var depth = (E.run._depth != null) ? E.run._depth : E.run.sector;
  s.sectors.push(depth);
  // a "win" == beat the Unmaker at least once (entered the Recurrence -> loop > 1)
  if (E.run.won) s.wins++;
  if (E.run.phase === 'dead') {
    var k = 'depth ' + depth + ' / ' + (E.run.nodeType || '?');
    s.deaths[k] = (s.deaths[k] || 0) + 1;
  }
}

console.log('\n=== ' + RUNS + ' bot runs (capped at sector ' + MAX_SECTOR + ') ===');
var allSectors = [], allDeaths = {}, s1Deaths = 0, nodeDeaths = {};
classes.forEach(function (c) {
  var s = stats[c].sectors;
  allSectors = allSectors.concat(s);
  var avg = s.reduce(function (a, b) { return a + b; }, 0) / s.length;
  var max = Math.max.apply(null, s);
  var sorted = s.slice().sort(function (a, b) { return a - b; });
  var med = sorted[Math.floor(sorted.length / 2)];
  var wr = Math.round(100 * stats[c].wins / Math.max(1, stats[c].runs));
  console.log(c + ': win ' + wr + '%, avg depth ' + avg.toFixed(2) + ', median ' + med + ', best ' + max);
  var deaths = stats[c].deaths;
  Object.keys(deaths).sort().forEach(function (k) {
    console.log('   died at ' + k + ': ' + deaths[k]);
    var m = k.match(/depth (\d+) \/ (\w+)/);
    if (m) {
      if (m[1] === '1') s1Deaths += deaths[k];
      nodeDeaths[m[2]] = (nodeDeaths[m[2]] || 0) + deaths[k];
      allDeaths[m[1]] = (allDeaths[m[1]] || 0) + deaths[k];
    }
  });
});

allSectors.sort(function (a, b) { return a - b; });
var median = allSectors[Math.floor(allSectors.length / 2)];
var totalDeaths = Object.keys(allDeaths).reduce(function (a, k) { return a + allDeaths[k]; }, 0);
var spikeDeaths = (nodeDeaths.elite || 0) + (nodeDeaths.boss || 0);
/* "reached sector 5+" died with the Recurrence: runs END at sector 4 when the
 * Unmaker falls, so it would read 0% forever and look like a collapsed curve.
 * The meaningful question now is how many runs reach the finale at all. */
var reachFinale = allSectors.filter(function (s) { return s >= VS.BALANCE.run.finale; }).length;
var s1avg = s1mins.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, s1mins.length);
var s1unscathed = s1mins.filter(function (f) { return f >= 0.97; }).length;   // dipped <3% HP
var s1chip = s1mins.filter(function (f) { return f >= 0.80; }).length;        // never below 80%
console.log('\n--- difficulty profile (StS targets in brackets) ---');
console.log('sector-1 death rate: ' + Math.round(100 * s1Deaths / RUNS) + '%   [<= ~15%]');
console.log('sector-1 lowest HP (avg): ' + Math.round(100 * s1avg) + '%   |  ' +
  Math.round(100 * s1unscathed / Math.max(1, s1mins.length)) + '% finish ~unscathed (>=97%), ' +
  Math.round(100 * s1chip / Math.max(1, s1mins.length)) + '% never drop below 80%   [aim ~25-40% unscathed]');
var fAvg = s1fights.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, s1fights.length);
var fClean = s1fights.filter(function (f) { return f >= 0.97; }).length;
console.log('sector-1 HALLWAY fights lowest HP (avg): ' + Math.round(100 * fAvg) + '%   |  ' +
  Math.round(100 * fClean / Math.max(1, s1fights.length)) + '% take ~no damage in hallways');
console.log('median sector reached: ' + median + '   [~3-4]');
console.log('reached the finale: ' + Math.round(100 * reachFinale / RUNS) + '%   [~40-55%]');
if (totalDeaths) console.log('deaths at elites/bosses: ' + Math.round(100 * spikeDeaths / totalDeaths) + '%   [>= ~55%]');
console.log('stalled combats (turtle vs non-escalating enemy): ' + stalls + ' / ' + RUNS);

/* ---- THE FIRST MARK: the three openings should be live, not one obvious pick */
console.log('\n--- first-mark parity (each mark gets a third of its class runs) ---');
classes.forEach(function (c) {
  Object.keys(markStats).filter(function (k) { return markStats[k].cls === c; }).forEach(function (k) {
    var m = markStats[k];
    console.log('   ' + (c + ':').padEnd(14) + k.padEnd(20) +
      (100 * m.wins / Math.max(1, m.runs)).toFixed(1).padStart(5) + '% win   avg depth ' +
      (m.depth / Math.max(1, m.runs)).toFixed(2) + '   (n=' + m.runs + ')');
  });
});

/* ---- class parity (StS-style: archetypes should win at similar rates) ----- */
/* THE CLOCK. Reported first because everything downstream depends on it. */
(function () {
  if (!TURNS.length) return;
  function stat(a) {
    a = a.slice().sort(function (x, y) { return x - y; });
    return { med: a[Math.floor(a.length / 2)], mean: (a.reduce(function (x, y) { return x + y; }, 0) / a.length),
             p90: a[Math.floor(a.length * 0.9)], p99: a[Math.floor(a.length * 0.99)], max: a[a.length - 1], n: a.length };
  }
  var all = stat(TURNS);
  console.log('\n--- the combat clock (' + all.n + ' fights) ---');
  console.log('turns per fight: median ' + all.med + '  mean ' + all.mean.toFixed(1) +
              '  p90 ' + all.p90 + '  p99 ' + all.p99 + '  max ' + all.max + '   [genre: hallway 4-6, boss 9-14]');
  ['fight', 'elite', 'boss'].forEach(function (k) {
    if (!TURNS_BY[k].length) return;
    var t = stat(TURNS_BY[k]);
    console.log('   ' + (k + '     ').slice(0, 6) + ': median ' + t.med + '  mean ' + t.mean.toFixed(1) + '  (n=' + t.n + ')');
  });
  if (TURNS_BY.boss.length && TURNS_BY.fight.length) {
    console.log('   boss is ' + (stat(TURNS_BY.boss).mean / stat(TURNS_BY.fight).mean).toFixed(1) +
                'x a hallway fight   [genre: ~2.3x]');
  }
  if (SEEN.length) {
    var sn = stat(SEEN);
    console.log('deck seen per fight: median ' + Math.round(sn.med * 100) + '%  mean ' + Math.round(sn.mean * 100) +
                '%   [below ~80% and drafting is a coin flip]');
  }
})();

console.log('\n--- class parity (win = beat the Unmaker) ---');
var wrList = classes.map(function (c) {
  return { c: c, wr: 100 * stats[c].wins / Math.max(1, stats[c].runs) };
}).sort(function (a, b) { return b.wr - a.wr; });
wrList.forEach(function (x) {
  console.log('   ' + x.c + ': ' + x.wr.toFixed(1) + '% win');
});
var hi = wrList[0], lo = wrList[wrList.length - 1];
var spread = hi.wr - lo.wr;
console.log('spread (strongest - weakest): ' + spread.toFixed(1) + ' pts   [<= ~8 = balanced]');
console.log('  strongest: ' + hi.c + ' (' + hi.wr.toFixed(1) + '%)  |  weakest: ' + lo.c + ' (' + lo.wr.toFixed(1) + '%)');

console.log('\nALL TESTS PASSED');
}   // end require.main === module
