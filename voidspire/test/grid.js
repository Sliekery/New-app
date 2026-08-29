/* =========================================================================
 * VOIDSPIRE — test/grid.js
 * Snapping, and whether it produces the shape you meant.
 *
 * The complaint this exists for: a rectangle drawn with GRID on came out with
 * a visibly sloping bottom edge. Not a shaky hand — the grid you could SEE and
 * the grid you SNAPPED TO were two different grids. Points went to a fixed
 * 0.02 while the painted lines stepped with the zoom and were 0.2 apart at the
 * default view, so there were ten invisible sub-steps between the lines you
 * were aiming at, and the two ends of one line could land on adjacent ones.
 *
 * So the assertion is not "the point moved a bit". It is that a drag made with
 * a deliberately unsteady hand comes out EXACTLY level, and that every
 * coordinate is an exact multiple of the step that is actually being drawn.
 *
 * Usage: node test/grid.js     (tools served on :8944)
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
  await p.goto('http://localhost:8944/tools/artist.html');
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForTimeout(900);

  const art = async () => {
    const v = await p.inputValue('#out');
    const m = v.match(/art:\s*([\s\S]*),\s*$/);
    if (!m) return null;
    try { return Function('return (' + m[1] + ')')(); } catch (e) { return null; }
  };
  const status = () => p.textContent('#status');
  const box = await p.locator('#pad').boundingBox();

  /* A drag with a hand that is not steady: the two ends are a few pixels
   * apart vertically, which is exactly what a person does and exactly what
   * used to come out crooked. */
  async function wobblyLine(x0, y0, x1, y1, shift) {
    const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
    const [ax, ay] = at(x0, y0), [bx, by] = at(x1, y1);
    await p.mouse.move(ax, ay);
    await p.mouse.down();
    await p.mouse.move((ax + bx) / 2, (ay + by) / 2 + 3, { steps: 4 });
    if (shift) await p.keyboard.down('Shift');
    await p.mouse.move(bx, by, { steps: 4 });
    await p.mouse.up();
    if (shift) await p.keyboard.up('Shift');
    await p.waitForTimeout(140);
  }
  const clear = async () => {
    let n = 0;
    while (await p.$eval('#bUndo', e => !e.disabled) && ++n < 40) {
      await p.click('#bUndo'); await p.waitForTimeout(40);
    }
  };
  // MIRROR doubles every path; off, so the numbers below are the ones drawn
  await p.click('#bMirror'); await p.waitForTimeout(100);

  console.log('THE STEP YOU PICK IS THE STEP YOU GET');
  const steps = await p.$$eval('.gstep', bs => bs.map(x => x.dataset.step));
  ok('four steps are offered', steps.length === 4, steps.join(' '));
  await p.click('#mLine'); await p.waitForTimeout(80);

  for (const step of steps) {
    await p.click(`.gstep[data-step="${step}"]`);
    await p.waitForTimeout(100);
    ok('the readout says which grid you are on', /grid /.test(await status()),
      await status());
    await wobblyLine(0.28, 0.34, 0.72, 0.34);
    const a = await art();
    const pts = (a.p[0] || []);
    const g = +step;
    /* Every coordinate an exact multiple of the step. The tolerance is a
     * thousandth: the export rounds to three decimals, so 0.02 lands exactly
     * and anything off-grid is off by a whole sub-step, not by a rounding. */
    const offGrid = pts.filter(v => Math.abs(v / g - Math.round(v / g)) > 0.02);
    ok('step ' + step.padEnd(5) + ' — every point lands on it', offGrid.length === 0,
      offGrid.join(', ') + ' of ' + pts.join(', '));
    await clear();
  }

  console.log('\nA LINE MEANT TO BE LEVEL COMES OUT LEVEL');
  /* This is the screenshot, reproduced: aim at one row, wobble, and see
   * whether both ends land on it. At the coarse steps the grid alone is
   * enough; the fine ones are what ANGLE is for. */
  for (const [step, expectLevel] of [['0.2', true], ['0.1', true], ['0.02', false]]) {
    await p.click(`.gstep[data-step="${step}"]`); await p.waitForTimeout(100);
    await wobblyLine(0.28, 0.34, 0.72, 0.345);
    const q = (await art()).p[0];
    const level = q[1] === q[3];
    ok('at step ' + step.padEnd(5) + (expectLevel ? ' the grid alone holds it level'
        : ' a fine grid can still let it slope — which is what ANGLE is for'),
      level === expectLevel, 'y ' + q[1] + ' vs ' + q[3]);
    await clear();
  }

  console.log('\nANGLE MAKES IT LEVEL WHATEVER THE STEP');
  await p.click('.gstep[data-step="0.02"]'); await p.waitForTimeout(100);
  await p.click('#bAngle'); await p.waitForTimeout(100);
  ok('the readout says so', /STRAIGHT/.test(await status()), await status());
  await wobblyLine(0.28, 0.34, 0.72, 0.352);
  let q = (await art()).p[0];
  ok('the finest grid, an unsteady hand, and it is exactly level', q[1] === q[3],
    'y ' + q[1] + ' vs ' + q[3]);
  ok('and both ends are still on the grid',
    [q[0], q[2]].every(v => Math.abs(v / 0.02 - Math.round(v / 0.02)) < 0.02),
    q.join(', '));
  await clear();

  await wobblyLine(0.35, 0.3, 0.36, 0.7);
  q = (await art()).p[0];
  ok('a near-vertical drag comes out exactly vertical', q[0] === q[2],
    'x ' + q[0] + ' vs ' + q[2]);
  await clear();

  await wobblyLine(0.3, 0.3, 0.68, 0.66);
  q = (await art()).p[0];
  ok('and a diagonal is a true 45', Math.abs(Math.abs(q[2] - q[0]) - Math.abs(q[3] - q[1])) < 1e-6,
    'dx ' + (q[2] - q[0]).toFixed(3) + ' dy ' + (q[3] - q[1]).toFixed(3));
  await clear();
  await p.click('#bAngle'); await p.waitForTimeout(100);

  console.log('\nSHIFT DOES IT FOR ONE LINE WITHOUT LEAVING IT ON');
  ok('the toggle is off again', !/STRAIGHT/.test(await status()), await status());
  await wobblyLine(0.28, 0.4, 0.72, 0.412, true);
  q = (await art()).p[0];
  ok('holding shift straightens that one', q[1] === q[3], 'y ' + q[1] + ' vs ' + q[3]);
  await clear();

  console.log('\nTHE GRID DRAWN IS THE GRID SNAPPED TO');
  /* The bug itself. Read the step the painter uses straight out of the page
   * and compare it with the step a point actually lands on. */
  for (const step of ['0.2', '0.05']) {
    await p.click(`.gstep[data-step="${step}"]`); await p.waitForTimeout(120);
    const drawn = await p.evaluate(() => {
      /* Count the VERTICAL grid lines along one row. Not the middle row: the
       * world's y=0 is a multiple of every step, so the middle row sits ON a
       * horizontal line and reads as one lit run the width of the canvas. */
      const c = document.getElementById('pad');
      const g = c.getContext('2d');
      const y = Math.round(c.height / 2) + 9;
      const d = g.getImageData(0, y, c.width, 1).data;
      /* Brighter than the BACKGROUND, not brighter than some absolute number.
       * The pad's ground is rgb(10,16,20) and an absolute threshold of 12 read
       * every pixel in the row as lit, so the whole row came back as a single
       * run and the count was always 1. The commonest value in the row is the
       * background by definition. */
      const freq = {};
      for (let i = 0; i < d.length; i += 4) {
        const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
        freq[k] = (freq[k] || 0) + 1;
      }
      const bg = Object.keys(freq).sort((a, z) => freq[z] - freq[a])[0]
        .split(',').map(Number);
      let runs = 0, on = false;
      for (let i = 0; i < d.length; i += 4) {
        const lit = (d[i] - bg[0]) + (d[i + 1] - bg[1]) + (d[i + 2] - bg[2]) > 6;
        if (lit && !on) runs++;
        on = lit;
      }
      return runs;
    });
    // world span across the canvas, and how many steps fit in it
    const expect = await p.evaluate(s => Math.round(2 * 1.35 / +s) + 1, step);
    ok('at step ' + step.padEnd(5) + ' the painter draws about the right number of lines',
      Math.abs(drawn - expect) <= Math.max(3, expect * 0.25),
      drawn + ' drawn, ' + expect + ' steps across the view');
  }

  console.log('\nGRID OFF STILL MEANS OFF');
  await p.click('#bSnap'); await p.waitForTimeout(120);
  ok('the readout says freehand', /FREEHAND/.test(await status()), await status());
  await wobblyLine(0.281, 0.337, 0.719, 0.341);
  q = (await art()).p[0];
  ok('and points are no longer forced onto it',
    q.some(v => Math.abs(v / 0.05 - Math.round(v / 0.05)) > 0.02), q.join(', '));
  await p.click('#bSnap'); await p.waitForTimeout(120);
  await clear();

  console.log('\nIT IS REMEMBERED');
  await p.click('.gstep[data-step="0.1"]'); await p.waitForTimeout(100);
  await p.click('#bAngle'); await p.waitForTimeout(100);
  await p.reload(); await p.waitForTimeout(900);
  ok('the step comes back', /grid 0\.1/.test(await status()), await status());
  ok('and so does the angle lock', /STRAIGHT/.test(await status()), await status());
  ok('with the right button lit',
    await p.$eval('.gstep[data-step="0.1"]', e => e.classList.contains('on')));

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
