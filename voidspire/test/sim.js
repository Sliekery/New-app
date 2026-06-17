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
 require('../js/augments.js');
require('../js/potions.js');
require('../js/echoes.js');
require('../js/enemies.js');
require('../js/events.js');
require('../js/engine.js');

var VS = global.VS;
var E = VS.engine;

var RUNS = parseInt(process.argv[2] || '60', 10);
var MAX_SECTOR = 10; // stop "endless" runs here for stats
var MAX_LOOP = 8;    // stop the Recurrence here for stats (bounds runtime)
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
    if (f.k === 'special' && f.id === 'cull') {
      // CULL: sacrifice the whole pack, f.v damage per pet (Butcher finisher).
      var pets = (c.allies || []).filter(function (a) { return a.alive; }).length;
      total += f.v * pets;
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

function botCombat() {
  var E = VS.engine;
  var guard = 0;
  while (E.run.phase === 'combat' && guard++ < 400) {
    var c = E.combat;
    if (c.over || aliveIdx().length === 0) break;
    // Warpcaller: keep a sensible formation — tank front, healer behind it,
    // support mid, attackers in the back (a competent player would position).
    if (E.run.cls === 'warpcaller' && c.allies.length > 1) {
      if (PILOT === 'butcher') {
        // feed the grinder: the most expendable (fragile) bodies go up front to
        // die — that's where Symbiosis / Bloodscent / Spawnling bursts come from.
        c.allies.sort(function (a, b) { return a.maxHp - b.maxHp; });
      } else {
        // tank front, healer behind it, support mid, attackers (and the apex) safe in back.
        var PRI = { block: 0, heal: 1, support: 2, burn: 3, attack: 4 };
        c.allies.sort(function (a, b) { return (PRI[a.def.act.t] == null ? 9 : PRI[a.def.act.t]) - (PRI[b.def.act.t] == null ? 9 : PRI[b.def.act.t]); });
      }
    }
    var playable = [];
    for (var i = 0; i < c.hand.length; i++) if (E.canPlay(i)) playable.push(i);
    if (playable.length === 0) { E.endTurn(); continue; }

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

    // 3. powers + pet-summons early (a Warpcaller lives or dies by its pack),
    //    then best attack, then anything
    if (choice < 0) {
      var nPets = c.allies.filter(function (a) { return a.alive; }).length;
      var pw = playable.filter(function (idx) {
        var def = VS.CARDS[c.hand[idx].id];
        if (def.type === 'power') return true;
        var fx = VS.cardFx(def, c.hand[idx].up);
        return fx.some(function (f) {
          if (f.k === 'pet') return true;
          if (f.k === 'status' && (f.s === 'pack' || f.s === 'symbiosis' || f.s === 'brood' || f.s === 'bloodscent' || f.s === 'bulwark')) return true;
          // funnel/utility specials are only worth it once you have a pack to act on
          if (f.k === 'special' && (f.id === 'feed' || f.id === 'empower' || f.id === 'packshield') && nPets >= 1) return true;
          if (f.k === 'special' && f.id === 'frenzy' && nPets >= 2) return true;  // pack acts again — needs a board
          return false;
        });
      });
      if (pw.length && (c.turn <= 3 || E.run.cls === 'warpcaller')) choice = pw[0];
    }
    if (choice < 0) {
      var ba = -1, bd = -1, nLive = c.allies ? c.allies.filter(function (a) { return a.alive; }).length : 0;
      playable.forEach(function (idx) {
        var cdef = VS.CARDS[c.hand[idx].id];
        if (cdef.type !== 'attack') return;
        // Cull discipline: don't blow the whole pack as a chip attack — hold it
        // until the pack is big enough to make the sacrifice pay (or it's lethal,
        // which the kill tier above already handles).
        if (cdef.fx.some(function (f) { return f.k === 'special' && f.id === 'cull'; }) && nLive < 4) return;
        // DoT-aware: lay/stack Burn proactively instead of treating it as 0 dmg
        var dmg = estCardDamage(card0(c, idx), c.enemies[target], true);
        if (dmg > bd) { bd = dmg; ba = idx; }
      });
      if (ba >= 0) choice = ba;
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
  if (guard >= 400) throw new Error('combat loop guard tripped (sector ' + E.run.sector + ')');
}
function card0(c, idx) { return c.hand[idx]; }

var CLASS_ATTR = { vanguard: 'might', technomancer: 'tech', voidadept: 'psi' };

// ---- Warpcaller archetype piloting (for measuring per-build ceilings) -------
// The Warpcaller's three builds. When PILOT is set, the bot drafts that build's
// cards (and shuns the others) so we can see how each archetype performs when a
// player actually commits to it, rather than the greedy grab-bag of the parity run.
// Class build engines: { cls, core (draft toward), flex (welcome) }. When PILOT
// names one, the bot commits to it so we can measure the build's ceiling instead
// of the greedy grab-bag. Reusable across classes.
var ENGINES = {
  // Warpcaller archetypes
  wall:    { cls: 'warpcaller', core: ['summon_warden', 'summon_leech', 'entrench', 'aegis', 'summon_behemoth'] },
  alpha:   { cls: 'warpcaller', core: ['summon_dire', 'savage_feast', 'feed_the_alpha', 'pack_frenzy', 'apex_predator'] },
  butcher: { cls: 'warpcaller', core: ['summon_stinger', 'bloodbond', 'spawn_brood', 'symbiotic_bond', 'feeding_frenzy', 'overgrowth', 'cull_the_weak', 'the_swarmlord'] },
  // Vanguard engines
  fusillade: { cls: 'vanguard', core: ['rapid_fire', 'trigger_discipline', 'hail_of_lead', 'full_auto', 'unload', 'burst_fire', 'frenzy', 'reckless_charge'],
               flex: ['pulse_rifle', 'combat_shield', 'war_cry', 'suppressing_fire', 'bayonet_charge', 'brace', 'reload', 'rallying_shout', 'munitions_dump'] },
  bloodforge: { cls: 'vanguard', core: ['blood_rage', 'deflect', 'vengeance', 'counterstrike', 'crimson_pact', 'whet_the_blade', 'bloodbath', 'frenzy', 'limit_break', 'heavy_ordnance', 'combat_stims', 'bloodlust'],
                flex: ['pulse_rifle', 'war_cry', 'rallying_shout', 'bayonet_charge', 'executioner', 'adrenal_surge'] },
  bandolier: { cls: 'vanguard', core: ['salvo', 'reload', 'quartermaster', 'breaching_charge', 'field_strip', 'cluster_charge', 'scorched_earth', 'iron_resolve', 'salvage_protocol', 'reckless_charge', 'limit_break', 'adrenal_surge'],
               flex: ['pulse_rifle', 'combat_shield', 'munitions_dump', 'bayonet_charge', 'brace', 'reload'] },
  // Voidadept affliction/Burn engine
  hex: { cls: 'voidadept', core: ['soul_burn', 'hex_weave', 'wither', 'catalyst', 'entropy_field', 'plague_engine', 'singularity_bloom', 'psionic_focus', 'mind_array', 'unravel', 'void_bolt', 'mind_fracture'],
         flex: ['mind_spike', 'premonition', 'blood_sacrifice', 'exsanguinate', 'psy_lance', 'combat_shield'] },
};
var FLEX_OF = { warpcaller: ['claw_swipe', 'summon_maw', 'howl', 'kennel', 'summon_totem'] };  // per-class default flex
var PILOT = null;   // an ENGINES key — null = default greedy draft
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
    if (ch.check) {
      var bonus = VS.engine.attr(ch.check.attr);
      var p = Math.max(0.05, Math.min(0.95, (21 - (ch.check.dc - bonus)) / 20));
      var failFx = (ch.fail && ch.fail.fx) || {};
      var failPenalty = (failFx.hp ? -failFx.hp / 3 : 0) + (failFx.curse ? 8 : 0);
      s = s * p - failPenalty * (1 - p);
      if (low && failFx.hp) s -= 4;
    }
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
      var bi = -1, bs = 0;
      r.reward.cards.forEach(function (cid, i) {
        var s = scoreRewardCard(cid);
        if (s > bs) { bs = s; bi = i; }
      });
      if (bi >= 0) E.takeRewardCard(bi);
      E.finishReward();
      break;
    }
    case 'event': {
      var ev = E.getEvent();
      if (!ev) throw new Error('no current event');
      if (ev.gambleDen) {   // bet 25% when flush, else walk
        var gi = E.gambleInfo();
        if (r.credits >= 60) { E.gamblePlay(0.25); E.gambleClaim(); }
        E.gambleFinish();
        break;
      }
      var res = E.eventChoose(eventChoiceIdx(ev));
      if (!res) throw new Error('eventChoose returned null');
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
    case 'levelup': {
      // augment draft: a competent player heals when low, otherwise takes a
      // straightforward module/stat and avoids pacts & fiddly deck-ops
      var offer = E.augmentChoices();
      var low = r.hp < r.maxHp * 0.45;
      var simple = offer.filter(function (id) { var g = VS.AUGMENTS[id]; return g.kind !== 'pact' && g.kind !== 'deckop'; });
      var heals = offer.filter(function (id) { return VS.AUGMENTS[id].kind === 'heal'; });
      var chosen = (low && heals.length) ? heals[0] : (simple[0] || offer[0]);
      E.chooseAugment(chosen);
      if (E.run.augmentDeckop) {
        var op = E.run.augmentDeckop;
        if (op === 'remove') { E.run.pendingPick = 'remove'; E.applyPick(pickRemoveIdx()); }
        else if (op === 'upgrade2') { E.run.pendingPick = 'upgrade'; E.applyPick(pickUpgradeIdx()); E.run.pendingPick = 'upgrade'; E.applyPick(pickUpgradeIdx()); }
        else if (op === 'addCard') { var add = E.augmentAddOptions(); if (add.length) E.augmentAddCard(add[0]); }
        E.finishAugment();
      }
      break;
    }
    case 'class-relic': {
      var crel = (E.classChain && E.classChain()) ? E.classChain().relics : [];
      var crp = bestRelic(crel);
      E.takeClassRelic(crp.idx); E.finishClassRelic();
      break;
    }
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
    case 'sector-intro': E.beginSector(); break;
    case 'victory': E.enterRecurrence(); break;          // beat the finale -> next loop
    case 'recurrence-intro': E.recurrenceContinue(); break;
    case 'echo-draft': {
      // greedy: take the first offered Echo (the bot under-drafts, like augments)
      var off = E.echoOffer();
      E.chooseEcho(off[0]);
      break;
    }
    case 'echo-loadout': E.beginLoop(); break;           // loadout auto-filled; descend
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

/* ---- one full bot run; returns the finished run state ------------------ */
function playOneRun(cls, seed) {
  E.seed(seed >>> 0);
  E.newRun(cls);
  var steps = 0, s1min = 1, s1fight = 1;
  while (E.run.phase !== 'dead' && E.run.sector <= MAX_SECTOR && (E.run.loop || 1) <= MAX_LOOP && steps++ < 8000) {
    step();
    sanity();
    // lowest HP fraction in sector 1 (loop 1): overall, and in regular fights only
    if ((E.run.loop || 1) === 1 && E.run.sector === 1) {
      var frac = E.run.hp / E.run.maxHp;
      s1min = Math.min(s1min, frac);
      if (E.run.nodeType === 'fight') s1fight = Math.min(s1fight, frac);
    }
    E.events.length = 0; // drain
  }
  if (steps >= 8000) throw new Error('run loop guard tripped');
  E.run._s1min = s1min; E.run._s1fight = s1fight;
  // cumulative depth: each cleared loop counts as `finale` sectors
  E.run._depth = (E.run.loop - 1) * VS.BALANCE.run.finale + E.run.sector;
  return E.run;
}

var CLASSES = Object.keys(VS.BALANCE.classes);
module.exports = { playOneRun: playOneRun, botCombat: botCombat, classes: CLASSES, MAX_SECTOR: MAX_SECTOR, MAX_LOOP: MAX_LOOP, setPilot: setPilot, VS: VS, E: E };

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
    if (ch.pressLuck || ch.sell) return; // interactive loops resolve their own outcomes
    var outs = [ch.outcome, ch.success, ch.fail].filter(Boolean).concat(ch.gamble || []);
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
var classes = CLASSES;
var stats = {};
var stalls = 0;
var s1mins = [], s1fights = [];   // lowest HP fraction reached in sector 1 (overall / hallway fights)
classes.forEach(function (c) { stats[c] = { sectors: [], deaths: {}, wins: 0, runs: 0 }; });

for (var run = 0; run < RUNS; run++) {
  var cls = classes[run % classes.length];
  try {
    playOneRun(cls, (run * 2654435761) >>> 0);
  } catch (e) {
    // a defensive build can stalemate a non-escalating enemy forever; the bot's
    // loop guard surfaces it. Count it rather than aborting the whole batch.
    if (e.message.indexOf('combat loop') >= 0) { stalls++; }
    else throw e;
  }
  var s = stats[cls];
  s.runs++;
  if (E.run._s1min != null) s1mins.push(E.run._s1min);
  if (E.run._s1fight != null) s1fights.push(E.run._s1fight);
  // cumulative depth (== sector until you beat the Unmaker, then climbs by loop)
  var depth = (E.run._depth != null) ? E.run._depth : ((E.run.loop - 1) * VS.BALANCE.run.finale + E.run.sector);
  s.sectors.push(depth);
  // a "win" == beat the Unmaker at least once (entered the Recurrence -> loop > 1)
  if ((E.run.loop || 1) > 1) s.wins++;
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
var reach5 = allSectors.filter(function (s) { return s >= 5; }).length;
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
console.log('reached sector 5+: ' + Math.round(100 * reach5 / RUNS) + '%   [~15-30%]');
if (totalDeaths) console.log('deaths at elites/bosses: ' + Math.round(100 * spikeDeaths / totalDeaths) + '%   [>= ~55%]');
console.log('stalled combats (turtle vs non-escalating enemy): ' + stalls + ' / ' + RUNS);

/* ---- class parity (StS-style: archetypes should win at similar rates) ----- */
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
