/* =========================================================================
 * VOIDSPIRE — DOM smoke test (jsdom).
 * Boots the real UI, taps through title -> combat -> several turns,
 * opens modals, and fails loudly on any uncaught error.
 * Usage: NODE_PATH=<jsdom dir>/node_modules node test/dom.js
 * ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var JSDOM = require('jsdom').JSDOM;

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script[^>]*><\/script>/g, ''); // we eval scripts manually

var errors = [];
var dom = new JSDOM(html, {
  pretendToBeVisual: true,
  runScripts: 'outside-only',
  url: 'http://localhost/',
});
var win = dom.window;
win.addEventListener('error', function (e) { errors.push(e.message); });

// give the canvas real dimensions so battlefield layout & hit-testing work
var CW = 390, CH = 760;
var bf = win.document.getElementById('battlefield');
bf.getBoundingClientRect = function () {
  return { width: CW, height: CH, top: 0, left: 0, right: CW, bottom: CH, x: 0, y: 0 };
};

['balance', 'cards', 'artifacts', 'augments', 'enemies', 'events', 'engine', 'render', 'ui', 'main'].forEach(function (f) {
  var src = fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8');
  try { win.eval(src); } catch (e) { throw new Error(f + '.js failed to eval: ' + e.message); }
});

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function tap(elm) {
  if (!elm) throw new Error('tap target missing');
  elm.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
  win.document.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5 }));
}
function swipe(elm, x0, y0, x1, y1) {
  if (!elm) throw new Error('swipe target missing');
  elm.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, clientX: x0, clientY: y0 }));
  win.document.dispatchEvent(new win.MouseEvent('pointermove', { bubbles: true, clientX: (x0 + x1) / 2, clientY: (y0 + y1) / 2 }));
  win.document.dispatchEvent(new win.MouseEvent('pointermove', { bubbles: true, clientX: x1, clientY: y1 }));
  win.document.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, clientX: x1, clientY: y1 }));
}
function q(sel) { return win.document.querySelector(sel); }
function qa(sel) { return Array.prototype.slice.call(win.document.querySelectorAll(sel)); }

async function main() {
  var VS = win.VS;
  // speed up timelines
  VS.BALANCE.feel.enemyActDelay = 10;
  VS.BALANCE.feel.cardPlayDelay = 5;

  await sleep(50);
  if (!qa('#overlay .panel-btn').length) throw new Error('title screen did not render');
  console.log('title screen: OK');

  // start a vanguard run (skip a possible CONTINUE button by matching name)
  var btn = qa('#overlay .panel-btn').find(function (b) { return b.textContent.indexOf('VANGUARD') >= 0; });
  tap(btn);
  await sleep(50);
  if (VS.engine.run.phase !== 'map') throw new Error('expected star-chart map after class pick, got ' + VS.engine.run.phase);
  if (!qa('#overlay .mapnode.reachable').length) throw new Error('map has no reachable start nodes');
  console.log('map boot: OK, ' + qa('#overlay .mapnode.reachable').length + ' start nodes');

  // enter the first node (row 0 is always a fight): a single tap jumps
  tap(qa('#overlay .mapnode.reachable')[0]);
  await sleep(80);
  if (VS.engine.run.phase !== 'combat') throw new Error('expected combat after entering a fight node, got ' + VS.engine.run.phase);
  if (!qa('#hand .card').length) throw new Error('hand did not render');
  console.log('combat boot: OK, hand size ' + qa('#hand .card').length);

  // open & close deck modal and menu
  tap(q('[data-act="deck"]'));
  await sleep(20);
  if (!qa('#overlay .card').length) throw new Error('deck modal empty');
  tap(qa('#overlay .btn').pop());
  await sleep(20);
  tap(q('[data-act="menu"]'));
  await sleep(20);
  tap(qa('#overlay .panel-btn')[0]); // resume
  await sleep(20);
  if (VS.engine.run.phase !== 'combat') throw new Error('resume from menu failed');
  console.log('modals: OK');

  // tap selects (for reading), tap again deselects
  var firstCard = qa('#hand .card')[0];
  tap(firstCard); await sleep(20);
  if (!qa('#hand .card.selected').length) throw new Error('tap did not select card');
  tap(qa('#hand .card.selected')[0]); await sleep(20);
  if (qa('#hand .card.selected').length) throw new Error('second tap did not deselect card');
  console.log('tap select/deselect: OK');

  // play through up to 30 nodes via swipe gestures
  var safety = 0;
  var stuckPhase = '', stuckCount = 0;
  while (VS.engine.run && VS.engine.run.phase !== 'dead' && VS.engine.run.nodesCleared < 30 && safety++ < 3000) {
    var phase = VS.engine.run.phase;
    // if a screen isn't advancing (e.g. tapping an unaffordable shop item),
    // bail out via its last button (DEPART / CONTINUE / etc.)
    var stuckKey = phase + ':' + VS.engine.run.nodesCleared;
    stuckCount = (stuckKey === stuckPhase) ? stuckCount + 1 : 0;
    stuckPhase = stuckKey;
    if (stuckCount > 5 && phase !== 'combat') {
      // bail via a real exit button (DEPART / CONTINUE / SKIP), never a
      // confirm-bar button (those are also .btn)
      var bail = qa('#overlay .btn:not(.cb-ok):not(.cb-cancel)').pop();
      if (bail) { tap(bail); await sleep(400); continue; }
    }
    if (phase === 'combat') {
      var played = false;
      var cards = qa('#hand .card');
      for (var i = 0; i < cards.length; i++) {
        if (VS.engine.canPlay(i)) {
          // swipe the card up onto the first living enemy; the UI ignores
          // input while an action timeline plays, so retry like a human would
          var uid = VS.engine.combat.hand[i].uid;
          var gone = false;
          for (var attempt = 0; attempt < 12 && !gone; attempt++) {
            var ti = VS.engine.combat.enemies.findIndex(function (e) { return e.alive; });
            var pos = VS.render.enemyPos(ti);
            swipe(qa('#hand .card')[i], 200, 700, pos.x, pos.y);
            await sleep(200);
            gone = !VS.engine.combat || VS.engine.combat.over || VS.engine.run.phase !== 'combat' ||
              !VS.engine.combat.hand.some(function (c) { return c.uid === uid; });
          }
          if (!gone) throw new Error('swipe did not play the card after retries');
          played = true;
          break;
        }
      }
      if (!played) {
        var end = qa('#combat-controls .btn')[0];
        if (end) tap(end);
        await sleep(400);
      }
    } else if (phase === 'map') {
      // star-chart: a single tap on a reachable node jumps to it
      var node = null;
      for (var mtries = 0; mtries < 40 && !node; mtries++) {
        node = qa('#overlay .mapnode.reachable')[0];
        if (!node) await sleep(40);
      }
      if (!node) throw new Error('no reachable map node');
      tap(node);
      await sleep(140);
    } else {
      // overlay phase: tap the first actionable element (it may render after
      // a victory/defeat delay, so poll briefly)
      var act = null;
      for (var tries = 0; tries < 40 && !act; tries++) {
        act = qa('#overlay .panel-btn:not(.disabled)')[0] ||
              qa('#overlay .card-grid .card:not(.sold)')[0] ||
              qa('#overlay .btn')[0];
        if (!act) await sleep(50);
      }
      if (!act) throw new Error('no actionable element in phase ' + phase);
      tap(act);
      await sleep(140);
      // most committal actions now arm a confirm bar — confirm it
      var cbok = q('#overlay .confirm-bar.show .cb-ok');
      if (cbok) { tap(cbok); await sleep(160); }
      await sleep(740); // let dice / timelines settle
    }
  }
  if (safety >= 3000) throw new Error('UI drive safety tripped in phase ' + VS.engine.run.phase);
  console.log('played through: nodes cleared = ' + (VS.engine.run ? VS.engine.run.nodesCleared : '?') +
    ', phase = ' + (VS.engine.run ? VS.engine.run.phase : 'no-run') +
    ', sector = ' + (VS.engine.run ? VS.engine.run.sector : '?'));

  // if dead, restart via game over button
  if (VS.engine.run && VS.engine.run.phase === 'dead') {
    await sleep(900);
    tap(qa('#overlay .btn')[0]);
    await sleep(50);
    if (!qa('#overlay .panel-btn').length) throw new Error('did not return to title after death');
    console.log('death -> title: OK');
  }

  if (errors.length) throw new Error('uncaught page errors:\n' + errors.join('\n'));
  console.log('\nDOM SMOKE TEST PASSED');
  win.close();
  process.exit(0);
}

main().catch(function (e) {
  console.error('DOM TEST FAILED:', e.message);
  if (errors.length) console.error('page errors:', errors.join('\n'));
  process.exit(1);
});
