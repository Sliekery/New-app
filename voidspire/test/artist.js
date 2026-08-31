/* =========================================================================
 * VOIDSPIRE — test/artist.js
 * Drives the artist tool's real buttons in a real browser.
 *
 * The artist is the most stateful thing we own — nine tools, layers, frames,
 * onion skin, reordering, an eraser, a marquee — and it has broken
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

  /* THREE WAYS IN, all checked. The first version had one, styled with a class
   * that was never defined, so it looked exactly like the six grey buttons
   * beside it — and got missed. */
  /* Assert the accent on the button itself rather than by comparing it with a
   * neighbour: a neighbour the test has just clicked carries hover and focus
   * styling of its own, so the comparison measures the mouse. */
  const accent = 'rgb(93, 255, 136)';
  const paint = sel => p.$eval(sel, el => {
    const c = getComputedStyle(el);
    return c.borderColor + ' / ' + c.color;
  });
  ok('the FRAMES bar button is accented, not another grey one',
    (await paint('#fBig')) === accent + ' / ' + accent, await paint('#fBig'));
  ok('and so is PLACE IT on the solid tool',
    (await paint('#sPlace')) === accent + ' / ' + accent, await paint('#sPlace'));
  await p.click('#pvBig'); await p.waitForTimeout(300);
  ok('the preview panel button opens it', await p.isVisible('#theatre'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#preview'); await p.waitForTimeout(300);
  ok('and so does clicking the preview itself', await p.isVisible('#theatre'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

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

  console.log('\nAN EYE IS A ROUND PIP');
  /* "On preview the eyes are a block for some reason." They were: three canvas
   * paths — the LIVE PREVIEW, this one, and the game itself — drew an eye with
   * fillRect, squaring off something the DOM half of the same renderer has
   * always emitted as a <circle> and that the artist's own canvas draws round
   * while you place it. At game size the pip is a pixel or two and the shape
   * cannot be seen; BIG VIEW is where it shows.
   *
   * Measured by AREA AGAINST ITS BOUNDING BOX: a filled circle covers pi/4 of
   * its box, a filled square covers all of it. Two things the measurement has
   * to get right, and both were wrong first:
   *
   *   - ONE pip, not all of them. MIRROR puts a second eye on the far side and
   *     the real-size row repeats the whole figure three times, so a single box
   *     round every red pixel describes the gaps between them and reads 0.004.
   *     The largest connected blob is one eye.
   *   - THE SOLID CORE, not the glow. The pip is drawn with a shadow in its own
   *     colour, and a halo is round whatever it surrounds — so a square would
   *     have measured round. Only pixels at the brightest red present count.
   * ================================================================== */
  /* On FRAME ONE, because BIG VIEW opens there — the section above scrubbed to
   * frame 3, and an eye placed on the frame you happen to be sitting on is not
   * the frame the player opens. */
  await p.click('#frameList > *:nth-child(1)'); await p.waitForTimeout(300);
  await p.click('#mEye'); await p.waitForTimeout(100);
  {
    const eb = await p.locator('#pad').boundingBox();
    await p.mouse.move(eb.x + eb.width * 0.5, eb.y + eb.height * 0.45);
    await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(200);
  }
  ok('an eye is in the art', /e: \[\[/.test(await p.inputValue('#out')),
    (await p.inputValue('#out')).slice(-40));
  await p.click('#fBig'); await p.waitForTimeout(700);
  /* STOP IT PLAYING FIRST, then scrub to the frame the eye is on. BIG VIEW
   * starts the animation the moment it opens, so a measurement taken after a
   * fixed wait lands on whichever frame the clock happened to reach — this
   * passed for a while by landing on the right one, and started failing the
   * day an unrelated change made the drawing quicker to paint. */
  if (/PAUSE/i.test(await p.textContent('#thPlay'))) {
    await p.click('#thPlay'); await p.waitForTimeout(150);
  }
  await p.$eval('#thScrub', el => { el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(250);
  ok('parked on the frame the eye is on', /^1 \//.test(await p.textContent('#thFrame')),
    await p.textContent('#thFrame'));
  {
    const pip = await p.$eval('#thCanvas', c => {
      const W2 = c.width, H2 = c.height;
      const d = c.getContext('2d').getImageData(0, 0, W2, H2).data;
      const isRed = i => d[i] > d[i + 1] + 60 && d[i] > d[i + 2] + 40;
      let maxR = 0;
      for (let i = 0; i < d.length; i += 4) if (isRed(i) && d[i] > maxR) maxR = d[i];
      if (!maxR) return { none: true, size: W2 + 'x' + H2 };
      const core = new Uint8Array(W2 * H2);
      for (let i = 0, k = 0; k < core.length; k++, i += 4) {
        if (d[i] >= maxR - 10 && isRed(i)) core[k] = 1;
      }
      const seen = new Uint8Array(W2 * H2), st = [];
      let best = null;
      for (let k0 = 0; k0 < core.length; k0++) {
        if (!core[k0] || seen[k0]) continue;
        st.length = 0; st.push(k0); seen[k0] = 1;
        let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        while (st.length) {
          const k = st.pop(), x = k % W2, y = (k - x) / W2;
          n++;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (x > 0 && core[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; st.push(k - 1); }
          if (x < W2 - 1 && core[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; st.push(k + 1); }
          if (y > 0 && core[k - W2] && !seen[k - W2]) { seen[k - W2] = 1; st.push(k - W2); }
          if (y < H2 - 1 && core[k + W2] && !seen[k + W2]) { seen[k + W2] = 1; st.push(k + W2); }
        }
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        if (!best || n > best.n) best = { n: n, w: w, h: h, fill: n / (w * h) };
      }
      return best;
    });
    ok('BIG VIEW draws it big enough to have a shape at all',
      pip && !pip.none && pip.w >= 10 && pip.h >= 10, JSON.stringify(pip));
    ok('it is as wide as it is tall', pip && Math.abs(pip.w - pip.h) <= 2,
      pip && pip.w + 'x' + pip.h);
    ok('and it is a ROUND pip, not a block',
      pip && pip.fill > 0.65 && pip.fill < 0.9,
      pip && pip.fill.toFixed(3) + ' of its box filled — a circle is 0.785, a square 1.0');
  }
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);

  console.log('\nAND ITS SIZE IS YOURS');
  /* "Now they are a bit too big. Let me control their size." The size was
   * 0.05 of the figure, hard-coded in five renderers and therefore nobody's
   * decision. An eye is stored WITH its size now — [x,y,d] — and the default
   * came down to 0.04.
   *
   * The part worth asserting is that the DEFAULT IS NOT WRITTEN: art that does
   * not care about the size stays exactly as short as it was, so nothing in
   * the game's 346 existing pieces grows a third number it never asked for. */
  {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    /* MIRROR off: it doubles every eye, and this block counts pips. It follows
     * you between tabs — it is a setting about how you work, not about a
     * drawing — so a fresh tab does not clear it. */
    if (await p.$eval('#bMirror', e => e.classList.contains('on'))) {
      await p.click('#bMirror'); await p.waitForTimeout(150);
    }
    await p.click('#mEye'); await p.waitForTimeout(150);
    ok('the eye tool brings its own size control', await p.isVisible('#eyeBar'));
    ok('and the size is written out, not abbreviated',
      (await p.textContent('#eyeNow')).trim() === '0.04', await p.textContent('#eyeNow'));

    const eb = await p.locator('#pad').boundingBox();
    const place = async fx => {
      await p.mouse.move(eb.x + eb.width * fx, eb.y + eb.height * 0.5);
      await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(180);
    };
    const eyes = async () => {
      const m = (await p.inputValue('#out')).match(/e:\s*(\[[\s\S]*\])\s*\}/);
      // eslint-disable-next-line no-new-func
      return m ? Function('return (' + m[1] + ')')() : [];
    };
    await place(0.35);
    ok('an eye at the default size carries no size at all',
      (await eyes()).every(q => q.length === 2), JSON.stringify(await eyes()));

    await p.click('#eSmall'); await p.waitForTimeout(160);
    ok('SMALLER steps down the list', (await p.textContent('#eyeNow')).trim() === '0.03',
      await p.textContent('#eyeNow'));
    await place(0.62);
    const two = await eyes();
    ok('and an eye at any other size carries it',
      two.some(q => q.length === 3 && Math.abs(q[2] - 0.03) < 1e-9), JSON.stringify(two));
    ok('while the first one is untouched',
      two.some(q => q.length === 2), JSON.stringify(two));

    /* It has to actually be drawn smaller, not merely recorded smaller. */
    const widths = await p.$eval('#pad', c => {
      const W2 = c.width, H2 = c.height;
      const d = c.getContext('2d').getImageData(0, 0, W2, H2).data;
      const isRed = i => d[i] > d[i + 1] + 60 && d[i] > d[i + 2] + 40;
      let maxR = 0;
      for (let i = 0; i < d.length; i += 4) if (isRed(i) && d[i] > maxR) maxR = d[i];
      const core = new Uint8Array(W2 * H2);
      for (let i = 0, k = 0; k < core.length; k++, i += 4) {
        if (d[i] >= maxR - 10 && isRed(i)) core[k] = 1;
      }
      const seen = new Uint8Array(W2 * H2), st = [], out = [];
      for (let k0 = 0; k0 < core.length; k0++) {
        if (!core[k0] || seen[k0]) continue;
        st.length = 0; st.push(k0); seen[k0] = 1;
        let x0 = 1e9, x1 = -1;
        while (st.length) {
          const k = st.pop(), x = k % W2, y = (k - x) / W2;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (x > 0 && core[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; st.push(k - 1); }
          if (x < W2 - 1 && core[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; st.push(k + 1); }
          if (y > 0 && core[k - W2] && !seen[k - W2]) { seen[k - W2] = 1; st.push(k - W2); }
          if (y < H2 - 1 && core[k + W2] && !seen[k + W2]) { seen[k + W2] = 1; st.push(k + W2); }
        }
        out.push({ x: x0, w: x1 - x0 + 1 });
      }
      return out.sort((a, b) => a.x - b.x).map(o => o.w);
    });
    ok('two pips on the canvas, and the second really is smaller',
      widths.length === 2 && widths[1] < widths[0] * 0.85,
      widths.join(' and ') + ' px wide');

    await p.click('#eAll'); await p.waitForTimeout(250);
    const all = await eyes();
    ok('SET ALL TO IT gives every eye the current size',
      all.length === 2 && all.every(q => q.length === 3 && Math.abs(q[2] - 0.03) < 1e-9),
      JSON.stringify(all));
    ok('and says how many it changed', /2 of them/.test(await p.textContent('#status')),
      await p.textContent('#status'));
    await p.click('#bUndo'); await p.waitForTimeout(250);
    ok('one undo puts them all back',
      JSON.stringify(await eyes()) === JSON.stringify(two), JSON.stringify(await eyes()));
  }

  console.log('\nSPACE PANS, AND NEVER PRESSES A BUTTON');
  /* "Pressing space sometimes undoes actions." SPACE is how a button is
   * activated from the keyboard, so a button still holding focus from a mouse
   * click gets re-fired by the pan key — and the button people click most is
   * UNDO. "Sometimes" was the word: the preventDefault sat behind a
   * `!spaceDown` guard, so it was skipped whenever the tool already believed
   * space was down, which is what happens the moment a keyup goes missing. */
  {
    await p.click('#mLine'); await p.waitForTimeout(80);
    const box2 = await p.locator('#pad').boundingBox();
    const strokes = async () =>
      +(((await p.textContent('#status')).match(/(\d+) stroke/)) || [0, 0])[1];
    for (const y of [0.30, 0.40, 0.50]) {
      const y0 = box2.y + box2.height * y;
      await p.mouse.move(box2.x + box2.width * 0.25, y0);
      await p.mouse.down();
      await p.mouse.move(box2.x + box2.width * 0.75, y0, { steps: 4 });
      await p.mouse.up(); await p.waitForTimeout(120);
    }
    const drew = await strokes();
    ok('three lines to work with', drew >= 3, drew + ' strokes');

    await p.click('#bUndo'); await p.waitForTimeout(200);
    const afterUndo = await strokes();
    ok('UNDO takes one back', afterUndo === drew - 1, drew + ' → ' + afterUndo);
    ok('and a mouse click leaves nothing holding the keyboard',
      await p.evaluate(() => document.activeElement === document.body
        || document.activeElement.tagName !== 'BUTTON'),
      await p.evaluate(() => document.activeElement.tagName + '#' + document.activeElement.id));

    await p.keyboard.press('Space'); await p.waitForTimeout(220);
    ok('space does not press UNDO again', (await strokes()) === afterUndo,
      afterUndo + ' → ' + (await strokes()));

    /* THE "SOMETIMES": a keyup that never arrives. Hold space, lose the window
     * before letting go, and the tool is left believing space is still down —
     * after which every press used to slip past the guard. */
    await p.keyboard.down('Space');
    await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    await p.waitForTimeout(120);
    await p.evaluate(() => document.getElementById('bUndo').focus());
    await p.keyboard.press('Space'); await p.waitForTimeout(220);
    ok('nor after a keyup that never arrived', (await strokes()) === afterUndo,
      afterUndo + ' → ' + (await strokes()));
    await p.keyboard.press('Space'); await p.waitForTimeout(220);
    ok('nor on the press after that', (await strokes()) === afterUndo,
      afterUndo + ' → ' + (await strokes()));

    // and it still does its own job
    await p.keyboard.down('Space');
    await p.mouse.move(box2.x + box2.width * 0.5, box2.y + box2.height * 0.5);
    await p.mouse.down();
    await p.mouse.move(box2.x + box2.width * 0.65, box2.y + box2.height * 0.5, { steps: 5 });
    await p.mouse.up();
    await p.keyboard.up('Space');
    await p.waitForTimeout(200);
    ok('holding space still pans the canvas rather than drawing',
      (await strokes()) === afterUndo, 'strokes ' + (await strokes()));
    ok('and the pan cursor is let go of afterwards',
      await p.$eval('#pad', e => e.style.cursor !== 'grab'),
      await p.$eval('#pad', e => e.style.cursor));
    let g = 0;
    while (await p.$eval('#bUndo', e => !e.disabled) && ++g < 30) {
      await p.click('#bUndo'); await p.waitForTimeout(40);
    }
  }

  console.log('\nA MIRROR THAT LANDS ON ITSELF IS NOT DRAWN TWICE');
  /* The 0.015 test only asks whether a stroke reaches away from the middle. A
   * line straight ACROSS the centre does — so it was mirrored, and the copy
   * landed exactly on top of the original. Free for a flat colour; not free
   * here, because the glow is laid down twice and those lines burn brighter
   * than the rest of the drawing. It doubled the data too: 88 of the 638 paths
   * in the first creature handed over this way. */
  {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    if (!(await p.$eval('#bMirror', e => e.classList.contains('on')))) {
      await p.click('#bMirror'); await p.waitForTimeout(150);
    }
    await p.click('#mLine'); await p.waitForTimeout(80);
    const mb = await p.locator('#pad').boundingBox();
    const Wf = v => (v / 1.35 + 1) / 2;
    const ml = async (x0, y0, x1, y1) => {
      await p.mouse.move(mb.x + mb.width * Wf(x0), mb.y + mb.height * Wf(y0));
      await p.mouse.down();
      await p.mouse.move(mb.x + mb.width * Wf(x1), mb.y + mb.height * Wf(y1), { steps: 5 });
      await p.mouse.up(); await p.waitForTimeout(140);
    };
    const paths = async () => {
      const m = (await p.inputValue('#out')).match(/p:\s*(\[[\s\S]*?\])\s*,\s*e:/);
      // eslint-disable-next-line no-new-func
      return m ? Function('return (' + m[1] + ')')() : [];
    };

    await ml(-0.3, -0.4, 0.3, -0.4);            // straight across the centre
    ok('a line symmetric about the centre is exported ONCE',
      (await paths()).length === 1, JSON.stringify(await paths()));

    await ml(0.2, 0.1, 0.6, 0.1);               // off to one side
    ok('and one off to the side is still mirrored into two',
      (await paths()).length === 3, (await paths()).length + ' paths');

    await ml(-0.3, 0.5, 0.5, 0.6);              // crosses the centre, not symmetric
    ok('a line that crosses the centre WITHOUT being symmetric is still mirrored',
      (await paths()).length === 5, (await paths()).length + ' paths');

    /* And the drawing has to be unchanged on screen — the point is that the
     * second copy was invisible except as extra glow, so removing it must not
     * remove any line. */
    const lit = await p.$eval('#pad', c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 1] > 60 && d[i + 1] > d[i] + 20) n++;
      }
      return n;
    });
    ok('all three lines and their mirrors are still on the canvas', lit > 2000, lit + ' lit pixels');
  }


  console.log('\nTHE PLAYER IS IN THE LIBRARY');
  /* The one figure you look at all game, and the only art the tool could not
   * see: it was a local `var` inside render.js rather than a table on `ns`, so
   * `build-assets.js` — which gathers art off `ns` — had nothing to find. Every
   * enemy, engraving and card icon was loadable; the player was not.
   *
   * Its moving parts come across as their own entries. The gun, halo, banner
   * and tatters are not in the body's `p` because they animate apart from it,
   * so welding them on would be a lie about the model and would make them
   * uneditable besides. */
  {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    await p.evaluate(() => {
      const box = [...document.querySelectorAll('.side .box')]
        .find(x => /THE GAME'S ART/.test(x.querySelector('h2').textContent));
      if (box && box.classList.contains('shut')) box.querySelector('h2').onclick();
    });
    await p.waitForTimeout(300);
    ok('there is a PLAYER filter', await p.isVisible('#kPlayer'));
    await p.click('#kPlayer'); await p.waitForTimeout(400);
    const rows = await p.$$eval('#assetList .it .nm', e => e.map(x => x.textContent.trim()));
    ok('all three classes are there',
      ['Vanguard', 'Technomancer', 'Voidadept'].every(n => rows.indexOf(n) >= 0),
      rows.join(' · '));
    ok('and so are the parts that move on their own',
      rows.indexOf('Vanguard — weapon') >= 0
      && rows.indexOf('Technomancer — halo') >= 0
      && rows.indexOf('Voidadept — tatters') >= 0, rows.join(' · '));

    await p.click('#assetList .it:nth-child(1)'); await p.waitForTimeout(600);
    const st = await p.textContent('#status');
    ok('one loads onto the canvas', /34 strokes/.test(st), st);
    ok('with its eyes', /e: \[\[/.test(await p.inputValue('#out')),
      (await p.inputValue('#out')).slice(-50));
    ok('and something is actually drawn', await p.$eval('#pad', c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 60 && d[i + 1] > d[i] + 20) lit++;
      return lit > 2000;
    }));
  }

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
