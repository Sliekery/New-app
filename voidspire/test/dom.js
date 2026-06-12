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

['balance', 'cards', 'artifacts', 'enemies', 'events', 'engine', 'render', 'ui', 'main'].forEach(function (f) {
  var src = fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8');
  try { win.eval(src); } catch (e) { throw new Error(f + '.js failed to eval: ' + e.message); }
});

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function tap(elm) {
  if (!elm) throw new Error('tap target missing');
  elm.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));
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
  if (VS.engine.run.phase !== 'combat') throw new Error('expected combat after class pick, got ' + VS.engine.run.phase);
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

  // play through up to 30 nodes via UI taps
  var safety = 0;
  while (VS.engine.run && VS.engine.run.phase !== 'dead' && VS.engine.run.nodesCleared < 30 && safety++ < 3000) {
    var phase = VS.engine.run.phase;
    if (phase === 'combat') {
      var played = false;
      var cards = qa('#hand .card');
      for (var i = 0; i < cards.length; i++) {
        if (VS.engine.canPlay(i)) {
          tap(cards[i]); await sleep(15);          // select
          var sel = qa('#hand .card')[i];
          if (sel) { tap(sel); await sleep(120); } // play (default target)
          played = true;
          break;
        }
      }
      if (!played) {
        var end = qa('#combat-controls .btn')[0];
        if (end) tap(end);
        await sleep(400);
      }
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
      await sleep(900); // let dice / timelines settle
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
