/* =========================================================================
 * THE DIE INVARIANT, ACROSS REAL RUNS
 * Usage: node test/dieinvariant.js [runs]
 *
 * engine.js states one rule about the die — every face points at a root that
 * still exists — and leans on it in eighteen places that reach through
 * faces[slot.root].id without a guard. When it broke, the symptom was a
 * TypeError in an event payout about one run in two thousand: rare enough to
 * clear every suite, common enough to reach players.
 *
 * mechanics.js proves dieRepair() fixes a shape handed to it. This proves the
 * shape never gets broken in the first place, by playing real runs and
 * checking after every engine verb. The two are not the same claim.
 * ========================================================================= */
'use strict';
/* sim.js loads the engine itself and returns early unless it is the entry
 * point — `if (require.main !== module) return` — so requiring it does NOT
 * play anything. An earlier version of this probe required it and reported a
 * confident "no verb broke the invariant" over zero runs. Drive playOneRun. */
var sim = require('./sim.js');
var E = sim.E;

var breaks = {};      // verb -> { n, eg }
var calls = 0;

Object.keys(E).forEach(function (k) {
  if (typeof E[k] !== 'function' || k === 'dieRepair' || k === 'dieDangling') return;
  var orig = E[k];
  E[k] = function () {
    var before = E.dieDangling().length;
    calls++;
    var out = orig.apply(this, arguments);
    var after = E.dieDangling();
    if (after.length && !before) {
      breaks[k] = breaks[k] || { n: 0, eg: after.join(',') };
      breaks[k].n++;
    }
    return out;
  };
});

var RUNS = parseInt(process.argv[2] || '400', 10);
var crashed = null, played = 0;
for (var i = 0; i < RUNS && !crashed; i++) {
  try {
    sim.playOneRun('vanguard', (i * 2654435761 + 12345) >>> 0, i % 3);
    played++;
  } catch (e) {
    crashed = e;
  }
}

var ks = Object.keys(breaks);
console.log('\n=== THE DIE INVARIANT ===');
console.log(played + ' vanguard runs, ' + calls + ' engine calls checked');
if (crashed) {
  console.log('\nTHE RUN CRASHED: ' + crashed.message);
  console.log(String(crashed.stack || '').split('\n').slice(1, 4).join('\n'));
}
if (!ks.length) console.log('no verb left a dangling root');
else ks.sort(function (a, b) { return breaks[b].n - breaks[a].n; }).forEach(function (k) {
  console.log('  ' + k + '  broke it x' + breaks[k].n + '   e.g. face ' + breaks[k].eg);
});

if (!calls) {
  console.log('\nNOTHING WAS MEASURED — the probe never saw an engine call');
  process.exit(1);
}
if (crashed || ks.length) {
  console.log('\n' + (ks.length ? ks.length + ' VERB(S) LEAVE THE DIE BROKEN' : 'A RUN DIED'));
  process.exit(1);
}
console.log('\nTHE DIE INVARIANT HELD');
