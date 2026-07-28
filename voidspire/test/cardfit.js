/* =========================================================================
 * VOIDSPIRE — card text budget check.
 *
 * Cards are a FIXED size (112x159 in a reward/shop grid, 90x128 in hand). That
 * is a deliberate constraint, not an accident: a grid of cards you are choosing
 * between only reads as a comparison if the cards are the same shape. So the
 * text has to fit the card — the card never grows to fit the text.
 *
 * `fitOne` shrinks a description until it fits, with a floor of 8.6px in a
 * reward grid. A card whose text still overflows AT the floor is clipped on
 * screen; a card that only fits by shrinking well below the CSS size is
 * technically visible but reads as fine print next to its neighbours.
 *
 * This measures both against the real layout engine, per card and per upgrade.
 *
 * Usage: npm install playwright-core --no-save && node test/cardfit.js [--all]
 *        (remove node_modules before committing)
 * ========================================================================= */
'use strict';

var path = require('path');
var CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
var PAGE = 'file://' + path.resolve(__dirname, '..', 'voidspire.html');
var SHOW_ALL = process.argv.indexOf('--all') >= 0;

// The reward grid's CSS size. Anything that has to shrink below this is text
// the player reads smaller than the card next to it.
var CSS_PX = 10.5;
var FLOOR = 8.6;

function measure() {
  var ns = VS.cards || window.VS;
  var CARDS = VS.CARDS || (VS.cards && VS.cards.CARDS);
  var U = VS.ui;

  // A real screen with a real grid — same DOM path a reward uses, so the box we
  // measure is the box the player sees.
  var host = document.createElement('div');
  host.className = 'screen';
  var grid = document.createElement('div');
  grid.className = 'card-grid';
  host.appendChild(grid);
  (document.getElementById('game') || document.body).appendChild(host);

  var out = [], box = null;
  Object.keys(CARDS).forEach(function (cid) {
    var def = CARDS[cid];
    [false, true].forEach(function (up) {
      if (up && !def.up) return;
      var card = U.cardEl(cid, up, false);
      grid.appendChild(card);
      var d = card.querySelector('.cdesc');
      d.style.fontSize = '';
      var text = (d.textContent || '').trim();
      if (!box) box = { w: d.clientWidth, h: d.clientHeight };
      var overflowAtCss = d.scrollHeight > d.clientHeight + 0.5;
      U.fitCards(card);
      var px = parseFloat(getComputedStyle(d).fontSize);
      var clipped = d.scrollHeight > d.clientHeight + 0.5;
      // the name has no auto-shrink — it either fits its band or it is cut
      var n = card.querySelector('.cname');
      var nameClipped = n.scrollHeight > n.clientHeight + 0.5 || n.scrollWidth > n.clientWidth + 0.5;
      out.push({
        id: cid + (up ? '+' : ''), name: def.name, chars: text.length,
        px: Math.round(px * 10) / 10, clipped: clipped, shrunk: overflowAtCss,
        nameClipped: nameClipped, text: text,
      });
      grid.removeChild(card);
    });
  });
  host.remove();
  return { box: box, cards: out };
}

(function () {
  var chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) {
    console.log('SKIP: playwright-core not installed (npm install playwright-core --no-save)');
    process.exit(0);
  }

  chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] }).then(async function (browser) {
    var page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    var errs = [];
    page.on('pageerror', function (e) { errs.push(e.message); });
    await page.goto(PAGE);
    await page.waitForTimeout(700);
    var r = await page.evaluate(measure);
    await browser.close();

    if (errs.length) { console.log('page errors: ' + errs.slice(0, 3).join(' | ')); process.exit(1); }

    console.log('desc box ' + r.box.w + 'x' + r.box.h + 'px at ' + CSS_PX + 'px/1.32 → ' +
      Math.floor(r.box.h / (CSS_PX * 1.32)) + ' lines\n');

    var badName = r.cards.filter(function (c) { return c.nameClipped; });
    if (badName.length) console.log('NAME CLIPPED: ' + badName.map(function (c) { return c.name; }).join(', ') + '\n');

    var clipped = r.cards.filter(function (c) { return c.clipped; });
    var shrunk = r.cards.filter(function (c) { return !c.clipped && c.shrunk; });
    var chars = r.cards.map(function (c) { return c.chars; }).sort(function (a, b) { return a - b; });
    function pct(p) { return chars[Math.min(chars.length - 1, Math.floor(chars.length * p))]; }
    console.log(r.cards.length + ' card variants · chars p50=' + pct(0.5) + ' p75=' + pct(0.75) +
      ' p90=' + pct(0.9) + ' p95=' + pct(0.95) + ' max=' + chars[chars.length - 1]);
    console.log('fits at ' + CSS_PX + 'px: ' + (r.cards.length - shrunk.length - clipped.length) +
      ' · shrinks to fit: ' + shrunk.length + ' · CLIPPED at ' + FLOOR + 'px floor: ' + clipped.length + '\n');

    var list = SHOW_ALL ? clipped.concat(shrunk) : clipped;
    list.sort(function (a, b) { return b.chars - a.chars; });
    list.forEach(function (c) {
      console.log((c.clipped ? 'CLIP ' : 'small') + ' ' + String(c.chars).padStart(4) + 'ch @' +
        c.px + 'px  ' + c.id + ' — ' + c.text);
    });

    process.exit(clipped.length ? 1 : 0);
  }).catch(function (e) {
    console.log('SKIP: could not launch Chromium (' + e.message.split('\n')[0] + ')');
    process.exit(0);
  });
})();
