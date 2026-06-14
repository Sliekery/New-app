/* =========================================================================
 * VOIDSPIRE — star-chart screenshot tool (dev aid).
 * Generates real sector maps and draws them to PNG with node-canvas, using
 * the same layout the in-game SVG uses, so connectivity / crossings / icons
 * can be reviewed headlessly.
 * Usage: NODE_PATH=<dir with canvas> node test/mapshot.js [outDir]
 * ========================================================================= */
'use strict';
global.VS = global.VS || {};
require('../js/balance.js');
require('../js/cards.js');
require('../js/artifacts.js');
 require('../js/augments.js');
require('../js/enemies.js');
require('../js/events.js');
require('../js/engine.js');
require('../js/render.js');

var createCanvas = require('canvas').createCanvas;
var fs = require('fs');
var VS = global.VS, E = VS.engine, ICONS = VS.MAP_ICONS;
var outDir = process.argv[2] || '/tmp/voidspire-shots';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

var cellW = 116, rowH = 118, pad = 26;

function jit(row, col, axis) { return ((row * 13 + col * 7 + axis * 5) % 7 - 3) * 4; }
function hex(ctx, cx, cy, r) {
  ctx.beginPath();
  for (var i = 0; i < 6; i++) {
    var a = Math.PI / 6 + i * Math.PI / 3;
    var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
function ticks(ctx, cx, cy, r) {
  var c = r * 0.42;
  var segs = [
    [[cx - r, cy - r + c], [cx - r, cy - r], [cx - r + c, cy - r]],
    [[cx + r - c, cy - r], [cx + r, cy - r], [cx + r, cy - r + c]],
    [[cx + r, cy + r - c], [cx + r, cy + r], [cx + r - c, cy + r]],
    [[cx - r + c, cy + r], [cx - r, cy + r], [cx - r, cy + r - c]],
  ];
  segs.forEach(function (s) { ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); ctx.lineTo(s[2][0], s[2][1]); ctx.stroke(); });
}

function drawMap(m, reach, cur, file, title, faction) {
  var COLS = m.COLS, ROWS = m.ROWS;
  var W = COLS * cellW, H = (ROWS + 1) * rowH;
  var cv = createCanvas(W + pad * 2, H + pad * 2 + 30);
  var ctx = cv.getContext('2d');
  // space backdrop: dark + faction nebula + starfield (mimics the live canvas)
  ctx.fillStyle = '#05090c'; ctx.fillRect(0, 0, cv.width, cv.height);
  var fc = (VS.FACTIONS[faction] || { color: '#5dff88' }).color;
  var g = ctx.createRadialGradient(cv.width * 0.7, cv.height * 0.25, 10, cv.width * 0.7, cv.height * 0.25, cv.width * 0.9);
  g.addColorStop(0, hexA(fc, 0.10)); g.addColorStop(1, hexA(fc, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  var rseed = 99;
  function rr() { rseed = (rseed * 1103515245 + 12345) & 0x7fffffff; return rseed / 0x7fffffff; }
  for (var si = 0; si < 140; si++) {
    var a = 0.15 + rr() * 0.5;
    ctx.fillStyle = 'rgba(150,210,190,' + a.toFixed(2) + ')';
    ctx.fillRect(rr() * cv.width, rr() * cv.height, rr() > 0.85 ? 1.6 : 1, rr() > 0.85 ? 1.6 : 1);
  }
  ctx.translate(pad, pad + 30);

  function cx(col) { return (col + 0.5) * cellW; }
  function xy(node) { return { x: cx(node.col) + jit(node.row, node.col, 0), y: H - (node.row + 0.5) * rowH + jit(node.row, node.col, 1) }; }
  function targetOf(node, tc) {
    if (tc === 'boss') return m.boss;
    var nr = m.rows[node.row + 1];
    for (var i = 0; i < nr.length; i++) if (nr[i].col === tc) return nr[i];
    return null;
  }

  // edges
  for (var ri = 0; ri < ROWS; ri++) {
    m.rows[ri].forEach(function (node) {
      node.edges.forEach(function (tc) {
        var t = targetOf(node, tc); if (!t) return;
        var a = xy(node), b = xy(t);
        var live = (node === cur && reach.indexOf(t) >= 0);
        var trav = node.visited && t.visited;
        ctx.save();
        if (live) { ctx.strokeStyle = '#5dff88'; ctx.lineWidth = 2.4; ctx.setLineDash([5, 6]); ctx.shadowColor = '#5dff88'; ctx.shadowBlur = 6; }
        else if (trav) { ctx.strokeStyle = 'rgba(184,230,196,0.6)'; ctx.lineWidth = 2; }
        else { ctx.strokeStyle = 'rgba(150,190,170,0.22)'; ctx.lineWidth = 1.2; ctx.setLineDash([1.5, 7]); }
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
        if (live || trav) {
          ctx.fillStyle = live ? '#5dff88' : 'rgba(184,230,196,0.55)';
          ctx.beginPath(); ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, 1.8, 0, 7); ctx.fill();
        }
      });
    });
  }

  function drawNode(node) {
    var p = xy(node), icon = ICONS[node.type] || ICONS.fight;
    var isBoss = node.type === 'boss';
    var hexR = isBoss ? 29 : 20, size = isBoss ? 24 : 15;
    var reachable = reach.indexOf(node) >= 0;
    var state = node === cur ? 'current' : node.visited ? 'visited' : reachable ? 'reachable' : 'locked';
    var alpha = state === 'locked' ? 0.42 : state === 'visited' ? 0.55 : 1;
    ctx.globalAlpha = alpha;

    // hex fill
    hex(ctx, p.x, p.y, hexR);
    ctx.fillStyle = state === 'current' ? 'rgba(93,255,136,0.16)' : reachable ? 'rgba(10,30,18,0.8)' : 'rgba(6,12,14,0.82)';
    ctx.fill();
    // sonar ping (static representation)
    if (reachable) { ctx.save(); ctx.strokeStyle = 'rgba(93,255,136,0.4)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, hexR * 1.45, 0, 7); ctx.stroke(); ctx.restore(); }
    // hex frame
    ctx.save();
    ctx.strokeStyle = reachable ? '#5dff88' : state === 'current' ? '#eaffe9' : icon.color;
    ctx.lineWidth = (reachable || state === 'current') ? 2 : 1.4;
    ctx.shadowColor = reachable ? '#5dff88' : (isBoss ? '#ff4a5e' : icon.color);
    ctx.shadowBlur = reachable ? 6 : isBoss ? 7 : 0;
    if (!reachable && state !== 'current') ctx.globalAlpha = alpha * 0.85;
    hex(ctx, p.x, p.y, hexR); ctx.stroke();
    if (isBoss) { ctx.globalAlpha = alpha * 0.4; hex(ctx, p.x, p.y, hexR + 5); ctx.stroke(); }
    ctx.restore();
    // reticle ticks
    if (reachable) { ctx.save(); ctx.strokeStyle = '#5dff88'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.shadowColor = '#5dff88'; ctx.shadowBlur = 3; ticks(ctx, p.x, p.y, hexR + 5); ctx.restore(); }

    // glyph
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = icon.color; ctx.fillStyle = icon.color;
    ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = icon.color; ctx.shadowBlur = reachable ? 5 : 3;
    icon.p.forEach(function (poly) {
      ctx.beginPath(); ctx.moveTo(p.x + poly[0] * size, p.y + poly[1] * size);
      for (var i = 2; i < poly.length; i += 2) ctx.lineTo(p.x + poly[i] * size, p.y + poly[i + 1] * size);
      ctx.stroke();
    });
    (icon.e || []).forEach(function (e) { ctx.beginPath(); ctx.arc(p.x + e[0] * size, p.y + e[1] * size, size * 0.12, 0, 7); ctx.fill(); });
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  m.rows.forEach(function (row) { row.forEach(drawNode); });
  drawNode(m.boss);

  ctx.fillStyle = '#b8e6c4'; ctx.font = '15px monospace'; ctx.textAlign = 'left';
  ctx.fillText(title, 0, -8);
  fs.writeFileSync(outDir + '/' + file, cv.toBuffer('image/png'));
  console.log('wrote ' + file);
}

function hexA(hexColor, a) {
  var n = parseInt(hexColor.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// fresh map at sector 1
E.seed(7); E.newRun('vanguard');
drawMap(E.run.map, E.mapReachable(), E.currentNode(), 'map-fresh.png', 'SECTOR 1 — start (pick a bottom node)', E.run.faction);

// mid-progress: walk a few nodes to show visited / current / reachable states
E.seed(4); E.newRun('voidadept');
for (var k = 0; k < 3; k++) {
  var reach = E.mapReachable();
  if (!reach.length) break;
  E.run.mapRow = reach[0].row; E.run.mapCol = reach[Math.floor(reach.length / 2)].col;
  reach[Math.floor(reach.length / 2)].visited = true;
}
drawMap(E.run.map, E.mapReachable(), E.currentNode(), 'map-progress.png', 'MID-ROUTE — current (white) · reachable (green)', E.run.faction);
