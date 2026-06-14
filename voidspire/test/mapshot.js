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
require('../js/enemies.js');
require('../js/events.js');
require('../js/engine.js');
require('../js/render.js');

var createCanvas = require('canvas').createCanvas;
var fs = require('fs');
var VS = global.VS, E = VS.engine, ICONS = VS.MAP_ICONS;
var outDir = process.argv[2] || '/tmp/voidspire-shots';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

var cellW = 120, rowH = 116, pad = 30;

function jit(row, col, axis) { return ((row * 13 + col * 7 + axis * 5) % 7 - 3) * 4; }

function drawMap(m, reach, cur, file, title) {
  var COLS = m.COLS, ROWS = m.ROWS;
  var W = COLS * cellW, H = (ROWS + 1) * rowH;
  var cv = createCanvas(W + pad * 2, H + pad * 2 + 30);
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#04080a';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.translate(pad, pad + 30);

  function cx(col) { return (col + 0.5) * cellW; }
  function xy(node) {
    return { x: cx(node.col) + jit(node.row, node.col, 0), y: H - (node.row + 0.5) * rowH + jit(node.row, node.col, 1) };
  }
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
        ctx.strokeStyle = live ? 'rgba(93,255,136,0.9)' : trav ? 'rgba(184,230,196,0.5)' : 'rgba(120,160,140,0.18)';
        ctx.lineWidth = live ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
    });
  }

  function drawNode(node) {
    var p = xy(node), icon = ICONS[node.type] || ICONS.fight;
    var isBoss = node.type === 'boss';
    var ring = isBoss ? 30 : 22, size = isBoss ? 26 : 17;
    var reachable = reach.indexOf(node) >= 0;
    var state = node === cur ? 'current' : node.visited ? 'visited' : reachable ? 'reachable' : 'locked';
    var alpha = state === 'locked' ? 0.4 : state === 'visited' ? 0.55 : 1;

    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(p.x, p.y, ring, 0, 7);
    ctx.fillStyle = state === 'current' ? 'rgba(93,255,136,0.18)' : 'rgba(8,18,14,0.9)';
    ctx.fill();
    ctx.lineWidth = (reachable || state === 'current') ? 2.5 : 1.3;
    ctx.strokeStyle = reachable ? '#5dff88' : state === 'current' ? '#eaffe9' : 'rgba(184,230,196,0.4)';
    ctx.stroke();

    ctx.strokeStyle = icon.color; ctx.fillStyle = icon.color;
    ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = icon.color; ctx.shadowBlur = reachable ? 8 : 4;
    icon.p.forEach(function (poly) {
      ctx.beginPath();
      ctx.moveTo(p.x + poly[0] * size, p.y + poly[1] * size);
      for (var i = 2; i < poly.length; i += 2) ctx.lineTo(p.x + poly[i] * size, p.y + poly[i + 1] * size);
      ctx.stroke();
    });
    (icon.e || []).forEach(function (e) {
      ctx.beginPath(); ctx.arc(p.x + e[0] * size, p.y + e[1] * size, size * 0.12, 0, 7); ctx.fill();
    });
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  m.rows.forEach(function (row) { row.forEach(drawNode); });
  drawNode(m.boss);

  ctx.fillStyle = '#b8e6c4'; ctx.font = '15px monospace'; ctx.textAlign = 'left';
  ctx.fillText(title, 0, -8);
  fs.writeFileSync(outDir + '/' + file, cv.toBuffer('image/png'));
  console.log('wrote ' + file);
}

// fresh map at sector 1
E.seed(7); E.newRun('vanguard');
drawMap(E.run.map, E.mapReachable(), E.currentNode(), 'map-fresh.png', 'SECTOR 1 — start (pick a bottom node)');

// mid-progress: walk a few nodes to show visited / current / reachable states
E.seed(7); E.newRun('vanguard');
for (var k = 0; k < 3; k++) {
  var reach = E.mapReachable();
  if (!reach.length) break;
  // pick a middle-ish node for a nice screenshot
  E.run.mapRow = reach[0].row; E.run.mapCol = reach[Math.floor(reach.length / 2)].col;
  reach[Math.floor(reach.length / 2)].visited = true;
}
drawMap(E.run.map, E.mapReachable(), E.currentNode(), 'map-progress.png', 'SECTOR 1 — mid-route (green = reachable)');
