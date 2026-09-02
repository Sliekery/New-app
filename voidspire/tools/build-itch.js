#!/usr/bin/env node
/* ==================================================================
 * PACKAGE FOR ITCH.IO
 * ==================================================================
 * itch.io serves an HTML project by unzipping it and opening index.html
 * inside an iframe on a sandboxed domain of its own. So a package is just:
 * a zip, with index.html AT THE ROOT (not inside a folder — itch will not
 * go looking), and every file it needs beside it.
 *
 * Two products come out of this repo:
 *
 *   LINEWORK   the drawing tool on its own, one file, no game art. This is
 *              the thing a stranger would want: it is a tool, not a peek
 *              into somebody else's project.
 *   VOIDSPIRE  the game, bundled to a single file by test/bundle.js.
 *
 * Both are made from build outputs, so run build-standalone.js, and
 * test/bundle.js first, or just run this — it calls them.
 * ================================================================== */
'use strict';
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
var OUT = path.join(ROOT, 'dist');

function sh(cmd, cwd) {
  cp.execSync(cmd, { cwd: cwd || ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
}
function kb(p) { return Math.round(fs.statSync(p).size / 1024) + ' KB'; }

/* itch runs the page in an iframe sized by the project's settings, so the
 * page has to fill whatever it is given rather than assume a window. Both
 * pages already do; this only guarantees no stray scrollbar inside the frame,
 * which on itch shows up as a double scrollbar and looks broken. */
function fitFrame(html) {
  return html.replace('</head>',
    '<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style>\n</head>');
}

function pack(name, files, note) {
  var dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  Object.keys(files).forEach(function (as) {
    var src = path.join(ROOT, files[as]);
    var body = fs.readFileSync(src);
    if (as === 'index.html') body = Buffer.from(fitFrame(body.toString('utf8')));
    fs.writeFileSync(path.join(dir, as), body);
  });
  var zip = path.join(OUT, name + '.zip');
  fs.rmSync(zip, { force: true });
  sh('zip -q -r -X "' + zip + '" .', dir);
  console.log(name + '.zip: ' + kb(zip) + ' — ' + Object.keys(files).join(', '));
  if (note) console.log('  ' + note);
  return zip;
}

console.log('building the pieces first…');
sh('node tools/build-standalone.js');
sh('node tools/build-assets.js');
sh('node test/bundle.js');

fs.mkdirSync(OUT, { recursive: true });
console.log('');

pack('linework-itch', { 'index.html': 'tools/linework.html' },
  'itch: Kind of project = Tool, "This file will be played in the browser"');

pack('voidspire-itch', { 'index.html': 'voidspire.html' },
  'itch: Kind of project = Game, "This file will be played in the browser"');

/* The full artist, game art library and all. Not for a public itch page —
 * it ships the game's own sprites — but it is the one to hand to somebody
 * working ON Voidspire who cannot reach the site. */
pack('artist-full-itch',
  { 'index.html': 'tools/artist.html', 'assets.js': 'tools/assets.js' },
  'the artist WITH the Voidspire library — for collaborators, not the public');

console.log('\nall three are in ' + path.relative(process.cwd(), OUT) + '/');
console.log('upload the .zip, tick "This file will be played in the browser",');
console.log('and set the viewport to 1280x800 with fullscreen allowed.');
