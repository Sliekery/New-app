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

console.log('\nCOLD BORE — the shot reads the bank instead of taking it');
{
  var c2 = fight(4);
  play(c2, 'cold_bore');
  ok('it lands as a standing rule', (c2.player.statuses.coldBore || 0) > 0);
  var aimWas2 = aim(c2);
  var shot = play(c2, 'long_shot');
  ok('Long Shot still fires LOADED, not dry', shot.dealt > 10, 'dealt ' + shot.dealt);
  ok('and the Aim survives the shot', aim(c2) >= aimWas2, aimWas2 + ' -> ' + aim(c2));
}

console.log('\n…and the ceiling it trades for');
{
  var c3 = fight(0);
  play(c3, 'cold_bore');
  for (var j = 0; j < 12; j++) play(c3, 'take_aim');
  ok('Aim is capped at ' + VS.BALANCE.dice.coldBoreCap,
    aim(c3) === VS.BALANCE.dice.coldBoreCap, 'aim ' + aim(c3));
}

console.log('\nWITHOUT Cold Bore the old rule is untouched');
{
  var c5 = fight(5);
  var shot5 = play(c5, 'long_shot');
  ok('Long Shot still fires loaded at 5 Aim', shot5.dealt > 10, 'dealt ' + shot5.dealt);
  ok('and it spends its 3 Aim as before', aim(c5) <= 2, 'aim ' + aim(c5));
  var c6 = fight(20);
  play(c6, 'take_aim');
  ok('Aim is uncapped without it', aim(c6) > VS.BALANCE.dice.coldBoreCap, 'aim ' + aim(c6));
  var c7 = fight(0);
  var dry = play(c7, 'long_shot');
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
