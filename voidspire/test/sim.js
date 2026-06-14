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

function estCardDamage(card, target) {
  var def = VS.CARDS[card.id];
  var fx = VS.cardFx(def, card.up);
  var c = VS.engine.combat;
  var str = (c.player.statuses.str || 0);
  var total = 0;
  fx.forEach(function (f) {
    if (f.k === 'dmg') {
      var v = f.v + attrOf(f.scale) * (f.scaleMul || 1) + str;
      if (f.scale === 'psi') v += (c.player.statuses.psiPow || 0);
      var hits = f.hits || 1;
      if (target && (target.statuses.vuln || 0) > 0) v = Math.floor(v * VS.BALANCE.status.vulnMult);
      total += v * hits;
    }
    if (f.k === 'special' && (f.id === 'shieldSlam' || f.id === 'shieldSlam15')) {
      total += Math.floor(c.player.block * (f.id === 'shieldSlam15' ? 1.5 : 1));
    }
  });
  if ((c.player.statuses.weak || 0) > 0) total = Math.floor(total * VS.BALANCE.status.weakMult);
  return total;
}

function estCardBlock(card) {
  var def = VS.CARDS[card.id];
  var fx = VS.cardFx(def, card.up);
  var total = 0;
  fx.forEach(function (f) {
    if (f.k === 'block') total += f.v + (f.scale === 'tech' ? VS.engine.attr('tech') : 0);
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
    var playable = [];
    for (var i = 0; i < c.hand.length; i++) if (E.canPlay(i)) playable.push(i);
    if (playable.length === 0) { E.endTurn(); continue; }

    var incoming = incomingDamage();
    var needBlock = Math.max(0, incoming - c.player.block);
    var hpDanger = E.run.hp < E.run.maxHp * 0.6 || needBlock >= E.run.hp * 0.25;
    var choice = -1, target = pickTarget();

    // 1. finish a kill if possible
    var best = -1, bestOver = 1e9;
    playable.forEach(function (idx) {
      var card = c.hand[idx];
      if (VS.CARDS[card.id].type !== 'attack') return;
      var tEn = c.enemies[target];
      var dmg = estCardDamage(card, tEn);
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
        if (VS.CARDS[c.hand[idx].id].type !== 'attack') return;
        var dmg = estCardDamage(card0(c, idx), c.enemies[target]);
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

function scoreRewardCard(cid) {
  var def = VS.CARDS[cid];
  var s = def.rarity * 3;
  if (def.cls === VS.engine.run.cls) s += 2;
  if (VS.engine.run.deck.length > 22 && def.rarity === 1) s -= 6;
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

function eventChoiceIdx(ev) {
  var r = VS.engine.run;
  var low = r.hp < r.maxHp * 0.45;
  var bestI = 0, bestS = -1e9;
  ev.choices.forEach(function (ch, i) {
    if (ch.cost && r.credits < ch.cost) return;
    var s = 0;
    var out = ch.outcome || ch.success;
    var fx = (out && out.fx) || {};
    if (fx.artifact) s += 8;
    if (fx.card) s += 5;
    if (fx.attr) s += 6;
    if (fx.maxhp) s += 5;
    if (fx.credits > 0) s += fx.credits / 12;
    if (fx.healPct) s += low ? 10 : 2;
    if (fx.hp < 0) s += low ? -12 : fx.hp / 4;
    if (fx.curse) s -= 8;
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
    case 'treasure': E.finishTreasure(); break;
    case 'combat': botCombat(); break;
    case 'reward': {
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
      var res = E.eventChoose(eventChoiceIdx(ev));
      if (!res) throw new Error('eventChoose returned null');
      break;
    }
    case 'event-result':
      if (r.pendingPick) {
        E.applyPick(r.pendingPick === 'remove' ? pickRemoveIdx() : r.pendingPick === 'upgrade' ? pickUpgradeIdx() : 0);
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
  var steps = 0;
  while (E.run.phase !== 'dead' && E.run.sector <= MAX_SECTOR && steps++ < 8000) {
    step();
    sanity();
    E.events.length = 0; // drain
  }
  if (steps >= 8000) throw new Error('run loop guard tripped');
  return E.run;
}

var CLASSES = Object.keys(VS.BALANCE.classes);
module.exports = { playOneRun: playOneRun, classes: CLASSES, MAX_SECTOR: MAX_SECTOR, VS: VS, E: E };

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
  ev.choices.forEach(function (ch) {
    var outs = [ch.outcome, ch.success, ch.fail].filter(Boolean);
    if (outs.length === 0) throw new Error('event ' + ev.id + ' choice with no outcome');
    outs.forEach(function (o) {
      if (o.fx && o.fx.card && o.fx.card !== 'random' && o.fx.card !== 'rare' && !VS.CARDS[o.fx.card])
        throw new Error('event ' + ev.id + ' grants unknown card ' + o.fx.card);
      if (o.fx && o.fx.curse && !VS.CARDS[o.fx.curse])
        throw new Error('event ' + ev.id + ' grants unknown curse');
    });
  });
});
console.log('data integrity: OK');

/* ---- run simulations ----------------------------------------------------- */
var classes = CLASSES;
var stats = {};
classes.forEach(function (c) { stats[c] = { sectors: [], deaths: {} }; });

for (var run = 0; run < RUNS; run++) {
  var cls = classes[run % classes.length];
  playOneRun(cls, (run * 2654435761) >>> 0);
  var s = stats[cls];
  s.sectors.push(E.run.sector);
  if (E.run.phase === 'dead') {
    var k = 'sector ' + E.run.sector + ' / ' + (E.run.nodeType || '?');
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
  console.log(c + ': avg sector ' + avg.toFixed(2) + ', best ' + max);
  var deaths = stats[c].deaths;
  Object.keys(deaths).sort().forEach(function (k) {
    console.log('   died at ' + k + ': ' + deaths[k]);
    var m = k.match(/sector (\d+) \/ (\w+)/);
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
console.log('\n--- difficulty profile (StS targets in brackets) ---');
console.log('sector-1 death rate: ' + Math.round(100 * s1Deaths / RUNS) + '%   [<= ~15%]');
console.log('median sector reached: ' + median + '   [~3-4]');
console.log('reached sector 5+: ' + Math.round(100 * reach5 / RUNS) + '%   [~15-30%]');
if (totalDeaths) console.log('deaths at elites/bosses: ' + Math.round(100 * spikeDeaths / totalDeaths) + '%   [>= ~55%]');
console.log('\nALL TESTS PASSED');
