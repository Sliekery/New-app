/* ==================================================================
 * DOES EVERY NAMED THING EXIST?
 * ==================================================================
 * Cards, relics, engravings, potions and enemies all refer to each other by
 * string id — reward pools, class lists, encounter packs, event payouts,
 * FIRST_MARKS. A typo'd id does not throw; it silently narrows a pool, and
 * the content it was supposed to name never appears in any run. The sim
 * cannot see that, because a pool that is one item short still works.
 *
 * So walk every collection of ids in the data and check each one resolves.
 * ================================================================== */
'use strict';
var path = require('path');
global.VS = global.VS || {};
var JS = path.join(__dirname, '..', 'js');
['balance', 'cards', 'artifacts', 'dice', 'reforge', 'chassis', 'potions',
 'echoes', 'enemies', 'events', 'engine'].forEach(function (m) {
  require(path.join(JS, m + '.js'));
});
var VS = global.VS;

var bad = [], checked = 0;
function exists(kind, id) {
  if (kind === 'card') return !!VS.CARDS[id];
  if (kind === 'relic') return !!VS.ARTIFACTS[id];
  if (kind === 'engraving') return !!VS.DIE_AUGMENTS[id];
  if (kind === 'potion') return !!(VS.POTIONS && VS.POTIONS[id]);
  if (kind === 'enemy') return !!VS.ENEMIES[id];
  return true;
}
function check(kind, id, where) {
  if (id == null) return;
  checked++;
  if (!exists(kind, id)) bad.push(kind + ' "' + id + '"  named by ' + where);
}
function checkList(kind, list, where) {
  if (!Array.isArray(list)) return;
  list.forEach(function (id) {
    if (typeof id === 'string') check(kind, id, where);
    else if (id && typeof id === 'object' && typeof id.id === 'string') check(kind, id.id, where);
  });
}

/* Some fx values are KEYWORDS, not ids — 'random', 'rare', 'colorless' pick
 * from a pool at the moment they are paid out. engine.js reads them by name,
 * so they are not typos and must not be reported as missing. */
var KEYWORD = { random: 1, rare: 1, colorless: 1, any: 1, curse: 1 };

/* --- starting decks --- */
Object.keys(VS.STARTER_DECKS || {}).forEach(function (c) {
  checkList('card', VS.STARTER_DECKS[c], 'STARTER_DECKS.' + c);
});

/* --- the three opening inscriptions per class --- */
Object.keys(VS.FIRST_MARKS || {}).forEach(function (c) {
  (VS.FIRST_MARKS[c] || []).forEach(function (m, i) {
    var w = 'FIRST_MARKS.' + c + '[' + i + '] (' + (m.name || '?') + ')';
    check('engraving', m.eng, w);
    check('card', m.card, w);
  });
});

/* --- every enemy the map can field --- */
Object.keys(VS.PACKS || {}).forEach(function (fac) {
  (VS.PACKS[fac] || []).forEach(function (pack, i) {
    checkList('enemy', pack, 'PACKS.' + fac + '[' + i + ']');
  });
});
['ELITES', 'BOSSES'].forEach(function (key) {
  Object.keys(VS[key] || {}).forEach(function (fac) {
    checkList('enemy', VS[key][fac], key + '.' + fac);
  });
});
Object.keys(VS.ELITE_MINIONS || {}).forEach(function (fac) {
  check('enemy', VS.ELITE_MINIONS[fac], 'ELITE_MINIONS.' + fac);
});
checkList('enemy', VS.FIRST_FIGHT, 'FIRST_FIGHT');
if (VS.FINAL_BOSS) check('enemy', VS.FINAL_BOSS, 'FINAL_BOSS');

/* --- events that hand out a named thing --- */
(VS.EVENTS || []).forEach(function (ev) {
  (ev.choices || []).forEach(function (ch, ci) {
    var w = 'event ' + ev.id + ' choice ' + ci;
    var outs = [ch.outcome];
    if (ch.die) ['onCut', 'onBlank', 'onWin', 'onLose', 'low', 'mid', 'high'].forEach(function (b) {
      if (ch.die[b]) outs.push(ch.die[b]);
    });
    outs.forEach(function (o) {
      if (!o || !o.fx) return;
      ['card', 'card2', 'curse', 'curse2'].forEach(function (f) {
        if (o.fx[f] && !KEYWORD[o.fx[f]]) check('card', o.fx[f], w);
      });
      if (o.fx.relic && !KEYWORD[o.fx.relic]) check('relic', o.fx.relic, w);
      if (o.fx.potion && !KEYWORD[o.fx.potion]) check('potion', o.fx.potion, w);
      if (o.fx.eng && !KEYWORD[o.fx.eng]) check('engraving', o.fx.eng, w);
    });
  });
});

/* --- every card an UPGRADE names, and every card a card makes --- */
Object.keys(VS.CARDS || {}).forEach(function (id) {
  var c = VS.CARDS[id];
  (c.fx || []).forEach(function (f) {
    if (f && f.card && !KEYWORD[f.card]) check('card', f.card, 'card ' + id);
  });
  if (c.up && Array.isArray(c.up.fx)) c.up.fx.forEach(function (f) {
    if (f && f.card && !KEYWORD[f.card]) check('card', f.card, 'card ' + id + ' (upgraded)');
  });
});

/* --- enemies that put a card in your deck --- */
Object.keys(VS.ENEMIES || {}).forEach(function (id) {
  var e = VS.ENEMIES[id];
  (e.moves || []).forEach(function (mv, i) {
    (mv.fx || []).forEach(function (f) {
      if (f && f.card && !KEYWORD[f.card]) check('card', f.card, 'enemy ' + id + ' move ' + i);
    });
  });
});

console.log(checked + ' id references checked');
if (!bad.length) {
  console.log('every one of them resolves');
  console.log('\nALL ' + checked + ' CONTENT REFERENCES RESOLVE');
  process.exit(0);
}
console.log('\n=== NAMED BUT MISSING ===');
bad.forEach(function (b) { console.log('  ' + b); });
process.exit(1);
