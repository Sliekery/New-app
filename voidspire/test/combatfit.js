/* =========================================================================
 * VOIDSPIRE — test/combatfit.js
 * Does the combat HUD stay out of the fight's way?
 *
 * This game is played in LANDSCAPE, where the whole frame is CSS-scaled to fit
 * (0.65 on an 844x390 phone, 0.60 at 740x360) — so every DOM size is multiplied
 * by that before it reaches the screen, and a panel that clears the figures on a
 * portrait phone can sit squarely on the player's head turned sideways.
 *
 * uifit.js checks the overlay SCREENS. It cannot catch any of this, because the
 * player and the enemies are drawn on a CANVAS and have no DOM boxes to compare
 * against — so a DOM-only overlap check reports a clean bill of health while the
 * receipt covers the fight. This measures the readouts against the figures'
 * real drawn extents, at every chain length, on ten viewports.
 * ========================================================================= */
'use strict';

var path = require('path');

// The ones that matter first: landscape phones and tablets, the way it is
// played. Portrait and desktop follow, so neither can regress unnoticed.
var VIEWPORTS = [
  ['land-844',    844, 390], ['land-740',   740, 360], ['land-932',  932, 430],
  ['land-1024',  1024, 480], ['land-1194', 1194, 560], ['land-1366', 1366, 640],
  ['tablet-1180', 1180, 820], ['desktop',  1440, 900],
  ['portrait',    390, 844], ['small-360',  360, 640],
];

// 3 is the longest chain 3600 played cards ever produced (the engine's chain
// depth cap is 2). 5 and 12 are there to prove the receipt stays bounded well
// past anything the engine can actually generate.
var CHAIN_LENGTHS = [1, 3, 5, 12];

var pc;
try { pc = require('playwright-core'); } catch (e) {
  console.log('SKIP: playwright-core not installed'); process.exit(0);
}

