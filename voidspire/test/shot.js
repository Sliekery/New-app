/* =========================================================================
 * VOIDSPIRE — battlefield screenshot tool (dev aid).
 * Boots the game in jsdom (with node-canvas) and saves PNGs of the canvas
 * battlefield for each faction, so the vector art can be reviewed headlessly.
 * Usage: NODE_PATH=<dir with jsdom+canvas> node test/shot.js [outdir]
 * ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var JSDOM = require('jsdom').JSDOM;

var root = path.join(__dirname, '..');
var outDir = process.argv[2] || '/tmp/voidspire-shots';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script[^>]*><\/script>/g, '');

var dom = new JSDOM(html, { pretendToBeVisual: true, runScripts: 'outside-only', url: 'http://localhost/' });
var win = dom.window;

var CW = 390, CH = 760;
var canvas = win.document.getElementById('battlefield');
canvas.getBoundingClientRect = function () {
  return { width: CW, height: CH, top: 0, left: 0, right: CW, bottom: CH, x: 0, y: 0 };
};

['balance', 'cards', 'cardart', 'artifacts', 'augments', 'potions', 'echoes', 'enemies', 'events', 'engine', 'render', 'ui', 'main'].forEach(function (f) {
  win.eval(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'));
});

var VS = win.VS;
var E = VS.engine;

function snap(name) {
  // settle animations (hp lerp, bobbing) with a few manual frames
  for (var i = 0; i < 40; i++) VS.render.frame(0.016);
  var data = canvas.toDataURL('image/png').split(',')[1];
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(data, 'base64'));
  console.log('wrote ' + name + '.png');
}

setTimeout(function () {
  E.seed(42);
  E.newRun('vanguard');

  ['hierarchy', 'rust', 'voidspawn'].forEach(function (fac) {
    E.run.faction = fac;
    E.run.nodeIdx = 6; // late-sector index -> bigger packs
    E.startNode('fight');
    VS.ui.refresh();
    snap('fight-' + fac);

    E.run.faction = fac;
    E.startNode('boss');
    VS.ui.refresh();
    snap('boss-' + fac);
  });

  // elite + targeting reticle
  E.run.faction = 'rust';
  E.run.sector = 3;
  E.startNode('elite');
  VS.ui.refresh();
  VS.render.targeting = true;
  snap('elite-targeting');
  VS.render.targeting = false;

  // one portrait per class
  ['vanguard', 'technomancer', 'voidadept'].forEach(function (cls) {
    E.newRun(cls);
    E.run.faction = 'hierarchy';
    E.startNode('fight');
    VS.ui.refresh();
    snap('class-' + cls);
  });

  win.close();
  process.exit(0);
}, 100);
