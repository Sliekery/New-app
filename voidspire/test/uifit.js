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
var SCROLL_SLACK = 520;    // default allowance
var SLACK = { die: 900, dietray: 900, dierelic: 900, diepreview: 900 };   // the face index is a long list on purpose

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
  // the die with a full tray: the longest screen in the game
  dietray: function () {
    var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.phase = 'map';
    E.run.die.pending = ['ranging_mark', 'jam_clearance', 'executioners_mark'];
    VS.ui.refresh(); VS.ui.showDie();
  },
  /* THE PLACEMENT PREVIEW. It replaces the selected-face readout beside the
   * die, so it is the one thing on this screen that can push the pane taller
   * than the face list — and it only exists while a cut is lined up, which no
   * other fixture reaches. Driven the way a player does: arm, then tap. */
  diepreview: function () {
    var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.phase = 'map';
    E.run.die.pending = ['ranging_mark', 'jam_clearance'];
    VS.dieEngrave(E.run.die, 'scrap_sifter', 13);      // something to seam onto
    VS.ui.refresh(); VS.ui.showDie();
    var arm = document.querySelector('[data-pend="0"]');
    if (arm) arm.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    var face = document.querySelector('.df[data-face="14"]');
    if (face) face.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  },
  /* The face picker with its readout open — the tallest state of the screen
   * that decides which engraving gets destroyed, and one no other fixture
   * reaches because it is only entered from inside an event. */
  facepick: function () {
    var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.phase = 'map';
    var d = E.run.die;
    VS.dieEngrave(d, 'ranging_mark', 3);
    VS.dieEngrave(d, 'kinetic_buffer', 6);
    VS.dieEngrave(d, 'ignition_coil', 9);
    VS.dieEngrave(d, 'munition_feed', 15);
    VS.dieAddTaint(d, 9, 'rust');
    E.run.pendingFace = { mode: 'fuse', n: 2, picked: [6] };
    VS.ui.refresh();
    VS.ui._facePick(function () {});
    var cell = document.querySelector('.fc[data-face="15"]');
    if (cell) cell.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  },
  // The band table is read through the engine, relics and all, so a relic that
  // deletes a band (Regulator Clamp) or splits one (Duty Cycle) changes how
  // many rows this screen draws — check the shortest and longest tables it can
  // produce rather than only the default three.
  dierelic: function () {
    var E = VS.engine; E.seed(5); E.newRun('technomancer'); E.run.phase = 'map';
    ['regulator_clamp', 'duty_cycle', 'sacrificial_fuse'].forEach(function (id) {
      E.addArtifact(id); E.run.die.core.push(id);
    });
    VS.ui.refresh(); VS.ui.showDie();
  },
  sector: function () { var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.sector = 2; E.run.phase = 'sector-intro'; VS.ui.refresh(); },
  /* THE INSTABILITY, all three stages. The cull grid is the densest thing on
   * the screen — twenty faces, each with a name, a burning state and a scar
   * marker — and it had never been covered by a fit fixture. */
  unstable: function () {
    var E = VS.engine; E.seed(9); E.newRun('vanguard');
    var pool = ['bracket_fire', 'static_discharge'];
    for (var f = 1; f <= 14; f++) VS.dieEngrave(E.run.die, pool[f % 2], f);
    E.run.bossArtifacts = []; E.takeBossArtifact(0);
    VS.ui.refresh();
  },
  'unstable-pick': function () {
    var E = VS.engine; E.seed(9); E.newRun('vanguard');
    var pool = ['bracket_fire', 'static_discharge'];
    for (var f = 1; f <= 14; f++) VS.dieEngrave(E.run.die, pool[f % 2], f);
    E.run.bossArtifacts = []; E.takeBossArtifact(0);
    var st = E.instabilityState();
    for (var i = 0; i < st.required + 4; i++) E.instabilityToggle(st.roots[i]);
    E.instabilityCommit();
    VS.ui.refresh();
  },
  // turn zero: three offers, each an engraving beside a full-size card
  mark: function () { var E = VS.engine; E.seed(5); E.newRun('technomancer'); VS.ui.refresh(); },
  // the widest panel in the game, and the longest single line of prose
  cutscene: function () {
    var E = VS.engine; E.seed(5); E.newRun('vanguard'); E.run.sector = 4;
    E.run.cutscene = { id: 'floor', panel: 1, next: 'map' };
    E.run.phase = 'cutscene'; VS.ui.refresh();
  },
};

