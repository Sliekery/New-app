/* =========================================================================
 * VOIDSPIRE — enemy art contact sheet (dev aid).
 * Renders every enemy's vector art into one labeled PNG grid using
 * node-canvas directly (same stroke style as the in-game renderer).
 * Usage: NODE_PATH=<dir with canvas pkg> node test/sheet.js [out.png]
 * ========================================================================= */
'use strict';

global.VS = global.VS || {};
require('../js/balance.js');
require('../js/cards.js');
require('../js/artifacts.js');
require('../js/enemies.js');

var createCanvas = require('canvas').createCanvas;
var fs = require('fs');

var ids = Object.keys(VS.ENEMIES);
var COLS = 5, CELL = 230;
var ROWS = Math.ceil(ids.length / COLS);
var cv = createCanvas(COLS * CELL, ROWS * CELL);
var ctx = cv.getContext('2d');

ctx.fillStyle = '#04080a';
ctx.fillRect(0, 0, cv.width, cv.height);

ids.forEach(function (id, n) {
  var def = VS.ENEMIES[id];
  var cx = (n % COLS) * CELL + CELL / 2;
  var cy = Math.floor(n / COLS) * CELL + CELL / 2 - 12;
  var color = VS.FACTIONS[def.faction].color;
  var scale = 62 * (def.size || 1);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6 / scale;
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  def.art.p.forEach(function (p) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  });
  ctx.restore();

  ctx.fillStyle = '#ffe9f0';
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;
  (def.art.e || []).forEach(function (e) {
    var es = Math.max(1.5, scale * 0.05);
    ctx.fillRect(cx + e[0] * scale - es / 2, cy + e[1] * scale - es / 2, es, es);
  });
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#b8e6c4';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(def.name, cx, Math.floor(n / COLS) * CELL + CELL - 14);
});

var out = process.argv[2] || '/tmp/voidspire-shots/sheet.png';
fs.writeFileSync(out, cv.toBuffer('image/png'));
console.log('wrote ' + out);
