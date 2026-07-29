/* Render a grid of real cards to a PNG, for eyeballing art/frame changes.
 * Usage: node test/sheetshot.js [out.png] [id,id,id | auto]                */
'use strict';
var path = require('path'), { chromium } = require('playwright-core');
var PAGE = 'file://' + path.resolve(__dirname, '..', 'voidspire.html');
var OUT = process.argv[2] || '/tmp/sheet.png';
var PICK = process.argv[3] || 'auto';
(async () => {
  var b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  var p = await b.newPage({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 2 });
  p.on('pageerror', function (e) { console.log('ERR', e.message); });
  await p.goto(PAGE); await p.waitForTimeout(600);
  var n = await p.evaluate(function (pick) {
    var ns = VS, U = VS.ui, C = ns.CARDS;
    var ids = pick === 'auto'
      // one per class per type per rarity band — the spread the frame must carry
      ? (function () {
          var out = [], want = [['vanguard', 0], ['vanguard', 1], ['vanguard', 2], ['vanguard', 3],
            ['technomancer', 0], ['technomancer', 1], ['technomancer', 2], ['technomancer', 3],
            ['voidadept', 0], ['voidadept', 1], ['voidadept', 2], ['voidadept', 3]];
          ['attack', 'skill', 'power'].forEach(function (t) {
            want.forEach(function (w) {
              var hit = Object.keys(C).filter(function (id) {
                return C[id].cls === w[0] && C[id].type === t && C[id].rarity === w[1] && out.indexOf(id) < 0;
              })[0];
              if (hit) out.push(hit);
            });
          });
          Object.keys(C).filter(function (id) { return C[id].type === 'curse'; }).slice(0, 2).forEach(function (id) { out.push(id); });
          return out;
        })()
      : pick.split(',');
    document.getElementById('overlay').innerHTML = '';
    document.getElementById('overlay').classList.add('active');
    var s = document.createElement('div'); s.className = 'screen';
    var g = document.createElement('div'); g.className = 'card-grid';
    g.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:1140px';
    ids.forEach(function (id) { if (C[id]) g.appendChild(U.cardEl(id, false, false)); });
    s.appendChild(g); document.getElementById('overlay').appendChild(s);
    setTimeout(function () { U.fitCards(s); }, 0);
    return ids.length;
  }, PICK);
  await p.waitForTimeout(1200);
  var el = await p.$('.card-grid');
  await el.screenshot({ path: OUT });
  console.log('wrote ' + OUT + ' (' + n + ' cards)');
  await b.close();
})();