pc.chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
}).then(async function (browser) {
  var fails = 0, checks = 0;

  for (var i = 0; i < VIEWPORTS.length; i++) {
    var name = VIEWPORTS[i][0];
    var page = await browser.newPage({ viewport: { width: VIEWPORTS[i][1], height: VIEWPORTS[i][2] } });
    var errs = [];
    page.on('pageerror', function (e) { errs.push(e.message); });
    await page.goto('file://' + path.resolve(__dirname, '..', 'voidspire.html'));
    await page.waitForTimeout(700);
    await page.evaluate(function () {
      var E = VS.engine;
      E.seed(4); E.newRun('technomancer'); E.takeFirstMark(0);
      E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.startNode('fight');
      VS.ui.refresh();
    });
    await page.waitForTimeout(500);

    for (var c = 0; c < CHAIN_LENGTHS.length; c++) {
      var r = await page.evaluate(function (n) {
        VS.ui.probeChainWipe();
        for (var k = 0; k < n; k++) VS.ui.probeChainLink(k);

        var l = document.getElementById('chain-ledger');
        var b = l.getBoundingClientRect();
        var cvE = document.querySelector('canvas'), cv = cvE.getBoundingClientRect();
        var R = VS.render, dpr = Math.min(2, window.devicePixelRatio || 1);
        var RW = cvE.width / dpr, RH = cvE.height / dpr;
        var sy = cv.height / RH, sx = cv.width / RW;

        // mirror render.js's own layout maths so the test measures the figures
        // where they are actually drawn, not where a guess puts them
        var band = (RH - Math.min(170, RH * 0.28)) - Math.min(96, RH * 0.14);
        var sc = Math.min(RW * 0.098, band * 0.098 * 1.8);
        var pl = R.playerXY(), worst = 0, who = '';

        // the player's drawn top is the staff tip, ~1.9x scale above centre
        var pTop = cv.top + (pl.y - sc * 1.9) * sy;
        var pRight = cv.left + (pl.x + sc * 1.2) * sx;
        if (b.bottom > pTop && b.left < pRight) { worst = Math.round(b.bottom - pTop); who = 'player'; }

        // enemies: radius plus the intent badge that floats above them
        R.views.forEach(function (v, vi) {
          var top = cv.top + (v.y - v.r - 34) * sy, left = cv.left + (v.x - v.r) * sx;
          if (b.bottom > top && b.right > left) {
            var o = Math.round(b.bottom - top);
            if (o > worst) { worst = o; who = 'enemy' + vi; }
          }
        });

        var d = document.getElementById('combat-die').getBoundingClientRect();
        var g = document.getElementById('game').getBoundingClientRect();
        return {
          clash: worst, who: who,
          dieHit: (b.right > d.left && b.left < d.right && b.bottom > d.top && b.top < d.bottom),
          off: b.bottom > g.bottom + 1 || b.right > g.right + 1 || b.top < g.top - 1 || b.left < g.left - 1,
          rows: l.querySelectorAll('.cl-ln').length,
        };
      }, CHAIN_LENGTHS[c]);

      checks++;
      var bad = [];
      if (r.clash > 0) bad.push('covers ' + r.who + ' by ' + r.clash + 'px');
      if (r.dieHit) bad.push('covers the die');
      if (r.off) bad.push('off-frame');
      if (r.rows > 4) bad.push('receipt grew to ' + r.rows + ' rows (cap 4)');
      if (bad.length) { fails++; console.log(' FAIL ' + name + ' @' + CHAIN_LENGTHS[c] + ' links: ' + bad.join(' · ')); }
      else console.log('  ok  ' + name + ' @' + CHAIN_LENGTHS[c] + ' links');
    }

    if (errs.length) { fails++; console.log(' FAIL ' + name + ': page errors — ' + errs.slice(0, 2).join(' | ')); }
    await page.close();
  }

  /* ---- no readout may hide behind the chrome --------------------------
   * A boss is 178px of radius standing on a line at 0.72 of the band, so the
   * HP bar drawn under its feet landed 68px inside the hand and its number
   * 83px in — on the one number that decides whether you can win the turn.
   * The player's own gauge had the same collision with the stim belt, which
   * printed "¢299 STIMS" across it. Both now yield to the chrome; assert it
   * for a boss, an ordinary pack, and the player, since the fix must NOT flip
   * ordinary enemies above their heads to buy clearance they do not need. */
  for (var k = 0; k < 2; k++) {
    var vp = [['wide', 1773, 894], ['land', 844, 390]][k];
    for (var n = 0; n < 2; n++) {
      var kind = ['boss', 'fight'][n];
      var pg2 = await browser.newPage({ viewport: { width: vp[1], height: vp[2] } });
      await pg2.goto('file://' + path.resolve(__dirname, '..', 'voidspire.html'));
      await pg2.waitForTimeout(700);
      await pg2.evaluate(function (kind) {
        var E = VS.engine;
        E.seed(7); E.newRun('vanguard');
        E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.run.mapRow = 12;
        E.startNode(kind); VS.ui.refresh();
      }, kind);
      await pg2.waitForTimeout(900);
      var g = await pg2.evaluate(function () {
        var R = VS.render, cv = document.getElementById('battlefield');
        var cb = cv.getBoundingClientRect();
        function topOf(id) {
          var el = document.getElementById(id);
          if (!el) return null;
          var b = el.getBoundingClientRect();
          return b.height ? b.top - cb.top : null;
        }
        /* THE CARDS, NOT THE CONTAINER. #hand is a 227px box whose cards
         * occupy only the bottom 90 — measuring the box put the line 149px
         * too high and flipped ordinary enemies above their own heads to
         * clear empty space. */
        function cardsTop() {
          var best = Infinity;
          document.querySelectorAll('#hand .card').forEach(function (c) {
            var b = c.getBoundingClientRect();
            if (b.height && b.width) best = Math.min(best, b.top - cb.top);
          });
          return isFinite(best) ? best : topOf('hand');
        }
        return {
          hand: cardsTop(), belt: topOf('potion-belt'),
          // the lowest ink each bar block puts down, mirroring drawEnemy
          bars: (R.views || []).map(function (v) {
            return { r: Math.round(v.r), bottom: Math.round(v.barBottom), up: !!v.barsUp };
          }),
          gauge: R.playerGaugeBottom == null ? null : Math.round(R.playerGaugeBottom),
          bottom: R.readableBottom ? R.readableBottom(0) : null,
        };
      });
      checks++;
      var bad = null;
      if (!g.bars.length) bad = 'no enemies on the battlefield';
      else if (g.hand == null) bad = 'the hand is not up';
      else if (g.bottom == null || g.bottom > g.hand + 1) bad = 'the readable floor (' + Math.round(g.bottom) + ') is below the cards (' + Math.round(g.hand) + ')';
      else if (g.bars.some(function (bb) { return bb.bottom > g.hand; }))
        bad = 'an HP bar block reaches ' + Math.round(Math.max.apply(null, g.bars.map(function (bb) { return bb.bottom; })) - g.hand) + 'px behind the cards';
      else if (kind === 'fight' && g.bars.some(function (bb) { return bb.up; }))
        bad = 'an ordinary enemy flipped its bar above its head for clearance it did not need';
      else if (kind === 'boss' && !g.bars.some(function (bb) { return bb.up; }))
        bad = 'the boss kept its bar below the feet — it does not fit there';
      else if (g.belt != null && g.gauge != null && g.gauge > g.belt)
        bad = 'the player gauge reaches ' + Math.round(g.gauge - g.belt) + 'px into the stim belt';
      if (bad) { fails++; console.log(' FAIL readout clearance ' + vp[0] + '/' + kind + ': ' + bad); }
      else console.log('  ok  readout clearance ' + vp[0] + '/' + kind + ' (floor ' + Math.round(g.bottom) + ', cards at ' + Math.round(g.hand) + ')');
      await pg2.close();
    }
  }

  /* ---- the hand fits between the things it must not cover --------------
   * Two hand-fitted constants used to decide this: a flat -8px card margin and
   * `padding: 0 142px 0 280px`. Measured on a 1742px window, five in hand had
   * 1320px of room for 450px of card and still buried 27% of each other, and
   * the right reserve was 72px short of END TURN. Assert it at both ends of
   * the range: a small hand must not overlap AT ALL, and a full one must still
   * clear the belt, the piles and the button. */
  for (var hv = 0; hv < 2; hv++) {
    var hvp = [[1742, 922], [844, 390]][hv];
    for (var hn = 0; hn < 2; hn++) {
      var want = [5, 10][hn];
      var hp = await browser.newPage({ viewport: { width: hvp[0], height: hvp[1] } });
      await hp.goto('file://' + path.resolve(__dirname, '..', 'voidspire.html'));
      await hp.waitForTimeout(700);
      await hp.evaluate(function (want) {
        var E = VS.engine;
        E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
        E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.startNode('fight');
        E.run.credits = 903;
        var c = E.combat;
        while (c.hand.length > want) c.hand.pop();
        while (c.hand.length < want) c.hand.push({ uid: 9000 + c.hand.length, id: 'pulse_rifle', up: false });
        VS.ui.refresh();
      }, want);
      await hp.waitForTimeout(900);
      var hr = await hp.evaluate(function () {
        function box(sel) { var e = document.querySelector(sel); if (!e) return null; var b = e.getBoundingClientRect(); return b.width && b.height ? b : null; }
        var cards = [].map.call(document.querySelectorAll('#hand .card'), function (c) { return c.getBoundingClientRect(); });
        var hit = [];
        ['#combat-controls', '#discard-pile', '#draw-pile', '#potion-belt', '.belt-lbl', '#energy-pip'].forEach(function (sel) {
          var b = box(sel); if (!b) return;
          cards.forEach(function (cb) {
            if (cb.left < b.right && cb.right > b.left && cb.top < b.bottom && cb.bottom > b.top) {
              if (hit.indexOf(sel) < 0) hit.push(sel);
            }
          });
        });
        var over = 0;
        for (var i = 1; i < cards.length; i++) over = Math.max(over, cards[i - 1].right - cards[i].left);
        return { n: cards.length, hit: hit, over: Math.round(over), w: Math.round(cards[0] ? cards[0].width : 0) };
      });
      checks++;
      var hbad = null;
      if (hr.n !== want) hbad = 'expected ' + want + ' cards, drew ' + hr.n;
      else if (hr.hit.length) hbad = 'the hand covers ' + hr.hit.join(', ');
      else if (want === 5 && hr.over > hr.w * 0.12) hbad = 'cards bury each other by ' + hr.over + 'px with room to spare';
      if (hbad) { fails++; console.log(' FAIL hand fit ' + hvp[0] + 'x' + hvp[1] + '/' + want + ': ' + hbad); }
      else console.log('  ok  hand fit ' + hvp[0] + 'x' + hvp[1] + '/' + want + ' (overlap ' + hr.over + 'px of ' + hr.w + ')');
      await hp.close();
    }
  }

  await browser.close();
  console.log('\n' + checks + ' combat-fit checks, ' + (fails === 0 ? 'ALL COMBAT FIT CHECKS PASSED' : fails + ' FAILED'));
  process.exit(fails === 0 ? 0 : 1);
}).catch(function (e) {
  console.log('SKIP: could not launch Chromium (' + e.message.split('\n')[0] + ')');
  process.exit(0);
});