// Runs in the page: measure the live overlay.
function probe(floor) {
  var s = document.querySelector('.screen');
  if (!s) return { none: true };
  var clipped = [], tiny = [];
  // SVG elements carry an SVGAnimatedString className, which stringifies to
  // "[object SVGAnimatedString]" and told us nothing about what was clipped.
  function elName(c) {
    var cn = (typeof c.className === 'string') ? c.className : (c.getAttribute && c.getAttribute('class')) || '';
    return (cn ? cn.split(' ')[0] : c.tagName.toLowerCase());
  }
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
    // SVG content has its own layout model: <text> reports clientWidth 0, so the
    // box comparison below can never pass for it, and computed font-size is in
    // user units the viewBox then rescales. Neither check means anything here.
    if (c.ownerSVGElement || c.tagName.toLowerCase() === 'svg') continue;
    if (leaf && !scrollable && (c.scrollWidth - c.clientWidth > 2 || c.scrollHeight - c.clientHeight > 2)) {
      clipped.push(elName(c));
    }
    if (leaf) {
      var px = parseFloat(cs.fontSize);
      if (px > 0 && px < floor) tiny.push(elName(c) + '@' + px.toFixed(1) + 'px');
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
          if (r.over > (SLACK[key] || SCROLL_SLACK)) bad.push('OVERFLOW ' + r.over + 'px');
        }
        if (bad.length) { fails++; console.log(' FAIL ' + name + '/' + key + ': ' + bad.join(' · ')); }
        else console.log('  ok  ' + name + '/' + key);
      }
      if (pageErrors.length) { fails++; console.log(' FAIL ' + name + ': page errors — ' + pageErrors.slice(0, 3).join(' | ')); }
      await page.close();
    }
    // ---- the band sheet must always be dismissable ----
    await (async function sheetCheck() {
      var page2 = await browser.newPage({ viewport: { width: 844, height: 390 } });
      await page2.goto('file://' + path.resolve(__dirname, '..', 'voidspire.html'));
      await page2.waitForTimeout(700);
      await page2.evaluate(function () {
        var E = VS.engine; E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
        if (!E.run.die) E.run.die = VS.newDie();
        E.run.phase = 'map'; VS.ui.showDie();
      });
      await page2.waitForTimeout(900);
      var ok2 = await page2.evaluate(async function () {
        function n() { return document.querySelectorAll('.sheet-back').length; }
        function tap(el) {
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
          el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5 }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
        var drs = document.querySelector('.drs');
        if (!drs) return 'no band summary to open';
        tap(drs);
        await new Promise(function (r) { setTimeout(r, 60); });
        if (n() !== 1) return 'sheet did not open';
        // it must be mounted ON TOP of whatever screen is up, or it cannot be hit
        var back = document.querySelector('.sheet-back');
        var host = back.parentElement;
        if (host && host.id === 'game' && document.getElementById('overlay').classList.contains('active')) {
          return 'sheet mounted beneath the active overlay';
        }
        tap(back.querySelector('.sheet-card'));
        await new Promise(function (r) { setTimeout(r, 60); });
        if (n() !== 0) return 'a tap did not dismiss it';
        return 'ok';
      });
      checks++;
      if (ok2 !== 'ok') { fails++; console.log(' FAIL band sheet: ' + ok2); }
      else console.log('  ok  band sheet opens above the screen and dismisses');
      await page2.close();
    })();

    /* ---- Aim is a READOUT ---------------------------------------------
     * It used to be +/- buttons previewing the table at a hypothetical Aim,
     * and opened mid-fight they wrote c.player.statuses.aim directly. The
     * preview is gone — the face list already prints every band at your real
     * Aim — so this asserts the control is absent AND that simply opening the
     * die screen in combat cannot move the stat. */
    await (async function aimCheck() {
      var page3 = await browser.newPage({ viewport: { width: 844, height: 390 } });
      await page3.goto('file://' + path.resolve(__dirname, '..', 'voidspire.html'));
      await page3.waitForTimeout(700);
      var verdict = await page3.evaluate(async function () {
        var E = VS.engine;
        E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
        if (!E.run.die) E.run.die = VS.newDie();
        E.run.faction = 'hierarchy'; E.run.nodeIdx = 0; E.startNode('fight');
        VS.ui.refresh();
        await new Promise(function (r) { setTimeout(r, 200); });
        var before = E.combat.player.statuses.aim || 0;
        VS.ui.showDie();
        await new Promise(function (r) { setTimeout(r, 250); });
        if (document.querySelector('[data-aim]')) return 'the +/- preview is back';
        var after = E.combat.player.statuses.aim || 0;
        if (after !== before) return 'opening the die screen moved real Aim ' + before + ' -> ' + after;
        var shown = (document.querySelector('.ws-val') || {}).textContent || '';
        if (shown !== '+' + before) return 'readout says ' + shown + ' but Aim is +' + before;
        // and the face list must be showing bands, since that is what replaced it
        if (!document.querySelectorAll('.df-tag').length) return 'no band tags on the face list';
        if (E.run.die.previewAim != null) return 'previewAim is still being written to the save';
        return 'ok';
      });
      checks++;
      if (verdict !== 'ok') { fails++; console.log(' FAIL aim readout: ' + verdict); }
      else console.log('  ok  aim is a readout that matches the real stat');
      await page3.close();
    })();

    /* ---- the star chart must actually get the screen ---------------------
     * Two ways this screen has failed, both invisible in a diff:
     *   1. the landscape grid hard-coded three rows, so the moment a die-alert
     *      bar existed the 1fr slack landed on a 30px bar and the chart fell
     *      into an implicit auto row — 44% of the window for the one thing the
     *      screen is for;
     *   2. giving the chart that height made it over-scale, and the back half
     *      of the descent ran off the right edge where it cannot be tapped.
     * Assert both: the chart owns most of the panel, and the whole sector fits
     * inside it. */
    await (async function chartCheck() {
      for (var i = 0; i < 2; i++) {
        var vp = [[1720, 930], [844, 390]][i];
        var pg = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } });
        await pg.goto('file://' + path.resolve(__dirname, '..', 'voidspire.html'));
        await pg.waitForTimeout(600);
        await pg.evaluate(function () {
          var E = VS.engine; E.seed(5); E.newRun('vanguard');
          E.run.phase = 'map'; E.run.mapRow = 8; E.run.pressure = 1;
          // a scarred face puts the die-alert bar up, which is the case that broke
          VS.dieEngrave(E.run.die, 'kinetic_buffer', 5);
          VS.dieAddTaint(E.run.die, 5, 'rust');
          VS.ui.refresh();
        });
        await pg.waitForTimeout(700);
        var r = await pg.evaluate(function () {
          var sc = document.querySelector('.screen'), w = document.querySelector('.map-wrap');
          var svg = document.querySelector('.starchart');
          if (!sc || !w || !svg) return null;
          var alert = document.querySelector('.die-alert');
          // clientHeight for the share (both LAYOUT px — the frame is transform
          // scaled, so a rect here is not the same unit as a clientHeight) and
          // rects for the overflow, where both sides are scaled alike
          var sb = svg.getBoundingClientRect(), wb = w.getBoundingClientRect();
          return {
            share: w.clientHeight / sc.clientHeight,
            hasAlert: !!alert,
            overflowX: Math.round(sb.width - wb.width),
            scrollX: w.scrollWidth - w.clientWidth,
          };
        });
        checks++;
        var bad = null;
        if (!r) bad = 'no chart on the map screen';
        else if (!r.hasAlert) bad = 'fixture did not raise the die-alert bar';
        else if (r.share < 0.55) bad = 'the chart got only ' + Math.round(r.share * 100) + '% of the screen';
        else if (r.overflowX > 2 || r.scrollX > 2) bad = 'the descent runs ' + Math.max(r.overflowX, r.scrollX) + 'px off the edge';
        if (bad) { fails++; console.log(' FAIL chart fit ' + vp[0] + 'x' + vp[1] + ': ' + bad); }
        else console.log('  ok  chart fit ' + vp[0] + 'x' + vp[1] + ' (' + Math.round(r.share * 100) + '% of screen, whole sector visible)');
        await pg.close();
      }
    })();

    /* ---- the HUD must not reserve a band it does not need ---------------
     * overlayScreen used to set paddingTop to the HUD's full height. The HUD is
     * a corner cluster AND a menu button hard against the right edge, so any
     * single box around it spans the frame — which bought 206px of empty band
     * on a 1587px screen and turned a screen that fits into a 1.27x scroll.
     * This asserts wide frames reclaim it, and that nothing ends up hidden
     * beneath the HUD on any frame. */
    await (async function gapCheck() {
      var sizes = [[1720, 930, true], [844, 390, true], [390, 844, false]];
      for (var i = 0; i < sizes.length; i++) {
        var pg = await browser.newPage({ viewport: { width: sizes[i][0], height: sizes[i][1] } });
        await pg.goto('file://' + path.resolve(__dirname, '..', 'voidspire.html'));
        await pg.waitForTimeout(600);
        await pg.evaluate(function () {
          var E = VS.engine; E.seed(4); E.newRun('vanguard'); E.takeFirstMark(0);
          if (!E.run.die) E.run.die = VS.newDie();
          E.run.pressure = 1; E.run.artifacts = ['aegis_core', 'servo_skull', 'targeting_visor'];
          E.run.phase = 'map'; VS.ui.refresh();
        });
        await pg.waitForTimeout(500);
        await pg.evaluate(function () { VS.ui.showDie(); });
        await pg.waitForTimeout(900);
        var r = await pg.evaluate(function () {
          var s = document.querySelector('.screen');
          var leaves = [];
          (function walk(n) {
            [].forEach.call(n.children, function (c) {
              if (c.children.length) { walk(c); return; }
              var b = c.getBoundingClientRect();
              if (b.width && b.height) leaves.push(b);
            });
          })(document.getElementById('hud'));
          var hidden = false;
          [].forEach.call(s.children, function (c) {
            var b = c.getBoundingClientRect();
            leaves.forEach(function (hb) {
              if (b.top < hb.bottom && b.bottom > hb.top && b.left < hb.right && b.right > hb.left) hidden = true;
            });
          });
          return { pad: parseFloat(getComputedStyle(s).paddingTop), hidden: hidden };
        });
        checks++;
        var wide = sizes[i][2], bad = null;
        if (r.hidden) bad = 'content sits under the HUD';
        else if (wide && r.pad > 40) bad = 'reserved ' + Math.round(r.pad) + 'px of band it does not need';
        if (bad) { fails++; console.log(' FAIL hud gap ' + sizes[i][0] + 'x' + sizes[i][1] + ': ' + bad); }
        else console.log('  ok  hud gap ' + sizes[i][0] + 'x' + sizes[i][1] + ' (pad ' + Math.round(r.pad) + 'px)');
        await pg.close();
      }
    })();

    await browser.close();
    console.log('\n' + checks + ' screen checks, ' + (fails === 0 ? 'ALL UI FIT CHECKS PASSED' : fails + ' FAILED'));
    process.exit(fails === 0 ? 0 : 1);
  }).catch(function (e) {
    console.log('SKIP: could not launch Chromium (' + e.message.split('\n')[0] + ')');
    process.exit(0);
  });
})();
