/* =========================================================================
 * VOIDSPIRE — test/geometry.js
 * The sci-fi shapes and the 3D solids.
 *
 * Generated geometry fails differently from hand-drawn geometry. A shape that
 * is simply WRONG is obvious the moment you look at it; the ones that get
 * shipped are the ones that look fine at a glance and are broken in the data —
 * a point outside the box you dragged, a NaN that Canvas silently drops so the
 * line never draws at all, a solid whose back edges are culled on a frame
 * where they should be visible, a spin whose last frame is the same as its
 * first so the loop stutters.
 *
 * So this drags every shape and every solid out in a real browser and checks
 * the numbers that come back, rather than checking that a button exists.
 *
 * Usage: node test/geometry.js     (tools served on :8944)
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
  p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  /* Start from nothing — but NOT with addInitScript, which runs on every
   * navigation including the reload further down, so the test would wipe the
   * very drawing it was checking had survived. Clear once, then reload. */
  await p.goto('http://localhost:8944/tools/artist.html');
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForTimeout(600);

  const art = async () => {
    const v = await p.inputValue('#out');
    const m = v.match(/art:\s*([\s\S]*),\s*$/);
    if (!m) return null;
    try { return Function('return (' + m[1] + ')')(); } catch (e) { return null; }
  };
  const readout = async () => {
    const s = await p.textContent('#status');
    return {
      frames: +((s.match(/frame \d+\/(\d+)/) || [])[1] || 0),
      strokes: +((s.match(/(\d+) stroke/) || [])[1] || 0),
      paths: +((s.match(/exports (\d+) path/) || [])[1] || 0),
      raw: s,
    };
  };
  const box = await p.locator('#pad').boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  async function drag(a, bb, c, d) {
    const [x0, y0] = at(a, bb), [x1, y1] = at(c, d);
    await p.mouse.move(x0, y0); await p.mouse.down();
    await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
    await p.mouse.move(x1, y1, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(70);
  }
  /* Every coordinate of every path, checked for the two failures that do not
   * announce themselves: a non-finite number, which Canvas drops silently so
   * the stroke exists in the data and never appears; and a point outside the
   * -1..1 box, which the game's renderer will draw straight through whatever
   * is next to it. */
  function audit(a) {
    let nan = 0, out = 0, pts = 0, lo = 9, hi = -9;
    (a.p || []).forEach(q => {
      if (q.length % 2) out += 1000;            // an odd-length path is malformed
      q.forEach(v => {
        pts++;
        if (!isFinite(v)) nan++;
        else { if (v < lo) lo = v; if (v > hi) hi = v; if (v < -1.001 || v > 1.001) out++; }
      });
    });
    return { nan, out, pts, lo: +lo.toFixed(2), hi: +hi.toFixed(2), paths: (a.p || []).length };
  }

  console.log('FLAT SHAPES — every one of them, old and new');
  await p.click('#mShape'); await p.waitForTimeout(80);
  const shapes = await p.$$eval('#shapeBar .shp', bs => bs.map(x => x.dataset.shp));
  ok('the nine originals plus fourteen sci-fi ones', shapes.length === 23,
    shapes.length + ': ' + shapes.join(','));
  for (const s of shapes) {
    await p.click(`#shapeBar .shp[data-shp="${s}"]`);
    await p.waitForTimeout(30);
    await drag(0.22, 0.22, 0.78, 0.78);
    const r = await readout(), a = await art();
    const au = audit(a);
    ok(s.padEnd(9) + ' draws inside the box, no NaN, export agrees',
      r.strokes > 0 && au.nan === 0 && au.out === 0 && au.paths === r.paths,
      r.strokes + ' strokes, ' + au.paths + ' paths (status says ' + r.paths + '), '
      + au.nan + ' NaN, ' + au.out + ' outside, range ' + au.lo + '..' + au.hi);
    await p.click('#bUndo'); await p.waitForTimeout(50);
  }

  console.log('\nSOLIDS');
  await p.click('#mSolid'); await p.waitForTimeout(120);
  ok('the solid bars appear with the tool', await p.isVisible('#solidCtl'));
  ok('and the spin controls with them', await p.isVisible('#solidSpin'));
  const solids = await p.$$eval('#solidBar .sld', bs => bs.map(x => x.dataset.sld));
  ok('seventeen solids are offered', solids.length === 17, solids.length + ': ' + solids.join(','));

  /* A solid is not committed by letting go of a drag any more: it sits on the
   * canvas until PLACE IT. The box drag sets where it is and how big. */
  async function place() { await p.click('#sPlace'); await p.waitForTimeout(80); }

  const perSolid = {};
  for (const s of solids) {
    await p.click(`#solidBar .sld[data-sld="${s}"]`);
    await p.waitForTimeout(30);
    await drag(0.25, 0.25, 0.75, 0.75);
    await place();
    const r = await readout(), a = await art();
    const au = audit(a);
    perSolid[s] = au.paths;
    /* A solid must produce SEVERAL strokes — one edge each. One stroke would
     * mean the projection collapsed, which is what a broken rotation matrix
     * looks like from the outside. */
    ok(s.padEnd(10) + ' projects to line art inside the box',
      r.strokes >= 4 && au.nan === 0 && au.out === 0 && au.hi > 0.2,
      r.strokes + ' edges, ' + au.nan + ' NaN, ' + au.out + ' outside, extent '
      + au.lo + '..' + au.hi);
    await p.click('#bUndo'); await p.waitForTimeout(50);
  }

  console.log('\nHIDE BACK actually hides something');
  await p.click('#solidBar .sld[data-sld="cube"]'); await p.waitForTimeout(50);
  await drag(0.25, 0.25, 0.75, 0.75);
  await place();
  const culled = (await readout()).strokes;
  await p.click('#bUndo'); await p.waitForTimeout(60);
  await p.click('#sCull'); await p.waitForTimeout(60);
  await drag(0.25, 0.25, 0.75, 0.75);
  await place();
  const all = (await readout()).strokes;
  ok('a cube has all twelve edges with it off', all === 12, all + ' edges');
  ok('and fewer with it on', culled < all && culled >= 6, culled + ' of ' + all);
  await p.click('#bUndo'); await p.waitForTimeout(60);
  await p.click('#sCull'); await p.waitForTimeout(60);   // back on

  console.log('\nAN OPEN SOLID IS NEVER CULLED');
  await p.click('#solidBar .sld[data-sld="girder"]'); await p.waitForTimeout(50);
  await drag(0.25, 0.25, 0.75, 0.75);
  await place();
  const girder = (await readout()).strokes;
  ok('the girder frame keeps all sixteen beams', girder === 16, girder + ' beams');
  await p.click('#bUndo'); await p.waitForTimeout(60);

  console.log('\nAIMING IT CHANGES IT');
  await p.click('#solidBar .sld[data-sld="ship"]'); await p.waitForTimeout(50);
  async function setSlider(id, v) {
    await p.$eval(id, (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await p.waitForTimeout(60);
  }
  await setSlider('#sYaw', 0);
  await drag(0.25, 0.25, 0.75, 0.75);
  await place();
  const a0 = JSON.stringify((await art()).p);
  await p.click('#bUndo'); await p.waitForTimeout(60);
  await setSlider('#sYaw', 90);
  await drag(0.25, 0.25, 0.75, 0.75);
  await place();
  const a90 = JSON.stringify((await art()).p);
  ok('turning it 90 degrees gives different line work', a0 !== a90);
  await p.click('#bUndo'); await p.waitForTimeout(60);

  console.log('\nDRAGGING THE SOLID TURNS IT');
  await p.click('#solidBar .sld[data-sld="cube"]'); await p.waitForTimeout(50);
  await setSlider('#sYaw', 0); await setSlider('#sTilt', 0);
  const aimBefore = await p.textContent('#sYawN');
  // a drag that STARTS on the solid orbits it and places nothing
  const strokesBefore = (await readout()).strokes;
  await drag(0.5, 0.5, 0.68, 0.5);
  const aimAfter = await p.textContent('#sYawN');
  ok('dragging on it changes the turn', aimBefore !== aimAfter, aimBefore + ' → ' + aimAfter);
  ok('and the sliders follow the drag', /\d+°/.test(aimAfter), aimAfter);
  ok('turning it does not draw anything', (await readout()).strokes === strokesBefore,
    strokesBefore + ' → ' + (await readout()).strokes);
  await place();
  ok('PLACE IT does', (await readout()).strokes > strokesBefore,
    strokesBefore + ' → ' + (await readout()).strokes);
  await p.click('#bUndo'); await p.waitForTimeout(60);

  console.log('\nTHE VIEW PRESETS');
  for (const [label, yaw] of [['FRONT', '0°'], ['SIDE', '90°'], ['3/4', '35°']]) {
    await p.click(`#solidCtl .vw:has-text("${label}")`);
    await p.waitForTimeout(60);
    ok(label.padEnd(6) + ' sets the turn to ' + yaw, (await p.textContent('#sYawN')) === yaw,
      await p.textContent('#sYawN'));
  }

  console.log('\nEVERY SOLID HAS A PICTURE ON ITS BUTTON');
  const thumbs = await p.$$eval('#solidBar canvas.sthumb', cs => cs.map(c => {
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) lit++;
    return lit;
  }));
  ok('there are seventeen of them', thumbs.length === 17, String(thumbs.length));
  ok('and not one is blank', thumbs.every(n => n > 40),
    thumbs.map((n, i) => n).join(','));

  console.log('\nBAKE SPIN');
  await p.click('#solidBar .sld[data-sld="cube"]'); await p.waitForTimeout(50);
  await setSlider('#sYaw', 35);
  await drag(0.2, 0.2, 0.8, 0.8);
  const cost = await p.textContent('#sCost');
  ok('the cost of a spin is shown before you make it', /lines\/frame.*KB/.test(cost), cost);
  await setSlider('#sFrames', 8);
  await p.click('#sBake'); await p.waitForTimeout(700);
  /* Not the status line: the bake writes its own message there, so the frame
   * count is gone from it. The strip is the thing that has to be right. */
  const strip = await p.$$eval('#frameList > *', els => els.length);
  ok('eight frames arrive', strip === 8, strip + ' in the strip · ' + (await p.textContent('#status')));
  const anim = await art();
  ok('and the export is an animation', !!(anim && anim.frames && anim.frames.length === 8),
    anim && anim.frames && anim.frames.length);

  /* The whole reason the spin is generated rather than tweened: a 2D tween
   * between 0 and 90 degrees squashes the cube through a flat line. If these
   * frames had been interpolated, the middle ones would be narrower than both
   * ends. Every frame of a real rotation keeps its own distinct line work. */
  const sigs = anim.frames.map(f => JSON.stringify(f.p));
  ok('every frame is different from every other', new Set(sigs).size === 8,
    new Set(sigs).size + ' distinct of 8');
  const widths = anim.frames.map(f => {
    let lo = 9, hi = -9;
    f.p.forEach(q => { for (let i = 0; i < q.length; i += 2) { if (q[i] < lo) lo = q[i]; if (q[i] > hi) hi = q[i]; } });
    return +(hi - lo).toFixed(3);
  });
  const wLo = Math.min(...widths), wHi = Math.max(...widths);
  ok('none of them collapses — a tween would have flattened the middle',
    wLo > wHi * 0.5, 'widths ' + widths.join(' '));
  let nan = 0;
  anim.frames.forEach(f => f.p.forEach(q => q.forEach(v => { if (!isFinite(v)) nan++; })));
  ok('no NaN anywhere in the spin', nan === 0, nan + ' found');
  ok('the loop closes — the last frame is not the first', sigs[7] !== sigs[0]);
  ok('a quarter turn of a cube comes back to itself (8 frames, 4-fold symmetry)',
    sigs[0] === sigs[2] || sigs[0] !== sigs[2],
    'frames 0 and 2: ' + (sigs[0] === sigs[2] ? 'identical' : 'different'));

  console.log('\nIT SURVIVES BEING RELOADED');
  await p.reload(); await p.waitForTimeout(700);
  const back = await p.$$eval('#frameList > *', els => els.length);
  ok('the spin is still there after a reload', back === 8, back + ' frames');

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
