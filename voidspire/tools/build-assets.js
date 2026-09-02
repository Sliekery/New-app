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
 'potions', 'echoes', 'enemies', 'playerart'].forEach(function (m) {
  try { require(path.join(root, 'js', m + '.js')); } catch (e) { /* optional */ }
});

// Skip anything non-finite rather than emitting it. Canvas silently drops a
// path containing NaN, so such art has never drawn; carrying it into the
// editor would only let it be read back as zeros and become a visible line.
function cleanFrame(art) {
  if (!art) return null;
  var p = (art.p || []).map(function (flat) {
    return flat.filter(function (n) { return typeof n === 'number' && isFinite(n); });
  }).filter(function (flat) { return flat.length >= 4; });
  var e = (art.e || []).filter(function (q) {
    return q && q.every(function (n) { return typeof n === 'number' && isFinite(n); });
  });
  if (!p.length && !e.length) return null;
  return { p: p, e: e };
}

/* An art block is normally one shape, { p, e }, but may instead be
 * { fps, frames: [ {p,e}, … ] } — which the battlefield renderer has always
 * played and this collector did not know about. It read art.p off an animated
 * block, found undefined, and dropped the whole asset: the first sprite we
 * animated would simply have disappeared out of the artist's library, with no
 * error to say why. Both shapes now survive the trip. */
function clean(art) {
  if (!art) return null;
  if (art.frames) {
    var fr = art.frames.map(cleanFrame).filter(Boolean);
    return fr.length ? { fps: art.fps || 8, frames: fr } : null;
  }
  return cleanFrame(art);
}

var out = [], skipped = 0, animated = 0;
function take(kind, id, name, art) {
  var c = clean(art);
  if (!c) { skipped++; return; }
  var rec = { kind: kind, id: id, name: name || id };
  if (c.frames) { rec.fps = c.fps; rec.frames = c.frames; animated++; }
  else { rec.p = c.p; rec.e = c.e; }
  out.push(rec);
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
/* THE PLAYER. The one figure you look at all game, and the only art the tool
 * could not see — it was a local `var` inside render.js rather than a table on
 * `ns`, so there was nothing here to gather. Moved to js/playerart.js.
 *
 * Only `p` and `e` come across. Each class also carries RIG POINTS in the same
 * coordinate space — `muzzle`, `atk.pivot`, `orb`, `ferrule` — which the
 * drawing tool knows nothing about and would drop on the way back. They stay
 * in the data file, and moving a weapon in a drawing means moving them too. */
function title(id) { return id.charAt(0).toUpperCase() + id.slice(1); }
Object.keys(VS.CLASS_ART || {}).forEach(function (id) {
  var a = VS.CLASS_ART[id];
  take('player', id, title(id), { p: a.p, e: a.e });
  /* THE MOVING PARTS ARE THEIR OWN DRAWINGS. A figure's gun, halo, banner and
   * tatters are not in `p` because they animate apart from the body — the
   * weapon swings when you attack, the halo turns, the tatters drift. So they
   * come across as their own entries rather than being welded onto the body,
   * which is also the only way they stay editable.
   *
   * Anything that is a LIST OF POLYLINES is a part; `muzzle` is a single [x,y]
   * and is a rig point, not art. Told apart by shape rather than by a list of
   * field names, so a part added later arrives without this needing an edit. */
  Object.keys(a).forEach(function (f) {
    if (f === 'p' || f === 'e' || f === 'color' || f === 'atk') return;
    var v = a[f];
    var paths = (v && v.paths) ? v.paths
      : (Array.isArray(v) && v.length && Array.isArray(v[0])) ? v : null;
    if (paths) take('player', id + '_' + f, title(id) + ' — ' + f, { p: paths, e: [] });
  });
});

var body = 'window.VS_ASSETS = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, 'assets.js'), body);
console.log('assets.js: ' + out.length + ' pieces of art'
  + ' (' + out.filter(function (a) { return a.kind === 'enemy'; }).length + ' enemies, '
  + out.filter(function (a) { return a.kind === 'engraving'; }).length + ' engravings, '
  + out.filter(function (a) { return a.kind === 'card'; }).length + ' cards, '
  + out.filter(function (a) { return a.kind === 'player'; }).length + ' player figures)'
  + (skipped ? ', ' + skipped + ' skipped as empty or unusable' : ''));
if (animated) console.log('  ' + animated + ' of them are animated');
else console.log('  none of them is animated yet — every piece is a single frame');
console.log('  ' + Math.round(body.length / 1024) + ' KB');

/* The sound tool drives the REAL music engine rather than a copy of it, so the
 * engine has to sit beside the tool — the deployed site publishes tools/ but
 * not js/. Copied here so one command keeps both tools current. */
fs.copyFileSync(path.join(root, 'js', 'music.js'), path.join(__dirname, 'music.js'));
console.log('music.js copied beside the sound tool');
