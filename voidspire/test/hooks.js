/* ==================================================================
 * DOES EVERY HOOK HAVE A READER?
 * ==================================================================
 * Relics, Echoes and engravings all pay out by naming a hook key that the
 * engine is supposed to read. A key with a typo, or one left behind when the
 * code that consumed it was rewritten, produces a relic that reads perfectly
 * on the card and does NOTHING — and nothing anywhere says so.
 *
 * So: collect every key the content PRODUCES, collect every key the engine
 * CONSUMES, and print the two differences.
 * ================================================================== */
'use strict';
var fs = require('fs'), path = require('path');
global.VS = global.VS || {};
var JS = path.join(__dirname, '..', 'js');
['balance', 'cards', 'artifacts', 'dice', 'reforge', 'chassis', 'potions',
 'echoes', 'enemies', 'events', 'engine'].forEach(function (m) {
  require(path.join(JS, m + '.js'));
});
var VS = global.VS;

var produced = {};   // key -> [who]
function note(key, who) { (produced[key] = produced[key] || []).push(who); }

/* A relic carries ONE hook as {k, v}; a few carry several as hooks:[{k,v}].
 * Engravings name theirs in fx:[{k,...}]. Read all three shapes. */
function eat(o, who) {
  if (!o) return;
  if (o.k) note(o.k, who);
  if (Array.isArray(o.hooks)) o.hooks.forEach(function (h) { if (h && h.k) note(h.k, who); });
  // an Echo writes hook: {k, v}; a relic writes k/v straight on itself
  if (o.hook) note(typeof o.hook === 'string' ? o.hook : o.hook.k, who);
}
function eatAll(coll, label) {
  if (!coll) return;
  (Array.isArray(coll) ? coll : Object.keys(coll).map(function (k) {
    var v = coll[k]; if (v && typeof v === 'object' && !v.id) v = Object.assign({ id: k }, v); return v;
  })).forEach(function (o) { if (o) eat(o, label + ' ' + (o.id || '?')); });
}
eatAll(VS.ARTIFACTS, 'relic');
eatAll(VS.ECHOES, 'echo');

/* What the engine reads. art() is the sum of every live hook, so any
 * art().<key> or art()[...] is a consumer; so is a direct A.<key>. */
var src = ['engine', 'ui', 'render'].map(function (m) {
  try { return fs.readFileSync(path.join(JS, m + '.js'), 'utf8'); } catch (e) { return ''; }
}).join('\n');

var consumed = {};
/* art('key') IS the reader — one function, the key as a string literal.
 * cornerstoneHooks() returns a map, so object literal keys count too. */
/* art('key') is the usual reader — one function, the key as a string literal.
 * But a few hooks are consumed by walking a relic's own hooks array and
 * comparing h.k, which no art() scan can see; maxHpPct is read that way and
 * reported as dead until this pattern is here too. */
var pats = [
  /\bart\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bE\.art\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bhasHook\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\.k\s*[=!]==\s*['"]([^'"]+)['"]/g,
  /['"]([^'"]+)['"]\s*[=!]==\s*\w+\.k\b/g,
];
pats.forEach(function (re) {
  var m; while ((m = re.exec(src))) consumed[m[1]] = 1;
});

var keys = Object.keys(produced).sort();
var dead = keys.filter(function (k) { return !consumed[k]; });

console.log('hook keys produced by content: ' + keys.length);
console.log('hook keys the engine reads:    ' + Object.keys(consumed).length);
console.log('\n=== PRODUCED BUT NEVER READ ===');
if (!dead.length) {
  console.log('  none — every hook has a reader');
  console.log('\nALL ' + keys.length + ' HOOKS HAVE A READER');
} else {
  dead.forEach(function (k) { console.log('  ' + k + '   <- ' + produced[k].join(', ')); });
  console.log('\n' + dead.length + ' DEAD HOOK(S) — content that reads fine and does nothing');
  process.exitCode = 1;
}
