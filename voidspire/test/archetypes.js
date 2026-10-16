/* =========================================================================
 * DO THE VANGUARD'S ARCHETYPES ACTUALLY ASSEMBLE?
 * Usage: node test/archetypes.js [runs]
 *
 * An archetype is only an archetype if a real run can END holding enough of
 * it to feel like a deck. Slay the Spire's Ironclad has roughly three, and a
 * finished Ironclad deck is visibly one of them. This asks the same question
 * of the Vanguard: group its cards by the keyword they actually touch, play
 * runs, and report how much of the winning deck belongs to its own best group.
 *
 * This measures COHERENCE, not power. A class can be perfectly balanced and
 * still have no identity, and that is the failure this is looking for.
 * ========================================================================= */
'use strict';
var sim = require('./sim.js');
var VS = sim.VS;

/* The keyword each group is built on — taken from what the cards DO, not from
 * a design document, so a group that exists only on paper shows up empty. */
var GROUPS = {
  AIM:      { s: ['aim', 'aimPerTurn'], sp: ['aimGate', 'spendAim'] },
  STIM:     { s: ['stim', 'stimHold'],  sp: ['stimScale', 'limitBreakStim'] },
  BLOOD:    { s: ['bloodrage', 'reactor'], sp: ['drain', 'bloodbath', 'wounded'] },
  WALL:     { s: ['bulwark', 'wallPerTurn', 'wallThorns', 'scarWall', 'burstWall'],
              sp: ['wallFace', 'wallDealt', 'wallBoost', 'bloodCement', 'breachWall'] },
  BURST:    { s: ['burstPlus', 'salvo', 'demoCharge'], sp: ['reload', 'emptyMag'], roll: true },
  COUNTER:  { s: ['parry', 'vengeance', 'thorns', 'spikeward'], sp: [] },
  STRENGTH: { s: ['str', 'strPerTurn'], sp: [] },
};

/* THE BAND the card declares for itself. Since the marks name a region of the
 * die and the cards are tagged to match, this is the grouping that matters —
 * the keyword groups below stay because they say WHAT a card does, while the
 * band says WHICH PLAN it belongs to. */
function bandOf(def) { return def.band || null; }

function groupsOf(def) {
  var hit = {};
  function scan(fx) {
    (fx || []).forEach(function (f) {
      if (!f) return;
      Object.keys(GROUPS).forEach(function (g) {
        var G = GROUPS[g];
        if (f.k === 'status' && G.s.indexOf(f.s) >= 0) hit[g] = 1;
        if (f.k === 'special' && G.sp.indexOf(f.id) >= 0) hit[g] = 1;
        if (f.k === 'special' && f.id === 'stat' && G.sp.indexOf(f.s) >= 0) hit[g] = 1;
        if (f.k === 'onRoll' && G.roll) hit[g] = 1;
      });
      if (f.fx) scan(f.fx);
    });
  }
  scan(def.fx);
  return Object.keys(hit);
}

var CARD_GROUPS = {};
/* RETIRED cards are deliberately out of the drop tables; counting them makes
 * a group look stocked when nothing in it can ever be offered. Boss, event,
 * mark and colorless cards reach you by their own routes, so they are kept. */
var pool = Object.keys(VS.CARDS).filter(function (i) {
  return VS.CARDS[i].cls === 'vanguard' && VS.CARDS[i].pool !== 'retired';
});
pool.forEach(function (i) { CARD_GROUPS[i] = groupsOf(VS.CARDS[i]); });

/* WHAT IS OFFERED, not just what is taken. The bot drafts greedily, so a thin
 * archetype could be the bot's fault — unless the cards were never on the
 * table to begin with. Every reward screen is counted on its way past, which
 * is the ceiling a PERFECT drafter would be playing against. */
var offered = {}, offerScreens = 0, offerCards = 0, bandOffered = {};
(function () {
  var orig = sim.E.finishReward;
  sim.E.finishReward = function () {
    var rw = sim.E.run && sim.E.run.reward;
    if (rw && rw.cards && rw.cards.length) {
      offerScreens++;
      rw.cards.forEach(function (cid) {
        offerCards++;
        (CARD_GROUPS[cid] || []).forEach(function (g) { offered[g] = (offered[g] || 0) + 1; });
        var bb = VS.CARDS[cid] && VS.CARDS[cid].band;
        if (bb) bandOffered[bb] = (bandOffered[bb] || 0) + 1;
      });
    }
    return orig.apply(this, arguments);
  };
})();

var RUNS = parseInt(process.argv[2] || '300', 10);
var BANDS = { high: 'THE LONG SHOT', low: 'THE RED DEBT', mid: 'THE SET SHIELD' };
var MARK_BAND = { the_long_shot: 'high', the_red_debt: 'low', the_set_shield: 'mid' };
var bandTally = { high: { drafted: [], decks8: 0 }, low: { drafted: [], decks8: 0 }, mid: { drafted: [], decks8: 0 } };
var ownBand = [], own8 = 0;
var tally = {}, deckSizes = [], bestShare = [], payload = [];
Object.keys(GROUPS).forEach(function (g) { tally[g] = { inPool: 0, drafted: [], decks3: 0, decks5: 0 }; });
pool.forEach(function (i) { CARD_GROUPS[i].forEach(function (g) { tally[g].inPool++; }); });

