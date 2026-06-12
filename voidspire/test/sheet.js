/* =========================================================================
 * VOIDSPIRE — art contact sheet (dev aid).
 * Renders every enemy, event portrait, and artifact icon into one labeled
 * PNG grid using node-canvas (same stroke style as the in-game renderer).
 * Usage: NODE_PATH=<dir with canvas pkg> node test/sheet.js [out.png]
 * ========================================================================= */
'use strict';

global.VS = global.VS || {};
require('../js/balance.js');
require('../js/cards.js');
require('../js/artifacts.js');
require('../js/enemies.js');
require('../js/events.js');

var createCanvas = require('canvas').createCanvas;
var fs = require('fs');

var COLS = 5, CELL = 230;

var items = [];
Object.keys(VS.ENEMIES).forEach(function (id) {
  var d = VS.ENEMIES[id];
  items.push({ label: d.name, art: d.art, color: VS.FACTIONS[d.faction].color, scale: 62 * (d.size || 1) });
});
VS.EVENTS.forEach(function (ev) {
  items.push({ label: 'EVT: ' + ev.title, art: ev.art, color: ev.art.c || '#5dff88', scale: 70 });
});
Object.keys(VS.ARTIFACTS).forEach(function (id) {
  var a = VS.ARTIFACTS[id];
  items.push({ label: 'ART: ' + a.name, art: a.art, color: '#ffb02e', scale: 55 });
});

var ROWS = Math.ceil(items.length / COLS);
var cv = createCanvas(COLS * CELL, ROWS * CELL);
var ctx = cv.getContext('2d');
ctx.fillStyle = '#04080a';
ctx.fillRect(0, 0, cv.width, cv.height);

items.forEach(function (it, n) {
  var cx = (n % COLS) * CELL + CELL / 2;
  var cy = Math.floor(n / COLS) * CELL + CELL / 2 - 12;
  var scale = it.scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = it.color;
  ctx.lineWidth = 1.6 / scale;
  ctx.lineJoin = 'round';
  ctx.shadowColor = it.color;
  ctx.shadowBlur = 9;
  it.art.p.forEach(function (p) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  });
  if (it.art.m) {
    var m = it.art.m;
    ctx.beginPath();
    ctx.moveTo(m[0], m[1]);
    for (var j = 2; j < m.length; j += 2) ctx.lineTo(m[j], m[j + 1]);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = '#ffe9f0';
  ctx.shadowColor = it.color;
  ctx.shadowBlur = 7;
  (it.art.e || []).forEach(function (e) {
    var es = Math.max(1.5, scale * 0.05);
    ctx.fillRect(cx + e[0] * scale - es / 2, cy + e[1] * scale - es / 2, es, es);
  });
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#b8e6c4';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(it.label.slice(0, 30), cx, Math.floor(n / COLS) * CELL + CELL - 14);
});

var out = process.argv[2] || '/tmp/voidspire-shots/sheet.png';
fs.writeFileSync(out, cv.toBuffer('image/png'));
console.log('wrote ' + out + ' (' + items.length + ' items)');
