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
require('../js/enemies.js');
require('../js/events.js');
require('../js/engine.js');

var VS = global.VS;
var E = VS.engine;

var RUNS = parseInt(process.argv[2] || '60', 10);
var MAX_SECTOR = 10; // stop "endless" runs here for stats
var rand = Math.random;

function botCombat() {
  var guard = 0;
  while (E.run.phase === 'combat' && guard++ < 400) {
    var c = E.combat;
    if (c.over) break;
    // play any playable card, slight preference for attacks
    var playable = [];
    for (var i = 0; i < c.hand.length; i++) if (E.canPlay(i)) playable.push(i);
    if (playable.length === 0) { E.endTurn(); continue; }
    playable.sort(function (a, b) {
      var ta = VS.CARDS[c.hand[a].id].type === 'attack' ? 0 : 1;
      var tb = VS.CARDS[c.hand[b].id].type === 'attack' ? 0 : 1;
      return ta - tb;
    });
    var idx = playable[0];
    var alive = [];
    c.enemies.forEach(function (e, j) { if (e.alive) alive.push(j); });
    // target lowest hp
    alive.sort(function (a, b) { return c.enemies[a].hp - c.enemies[b].hp; });
    var ok = E.playCard(idx, alive[0]);
    if (!ok) E.endTurn();
  }
  if (guard >= 400) throw new Error('combat loop guard tripped (sector ' + E.run.sector + ')');
}

function step() {
  var r = E.run;
  switch (r.phase) {
    case 'node-select': E.chooseNode(rand() < 0.5 ? 0 : 1); break;
    case 'combat': botCombat(); break;
    case 'reward':
      if (rand() < 0.7) E.takeRewardCard(Math.floor(rand() * 3));
      E.finishReward();
      break;
    case 'event': {
      var ev = E.getEvent();
      if (!ev) throw new Error('no current event');
      var valid = [];
      ev.choices.forEach(function (ch, i) {
        if (ch.cost && r.credits < ch.cost) return;
        valid.push(i);
      });
      var res = E.eventChoose(valid[Math.floor(rand() * valid.length)]);
      if (!res) throw new Error('eventChoose returned null');
      break;
    }
    case 'event-result':
      if (r.pendingPick) E.applyPick(Math.floor(rand() * r.deck.length));
      E.finishEvent();
      break;
    case 'shop':
      if (rand() < 0.5) E.shopBuyCard(Math.floor(rand() * 3));
      if (rand() < 0.3) E.shopBuyArtifact();
      if (rand() < 0.3 && E.shopBuyRemove()) E.applyPick(Math.floor(rand() * r.deck.length));
      if (r.hp < r.maxHp * 0.6) E.shopBuyHeal();
      E.leaveShop();
      break;
    case 'rest':
      if (r.hp < r.maxHp * 0.65) E.restHeal();
      else { E.restUpgrade(); E.restFinishUpgrade(Math.floor(rand() * r.deck.length)); }
      break;
    case 'levelup': E.levelUp(['might', 'tech', 'psi', 'hp'][Math.floor(rand() * 4)]); break;
    case 'boss-artifact': E.takeBossArtifact(0); break;
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
var classes = Object.keys(VS.BALANCE.classes);
var stats = {};
classes.forEach(function (c) { stats[c] = { sectors: [], deaths: {} }; });

for (var run = 0; run < RUNS; run++) {
  var cls = classes[run % classes.length];
  E.seed((run * 2654435761) >>> 0);
  E.newRun(cls);
  var steps = 0;
  while (E.run.phase !== 'dead' && E.run.sector <= MAX_SECTOR && steps++ < 8000) {
    step();
    sanity();
    E.events.length = 0; // drain
  }
  if (steps >= 8000) throw new Error('run loop guard tripped');
  var s = stats[cls];
  s.sectors.push(E.run.sector);
  if (E.run.phase === 'dead') {
    var k = 'sector ' + E.run.sector + ' / ' + (E.run.nodeType || '?');
    s.deaths[k] = (s.deaths[k] || 0) + 1;
  }
}

console.log('\n=== ' + RUNS + ' bot runs (capped at sector ' + MAX_SECTOR + ') ===');
classes.forEach(function (c) {
  var s = stats[c].sectors;
  var avg = s.reduce(function (a, b) { return a + b; }, 0) / s.length;
  var max = Math.max.apply(null, s);
  console.log(c + ': avg sector ' + avg.toFixed(2) + ', best ' + max);
  var deaths = stats[c].deaths;
  Object.keys(deaths).sort().forEach(function (k) {
    console.log('   died at ' + k + ': ' + deaths[k]);
  });
});
console.log('\nALL TESTS PASSED');
