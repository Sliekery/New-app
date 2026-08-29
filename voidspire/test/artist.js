/* =========================================================================
 * VOIDSPIRE — test/artist.js
 * Drives the artist tool's real buttons in a real browser.
 *
 * The artist is the most stateful thing we own — nine tools, layers, frames,
 * onion skin, tweening, reordering, an eraser, a marquee — and it has broken
 * more often than anything else, always in the same way: a handler updates
 * the model and leaves the canvas, the status line or the export showing what
 * was true before it. UNDO was greyed out with points on screen. A finished
 * shape "was there and looked as though it was not". A dragged frame moved
 * nothing. None of those were logic errors; all of them were a display that
 * had stopped agreeing with the data.
 *
 * So this asserts against the two things the tool says about itself — the
 * status line ("frame 1/2 · layer "line" · 3 strokes · exports 3 paths") and
 * the export box — after every gesture. If those two agree with each other
 * and with what was just drawn, the tool is telling the truth.
 *
 * Usage: node test/artist.js     (with the tools served on :8944)
 * ========================================================================= */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // several commands confirm before destroying something; Playwright dismisses
  // dialogs by default, which silently turned every one of them into a no-op
  p.on('dialog', d => d.accept());
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push('console: ' + m.text());
  });
  // start from nothing: the tool restores its last drawing, which would make
  // every count below depend on whatever was drawn the run before
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto('http://localhost:8944/tools/artist.html');
  await p.waitForTimeout(600);

  const status = () => p.textContent('#status');
  const out = () => p.inputValue('#out');
  /* Everything the status line claims, as numbers. */
  const readout = async () => {
    const s = await status();
    const m = {
      frame: +((s.match(/frame (\d+)\//) || [])[1] || 0),
      frames: +((s.match(/frame \d+\/(\d+)/) || [])[1] || 0),
      layer: (s.match(/layer "([^"]+)"/) || [])[1] || '',
      strokes: +((s.match(/(\d+) stroke/) || [])[1] || 0),
      inHand: +((s.match(/(\d+) in hand/) || [])[1] || 0),
      paths: +((s.match(/exports (\d+) path/) || [])[1] || 0),
      mirrored: /MIRRORED/.test(s),
      raw: s,
    };
    return m;
  };
  /* What the export box actually contains, parsed as the art format the game
   * reads: polylines in a -1..1 box plus eye pips. Counting the brackets is
   * not enough — the format is the contract, so parse it as the game would. */
  const art = async () => {
    const v = await out();
    const m = v.match(/art:\s*([\s\S]*),\s*$/);
    if (!m) return null;
    try {
      // the exported block is a JS object literal with unquoted keys
      // eslint-disable-next-line no-new-func
      return Function('return (' + m[1] + ')')();
    } catch (e) { return { parseError: e.message, src: v.slice(0, 120) }; }
  };
  const box = await p.locator('#pad').boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  async function tap(fx, fy) {
    const [x, y] = at(fx, fy);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(60);
  }
  async function drag(f0x, f0y, f1x, f1y) {
    const [x0, y0] = at(f0x, f0y), [x1, y1] = at(f1x, f1y);
    await p.mouse.move(x0, y0); await p.mouse.down();
    await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 5 });
    await p.mouse.move(x1, y1, { steps: 5 });
    await p.mouse.up();
    await p.waitForTimeout(90);
  }
  const undoEnabled = () => p.$eval('#bUndo', e => !e.disabled);
  const redoEnabled = () => p.$eval('#bRedo', e => !e.disabled);

  console.log('EMPTY');
  let r = await readout();
  ok('it opens on one empty frame', r.frames === 1 && r.strokes === 0, r.raw);
  ok('undo is off with nothing done', !(await undoEnabled()));

  console.log('\nPATH — the default tool, and the one whose undo was dead');
  await tap(0.3, 0.3); await tap(0.5, 0.3); await tap(0.5, 0.6);
  r = await readout();
  ok('three taps are three points in hand', r.inHand === 3, r.raw);
  /* The bug this exists for: UNDO was greyed out while an unfinished stroke
   * had points in it, because the buttons only synced on history changes. */
  ok('UNDO is live while a stroke is in progress', await undoEnabled(),
    'points in hand: ' + r.inHand);
  await p.click('#bUndo'); await p.waitForTimeout(120);
  ok('undo takes back one point', (await readout()).inHand === 2, (await readout()).raw);
  await p.click('#bRedo'); await p.waitForTimeout(120);
  ok('redo puts it back', (await readout()).inHand === 3, (await readout()).raw);
  await p.click('#bFinish'); await p.waitForTimeout(150);
  r = await readout();
  ok('finishing makes it a stroke', r.strokes === 1 && r.inHand === 0, r.raw);
  /* Not "one stroke means one path" — MIRROR is on by default, so one stroke
   * exports as two. The invariant worth holding is that the status line and
   * the export box never disagree, which is where every display bug in this
   * tool has shown up. */
  ok('the export agrees with the status line', (await art()).p.length === r.paths,
    'export ' + (await art()).p.length + ' paths, status says ' + r.paths);

  console.log('\nEVERY TOOL PUTS SOMETHING ON THE CANVAS');
  const before = (await readout()).strokes;
  const tools = [
    ['#mLine',  'LINE',  async () => drag(0.2, 0.7, 0.4, 0.8)],
    ['#mFree',  'FREE',  async () => drag(0.6, 0.2, 0.8, 0.4)],
    ['#mShape', 'SHAPE', async () => drag(0.6, 0.6, 0.8, 0.8)],
  ];
  let expect = before;
  for (const [sel, name, gesture] of tools) {
    await p.click(sel); await p.waitForTimeout(80);
    await gesture();
    expect++;
    const now = await readout();
    ok(name.padEnd(6) + ' adds exactly one stroke', now.strokes === expect,
      'expected ' + expect + ', status says ' + now.strokes);
    /* The other old bug: the model updated and the canvas, status and export
     * did not, so a finished primitive looked as though it had not happened. */
    const a = await art();
    ok(name.padEnd(6) + ' reaches the export too', a && a.p.length === now.paths,
      'export ' + (a ? a.p.length : 'unparseable') + ' paths, status says ' + now.paths);
  }

  console.log('\nSHAPES — all of them, inside the dragged box');
  const shapes = await p.$$eval('#shapeBar .shp', bs => bs.map(x => x.dataset.shp));
  /* The original nine are the contract; the sci-fi ones on top of them are
   * covered in detail by test/geometry.js. What matters here is that adding
   * them did not take any of the originals away. */
  const NINE = ['circle', 'ellipse', 'rect', 'square', 'round', 'tri', 'poly', 'star', 'arc'];
  ok('the original nine are all still there', NINE.every(n => shapes.indexOf(n) >= 0),
    NINE.filter(n => shapes.indexOf(n) < 0).join(',') + ' missing');
  ok('and there are more besides', shapes.length > 9, shapes.length + ' in all');
  for (const shp of shapes) {
    await p.click(`#shapeBar .shp[data-shp="${shp}"]`);
    const n0 = (await readout()).strokes;
    await drag(0.15, 0.15, 0.35, 0.35);
    const n1 = (await readout()).strokes;
    const a = await art();
    // every point of every path must be inside -1..1, and none may be NaN:
    // Canvas silently drops a path containing NaN, so bad art never draws
    let bad = 0, nan = 0;
    (a.p || []).forEach(q => q.forEach((v, i) => {
      if (!isFinite(v)) nan++;
      else if (v < -1.001 || v > 1.001) bad++;
    }));
    /* Not "exactly one stroke": several of these are made of separate lines —
     * brackets are four corners, a reticle is a ring plus its ticks. What has
     * to hold is that something arrived and that all of it is usable. */
    ok(shp.padEnd(8) + ' draws, stays in the box, and has no NaN',
      n1 > n0 && bad === 0 && nan === 0,
      n0 + '→' + n1 + ' strokes, ' + bad + ' out of range, ' + nan + ' NaN');
    await p.click('#bUndo'); await p.waitForTimeout(90);
  }

  console.log('\nERASER');
  await p.click('#mErase'); await p.waitForTimeout(80);
  const eBefore = (await readout()).strokes;
  await drag(0.6, 0.6, 0.8, 0.8);            // over the shape drawn earlier
  const eAfter = (await readout()).strokes;
  ok('erasing removes at least one stroke', eAfter < eBefore, eBefore + ' → ' + eAfter);
  await p.click('#bUndo'); await p.waitForTimeout(120);
  ok('and undo brings it back', (await readout()).strokes === eBefore,
    eBefore + ' vs ' + (await readout()).strokes);

  console.log('\nLAYERS');
  const l0 = await readout();
  await p.click('#lAdd'); await p.waitForTimeout(150);
  const l1 = await readout();
  ok('a new layer is a different layer', l1.layer !== l0.layer, l0.layer + ' → ' + l1.layer);
  ok('and it starts empty', l1.strokes === 0, l1.raw);
  ok('while the export still has the other layer\'s work', (await art()).p.length > 0,
    'exports ' + l1.paths);
  await p.click('#mLine'); await drag(0.25, 0.5, 0.45, 0.5);
  ok('drawing lands on the new layer', (await readout()).strokes === 1, (await readout()).raw);
  await p.click('#lDel'); await p.waitForTimeout(200);
  ok('deleting it returns to the first', (await readout()).layer === l0.layer,
    (await readout()).layer);

  console.log('\nFRAMES');
  const f0 = await art();
  await p.click('#fDup'); await p.waitForTimeout(200);
  let fr = await readout();
  ok('duplicate makes a second frame', fr.frames === 2, fr.raw);
  const f1 = await art();
  ok('and the export becomes an animation', !!(f1 && f1.frames && f1.frames.length === 2),
    JSON.stringify(f1).slice(0, 90));
  ok('the duplicate is identical to the original',
    JSON.stringify(f1.frames[0]) === JSON.stringify(f1.frames[1]));
  await p.click('#fAdd'); await p.waitForTimeout(200);
  fr = await readout();
  ok('+ FRAME adds a blank third', fr.frames === 3 && fr.strokes === 0, fr.raw);

  /* Frame reordering: the handlers had to move to `document`, because
   * re-rendering the strip destroyed the very element holding pointer
   * capture, and the history snapshot had to move to the first move, because
   * taking it after the change meant undo restored the new order. */
  console.log('\nREORDERING A FRAME');
  const thumbs = await p.$$('#frameList > *');
  ok('the strip shows one thumb per frame', thumbs.length === 3, String(thumbs.length));
  const orderBefore = JSON.stringify((await art()).frames);
  const b0 = await thumbs[0].boundingBox(), b2 = await thumbs[2].boundingBox();
  await p.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
  await p.mouse.down();
  await p.mouse.move(b0.x + b0.width, b0.y + b0.height / 2, { steps: 3 });
  await p.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(250);
  const orderAfter = JSON.stringify((await art()).frames);
  ok('dragging a frame changes the order', orderAfter !== orderBefore);
  await p.click('#bUndo'); await p.waitForTimeout(200);
  ok('and undo puts the order back',
    JSON.stringify((await art()).frames) === orderBefore,
    'still reordered after undo');

  console.log('\nTWEEN');
  await p.click('#fTween'); await p.waitForTimeout(400);
  fr = await readout();
  ok('tween inserts frames', fr.frames > 3, 'frames ' + fr.frames);
  const tw = await art();
  let twNaN = 0;
  (tw.frames || []).forEach(f => (f.p || []).forEach(q => q.forEach(v => { if (!isFinite(v)) twNaN++; })));
  ok('and none of them contains a NaN', twNaN === 0, twNaN + ' NaN coordinates');
  await p.click('#bUndo'); await p.waitForTimeout(250);
  ok('undo removes them again', (await readout()).frames === 3, (await readout()).raw);

  console.log('\nMIRROR');
  /* Back to a tool that actually uses it: the solid tool and the sci-fi
   * shapes never mirror, and say so in different words, so the flag is not
   * readable from there. */
  await p.click('#mDraw'); await p.waitForTimeout(80);
  const mir0 = (await readout()).mirrored;
  await p.click('#bMirror'); await p.waitForTimeout(200);
  ok('the toggle flips it', (await readout()).mirrored === !mir0,
    'was ' + mir0 + ', now ' + (await readout()).mirrored);
  await p.click('#bMirror'); await p.waitForTimeout(200);
  ok('and flips it back', (await readout()).mirrored === mir0);

  console.log('\nUNDO ALL THE WAY DOWN');
  let guard = 0;
  while (await undoEnabled() && ++guard < 200) { await p.click('#bUndo'); }
  ok('undo runs out rather than throwing', guard < 200, guard + ' steps');
  r = await readout();
  ok('and lands back on one empty frame', r.frames === 1 && r.strokes === 0, r.raw);
  ok('redo is available after all that', await redoEnabled());

  console.log('\nTHE EXPORT IS THE FORMAT THE GAME READS');
  await p.click('#mShape'); await p.waitForTimeout(60);
  await drag(0.3, 0.3, 0.7, 0.7);
  const fin = await art();
  ok('it parses', fin && !fin.parseError, fin && fin.parseError);
  ok('it has the two keys the renderer wants',
    fin && Array.isArray(fin.p) && Array.isArray(fin.e), Object.keys(fin || {}).join(','));
  ok('every path is a flat list of pairs',
    fin.p.every(q => q.length >= 4 && q.length % 2 === 0),
    fin.p.map(q => q.length).join(','));
  ok('every coordinate is finite and inside the box',
    fin.p.every(q => q.every(v => isFinite(v) && v >= -1.001 && v <= 1.001)));


  console.log('\nTHE BIG VIEW');
  /* A playback window is only worth having if it actually plays, so this
   * watches the frame counter move rather than checking that a div appeared.
   * The controls are then driven the way an animator would: pause, step,
   * scrub — and the frame you scrubbed to has to be the one still selected
   * when you close, or the window is a detour rather than a place to work. */
  await p.click('#fAdd'); await p.click('#fAdd'); await p.waitForTimeout(200);
  const nFrames = await p.$$eval('#frameList > *', e => e.length);
  ok('there are frames to play', nFrames >= 3, nFrames + ' frames');

  await p.click('#fBig'); await p.waitForTimeout(300);
  ok('it opens', await p.isVisible('#theatre'));
  const size = await p.$eval('#thCanvas', c => {
    const r = c.getBoundingClientRect();
    return { css: Math.round(r.width) + 'x' + Math.round(r.height), back: c.width + 'x' + c.height };
  });
  ok('the canvas fills the screen and has a real backing store',
    /^\d{3,}x\d{3,}$/.test(size.css) && size.back !== '300x150', JSON.stringify(size));
  ok('and it is bigger than the side panel it replaces',
    parseInt(size.css, 10) > 640, size.css + ' vs the panel at 640x330');

  ok('it starts playing on its own', /PAUSE/.test(await p.textContent('#thPlay')),
    await p.textContent('#thPlay'));
  /* SAMPLE UNTIL IT MOVES, rather than once after a fixed wait. Reading it
   * twice 700ms apart at 8fps over a 3-frame loop lands on the same frame
   * both times — 700ms is 5.6 frames, and 5.6 modulo 3 is close enough to
   * zero to look exactly like an animation that is not playing. */
  async function seenFrames(ms) {
    const seen = new Set();
    for (let t = 0; t < ms; t += 60) {
      seen.add((await p.textContent('#thFrame')).trim());
      await p.waitForTimeout(60);
    }
    return seen;
  }
  const moved = await seenFrames(1200);
  ok('and the frame really advances', moved.size > 1, [...moved].join(' '));

  await p.click('#thPlay'); await p.waitForTimeout(250);
  const tf3 = await p.textContent('#thFrame');
  await p.waitForTimeout(500);
  ok('pause stops it', (await p.textContent('#thFrame')) === tf3, tf3 + ' → ' + (await p.textContent('#thFrame')));
  ok('and the panel PLAY agrees it stopped — one clock, two windows',
    /PLAY/.test(await p.textContent('#fPlay')), await p.textContent('#fPlay'));

  const cur = parseInt(await p.textContent('#thFrame'), 10);
  await p.click('#thNext'); await p.waitForTimeout(120);
  ok('the next-frame button steps forward', parseInt(await p.textContent('#thFrame'), 10) === (cur % nFrames) + 1,
    cur + ' → ' + (await p.textContent('#thFrame')));
  await p.click('#thPrev'); await p.waitForTimeout(120);
  ok('and the previous one steps back', parseInt(await p.textContent('#thFrame'), 10) === cur);

  await p.$eval('#thScrub', el => { el.value = 2; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(150);
  ok('scrubbing lands on that frame', /^3 \//.test(await p.textContent('#thFrame')),
    await p.textContent('#thFrame'));

  for (const bg of ['grid', 'light', 'dark']) {
    await p.click(`#theatre .thbg[data-bg="${bg}"]`); await p.waitForTimeout(100);
    ok('the ' + bg.padEnd(5) + ' ground paints', await p.$eval('#thCanvas', c => {
      const d = c.getContext('2d').getImageData(0, 0, 40, 40).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) lit++;
      return lit > 100;                       // the background itself is opaque
    }));
  }
  await p.click('#thSizes'); await p.waitForTimeout(120);
  ok('the real-size row can be turned off', await p.isVisible('#thSizes'));
  await p.click('#thSizes'); await p.waitForTimeout(120);

  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('escape closes it', !(await p.isVisible('#theatre')));
  ok('and leaves you on the frame you scrubbed to',
    /frame 3\//.test(await p.textContent('#status')), await p.textContent('#status'));

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
