/* =========================================================================
 * Collect every piece of art in the game into tools/assets.js, so the artist
 * can offer them as a browsable list and load any one of them for editing.
 *
 * Written as a plain script assigning a global rather than a JSON file that
 * gets fetched: the artist is opened from `file://` as often as from the
 * deployed site, and fetch() is blocked there while a <script> tag is not.
 *
 * Run it after changing any art:  node tools/build-assets.js
 * ========================================================================= */
'use strict';
var fs = require('fs'), path = require('path');
var root = path.resolve(__dirname, '..');

global.VS = {};
['balance', 'cards', 'cardart', 'artifacts', 'dice', 'reforge', 'chassis',
 'potions', 'echoes', 'enemies'].forEach(function (m) {
  try { require(path.join(root, 'js', m + '.js')); } catch (e) { /* optional */ }
});

function clean(art) {
  if (!art) return null;
  // Skip anything non-finite rather than emitting it. Canvas silently drops a
  // path containing NaN, so such art has never drawn; carrying it into the
  // editor would only let it be read back as zeros and become a visible line.
  var p = (art.p || []).map(function (flat) {
    return flat.filter(function (n) { return typeof n === 'number' && isFinite(n); });
  }).filter(function (flat) { return flat.length >= 4; });
  var e = (art.e || []).filter(function (q) {
    return q && q.every(function (n) { return typeof n === 'number' && isFinite(n); });
  });
  if (!p.length && !e.length) return null;
  return { p: p, e: e };
}

var out = [], skipped = 0;
function take(kind, id, name, art) {
  var c = clean(art);
  if (!c) { skipped++; return; }
  out.push({ kind: kind, id: id, name: name || id, p: c.p, e: c.e });
}

Object.keys(VS.ENEMIES || {}).forEach(function (id) {
  var d = VS.ENEMIES[id];
  take('enemy', id, d.name, d.art);
});
Object.keys(VS.DIE_AUGMENTS || {}).forEach(function (id) {
  var g = VS.DIE_AUGMENTS[id];
  take('engraving', id, g.name, g.art);
});
Object.keys(VS.CARD_ART || {}).forEach(function (id) {
  var c = VS.CARDS && VS.CARDS[id];
  take('card', id, (c && c.name) || id, VS.CARD_ART[id]);
});

var body = 'window.VS_ASSETS = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, 'assets.js'), body);
console.log('assets.js: ' + out.length + ' pieces of art'
  + ' (' + out.filter(function (a) { return a.kind === 'enemy'; }).length + ' enemies, '
  + out.filter(function (a) { return a.kind === 'engraving'; }).length + ' engravings, '
  + out.filter(function (a) { return a.kind === 'card'; }).length + ' cards)'
  + (skipped ? ', ' + skipped + ' skipped as empty or unusable' : ''));
console.log('  ' + Math.round(body.length / 1024) + ' KB');

/* The sound tool drives the REAL music engine rather than a copy of it, so the
 * engine has to sit beside the tool — the deployed site publishes tools/ but
 * not js/. Copied here so one command keeps both tools current. */
fs.copyFileSync(path.join(root, 'js', 'music.js'), path.join(__dirname, 'music.js'));
console.log('music.js copied beside the sound tool');
