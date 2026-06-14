/* =========================================================================
 * VOIDSPIRE — mechanics unit tests.
 * Asserts the build-defining keywords resolve correctly, including the rule
 * that Powers are consumed (removed from the deck for the rest of combat).
 * Usage: node test/mechanics.js
 * ========================================================================= */
'use strict';
global.VS = global.VS || {};
require('../js/balance.js');
require('../js/cards.js');
require('../js/artifacts.js');
require('../js/enemies.js');
require('../js/events.js');
require('../js/engine.js');

var E = VS.engine;
var fails = 0;
function ok(name, cond) {
  console.log((cond ? '  ok  ' : ' FAIL ') + name);
  if (!cond) fails++;
}

function startFight(cls) {
  E.seed(123);
  E.newRun(cls || 'vanguard');
  E.run.faction = 'hierarchy';
  E.run.nodeIdx = 0;
  E.startNode('fight');
}
function setHand(ids) {
  E.combat.hand = ids.map(function (id, i) { return { uid: 1000 + i, id: id, up: false }; });
}
function playId(id, tgt) {
  var i = E.combat.hand.findIndex(function (c) { return c.id === id; });
  return E.playCard(i, tgt === undefined ? 0 : tgt);
}
function bigEnemies() { E.combat.enemies.forEach(function (e) { e.hp = 100; e.maxHp = 100; e.block = 0; }); }

/* 1. Powers are consumed, not recycled (the reported bug) */
startFight('vanguard');
setHand(['combat_stims']);
playId('combat_stims');
ok('power applies its effect', (E.combat.player.statuses.str || 0) > 0);
ok('power does NOT go to discard', !E.combat.discard.some(function (c) { return c.id === 'combat_stims'; }));
ok('power does NOT go to draw pile', !E.combat.drawPile.some(function (c) { return c.id === 'combat_stims'; }));
ok('power goes to the consumed pile', E.combat.consumed.some(function (c) { return c.id === 'combat_stims'; }));

/* 2. Limit Break doubles Might */
startFight('vanguard');
E.combat.player.statuses.str = 4;
setHand(['limit_break']);
playId('limit_break');
ok('Limit Break doubles Might (4 -> 8)', E.combat.player.statuses.str === 8);

/* 3. Catalyst doubles Burn */
startFight('voidadept');
E.combat.enemies[0].statuses.burn = 5;
setHand(['catalyst']);
playId('catalyst', 0);
ok('Catalyst doubles Burn (5 -> 10)', E.combat.enemies[0].statuses.burn === 10);

/* 4. Echo Core: first attack each turn plays twice */
startFight('technomancer');
E.combat.player.statuses.echo = 1;
E.combat.echoReady = true;
bigEnemies();
var hp0 = E.combat.enemies[0].hp;
setHand(['pulse_rifle', 'pulse_rifle']);
playId('pulse_rifle', 0);
var d1 = hp0 - E.combat.enemies[0].hp;
var hp1 = E.combat.enemies[0].hp;
playId('pulse_rifle', 0);
var d2 = hp1 - E.combat.enemies[0].hp;
ok('Echo doubles the first attack (' + d1 + ' vs ' + d2 + ')', d1 >= d2 * 1.8);

/* 5. Corruption: skills cost 0 and exhaust */
startFight('vanguard');
E.combat.player.statuses.corruption = 1;
E.combat.energy = 0;
setHand(['combat_shield']);
var info = E.cardInfo(E.combat.hand[0]);
var played = E.playCard(0, 0);
ok('Corruption makes skills cost 0', info.cost === 0);
ok('Corruption lets a skill play at 0 energy', played === true);
ok('Corruption exhausts the skill', E.combat.exhaust.some(function (c) { return c.id === 'combat_shield'; }));

/* 6. Blade Array (A Thousand Cuts): any card hits all enemies */
startFight('voidadept');
bigEnemies();
E.combat.player.statuses.thousandCuts = 2;
var before = E.combat.enemies.map(function (e) { return e.hp; });
setHand(['combat_shield']);
playId('combat_shield');
ok('Blade Array chips ALL enemies on any card', E.combat.enemies.every(function (e, i) { return e.hp < before[i]; }));

/* 7. Iron Resolve (Feel No Pain): gain Shield when a card exhausts */
startFight('vanguard');
E.combat.player.statuses.feelNoPain = 3;
E.combat.player.block = 0;
setHand(['med_stim']); // med_stim has exhaust
playId('med_stim');
ok('Feel No Pain grants Shield on exhaust', E.combat.player.block >= 3);

/* 8. Entrench doubles Shield */
startFight('technomancer');
E.combat.player.block = 10;
setHand(['entrench_field']);
playId('entrench_field');
ok('Entrench doubles Shield (10 -> 20)', E.combat.player.block === 20);

/* 9. Retain: a Retain card stays in hand through end of turn (check by uid,
 * since the next turn draws a fresh hand that may re-draw other copies) */
startFight('vanguard');
setHand(['guard_protocol', 'pulse_rifle']); // uids 1000, 1001
E.endTurn();
ok('Retain keeps that exact card in hand', E.combat.hand.some(function (c) { return c.uid === 1000; }));
ok('non-Retain card left hand at end of turn', !E.combat.hand.some(function (c) { return c.uid === 1001; }));

console.log('\n' + (fails === 0 ? 'ALL MECHANIC TESTS PASSED' : fails + ' MECHANIC TESTS FAILED'));
process.exit(fails === 0 ? 0 : 1);
