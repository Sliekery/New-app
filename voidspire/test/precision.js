/* =========================================================================
 * THE PRECISION BAND'S NEW CARDS, fired on purpose.
 * Usage: node test/precision.js
 *
 * A card whose text promises a rule change and whose code does not deliver it
 * reads as a balance problem forever, because every later measurement is of
 * something that never happened. So each of the three is set up through the
 * dev hooks — which hand straight back to the real code — and then asked what
 * it actually did.
 *
 * Damage is read off the engine's own damage EVENT, not off enemy HP: the
 * first version of this test watched hp and read 0 for every attack in the
 * game, because the drone it picked was warded and absorbed the lot. The hit
 * landed; the yardstick was wrong.
 * ========================================================================= */
'use strict';
global.VS = global.VS || {};
['balance', 'cards', 'artifacts', 'dice', 'reforge', 'chassis', 'potions',
 'echoes', 'enemies', 'events', 'engine'].forEach(function (m) {
  require('../js/' + m + '.js');
});
var VS = global.VS, E = VS.engine;
var pass = 0, fail = 0;
function ok(what, cond, got) {
  if (cond) { pass++; console.log('  ok   ' + what); }
  else { fail++; console.log('  FAIL ' + what + (got !== undefined ? '  — ' + got : '')); }
}

function fight(aim) {
  E.newRun('vanguard');
  E.dev.fight(['drone_skirmisher']);
  var c = E.combat;
  c.hand.length = 0;
  if (aim) c.player.statuses.aim = aim;
  return c;
}
// play a card by id, with plenty of Energy, and report what it hit for
function play(c, id) {
  E.dev.card(id, false, 'hand');
  c.energy = 9;
  E.events.length = 0;
  var i = -1;
  for (var k = 0; k < c.hand.length; k++) if (c.hand[k].id === id) i = k;
  var played = E.playCard(i, 0);
  var dealt = 0;
  E.events.forEach(function (ev) {
    if (ev && ev.who === 'enemy' && typeof ev.amount === 'number') dealt += ev.amount;
  });
  return { played: played, dealt: dealt };
}
function aim(c) { return c.player.statuses.aim || 0; }
function wall(c) { return c.player.statuses.bulwark || 0; }

console.log('\nDEFILADE — the bank is armour, and stays in the bank');
{
  var c = fight(6);
  var wallWas = wall(c), aimWas = aim(c);
  play(c, 'defilade');
  ok('Shield rises by 3 + 2 per Aim', wall(c) - wallWas === 3 + 6 * 2,
    'bulwark ' + wallWas + ' -> ' + wall(c));
  ok('and the Aim is NOT spent', aim(c) >= aimWas, aimWas + ' -> ' + aim(c));
}

console.log('\nCOLD BORE — a longer climb, so a call from further down still lands');
{
  var c2 = fight(0);
  c2.enemies.forEach(function (e) { e.hp = e.maxHp = 1e6; });
  play(c2, 'cold_bore');
  ok('it lands as a standing rule', (c2.player.statuses.steerReach || 0) === 2);
  var longest = 0;
  for (var j = 0; j < 200; j++) {
    c2.player.statuses.aim = 5;
    play(c2, 'long_shot');
    E.events.forEach(function (x) { if (x && x.type === 'steer') longest = Math.max(longest, x.spent); });
  }
  ok('a call walks up to 5 faces with it', longest === 5, 'longest walk ' + longest);
}

console.log('\nWITHOUT Cold Bore the walk stops at ' + VS.BALANCE.dice.steerCap);
{
  var c5 = fight(0), longest5 = 0;
  c5.enemies.forEach(function (e) { e.hp = e.maxHp = 1e6; });
  for (var j5 = 0; j5 < 200; j5++) {
    c5.player.statuses.aim = 5;
    play(c5, 'long_shot');
    E.events.forEach(function (x) { if (x && x.type === 'steer') longest5 = Math.max(longest5, x.spent); });
  }
  ok('no walk is longer than the cap', longest5 === VS.BALANCE.dice.steerCap, 'longest walk ' + longest5);
  var c7 = fight(0), dry = { dealt: 99 };
  // a roll that lands under 18 with no Aim to walk it: the pistol shot
  for (var j7 = 0; j7 < 20 && dry.dealt >= 12; j7++) { c7.player.statuses.aim = 0; dry = play(c7, 'long_shot'); }
  ok('and fired dry it is still scraps', dry.dealt > 0 && dry.dealt < 12, 'dealt ' + dry.dealt);
}

console.log('\nENFILADE — the common the band did not have');
{
  /* Deltas, not absolutes: playing ANY card rolls the die, and a face that
   * fires can hand you Aim of its own. The first version asserted aim === 1
   * and read 3, which was the die doing its job. */
  var c8 = fight(0);
  var w8 = wall(c8), a8 = aim(c8);
  play(c8, 'enfilade');
  ok('Shield rises by 5', wall(c8) - w8 === 5, w8 + ' -> ' + wall(c8));
  ok('and it banks at least a point of Aim', aim(c8) - a8 >= 1, a8 + ' -> ' + aim(c8));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