for (var n = 0; n < RUNS; n++) {
  sim.playOneRun('vanguard', (n * 2654435761 + 777) >>> 0, n % 3);
  var deck = (sim.E.run && sim.E.run.deck) || [];
  if (!deck.length) continue;
  var counts = {};
  Object.keys(GROUPS).forEach(function (g) { counts[g] = 0; });
  var classCards = 0;
  deck.forEach(function (c) {
    var gs = CARD_GROUPS[c.id];
    if (!gs) return;
    classCards++;
    gs.forEach(function (g) { counts[g]++; });
  });
  deckSizes.push(deck.length);
  payload.push(classCards);
  var bandCount = { high: 0, low: 0, mid: 0 };
  deck.forEach(function (c) {
    var b = VS.CARDS[c.id] && VS.CARDS[c.id].band;
    if (b && bandCount[b] != null) bandCount[b]++;
  });
  Object.keys(bandCount).forEach(function (b) {
    bandTally[b].drafted.push(bandCount[b]);
    if (bandCount[b] >= 8) bandTally[b].decks8++;
  });
  var mine = MARK_BAND[sim.E.run.firstMark];
  if (mine) { ownBand.push(bandCount[mine]); if (bandCount[mine] >= 8) own8++; }

  var top = 0, topG = null;
  Object.keys(GROUPS).forEach(function (g) {
    tally[g].drafted.push(counts[g]);
    if (counts[g] >= 3) tally[g].decks3++;
    if (counts[g] >= 5) tally[g].decks5++;
    if (counts[g] > top) { top = counts[g]; topG = g; }
  });
  bestShare.push(top);
}

function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
var N = bestShare.length;
var meanOwn = ownBand.length ? ownBand.reduce(function (a, b) { return a + b; }, 0) / ownBand.length : 0;

console.log('\n===== VANGUARD ARCHETYPE COHERENCE — ' + N + ' finished runs =====\n');
console.log('The class has ' + pool.length + ' cards. A finished deck holds '
  + mean(deckSizes).toFixed(1) + ' cards, '
  + mean(payload).toFixed(1) + ' of them Vanguard-specific.\n');

Object.keys(GROUPS).sort(function (a, b) {
  return mean(tally[b].drafted) - mean(tally[a].drafted);
}).forEach(function (g) {
  var t = tally[g];
  console.log('  ' + g.padEnd(9)
    + String(t.inPool).padStart(5) + ' cards'
    + mean(t.drafted).toFixed(1).padStart(8) + ' in deck'
    + (Math.round(100 * t.decks3 / N) + '%').padStart(7) + ' reach 3'
    + (Math.round(100 * t.decks5 / N) + '%').padStart(7) + ' reach 5');
});

/* --- the same question asked of the BANDS, which is what the marks declare - */
console.log('\n--- BY DIE BAND (what the first mark actually promised) ---');
console.log('mark                 band cards   offered/run   in deck   >=8 of it');
Object.keys(BANDS).forEach(function (b) {
  var t = bandTally[b], inPool = pool.filter(function (i) { return VS.CARDS[i].band === b; }).length;
  console.log('  ' + BANDS[b].padEnd(18) + String(inPool).padStart(6)
    + ((bandOffered[b] || 0) / N).toFixed(1).padStart(14)
    + mean(t.drafted).toFixed(1).padStart(10)
    + (Math.round(100 * t.decks8 / N) + '%').padStart(11));
});
console.log('  on OWN band only  ' + meanOwn.toFixed(1).padStart(24) + ' in deck'
  + (Math.round(100 * own8 / N) + '%').padStart(5) + ' reach 8');

console.log('\n--- THE CEILING: what a PERFECT drafter was even offered ---');
console.log(offerScreens + ' reward screens over ' + N + ' runs ('
  + (offerScreens / N).toFixed(1) + ' per run, ' + (offerCards / N).toFixed(1) + ' cards seen)');
Object.keys(GROUPS).sort(function (a, b) {
  return (offered[b] || 0) - (offered[a] || 0);
}).forEach(function (g) {
  console.log('  ' + g.padEnd(9)
    + ((offered[g] || 0) / N).toFixed(1).padStart(6) + ' offered per run'
    + ('  (took ' + mean(tally[g].drafted).toFixed(1) + ')').padStart(16));
});

console.log('\nBEST group in each deck: avg ' + mean(bestShare).toFixed(1) + ' cards');
var hist = {};
bestShare.forEach(function (v) { hist[v] = (hist[v] || 0) + 1; });
Object.keys(hist).sort(function (a, b) { return a - b; }).forEach(function (k) {
  console.log('   ' + String(k).padStart(2) + ' cards of one group: '
    + (Math.round(100 * hist[k] / N) + '%').padStart(4)
    + '  ' + new Array(Math.round(60 * hist[k] / N) + 1).join('#'));
});
