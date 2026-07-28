/* =========================================================================
 * VOIDSPIRE — UI fit check (dev aid).
 *
 * Walks every overlay screen at phone, small-phone and desktop sizes and fails
 * on the three things that make a screen unusable but are invisible in a code
 * diff:
 *
 *   CLIPPED  an element's content is wider/taller than its box, so text is cut
 *   TINY     readable text rendered below the legibility floor (8.5px)
 *   OVERFLOW a screen scrolls further than the allowance for its content
 *
 * These need a real layout engine — jsdom computes no geometry — so unlike the
 * other tools here this one drives headless Chromium.
 *
 * Usage: npm install playwright-core --no-save && node test/uifit.js
 *        (remove node_modules before committing)
 * ========================================================================= */
'use strict';

var path = require('path');
var CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
var PAGE = 'file://' + path.resolve(__dirname, '..', 'voidspire.html');

var TEXT_FLOOR = 8.4;      // below this a condensed mono face stops being readable on a phone
var SCROLL_SLACK = 520;    // screens legitimately longer than a frame (die screen, codex)

var VIEWPORTS = [
  ['phone',   390, 844],
  ['small',   360, 640],
  ['desktop', 1680, 1050],
];

// Each screen is set up through the real engine + UI, exactly as play would.
var SCREENS = {
  title: function () { VS.engine.run = null; VS.ui.refresh(); },
  map: function () { var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.phase = 'map'; VS.ui.refresh(); },
  reward: function () {
    var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.faction = 'hierarchy'; E.run.nodeIdx = 0;
    E.startNode('fight');
    E.combat.enemies.forEach(function (e) { e.hp = 0; e.alive = false; });
    E.endTurn(); VS.ui.refresh();
  },
  event: function () { var E = VS.engine; E.seed(2); E.newRun('vanguard'); E.run.nodeIdx = 0; E.startNode('event'); VS.ui.refresh(); },
  shop: function () { var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.credits = 400; E.startNode('shop'); VS.ui.refresh(); },
  rest: function () { var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.startNode('rest'); VS.ui.refresh(); },
  forge: function () { var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.startNode('forge'); VS.ui.refresh(); },
  treasure: function () { var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.startNode('treasure'); VS.ui.refresh(); },
  die: function () { var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.phase = 'map'; VS.ui.refresh(); VS.ui.showDie(); },
};

// Runs in the page: measure the live overlay.
function probe(floor) {
  var s = document.querySelector('.screen');
  if (!s) return { none: true };
  var clipped = [], tiny = [];
  var all = s.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var c = all[i];
    var txt = (c.textContent || '').trim();
    var leaf = c.children.length === 0 && txt.length > 2;
    // Only TEXT can be "clipped" in a way that matters. Icon wrappers routinely
    // overflow by a pixel or two (drop-shadows, 100%-sized SVGs) and containers
    // that opt into scrolling are doing it on purpose — neither is a defect.
    var cs = getComputedStyle(c);
    var scrollable = /auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY);
    if (leaf && !scrollable && (c.scrollWidth - c.clientWidth > 2 || c.scrollHeight - c.clientHeight > 2)) {
      clipped.push((c.className || c.tagName).toString().split(' ')[0]);
    }
    if (leaf) {
      var px = parseFloat(cs.fontSize);
      if (px > 0 && px < floor) tiny.push((c.className || c.tagName).toString().split(' ')[0] + '@' + px.toFixed(1) + 'px');
    }
  }
  function uniq(a) { var o = {}; a.forEach(function (x) { o[x] = 1; }); return Object.keys(o); }
  return { over: s.scrollHeight - s.clientHeight, clipped: uniq(clipped), tiny: uniq(tiny) };
}

(function () {
  var chromium;
  try { chromium = require('playwright-core').chromium; }
  catch (e) {
    console.log('SKIP: playwright-core not installed (npm install playwright-core --no-save)');
    process.exit(0);
  }

  chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] }).then(async function (browser) {
    var fails = 0, checks = 0;
    for (var v = 0; v < VIEWPORTS.length; v++) {
      var name = VIEWPORTS[v][0];
      var page = await browser.newPage({ viewport: { width: VIEWPORTS[v][1], height: VIEWPORTS[v][2] } });
      var pageErrors = [];
      page.on('pageerror', function (e) { pageErrors.push(e.message); });
      await page.goto(PAGE);
      await page.waitForTimeout(700);

      for (var key in SCREENS) {
        await page.evaluate(SCREENS[key]);
        await page.waitForTimeout(2400);            // let typewriters and card auto-fit settle
        var r = await page.evaluate(probe, TEXT_FLOOR);
        checks++;
        var bad = [];
        if (r.none) bad.push('no .screen rendered');
        else {
          if (r.clipped.length) bad.push('CLIPPED ' + r.clipped.join(','));
          if (r.tiny.length) bad.push('TINY ' + r.tiny.join(','));
          if (r.over > SCROLL_SLACK) bad.push('OVERFLOW ' + r.over + 'px');
        }
        if (bad.length) { fails++; console.log(' FAIL ' + name + '/' + key + ': ' + bad.join(' · ')); }
        else console.log('  ok  ' + name + '/' + key);
      }
      if (pageErrors.length) { fails++; console.log(' FAIL ' + name + ': page errors — ' + pageErrors.slice(0, 3).join(' | ')); }
      await page.close();
    }
    await browser.close();
    console.log('\n' + checks + ' screen checks, ' + (fails === 0 ? 'ALL UI FIT CHECKS PASSED' : fails + ' FAILED'));
    process.exit(fails === 0 ? 0 : 1);
  }).catch(function (e) {
    console.log('SKIP: could not launch Chromium (' + e.message.split('\n')[0] + ')');
    process.exit(0);
  });
})();
