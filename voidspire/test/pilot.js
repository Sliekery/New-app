/* =========================================================================
 * VOIDSPIRE — build-engine ceiling test.
 * Pilots a class's build engines ON PURPOSE: the bot drafts the engine's cards
 * and shuns the rest, so we measure how the build does when a player commits to
 * it (a ceiling) vs the greedy grab-bag of the parity sim. Each engine is shown
 * against its own class's greedy baseline.
 * Usage: node test/pilot.js [runsPerEngine]
 * ========================================================================= */
'use strict';

var sim = require('./sim.js');
var VS = sim.VS, E = sim.E;
var PER = parseInt(process.argv[2] || '500', 10);
var FINALE = VS.BALANCE.run.finale;

// what to measure: a greedy baseline per class, then each engine under it.
var TESTS = [
  { key: null, cls: 'warpcaller', label: 'warpcaller (greedy)' },
  { key: 'wall', cls: 'warpcaller', label: '  Wall' },
  { key: 'alpha', cls: 'warpcaller', label: '  Alpha' },
  { key: 'butcher', cls: 'warpcaller', label: '  Butcher' },
  { key: null, cls: 'vanguard', label: 'vanguard (greedy)' },
  { key: 'fusillade', cls: 'vanguard', label: '  Fusillade' },
];

function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }

console.log('\n===== BUILD-ENGINE CEILINGS — ' + PER + ' runs each =====\n');
console.log('  build                 win%   S4+%   S5+%   avg depth   median   best');

TESTS.forEach(function (t, ti) {
  sim.setPilot(t.key);
  var depths = [], wins = 0, s4 = 0, s5 = 0;
  for (var i = 0; i < PER; i++) {
    var run;
    try { run = sim.playOneRun(t.cls, ((ti + 2) * 1000003 + i) * 2654435761 >>> 0); }
    catch (e) { if (e.message.indexOf('combat loop') >= 0) { run = E.run; } else throw e; }
    var depth = (run._depth != null) ? run._depth : ((run.loop - 1) * FINALE + run.sector);
    depths.push(depth);
    if ((run.loop || 1) > 1) wins++;       // beat the Unmaker
    if (depth >= 4) s4++;                   // reached the finale
    if (depth >= 5) s5++;                   // pushed into the Recurrence
  }
  console.log(
    '  ' + t.label.padEnd(22) +
    String(Math.round(100 * wins / PER)).padStart(3) + '%  ' +
    String(Math.round(100 * s4 / PER)).padStart(4) + '%  ' +
    String(Math.round(100 * s5 / PER)).padStart(4) + '%  ' +
    mean(depths).toFixed(2).padStart(9) + '   ' +
    String(median(depths)).padStart(6) + '   ' +
    String(Math.max.apply(null, depths)).padStart(4));
});
sim.setPilot(null);
console.log('\n(win% = beat the Unmaker. An engine above its class greedy baseline');
console.log(' means committing to the build pays off — the "building" is real.)');
