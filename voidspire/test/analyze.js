/* =========================================================================
 * VOIDSPIRE — class & build performance analysis.
 * Runs many bot games and reports which class goes deepest and which
 * archetype enablers correlate with deeper runs.
 *
 * NOTE: the bot drafts greedily (rarity + class match), not synergistically,
 * so this measures CORRELATION between owning an enabler and depth — a floor
 * on a real build's power, not optimal piloting.
 *
 * Usage: node test/analyze.js [runsPerClass]
 * ========================================================================= */
'use strict';

var sim = require('./sim.js');
var VS = sim.VS, E = sim.E;
var CLASSES = sim.classes;
var PER = parseInt(process.argv[2] || '300', 10);

// Archetype enabler sets (cards that define each build path)
var ARCHETYPES = {
  'Might/Exhaust (Vanguard)': ['heavy_ordnance', 'limit_break', 'whirlwind', 'iron_resolve', 'reckless_protocol', 'warlord_protocol', 'combat_stims', 'orbital_strike'],
  'Shield/Echo (Technomancer)': ['kinetic_discharge', 'entrench_field', 'overload_capacitor', 'echo_core', 'phase_bulwark', 'aux_reactor', 'deploy_turret', 'railgun'],
  'Burn/Spam (Void Adept)': ['catalyst', 'mind_array', 'plague_engine', 'soul_burn', 'hex_weave', 'entropy_field', 'psionic_focus', 'eldritch_storm'],
};
// Build-defining rares we want a spotlight on
var SPOTLIGHT = ['echo_core', 'mind_array', 'plague_engine', 'reckless_protocol', 'limit_break', 'catalyst', 'iron_resolve', 'overload_capacitor', 'kinetic_discharge', 'heavy_ordnance', 'whirlwind', 'salvage_protocol', 'guard_protocol'];

function deckIds(run) { return run.deck.map(function (c) { return c.id; }); }
function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }

var perClass = {};
CLASSES.forEach(function (c) { perClass[c] = []; });
var cardRuns = {};   // cardId -> [sectors of runs whose final deck had it]
var archRuns = {};   // archetype label -> [sectors]
Object.keys(ARCHETYPES).forEach(function (a) { archRuns[a] = []; });
var allByClass = {}; // class -> [sectors]

var total = 0;
for (var ci = 0; ci < CLASSES.length; ci++) {
  var cls = CLASSES[ci];
  allByClass[cls] = [];
  for (var i = 0; i < PER; i++) {
    var run = sim.playOneRun(cls, ((ci * 1000003 + i) * 2654435761) >>> 0);
    var sector = run.sector;
    var ids = deckIds(run);
    var uids = uniq(ids);
    perClass[cls].push({ sector: sector, dead: run.phase === 'dead', ids: uids });
    allByClass[cls].push(sector);

    // per-card correlation
    uids.forEach(function (id) {
      (cardRuns[id] = cardRuns[id] || []).push(sector);
    });
    // archetype label: the set with the most enablers present (>=3 to count)
    var best = null, bestN = 2;
    Object.keys(ARCHETYPES).forEach(function (a) {
      var n = ARCHETYPES[a].filter(function (id) { return uids.indexOf(id) >= 0; }).length;
      if (n > bestN) { bestN = n; best = a; }
    });
    if (best) archRuns[best].push(sector);
    total++;
  }
}

function bar(v, max, w) {
  var n = Math.round((v / max) * w);
  return new Array(n + 1).join('#') + new Array(w - n + 1).join('.');
}

console.log('\n===== VOIDSPIRE BUILD ANALYSIS — ' + total + ' runs (' + PER + ' per class) =====\n');

/* ---- class standings ---- */
console.log('CLASS STANDINGS (deeper = stronger)');
var rows = CLASSES.map(function (c) {
  var s = allByClass[c];
  return {
    cls: c,
    avg: mean(s),
    med: median(s),
    best: Math.max.apply(null, s),
    deep: Math.round(100 * s.filter(function (x) { return x >= 5; }).length / s.length),
    win: Math.round(100 * s.filter(function (x) { return x >= 4; }).length / s.length),
  };
});
rows.sort(function (a, b) { return b.avg - a.avg; });
var maxAvg = Math.max.apply(null, rows.map(function (r) { return r.avg; }));
rows.forEach(function (r, i) {
  console.log(
    '  ' + (i + 1) + '. ' + r.cls.padEnd(13) +
    ' avg ' + r.avg.toFixed(2) +
    '  median ' + r.med +
    '  best ' + r.best +
    '  reached S4+ ' + String(r.win).padStart(3) + '%' +
    '  S5+ ' + String(r.deep).padStart(3) + '%   ' + bar(r.avg, maxAvg, 16));
});

/* ---- archetype standings ---- */
console.log('\nARCHETYPE PERFORMANCE (runs that drafted >=3 of the set)');
var aRows = Object.keys(ARCHETYPES).map(function (a) {
  return { a: a, n: archRuns[a].length, avg: mean(archRuns[a]), best: archRuns[a].length ? Math.max.apply(null, archRuns[a]) : 0 };
}).filter(function (r) { return r.n >= 8; });
aRows.sort(function (a, b) { return b.avg - a.avg; });
aRows.forEach(function (r) {
  console.log('  ' + r.a.padEnd(28) + ' n=' + String(r.n).padStart(4) + '  avg ' + r.avg.toFixed(2) + '  best ' + r.best);
});

/* ---- spotlight cards: avg depth WITH the card vs that class baseline ---- */
console.log('\nBUILD-DEFINING CARDS (avg sector of runs whose deck holds it)');
console.log('  card                       n     avg    vs.baseline');
var classBaseline = {};
CLASSES.forEach(function (c) { classBaseline[c] = mean(allByClass[c]); });
// map each spotlight card to its owning class for baseline comparison
function cardClass(id) {
  var def = VS.CARDS[id];
  return def && def.cls !== 'any' && def.cls !== 'curse' ? def.cls : null;
}
var spot = SPOTLIGHT.map(function (id) {
  var arr = cardRuns[id] || [];
  var base = cardClass(id) ? classBaseline[cardClass(id)] : mean([].concat.apply([], CLASSES.map(function (c) { return allByClass[c]; })));
  return { id: id, n: arr.length, avg: mean(arr), delta: mean(arr) - base };
}).filter(function (r) { return r.n >= 8; });
spot.sort(function (a, b) { return b.delta - a.delta; });
spot.forEach(function (r) {
  var sign = r.delta >= 0 ? '+' : '';
  console.log('  ' + (VS.CARDS[r.id].name).padEnd(22) + String(r.n).padStart(5) + '   ' + r.avg.toFixed(2) + '    ' + sign + r.delta.toFixed(2));
});

console.log('\n(Reading: a high +delta means runs that picked up that card went');
console.log(' notably deeper than that class’s average — a strong build signal.)');
