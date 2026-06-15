/* =========================================================================
 * VOIDSPIRE — Warpcaller archetype ceiling test.
 * Pilots each of the three Warpcaller builds ON PURPOSE: the bot drafts that
 * archetype's cards and shuns the others, so we measure how each build does
 * when a player commits to it (a ceiling), not the greedy grab-bag of the
 * parity sim.
 * Usage: node test/pilot.js [runsPerArchetype]
 * ========================================================================= */
'use strict';

var sim = require('./sim.js');
var VS = sim.VS, E = sim.E;
var PER = parseInt(process.argv[2] || '400', 10);
var FINALE = VS.BALANCE.run.finale;

var BUILDS = ['wall', 'alpha', 'butcher'];
// a baseline: warpcaller with NO pilot bias (the greedy draft, same as parity sim)
var ALL = ['(greedy baseline)'].concat(BUILDS);

function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }

console.log('\n===== WARPCALLER ARCHETYPE CEILINGS — ' + PER + ' runs each =====\n');
console.log('  build               win%   S4+%   S5+%   avg depth   median   best');

ALL.forEach(function (label) {
  var pilot = BUILDS.indexOf(label) >= 0 ? label : null;
  sim.setPilot(pilot);
  var depths = [], wins = 0, s4 = 0, s5 = 0;
  for (var i = 0; i < PER; i++) {
    var run;
    try { run = sim.playOneRun('warpcaller', ((BUILDS.indexOf(label) + 2) * 1000003 + i) * 2654435761 >>> 0); }
    catch (e) { if (e.message.indexOf('combat loop') >= 0) { run = E.run; } else throw e; }
    var depth = (run._depth != null) ? run._depth : ((run.loop - 1) * FINALE + run.sector);
    depths.push(depth);
    if ((run.loop || 1) > 1) wins++;       // beat the Unmaker
    if (depth >= 4) s4++;                   // reached the finale
    if (depth >= 5) s5++;                   // pushed into the Recurrence
  }
  console.log(
    '  ' + label.padEnd(20) +
    String(Math.round(100 * wins / PER)).padStart(3) + '%  ' +
    String(Math.round(100 * s4 / PER)).padStart(4) + '%  ' +
    String(Math.round(100 * s5 / PER)).padStart(4) + '%  ' +
    mean(depths).toFixed(2).padStart(9) + '   ' +
    String(median(depths)).padStart(6) + '   ' +
    String(Math.max.apply(null, depths)).padStart(4));
});
sim.setPilot(null);
console.log('\n(win% = beat the Unmaker. The three builds should all be viable —');
console.log(' similar win rates means no single archetype dominates or is a trap.)');
